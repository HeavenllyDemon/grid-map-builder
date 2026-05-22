import type { Project, SpriteId } from '../types';

const ALLOWED_SPRITE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const ALPHANUMERIC_CHAR = /^[A-Za-z0-9]$/;
export const EMPTY_CHAR = /^[A-Za-z0-9._\-]$/;

export function findUsedSprites(project: Project): SpriteId[] {
  const seen = new Set<SpriteId>();
  const order: SpriteId[] = [];
  for (const t of project.tiles) {
    if (t && !seen.has(t)) {
      seen.add(t);
      order.push(t);
    }
  }
  const spriteOrder = new Map(project.sprites.map((s, i) => [s.id, i]));
  return order.sort(
    (a, b) => (spriteOrder.get(a) ?? 0) - (spriteOrder.get(b) ?? 0),
  );
}

export function suggestChars(
  usedSpriteIds: SpriteId[],
  project: Project,
  emptyChar: string,
): Map<SpriteId, string> {
  const map = new Map<SpriteId, string>();
  const taken = new Set<string>();
  if (emptyChar.length === 1) taken.add(emptyChar);

  for (const id of usedSpriteIds) {
    const sprite = project.sprites.find((s) => s.id === id);
    const c = sprite?.exportChar;
    if (c && ALPHANUMERIC_CHAR.test(c) && !taken.has(c)) {
      map.set(id, c);
      taken.add(c);
    }
  }
  for (const id of usedSpriteIds) {
    if (map.has(id)) continue;
    for (const c of ALLOWED_SPRITE_CHARS) {
      if (!taken.has(c)) {
        map.set(id, c);
        taken.add(c);
        break;
      }
    }
  }
  return map;
}

export function buildMapText(
  project: Project,
  charMap: Map<SpriteId, string>,
  emptyChar: string,
): string {
  const { gridCols, gridRows } = project.settings;
  const rows: string[] = [];
  for (let r = 0; r < gridRows; r++) {
    let row = '';
    for (let c = 0; c < gridCols; c++) {
      const id = project.tiles[r * gridCols + c];
      row += id ? (charMap.get(id) ?? emptyChar) : emptyChar;
    }
    rows.push(row);
  }
  return rows.join('\n');
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._\- ]/g, '').trim() || 'map';
}
