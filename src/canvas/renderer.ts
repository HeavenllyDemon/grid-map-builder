import type { Camera } from './camera';
import type { Project, SpriteId } from '../types';
import { brushCells, linePoints, type BrushShape } from '../lib/brush';

const COLOR_BG = 'transparent';
const COLOR_MAP_BG = '#1f1f23';
const COLOR_CHECKER_A = '#232328';
const COLOR_CHECKER_B = '#27272d';
const COLOR_GRID = 'rgba(255, 255, 255, 0.06)';
const COLOR_OUTLINE = '#f97316';
const COLOR_HOVER = '#fb923c';
const COLOR_ERASE = 'rgba(239, 68, 68, 0.28)';
const COLOR_MARQUEE_FILL = 'rgba(249, 115, 22, 0.15)';

export interface VisibleRange {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

interface LineOverlay {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  spriteId: SpriteId | null;
  brushShape: BrushShape;
  brushSize: number;
}

export interface OverlayInfo {
  hoverTile: { col: number; row: number } | null;
  activeTool: 'brush' | 'eraser' | 'line' | 'select' | 'fill' | 'eyedropper';
  activeSpriteId: SpriteId | null;
  brushSize: number;
  brushShape: BrushShape;
  marquee: {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } | null;
  linePreview: LineOverlay | null;
  selection: {
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
  } | null;
}

export function computeVisibleRange(
  project: Project,
  camera: Camera,
  canvasW: number,
  canvasH: number,
): VisibleRange {
  const { gridCols, gridRows, tileWidth, tileHeight } = project.settings;
  const halfW = canvasW / 2 / camera.zoom;
  const halfH = canvasH / 2 / camera.zoom;
  const worldLeft = camera.x - halfW;
  const worldRight = camera.x + halfW;
  const worldTop = camera.y - halfH;
  const worldBottom = camera.y + halfH;
  return {
    colStart: Math.max(0, Math.floor(worldLeft / tileWidth)),
    colEnd: Math.min(gridCols - 1, Math.ceil(worldRight / tileWidth)),
    rowStart: Math.max(0, Math.floor(worldTop / tileHeight)),
    rowEnd: Math.min(gridRows - 1, Math.ceil(worldBottom / tileHeight)),
  };
}

function tileScreenPos(
  col: number,
  row: number,
  tileW: number,
  tileH: number,
  camera: Camera,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  return {
    x: canvasW / 2 + (col * tileW - camera.x) * camera.zoom,
    y: canvasH / 2 + (row * tileH - camera.y) * camera.zoom,
  };
}

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  project: Project,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  spriteImages: Map<SpriteId, HTMLImageElement>,
  overlay?: OverlayInfo,
): void {
  const { gridCols, gridRows, tileWidth, tileHeight } = project.settings;
  const mapW = project.settings.gridCols * tileWidth;
  const mapH = project.settings.gridRows * tileHeight;

  ctx.clearRect(0, 0, canvasW, canvasH);
  if (COLOR_BG !== 'transparent') {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const mapTopLeft = tileScreenPos(
    0,
    0,
    tileWidth,
    tileHeight,
    camera,
    canvasW,
    canvasH,
  );
  const mapScreenW = mapW * camera.zoom;
  const mapScreenH = mapH * camera.zoom;

  ctx.fillStyle = COLOR_MAP_BG;
  ctx.fillRect(mapTopLeft.x, mapTopLeft.y, mapScreenW, mapScreenH);

  const range = computeVisibleRange(project, camera, canvasW, canvasH);
  const tw = tileWidth * camera.zoom;
  const th = tileHeight * camera.zoom;

  function drawBrushPreview(
    points: { col: number; row: number }[],
    spriteId: SpriteId | null,
    shape: BrushShape,
    size: number,
    erase: boolean,
  ) {
    const cells = brushCells(shape, size);
    const img = spriteId ? spriteImages.get(spriteId) : undefined;
    const seen = new Set<number>();
    ctx.save();
    for (const point of points) {
      for (const cell of cells) {
        const c = point.col + cell.dc;
        const r = point.row + cell.dr;
        if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) continue;
        const idx = r * gridCols + c;
        if (seen.has(idx)) continue;
        seen.add(idx);
        const p = tileScreenPos(
          c,
          r,
          tileWidth,
          tileHeight,
          camera,
          canvasW,
          canvasH,
        );
        if (!erase && img && img.complete) {
          ctx.globalAlpha = 0.35 + 0.25 * cell.strength;
          ctx.drawImage(img, p.x, p.y, tw, th);
          ctx.globalAlpha = 1;
        } else if (erase) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.14 + 0.18 * cell.strength})`;
          ctx.fillRect(p.x, p.y, tw, th);
        }
        ctx.strokeStyle = `rgba(251, 146, 60, ${0.35 + 0.35 * cell.strength})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, tw - 1, th - 1);
      }
    }
    ctx.restore();
  }

  for (let r = range.rowStart; r <= range.rowEnd; r++) {
    for (let c = range.colStart; c <= range.colEnd; c++) {
      ctx.fillStyle = (c + r) % 2 === 0 ? COLOR_CHECKER_A : COLOR_CHECKER_B;
      const p = tileScreenPos(c, r, tileWidth, tileHeight, camera, canvasW, canvasH);
      ctx.fillRect(p.x, p.y, tw, th);
    }
  }

  ctx.imageSmoothingEnabled = false;
  for (let r = range.rowStart; r <= range.rowEnd; r++) {
    for (let c = range.colStart; c <= range.colEnd; c++) {
      const spriteId = project.tiles[r * gridCols + c];
      if (!spriteId) continue;
      const img = spriteImages.get(spriteId);
      if (!img || !img.complete) continue;
      const p = tileScreenPos(c, r, tileWidth, tileHeight, camera, canvasW, canvasH);
      ctx.drawImage(img, p.x, p.y, tw, th);
    }
  }

  if (camera.zoom > 0.3) {
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = range.colStart; c <= range.colEnd + 1; c++) {
      const top = tileScreenPos(c, range.rowStart, tileWidth, tileHeight, camera, canvasW, canvasH);
      const bottom = tileScreenPos(c, range.rowEnd + 1, tileWidth, tileHeight, camera, canvasW, canvasH);
      ctx.moveTo(Math.round(top.x) + 0.5, top.y);
      ctx.lineTo(Math.round(top.x) + 0.5, bottom.y);
    }
    for (let r = range.rowStart; r <= range.rowEnd + 1; r++) {
      const left = tileScreenPos(range.colStart, r, tileWidth, tileHeight, camera, canvasW, canvasH);
      const right = tileScreenPos(range.colEnd + 1, r, tileWidth, tileHeight, camera, canvasW, canvasH);
      ctx.moveTo(left.x, Math.round(left.y) + 0.5);
      ctx.lineTo(right.x, Math.round(left.y) + 0.5);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = COLOR_OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    mapTopLeft.x - 0.5,
    mapTopLeft.y - 0.5,
    mapScreenW + 1,
    mapScreenH + 1,
  );

  if (overlay && overlay.hoverTile && !overlay.marquee) {
    const { col, row } = overlay.hoverTile;
    const showBrushFootprint =
      overlay.activeTool === 'eraser' ||
      ((overlay.activeTool === 'brush' || overlay.activeTool === 'line') &&
        overlay.activeSpriteId);

    if (showBrushFootprint) {
      drawBrushPreview(
        [{ col, row }],
        overlay.activeTool === 'eraser' ? null : overlay.activeSpriteId,
        overlay.brushShape,
        overlay.brushSize,
        overlay.activeTool === 'eraser',
      );
    } else {
      const p = tileScreenPos(
        col,
        row,
        tileWidth,
        tileHeight,
        camera,
        canvasW,
        canvasH,
      );
      ctx.strokeStyle = COLOR_HOVER;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, tw - 1, th - 1);
    }
  }

  if (overlay && overlay.linePreview) {
    const line = overlay.linePreview;
    drawBrushPreview(
      linePoints(line.startCol, line.startRow, line.endCol, line.endRow),
      line.spriteId,
      line.brushShape,
      line.brushSize,
      false,
    );
  }

  if (overlay && overlay.selection) {
    const { startCol, startRow, endCol, endRow } = overlay.selection;
    const minC = Math.min(startCol, endCol);
    const maxC = Math.max(startCol, endCol);
    const minR = Math.min(startRow, endRow);
    const maxR = Math.max(startRow, endRow);
    const tl = tileScreenPos(minC, minR, tileWidth, tileHeight, camera, canvasW, canvasH);
    const br = tileScreenPos(maxC + 1, maxR + 1, tileWidth, tileHeight, camera, canvasW, canvasH);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    ctx.fillStyle = 'rgba(249, 115, 22, 0.10)';
    ctx.fillRect(tl.x, tl.y, w, h);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w - 1, h - 1);
    const count = (maxC - minC + 1) * (maxR - minR + 1);
    ctx.fillStyle = '#fb923c';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${maxC - minC + 1}×${maxR - minR + 1} (${count})`,
      tl.x + 4,
      tl.y + 4,
    );
  }

  if (overlay && overlay.marquee) {
    const { startCol, startRow, endCol, endRow } = overlay.marquee;
    const minC = Math.min(startCol, endCol);
    const maxC = Math.max(startCol, endCol);
    const minR = Math.min(startRow, endRow);
    const maxR = Math.max(startRow, endRow);
    const tl = tileScreenPos(minC, minR, tileWidth, tileHeight, camera, canvasW, canvasH);
    const br = tileScreenPos(maxC + 1, maxR + 1, tileWidth, tileHeight, camera, canvasW, canvasH);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const tileCount = (maxC - minC + 1) * (maxR - minR + 1);

    if (overlay.activeTool === 'eraser') {
      ctx.fillStyle = COLOR_ERASE;
      ctx.fillRect(tl.x, tl.y, w, h);
    } else {
      ctx.fillStyle = COLOR_MARQUEE_FILL;
      ctx.fillRect(tl.x, tl.y, w, h);
    }
    ctx.strokeStyle = COLOR_OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w - 1, h - 1);
    ctx.setLineDash([]);

    ctx.fillStyle = '#fb923c';
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${maxC - minC + 1}×${maxR - minR + 1} (${tileCount})`,
      tl.x + 4,
      tl.y + 4,
    );
  }
}
