import { useContext, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  /** Show an eye button to reveal/hide password text. */
  revealable?: boolean;
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
  revealable,
  type,
  ...props
}: InputProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  const [revealed, setRevealed] = useState(false);
  const enableWritingTools =
    writingAssist ??
    (inInspectionForm && !readOnly && !disabled && isInspectionWritingLabel(label));
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const enableSpellCheck = spellCheck ?? (enableWritingTools && !readOnly);
  const isPasswordField = type === 'password' || revealable;
  const inputType = revealable && isPasswordField ? (revealed ? 'text' : 'password') : type;

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
      <div className={revealable ? 'relative' : undefined}>
        <input
          id={inputId}
          lang="en-AU"
          type={inputType}
          className={cn(
            inInspectionForm
              ? INSPECTION_INPUT_CLASS
              : 'w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-text transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
            revealable && 'pr-10',
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
        {revealable ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {enableWritingTools && onChange ? (
        <CommentWritingAssist text={String(value ?? '')} disabled={disabled} onApplyText={handleWritingApply} />
      ) : null}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
