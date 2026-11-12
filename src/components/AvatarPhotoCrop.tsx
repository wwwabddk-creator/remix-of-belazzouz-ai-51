import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AVATAR_JPEG_QUALITY, AVATAR_PHOTO_SIZE, cropGeometry } from "@/lib/avatar-crop";

const PREVIEW_SIZE = 260;

export function AvatarPhotoCrop({ source, ar, onClose, onSave }: { source: string; ar: boolean; onClose: () => void; onSave: (photo: string) => boolean }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    const next = new Image();
    next.onload = () => { if (active) setImage(next); };
    next.onerror = () => { if (active) setError(true); };
    next.src = source;
    return () => { active = false; next.onload = null; next.onerror = null; };
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !image) return;
    const crop = cropGeometry(image.naturalWidth, image.naturalHeight, zoom, position.x, position.y, PREVIEW_SIZE);
    context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    context.drawImage(image, crop.left, crop.top, crop.drawWidth, crop.drawHeight);
  }, [image, zoom, position]);

  const save = () => {
    if (!image) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = AVATAR_PHOTO_SIZE;
      const context = canvas.getContext("2d");
      if (!context) { setError(true); return; }
      // JPEG is opaque; the saved circle uses the existing background token outside its edge.
      context.fillStyle = canvasRef.current ? getComputedStyle(canvasRef.current).backgroundColor : "transparent";
      context.fillRect(0, 0, AVATAR_PHOTO_SIZE, AVATAR_PHOTO_SIZE);
      context.beginPath();
      context.arc(75, 75, 75, 0, Math.PI * 2);
      context.clip();
      const ratio = AVATAR_PHOTO_SIZE / PREVIEW_SIZE;
      const crop = cropGeometry(image.naturalWidth, image.naturalHeight, zoom, position.x, position.y, PREVIEW_SIZE);
      context.drawImage(image, crop.left * ratio, crop.top * ratio, crop.drawWidth * ratio, crop.drawHeight * ratio);
      if (onSave(canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY))) onClose();
    } catch { setError(true); }
  };

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-sm" aria-describedby={undefined} dir={ar ? "rtl" : "ltr"}>
      <DialogTitle>{ar ? "قص الصورة" : "Crop photo"}</DialogTitle>
      <canvas ref={canvasRef} width={PREVIEW_SIZE} height={PREVIEW_SIZE} tabIndex={0}
        aria-label={ar ? "موضع الصورة" : "Photo position"}
        className="mx-auto aspect-square w-full max-w-[260px] touch-none cursor-grab rounded-full bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId || !image) return;
          const ratio = PREVIEW_SIZE / event.currentTarget.getBoundingClientRect().width;
          const dx = (event.clientX - drag.x) * ratio;
          const dy = (event.clientY - drag.y) * ratio;
          dragRef.current = { id: drag.id, x: event.clientX, y: event.clientY };
          setPosition((prev) => {
            const crop = cropGeometry(image.naturalWidth, image.naturalHeight, zoom, prev.x + dx, prev.y + dy, PREVIEW_SIZE);
            return { x: crop.offsetX, y: crop.offsetY };
          });
        }}
        onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}
        onKeyDown={(event) => {
          const directions: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
          const direction = directions[event.key];
          if (!direction || !image) return;
          event.preventDefault();
          setPosition((prev) => {
            const crop = cropGeometry(image.naturalWidth, image.naturalHeight, zoom, prev.x + direction[0], prev.y + direction[1], PREVIEW_SIZE);
            return { x: crop.offsetX, y: crop.offsetY };
          });
        }} />
      <label className="flex items-center gap-3 text-sm">
        {ar ? "تكبير" : "Zoom"}
        <input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!image}
          aria-label={ar ? "تكبير" : "Zoom"} className="min-w-0 flex-1 accent-primary" onChange={(event) => setZoom(Number(event.target.value))} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{ar ? "تعذر معالجة الصورة. اختر صورة أخرى." : "Could not process this photo. Choose another image."}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
        <Button onClick={save} disabled={!image || error}>{ar ? "حفظ الصورة" : "Save photo"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}