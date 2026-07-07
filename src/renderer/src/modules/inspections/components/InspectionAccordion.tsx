import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SectionCompletionStatus } from './section-completion';

interface InspectionAccordionContextValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
  toggle: (id: string) => void;
}

const InspectionAccordionContext = createContext<InspectionAccordionContextValue | null>(null);

export function InspectionAccordion({
  children,
  defaultOpenId,
  className,
}: {
  children: ReactNode;
  defaultOpenId?: string;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);

  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  const value = useMemo(() => ({ openId, setOpenId, toggle }), [openId, toggle]);

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
}: {
  id: string;
  title: string;
  status: SectionCompletionStatus;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(InspectionAccordionContext);
  const fallbackId = useId();
  const sectionId = id || fallbackId;
  const isOpen = ctx ? ctx.openId === sectionId : true;

  const handleToggle = () => {
    ctx?.toggle(sectionId);
  };

  return (
    <section
      className={cn(
        'inspection-accordion-section overflow-hidden rounded-lg border shadow-card transition-colors duration-200',
        status === 'completed'
          ? 'border-success/35 bg-success/[0.03]'
          : status === 'in_progress'
            ? 'border-accent/30 bg-accent/[0.02]'
            : 'border-secondary/35 bg-secondary/[0.06]',
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors md:px-5',
          status === 'not_started' && 'hover:bg-secondary/[0.08]',
          status === 'in_progress' && 'hover:bg-accent/[0.06]',
          status === 'completed' && 'hover:bg-success/[0.05]',
          isOpen &&
            (status === 'not_started'
              ? 'border-b border-secondary/20 bg-secondary/[0.08]'
              : status === 'in_progress'
                ? 'border-b border-accent/20 bg-accent/[0.04]'
                : 'border-b border-success/20 bg-success/[0.04]'),
        )}
        aria-expanded={isOpen}
        aria-controls={`${sectionId}-panel`}
        onClick={handleToggle}
      >
        <StatusBadge status={status} />
        <span
          className={cn(
            'min-w-0 flex-1 text-base font-bold md:text-lg',
            status === 'completed'
              ? 'text-success'
              : status === 'in_progress'
                ? 'text-primary'
                : 'text-secondary',
          )}
        >
          {title}
        </span>
        <span className="sr-only">{statusLabel(status)}</span>
        {status === 'completed' ? (
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
          <div className="inspection-accordion-panel space-y-3 p-4 md:space-y-4 md:p-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function useInspectionAccordion() {
  return useContext(InspectionAccordionContext);
}
