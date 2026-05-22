import { create } from 'zustand';
import {
  getProject,
  saveProject as saveProjectToDb,
} from '../storage/projects';
import {
  addSpriteBlob,
  getSpriteBlobs,
  removeSpriteBlob,
} from '../storage/sprites';
import { newId } from '../lib/ids';
import {
  bitmapToPngBlob,
  loadImageFromBlob,
  revokeImage,
} from '../lib/loadImage';
import { stripExtension } from '../lib/files';
import { renderThumbnailDataUrl } from '../lib/thumbnail';
import type { Project, ProjectId, SpriteId, SpriteMeta } from '../types';
import {
  type Camera,
  clampZoom,
  fitCamera,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../canvas/camera';

export type SaveState = 'idle' | 'pending' | 'saving' | 'error';
export type Tool = 'brush' | 'eraser' | 'select' | 'fill' | 'eyedropper';

export interface AddSpritesResult {
  added: number;
  queuedForCrop: number;
  failed: number;
}

export interface TileCoord {
  col: number;
  row: number;
}

export interface DragState {
  spriteId: SpriteId;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  active: boolean;
}

export interface MarqueeState {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

export interface TileChange {
  index: number;
  prev: SpriteId | null;
  next: SpriteId | null;
}

export interface TilesOp {
  kind: 'tiles';
  changes: TileChange[];
}

const UNDO_STACK_LIMIT = 100;

const DRAG_THRESHOLD_PX = 5;

export type HitTestFn = (clientX: number, clientY: number) => TileCoord | null;

interface EditorState {
  project: Project | null;
  loading: boolean;
  loadError: string | null;
  saveState: SaveState;
  camera: Camera;
  spriteImages: Map<SpriteId, HTMLImageElement>;

  activeSpriteId: SpriteId | null;
  activeTool: Tool;
  hoverTile: TileCoord | null;
  drag: DragState | null;
  hitTest: HitTestFn | null;
  marquee: MarqueeState | null;
  selection: MarqueeState | null;
  cropQueue: File[];

  undoStack: TilesOp[];
  redoStack: TilesOp[];
  currentStroke: TilesOp | null;

  exportModalOpen: boolean;

  loadProject: (id: ProjectId) => Promise<void>;
  unload: () => void;

  setProjectName: (name: string) => void;
  flushSave: () => Promise<void>;

  setCamera: (camera: Camera) => void;
  setZoom: (zoom: number) => void;
  panBy: (screenDx: number, screenDy: number) => void;
  zoomAt: (
    screenX: number,
    screenY: number,
    factor: number,
    canvasW: number,
    canvasH: number,
  ) => void;
  fitToContainer: (canvasW: number, canvasH: number) => void;

  addSprites: (files: File[]) => Promise<AddSpritesResult>;
  removeSprite: (spriteId: SpriteId) => Promise<void>;
  renameSprite: (spriteId: SpriteId, name: string) => void;
  countTilesUsing: (spriteId: SpriteId) => number;

  dequeueCropFile: () => void;
  addCroppedSprite: (name: string, blob: Blob) => Promise<void>;

  beginStroke: () => void;
  endStroke: () => void;
  undo: () => void;
  redo: () => void;

  openExportModal: () => void;
  closeExportModal: () => void;
  setSpriteExportChar: (spriteId: SpriteId, char: string) => void;
  setEmptyChar: (char: string) => void;

  setActiveSprite: (id: SpriteId | null) => void;
  setActiveTool: (tool: Tool) => void;
  setHoverTile: (tile: TileCoord | null) => void;

  placeTile: (col: number, row: number, spriteId: SpriteId | null) => void;
  paintRect: (
    c1: number,
    r1: number,
    c2: number,
    r2: number,
    spriteId: SpriteId | null,
  ) => void;

  setMarquee: (m: MarqueeState | null) => void;
  setSelection: (s: MarqueeState | null) => void;
  fillSelection: (spriteId: SpriteId | null) => void;
  floodFill: (col: number, row: number, spriteId: SpriteId | null) => void;

  startSpriteDrag: (
    spriteId: SpriteId,
    clientX: number,
    clientY: number,
  ) => void;
  updateDragPosition: (clientX: number, clientY: number) => void;
  cancelSpriteDrag: () => void;

  setHitTest: (fn: HitTestFn | null) => void;
}

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 400;

function clearTimer() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export const useEditorStore = create<EditorState>((set, get) => {
  function scheduleSave() {
    clearTimer();
    set({ saveState: 'pending' });
    saveTimer = setTimeout(async () => {
      const state = get();
      const project = state.project;
      if (!project) return;
      set({ saveState: 'saving' });
      try {
        const thumbnailDataUrl = renderThumbnailDataUrl(
          project,
          state.spriteImages,
        );
        await saveProjectToDb({ ...project, thumbnailDataUrl });
        set({ saveState: 'idle' });
      } catch (err) {
        console.error('autosave failed', err);
        set({ saveState: 'error' });
      } finally {
        saveTimer = null;
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function revokeAllImages() {
    for (const img of get().spriteImages.values()) revokeImage(img);
  }

  return {
    project: null,
    loading: false,
    loadError: null,
    saveState: 'idle',
    camera: DEFAULT_CAMERA,
    spriteImages: new Map(),

    activeSpriteId: null,
    activeTool: 'brush',
    hoverTile: null,
    drag: null,
    hitTest: null,
    marquee: null,
    selection: null,
    cropQueue: [],

    undoStack: [],
    redoStack: [],
    currentStroke: null,

    exportModalOpen: false,

    loadProject: async (id) => {
      clearTimer();
      revokeAllImages();
      set({
        loading: true,
        loadError: null,
        project: null,
        saveState: 'idle',
        camera: DEFAULT_CAMERA,
        spriteImages: new Map(),
        activeSpriteId: null,
        activeTool: 'brush',
        hoverTile: null,
        drag: null,
        marquee: null,
        selection: null,
        cropQueue: [],
        undoStack: [],
        redoStack: [],
        currentStroke: null,
        exportModalOpen: false,
      });
      try {
        const project = await getProject(id);
        if (!project) {
          set({ loading: false, loadError: 'Project not found' });
          return;
        }
        const blobMap = await getSpriteBlobs(id);
        const images = new Map<SpriteId, HTMLImageElement>();
        await Promise.all(
          Array.from(blobMap.entries()).map(async ([sid, blob]) => {
            try {
              const img = await loadImageFromBlob(blob);
              images.set(sid, img);
            } catch (err) {
              console.error('failed to load sprite image', sid, err);
            }
          }),
        );
        const { gridCols, gridRows, tileWidth, tileHeight } = project.settings;
        set({
          project,
          loading: false,
          spriteImages: images,
          camera: {
            x: (gridCols * tileWidth) / 2,
            y: (gridRows * tileHeight) / 2,
            zoom: 1,
          },
        });
      } catch (err) {
        set({ loading: false, loadError: (err as Error).message });
      }
    },

    unload: () => {
      clearTimer();
      revokeAllImages();
      set({
        project: null,
        loading: false,
        loadError: null,
        saveState: 'idle',
        camera: DEFAULT_CAMERA,
        spriteImages: new Map(),
        activeSpriteId: null,
        activeTool: 'brush',
        hoverTile: null,
        drag: null,
        marquee: null,
        hitTest: null,
        cropQueue: [],
        undoStack: [],
        redoStack: [],
        currentStroke: null,
        exportModalOpen: false,
      });
    },

    setProjectName: (name) => {
      const project = get().project;
      if (!project) return;
      set({ project: { ...project, name } });
      scheduleSave();
    },

    flushSave: async () => {
      if (!saveTimer) return;
      clearTimer();
      const state = get();
      const project = state.project;
      if (!project) return;
      set({ saveState: 'saving' });
      try {
        const thumbnailDataUrl = renderThumbnailDataUrl(
          project,
          state.spriteImages,
        );
        await saveProjectToDb({ ...project, thumbnailDataUrl });
        set({ saveState: 'idle' });
      } catch (err) {
        console.error('save failed', err);
        set({ saveState: 'error' });
      }
    },

    setCamera: (camera) => set({ camera }),

    setZoom: (zoom) => {
      const c = get().camera;
      const next = clampZoom(zoom);
      if (next === c.zoom) return;
      set({ camera: { ...c, zoom: next } });
    },

    panBy: (screenDx, screenDy) => {
      const c = get().camera;
      set({
        camera: {
          ...c,
          x: c.x - screenDx / c.zoom,
          y: c.y - screenDy / c.zoom,
        },
      });
    },

    zoomAt: (screenX, screenY, factor, canvasW, canvasH) => {
      const old = get().camera;
      const newZoom = clampZoom(old.zoom * factor);
      if (newZoom === old.zoom) return;
      const worldX = old.x + (screenX - canvasW / 2) / old.zoom;
      const worldY = old.y + (screenY - canvasH / 2) / old.zoom;
      const newX = worldX - (screenX - canvasW / 2) / newZoom;
      const newY = worldY - (screenY - canvasH / 2) / newZoom;
      set({ camera: { x: newX, y: newY, zoom: newZoom } });
    },

    fitToContainer: (canvasW, canvasH) => {
      const project = get().project;
      if (!project) return;
      const { gridCols, gridRows, tileWidth, tileHeight } = project.settings;
      set({
        camera: fitCamera(
          gridCols,
          gridRows,
          tileWidth,
          tileHeight,
          canvasW,
          canvasH,
        ),
      });
    },

    addSprites: async (files) => {
      const project = get().project;
      if (!project) return { added: 0, queuedForCrop: 0, failed: 0 };
      const { tileWidth, tileHeight } = project.settings;

      const needsCrop: File[] = [];
      const newSprites: SpriteMeta[] = [];
      const newImages = new Map(get().spriteImages);
      let failed = 0;

      const targetAspect = tileWidth / tileHeight;
      const ASPECT_TOLERANCE = 0.005;

      for (const file of files) {
        try {
          const bitmap = await createImageBitmap(file);
          const srcAspect = bitmap.width / bitmap.height;
          const sameSize =
            bitmap.width === tileWidth && bitmap.height === tileHeight;
          const sameAspect =
            Math.abs(srcAspect - targetAspect) < ASPECT_TOLERANCE;
          if (sameSize || sameAspect) {
            const spriteId = newId();
            const blob = await bitmapToPngBlob(bitmap, tileWidth, tileHeight);
            await addSpriteBlob(project.id, spriteId, blob);
            const img = await loadImageFromBlob(blob);
            const meta: SpriteMeta = {
              id: spriteId,
              name: stripExtension(file.name),
              width: tileWidth,
              height: tileHeight,
              createdAt: Date.now(),
            };
            newSprites.push(meta);
            newImages.set(spriteId, img);
          } else {
            needsCrop.push(file);
          }
          bitmap.close();
        } catch (err) {
          console.error('sprite upload failed', file.name, err);
          failed += 1;
        }
      }

      if (newSprites.length > 0) {
        const current = get().project;
        if (!current) return { added: 0, queuedForCrop: 0, failed };
        set({
          project: {
            ...current,
            sprites: [...current.sprites, ...newSprites],
          },
          spriteImages: newImages,
        });
        scheduleSave();
      }

      if (needsCrop.length > 0) {
        set({ cropQueue: [...get().cropQueue, ...needsCrop] });
      }

      return {
        added: newSprites.length,
        queuedForCrop: needsCrop.length,
        failed,
      };
    },

    removeSprite: async (spriteId) => {
      const project = get().project;
      if (!project) return;
      await removeSpriteBlob(project.id, spriteId);

      const newTiles = project.tiles.map((t) => (t === spriteId ? null : t));
      const newSprites = project.sprites.filter((s) => s.id !== spriteId);

      const img = get().spriteImages.get(spriteId);
      if (img) revokeImage(img);
      const newImages = new Map(get().spriteImages);
      newImages.delete(spriteId);

      const activeSpriteId =
        get().activeSpriteId === spriteId ? null : get().activeSpriteId;

      set({
        project: { ...project, sprites: newSprites, tiles: newTiles },
        spriteImages: newImages,
        activeSpriteId,
      });
      scheduleSave();
    },

    renameSprite: (spriteId, name) => {
      const project = get().project;
      if (!project) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const sprites = project.sprites.map((s) =>
        s.id === spriteId ? { ...s, name: trimmed } : s,
      );
      set({ project: { ...project, sprites } });
      scheduleSave();
    },

    countTilesUsing: (spriteId) => {
      const project = get().project;
      if (!project) return 0;
      let n = 0;
      for (const t of project.tiles) if (t === spriteId) n += 1;
      return n;
    },

    dequeueCropFile: () => {
      const q = get().cropQueue;
      if (q.length === 0) return;
      set({ cropQueue: q.slice(1) });
    },

    addCroppedSprite: async (name, blob) => {
      const project = get().project;
      if (!project) return;
      const { tileWidth, tileHeight } = project.settings;
      const spriteId = newId();
      await addSpriteBlob(project.id, spriteId, blob);
      const img = await loadImageFromBlob(blob);
      const meta: SpriteMeta = {
        id: spriteId,
        name: name.trim() || 'sprite',
        width: tileWidth,
        height: tileHeight,
        createdAt: Date.now(),
      };
      const current = get().project;
      if (!current) return;
      const newImages = new Map(get().spriteImages);
      newImages.set(spriteId, img);
      set({
        project: { ...current, sprites: [...current.sprites, meta] },
        spriteImages: newImages,
      });
      scheduleSave();
    },

    setActiveSprite: (id) => {
      const current = get().activeTool;
      // Auto-switch out of eraser (which doesn't use a sprite) but preserve
      // brush, select, fill, eyedropper so clicking a sprite during e.g.
      // a fill-selection workflow doesn't switch tools.
      const nextTool = id && current === 'eraser' ? 'brush' : current;
      set({ activeSpriteId: id, activeTool: nextTool });
    },

    setActiveTool: (tool) => set({ activeTool: tool }),

    setHoverTile: (tile) => {
      const prev = get().hoverTile;
      if (
        (prev === null && tile === null) ||
        (prev !== null &&
          tile !== null &&
          prev.col === tile.col &&
          prev.row === tile.row)
      ) {
        return;
      }
      set({ hoverTile: tile });
    },

    placeTile: (col, row, spriteId) => {
      const project = get().project;
      if (!project) return;
      const { gridCols, gridRows } = project.settings;
      if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;
      const idx = row * gridCols + col;
      const current = project.tiles[idx];
      if (current === spriteId) return;
      const newTiles = project.tiles.slice();
      newTiles[idx] = spriteId;

      const change: TileChange = { index: idx, prev: current, next: spriteId };
      const stroke = get().currentStroke;
      if (stroke) {
        set({
          project: { ...project, tiles: newTiles },
          currentStroke: { ...stroke, changes: [...stroke.changes, change] },
          redoStack: [],
        });
      } else {
        const op: TilesOp = { kind: 'tiles', changes: [change] };
        const undoStack = [...get().undoStack, op].slice(-UNDO_STACK_LIMIT);
        set({
          project: { ...project, tiles: newTiles },
          undoStack,
          redoStack: [],
        });
      }
      scheduleSave();
    },

    paintRect: (c1, r1, c2, r2, spriteId) => {
      const project = get().project;
      if (!project) return;
      const { gridCols, gridRows } = project.settings;
      const minC = Math.max(0, Math.min(c1, c2));
      const maxC = Math.min(gridCols - 1, Math.max(c1, c2));
      const minR = Math.max(0, Math.min(r1, r2));
      const maxR = Math.min(gridRows - 1, Math.max(r1, r2));
      if (minC > maxC || minR > maxR) return;
      const newTiles = project.tiles.slice();
      const changes: TileChange[] = [];
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const idx = r * gridCols + c;
          const prev = newTiles[idx];
          if (prev !== spriteId) {
            changes.push({ index: idx, prev, next: spriteId });
            newTiles[idx] = spriteId;
          }
        }
      }
      if (changes.length > 0) {
        const op: TilesOp = { kind: 'tiles', changes };
        const undoStack = [...get().undoStack, op].slice(-UNDO_STACK_LIMIT);
        set({
          project: { ...project, tiles: newTiles },
          undoStack,
          redoStack: [],
        });
        scheduleSave();
      }
    },

    setMarquee: (m) => set({ marquee: m }),

    setSelection: (s) => set({ selection: s }),

    fillSelection: (spriteId) => {
      const s = get().selection;
      if (!s) return;
      get().paintRect(s.startCol, s.startRow, s.endCol, s.endRow, spriteId);
    },

    floodFill: (col, row, replacementSpriteId) => {
      const project = get().project;
      if (!project) return;
      const { gridCols, gridRows } = project.settings;
      if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;
      const startIdx = row * gridCols + col;
      const targetSpriteId = project.tiles[startIdx];
      if (targetSpriteId === replacementSpriteId) return;

      const visited = new Uint8Array(gridCols * gridRows);
      const stack: number[] = [startIdx];
      const newTiles = project.tiles.slice();
      const changes: TileChange[] = [];

      while (stack.length > 0) {
        const i = stack.pop()!;
        if (visited[i]) continue;
        visited[i] = 1;
        if (newTiles[i] !== targetSpriteId) continue;
        changes.push({
          index: i,
          prev: newTiles[i],
          next: replacementSpriteId,
        });
        newTiles[i] = replacementSpriteId;
        const c = i % gridCols;
        const r = (i - c) / gridCols;
        if (c > 0) stack.push(i - 1);
        if (c < gridCols - 1) stack.push(i + 1);
        if (r > 0) stack.push(i - gridCols);
        if (r < gridRows - 1) stack.push(i + gridCols);
      }

      if (changes.length > 0) {
        const op: TilesOp = { kind: 'tiles', changes };
        set({
          project: { ...project, tiles: newTiles },
          undoStack: [...get().undoStack, op].slice(-UNDO_STACK_LIMIT),
          redoStack: [],
        });
        scheduleSave();
      }
    },

    beginStroke: () => {
      if (get().currentStroke) return;
      set({ currentStroke: { kind: 'tiles', changes: [] } });
    },

    endStroke: () => {
      const stroke = get().currentStroke;
      if (!stroke) return;
      if (stroke.changes.length === 0) {
        set({ currentStroke: null });
        return;
      }
      const undoStack = [...get().undoStack, stroke].slice(-UNDO_STACK_LIMIT);
      set({ currentStroke: null, undoStack, redoStack: [] });
    },

    undo: () => {
      const project = get().project;
      if (!project) return;
      const stack = get().undoStack;
      if (stack.length === 0) return;
      const op = stack[stack.length - 1];
      const newTiles = project.tiles.slice();
      for (const c of op.changes) newTiles[c.index] = c.prev;
      set({
        project: { ...project, tiles: newTiles },
        undoStack: stack.slice(0, -1),
        redoStack: [...get().redoStack, op],
      });
      scheduleSave();
    },

    redo: () => {
      const project = get().project;
      if (!project) return;
      const stack = get().redoStack;
      if (stack.length === 0) return;
      const op = stack[stack.length - 1];
      const newTiles = project.tiles.slice();
      for (const c of op.changes) newTiles[c.index] = c.next;
      const undoStack = [...get().undoStack, op].slice(-UNDO_STACK_LIMIT);
      set({
        project: { ...project, tiles: newTiles },
        redoStack: stack.slice(0, -1),
        undoStack,
      });
      scheduleSave();
    },

    openExportModal: () => set({ exportModalOpen: true }),
    closeExportModal: () => set({ exportModalOpen: false }),

    setSpriteExportChar: (spriteId, char) => {
      const project = get().project;
      if (!project) return;
      const sprites = project.sprites.map((s) =>
        s.id === spriteId ? { ...s, exportChar: char } : s,
      );
      set({ project: { ...project, sprites } });
      scheduleSave();
    },

    setEmptyChar: (char) => {
      const project = get().project;
      if (!project) return;
      if (project.emptyChar === char) return;
      set({ project: { ...project, emptyChar: char } });
      scheduleSave();
    },

    startSpriteDrag: (spriteId, clientX, clientY) => {
      const current = get().activeTool;
      const nextTool = current === 'eraser' ? 'brush' : current;
      set({
        drag: {
          spriteId,
          startX: clientX,
          startY: clientY,
          clientX,
          clientY,
          active: false,
        },
        activeSpriteId: spriteId,
        activeTool: nextTool,
      });
    },

    updateDragPosition: (clientX, clientY) => {
      const drag = get().drag;
      if (!drag) return;
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      const active =
        drag.active || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
      set({ drag: { ...drag, clientX, clientY, active } });
    },

    cancelSpriteDrag: () => {
      if (get().drag) set({ drag: null });
    },

    setHitTest: (fn) => set({ hitTest: fn }),
  };
});

export const ZOOM_LIMITS = { min: MIN_ZOOM, max: MAX_ZOOM };
