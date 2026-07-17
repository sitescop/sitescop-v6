import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/design-system/components';
import { cn } from '@/lib/cn';

interface SectionQuickActionsProps {
  disabled?: boolean;
  onNoIssues: () => void;
  onMajorDefect?: () => void;
  noMajorActive?: boolean;
  majorActive?: boolean;
  label?: string;
  majorLabel?: string;
}

export function SectionQuickActions({
  disabled = false,
  onNoIssues,
  onMajorDefect,
  noMajorActive = false,
  majorActive = false,
  label = 'No major defect observed',
  majorLabel = 'Major defect observed',
}: SectionQuickActionsProps) {
  const locked = disabled;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-[#0B4F8C]/30 bg-[#E8F4FF] px-3 py-2.5 shadow-sm">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={locked || noMajorActive}
        onClick={onNoIssues}
        className={cn(
          'inline-flex items-center gap-1.5 border-2 font-semibold text-white shadow-sm',
          noMajorActive
            ? 'border-[#14532D] bg-[#15803D] ring-2 ring-[#16A34A] ring-offset-1 hover:bg-[#15803D] hover:text-white'
            : 'border-[#15803D] bg-[#16A34A] hover:bg-[#15803D] hover:text-white',
        )}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      {onMajorDefect ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={locked || majorActive}
          onClick={onMajorDefect}
          className={cn(
            'inline-flex items-center gap-1.5 border-2 font-semibold text-white shadow-sm',
            majorActive
              ? 'border-[#7F1D1D] bg-[#B91C1C] ring-2 ring-[#DC2626] ring-offset-1 hover:bg-[#B91C1C] hover:text-white'
              : 'border-[#B91C1C] bg-[#DC2626] hover:bg-[#B91C1C] hover:text-white',
          )}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {majorLabel}
        </Button>
      ) : null}
      <span className="text-xs font-medium text-[#0B4F8C]/80">
        Hides detailed fields — leaves photos and comments only.
      </span>
    </div>
  );
}
