export const AVATAR_PHOTO_SIZE = 150;
export const AVATAR_JPEG_QUALITY = 0.82;

export function cropGeometry(width: number, height: number, zoom: number, x: number, y: number, size: number) {
  const scale = Math.max(size / width, size / height) * Math.max(1, zoom);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const offsetX = Math.max(-(drawWidth - size) / 2, Math.min((drawWidth - size) / 2, x));
  const offsetY = Math.max(-(drawHeight - size) / 2, Math.min((drawHeight - size) / 2, y));
  return { scale, offsetX, offsetY, left: (size - drawWidth) / 2 + offsetX, top: (size - drawHeight) / 2 + offsetY, drawWidth, drawHeight };
}