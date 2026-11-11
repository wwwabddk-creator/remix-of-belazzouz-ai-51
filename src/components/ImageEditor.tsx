import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, RotateCcw, ImageIcon, Sparkles } from "lucide-react";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { aiImageEdit } from "@/lib/image.functions";
import { addLibraryItem } from "@/lib/library";
import { toast } from "sonner";

type Adj = { brightness: number; contrast: number; saturate: number; sharpness: number; hue: number; blur: number; sepia: number; invert: number; grayscale: number };
const DEFAULT: Adj = { brightness: 100, contrast: 100, saturate: 100, sharpness: 0, hue: 0, blur: 0, sepia: 0, invert: 0, grayscale: 0 };

const RESOLUTIONS: { label: string; h: number }[] = [
  { label: "720p", h: 720 },
  { label: "1080p", h: 1080 },
  { label: "2K", h: 1440 },
  { label: "4K", h: 2160 },
  { label: "8K", h: 4320 },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }
function anonCount(kind: "img") {
  const k = `vib_anon_${kind}_${todayKey()}`;
  return Number(localStorage.getItem(k) || "0");
}
function bumpAnon(kind: "img") {
  const k = `vib_anon_${kind}_${todayKey()}`;
  localStorage.setItem(k, String(anonCount(kind) + 1));
}

// True bicubic interpolation kernel — Catmull-Rom (a = -0.5)
function bicubicKernel(t: number): number {
  const a = -0.5;
  const x = Math.abs(t);
  if (x <= 1) return (a + 2) * x * x * x - (a + 3) * x * x + 1;
  if (x < 2) return a * x * x * x - 5 * a * x * x + 8 * a * x - 4 * a;
  return 0;
}

function bicubicResize(src: HTMLCanvasElement, dw: number, dh: number): HTMLCanvasElement {
  const sw = src.width, sh = src.height;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const sData = sctx.getImageData(0, 0, sw, sh).data;
  const out = document.createElement("canvas");
  out.width = dw; out.height = dh;
  const dctx = out.getContext("2d")!;
  const dImg = dctx.createImageData(dw, dh);
  const d = dImg.data;
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const gy = (y + 0.5) * sy - 0.5;
    const iy = Math.floor(gy);
    const fy = gy - iy;
    const wy = [bicubicKernel(-1 - fy), bicubicKernel(-fy), bicubicKernel(1 - fy), bicubicKernel(2 - fy)];
    for (let x = 0; x < dw; x++) {
      const gx = (x + 0.5) * sx - 0.5;
      const ix = Math.floor(gx);
      const fx = gx - ix;
      const wx = [bicubicKernel(-1 - fx), bicubicKernel(-fx), bicubicKernel(1 - fx), bicubicKernel(2 - fx)];
      let r = 0, g = 0, b = 0, a = 0, ws = 0;
      for (let m = -1; m <= 2; m++) {
        const py = Math.min(sh - 1, Math.max(0, iy + m));
        for (let n = -1; n <= 2; n++) {
          const px = Math.min(sw - 1, Math.max(0, ix + n));
          const w = wx[n + 1] * wy[m + 1];
          const idx = (py * sw + px) * 4;
          r += sData[idx] * w;
          g += sData[idx + 1] * w;
          b += sData[idx + 2] * w;
          a += sData[idx + 3] * w;
          ws += w;
        }
      }
      const di = (y * dw + x) * 4;
      d[di] = Math.max(0, Math.min(255, r / ws));
      d[di + 1] = Math.max(0, Math.min(255, g / ws));
      d[di + 2] = Math.max(0, Math.min(255, b / ws));
      d[di + 3] = Math.max(0, Math.min(255, a / ws));
    }
  }
  dctx.putImageData(dImg, 0, 0);
  return out;
}

function upscaleCanvas(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  if (factor <= 1.01) return src;
  const dw = Math.round(src.width * factor);
  const dh = Math.round(src.height * factor);
  // Bicubic above ~16MP gets slow — fall back to iterative GPU-accelerated draw for huge targets (8K+),
  // then apply a final sharpening pass below for sub-pixel edge refinement.
  if (dw * dh > 16_000_000) {
    let cur = src, remaining = factor;
    while (remaining > 1.01) {
      const step = Math.min(2, remaining);
      const next = document.createElement("canvas");
      next.width = Math.round(cur.width * step);
      next.height = Math.round(cur.height * step);
      const ctx = next.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(cur, 0, 0, next.width, next.height);
      cur = next;
      remaining /= step;
    }
    return cur;
  }
  return bicubicResize(src, dw, dh);
}

function applySharpen(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return;
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const a = amount / 100;
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const s = src.data, d = dst.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
          v += s[((y + ky) * w + (x + kx)) * 4 + c] * k[(ky + 1) * 3 + (kx + 1)];
        }
        const orig = s[i + c];
        d[i + c] = Math.max(0, Math.min(255, orig * (1 - a) + v * a));
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/** Parse free-form modification prompt into adjustments. */
function parsePrompt(prompt: string, base: Adj): Adj {
  const p = prompt.toLowerCase();
  const a: Adj = { ...base };
  // English + Arabic keywords
  if (/cinema|cinematic|سينما/.test(p)) { a.contrast = 130; a.saturate = 115; a.sepia = 10; }
  if (/vintage|قديم|كلاسيك/.test(p)) { a.sepia = 60; a.saturate = 80; a.contrast = 105; }
  if (/black\s*&?\s*white|grayscale|أبيض\s*وأسود|رمادي/.test(p)) { a.grayscale = 100; }
  if (/warm|دافئ/.test(p)) { a.hue = 15; a.saturate = 115; }
  if (/cool|بارد/.test(p)) { a.hue = -15; }
  if (/bright|brighter|أفتح|سطوع/.test(p)) { a.brightness = Math.min(150, a.brightness + 20); }
  if (/dark|أغمق|داكن/.test(p)) { a.brightness = Math.max(50, a.brightness - 20); }
  if (/sharp|حدة|أحدّ/.test(p)) { a.sharpness = Math.min(100, a.sharpness + 50); }
  if (/blur|ضباب/.test(p)) { a.blur = 4; }
  if (/invert|عكس\s*الألوان/.test(p)) { a.invert = 100; }
  if (/vivid|saturated|مشبع/.test(p)) { a.saturate = 150; }
  if (/remove\s*background|no\s*background|بدون\s*خلفية|إزالة\s*الخلفية/.test(p)) {
    // mark — handled separately below
    (a as Adj & { _bg?: boolean })._bg = true;
  }
  return a;
}

/** Naive background removal — flood fill from corners on similar colors → transparent. */
function removeBackground(canvas: HTMLCanvasElement, tolerance = 32) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const seeds = [0, w - 1, (h - 1) * w, h * w - 1];
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const s of seeds) stack.push(s);
  const sr = d[seeds[0] * 4], sg = d[seeds[0] * 4 + 1], sb = d[seeds[0] * 4 + 2];
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    const dr = d[i] - sr, dg = d[i + 1] - sg, db = d[i + 2] - sb;
    if (dr * dr + dg * dg + db * db > tolerance * tolerance * 3) continue;
    d[i + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  ctx.putImageData(img, 0, 0);
}

export function ImageEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const { user } = useAuth();
  const ar = lang === "ar";
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("image");
  const [adj, setAdj] = useState<Adj>(DEFAULT);
  const [targetH, setTargetH] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [removeBg, setRemoveBg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const aiEdit = useServerFn(aiImageEdit);

  const filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%) hue-rotate(${adj.hue}deg) blur(${adj.blur}px) sepia(${adj.sepia}%) invert(${adj.invert}%) grayscale(${adj.grayscale}%)`;

  useEffect(() => {
    if (!img || !previewRef.current) return;
    const c = previewRef.current;
    const maxW = 520;
    const ratio = Math.min(1, maxW / img.width);
    c.width = Math.round(img.width * ratio);
    c.height = Math.round(img.height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.filter = filter;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.filter = "none";
    if (adj.sharpness > 0) applySharpen(c, adj.sharpness);
    if (removeBg) removeBackground(c);
  }, [img, adj, removeBg, filter]);

  const onFile = (f: File | null) => {
    if (!f) return;
    setErr(null);
    setName(f.name.replace(/\.[^.]+$/, ""));
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => { setImg(el); URL.revokeObjectURL(url); };
    el.src = url;
    setAdj(DEFAULT); setTargetH(null); setRemoveBg(false);
  };

  const applyPrompt = () => {
    if (!prompt.trim()) return;
    const parsed = parsePrompt(prompt, adj);
    const bg = (parsed as Adj & { _bg?: boolean })._bg;
    if (bg) setRemoveBg(true);
    delete (parsed as Adj & { _bg?: boolean })._bg;
    setAdj(parsed);
  };

  const loadFromDataUrl = (url: string) => new Promise<void>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => { setImg(el); setAdj(DEFAULT); setTargetH(null); setRemoveBg(false); resolve(); };
    el.onerror = () => reject(new Error("Image load failed"));
    el.src = url;
  });

  const canvasToBase64 = (c: HTMLCanvasElement) => c.toDataURL("image/png").split(",")[1];

  const runAiEdit = async (mode: "edit" | "upscale") => {
    if (!img || !prompt.trim() && mode === "edit") return;
    setBusy(true); setErr(null);
    try {
      const base = document.createElement("canvas");
      base.width = img.width; base.height = img.height;
      base.getContext("2d")!.drawImage(img, 0, 0);
      const b64 = canvasToBase64(base);
      const r = await aiEdit({ data: { imageBase64: b64, mimeType: "image/png", prompt: prompt.trim() || "enhance", mode } });
      if (!r.ok) { setErr("edit failed"); return; }
      await loadFromDataUrl(r.dataUrl);
      if (user) await addLibraryItem({ kind: "image", title: prompt.trim() || name, url: r.dataUrl }, user.id)
        .catch(() => toast.error(ar ? "تعذر حفظ الصورة في المكتبة." : "Could not save image to the library."));
      setPrompt("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const exportImage = async () => {
    if (!img) return;
    if (!user && anonCount("img") >= 3) { setErr(t.anonLimitImg); return; }
    setBusy(true); setErr(null);
    try {
      const base = document.createElement("canvas");
      base.width = img.width; base.height = img.height;
      const bctx = base.getContext("2d")!;
      bctx.filter = filter;
      bctx.drawImage(img, 0, 0);
      bctx.filter = "none";
      const factor = targetH ? Math.max(1, targetH / img.height) : 1;
      const out = factor > 1 ? upscaleCanvas(base, factor) : base;
      if (adj.sharpness > 0) applySharpen(out, adj.sharpness);
      if (removeBg) removeBackground(out);
      const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), "image/png", 1));
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      const tag = targetH ? `-${RESOLUTIONS.find((r) => r.h === targetH)?.label || `${targetH}p`}` : "";
      a.download = `${name}-zvw${tag}.png`;
      a.click();
      URL.revokeObjectURL(url);
      if (user) await addLibraryItem({ kind: "image", title: `${name}${tag}`, url: out.toDataURL("image/png") }, user.id)
        .catch(() => toast.error(ar ? "تعذر حفظ الصورة في المكتبة." : "Could not save image to the library."));
      if (!user) bumpAnon("img");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5" />
            {ar ? "استوديو الصور BELAZO" : "BELAZO Image Studio"}
          </DialogTitle>
        </DialogHeader>

        {!img ? (
          <label className="flex h-60 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/30 text-muted-foreground hover:bg-card/50">
            <Upload className="h-10 w-10" />
            <span className="text-base">{ar ? "اختر صورة لتعديلها (لن يُعاد إنشاؤها)" : "Pick an image to modify (keeps original content)"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              <div className="flex items-center justify-center rounded-2xl border border-border bg-black/40 p-2">
                <canvas ref={previewRef} className="max-h-[420px] w-auto rounded" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3 py-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-[color:var(--vip)]" />
                  {t.aiEdit}
                </label>
                <Switch checked={aiMode} onCheckedChange={setAiMode} />
              </div>
              <div className="flex gap-2">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t.modifyRequest}
                  className="h-12 text-base"
                  onKeyDown={(e) => { if (e.key === "Enter") aiMode ? runAiEdit("edit") : applyPrompt(); }}
                />
                <Button
                  disabled={busy}
                  onClick={() => aiMode ? runAiEdit("edit") : applyPrompt()}
                  className="h-12 brand-gradient text-primary-foreground"
                >
                  {busy ? "…" : t.apply2}
                </Button>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-muted-foreground">{t.upscaleTo}</div>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTIONS.map((r) => (
                    <Button key={r.label} type="button" size="lg"
                      variant={targetH === r.h ? "default" : "outline"}
                      className={`h-11 ${targetH === r.h ? "brand-gradient text-primary-foreground" : ""}`}
                      onClick={() => setTargetH(targetH === r.h ? null : r.h)}>{r.label}</Button>
                  ))}
                  <Button type="button" size="lg" variant="outline" disabled={busy}
                    className="h-11 gap-1 border-[color:var(--vip)]/50 text-[color:var(--vip)]"
                    onClick={() => runAiEdit("upscale")}>
                    <Sparkles className="h-4 w-4" /> {t.aiUpscale}
                  </Button>
                </div>
                {targetH && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(img.width * (targetH / img.height))} × {targetH}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {[
                { k: "brightness" as const, label: ar ? "السطوع" : "Brightness", min: 50, max: 150 },
                { k: "contrast" as const, label: ar ? "التباين" : "Contrast", min: 50, max: 150 },
                { k: "saturate" as const, label: ar ? "التشبع" : "Saturation", min: 0, max: 200 },
                { k: "sharpness" as const, label: ar ? "الحدة" : "Sharpness", min: 0, max: 100 },
                { k: "hue" as const, label: ar ? "تدوير اللون" : "Hue", min: -180, max: 180 },
              ].map((f) => (
                <div key={f.k}>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{f.label}</span><span>{adj[f.k]}</span>
                  </div>
                  <Slider value={[adj[f.k]]} min={f.min} max={f.max} step={1}
                    onValueChange={([v]) => setAdj((p) => ({ ...p, [f.k]: v }))} />
                </div>
              ))}
              <Button
                type="button"
                variant={removeBg ? "default" : "outline"}
                onClick={() => setRemoveBg((v) => !v)}
                className={`w-full h-11 ${removeBg ? "brand-gradient text-primary-foreground" : ""}`}
              >
                {ar ? "إزالة الخلفية" : "Remove background"}
              </Button>
              {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{err}</p>}
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={exportImage} disabled={busy} className="h-12 brand-gradient text-primary-foreground">
                  <Download className={ar ? "ml-2 h-5 w-5" : "mr-2 h-5 w-5"} />
                  {ar ? "تنزيل" : "Download"}
                </Button>
                <Button variant="outline" className="h-11" onClick={() => { setAdj(DEFAULT); setTargetH(null); setRemoveBg(false); setPrompt(""); }}>
                  <RotateCcw className={ar ? "ml-2 h-5 w-5" : "mr-2 h-5 w-5"} />
                  {ar ? "إعادة" : "Reset"}
                </Button>
                <Button variant="ghost" className="h-11" onClick={() => { setImg(null); setAdj(DEFAULT); setTargetH(null); setRemoveBg(false); }}>
                  {ar ? "صورة أخرى" : "New image"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
