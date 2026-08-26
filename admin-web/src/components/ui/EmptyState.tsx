export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    </div>
  );
}
