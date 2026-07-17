import { useEffect } from 'react';
import {
  createEmptyFinishElementDamageEntry,
  FINISH_ELEMENT_DAMAGE_OPTIONS,
  type FinishElementDamageEntry,
} from '@sitescop/room-engine-core';
import { Input, Textarea } from '@/design-system/components';
import { CheckboxGroupField, PhotoField } from './InspectionFields';

export function FinishElementDamageField({
  entries,
  onChange,
  disabled,
}: {
  entries: FinishElementDamageEntry[];
  onChange: (entries: FinishElementDamageEntry[]) => void;
  disabled?: boolean;
}) {
  const entry = entries[0];

  useEffect(() => {
    if (disabled) return;
    if (entries.length === 0) {
      onChange([createEmptyFinishElementDamageEntry()]);
      return;
    }
    if (entries.length > 1) {
      onChange([entries[0]]);
    }
    // Seed / collapse only when count changes — avoid loops from unstable onChange identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, entries.length]);

  const update = (partial: Partial<FinishElementDamageEntry>) => {
    const base = entry ?? createEmptyFinishElementDamageEntry();
    onChange([{ ...base, ...partial, photos: partial.photos ?? base.photos ?? [] }]);
  };

  if (!entry) {
    return (
      <div className="inspection-subpanel space-y-4">
        <div className="mb-0 flex flex-wrap items-center justify-start gap-2 rounded-md border-l-4 border-[#F39C12] bg-[#0B4F8C] px-3 py-2 shadow-md">
          <p className="flex min-w-0 items-center gap-2 text-base font-bold tracking-wide text-white md:text-lg">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#F39C12] shadow-[0_0_0_3px_rgba(243,156,18,0.35)]" aria-hidden />
            Finish Element Damage
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="inspection-subpanel space-y-4">
      <div className="mb-0 flex flex-wrap items-center justify-start gap-2 rounded-md border-l-4 border-[#F39C12] bg-[#0B4F8C] px-3 py-2 shadow-md">
        <p className="flex min-w-0 items-center gap-2 text-base font-bold tracking-wide text-white md:text-lg">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#F39C12] shadow-[0_0_0_3px_rgba(243,156,18,0.35)]" aria-hidden />
          Finish Element Damage
        </p>
      </div>
      <p className="text-sm text-muted">
        Tick all affected finish elements for this location — e.g. door jamb, skirting and carpet in the same area.
      </p>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <CheckboxGroupField
          disabled={disabled}
          label="Damage to"
          options={FINISH_ELEMENT_DAMAGE_OPTIONS}
          value={entry.elements}
          onChange={(elements) => update({ elements })}
        />
        <Input
          label="Location"
          value={entry.location}
          disabled={disabled}
          onChange={(e) => update({ location: e.target.value })}
        />
        <Textarea
          label="Comments"
          value={entry.comments}
          disabled={disabled}
          rows={2}
          onChange={(e) => update({ comments: e.target.value })}
        />
        <PhotoField
          disabled={disabled}
          label="Damage Photos"
          photos={entry.photos ?? []}
          onChange={(photos) => update({ photos })}
        />
      </div>
    </div>
  );
}
