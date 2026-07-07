import { useContext } from 'react';
import { cn } from '@/lib/cn';
import {
  InspectionFormContext,
  INSPECTION_INPUT_CLASS,
  INSPECTION_LABEL_CLASS,
} from '@/modules/inspections/components/InspectionFormUi';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
  options: SelectOption[];
}

export function Select({ label, error, placeholder, options, className, id, value, ...props }: SelectProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={inInspectionForm ? 'w-full' : undefined}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            inInspectionForm
              ? INSPECTION_LABEL_CLASS
              : 'mb-1.5 block text-sm font-medium text-text',
          )}
        >
          {inInspectionForm ? (
            <>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{label}</span>
            </>
          ) : (
            label
          )}
        </label>
      )}
      <select
        id={inputId}
        value={value}
        className={cn(
          inInspectionForm
            ? INSPECTION_INPUT_CLASS
            : 'w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20',
          error && 'border-danger',
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
