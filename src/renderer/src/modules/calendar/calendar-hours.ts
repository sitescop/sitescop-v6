import type { CalendarEvent } from '@shared/api-types';

export const CALENDAR_HOUR_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
] as const;

export type CalendarHourSlot = (typeof CALENDAR_HOUR_SLOTS)[number];

export const CALENDAR_DRAG_TYPE = 'application/x-sitescop-job-id';

export function formatHourLabel(time24: string): string {
  const hour = Number.parseInt(time24.split(':')[0] ?? '0', 10);
  if (hour === 12) return '12 pm';
  if (hour < 12) return `${hour} am`;
  return `${hour - 12} pm`;
}

export function normalizeToHourSlot(time: string): string {
  const hour = Number.parseInt(time.split(':')[0] ?? '0', 10);
  return `${String(hour).padStart(2, '0')}:00`;
}

export function isCalendarHourSlot(time: string): time is CalendarHourSlot {
  return (CALENDAR_HOUR_SLOTS as readonly string[]).includes(time);
}

export function groupEventsByHourSlot(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const slot of CALENDAR_HOUR_SLOTS) {
    map.set(slot, []);
  }
  const other: CalendarEvent[] = [];

  for (const event of events) {
    const slot = normalizeToHourSlot(event.inspectionTime);
    if (map.has(slot)) {
      map.get(slot)!.push(event);
    } else {
      other.push(event);
    }
  }

  if (other.length) {
    map.set('other', other);
  }

  return map;
}

export function formatDayTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
