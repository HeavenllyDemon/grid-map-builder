import { useState } from 'react';
import { Modal } from '../common/Modal';
import type { ProjectSettings } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; settings: ProjectSettings }) => void;
}

interface FieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}

function NumberField({ label, value, min, max, onChange }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input-field"
      />
    </label>
  );
}

export function NewProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('Untitled Map');
  const [cols, setCols] = useState(32);
  const [rows, setRows] = useState(32);
  const [tileW, setTileW] = useState(64);
  const [tileH, setTileH] = useState(64);

  const valid =
    name.trim().length > 0 &&
    Number.isFinite(cols) &&
    cols > 0 &&
    cols <= 500 &&
    Number.isFinite(rows) &&
    rows > 0 &&
    rows <= 500 &&
    Number.isFinite(tileW) &&
    tileW >= 4 &&
    tileW <= 256 &&
    Number.isFinite(tileH) &&
    tileH >= 4 &&
    tileH <= 256;

  const large = cols * rows > 200 * 200;

  function reset() {
    setName('Untitled Map');
    setCols(32);
    setRows(32);
    setTileW(64);
    setTileH(64);
  }

  function submit() {
    if (!valid) return;
    onCreate({
      name: name.trim(),
      settings: {
        gridCols: Math.floor(cols),
        gridRows: Math.floor(rows),
        tileWidth: Math.floor(tileW),
        tileHeight: Math.floor(tileH),
      },
    });
    reset();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Project"
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="input-field"
          />
        </label>

        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-400">
            Grid
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Cols"
              value={cols}
              min={1}
              max={500}
              onChange={setCols}
            />
            <NumberField
              label="Rows"
              value={rows}
              min={1}
              max={500}
              onChange={setRows}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-400">
            Tile size
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Width"
              value={tileW}
              min={4}
              max={256}
              onChange={setTileW}
            />
            <NumberField
              label="Height"
              value={tileH}
              min={4}
              max={256}
              onChange={setTileH}
            />
          </div>
        </div>

        {large && (
          <div className="rounded-md border border-amber-800/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
            {cols}×{rows} = {(cols * rows).toLocaleString()} tiles. Performance
            may degrade on very large grids.
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="btn-primary"
        >
          Create
        </button>
      </div>
    </Modal>
  );
}
