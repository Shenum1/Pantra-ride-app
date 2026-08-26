import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90 disabled:bg-primary/40',
  success: 'bg-success text-white hover:bg-success/90 disabled:bg-success/40',
  warning: 'bg-warning text-white hover:bg-warning/90 disabled:bg-warning/40',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40',
  ghost: 'text-slate-500 hover:bg-slate-100 disabled:opacity-40',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
