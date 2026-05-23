import { db } from './db';
import { newId } from '../lib/ids';
import type { Project, ProjectId, ProjectSettings, TileGrid } from '../types';

export async function listProjects(): Promise<Project[]> {
  const rows = await db.projects.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: ProjectId): Promise<Project | undefined> {
  return db.projects.get(id);
}

export interface NewProjectInput {
  name: string;
  settings: ProjectSettings;
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const now = Date.now();
  const { gridCols, gridRows } = input.settings;
  const tiles: TileGrid = new Array(gridCols * gridRows).fill(null);
  const project: Project = {
    id: newId(),
    name: input.name,
    settings: { ...input.settings },
    sprites: [],
    tiles,
    emptyChar: '.',
    exportCodeLength: 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.add(project);
  return project;
}

export async function updateProject(
  id: ProjectId,
  patch: Partial<Omit<Project, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() });
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() });
}

export async function renameProject(
  id: ProjectId,
  name: string,
): Promise<void> {
  await updateProject(id, { name });
}

export async function deleteProject(id: ProjectId): Promise<void> {
  await db.transaction('rw', db.projects, db.spriteBlobs, async () => {
    await db.spriteBlobs.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function duplicateProject(
  id: ProjectId,
  newName: string,
): Promise<Project | undefined> {
  const source = await db.projects.get(id);
  if (!source) return undefined;

  const now = Date.now();
  const spriteIdMap = new Map<string, string>();
  const newSprites = source.sprites.map((s) => {
    const newSpriteId = newId();
    spriteIdMap.set(s.id, newSpriteId);
    return { ...s, id: newSpriteId };
  });
  const newTiles: TileGrid = source.tiles.map((t) =>
    t ? (spriteIdMap.get(t) ?? null) : null,
  );

  const copy: Project = {
    ...source,
    id: newId(),
    name: newName,
    sprites: newSprites,
    tiles: newTiles,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.projects, db.spriteBlobs, async () => {
    const sourceBlobs = await db.spriteBlobs
      .where('projectId')
      .equals(id)
      .toArray();
    await db.projects.add(copy);
    const blobInserts = sourceBlobs
      .map((row) => {
        const mapped = spriteIdMap.get(row.spriteId);
        if (!mapped) return null;
        return {
          projectId: copy.id,
          spriteId: mapped,
          blob: row.blob,
        };
      })
      .filter((x): x is { projectId: string; spriteId: string; blob: Blob } =>
        x !== null,
      );
    if (blobInserts.length > 0) {
      await db.spriteBlobs.bulkAdd(blobInserts);
    }
  });

  return copy;
}
