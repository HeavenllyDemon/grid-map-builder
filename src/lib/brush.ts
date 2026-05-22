export type BrushShape = 'square' | 'circle' | 'diamond' | 'scatter';

export interface BrushCell {
  dc: number;
  dr: number;
  strength: number;
}

export interface TilePoint {
  col: number;
  row: number;
}

export const DEFAULT_BRUSH_SIZE = 1;
export const DEFAULT_BRUSH_SHAPE: BrushShape = 'square';
export const BRUSH_SIZE_LIMITS = { min: 1, max: 9, step: 2 };

export function clampBrushSize(size: number): number {
  const rounded = Math.round(size);
  const clamped = Math.max(
    BRUSH_SIZE_LIMITS.min,
    Math.min(BRUSH_SIZE_LIMITS.max, rounded),
  );
  return clamped % 2 === 0
    ? Math.min(BRUSH_SIZE_LIMITS.max, clamped + 1)
    : clamped;
}

function pseudoRandom(dc: number, dr: number, size: number): number {
  const n = Math.sin(dc * 127.1 + dr * 311.7 + size * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function brushCells(
  shape: BrushShape,
  size: number,
  options: { randomize?: boolean } = {},
): BrushCell[] {
  const brushSize = clampBrushSize(size);
  const maxOffset = Math.floor(brushSize / 2);
  const cells: BrushCell[] = [];

  for (let dr = -maxOffset; dr <= maxOffset; dr++) {
    for (let dc = -maxOffset; dc <= maxOffset; dc++) {
      const distance = Math.hypot(dc, dr);
      let include = false;
      let strength = 1;

      if (shape === 'square') {
        include = true;
      } else if (shape === 'circle') {
        include = distance <= brushSize / 2;
      } else if (shape === 'diamond') {
        include = Math.abs(dc) + Math.abs(dr) <= maxOffset;
      } else {
        const falloff =
          maxOffset === 0 ? 1 : 1.08 - distance / (maxOffset + 1);
        strength = Math.max(0.18, Math.min(1, falloff));
        include =
          (dc === 0 && dr === 0) ||
          (options.randomize ? Math.random() : pseudoRandom(dc, dr, brushSize)) <
            strength;
      }

      if (include) cells.push({ dc, dr, strength });
    }
  }

  return cells;
}

export function linePoints(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
): TilePoint[] {
  const points: TilePoint[] = [];
  let col = startCol;
  let row = startRow;
  const dc = Math.abs(endCol - startCol);
  const dr = Math.abs(endRow - startRow);
  const sc = startCol < endCol ? 1 : -1;
  const sr = startRow < endRow ? 1 : -1;
  let err = dc - dr;

  while (true) {
    points.push({ col, row });
    if (col === endCol && row === endRow) break;
    const e2 = err * 2;
    if (e2 > -dr) {
      err -= dr;
      col += sc;
    }
    if (e2 < dc) {
      err += dc;
      row += sr;
    }
  }

  return points;
}
