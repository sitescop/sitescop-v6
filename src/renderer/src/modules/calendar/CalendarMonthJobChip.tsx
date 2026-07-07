import type { DragEvent } from 'react';
import type { CalendarEvent } from '@shared/api-types';
import { cn } from '@/lib/cn';
import { setCalendarDragPayload, allowCalendarDrop } from '@/modules/calendar/calendar-drag';
import { canMoveCalendarJob } from '@/modules/calendar/calendar-move';

interface CalendarMonthJobChipProps {
  event: CalendarEvent;
  dayKey: string;
  statusClassName: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onDayDragOver: (dayKey: string) => void;
  onDayDrop: (dayKey: string, e: DragEvent) => void;
}

export function CalendarMonthJobChip({
  event,
  dayKey,
  statusClassName,
  isDragging,
  onDragStart,
  onDragEnd,
  onSelect,
  onDayDragOver,
  onDayDrop,
}: CalendarMonthJobChipProps) {
  const movable = canMoveCalendarJob(event);

  function handleDragOver(e: DragEvent) {
    allowCalendarDrop(e);
    e.stopPropagation();
    onDayDragOver(dayKey);
  }

  function handleDrop(e: DragEvent) {
    e.stopPropagation();
    onDayDrop(dayKey, e);
  }

  return (
    <div
      draggable={movable}
      title={movable ? 'Drag to another day' : 'Completed jobs cannot be moved'}
      onDragStart={(e) => {
        if (!movable) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        onDragStart();
        setCalendarDragPayload(e, {
          jobId: event.id,
          inspectionDate: event.inspectionDate,
          inspectionTime: event.inspectionTime,
        });
      }}
      onDragEnd={() => onDragEnd()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'block w-full rounded border-l-2 px-1 py-0.5 text-left text-[10px] leading-tight',
        statusClassName,
        movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-80',
        isDragging && movable && 'opacity-40',
      )}
    >
      <span className="font-semibold">{event.inspectionTime}</span> {event.clientName.split(' ')[0]}
    </div>
  );
}
