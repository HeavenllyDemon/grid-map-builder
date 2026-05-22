import {
  Brush,
  Eraser,
  BoxSelect,
  PaintBucket,
  Pipette,
  Circle,
  Diamond,
  Dices,
  Slash,
  Square,
} from 'lucide-react';
import { useEditorStore, type Tool } from '../../state/editorStore';
import { BRUSH_SIZE_LIMITS, type BrushShape } from '../../lib/brush';

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
    tool: 'line',
    icon: Slash,
    label: 'Line',
    shortcut: 'L',
    description: 'Drag to paint a straight line',
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

interface BrushStyleDef {
  shape: BrushShape;
  icon: typeof Square;
  label: string;
  description: string;
}

const BRUSH_STYLES: BrushStyleDef[] = [
  {
    shape: 'square',
    icon: Square,
    label: 'Square',
    description: 'Square brush footprint',
  },
  {
    shape: 'circle',
    icon: Circle,
    label: 'Circle',
    description: 'Rounded brush footprint',
  },
  {
    shape: 'diamond',
    icon: Diamond,
    label: 'Diamond',
    description: 'Diamond brush footprint',
  },
  {
    shape: 'scatter',
    icon: Dices,
    label: 'Scatter',
    description: 'Noisy center-heavy brush footprint',
  },
];

export function FloatingToolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushShape = useEditorStore((s) => s.brushShape);
  const setBrushSize = useEditorStore((s) => s.setBrushSize);
  const setBrushShape = useEditorStore((s) => s.setBrushShape);
  const showBrushOptions =
    activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'line';

  return (
    <div className="absolute left-1/2 top-3 z-20 grid w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 gap-2">
      <div className="float-pill w-full justify-center overflow-x-auto">
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

      {showBrushOptions && (
        <div className="float-pill w-full justify-center overflow-x-auto">
          {BRUSH_STYLES.map((style) => {
            const Icon = style.icon;
            const active = brushShape === style.shape;
            return (
              <button
                key={style.shape}
                type="button"
                onClick={() => setBrushShape(style.shape)}
                title={style.description}
                className={`pill-btn ${active ? 'is-active' : ''}`}
              >
                <Icon size={13} />
                <span>{style.label}</span>
              </button>
            );
          })}

          <div className="mx-1 h-5 w-px bg-white/10" />

          <div className="flex h-full items-center gap-2 px-2">
            <span className="text-xs font-medium text-zinc-300">Size</span>
            <input
              type="range"
              min={BRUSH_SIZE_LIMITS.min}
              max={BRUSH_SIZE_LIMITS.max}
              step={BRUSH_SIZE_LIMITS.step}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="zoom-slider w-28"
              aria-label="Brush size"
            />
            <span className="kbd-hint min-w-[1.25rem]">{brushSize}</span>
          </div>
        </div>
      )}
    </div>
  );
}
