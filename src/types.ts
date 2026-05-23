export type ProjectId = string;
export type SpriteId = string;
export type ExportCodeLength = 1 | 2 | 3;

export interface ProjectSettings {
  gridCols: number;
  gridRows: number;
  tileWidth: number;
  tileHeight: number;
}

export interface SpriteMeta {
  id: SpriteId;
  name: string;
  width: number;
  height: number;
  exportChar?: string;
  imageHash?: string;
  createdAt: number;
}

export type TileGrid = (SpriteId | null)[];

export interface Project {
  id: ProjectId;
  name: string;
  settings: ProjectSettings;
  sprites: SpriteMeta[];
  tiles: TileGrid;
  emptyChar: string;
  exportCodeLength?: ExportCodeLength;
  createdAt: number;
  updatedAt: number;
  thumbnailDataUrl?: string;
}
