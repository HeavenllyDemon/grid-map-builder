export type ProjectId = string;
export type SpriteId = string;

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
  createdAt: number;
  updatedAt: number;
  thumbnailDataUrl?: string;
}
