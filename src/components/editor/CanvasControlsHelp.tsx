import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

const STORAGE_KEY = 'mapbuilder.controlsHidden';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';
const shiftKey = isMac ? '⇧' : 'Shift';

interface Row {
  label: string;
  keys: string[];
}

const ROWS: Row[] = [
  { label: 'Brush', keys: ['B'] },
  { label: 'Eraser', keys: ['E'] },
  { label: 'Line', keys: ['L'] },
  { label: 'Select', keys: ['S'] },
  { label: 'Fill', keys: ['F'] },
  { label: 'Pick', keys: ['I'] },
  { label: 'Deselect', keys: ['Esc'] },
  { label: 'Pan', keys: ['Space', 'drag'] },
  { label: 'Zoom', keys: ['wheel'] },
  { label: 'Rectangle paint', keys: ['right-drag'] },
  { label: 'Fit to screen', keys: ['0'] },
  { label: 'Undo', keys: [modKey, 'Z'] },
  { label: 'Redo', keys: [modKey, shiftKey, 'Z'] },
  { label: 'Save', keys: [modKey, 'S'] },
  { label: 'Export', keys: [modKey, 'E'] },
];

export function CanvasControlsHelp() {
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, String(hidden));
  }, [hidden]);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        title="Show controls"
        className="float-icon-btn absolute bottom-3 right-3 z-20"
      >
        <Keyboard size={14} />
      </button>
    );
  }

  return (
    <div className="float-panel absolute bottom-3 right-3 z-20 w-60">
      <div className="float-panel-header">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-zinc-200">
          <Keyboard size={12} className="text-orange-400" />
          Controls
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          title="Hide"
          className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-auto px-3 py-2">
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 py-1 text-[11px]"
          >
            <span className="text-zinc-400">{row.label}</span>
            <span className="flex items-center gap-1">
              {row.keys.map((k, i) => (
                <kbd
                  key={i}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-200"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
