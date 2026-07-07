import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '@shared/api-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { localDateKey, formatDisplayDate } from '@/lib/dates';
import { Button, Card, Input, Modal } from '@/design-system/components';
import { PriorityBadge, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { CalendarDayView } from '@/modules/calendar/CalendarDayView';
import { CalendarMonthJobChip } from '@/modules/calendar/CalendarMonthJobChip';
import { canMoveCalendarJob, jobRowToCalendarEvent } from '@/modules/calendar/calendar-move';
import {
  allowCalendarDrop,
  readCalendarDragPayload,
  setCalendarDragPayload,
} from '@/modules/calendar/calendar-drag';
import { cn } from '@/lib/cn';
import { useJobDelete } from '@/modules/jobs/hooks/useJobDelete';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  });
}

function statusColor(status: CalendarEvent['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'border-l-success bg-success/10';
    case 'IN_PROGRESS':
      return 'border-l-accent bg-accent/10';
    default:
      return 'border-l-primary bg-primary/10';
  }
}

export function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const showUpcoming = searchParams.get('view') === 'upcoming';

  const today = new Date();
  const todayKey = localDateKey(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [dropTargetDay, setDropTargetDay] = useState<string | null>(null);
  const [moveDayError, setMoveDayError] = useState('');
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const skipDayClickRef = useRef(false);

  const { requestDelete, deleteDialog } = useJobDelete({
    onSuccess: () => {
      setSelectedEvent(null);
      invalidateCalendar();
    },
  });

  function clearDragState() {
    setDraggingJobId(null);
    setDropTargetDay(null);
  }

  useEffect(() => {
    function handleGlobalDragEnd() {
      clearDragState();
    }
    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  const gridDays = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const range = useMemo(() => {
    const start = gridDays[0]!;
    const end = gridDays[gridDays.length - 1]!;
    return { start: localDateKey(start), end: localDateKey(end) };
  }, [gridDays]);

  const eventsQuery = useQuery({
    queryKey: ['calendar-events', range.start, range.end],
    queryFn: () => getSitescopApi().calendar.listEvents(range.start, range.end),
    refetchOnMount: 'always',
    enabled: !showUpcoming,
  });

  const upcomingQuery = useQuery({
    queryKey: ['calendar-upcoming'],
    queryFn: () => getSitescopApi().calendar.listUpcoming(),
    enabled: showUpcoming,
  });

  const inProgressQuery = useQuery({
    queryKey: ['jobs-in-progress'],
    queryFn: () => getSitescopApi().jobs.listInProgress(),
    enabled: !showUpcoming,
  });

  const events = showUpcoming ? (upcomingQuery.data ?? []) : (eventsQuery.data ?? []);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.inspectionDate) ?? [];
      list.push(event);
      map.set(event.inspectionDate, list);
    }
    return map;
  }, [events]);

  const dayViewEvents = selectedDay ? (eventsByDate.get(selectedDay) ?? []) : [];

  const eventsById = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const event of events) {
      map.set(event.id, event);
    }
    for (const job of inProgressQuery.data ?? []) {
      if (!map.has(job.id)) {
        map.set(job.id, jobRowToCalendarEvent(job));
      }
    }
    return map;
  }, [events, inProgressQuery.data]);

  const movableJobs = useMemo(
    () => (inProgressQuery.data ?? []).filter((job) => canMoveCalendarJob(job)),
    [inProgressQuery.data],
  );

  function invalidateCalendar() {
    void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    void queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
    void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
  }

  const moveDayMutation = useMutation({
    mutationFn: ({ jobId, targetDate, time }: { jobId: string; targetDate: string; time: string }) =>
      getSitescopApi().calendar.reschedule(jobId, {
        inspectionDate: targetDate,
        inspectionTime: time,
      }),
    onMutate: () => {
      clearDragState();
    },
    onSuccess: () => {
      setMoveDayError('');
      clearDragState();
      invalidateCalendar();
    },
    onError: (error) => {
      clearDragState();
      setMoveDayError(error instanceof Error ? error.message : 'Could not move job.');
    },
    onSettled: () => {
      clearDragState();
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      getSitescopApi().calendar.reschedule(selectedEvent!.id, {
        inspectionDate: rescheduleDate,
        inspectionTime: rescheduleTime,
      }),
    onSuccess: () => {
      setSelectedEvent(null);
      setRescheduleError('');
      invalidateCalendar();
    },
    onError: (error) => {
      setRescheduleError(error instanceof Error ? error.message : 'Could not reschedule.');
    },
  });

  function openEvent(event: CalendarEvent) {
    setSelectedEvent(event);
    setRescheduleDate(event.inspectionDate);
    setRescheduleTime(event.inspectionTime);
    setRescheduleError('');
  }

  function openDay(dateKey: string) {
    setSelectedDay(dateKey);
  }

  function handleDayCellClick(dateKey: string) {
    if (skipDayClickRef.current) {
      skipDayClickRef.current = false;
      return;
    }
    openDay(dateKey);
  }

  function handleDayDrop(targetDate: string, event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    skipDayClickRef.current = true;
    clearDragState();

    const payload = readCalendarDragPayload(event);
    if (!payload) return;

    const known = eventsById.get(payload.jobId);
    const time = known?.inspectionTime ?? payload.inspectionTime;
    const sourceDate = known?.inspectionDate ?? payload.inspectionDate;

    if (known && !canMoveCalendarJob(known)) return;
    if (sourceDate === targetDate) return;

    moveDayMutation.mutate({ jobId: payload.jobId, targetDate, time });
  }

  function handleRequestDelete() {
    if (!selectedEvent) return;
    const target = {
      id: selectedEvent.id,
      jobNumber: selectedEvent.jobNumber,
      clientName: selectedEvent.clientName,
    };
    setSelectedEvent(null);
    requestDelete(target);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    openDay(todayKey);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Inspection calendar</p>
            <p className="text-sm text-text-light">
              {showUpcoming
                ? 'Upcoming scheduled inspections'
                : `${monthLabel(year, month)} — drag active jobs between days (completed jobs are fixed)`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showUpcoming ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setSearchParams(showUpcoming ? {} : { view: 'upcoming' })}
          >
            Upcoming
          </Button>
          {!showUpcoming && (
            <>
              <Button variant="secondary" size="sm" onClick={goToday}>
                Today
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const d = new Date(year, month - 1, 1);
                  setYear(d.getFullYear());
                  setMonth(d.getMonth());
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const d = new Date(year, month + 1, 1);
                  setYear(d.getFullYear());
                  setMonth(d.getMonth());
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {showUpcoming ? (
        upcomingQuery.isLoading ? (
          <p className="text-text-light">Loading upcoming inspections...</p>
        ) : events.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-lg font-medium text-text">No upcoming inspections</p>
            <p className="mt-2 text-sm text-text-light">Create a new job to schedule one.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id}>
                <Card
                  className={cn('cursor-pointer border-l-4 p-4 transition-colors hover:bg-background/80', statusColor(event.status))}
                  onClick={() => openEvent(event)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-text-light">{event.jobNumber}</p>
                      <p className="font-semibold text-text">{event.clientName}</p>
                      <p className="text-sm text-text-light">
                        {formatDisplayDate(event.inspectionDate)} at {event.inspectionTime}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : eventsQuery.isLoading ? (
        <p className="text-text-light">Loading calendar...</p>
      ) : (
        <>
          {moveDayError && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {moveDayError}
            </div>
          )}
          {moveDayMutation.isPending && (
            <p className="mb-4 text-sm text-text-light">Moving job to new day…</p>
          )}
        <Card className="overflow-hidden p-4">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-bold uppercase text-text-muted">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((day) => {
              const key = localDateKey(day);
              const inMonth = day.getMonth() === month;
              const isToday = key === todayKey;
              const dayEvents = eventsByDate.get(key) ?? [];

              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    allowCalendarDrop(e);
                    setDropTargetDay(key);
                  }}
                  onDragLeave={() => {
                    setDropTargetDay((current) => (current === key ? null : current));
                  }}
                  onDrop={(e) => handleDayDrop(key, e)}
                  className={cn(
                    'flex min-h-28 flex-col rounded-md border border-border/60 p-1.5 text-left transition-colors',
                    inMonth ? 'bg-surface' : 'bg-background/50',
                    isToday && 'ring-2 ring-primary/40',
                    dropTargetDay === key && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      'mb-1 w-full text-left text-xs font-semibold hover:text-primary',
                      inMonth ? 'text-text' : 'text-text-muted',
                      isToday && 'text-primary',
                    )}
                    onClick={() => handleDayCellClick(key)}
                  >
                    {day.getDate()}
                  </button>
                  <ul className="max-h-32 flex-1 space-y-1 overflow-y-auto">
                    {dayEvents.map((event) => (
                      <li key={event.id}>
                        <CalendarMonthJobChip
                          event={event}
                          dayKey={key}
                          statusClassName={statusColor(event.status)}
                          isDragging={draggingJobId === event.id}
                          onDragStart={() => setDraggingJobId(event.id)}
                          onDragEnd={clearDragState}
                          onSelect={() => openEvent(event)}
                          onDayDragOver={setDropTargetDay}
                          onDayDrop={handleDayDrop}
                        />
                      </li>
                    ))}
                    {draggingJobId && dayEvents.length === 0 && (
                      <li
                        aria-hidden
                        className="pointer-events-none rounded border border-dashed border-primary/40 px-1 py-2 text-center text-[10px] text-primary/70"
                      >
                        Drop here
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        {!showUpcoming && movableJobs.length > 0 && (
          <Card className="mt-4 p-4">
            <h3 className="font-bold text-text">All active jobs — drag onto any day above</h3>
            <p className="mb-3 text-xs text-text-light">
              Use this list if a job is not visible on the month grid, or to move jobs from other weeks.
            </p>
            <ul className="flex flex-wrap gap-2">
              {movableJobs.map((job) => (
                <li key={job.id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDraggingJobId(job.id);
                      setCalendarDragPayload(e, {
                        jobId: job.id,
                        inspectionDate: job.inspectionDate,
                        inspectionTime: job.inspectionTime,
                      });
                    }}
                    onDragEnd={clearDragState}
                    className={cn(
                      'cursor-grab rounded-md border border-border bg-background px-3 py-2 text-sm active:cursor-grabbing',
                      draggingJobId === job.id && 'opacity-40',
                    )}
                  >
                    <span className="font-mono text-xs text-text-light">{job.jobNumber}</span>
                    <span className="ml-2 font-medium">{job.clientName}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      {job.inspectionDate} {job.inspectionTime}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        </>
      )}

      {selectedDay && (
        <CalendarDayView
          dateKey={selectedDay}
          dayEvents={dayViewEvents}
          open={Boolean(selectedDay)}
          onClose={() => setSelectedDay(null)}
          onSelectEvent={openEvent}
        />
      )}

      <Modal
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.jobNumber ?? 'Inspection'}
        description={selectedEvent ? `${selectedEvent.clientName} — ${selectedEvent.propertyAddress}` : undefined}
        footer={
          selectedEvent && (
            <>
              <Button variant="secondary" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
              <Button
                variant="secondary"
                className="border-danger/30 text-danger hover:bg-danger/10"
                onClick={handleRequestDelete}
              >
                <Trash2 className="h-4 w-4" />
                Remove job
              </Button>
              <Button variant="accent" onClick={() => navigate(`/jobs/${selectedEvent.id}`)}>
                <ExternalLink className="h-4 w-4" />
                Open job
              </Button>
              {selectedEvent.status !== 'COMPLETED' && (
                <Button
                  onClick={() => rescheduleMutation.mutate()}
                  disabled={rescheduleMutation.isPending}
                >
                  {rescheduleMutation.isPending ? 'Saving…' : 'Save new date/time'}
                </Button>
              )}
            </>
          )
        }
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TypeBadge type={selectedEvent.inspectionType} />
              <StatusBadge status={selectedEvent.status} />
              <PriorityBadge priority={selectedEvent.priority} />
            </div>
            {selectedEvent.status !== 'COMPLETED' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Inspection date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
                <Input
                  label="Inspection time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-text-light">
                {formatDisplayDate(selectedEvent.inspectionDate)} at {selectedEvent.inspectionTime}
              </p>
            )}
            {rescheduleError && (
              <p className="text-sm text-danger">{rescheduleError}</p>
            )}
          </div>
        )}
      </Modal>

      {deleteDialog}
    </div>
  );
}
