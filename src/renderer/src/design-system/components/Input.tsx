import { useContext } from 'react';
import { cn } from '@/lib/cn';
import { CommentWritingAssist } from '@/modules/inspections/components/CommentWritingAssist';
import {
  isInspectionWritingLabel,
} from '@/modules/inspections/components/inspection-writing-field';
import {
  InspectionFormContext,
  INSPECTION_INPUT_CLASS,
  INSPECTION_LABEL_CLASS,
} from '@/modules/inspections/components/InspectionFormUi';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Enable spell check and grammar assist (defaults on for inspection narrative fields). */
  writingAssist?: boolean;
}

export function Input({
  label,
  error,
  className,
  id,
  writingAssist,
  spellCheck,
  value,
  onChange,
  readOnly,
  disabled,
  ...props
}: InputProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  const enableWritingTools =
    writingAssist ??
    (inInspectionForm && !readOnly && !disabled && isInspectionWritingLabel(label));
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const enableSpellCheck = spellCheck ?? (enableWritingTools && !readOnly);

  const handleWritingApply = (next: string) => {
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as React.ChangeEvent<HTMLInputElement>);
  };

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
        lang="en-AU"
        className={cn(
          inInspectionForm
            ? INSPECTION_INPUT_CLASS
            : 'w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
          error && 'border-danger',
          className,
        )}
        spellCheck={enableSpellCheck}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        onChange={onChange}
        {...props}
      />
      {enableWritingTools && onChange ? (
        <CommentWritingAssist text={String(value ?? '')} disabled={disabled} onApplyText={handleWritingApply} />
      ) : null}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
