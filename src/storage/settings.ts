import { db } from './db';

export async function getSetting<T = unknown>(
  key: string,
): Promise<T | undefined> {
  const row = await db.appSettings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.appSettings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.appSettings.delete(key);
}
