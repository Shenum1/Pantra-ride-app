export function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm text-slate-800 ${mono ? 'tnum' : ''}`}>{value ?? '—'}</p>
    </div>
  );
}
