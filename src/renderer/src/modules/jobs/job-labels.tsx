import type { InspectionType, JobPriority, JobStatus } from '@shared/api-types';
import { cn } from '@/lib/cn';

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  BUILDING: 'Building',
  PEST: 'Pest',
  COMBINED: 'Building & Pest',
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const PRIORITY_LABELS: Record<JobPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    NEW: 'bg-secondary/10 text-secondary',
    IN_PROGRESS: 'bg-accent/15 text-amber-800',
    COMPLETED: 'bg-success/10 text-success',
    ARCHIVED: 'bg-text-muted/15 text-text-light',
  };
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  if (priority === 'NORMAL') return null;
  const styles: Record<Exclude<JobPriority, 'NORMAL'>, string> = {
    LOW: 'bg-text-muted/15 text-text-light',
    HIGH: 'bg-warning/15 text-amber-800',
    URGENT: 'bg-danger/10 text-danger',
  };
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold uppercase', styles[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function TypeBadge({ type }: { type: InspectionType }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase text-primary">
      {INSPECTION_TYPE_LABELS[type]}
    </span>
  );
}
