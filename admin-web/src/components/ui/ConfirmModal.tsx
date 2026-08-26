import { useState } from 'react';
import { Button } from './Button';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
        {reasonLabel && (
          <div className="mt-4">
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
        <div className="mt-5 flex gap-2.5">
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
        </div>
      </div>
    </div>
  );
}
