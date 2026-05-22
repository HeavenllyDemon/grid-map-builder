import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';

interface Props {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function RenameModal({ open, initialName, onClose, onSave }: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const valid = name.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Rename project">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-zinc-400">
          Name
        </span>
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onSave(name.trim());
          }}
          className="input-field"
        />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => valid && onSave(name.trim())}
          disabled={!valid}
          className="btn-primary"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
