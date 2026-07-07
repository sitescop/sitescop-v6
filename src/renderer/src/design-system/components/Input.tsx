import { useContext } from 'react';
import { cn } from '@/lib/cn';
import {
  InspectionFormContext,
  INSPECTION_INPUT_CLASS,
  INSPECTION_LABEL_CLASS,
} from '@/modules/inspections/components/InspectionFormUi';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
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
      <input
        id={inputId}
        className={cn(
          inInspectionForm
            ? INSPECTION_INPUT_CLASS
            : 'w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
