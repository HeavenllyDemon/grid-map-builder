import { useEditorStore } from '../../state/editorStore';

export function DragGhost() {
  const drag = useEditorStore((s) => s.drag);
  const project = useEditorStore((s) => s.project);
  const spriteImages = useEditorStore((s) => s.spriteImages);

  if (!drag || !drag.active || !project) return null;
  const img = spriteImages.get(drag.spriteId);
  if (!img) return null;

  const { tileWidth, tileHeight } = project.settings;
  const previewSize = 48;
  const scale = previewSize / Math.max(tileWidth, tileHeight);
  const w = tileWidth * scale;
  const h = tileHeight * scale;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: drag.clientX,
        top: drag.clientY,
        transform: `translate(-${w / 2}px, -${h / 2}px)`,
      }}
    >
      <img
        src={img.src}
        alt=""
        draggable={false}
        style={{
          width: w,
          height: h,
          imageRendering: 'pixelated',
          opacity: 0.85,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
        }}
      />
    </div>
  );
}
