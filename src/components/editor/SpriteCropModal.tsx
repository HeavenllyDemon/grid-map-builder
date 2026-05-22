import { useEffect, useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { useEditorStore } from '../../state/editorStore';
import { stripExtension } from '../../lib/files';
import {
  type CropMode,
  type CropRect,
  computeCoverRect,
  renderCropToCanvas,
  renderCroppedToBlob,
} from '../../lib/crop';

const PREVIEW_MAX_W = 480;
const PREVIEW_MAX_H = 360;
const OUTPUT_PREVIEW_SIZE = 96;

export function SpriteCropModal() {
  const project = useEditorStore((s) => s.project);
  const cropQueue = useEditorStore((s) => s.cropQueue);
  const dequeueCropFile = useEditorStore((s) => s.dequeueCropFile);
  const addCroppedSprite = useEditorStore((s) => s.addCroppedSprite);

  const currentFile = cropQueue[0] ?? null;
  const totalRemaining = cropQueue.length;
  const queueIndex =
    currentFile && totalRemaining > 0 ? 1 : 0;

  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<CropMode>('cover');
  const [coverRect, setCoverRect] = useState<CropRect | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startRectX: number;
    startRectY: number;
  } | null>(null);

  // Load file when it changes
  useEffect(() => {
    if (!currentFile || !project) {
      setBitmap(null);
      setImgUrl(null);
      setPreviewUrl(null);
      return;
    }
    let canceled = false;
    let createdBitmap: ImageBitmap | null = null;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const bmp = await createImageBitmap(currentFile);
        if (canceled) {
          bmp.close();
          return;
        }
        createdBitmap = bmp;
        const url = URL.createObjectURL(currentFile);
        createdUrl = url;
        const cover = computeCoverRect(
          bmp.width,
          bmp.height,
          project.settings.tileWidth,
          project.settings.tileHeight,
        );
        setBitmap(bmp);
        setImgUrl(url);
        setName(stripExtension(currentFile.name));
        setMode('cover');
        setCoverRect(cover);
      } catch (err) {
        console.error('failed to read image', err);
        dequeueCropFile();
      }
    })();

    return () => {
      canceled = true;
      if (createdBitmap) createdBitmap.close();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [currentFile, project, dequeueCropFile]);

  // Generate output preview
  useEffect(() => {
    if (!bitmap || !project) {
      setPreviewUrl(null);
      return;
    }
    const canvas = renderCropToCanvas(
      bitmap,
      { width: bitmap.width, height: bitmap.height },
      mode,
      project.settings.tileWidth,
      project.settings.tileHeight,
      mode === 'cover' && coverRect ? coverRect : undefined,
    );
    const url = canvas.toDataURL('image/png');
    setPreviewUrl(url);
  }, [bitmap, mode, coverRect, project]);

  if (!currentFile || !project) return null;

  const tileW = project.settings.tileWidth;
  const tileH = project.settings.tileHeight;

  const previewScale =
    bitmap !== null
      ? Math.min(
          PREVIEW_MAX_W / bitmap.width,
          PREVIEW_MAX_H / bitmap.height,
          2,
        )
      : 1;
  const displayW = bitmap ? Math.round(bitmap.width * previewScale) : 0;
  const displayH = bitmap ? Math.round(bitmap.height * previewScale) : 0;

  function onRectPointerDown(e: React.PointerEvent) {
    if (mode !== 'cover' || !coverRect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRectX: coverRect.x,
      startRectY: coverRect.y,
    };
  }

  function onRectPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || !bitmap || !coverRect) return;
    const dx = (e.clientX - d.startClientX) / previewScale;
    const dy = (e.clientY - d.startClientY) / previewScale;
    const nx = Math.max(
      0,
      Math.min(bitmap.width - coverRect.w, d.startRectX + dx),
    );
    const ny = Math.max(
      0,
      Math.min(bitmap.height - coverRect.h, d.startRectY + dy),
    );
    setCoverRect({ ...coverRect, x: nx, y: ny });
  }

  function onRectPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = null;
  }

  async function handleConfirm() {
    if (!bitmap || submitting) return;
    setSubmitting(true);
    try {
      const blob = await renderCroppedToBlob(
        bitmap,
        mode,
        tileW,
        tileH,
        mode === 'cover' && coverRect ? coverRect : undefined,
      );
      await addCroppedSprite(name, blob);
      dequeueCropFile();
    } catch (err) {
      console.error('crop failed', err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    dequeueCropFile();
  }

  return (
    <Modal
      open
      onClose={handleSkip}
      title={`Crop sprite (${queueIndex} of ${totalRemaining})`}
      widthClass="w-full max-w-3xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 p-3">
            {bitmap && imgUrl ? (
              <div
                className="relative select-none"
                style={{ width: displayW, height: displayH }}
              >
                <img
                  src={imgUrl}
                  alt=""
                  width={displayW}
                  height={displayH}
                  draggable={false}
                  style={{
                    width: displayW,
                    height: displayH,
                    imageRendering: 'pixelated',
                    display: 'block',
                  }}
                />
                {coverRect && (
                  <svg
                    className="absolute inset-0"
                    width={displayW}
                    height={displayH}
                  >
                    <defs>
                      <mask id="crop-mask">
                        <rect width={displayW} height={displayH} fill="white" />
                        {mode === 'cover' && (
                          <rect
                            x={coverRect.x * previewScale}
                            y={coverRect.y * previewScale}
                            width={coverRect.w * previewScale}
                            height={coverRect.h * previewScale}
                            fill="black"
                          />
                        )}
                        {mode === 'fit' && (
                          <rect
                            x={
                              (displayW -
                                Math.min(
                                  displayW,
                                  (displayH * tileW) / tileH,
                                )) /
                              2
                            }
                            y={
                              (displayH -
                                Math.min(
                                  displayH,
                                  (displayW * tileH) / tileW,
                                )) /
                              2
                            }
                            width={Math.min(
                              displayW,
                              (displayH * tileW) / tileH,
                            )}
                            height={Math.min(
                              displayH,
                              (displayW * tileH) / tileW,
                            )}
                            fill="black"
                          />
                        )}
                        {mode === 'stretch' && (
                          <rect
                            x={0}
                            y={0}
                            width={displayW}
                            height={displayH}
                            fill="black"
                          />
                        )}
                      </mask>
                    </defs>
                    <rect
                      width={displayW}
                      height={displayH}
                      fill="black"
                      opacity={0.55}
                      mask="url(#crop-mask)"
                    />
                    {mode === 'cover' && (
                      <rect
                        x={coverRect.x * previewScale}
                        y={coverRect.y * previewScale}
                        width={coverRect.w * previewScale}
                        height={coverRect.h * previewScale}
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        style={{ cursor: 'move' }}
                        onPointerDown={onRectPointerDown}
                        onPointerMove={onRectPointerMove}
                        onPointerUp={onRectPointerUp}
                        onPointerCancel={onRectPointerUp}
                      />
                    )}
                  </svg>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500">Loading image…</div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 md:w-56">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </label>

            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-400">
                Mode
              </div>
              <div className="grid grid-cols-3 gap-1">
                <ModeButton
                  active={mode === 'fit'}
                  onClick={() => setMode('fit')}
                  label="Fit"
                />
                <ModeButton
                  active={mode === 'cover'}
                  onClick={() => setMode('cover')}
                  label="Cover"
                />
                <ModeButton
                  active={mode === 'stretch'}
                  onClick={() => setMode('stretch')}
                  label="Stretch"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">
                {mode === 'fit' &&
                  'Letterbox the image inside the tile (no crop).'}
                {mode === 'cover' &&
                  'Crop to fill the tile. Drag the blue frame to reposition.'}
                {mode === 'stretch' &&
                  'Stretch the image to the tile (distorts aspect).'}
              </p>
            </div>

            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-400">
                Output preview ({tileW}×{tileH})
              </div>
              <div
                className="overflow-hidden rounded border border-zinc-700 bg-zinc-950"
                style={{
                  width: OUTPUT_PREVIEW_SIZE,
                  height:
                    (OUTPUT_PREVIEW_SIZE * tileH) / tileW,
                }}
              >
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="output preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                      imageRendering: 'pixelated',
                    }}
                    draggable={false}
                  />
                )}
              </div>
            </div>

            <p className="text-[11px] text-zinc-600">
              Source: {bitmap?.width ?? 0}×{bitmap?.height ?? 0}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="btn-secondary"
          >
            Skip this file
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !bitmap}
            className="btn-primary"
          >
            {submitting ? 'Adding…' : 'Add sprite'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
        active
          ? 'border-orange-500/70 bg-orange-500/15 text-orange-100 shadow-md shadow-orange-500/20'
          : 'border-zinc-800/70 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60'
      }`}
    >
      {label}
    </button>
  );
}
