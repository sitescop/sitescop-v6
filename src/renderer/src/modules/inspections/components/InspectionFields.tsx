import { memo, useCallback, useContext, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  appendInspectionComment,
  getCommentSuggestions,
  normalizeCheckboxField,
  type CheckboxFieldState,
  type InspectionPhotoRef,
} from '@sitescop/room-engine-core';
import { Button, Input, Modal, Textarea } from '@/design-system/components';
import { cn } from '@/lib/cn';
import { InspectionFormContext, INSPECTION_INPUT_CLASS } from './InspectionFormUi';
import { PhotoAnnotationEditor } from './PhotoAnnotationEditor';

export function InspectionSubsectionHeading({
  children,
  as: Tag = 'p',
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  return <Tag className={cn('inspection-subsection-heading', className)}>{children}</Tag>;
}

function normalizePhotos(photos: InspectionPhotoRef[] | undefined | null): InspectionPhotoRef[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter(
    (photo) => typeof photo?.dataUrl === 'string' && photo.dataUrl.trim().length > 20,
  );
}

interface CheckboxGroupFieldProps {
  label?: string;
  options: readonly string[];
  value: CheckboxFieldState;
  onChange: (value: CheckboxFieldState) => void;
  allowCustom?: boolean;
  disabled?: boolean;
}

export const CheckboxGroupField = memo(function CheckboxGroupField({
  label,
  options,
  value,
  onChange,
  allowCustom = true,
  disabled = false,
}: CheckboxGroupFieldProps) {
  const [customInput, setCustomInput] = useState('');
  const valueRef = useRef(value);
  valueRef.current = value;
  const presetOptions = [...new Set(options)];
  const field = normalizeCheckboxField(value);
  const visibleCustom = field.custom.filter((item) => !presetOptions.includes(item));

  const toggle = useCallback(
    (option: string) => {
      if (disabled) return;
      const current = normalizeCheckboxField(valueRef.current);
      const selected = current.selected.includes(option)
        ? current.selected.filter((item) => item !== option)
        : [...current.selected, option];
      onChange({ ...current, selected: [...new Set(selected)] });
    },
    [disabled, onChange],
  );

  const addCustom = () => {
    if (disabled) return;
    const trimmed = customInput.trim();
    const current = normalizeCheckboxField(valueRef.current);
    if (!trimmed || current.custom.includes(trimmed) || current.selected.includes(trimmed)) return;
    onChange({ ...current, custom: [...current.custom, trimmed] });
    setCustomInput('');
  };

  const removeCustom = (item: string) => {
    if (disabled) return;
    const current = normalizeCheckboxField(valueRef.current);
    onChange({ ...current, custom: current.custom.filter((entry) => entry !== item) });
  };

  return (
    <div className="space-y-2">
      {label && <InspectionSubsectionHeading>{label}</InspectionSubsectionHeading>}
      <div className="grid gap-2 sm:grid-cols-2">
        {presetOptions.map((option) => (
          <label
            key={option}
            className={`inspection-checkbox-option ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={field.selected.includes(option)}
              disabled={disabled}
              onChange={() => toggle(option)}
            />
            <span>{option}</span>
          </label>
        ))}
        {visibleCustom.map((item) => (
          <label key={item} className="inspection-checkbox-option">
            <input type="checkbox" checked readOnly disabled={disabled} className="mt-1" />
            <span className="flex-1">{item}</span>
            {!disabled && (
              <button type="button" onClick={() => removeCustom(item)} className="text-text-muted hover:text-danger">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        ))}
      </div>
      {allowCustom && !disabled && (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Add option"
            value={customInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomInput(e.target.value)}
            placeholder="Custom checkbox item"
            className="min-w-[220px] flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={addCustom}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
});

interface PhotoFieldProps {
  label?: string;
  photos: InspectionPhotoRef[];
  onChange: (photos: InspectionPhotoRef[]) => void;
  disabled?: boolean;
}

function readFilesAsPhotos(files: FileList, onBatch: (photos: InspectionPhotoRef[]) => void) {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return;

  const batch: InspectionPhotoRef[] = new Array(fileArray.length);
  let completed = 0;

  fileArray.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = () => {
      batch[index] = {
        id: crypto.randomUUID(),
        dataUrl: reader.result as string,
        createdAt: new Date().toISOString(),
      };
      completed += 1;
      if (completed === fileArray.length) {
        onBatch(batch);
      }
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoField({
  label = 'Photos',
  photos,
  onChange,
  disabled = false,
  className,
}: PhotoFieldProps & { className?: string }) {
  const safePhotos = normalizePhotos(photos);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(safePhotos);
  photosRef.current = safePhotos;
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((index) => (safePhotos.length === 0 ? 0 : Math.min(index, safePhotos.length - 1)));
    if (safePhotos.length === 0) {
      setViewerOpen(false);
      setEditorOpen(false);
    }
  }, [safePhotos]);

  const appendPhotos = useCallback(
    (batch: InspectionPhotoRef[]) => {
      if (disabled) return;
      const next = [...photosRef.current, ...batch];
      photosRef.current = next;
      onChange(next);
    },
    [disabled, onChange],
  );

  const handleFiles = (files: FileList | null) => {
    if (disabled || !files) return;
    readFilesAsPhotos(files, appendPhotos);
  };

  const removePhoto = (id: string) => {
    if (disabled) return;
    const next = safePhotos.filter((photo) => photo.id !== id);
    photosRef.current = next;
    onChange(next);
    if (activeIndex >= next.length) {
      setActiveIndex(Math.max(0, next.length - 1));
    }
    if (next.length === 0) {
      setViewerOpen(false);
    }
  };

  const activePhoto = safePhotos[activeIndex];

  const saveEditedPhoto = (nextDataUrl: string) => {
    if (!activePhoto || disabled) return;
    const next = safePhotos.map((photo) =>
      photo.id === activePhoto.id
        ? {
            ...photo,
            // Keep the first clean photo; later edits keep annotating the current image.
            originalDataUrl: photo.originalDataUrl ?? photo.dataUrl,
            dataUrl: nextDataUrl,
          }
        : photo,
    );
    photosRef.current = next;
    onChange(next);
    setEditorOpen(false);
    setViewerOpen(true);
  };

  const resetPhotoToOriginal = () => {
    if (!activePhoto?.originalDataUrl || disabled) return;
    const next = safePhotos.map((photo) =>
      photo.id === activePhoto.id
        ? { ...photo, dataUrl: photo.originalDataUrl as string }
        : photo,
    );
    photosRef.current = next;
    onChange(next);
  };

  return (
    <div className={cn('inspection-photo-field space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InspectionSubsectionHeading className="mb-0 border-b-0 pb-0">{label}</InspectionSubsectionHeading>
        <span className="text-xs text-text-muted">{safePhotos.length} photo{safePhotos.length === 1 ? '' : 's'}</span>
      </div>

      <div className="inspection-photo-actions">
        {!disabled && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="inspection-photo-btn inspection-photo-btn-camera"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Camera
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="inspection-photo-btn inspection-photo-btn-upload"
              onClick={() => uploadRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Upload
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="inspection-photo-btn inspection-photo-btn-view"
          disabled={safePhotos.length === 0}
          onClick={() => {
            setActiveIndex(0);
            setViewerOpen(true);
          }}
        >
          View ({safePhotos.length})
        </Button>
      </div>

      {!disabled && (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      )}

      <Modal
        open={viewerOpen && Boolean(activePhoto)}
        onClose={() => setViewerOpen(false)}
        title={`${label} — Photo ${safePhotos.length ? activeIndex + 1 : 0} of ${safePhotos.length}`}
        footer={
          activePhoto ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={activeIndex >= safePhotos.length - 1}
                  onClick={() => setActiveIndex((i) => Math.min(safePhotos.length - 1, i + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {!disabled && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setViewerOpen(false);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Edit photo
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => removePhoto(activePhoto.id)}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete Photo
                  </Button>
                </div>
              )}
            </div>
          ) : null
        }
      >
        {activePhoto && (
          <div className="space-y-3">
            <img
              key={activePhoto.dataUrl}
              src={activePhoto.dataUrl}
              alt=""
              className="max-h-[60vh] w-full rounded-sm object-contain"
            />
            {activePhoto.caption && <p className="text-sm text-text-muted">{activePhoto.caption}</p>}
          </div>
        )}
      </Modal>

      <PhotoAnnotationEditor
        open={editorOpen && Boolean(activePhoto)}
        dataUrl={activePhoto?.dataUrl ?? ''}
        originalDataUrl={activePhoto?.originalDataUrl}
        title={`${label} — Edit photo ${safePhotos.length ? activeIndex + 1 : 0}`}
        onClose={() => {
          setEditorOpen(false);
          setViewerOpen(true);
        }}
        onSave={saveEditedPhoto}
        onResetToOriginal={
          activePhoto?.originalDataUrl && activePhoto.originalDataUrl !== activePhoto.dataUrl
            ? resetPhotoToOriginal
            : undefined
        }
      />
    </div>
  );
}

interface SectionCommentsProps {
  comments: string;
  photos: InspectionPhotoRef[];
  onCommentsChange: (value: string) => void;
  onPhotosChange: (photos: InspectionPhotoRef[]) => void;
  disabled?: boolean;
  /** Loads one-click comment suggestions for this section. */
  sectionId?: string;
  suggestions?: readonly string[];
}

function suggestionButtonLabel(text: string): string {
  if (text.length <= 52) return text;
  return `${text.slice(0, 49)}…`;
}

export function SectionComments({
  comments,
  photos,
  onCommentsChange,
  onPhotosChange,
  disabled = false,
  sectionId,
  suggestions,
}: SectionCommentsProps) {
  const quickComments = suggestions ?? (sectionId ? getCommentSuggestions(sectionId) : []);
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  return (
    <div className="inspection-section-comments mt-1 w-full space-y-4">
      <InspectionSubsectionHeading>Comments</InspectionSubsectionHeading>
      {quickComments.length > 0 && !disabled ? (
        <div className="space-y-2 rounded-lg border border-primary/10 bg-secondary/[0.04] px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Quick comments</p>
          <div className="flex flex-wrap gap-1.5">
            {quickComments.map((snippet) => (
              <Button
                key={snippet}
                type="button"
                variant="secondary"
                size="sm"
                className="h-auto max-w-full whitespace-normal px-2.5 py-1.5 text-left text-xs leading-snug"
                title={snippet}
                onClick={() => onCommentsChange(appendInspectionComment(comments ?? '', snippet))}
              >
                {suggestionButtonLabel(snippet)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <Textarea
        commentsField
        dictationSectionId={sectionId}
        onDictationAppend={(text) =>
          onCommentsChange(appendInspectionComment(commentsRef.current ?? '', text))
        }
        value={comments ?? ''}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onCommentsChange(e.target.value)}
        rows={3}
      />
      <PhotoField
        key={photos.map((photo) => photo.id).join(',') || 'empty'}
        photos={photos}
        onChange={onPhotosChange}
        disabled={disabled}
        className="inspection-photo-field"
      />
    </div>
  );
}

interface YesNoSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  includeNa?: boolean;
  disabled?: boolean;
}

export function YesNoSelect({ label, value, onChange, includeNa, disabled = false }: YesNoSelectProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  const options = includeNa ? ['', 'Yes', 'No', 'N/A'] : ['', 'Yes', 'No'];
  return (
    <div>
      <label className="inspection-field-label">{label}</label>
      <select
        className={cn(inInspectionForm ? INSPECTION_INPUT_CLASS : 'input-field', 'w-full')}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option || 'blank'} value={option}>
            {option || 'Select...'}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RatingSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  disabled?: boolean;
}

export function RatingSelect({ label, value, onChange, options, disabled = false }: RatingSelectProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  return (
    <div>
      <label className="inspection-field-label">{label}</label>
      <select
        className={cn(inInspectionForm ? INSPECTION_INPUT_CLASS : 'input-field', 'w-full')}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
