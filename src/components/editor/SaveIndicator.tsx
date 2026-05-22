import { Check, Cloud, AlertCircle, Loader2 } from 'lucide-react';
import type { SaveState } from '../../state/editorStore';

interface Props {
  state: SaveState;
}

export function SaveIndicator({ state }: Props) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
        <Loader2 size={11} className="animate-spin" /> Saving
      </span>
    );
  }
  if (state === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Cloud size={11} /> Unsaved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-400">
        <AlertCircle size={11} /> Save failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
      <Check size={11} /> Saved
    </span>
  );
}
