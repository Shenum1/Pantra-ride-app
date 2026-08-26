export type BadgeTone = 'success' | 'warning' | 'danger' | 'pending' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  pending: 'bg-pending-tint text-pending',
  neutral: 'bg-slate-100 text-slate-500',
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  pending: 'bg-pending',
  neutral: 'bg-slate-400',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {children}
    </span>
  );
}
