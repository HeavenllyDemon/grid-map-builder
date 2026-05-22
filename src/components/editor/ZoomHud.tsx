import { useState } from 'react';
import { useEditorStore, ZOOM_LIMITS } from '../../state/editorStore';

interface Props {
  zoom: number;
  onFit: () => void;
}

const logMin = Math.log(ZOOM_LIMITS.min);
const logMax = Math.log(ZOOM_LIMITS.max);

function sliderToZoom(v: number): number {
  return Math.exp(logMin + (v / 100) * (logMax - logMin));
}

function zoomToSlider(z: number): number {
  return ((Math.log(z) - logMin) / (logMax - logMin)) * 100;
}

export function ZoomHud({ zoom, onFit }: Props) {
  const setZoom = useEditorStore((s) => s.setZoom);
  const [hovered, setHovered] = useState(false);

  const sliderValue = zoomToSlider(zoom);

  return (
    <div
      className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="float-pill overflow-hidden transition-all duration-200 ease-out"
        style={{ width: hovered ? 220 : 64, padding: '0 0.25rem' }}
      >
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="pill-btn shrink-0 font-mono"
          title="Reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <div
          className={`flex flex-1 items-center pr-2 transition-opacity duration-150 ${
            hovered ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={sliderValue}
            onChange={(e) => setZoom(sliderToZoom(Number(e.target.value)))}
            className="zoom-slider w-full"
            aria-label="Zoom"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onFit}
        title="Fit to screen (0)"
        className="float-pill px-3"
      >
        <span className="pill-btn">Fit</span>
      </button>
    </div>
  );
}
