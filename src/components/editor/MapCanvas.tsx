import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../state/editorStore';
import { renderGrid } from '../../canvas/renderer';
import { screenToWorld, worldToTile } from '../../canvas/camera';
import type { Camera } from '../../canvas/camera';
import type { TileCoord } from '../../state/editorStore';
import type { ProjectSettings } from '../../types';
import { ZoomHud } from './ZoomHud';
import { CanvasControlsHelp } from './CanvasControlsHelp';

function tileFromClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  settings: ProjectSettings,
): TileCoord | null {
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return null;
  const world = screenToWorld(sx, sy, camera, canvasW, canvasH);
  const t = worldToTile(world.x, world.y, settings.tileWidth, settings.tileHeight);
  if (
    t.col < 0 ||
    t.col >= settings.gridCols ||
    t.row < 0 ||
    t.row >= settings.gridRows
  )
    return null;
  return t;
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const project = useEditorStore((s) => s.project);
  const camera = useEditorStore((s) => s.camera);
  const spriteImages = useEditorStore((s) => s.spriteImages);
  const activeSpriteId = useEditorStore((s) => s.activeSpriteId);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveSprite = useEditorStore((s) => s.setActiveSprite);
  const hoverTile = useEditorStore((s) => s.hoverTile);
  const setHoverTile = useEditorStore((s) => s.setHoverTile);
  const placeTile = useEditorStore((s) => s.placeTile);
  const paintRect = useEditorStore((s) => s.paintRect);
  const floodFill = useEditorStore((s) => s.floodFill);
  const beginStroke = useEditorStore((s) => s.beginStroke);
  const endStroke = useEditorStore((s) => s.endStroke);
  const marquee = useEditorStore((s) => s.marquee);
  const setMarquee = useEditorStore((s) => s.setMarquee);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const panBy = useEditorStore((s) => s.panBy);
  const zoomAt = useEditorStore((s) => s.zoomAt);
  const fitToContainer = useEditorStore((s) => s.fitToContainer);
  const setHitTest = useEditorStore((s) => s.setHitTest);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const panRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const paintRef = useRef<{
    pointerId: number;
    mode: 'paint' | 'erase';
    spriteId: string | null;
    lastIndex: number;
  } | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    startCol: number;
    startRow: number;
  } | null>(null);
  const selectionRef = useRef<{
    pointerId: number;
    startCol: number;
    startRow: number;
    moved: boolean;
  } | null>(null);
  const fittedForProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        setSize({ w, h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!project || size.w === 0 || size.h === 0) return;
    if (fittedForProjectRef.current === project.id) return;
    fittedForProjectRef.current = project.id;
    fitToContainer(size.w, size.h);
  }, [project, size.w, size.h, fitToContainer]);

  useEffect(() => {
    if (!project || size.w === 0) {
      setHitTest(null);
      return;
    }
    const fn = (cx: number, cy: number): TileCoord | null => {
      const el = containerRef.current;
      if (!el) return null;
      return tileFromClient(
        cx,
        cy,
        el.getBoundingClientRect(),
        camera,
        size.w,
        size.h,
        project.settings,
      );
    };
    setHitTest(fn);
    return () => setHitTest(null);
  }, [project, camera, size.w, size.h, setHitTest]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    if (size.w === 0 || size.h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = size.w * dpr;
    const targetH = size.h * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderGrid(ctx, project, camera, size.w, size.h, spriteImages, {
      hoverTile,
      activeTool,
      activeSpriteId,
      marquee,
      selection,
    });
  }, [
    project,
    camera,
    size.w,
    size.h,
    spriteImages,
    hoverTile,
    activeTool,
    activeSpriteId,
    marquee,
    selection,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!project || size.w === 0) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.ctrlKey) {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        zoomAt(sx, sy, factor, size.w, size.h);
        return;
      }

      const isTrackpad =
        e.deltaX !== 0 ||
        e.deltaY % 1 !== 0 ||
        (e.deltaMode === 0 && Math.abs(e.deltaY) < 40);

      if (isTrackpad) {
        panBy(-e.deltaX, -e.deltaY);
      } else {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAt(sx, sy, factor, size.w, size.h);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [project, size.w, size.h, zoomAt, panBy]);

  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable);

    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.code === 'Digit0') {
        if (project && size.w > 0) fitToContainer(size.w, size.h);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [project, size.w, size.h, fitToContainer]);

  function tileUnderEvent(e: React.PointerEvent): TileCoord | null {
    if (!project) return null;
    return tileFromClient(
      e.clientX,
      e.clientY,
      (e.currentTarget as HTMLElement).getBoundingClientRect(),
      camera,
      size.w,
      size.h,
      project.settings,
    );
  }

  function clampedTileFromEvent(e: React.PointerEvent): TileCoord | null {
    if (!project) return null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy, camera, size.w, size.h);
    const t = worldToTile(
      world.x,
      world.y,
      project.settings.tileWidth,
      project.settings.tileHeight,
    );
    return {
      col: Math.max(0, Math.min(project.settings.gridCols - 1, t.col)),
      row: Math.max(0, Math.min(project.settings.gridRows - 1, t.row)),
    };
  }

  function startPan(e: React.PointerEvent) {
    panRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setPanning(true);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!project) return;

    const wantsPan = e.button === 1 || (e.button === 0 && spaceHeld);
    if (wantsPan) {
      e.preventDefault();
      startPan(e);
      return;
    }

    // Right-button: always start a transient marquee for batch paint/erase
    if (e.button === 2) {
      const tile = tileUnderEvent(e);
      if (!tile) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      marqueeRef.current = {
        pointerId: e.pointerId,
        startCol: tile.col,
        startRow: tile.row,
      };
      setMarquee({
        startCol: tile.col,
        startRow: tile.row,
        endCol: tile.col,
        endRow: tile.row,
      });
      return;
    }

    if (e.button !== 0) return;
    const tile = tileUnderEvent(e);
    if (!tile) return;

    if (activeTool === 'select') {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      selectionRef.current = {
        pointerId: e.pointerId,
        startCol: tile.col,
        startRow: tile.row,
        moved: false,
      };
      setSelection({
        startCol: tile.col,
        startRow: tile.row,
        endCol: tile.col,
        endRow: tile.row,
      });
      return;
    }

    if (activeTool === 'eyedropper') {
      e.preventDefault();
      const idx = tile.row * project.settings.gridCols + tile.col;
      const sid = project.tiles[idx];
      if (sid) setActiveSprite(sid);
      return;
    }

    if (activeTool === 'fill') {
      e.preventDefault();
      const target =
        activeSpriteId !== null && activeSpriteId !== undefined
          ? activeSpriteId
          : null;
      floodFill(tile.col, tile.row, target);
      return;
    }

    // Brush / Eraser
    const mode: 'paint' | 'erase' | null =
      activeTool === 'eraser'
        ? 'erase'
        : activeSpriteId
          ? 'paint'
          : null;
    if (!mode) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const index = tile.row * project.settings.gridCols + tile.col;
    paintRef.current = {
      pointerId: e.pointerId,
      mode,
      spriteId: mode === 'paint' ? activeSpriteId : null,
      lastIndex: index,
    };
    beginStroke();
    placeTile(tile.col, tile.row, mode === 'paint' ? activeSpriteId : null);
  }

  function onPointerMove(e: React.PointerEvent) {
    const tile = tileUnderEvent(e);
    setHoverTile(tile);

    const p = panRef.current;
    if (p && p.pointerId === e.pointerId) {
      const dx = e.clientX - p.lastX;
      const dy = e.clientY - p.lastY;
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      panBy(dx, dy);
      return;
    }

    const sel = selectionRef.current;
    if (sel && sel.pointerId === e.pointerId && project) {
      const clamped = tile ?? clampedTileFromEvent(e);
      if (clamped) {
        if (clamped.col !== sel.startCol || clamped.row !== sel.startRow) {
          sel.moved = true;
        }
        setSelection({
          startCol: sel.startCol,
          startRow: sel.startRow,
          endCol: clamped.col,
          endRow: clamped.row,
        });
      }
      return;
    }

    const m = marqueeRef.current;
    if (m && m.pointerId === e.pointerId && project) {
      const clamped = tile ?? clampedTileFromEvent(e);
      if (clamped) {
        setMarquee({
          startCol: m.startCol,
          startRow: m.startRow,
          endCol: clamped.col,
          endRow: clamped.row,
        });
      }
      return;
    }

    const paint = paintRef.current;
    if (paint && paint.pointerId === e.pointerId && tile && project) {
      const idx = tile.row * project.settings.gridCols + tile.col;
      if (idx !== paint.lastIndex) {
        paint.lastIndex = idx;
        placeTile(tile.col, tile.row, paint.spriteId);
      }
    }
  }

  function endInteractions(e: React.PointerEvent) {
    const p = panRef.current;
    if (p && p.pointerId === e.pointerId) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      panRef.current = null;
      setPanning(false);
    }
    const paint = paintRef.current;
    if (paint && paint.pointerId === e.pointerId) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      paintRef.current = null;
      endStroke();
    }
    const sel = selectionRef.current;
    if (sel && sel.pointerId === e.pointerId) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      selectionRef.current = null;
      // Click without drag → clear selection
      if (!sel.moved) setSelection(null);
    }
    const m = marqueeRef.current;
    if (m && m.pointerId === e.pointerId) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      marqueeRef.current = null;
      const current = useEditorStore.getState().marquee;
      if (current) {
        if (activeTool === 'eraser') {
          paintRect(
            current.startCol,
            current.startRow,
            current.endCol,
            current.endRow,
            null,
          );
        } else if (activeSpriteId) {
          paintRect(
            current.startCol,
            current.startRow,
            current.endCol,
            current.endRow,
            activeSpriteId,
          );
        }
      }
      setMarquee(null);
    }
  }

  function onPointerLeave() {
    setHoverTile(null);
  }

  const toolCursor =
    activeTool === 'select'
      ? 'cursor-crosshair'
      : activeTool === 'fill'
        ? 'cursor-pointer'
        : activeTool === 'eyedropper'
          ? 'cursor-pointer'
          : activeTool === 'eraser' || (activeTool === 'brush' && activeSpriteId)
            ? 'cursor-crosshair'
            : 'cursor-default';

  const cursorClass = panning
    ? 'cursor-grabbing'
    : spaceHeld
      ? 'cursor-grab'
      : toolCursor;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full overflow-hidden ${cursorClass}`}
      style={{
        background:
          'radial-gradient(circle at 50% 50%, #1a1a1d 0%, #131316 100%)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endInteractions}
      onPointerCancel={endInteractions}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block" />
      <ZoomHud
        zoom={camera.zoom}
        onFit={() => {
          if (size.w > 0) fitToContainer(size.w, size.h);
        }}
      />
      <CanvasControlsHelp />
    </div>
  );
}
