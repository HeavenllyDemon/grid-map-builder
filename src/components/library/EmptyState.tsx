import { Plus, Map } from 'lucide-react';

interface Props {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/30 px-6 py-20 text-center backdrop-blur-sm">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-400 ring-1 ring-orange-500/30">
        <Map size={28} />
      </div>
      <h2 className="mb-1 text-base font-semibold tracking-tight text-zinc-100">
        No projects yet
      </h2>
      <p className="mb-6 max-w-sm text-sm text-zinc-400">
        Create your first map. Choose grid size and tile dimensions, upload
        sprites, and start building.
      </p>
      <button type="button" onClick={onCreate} className="btn-primary">
        <Plus size={16} /> Create your first project
      </button>
    </div>
  );
}
