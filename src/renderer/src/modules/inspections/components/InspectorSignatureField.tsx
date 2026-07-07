import { useContext, useEffect, useRef } from 'react';
import { Button, SignaturePad, type SignaturePadHandle } from '@/design-system/components';
import { useAuthStore } from '@/modules/auth/auth-store';
import {
  clearSavedInspectorSignature,
  getSavedInspectorSignature,
  saveInspectorSignature,
} from '@/lib/inspector-signature-storage';
import { InspectionFormContext } from './InspectionFormUi';

interface InspectorSignatureFieldProps {
  label?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  useSavedDefault?: boolean;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function InspectorSignatureField({
  label = 'Inspector Signature',
  value,
  onChange,
  disabled = false,
  useSavedDefault = true,
}: InspectorSignatureFieldProps) {
  const inInspectionForm = useContext(InspectionFormContext);
  const userId = useAuthStore((s) => s.user?.id);
  const padRef = useRef<SignaturePadHandle>(null);
  const appliedDefault = useRef(false);

  useEffect(() => {
    if (!useSavedDefault || disabled || appliedDefault.current || value?.trim()) return;
    const saved = getSavedInspectorSignature(userId);
    if (saved) {
      appliedDefault.current = true;
      onChange(saved);
    }
  }, [disabled, onChange, useSavedDefault, userId, value]);

  const persistSignature = (dataUrl: string) => {
    if (!dataUrl) return;
    if (useSavedDefault) saveInspectorSignature(userId, dataUrl);
    onChange(dataUrl);
  };

  const applyDrawnSignature = () => {
    const dataUrl = padRef.current?.toDataUrl() ?? '';
    if (!dataUrl || padRef.current?.isEmpty()) return;
    persistSignature(dataUrl);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > 20) persistSignature(dataUrl);
  };

  return (
    <div className="space-y-3">
      <p className={inInspectionForm ? 'inspection-field-label' : 'text-sm font-medium text-text'}>{label}</p>
      {value && (
        <div className="rounded-sm border border-border bg-white p-2">
          <img src={value} alt="Saved signature" className="max-h-24 w-full object-contain" />
        </div>
      )}
      {!disabled && (
        <>
          <div>
            <p className="mb-2 text-xs text-text-muted">Draw signature</p>
            <SignaturePad ref={padRef} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={applyDrawnSignature}>
              Apply drawn signature
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-sm border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-background">
              Upload image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {useSavedDefault && getSavedInspectorSignature(userId) && !value && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => persistSignature(getSavedInspectorSignature(userId))}
              >
                Use saved signature
              </Button>
            )}
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                Clear
              </Button>
            )}
            {useSavedDefault && getSavedInspectorSignature(userId) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => clearSavedInspectorSignature(userId)}
              >
                Forget saved signature
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {useSavedDefault
              ? 'Your signature is saved on this device and applied automatically to new inspections.'
              : 'Draw or upload a signature image.'}
          </p>
        </>
      )}
    </div>
  );
}
