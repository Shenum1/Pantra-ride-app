export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="h-16 w-full animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
