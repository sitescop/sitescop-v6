import type { Database as SqlDatabase } from 'sql.js';
import type { CalendarEvent, RescheduleJobInput } from '../../shared/api-types.js';

function mapCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    jobNumber: String(row.jobNumber),
    clientName: String(row.clientName),
    propertyAddress: String(row.propertyAddress),
    inspectionType: row.inspectionType as CalendarEvent['inspectionType'],
    inspectionDate: String(row.inspectionDate),
    inspectionTime: String(row.inspectionTime),
    status: row.status as CalendarEvent['status'],
    priority: row.priority as CalendarEvent['priority'],
  };
}

const CALENDAR_SELECT = `
  SELECT
    j.id,
    j.job_number AS jobNumber,
    j.inspection_type AS inspectionType,
    j.inspection_date AS inspectionDate,
    j.inspection_time AS inspectionTime,
    j.property_address AS propertyAddress,
    j.status,
    j.priority,
    c.first_name || ' ' || c.last_name AS clientName
  FROM jobs j
  JOIN clients c ON c.id = j.client_id
  WHERE IFNULL(j.deleted_at, '') = ''
    AND j.status != 'ARCHIVED'
`;

export function listCalendarEvents(
  db: SqlDatabase,
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  const stmt = db.prepare(
    `${CALENDAR_SELECT}
     AND j.inspection_date >= ?
     AND j.inspection_date <= ?
     ORDER BY j.inspection_date ASC, j.inspection_time ASC, j.job_number ASC`,
  );
  stmt.bind([startDate, endDate]);
  const rows: CalendarEvent[] = [];
  while (stmt.step()) {
    rows.push(mapCalendarEvent(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return rows;
}

export function listUpcomingJobs(db: SqlDatabase, fromDate: string): CalendarEvent[] {
  const stmt = db.prepare(
    `${CALENDAR_SELECT}
     AND j.inspection_date > ?
     AND j.status IN ('NEW', 'IN_PROGRESS')
     ORDER BY j.inspection_date ASC, j.inspection_time ASC`,
  );
  stmt.bind([fromDate]);
  const rows: CalendarEvent[] = [];
  while (stmt.step()) {
    rows.push(mapCalendarEvent(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return rows;
}

export function rescheduleJob(db: SqlDatabase, jobId: string, input: RescheduleJobInput): CalendarEvent {
  if (!input.inspectionDate?.trim()) {
    throw new Error('Inspection date is required.');
  }
  if (!input.inspectionTime?.trim()) {
    throw new Error('Inspection time is required.');
  }

  db.run(
    `UPDATE jobs SET
       inspection_date = ?,
       inspection_time = ?,
       updated_at = datetime('now')
     WHERE id = ? AND IFNULL(deleted_at, '') = ''`,
    [input.inspectionDate.trim(), input.inspectionTime.trim(), jobId],
  );

  const stmt = db.prepare(`${CALENDAR_SELECT} AND j.id = ? LIMIT 1`);
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Job not found.');
  }
  const row = mapCalendarEvent(stmt.getAsObject() as Record<string, unknown>);
  stmt.free();
  return row;
}
