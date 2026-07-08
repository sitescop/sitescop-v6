import { Plus, Trash2 } from 'lucide-react';
import {
  applyCrackingEntryRules,
  CRACK_WIDTH_OPTIONS,
  createEmptyCrackingEntry,
  getCrackWidthInterpretation,
  type CrackingEntry,
} from '@sitescop/room-engine-core';
import { Button, Input, Select, Textarea } from '@/design-system/components';
import { InspectionSubsectionHeading, PhotoField } from './InspectionFields';

function YesNoSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: 'No', label: 'No' },
        { value: 'Yes', label: 'Yes' },
      ]}
      placeholder="Select"
    />
  );
}

export function CrackingRegisterField({
  entries,
  onChange,
  disabled,
}: {
  entries: CrackingEntry[];
  onChange: (entries: CrackingEntry[]) => void;
  disabled?: boolean;
}) {
  const updateEntry = (id: string, partial: Partial<CrackingEntry>) => {
    onChange(
      entries.map((entry) => {
        if (entry.id !== id) return entry;
        const next = { ...entry, ...partial, photos: partial.photos ?? entry.photos ?? [] };
        return partial.crackWidth !== undefined ? applyCrackingEntryRules(next) : next;
      }),
    );
  };

  const removeEntry = (id: string) => {
    if (id.startsWith('auto-')) return;
    onChange(entries.filter((entry) => entry.id !== id));
  };

  const addEntry = () => {
    onChange([...entries, createEmptyCrackingEntry()]);
  };

  return (
    <div className="inspection-subpanel space-y-4">
      <div className="flex items-center justify-between gap-3">
        <InspectionSubsectionHeading>Cracking</InspectionSubsectionHeading>
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addEntry}>
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No cracking entries yet. Auto entries appear when cracking is noted elsewhere.</p>
      ) : null}
      {entries.map((entry) => {
        const widthHint = entry.crackWidth ? getCrackWidthInterpretation(entry.crackWidth) : '';
        return (
          <div key={entry.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">
                {entry.location || 'Cracking entry'}
                {entry.id.startsWith('auto-') ? <span className="ml-2 text-xs text-muted">(auto)</span> : null}
              </p>
              {!entry.id.startsWith('auto-') ? (
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => removeEntry(entry.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Location"
                value={entry.location}
                disabled={disabled}
                onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
              />
              <div className="space-y-1">
                <Select
                  label="Crack Width"
                  value={entry.crackWidth}
                  disabled={disabled}
                  onChange={(e) => updateEntry(entry.id, { crackWidth: e.target.value })}
                  options={CRACK_WIDTH_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Select width"
                />
                {widthHint ? <p className="text-xs text-muted">{widthHint}</p> : null}
              </div>
              <YesNoSelect
                label="Monitoring Recommended"
                value={entry.monitoringRecommended}
                disabled={disabled}
                onChange={(value) => updateEntry(entry.id, { monitoringRecommended: value })}
              />
              <YesNoSelect
                label="Engineering Required"
                value={entry.engineeringRequired}
                disabled={disabled}
                onChange={(value) => updateEntry(entry.id, { engineeringRequired: value })}
              />
            </div>
            <Textarea
              label="Comments"
              value={entry.comments}
              disabled={disabled}
              rows={2}
              onChange={(e) => updateEntry(entry.id, { comments: e.target.value })}
            />
            <PhotoField
              disabled={disabled}
              label="Cracking Photos"
              photos={entry.photos ?? []}
              onChange={(photos) => updateEntry(entry.id, { photos })}
            />
          </div>
        );
      })}
    </div>
  );
}
