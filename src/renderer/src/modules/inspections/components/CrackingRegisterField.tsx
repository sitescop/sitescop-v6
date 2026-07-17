import { useEffect, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  applyCrackingEntryRules,
  CRACK_WIDTH_OPTIONS,
  createEmptyCrackingEntry,
  getCrackWidthInterpretation,
  isCrackingEntryFilled,
  type CrackingEntry,
} from '@sitescop/room-engine-core';
import { Button, Input, Select, Textarea } from '@/design-system/components';
import { cn } from '@/lib/cn';
import { PhotoField } from './InspectionFields';

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
  onClearAll,
  disabled,
}: {
  entries: CrackingEntry[];
  onChange: (entries: CrackingEntry[]) => void;
  /** Clears entries and suppresses auto re-inject until user adds again intentionally. */
  onClearAll?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = entries.length === 0 ? 0 : Math.min(activeIndex, entries.length - 1);
  const activeEntry = entries[safeIndex];
  const filledCount = entries.filter(isCrackingEntryFilled).length;

  useEffect(() => {
    if (activeIndex > entries.length - 1) {
      setActiveIndex(Math.max(0, entries.length - 1));
    }
  }, [activeIndex, entries.length]);

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
    const next = entries.filter((entry) => entry.id !== id);
    onChange(next);
    if (next.length === 0) setOpen(false);
  };

  const clearAll = () => {
    if (onClearAll) onClearAll();
    else onChange([]);
    setOpen(false);
    setActiveIndex(0);
  };

  const onAddEntryClick = () => {
    if (!open) {
      setOpen(true);
      if (entries.length === 0) {
        const created = createEmptyCrackingEntry();
        onChange([created]);
        setActiveIndex(0);
      } else {
        setActiveIndex(0);
      }
      return;
    }
    const created = createEmptyCrackingEntry();
    onChange([...entries, created]);
    setActiveIndex(entries.length);
  };

  const widthHint = activeEntry?.crackWidth ? getCrackWidthInterpretation(activeEntry.crackWidth) : '';

  return (
    <div className="inspection-subpanel space-y-4">
      <div className="mb-0 flex flex-wrap items-center justify-start gap-2 rounded-md border-l-4 border-[#F39C12] bg-[#0B4F8C] px-3 py-2 shadow-md">
        <button
          type="button"
          className="flex items-center gap-2 text-left text-base font-bold tracking-wide text-white md:text-lg"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#F39C12] shadow-[0_0_0_3px_rgba(243,156,18,0.35)]" aria-hidden />
          Cracking
          {filledCount > 0 ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{filledCount} filled</span>
          ) : null}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onAddEntryClick}
          className="shrink-0 border-2 border-white/90 bg-[#DC2626] font-semibold text-white shadow-sm hover:bg-[#B91C1C] hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
        {entries.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={clearAll}
            className="shrink-0 border-2 border-white/70 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
          >
            Clear all
          </Button>
        ) : null}
      </div>

      {open ? (
        <>
          {entries.length > 1 ? (
            <div className="sticky top-0 z-20 flex flex-wrap gap-2 border-b-2 border-[#0B4F8C] bg-[#0B4F8C] px-2 py-3 shadow-md">
              {entries.map((entry, index) => {
                const filled = isCrackingEntryFilled(entry);
                const isActive = index === safeIndex;
                return (
                  <Button
                    key={entry.id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'inline-flex items-center gap-1.5 border-2 font-semibold shadow-sm',
                      filled && isActive
                        ? 'border-white bg-[#15803D] text-white hover:bg-[#166534] hover:text-white'
                        : filled
                          ? 'border-[#15803D] bg-[#16A34A] text-white hover:bg-[#15803D] hover:text-white'
                          : isActive
                            ? 'border-white bg-[#F39C12] text-white hover:bg-[#E08E0B] hover:text-white'
                            : 'border-white/80 bg-white text-[#0B4F8C] hover:bg-[#E8F4FF] hover:text-[#0B4F8C]',
                    )}
                    onClick={() => setActiveIndex(index)}
                  >
                    {filled ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden /> : null}
                    Crack no#{index + 1}
                  </Button>
                );
              })}
            </div>
          ) : null}

          {activeEntry ? (
            <div key={activeEntry.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  {activeEntry.location || `Crack no#${safeIndex + 1}`}
                  {activeEntry.id.startsWith('auto-') ? <span className="ml-2 text-xs text-muted">(auto)</span> : null}
                  {isCrackingEntryFilled(activeEntry) ? (
                    <span className="ml-2 text-xs font-semibold text-success">Filled</span>
                  ) : (
                    <span className="ml-2 text-xs text-muted">Not counted until filled</span>
                  )}
                </p>
                {!activeEntry.id.startsWith('auto-') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => removeEntry(activeEntry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Location"
                  value={activeEntry.location}
                  disabled={disabled}
                  onChange={(e) => updateEntry(activeEntry.id, { location: e.target.value })}
                />
                <div className="space-y-1">
                  <Select
                    label="Crack Width"
                    value={activeEntry.crackWidth}
                    disabled={disabled}
                    onChange={(e) => updateEntry(activeEntry.id, { crackWidth: e.target.value })}
                    options={CRACK_WIDTH_OPTIONS.map((value) => ({ value, label: value }))}
                    placeholder="Select width"
                  />
                  {widthHint ? <p className="text-xs text-muted">{widthHint}</p> : null}
                </div>
                <YesNoSelect
                  label="Monitoring Recommended"
                  value={activeEntry.monitoringRecommended}
                  disabled={disabled}
                  onChange={(value) => updateEntry(activeEntry.id, { monitoringRecommended: value })}
                />
                <YesNoSelect
                  label="Engineering Required"
                  value={activeEntry.engineeringRequired}
                  disabled={disabled}
                  onChange={(value) => updateEntry(activeEntry.id, { engineeringRequired: value })}
                />
              </div>
              <Textarea
                label="Comments"
                value={activeEntry.comments}
                disabled={disabled}
                rows={2}
                onChange={(e) => updateEntry(activeEntry.id, { comments: e.target.value })}
              />
              <PhotoField
                disabled={disabled}
                label="Cracking Photos"
                photos={activeEntry.photos ?? []}
                onChange={(photos) => updateEntry(activeEntry.id, { photos })}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">No cracking entries yet. Click Add entry to start.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
