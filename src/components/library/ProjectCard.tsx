import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Project } from '../../types';
import { formatRelativeTime } from '../../lib/time';

interface Props {
  project: Project;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ProjectCard({
  project,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const { gridCols, gridRows, tileWidth, tileHeight } = project.settings;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/p/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/p/${project.id}`);
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-900/60 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-zinc-800/70 hover:shadow-xl hover:shadow-orange-500/10"
    >
      <div className="aspect-[4/3] w-full bg-gradient-to-br from-zinc-950 to-zinc-900">
        {project.thumbnailDataUrl ? (
          <img
            src={project.thumbnailDataUrl}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-700">
            no preview yet
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{project.name}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {gridCols}×{gridRows} · tiles {tileWidth}×{tileHeight}
          </div>
          <div className="mt-0.5 text-xs text-zinc-600">
            {formatRelativeTime(project.updatedAt)}
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="rounded p-1 text-zinc-500 opacity-0 hover:bg-zinc-800 hover:text-zinc-200 group-hover:opacity-100 focus:opacity-100"
            aria-label="Project menu"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg">
              <MenuItem
                icon={<Pencil size={14} />}
                label="Rename"
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
              />
              <MenuItem
                icon={<Copy size={14} />}
                label="Duplicate"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
              />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Delete"
                destructive
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-800 ${
        destructive ? 'text-red-400' : 'text-zinc-200'
      }`}
    >
      {icon} {label}
    </button>
  );
}
