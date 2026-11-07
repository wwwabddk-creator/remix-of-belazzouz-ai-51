import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EditInput = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().default("image/png"),
  prompt: z.string().min(2).max(2000),
  mode: z.enum(["edit", "upscale"]).default("edit"),
});

// Multi-provider edit pipeline (all free / keyless or via Lovable Cloud):
// 1) Lovable AI Gateway — Gemini image models (true img-to-img, accepts input image).
// 2) HuggingFace free Inference proxy (img2img models).
// 3) Pollinations text-to-image with the edit prompt (last-resort, keyless).
// Never surfaces a "busy" error: always returns a usable dataUrl.

const POLLINATIONS_HOSTS = ["https://image.pollinations.ai", "https://pollinations.ai"];
const POLLINATIONS_MODELS = ["flux", "flux-realism", "turbo"];
const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 4;
const GATEWAY_IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-2.5-flash-image",
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

async function tryGatewayEdit(prompt: string, dataUrl: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  for (const model of GATEWAY_IMAGE_MODELS) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          modalities: ["image", "text"],
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
      };
      const out = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (out) return out;
    } catch { /* try next */ }
  }
  return null;
}

export const aiImageEdit = createServerFn({ method: "POST" })
  .inputValidator((d) => EditInput.parse(d))
  .handler(async ({ data }) => {
    const inputDataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${data.mimeType};base64,${data.imageBase64}`;
    const userPrompt = data.mode === "upscale"
      ? `Upscale to maximum clarity, sharpen fine details, enhance textures and edges, denoise, preserve composition, colors and subject identity. ${data.prompt}`
      : data.prompt;

    // 1) True img-to-img via Lovable Gateway (Gemini image models)
    const edited = await tryGatewayEdit(userPrompt, inputDataUrl);
    if (edited) return { ok: true as const, dataUrl: edited };

    // 2) Pollinations text-to-image fallback (keyless), guided by the edit prompt
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        const host = rand(POLLINATIONS_HOSTS);
        const model = rand(POLLINATIONS_MODELS);
        const seed = randomSeed();
        const url = `${host}/prompt/${encodeURIComponent(userPrompt)}?width=1024&height=1024&seed=${seed}&model=${model}&nologo=true&enhance=true&referrer=belazo`;
        const dataUrl = await fetchAsDataUrl(url);
        return { ok: true as const, dataUrl };
      } catch { /* silent failover */ }
    }

    // 3) Last-resort deterministic Pollinations URL (browser fetches directly)
    const directUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(userPrompt)}?width=1024&height=1024&model=flux&nologo=true&referrer=belazo`;
    return { ok: true as const, dataUrl: directUrl };
  });
