export type BadgeTone = 'success' | 'warning' | 'danger' | 'pending' | 'neutral';

// Quiet tones are routine lifecycle stages — an admin shouldn't be drawn to
// them scanning a table. Warning/danger are the only tones that mean
// "notice this" (rejected, failed, cancelled, manual review), so they're the
// only ones that still get a colored pill; everything else renders as plain
// typography with a small dot for quick color-scanning.
const QUIET_TONES: readonly BadgeTone[] = ['success', 'pending', 'neutral'];

const DOT_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  pending: 'bg-pending',
  neutral: 'bg-slate-400',
};

const QUIET_TEXT_CLASSES: Record<BadgeTone, string> = {
  success: 'text-slate-700',
  pending: 'text-slate-700',
  neutral: 'text-slate-500',
  warning: '',
  danger: '',
};

const ATTENTION_PILL_CLASSES: Record<BadgeTone, string> = {
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  success: '',
  pending: '',
  neutral: '',
};

export function StatusLabel({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  if (QUIET_TONES.includes(tone)) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-medium capitalize ${QUIET_TEXT_CLASSES[tone]}`}>
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />
        {children}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold capitalize ${ATTENTION_PILL_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />
      {children}
    </span>
  );
}
