import { useContext } from 'react';
import { appendInspectionComment } from '@sitescop/room-engine-core';
import { cn } from '@/lib/cn';
import { CommentDictationButton } from '@/modules/inspections/components/CommentDictationButton';
import { CommentWritingAssist } from '@/modules/inspections/components/CommentWritingAssist';
import {
  isInspectionCommentLabel,
  isInspectionWritingLabel,
} from '@/modules/inspections/components/inspection-writing-field';
import {
  InspectionFormContext,
  INSPECTION_COMMENTS_TEXTAREA_CLASS,
  INSPECTION_INPUT_CLASS,
  INSPECTION_LABEL_CLASS,
} from '@/modules/inspections/components/InspectionFormUi';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Wide rectangular layout for inspection comment fields. */
  commentsField?: boolean;
  /** Enable spell check and grammar assist (defaults on for inspection narrative fields). */
  writingAssist?: boolean;
  /** Section id for speech-to-text report phrasing (e.g. fencing, external). */
  dictationSectionId?: string;
  /** Direct callback when dictation text is ready (preferred for comment fields). */
  onDictationAppend?: (text: string) => void;
  /** Called when writing assist applies a new comment value. */
  onWritingApply?: (text: string) => void;
}

export function Textarea({
  label,
  error,
  className,
  id,
  commentsField,
  writingAssist,
  dictationSectionId,
  onDictationAppend,
  onWritingApply,
  spellCheck,
  onChange,
  value,
  readOnly,
  disabled,
  ...props
}: TextareaProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  const isCommentsField =
    commentsField ?? (inInspectionForm && isInspectionCommentLabel(label));
  const enableWritingTools =
    writingAssist ??
    (inInspectionForm && !readOnly && !disabled && (isCommentsField || isInspectionWritingLabel(label)));
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const enableSpellCheck = spellCheck ?? (enableWritingTools && !readOnly);
  const enableDictation = isCommentsField && !readOnly && !disabled;

  const handleDictation = (transcript: string) => {
    if (onDictationAppend) {
      onDictationAppend(transcript);
      return;
    }
    const current = String(value ?? '');
    const next = appendInspectionComment(current, transcript);
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as React.ChangeEvent<HTMLTextAreaElement>);
  };

  const enableWritingAssist = enableWritingTools && (onWritingApply || onChange);

  const handleWritingApply = (next: string) => {
    if (onWritingApply) {
      onWritingApply(next);
      return;
    }
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as React.ChangeEvent<HTMLTextAreaElement>);
  };

  return (
    <div className={isCommentsField ? 'w-full' : undefined}>
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
      {enableDictation ? (
        <div className="mb-2 w-full">
          <CommentDictationButton disabled={disabled} sectionId={dictationSectionId} onTranscript={handleDictation} />
        </div>
      ) : null}
      <textarea
        id={inputId}
        lang="en-AU"
        className={cn(
          inInspectionForm
            ? isCommentsField
              ? INSPECTION_COMMENTS_TEXTAREA_CLASS
              : INSPECTION_INPUT_CLASS
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
      {enableWritingAssist ? (
        <CommentWritingAssist text={String(value ?? '')} disabled={disabled} onApplyText={handleWritingApply} />
      ) : null}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
