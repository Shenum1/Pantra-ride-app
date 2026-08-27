interface FilterTabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// Underline tabs replace the black-pill filter row that used to be
// copy-pasted across every list page — same job, but the emphasis comes from
// weight/color/underline (typography) instead of a filled shape.
export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
  return (
    <div className="flex flex-wrap gap-5 border-b border-slate-200">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`relative -mb-px pb-2.5 text-sm font-medium capitalize transition-colors ${
            value === o.value ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {o.label}
          {value === o.value && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
        </button>
      ))}
    </div>
  );
}
