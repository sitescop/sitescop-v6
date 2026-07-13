import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getAdjacentRouteSection } from './inspection-route';
import { InspectionSectionNav } from './InspectionSectionNav';
import { resolveWorkflowSectionStatus, type SectionCompletionStatus } from './section-completion';

interface InspectionAccordionContextValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
  toggle: (id: string) => void;
  routeIds: string[];
  goToAdjacent: (currentId: string, direction: 'next' | 'previous') => string | null;
  resolveSectionStatus: (sectionId: string) => SectionCompletionStatus;
}

const InspectionAccordionContext = createContext<InspectionAccordionContextValue | null>(null);

const ACCORDION_SCROLL_OFFSET = 76;

interface WorkflowSnapshot {
  visited: string[];
  completed: string[];
}

function loadWorkflowSnapshot(storageKey: string | undefined): WorkflowSnapshot {
  if (!storageKey) return { visited: [], completed: [] };
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return { visited: [], completed: [] };
    const parsed = JSON.parse(raw) as WorkflowSnapshot;
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    };
  } catch {
    return { visited: [], completed: [] };
  }
}

function saveWorkflowSnapshot(
  storageKey: string | undefined,
  visitedIds: ReadonlySet<string>,
  completedIds: ReadonlySet<string>,
): void {
  if (!storageKey) return;
  const snapshot: WorkflowSnapshot = {
    visited: [...visitedIds],
    completed: [...completedIds],
  };
  sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function scrollHeaderIntoPlace(sectionId: string) {
  const header = document.getElementById(`inspection-section-header-${sectionId}`);
  if (!header) return;

  const delta = header.getBoundingClientRect().top - ACCORDION_SCROLL_OFFSET;
  if (Math.abs(delta) < 4) return;

  window.scrollTo({ top: window.scrollY + delta, behavior: 'auto' });
}

export function InspectionAccordion({
  children,
  defaultOpenId,
  className,
  routeIds = [],
  workflowStorageKey,
}: {
  children: ReactNode;
  defaultOpenId?: string;
  className?: string;
  routeIds?: string[];
  /** Optional session snapshot of visited sections (navigation only; heading colour uses form completion). */
  workflowStorageKey?: string;
}) {
  const storageKey = workflowStorageKey
    ? `sitescop-inspection-section-workflow:${workflowStorageKey}`
    : undefined;
  const initialWorkflow = useMemo(() => loadWorkflowSnapshot(storageKey), [storageKey]);
  const [openId, setOpenIdState] = useState<string | null>(defaultOpenId ?? null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => new Set(initialWorkflow.visited));
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set(initialWorkflow.completed));

  const markVisited = useCallback((id: string) => {
    setVisitedIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const markCompleted = useCallback((id: string) => {
    setCompletedIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!defaultOpenId) return;
    markVisited(defaultOpenId);
  }, [defaultOpenId, markVisited]);

  useEffect(() => {
    saveWorkflowSnapshot(storageKey, visitedIds, completedIds);
  }, [storageKey, visitedIds, completedIds]);

  const setOpenId = useCallback(
    (id: string | null) => {
      setOpenIdState((current) => {
        if (current && current !== id) {
          markCompleted(current);
        }
        if (id) {
          markVisited(id);
        }
        return id;
      });
    },
    [markCompleted, markVisited],
  );

  const toggle = useCallback(
    (id: string) => {
      setOpenIdState((current) => {
        if (current === id) {
          markCompleted(id);
          return null;
        }
        if (current) {
          markCompleted(current);
        }
        markVisited(id);
        return id;
      });
    },
    [markCompleted, markVisited],
  );

  const goToAdjacent = useCallback(
    (currentId: string, direction: 'next' | 'previous') =>
      getAdjacentRouteSection(routeIds, currentId, direction),
    [routeIds],
  );

  const resolveSectionStatus = useCallback(
    (sectionId: string) => resolveWorkflowSectionStatus(sectionId, openId, visitedIds, completedIds),
    [openId, visitedIds, completedIds],
  );

  useEffect(() => {
    if (!openId) return;

    // Pin the header before the open animation shifts layout.
    requestAnimationFrame(() => scrollHeaderIntoPlace(openId));

    const panel = document.getElementById(`${openId}-panel`);
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName !== 'grid-template-rows') return;
      scrollHeaderIntoPlace(openId);
    };
    panel?.addEventListener('transitionend', onTransitionEnd);

    return () => {
      panel?.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [openId]);

  const value = useMemo(
    () => ({ openId, setOpenId, toggle, routeIds, goToAdjacent, resolveSectionStatus }),
    [openId, setOpenId, toggle, routeIds, goToAdjacent, resolveSectionStatus],
  );

  return (
    <InspectionAccordionContext.Provider value={value}>
      <div className={cn('space-y-2', className)}>{children}</div>
    </InspectionAccordionContext.Provider>
  );
}

function StatusBadge({ status }: { status: SectionCompletionStatus }) {
  if (status === 'completed') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden>
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'in_progress') {
    return <span className="h-3 w-3 shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_rgba(243,156,18,0.25)]" aria-hidden />;
  }
  return <span className="h-3 w-3 shrink-0 rounded-full bg-secondary shadow-[0_0_0_3px_rgba(0,90,156,0.22)]" aria-hidden />;
}

function statusLabel(status: SectionCompletionStatus): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

export function InspectionAccordionSection({
  id,
  title,
  status,
  children,
  className,
  onOpen,
}: {
  id: string;
  title: string;
  status: SectionCompletionStatus;
  children: ReactNode;
  className?: string;
  onOpen?: () => void;
}) {
  const ctx = useContext(InspectionAccordionContext);
  const fallbackId = useId();
  const sectionId = id || fallbackId;
  const isOpen = ctx ? ctx.openId === sectionId : true;
  // Prefer saved form completion so greens survive close/reopen; only mark in-progress while open.
  const displayStatus: SectionCompletionStatus = isOpen
    ? status === 'completed'
      ? 'completed'
      : 'in_progress'
    : status;
  const openedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    onOpen?.();
  }, [isOpen, onOpen]);

  const handleToggle = () => {
    ctx?.toggle(sectionId);
  };

  return (
    <section
      id={`inspection-section-${sectionId}`}
      className={cn(
        'inspection-accordion-section overflow-hidden rounded-lg border shadow-card transition-colors duration-200',
        displayStatus === 'completed'
          ? 'border-success/35 bg-success/[0.03]'
          : displayStatus === 'in_progress'
            ? 'border-accent/30 bg-accent/[0.02]'
            : 'border-secondary/35 bg-secondary/[0.06]',
        className,
      )}
    >
      <button
        id={`inspection-section-header-${sectionId}`}
        type="button"
        className={cn(
          'inspection-accordion-header flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors md:px-5',
          displayStatus === 'not_started' && 'hover:bg-secondary/[0.08]',
          displayStatus === 'in_progress' && 'hover:bg-accent/[0.06]',
          displayStatus === 'completed' && 'hover:bg-success/[0.05]',
          isOpen &&
            (displayStatus === 'not_started'
              ? 'border-b border-secondary/20 bg-secondary/[0.08]'
              : displayStatus === 'in_progress'
                ? 'border-b border-accent/20 bg-accent/[0.04]'
                : 'border-b border-success/20 bg-success/[0.04]'),
        )}
        aria-expanded={isOpen}
        aria-controls={`${sectionId}-panel`}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          handleToggle();
        }}
      >
        <StatusBadge status={displayStatus} />
        <span
          className={cn(
            'min-w-0 flex-1 text-base font-bold md:text-lg',
            displayStatus === 'completed'
              ? 'text-success'
              : displayStatus === 'in_progress'
                ? 'text-primary'
                : 'text-secondary',
          )}
        >
          {title}
        </span>
        <span className="sr-only">{statusLabel(displayStatus)}</span>
        {displayStatus === 'completed' ? (
          <Check className="hidden h-4 w-4 shrink-0 text-success sm:block" strokeWidth={3} aria-hidden />
        ) : null}
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-text-muted transition-transform duration-300', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      <div
        id={`${sectionId}-panel`}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="inspection-accordion-panel space-y-3 p-4 md:space-y-4 md:p-5">
            {children}
            <InspectionSectionNav sectionId={sectionId} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function useInspectionAccordion() {
  return useContext(InspectionAccordionContext);
}
