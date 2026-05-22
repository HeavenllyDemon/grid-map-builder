import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useEditorStore } from '../../state/editorStore';
import {
  ALPHANUMERIC_CHAR,
  EMPTY_CHAR,
  buildMapText,
  downloadText,
  findUsedSprites,
  sanitizeFilename,
  suggestChars,
} from '../../lib/exportMap';
import type { SpriteId } from '../../types';

export function ExportModal() {
  const project = useEditorStore((s) => s.project);
  const open = useEditorStore((s) => s.exportModalOpen);
  const close = useEditorStore((s) => s.closeExportModal);
  const spriteImages = useEditorStore((s) => s.spriteImages);
  const setSpriteExportChar = useEditorStore((s) => s.setSpriteExportChar);
  const setEmptyCharStore = useEditorStore((s) => s.setEmptyChar);

  const usedIds = useMemo(
    () => (project ? findUsedSprites(project) : []),
    [project],
  );

  const [chars, setChars] = useState<Record<SpriteId, string>>({});
  const [emptyChar, setEmptyChar] = useState('.');
  const [filename, setFilename] = useState('');

  useEffect(() => {
    if (!open || !project) return;
    const suggested = suggestChars(usedIds, project, project.emptyChar);
    const obj: Record<SpriteId, string> = {};
    for (const [id, c] of suggested) obj[id] = c;
    setChars(obj);
    setEmptyChar(project.emptyChar);
    setFilename(`${sanitizeFilename(project.name)}.txt`);
  }, [open, project, usedIds]);

  if (!project) return null;

  const errors: Record<string, string> = {};

  if (!EMPTY_CHAR.test(emptyChar)) {
    errors.emptyChar = 'Must be a single character from A-Z, a-z, 0-9, . _ -';
  }

  const charCounts: Record<string, number> = {};
  charCounts[emptyChar] = 1;
  for (const id of usedIds) {
    const c = chars[id] ?? '';
    if (!ALPHANUMERIC_CHAR.test(c)) {
      errors[`sprite:${id}`] = 'Single A-Z, a-z, or 0-9';
    } else {
      charCounts[c] = (charCounts[c] ?? 0) + 1;
    }
  }
  for (const id of usedIds) {
    const c = chars[id];
    if (c && charCounts[c] > 1) {
      errors[`sprite:${id}`] = 'Duplicate character';
    }
  }
  if (charCounts[emptyChar] > 1) {
    errors.emptyChar = 'Conflicts with a sprite character';
  }

  if (!filename.trim()) {
    errors.filename = 'Required';
  }

  const valid = Object.keys(errors).length === 0;

  function setCharFor(id: SpriteId, value: string) {
    const v = value.slice(0, 1);
    setChars((prev) => ({ ...prev, [id]: v }));
  }

  function doExport() {
    if (!valid || !project) return;
    for (const id of usedIds) {
      const c = chars[id];
      if (c) setSpriteExportChar(id, c);
    }
    if (project.emptyChar !== emptyChar) setEmptyCharStore(emptyChar);
    const map = new Map<SpriteId, string>();
    for (const id of usedIds) {
      const c = chars[id];
      if (c) map.set(id, c);
    }
    const text = buildMapText(project, map, emptyChar);
    const safe = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    downloadText(safe, text);
  }

  const noUsage = usedIds.length === 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Export map as text"
      widthClass="w-full max-w-xl"
    >
      <div className="flex flex-col gap-4">
        {noUsage ? (
          <p className="rounded-md border border-amber-800/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
            No sprites placed on this map. The export will be filled entirely
            with the empty-tile character.
          </p>
        ) : (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
              Characters ({usedIds.length} sprite
              {usedIds.length === 1 ? '' : 's'} used)
            </div>
            <div className="flex max-h-72 flex-col gap-1.5 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-2">
              {usedIds.map((id) => {
                const sprite = project.sprites.find((s) => s.id === id);
                if (!sprite) return null;
                const img = spriteImages.get(id);
                const err = errors[`sprite:${id}`];
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded p-1"
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-zinc-800 bg-zinc-900">
                      {img && (
                        <img
                          src={img.src}
                          alt=""
                          className="h-full w-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                          draggable={false}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{sprite.name}</div>
                      {err && (
                        <div className="text-[11px] text-red-400">{err}</div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={chars[id] ?? ''}
                      onChange={(e) => setCharFor(id, e.target.value)}
                      maxLength={1}
                      className={`h-9 w-12 rounded-md border bg-zinc-950 text-center font-mono text-base focus:outline-none ${
                        err
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-zinc-700 focus:border-orange-500'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-zinc-400">
              Empty tile char
            </span>
            <input
              type="text"
              value={emptyChar}
              onChange={(e) => setEmptyChar(e.target.value.slice(0, 1))}
              maxLength={1}
              className={`rounded-md border bg-zinc-950 px-3 py-1.5 text-center font-mono focus:outline-none ${
                errors.emptyChar
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.emptyChar && (
              <span className="text-[11px] text-red-400">
                {errors.emptyChar}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-zinc-400">
              Filename
            </span>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className={`rounded-md border bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none ${
                errors.filename
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-zinc-700 focus:border-orange-500'
              }`}
            />
            {errors.filename && (
              <span className="text-[11px] text-red-400">
                {errors.filename}
              </span>
            )}
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={doExport}
            disabled={!valid}
            className="btn-primary"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>
    </Modal>
  );
}
