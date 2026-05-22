import {
  Brush,
  Eraser,
  BoxSelect,
  PaintBucket,
  Pipette,
} from 'lucide-react';
import { useEditorStore, type Tool } from '../../state/editorStore';

interface ToolDef {
  tool: Tool;
  icon: typeof Brush;
  label: string;
  shortcut: string;
  description: string;
}

const TOOLS: ToolDef[] = [
  {
    tool: 'brush',
    icon: Brush,
    label: 'Brush',
    shortcut: 'B',
    description: 'Paint individual tiles',
  },
  {
    tool: 'eraser',
    icon: Eraser,
    label: 'Eraser',
    shortcut: 'E',
    description: 'Clear tiles',
  },
  {
    tool: 'select',
    icon: BoxSelect,
    label: 'Select',
    shortcut: 'S',
    description: 'Drag a rectangle, then click a sprite to fill it',
  },
  {
    tool: 'fill',
    icon: PaintBucket,
    label: 'Fill',
    shortcut: 'F',
    description: 'Flood-fill connected tiles',
  },
  {
    tool: 'eyedropper',
    icon: Pipette,
    label: 'Pick',
    shortcut: 'I',
    description: "Pick a tile's sprite as the active brush",
  },
];

export function FloatingToolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  return (
    <div className="float-pill absolute left-1/2 top-3 z-20 -translate-x-1/2">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = activeTool === t.tool;
        return (
          <button
            key={t.tool}
            type="button"
            onClick={() => setActiveTool(t.tool)}
            title={t.description}
            className={`pill-btn ${active ? 'is-active' : ''}`}
          >
            <Icon size={13} />
            <span>{t.label}</span>
            <span className="kbd-hint">{t.shortcut}</span>
          </button>
        );
      })}
    </div>
  );
}
