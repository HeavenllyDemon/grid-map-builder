import Dexie, { type Table } from 'dexie';
import type { Project, ProjectId, SpriteId } from '../types';

export interface SpriteBlobRow {
  projectId: ProjectId;
  spriteId: SpriteId;
  blob: Blob;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

class MapBuilderDB extends Dexie {
  projects!: Table<Project, ProjectId>;
  spriteBlobs!: Table<SpriteBlobRow, [ProjectId, SpriteId]>;
  appSettings!: Table<SettingRow, string>;

  constructor() {
    super('mapbuilder');
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      spriteBlobs: '[projectId+spriteId], projectId',
      appSettings: 'key',
    });
  }
}

export const db = new MapBuilderDB();
