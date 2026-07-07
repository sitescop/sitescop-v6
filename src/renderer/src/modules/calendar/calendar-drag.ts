import type { DragEvent } from 'react';
import { CALENDAR_DRAG_TYPE } from '@/modules/calendar/calendar-hours';

export interface CalendarDragPayload {
  jobId: string;
  inspectionDate: string;
  inspectionTime: string;
}

export function setCalendarDragPayload(event: DragEvent, payload: CalendarDragPayload) {
  event.dataTransfer.setData(CALENDAR_DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

export function readCalendarDragPayload(event: DragEvent): CalendarDragPayload | null {
  const raw = event.dataTransfer.getData(CALENDAR_DRAG_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CalendarDragPayload;
    if (parsed?.jobId && parsed?.inspectionDate && parsed?.inspectionTime) {
      return parsed;
    }
  } catch {
    // legacy: plain job id string
    if (raw.length > 0) {
      return { jobId: raw, inspectionDate: '', inspectionTime: '09:00' };
    }
  }
  return null;
}

export function allowCalendarDrop(event: DragEvent) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}
