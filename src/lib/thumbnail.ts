import type { Project, SpriteId } from '../types';

export function renderThumbnailDataUrl(
  project: Project,
  spriteImages: Map<SpriteId, HTMLImageElement>,
  maxSize = 256,
): string | undefined {
  const { gridCols, gridRows, tileWidth, tileHeight } = project.settings;
  const mapW = gridCols * tileWidth;
  const mapH = gridRows * tileHeight;
  if (mapW === 0 || mapH === 0) return undefined;

  const scale = Math.min(maxSize / mapW, maxSize / mapH, 1);
  const targetW = Math.max(1, Math.round(mapW * scale));
  const targetH = Math.max(1, Math.round(mapH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = false;

  const tw = tileWidth * scale;
  const th = tileHeight * scale;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const spriteId = project.tiles[r * gridCols + c];
      if (!spriteId) continue;
      const img = spriteImages.get(spriteId);
      if (!img || !img.complete) continue;
      ctx.drawImage(img, c * tw, r * th, tw, th);
    }
  }

  return canvas.toDataURL('image/png');
}
