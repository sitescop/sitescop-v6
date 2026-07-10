import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/design-system/components';

interface SectionQuickActionsProps {
  disabled?: boolean;
  onNoIssues: () => void;
  label?: string;
}

export function SectionQuickActions({
  disabled = false,
  onNoIssues,
  label = 'No major defect observed',
}: SectionQuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/12 bg-white px-3 py-2.5 shadow-sm">
      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onNoIssues}>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      <span className="text-xs text-text-muted">Hides detailed fields and records no major defect for this section.</span>
    </div>
  );
}
