import type { CalendarEvent, JobRow } from '@shared/api-types';

export function canMoveCalendarJob(job: { status: CalendarEvent['status'] }) {
  return job.status === 'NEW' || job.status === 'IN_PROGRESS';
}

export function jobRowToCalendarEvent(job: JobRow): CalendarEvent {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    clientName: job.clientName,
    propertyAddress: job.propertyAddress,
    inspectionType: job.inspectionType,
    inspectionDate: job.inspectionDate,
    inspectionTime: job.inspectionTime,
    status: job.status,
    priority: job.priority,
  };
}
