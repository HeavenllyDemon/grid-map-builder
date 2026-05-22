import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { SpriteMeta } from '../../types';
import { useEditorStore } from '../../state/editorStore';

interface Props {
  sprite: SpriteMeta;
  image: HTMLImageElement | undefined;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function SpriteItem({
  sprite,
  image,
  active,
  onSelect,
  onDelete,
}: Props) {
  const startSpriteDrag = useEditorStore((s) => s.startSpriteDrag);
  const renameSprite = useEditorStore((s) => s.renameSprite);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sprite.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(sprite.name);
  }, [sprite.name, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function onPointerDown(e: React.PointerEvent) {
    if (editing) return;
    if (e.button !== 0) return;
    e.preventDefault();
    startSpriteDrag(sprite.id, e.clientX, e.clientY);
  }

  function commitRename() {
    const next = draft.trim();
    if (next.length > 0 && next !== sprite.name) renameSprite(sprite.id, next);
    setEditing(false);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!editing) onSelect();
      }}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 transition ${
        active
          ? 'border-orange-500/70 bg-orange-500/10 shadow-md shadow-orange-500/15'
          : 'border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40'
      }`}
    >
      {active && (
        <span className="absolute -left-1 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-orange-400" />
      )}
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        {image ? (
          <img
            src={image.src}
            alt={sprite.name}
            className="h-full w-full object-contain"
            style={{ imageRendering: 'pixelated' }}
            draggable={false}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraft(sprite.name);
                setEditing(false);
              }
            }}
            className="input-field py-0.5 text-xs"
          />
        ) : (
          <div
            className={`truncate text-xs font-medium ${
              active ? 'text-orange-100' : 'text-zinc-100'
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title="Double-click to rename"
          >
            {sprite.name}
          </div>
        )}
        <div className="text-[10px] text-zinc-500">
          {sprite.width}×{sprite.height}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded p-1 text-zinc-500 opacity-0 hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Delete ${sprite.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
