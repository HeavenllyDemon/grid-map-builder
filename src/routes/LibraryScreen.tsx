import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLibraryStore } from '../state/libraryStore';
import { ProjectCard } from '../components/library/ProjectCard';
import { NewProjectModal } from '../components/library/NewProjectModal';
import { RenameModal } from '../components/library/RenameModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/library/EmptyState';
import { UpdatePanel } from '../components/update/UpdatePanel';
import type { Project } from '../types';

export function LibraryScreen() {
  const navigate = useNavigate();
  const projects = useLibraryStore((s) => s.projects);
  const loading = useLibraryStore((s) => s.loading);
  const load = useLibraryStore((s) => s.load);
  const create = useLibraryStore((s) => s.create);
  const rename = useLibraryStore((s) => s.rename);
  const duplicate = useLibraryStore((s) => s.duplicate);
  const remove = useLibraryStore((s) => s.remove);

  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800/70 bg-zinc-900/40 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30">
            <div className="grid h-3.5 w-3.5 grid-cols-2 gap-px">
              <div className="bg-white/90" />
              <div className="bg-white/40" />
              <div className="bg-white/40" />
              <div className="bg-white/90" />
            </div>
          </div>
          <h1 className="text-base font-semibold tracking-tight">Grid Map Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <UpdatePanel />
          <button type="button" onClick={() => setNewOpen(true)} className="btn-primary">
            <Plus size={16} /> New Project
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {loading && projects.length === 0 ? (
          <div className="text-center text-sm text-zinc-500">Loading…</div>
        ) : projects.length === 0 ? (
          <EmptyState onCreate={() => setNewOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={() => setRenaming(project)}
                onDuplicate={() => duplicate(project.id)}
                onDelete={() => setDeleting(project)}
              />
            ))}
          </div>
        )}
      </main>

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={async (input) => {
          const project = await create(input);
          setNewOpen(false);
          navigate(`/p/${project.id}`);
        }}
      />

      <RenameModal
        open={renaming !== null}
        initialName={renaming?.name ?? ''}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (renaming) await rename(renaming.id, name);
          setRenaming(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete project?"
        message={
          deleting
            ? `"${deleting.name}" and all its sprites will be permanently removed.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
