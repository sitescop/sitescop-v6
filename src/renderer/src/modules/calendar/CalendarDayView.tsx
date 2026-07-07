import { useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GripVertical, Plus } from 'lucide-react';
import type { CalendarEvent, JobRow } from '@shared/api-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { Button, Modal } from '@/design-system/components';
import { PriorityBadge, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { cn } from '@/lib/cn';
import {
  CALENDAR_HOUR_SLOTS,
  formatDayTitle,
  formatHourLabel,
  groupEventsByHourSlot,
  normalizeToHourSlot,
} from '@/modules/calendar/calendar-hours';
import {
  allowCalendarDrop,
  readCalendarDragPayload,
  setCalendarDragPayload,
} from '@/modules/calendar/calendar-drag';

interface CalendarDayViewProps {
  dateKey: string;
  dayEvents: CalendarEvent[];
  open: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

function statusColor(status: CalendarEvent['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'border-success/40 bg-success/10';
    case 'IN_PROGRESS':
      return 'border-accent/40 bg-accent/10';
    default:
      return 'border-primary/40 bg-primary/10';
  }
}

import { canMoveCalendarJob } from '@/modules/calendar/calendar-move';

export function CalendarDayView({ dateKey, dayEvents, open, onClose, onSelectEvent }: CalendarDayViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dropSlot, setDropSlot] = useState<string | null>(null);
  const [dropError, setDropError] = useState('');

  const inProgressQuery = useQuery({
    queryKey: ['jobs-in-progress'],
    queryFn: () => getSitescopApi().jobs.listInProgress(),
    enabled: open,
  });

  const slots = useMemo(() => groupEventsByHourSlot(dayEvents), [dayEvents]);

  const draggableJobs = useMemo(() => {
    return (inProgressQuery.data ?? []).filter((job) => canMoveCalendarJob(job));
  }, [inProgressQuery.data]);

  const rescheduleMutation = useMutation({
    mutationFn: ({ jobId, time }: { jobId: string; time: string }) =>
      getSitescopApi().calendar.reschedule(jobId, {
        inspectionDate: dateKey,
        inspectionTime: time,
      }),
    onSuccess: () => {
      setDropError('');
      setDropSlot(null);
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
    },
    onError: (error) => {
      setDropError(error instanceof Error ? error.message : 'Could not move job.');
    },
  });

  function handleDrop(slotTime: string, event: DragEvent) {
    event.preventDefault();
    setDropSlot(null);
    const payload = readCalendarDragPayload(event);
    if (!payload) return;

    if (payload.inspectionDate === dateKey && payload.inspectionTime.startsWith(slotTime.slice(0, 2))) {
      return;
    }

    rescheduleMutation.mutate({ jobId: payload.jobId, time: slotTime });
  }

  function openNewJob(slotTime: string) {
    onClose();
    navigate('/jobs/new', {
      state: { inspectionDate: dateKey, inspectionTime: slotTime },
    });
  }

  function renderJobChip(event: CalendarEvent, slotTime: string, draggable: boolean) {
    return (
      <div
        key={event.id}
        draggable={draggable}
        onDragStart={
          draggable
            ? (e) => {
                e.stopPropagation();
                setCalendarDragPayload(e, {
                  jobId: event.id,
                  inspectionDate: event.inspectionDate,
                  inspectionTime: event.inspectionTime,
                });
              }
            : undefined
        }
        onDragOver={(e) => {
          allowCalendarDrop(e);
          e.stopPropagation();
          setDropSlot(slotTime);
        }}
        onDrop={(e) => {
          e.stopPropagation();
          handleDrop(slotTime, e);
        }}
        onClick={() => onSelectEvent(event)}
        className={cn(
          'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-shadow hover:shadow-sm',
          statusColor(event.status),
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {draggable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-text-light">{event.jobNumber}</p>
          <p className="font-semibold text-text">{event.clientName}</p>
          <p className="truncate text-xs text-text-light">{event.propertyAddress}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <TypeBadge type={event.inspectionType} />
            <StatusBadge status={event.status} />
          </div>
        </div>
      </div>
    );
  }

  function renderDraggableJobRow(job: JobRow) {
    const onThisDay = job.inspectionDate === dateKey;
    return (
      <div
        key={job.id}
        draggable
        onDragStart={(e) => {
          setCalendarDragPayload(e, {
            jobId: job.id,
            inspectionDate: job.inspectionDate,
            inspectionTime: job.inspectionTime,
          });
        }}
        className={cn(
          'flex cursor-grab items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm active:cursor-grabbing',
        )}
      >
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-text-light">{job.jobNumber}</p>
          <p className="font-semibold text-text">{job.clientName}</p>
          <p className="text-xs text-text-light">
            {onThisDay ? `Today at ${job.inspectionTime}` : `${job.inspectionDate} · ${job.inspectionTime}`}
          </p>
          <PriorityBadge priority={job.priority} />
        </div>
      </div>
    );
  }

  const otherEvents = slots.get('other') ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={formatDayTitle(dateKey)}
      description="Drag jobs into a time slot, or click an empty slot to create a new job."
      size="full"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-2">
          {CALENDAR_HOUR_SLOTS.map((slotTime) => {
            const slotEvents = slots.get(slotTime) ?? [];
            const isDropTarget = dropSlot === slotTime;
            const isEmpty = slotEvents.length === 0;

            return (
              <div
                key={slotTime}
                className={cn(
                  'grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-border/80 p-2 transition-colors',
                  isDropTarget && 'border-primary bg-primary/5',
                )}
                onDragOver={(e) => {
                  allowCalendarDrop(e);
                  setDropSlot(slotTime);
                }}
                onDragLeave={() => setDropSlot((current) => (current === slotTime ? null : current))}
                onDrop={(e) => handleDrop(slotTime, e)}
              >
                <div className="pt-2 text-right">
                  <span className="text-sm font-bold text-text">{formatHourLabel(slotTime)}</span>
                </div>
                <div className="min-h-[72px] space-y-2">
                  {slotEvents.map((event) => renderJobChip(event, slotTime, canMoveCalendarJob(event)))}
                  {isEmpty && (
                    <button
                      type="button"
                      onClick={() => openNewJob(slotTime)}
                      className="flex h-full min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background/50 text-sm text-text-light transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                      <Plus className="h-5 w-5" />
                      New job at {formatHourLabel(slotTime)}
                    </button>
                  )}
                  {!isEmpty && canMoveCalendarJob(slotEvents[0]) && (
                    <button
                      type="button"
                      onClick={() => openNewJob(slotTime)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Add another job at {formatHourLabel(slotTime)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {otherEvents.length > 0 && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="mb-2 text-xs font-bold uppercase text-text-muted">Other times</p>
              <div className="space-y-2">
                {otherEvents.map((event) =>
                  renderJobChip(event, normalizeToHourSlot(event.inspectionTime), canMoveCalendarJob(event)),
                )}
              </div>
            </div>
          )}

          {dropError && <p className="text-sm text-danger">{dropError}</p>}
          {rescheduleMutation.isPending && (
            <p className="text-sm text-text-light">Moving job…</p>
          )}
        </div>

        <aside className="space-y-3">
          <div>
            <h3 className="font-bold text-text">Drag to schedule</h3>
            <p className="text-xs text-text-light">
              Pull a job from below and drop it on any time slot. Date and time update automatically.
            </p>
          </div>
          {inProgressQuery.isLoading ? (
            <p className="text-sm text-text-light">Loading jobs…</p>
          ) : draggableJobs.length === 0 ? (
            <p className="text-sm text-text-light">No active jobs to move.</p>
          ) : (
            <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {draggableJobs.map((job) => (
                <li key={job.id}>{renderDraggableJobRow(job)}</li>
              ))}
            </ul>
          )}
          <Button variant="secondary" className="w-full" onClick={() => openNewJob('09:00')}>
            <Plus className="h-4 w-4" />
            New job this day
          </Button>
        </aside>
      </div>
    </Modal>
  );
}
