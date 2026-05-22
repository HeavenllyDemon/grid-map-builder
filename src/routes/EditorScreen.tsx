import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useEditorStore } from '../state/editorStore';
import { MapCanvas } from '../components/editor/MapCanvas';
import { DragGhost } from '../components/editor/DragGhost';
import { SpriteCropModal } from '../components/editor/SpriteCropModal';
import { ExportModal } from '../components/editor/ExportModal';
import { FloatingProjectBar } from '../components/editor/FloatingProjectBar';
import { FloatingToolbar } from '../components/editor/FloatingToolbar';
import { FloatingExportButton } from '../components/editor/FloatingExportButton';
import { FloatingSpritePalette } from '../components/editor/FloatingSpritePalette';

export function EditorScreen() {
  const { projectId } = useParams();
  const project = useEditorStore((s) => s.project);
  const loading = useEditorStore((s) => s.loading);
  const loadError = useEditorStore((s) => s.loadError);
  const loadProject = useEditorStore((s) => s.loadProject);
  const unload = useEditorStore((s) => s.unload);
  const flushSave = useEditorStore((s) => s.flushSave);
  const dragActive = useEditorStore((s) => s.drag !== null);
  const addSprites = useEditorStore((s) => s.addSprites);

  const [fileDropActive, setFileDropActive] = useState(false);
  const dropCounterRef = useRef(0);

  useEffect(() => {
    if (!projectId) return;
    loadProject(projectId);
    return () => {
      flushSave();
      unload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!dragActive) return;
    const onMove = (e: PointerEvent) => {
      useEditorStore.getState().updateDragPosition(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      const state = useEditorStore.getState();
      const drag = state.drag;
      if (drag && drag.active && state.hitTest) {
        const tile = state.hitTest(e.clientX, e.clientY);
        if (tile) state.placeTile(tile.col, tile.row, drag.spriteId);
      }
      state.cancelSpriteDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragActive]);

  useEffect(() => {
    const isEditable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable);
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) useEditorStore.getState().redo();
          else useEditorStore.getState().undo();
        } else if (k === 'y') {
          e.preventDefault();
          useEditorStore.getState().redo();
        } else if (k === 's') {
          e.preventDefault();
          useEditorStore.getState().flushSave();
        } else if (k === 'e') {
          e.preventDefault();
          useEditorStore.getState().openExportModal();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('brush');
      } else if (k === 'e') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('eraser');
      } else if (k === 'l') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('line');
      } else if (k === 's') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('select');
      } else if (k === 'f') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('fill');
      } else if (k === 'i') {
        e.preventDefault();
        useEditorStore.getState().setActiveTool('eyedropper');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.selection) state.setSelection(null);
        else state.setActiveSprite(null);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        const state = useEditorStore.getState();
        if (state.selection) {
          e.preventDefault();
          state.fillSelection(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading project…
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-sm text-zinc-400">
          {loadError ?? 'Project not found'}
        </div>
        <Link to="/" className="btn-secondary">
          Back to library
        </Link>
      </div>
    );
  }

  function hasFiles(dt: DataTransfer | null) {
    if (!dt) return false;
    return Array.from(dt.types).includes('Files');
  }

  function onDragEnter(e: React.DragEvent) {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dropCounterRef.current += 1;
    setFileDropActive(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave(e: React.DragEvent) {
    if (!hasFiles(e.dataTransfer)) return;
    dropCounterRef.current = Math.max(0, dropCounterRef.current - 1);
    if (dropCounterRef.current === 0) setFileDropActive(false);
  }
  function onDrop(e: React.DragEvent) {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dropCounterRef.current = 0;
    setFileDropActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length > 0) addSprites(files);
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <MapCanvas />
      <FloatingProjectBar />
      <FloatingToolbar />
      <FloatingExportButton />
      <FloatingSpritePalette />
      <DragGhost />
      <SpriteCropModal />
      <ExportModal />
      {fileDropActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-orange-500/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-orange-400/70 bg-zinc-900/70 px-10 py-8 shadow-2xl shadow-orange-500/20 backdrop-blur-md">
            <Upload size={32} className="text-orange-400" />
            <div className="text-sm font-medium text-zinc-100">
              Drop images to add sprites
            </div>
            <div className="text-xs text-zinc-400">
              Matching aspect → added directly. Other sizes → crop tool.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
