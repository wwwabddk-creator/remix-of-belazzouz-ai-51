import { expect, it } from "vitest";
import { AVATAR_PHOTO_SIZE, AVATAR_JPEG_QUALITY, cropGeometry } from "./avatar-crop";

it("exports a 150 by 150 output and compressed JPEG quality", () => {
  expect(AVATAR_PHOTO_SIZE).toBe(150);
  expect(AVATAR_JPEG_QUALITY).toBe(0.82);
});
it("centers a wide photo while covering the circle", () => {
  expect(cropGeometry(400, 200, 1, 0, 0, 150)).toEqual({ scale: 0.75, offsetX: 0, offsetY: 0, left: -75, top: 0, drawWidth: 300, drawHeight: 150 });
});
it("clamps drag position so zoomed photos never expose empty edges", () => {
  const crop = cropGeometry(200, 200, 2, 999, -999, 150);
  expect(crop.offsetX).toBe(75);
  expect(crop.offsetY).toBe(-75);
  expect(crop.left).toBe(0);
  expect(crop.top).toBe(-150);
});