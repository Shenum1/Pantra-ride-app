import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmModalProps {
  title: string;
  description?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'success' | 'warning' | 'danger';
  processing?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

export function ConfirmModal({
  title,
  description,
  reasonLabel,
  reasonPlaceholder,
  confirmLabel,
  confirmVariant = 'danger',
  processing,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const [reason, setReason] = useState('');

  return (
    <Modal
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            className="flex-1"
            disabled={processing}
            onClick={() => onConfirm(reason || undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reasonLabel && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">{reasonLabel}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}
    </Modal>
  );
}
