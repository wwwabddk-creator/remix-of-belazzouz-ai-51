import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceImageQuota, type ImageQuotaResult } from "./image-quota";

const GenInput = z.object({
  prompt: z.string().min(2).max(2000),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
});

// Truly keyless free providers (Pollinations mirrors) — tried first with multiple
// hosts/models/seeds. Lovable AI Gateway is the final guaranteed fallback (always
// available in Lovable Cloud).
const POLLINATIONS_HOSTS = ["https://image.pollinations.ai", "https://pollinations.ai"];
const POLLINATIONS_MODELS = ["flux", "flux-realism", "turbo", "flux-anime"];
const TIMEOUT_MS = 20000;
const ATTEMPTS = 8;

const GATEWAY_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
  "openai/gpt-image-1-mini",
];

function rand<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function randomSeed(): number { return Math.floor(Math.random() * 1_000_000_000); }

async function fetchAsDataUrl(url: string): Promise<string> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) throw new Error("not an image");
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength < 1024) throw new Error("payload too small");
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } finally { clearTimeout(tid); }
}

async function tryGateway(prompt: string, width = 1024, height = 1024): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  for (const model of GATEWAY_MODELS) {
    try {
      const isGemini = model.startsWith("google/");
      const body = isGemini
        ? { model, messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }
        : { model, prompt, size: `${width}x${height}`, quality: "low", n: 1 };
      const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const item = j.data?.[0];
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
    } catch { /* try next */ }
  }
  return null;
}

export const aiImageGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: quota, error } = await context.supabase.rpc("consume_vip_image");
    if (error) throw new Error("تعذر التحقق من رصيد الصور. Could not verify image allowance.");
    enforceImageQuota(quota as ImageQuotaResult | null);
    const w = data.width ?? 1024;
    const h = data.height ?? 1024;

    // Pollinations (keyless) — many retries
    for (let i = 0; i < ATTEMPTS; i++) {
      try {
        const host = rand(POLLINATIONS_HOSTS);
        const model = rand(POLLINATIONS_MODELS);
        const seed = randomSeed();
        const url = `${host}/prompt/${encodeURIComponent(data.prompt)}?width=${w}&height=${h}&seed=${seed}&model=${model}&nologo=true&enhance=true&referrer=belazo`;
        const dataUrl = await fetchAsDataUrl(url);
        return { ok: true as const, dataUrl };
      } catch { /* silent failover */ }
    }

    // Gateway fallback (always available in Lovable Cloud)
    const fallback = await tryGateway(data.prompt, w, h);
    if (fallback) return { ok: true as const, dataUrl: fallback };

    // Last-resort: deterministic Pollinations URL (browser will fetch it directly)
    const directUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(data.prompt)}?width=${w}&height=${h}&model=flux&nologo=true&referrer=belazo`;
    return { ok: true as const, dataUrl: directUrl };
  });
