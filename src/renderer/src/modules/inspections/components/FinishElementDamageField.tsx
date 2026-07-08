import { Plus, Trash2 } from 'lucide-react';
import {
  createEmptyFinishElementDamageEntry,
  FINISH_ELEMENT_DAMAGE_OPTIONS,
  normalizeCheckboxField,
  type FinishElementDamageEntry,
} from '@sitescop/room-engine-core';
import { Button, Input, Textarea } from '@/design-system/components';
import { CheckboxGroupField, InspectionSubsectionHeading, PhotoField } from './InspectionFields';

function entryTitle(entry: FinishElementDamageEntry): string {
  const items = [...normalizeCheckboxField(entry.elements).selected, ...normalizeCheckboxField(entry.elements).custom];
  return items.length ? items.join(', ') : 'Finish element entry';
}

export function FinishElementDamageField({
  entries,
  onChange,
  disabled,
}: {
  entries: FinishElementDamageEntry[];
  onChange: (entries: FinishElementDamageEntry[]) => void;
  disabled?: boolean;
}) {
  const updateEntry = (id: string, partial: Partial<FinishElementDamageEntry>) => {
    onChange(
      entries.map((entry) =>
        entry.id === id
          ? { ...entry, ...partial, photos: partial.photos ?? entry.photos ?? [] }
          : entry,
      ),
    );
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((entry) => entry.id !== id));
  };

  const addEntry = () => {
    onChange([...entries, createEmptyFinishElementDamageEntry()]);
  };

  return (
    <div className="inspection-subpanel space-y-4">
      <div className="flex items-center justify-between gap-3">
        <InspectionSubsectionHeading>Finish Element Damage</InspectionSubsectionHeading>
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addEntry}>
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      </div>
      <p className="text-sm text-muted">
        Tick all affected finish elements for each location — e.g. door jamb, skirting and carpet in the same area.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No finish element damage entries yet.</p>
      ) : null}
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">{entryTitle(entry)}</p>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => removeEntry(entry.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <CheckboxGroupField
            disabled={disabled}
            label="Damage to"
            options={FINISH_ELEMENT_DAMAGE_OPTIONS}
            value={entry.elements}
            onChange={(elements) => updateEntry(entry.id, { elements })}
          />
          <Input
            label="Location"
            value={entry.location}
            disabled={disabled}
            onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
          />
          <Textarea
            label="Comments"
            value={entry.comments}
            disabled={disabled}
            rows={2}
            onChange={(e) => updateEntry(entry.id, { comments: e.target.value })}
          />
          <PhotoField
            disabled={disabled}
            label="Damage Photos"
            photos={entry.photos ?? []}
            onChange={(photos) => updateEntry(entry.id, { photos })}
          />
        </div>
      ))}
    </div>
  );
}
