export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  return {
    x: camera.x + (sx - canvasW / 2) / camera.zoom,
    y: camera.y + (sy - canvasH / 2) / camera.zoom,
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  camera: Camera,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  return {
    x: canvasW / 2 + (wx - camera.x) * camera.zoom,
    y: canvasH / 2 + (wy - camera.y) * camera.zoom,
  };
}

export function worldToTile(
  wx: number,
  wy: number,
  tileW: number,
  tileH: number,
): { col: number; row: number } {
  return {
    col: Math.floor(wx / tileW),
    row: Math.floor(wy / tileH),
  };
}

export function fitCamera(
  gridCols: number,
  gridRows: number,
  tileW: number,
  tileH: number,
  canvasW: number,
  canvasH: number,
  padding = 40,
): Camera {
  const mapW = gridCols * tileW;
  const mapH = gridRows * tileH;
  const availW = Math.max(1, canvasW - padding * 2);
  const availH = Math.max(1, canvasH - padding * 2);
  const zoom = clampZoom(Math.min(availW / mapW, availH / mapH));
  return { x: mapW / 2, y: mapH / 2, zoom };
}
