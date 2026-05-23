import type { ExportCodeLength, Project, SpriteId } from '../types';

const ALLOWED_SPRITE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const EXPORT_CODE_LENGTHS: ExportCodeLength[] = [1, 2, 3];
export const DEFAULT_EXPORT_CODE_LENGTH: ExportCodeLength = 1;
export const ALPHANUMERIC_CODE = /^[A-Za-z0-9]+$/;
export const EMPTY_CODE = /^[A-Za-z0-9._\-]+$/;

export function normalizeExportCodeLength(
  value: unknown,
): ExportCodeLength {
  return value === 1 || value === 2 || value === 3
    ? value
    : DEFAULT_EXPORT_CODE_LENGTH;
}

export function maxCodesForLength(length: ExportCodeLength): number {
  return ALLOWED_SPRITE_CHARS.length ** length;
}

export function validSpriteCode(
  value: string,
  length: ExportCodeLength,
): boolean {
  return value.length === length && ALPHANUMERIC_CODE.test(value);
}

export function exportCodeFromName(name: string): string | null {
  const code = name.trim();
  return /^[A-Za-z0-9]{1,3}$/.test(code) ? code : null;
}

export function validEmptyCode(
  value: string,
  length: ExportCodeLength,
): boolean {
  return value.length === length && EMPTY_CODE.test(value);
}

export function normalizeEmptyCode(
  value: string | undefined,
  length: ExportCodeLength,
): string {
  const seed = value && EMPTY_CODE.test(value[0]) ? value[0] : '.';
  return seed.repeat(length);
}

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

function codeAt(index: number, length: ExportCodeLength): string {
  const base = ALLOWED_SPRITE_CHARS.length;
  const chars = new Array<string>(length);
  let n = index;
  for (let i = length - 1; i >= 0; i--) {
    chars[i] = ALLOWED_SPRITE_CHARS[n % base];
    n = Math.floor(n / base);
  }
  return chars.join('');
}

export function suggestChars(
  usedSpriteIds: SpriteId[],
  project: Project,
  emptyChar: string,
  codeLength: ExportCodeLength,
): Map<SpriteId, string> {
  const map = new Map<SpriteId, string>();
  const taken = new Set<string>();
  if (validEmptyCode(emptyChar, codeLength)) taken.add(emptyChar);

  for (const id of usedSpriteIds) {
    const sprite = project.sprites.find((s) => s.id === id);
    const c = sprite?.exportChar;
    if (c && validSpriteCode(c, codeLength) && !taken.has(c)) {
      map.set(id, c);
      taken.add(c);
    }
  }
  for (const id of usedSpriteIds) {
    if (map.has(id)) continue;
    const sprite = project.sprites.find((s) => s.id === id);
    const c = sprite ? exportCodeFromName(sprite.name) : null;
    if (c && validSpriteCode(c, codeLength) && !taken.has(c)) {
      map.set(id, c);
      taken.add(c);
    }
  }
  const max = maxCodesForLength(codeLength);
  let nextIndex = 0;
  for (const id of usedSpriteIds) {
    if (map.has(id)) continue;
    while (nextIndex < max) {
      const c = codeAt(nextIndex, codeLength);
      nextIndex += 1;
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
