import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/design-system/components';
import { useInspectionAccordion } from './InspectionAccordion';

export function InspectionSectionNav({ sectionId }: { sectionId: string }) {
  const ctx = useInspectionAccordion();
  if (!ctx || ctx.routeIds.length === 0) return null;

  const index = ctx.routeIds.indexOf(sectionId);
  if (index === -1) return null;

  const previousId = ctx.goToAdjacent(sectionId, 'previous');
  const nextId = ctx.goToAdjacent(sectionId, 'next');
  const total = ctx.routeIds.length;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-primary/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-text-muted">
        Section {index + 1} of {total}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!previousId}
          onClick={() => previousId && ctx.setOpenId(previousId)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!nextId}
          onClick={() => nextId && ctx.setOpenId(nextId)}
        >
          Next section
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
