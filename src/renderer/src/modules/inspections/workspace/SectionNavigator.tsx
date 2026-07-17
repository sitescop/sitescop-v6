import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/design-system/components';
import { cn } from '@/lib/cn';
import { getAdjacentRouteSection } from '@/modules/inspections/components/inspection-route';
import type { SectionCompletionStatus } from '@/modules/inspections/components/section-completion';
import { useAppSidebar } from '@/design-system/layouts/AppSidebarContext';
import { sectionLabel } from './section-labels';

function StatusDot({ status }: { status: SectionCompletionStatus }) {
  if (status === 'completed') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" aria-hidden />;
  }
  if (status === 'in_progress') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden />;
  }
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary/50" aria-hidden />;
}

interface SectionNavigatorProps {
  routeIds: string[];
  activeId: string;
  statuses: Record<string, SectionCompletionStatus>;
  onSelect: (id: string) => void;
}

export const SectionNavigator = memo(function SectionNavigator({
  routeIds,
  activeId,
  statuses,
  onSelect,
}: SectionNavigatorProps) {
  const appSidebar = useAppSidebar();
  const showAppMenuButton = Boolean(appSidebar && !appSidebar.sidebarOpen);
  const index = routeIds.indexOf(activeId);
  const previousId = getAdjacentRouteSection(routeIds, activeId, 'previous');
  const nextId = getAdjacentRouteSection(routeIds, activeId, 'next');

  return (
    <aside className="flex h-full min-h-0 flex-col bg-secondary/[0.1]">
      <div className="flex items-start gap-2 border-b border-secondary/20 px-3 py-3">
        {showAppMenuButton ? (
          <button
            type="button"
            onClick={() => appSidebar?.showSidebar()}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-white shadow-sm hover:bg-secondary/90"
            title="Show app menu"
            aria-label="Show app menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Sections</p>
          <p className="text-sm text-secondary/80">
            {index >= 0 ? `${index + 1} of ${routeIds.length}` : '—'}
          </p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Inspection sections">
        <ul className="space-y-1">
          {routeIds.map((id) => {
            const isActive = id === activeId;
            const status = statuses[id] ?? 'not_started';
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-secondary font-semibold text-white shadow-sm'
                      : 'text-text hover:bg-secondary/20',
                  )}
                >
                  <StatusDot status={isActive ? 'in_progress' : status} />
                  <span className="min-w-0 flex-1 leading-snug">{sectionLabel(id)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex gap-2 border-t border-secondary/20 p-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flex-1"
          disabled={!previousId}
          onClick={() => previousId && onSelect(previousId)}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="flex-1"
          disabled={!nextId}
          onClick={() => nextId && onSelect(nextId)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
});
