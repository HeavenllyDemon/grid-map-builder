export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export function revokeImage(img: HTMLImageElement): void {
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
}

function drawBitmapToCanvas(
  bitmap: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

function fallbackHash(bytes: Uint8ClampedArray): string {
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (const b of bytes) {
    h1 = Math.imul(h1 ^ b, 2654435761);
    h2 = Math.imul(h2 ^ b, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

async function hashImageData(imageData: ImageData): Promise<string> {
  const bytes = imageData.data;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  }
  return fallbackHash(bytes);
}

async function hashCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hash = await hashImageData(imageData);
  return `${canvas.width}x${canvas.height}:${hash}`;
}

export async function bitmapToPngBlobAndHash(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<{ blob: Blob; imageHash: string }> {
  const canvas = drawBitmapToCanvas(bitmap, width, height);
  const [blob, imageHash] = await Promise.all([
    canvasToPngBlob(canvas),
    hashCanvas(canvas),
  ]);
  return { blob, imageHash };
}

export async function bitmapToPngBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob> {
  const result = await bitmapToPngBlobAndHash(bitmap, width, height);
  return result.blob;
}

export async function hashImageBlob(
  blob: Blob,
  width: number,
  height: number,
): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = drawBitmapToCanvas(bitmap, width, height);
    return await hashCanvas(canvas);
  } finally {
    bitmap.close();
  }
}

export async function hashImageElement(
  img: HTMLImageElement,
  width: number,
  height: number,
): Promise<string> {
  const canvas = drawBitmapToCanvas(img, width, height);
  return hashCanvas(canvas);
}
