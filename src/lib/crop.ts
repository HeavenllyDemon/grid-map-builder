export type CropMode = 'fit' | 'cover' | 'stretch';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeCoverRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): CropRect {
  const targetAspect = targetW / targetH;
  let cropW: number;
  let cropH: number;
  if (srcW / srcH > targetAspect) {
    cropH = srcH;
    cropW = srcH * targetAspect;
  } else {
    cropW = srcW;
    cropH = srcW / targetAspect;
  }
  const cropX = (srcW - cropW) / 2;
  const cropY = (srcH - cropH) / 2;
  return { x: cropX, y: cropY, w: cropW, h: cropH };
}

export function renderCropToCanvas(
  bitmap: ImageBitmap | HTMLImageElement,
  source: { width: number; height: number },
  mode: CropMode,
  targetW: number,
  targetH: number,
  coverRect?: CropRect,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.imageSmoothingEnabled = true;

  if (mode === 'fit') {
    const scale = Math.min(targetW / source.width, targetH / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    const dx = (targetW - w) / 2;
    const dy = (targetH - h) / 2;
    ctx.drawImage(bitmap, dx, dy, w, h);
  } else if (mode === 'stretch') {
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  } else {
    const r =
      coverRect ?? computeCoverRect(source.width, source.height, targetW, targetH);
    ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, targetW, targetH);
  }
  return canvas;
}

export async function renderCroppedToBlob(
  bitmap: ImageBitmap,
  mode: CropMode,
  targetW: number,
  targetH: number,
  coverRect?: CropRect,
): Promise<Blob> {
  const canvas = renderCropToCanvas(
    bitmap,
    { width: bitmap.width, height: bitmap.height },
    mode,
    targetW,
    targetH,
    coverRect,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}
