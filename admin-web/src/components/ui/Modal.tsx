interface ModalProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
  width?: 'sm' | 'md';
}

// The one modal shell for the app — confirm dialogs (via ConfirmModal below)
// and every form modal (Pricing, Promotions) build on this instead of each
// hand-rolling their own overlay/card/shadow.
export function Modal({ title, description, children, footer, onClose, width = 'sm' }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${width === 'sm' ? 'max-w-sm' : 'max-w-md'} rounded-md bg-white p-6 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
        {children && <div className="mt-4 space-y-3">{children}</div>}
        <div className="mt-5 flex gap-2.5">{footer}</div>
      </div>
    </div>
  );
}
