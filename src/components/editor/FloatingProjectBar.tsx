import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';
import { SaveIndicator } from './SaveIndicator';

export function FloatingProjectBar() {
  const project = useEditorStore((s) => s.project);
  const saveState = useEditorStore((s) => s.saveState);
  const setProjectName = useEditorStore((s) => s.setProjectName);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project?.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(project?.name ?? '');
  }, [project?.name, editing]);

  if (!project) return null;

  function commit() {
    const next = draft.trim();
    if (next.length > 0 && next !== project!.name) setProjectName(next);
    else setDraft(project!.name);
    setEditing(false);
  }

  return (
    <div className="float-pill absolute left-3 top-3 z-20">
      <Link to="/" title="Back to library" className="pill-btn">
        <ArrowLeft size={13} /> Library
      </Link>
      <span className="select-none text-zinc-700">/</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(project.name);
              setEditing(false);
            }
          }}
          className="min-w-0 rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-sm text-zinc-100 focus:border-orange-500/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          style={{ width: `${Math.max(8, Math.min(28, draft.length + 1))}ch` }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="pill-btn max-w-[14rem] truncate text-zinc-100"
          title="Click to rename"
        >
          {project.name}
        </button>
      )}
      <div className="pill-btn pointer-events-none">
        <SaveIndicator state={saveState} />
      </div>
    </div>
  );
}
