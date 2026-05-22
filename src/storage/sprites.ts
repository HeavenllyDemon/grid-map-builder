import { db } from './db';
import type { ProjectId, SpriteId } from '../types';

export async function addSpriteBlob(
  projectId: ProjectId,
  spriteId: SpriteId,
  blob: Blob,
): Promise<void> {
  await db.spriteBlobs.put({ projectId, spriteId, blob });
}

export async function getSpriteBlob(
  projectId: ProjectId,
  spriteId: SpriteId,
): Promise<Blob | undefined> {
  const row = await db.spriteBlobs.get([projectId, spriteId]);
  return row?.blob;
}

export async function getSpriteBlobs(
  projectId: ProjectId,
): Promise<Map<SpriteId, Blob>> {
  const rows = await db.spriteBlobs
    .where('projectId')
    .equals(projectId)
    .toArray();
  const map = new Map<SpriteId, Blob>();
  for (const row of rows) map.set(row.spriteId, row.blob);
  return map;
}

export async function removeSpriteBlob(
  projectId: ProjectId,
  spriteId: SpriteId,
): Promise<void> {
  await db.spriteBlobs.delete([projectId, spriteId]);
}
