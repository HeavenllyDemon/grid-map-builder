import { useEffect, useRef, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';
import { SpriteItem } from './SpriteItem';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { SpriteMeta } from '../../types';

// Offset so the palette sits cleanly below the project bar
// (top-3 = 12px) + h-9 (36px) + 8px gap = 56px = top-14
const PALETTE_TOP_CLASS = 'top-14';

export function FloatingSpritePalette() {
  const project = useEditorStore((s) => s.project);
  const spriteImages = useEditorStore((s) => s.spriteImages);
  const activeSpriteId = useEditorStore((s) => s.activeSpriteId);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selection = useEditorStore((s) => s.selection);
  const setActiveSprite = useEditorStore((s) => s.setActiveSprite);
  const fillSelection = useEditorStore((s) => s.fillSelection);
  const addSprites = useEditorStore((s) => s.addSprites);
  const removeSprite = useEditorStore((s) => s.removeSprite);
  const countTilesUsing = useEditorStore((s) => s.countTilesUsing);

  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SpriteMeta | null>(null);
  const [pendingRemoveCount, setPendingRemoveCount] = useState(0);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const result = await addSprites(files);
    const parts: string[] = [];
    if (result.added > 0) parts.push(`${result.added} added`);
    if (result.queuedForCrop > 0)
      parts.push(`${result.queuedForCrop} queued for crop`);
    if (result.failed > 0) parts.push(`${result.failed} failed`);
    if (parts.length > 0) setNotice(parts.join(' · '));
    if (fileRef.current) fileRef.current.value = '';
  }

  function requestRemove(sprite: SpriteMeta) {
    setPendingRemoveCount(countTilesUsing(sprite.id));
    setPendingRemove(sprite);
  }

  function onSpriteSelect(spriteId: string) {
    const state = useEditorStore.getState();
    const fillNow =
      state.activeTool === 'select' && state.selection !== null;
    if (fillNow) {
      fillSelection(spriteId);
    }
    setActiveSprite(spriteId);
  }

  const sprites = project?.sprites ?? [];
  const selectActive = activeTool === 'select' && selection !== null;

  return (
    <div
      className={`float-panel absolute left-3 ${PALETTE_TOP_CLASS} z-20 flex max-h-[calc(100vh-5rem)] w-64 flex-col`}
    >
      <div className="float-panel-header">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-orange-400" />
          <span className="text-xs font-semibold tracking-tight text-zinc-200">
            Sprites
          </span>
          <span className="ml-1 rounded-md bg-white/5 px-1.5 py-0 font-mono text-[10px] text-zinc-500">
            {sprites.length}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-auto p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/30 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-orange-500/50 hover:bg-orange-500/5 hover:text-orange-200"
        >
          <Plus size={14} className="transition group-hover:text-orange-400" />
          Add sprites
        </button>

        {notice && (
          <div className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2.5 py-1.5 text-[11px] text-orange-200">
            {notice}
          </div>
        )}

        {selectActive && (
          <div className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-[11px] text-orange-200">
            Click a sprite to fill the selection.
          </div>
        )}

        {project && project.sprites.length === 0 ? (
          <p className="px-1 pt-1 text-xs leading-relaxed text-zinc-500">
            Upload or drop images. Files matching tile size (
            {project.settings.tileWidth}×{project.settings.tileHeight}) or its
            aspect ratio are added directly. Others open the crop tool.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sprites.map((sprite) => (
              <SpriteItem
                key={sprite.id}
                sprite={sprite}
                image={spriteImages.get(sprite.id)}
                active={activeSpriteId === sprite.id}
                onSelect={() => onSpriteSelect(sprite.id)}
                onDelete={() => requestRemove(sprite)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Delete sprite?"
        message={
          pendingRemove
            ? pendingRemoveCount > 0
              ? `"${pendingRemove.name}" is placed on ${pendingRemoveCount} tile${
                  pendingRemoveCount === 1 ? '' : 's'
                }. Those tiles will be cleared.`
              : `"${pendingRemove.name}" will be removed from this project.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingRemove(null)}
        onConfirm={async () => {
          if (pendingRemove) await removeSprite(pendingRemove.id);
          setPendingRemove(null);
        }}
      />
    </div>
  );
}
