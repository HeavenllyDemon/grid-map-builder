import { Download } from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';

export function FloatingExportButton() {
  const openExportModal = useEditorStore((s) => s.openExportModal);
  return (
    <button
      type="button"
      onClick={openExportModal}
      title="Export map (⌘E)"
      className="btn-primary absolute right-3 top-3 z-20"
    >
      <Download size={14} /> Export
    </button>
  );
}
