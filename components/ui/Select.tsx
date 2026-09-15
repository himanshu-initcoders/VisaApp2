import { cn } from '@/lib/utils';

/**
 * Select Component
 *
 * Native select dropdown matching Portrait design system
 * Consistent with Input component styling (16px radius, deep navy ink border)
 */

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
}

export function Select({
  label,
  error,
  helperText,
  options,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={props.id || props.name}
          className="block font-switzer text-sm font-medium text-portrait-ink mb-2"
        >
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full font-switzer text-sm text-portrait-ink',
          'bg-white border border-ash rounded-[16px]',
          'px-4 py-3',
          'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-200',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      >
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-2 font-switzer text-xs text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-2 font-switzer text-xs text-slate-helper">{helperText}</p>
      )}
    </div>
  );
}
