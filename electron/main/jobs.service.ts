import { randomUUID } from 'node:crypto';
import type { Database as SqlDatabase } from 'sql.js';
import type {
  CreateJobInput,
  CreateJobResult,
  DeleteJobInput,
  InspectionRecordStatus,
  InspectionType,
  JobDetail,
  JobPriority,
  JobRow,
  JobStatus,
} from '../../shared/api-types.js';
import { localDateKey } from './database.js';

function splitClientName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function mapJobRow(row: Record<string, unknown>): JobRow {
  return {
    id: String(row.id),
    jobNumber: String(row.jobNumber),
    clientName: String(row.clientName),
    mobile: String(row.mobile ?? ''),
    email: String(row.email ?? ''),
    inspectionType: row.inspectionType as InspectionType,
    inspectionDate: String(row.inspectionDate),
    inspectionTime: String(row.inspectionTime),
    propertyAddress: String(row.propertyAddress),
    status: row.status as JobStatus,
    priority: row.priority as JobPriority,
    agreementStatus: row.agreementStatus as JobRow['agreementStatus'],
    hasInvoice: Boolean(row.hasInvoice),
    hasReport: Boolean(row.hasReport),
    realEstate: row.realEstate ? String(row.realEstate) : undefined,
    agentName: row.agentName ? String(row.agentName) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

const JOB_SELECT = `
  SELECT
    j.id,
    j.job_number AS jobNumber,
    j.inspection_type AS inspectionType,
    j.inspection_date AS inspectionDate,
    j.inspection_time AS inspectionTime,
    j.property_address AS propertyAddress,
    j.status,
    j.priority,
    j.agreement_status AS agreementStatus,
    j.has_invoice AS hasInvoice,
    j.has_report AS hasReport,
    j.real_estate AS realEstate,
    j.agent_name AS agentName,
    j.notes,
    c.first_name || ' ' || c.last_name AS clientName,
    COALESCE(c.mobile, '') AS mobile,
    COALESCE(c.email, '') AS email
  FROM jobs j
  JOIN clients c ON c.id = j.client_id
  WHERE IFNULL(j.deleted_at, '') = ''
`;

function queryJobRows(db: SqlDatabase, sql: string, params: (string | number)[] = []): JobRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: JobRow[] = [];
  while (stmt.step()) {
    rows.push(mapJobRow(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return rows;
}

export function nextJobNumber(db: SqlDatabase): string {
  const year = new Date().getFullYear();
  const prefix = `JOB-${year}-`;
  const stmt = db.prepare(
    `SELECT job_number FROM jobs WHERE job_number LIKE ? ORDER BY job_number DESC LIMIT 1`,
  );
  stmt.bind([`${prefix}%`]);
  let nextSeq = 1;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { job_number: string };
    const last = row.job_number;
    const seqPart = last.slice(prefix.length);
    const parsed = Number.parseInt(seqPart, 10);
    if (!Number.isNaN(parsed)) nextSeq = parsed + 1;
  }
  stmt.free();
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

function findClientByContact(
  db: SqlDatabase,
  email: string | undefined,
  mobile: string | undefined,
) {
  if (email?.trim()) {
    const stmt = db.prepare(`SELECT id FROM clients WHERE lower(email) = lower(?) LIMIT 1`);
    stmt.bind([email.trim()]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { id: string };
      stmt.free();
      return row.id;
    }
    stmt.free();
  }

  if (mobile?.trim()) {
    const normalized = mobile.replace(/\s/g, '');
    const stmt = db.prepare(
      `SELECT id FROM clients WHERE replace(mobile, ' ', '') = ? LIMIT 1`,
    );
    stmt.bind([normalized]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { id: string };
      stmt.free();
      return row.id;
    }
    stmt.free();
  }

  return null;
}

export function createJob(db: SqlDatabase, input: CreateJobInput): CreateJobResult {
  const clientId = randomUUID();
  const jobId = randomUUID();
  const inspectionId = randomUUID();
  const jobNumber = nextJobNumber(db);

  const addressParts = [input.propertyAddress.trim()];
  if (input.propertySuburb?.trim()) {
    addressParts.push(input.propertySuburb.trim());
  }
  const fullAddress = addressParts.join(', ');

  let resolvedClientId = findClientByContact(db, input.clientEmail, input.clientMobile);

  db.run('BEGIN TRANSACTION');

  try {
    if (!resolvedClientId) {
      db.run(
        `INSERT INTO clients (id, first_name, last_name, email, mobile) VALUES (?, ?, ?, ?, ?)`,
        [
          clientId,
          input.clientFirstName.trim(),
          input.clientLastName.trim(),
          input.clientEmail?.trim() || null,
          input.clientMobile?.trim() || null,
        ],
      );
      resolvedClientId = clientId;
    } else {
      db.run(
        `UPDATE clients SET first_name = ?, last_name = ?, email = COALESCE(?, email), mobile = COALESCE(?, mobile) WHERE id = ?`,
        [
          input.clientFirstName.trim(),
          input.clientLastName.trim(),
          input.clientEmail?.trim() || null,
          input.clientMobile?.trim() || null,
          resolvedClientId,
        ],
      );
    }

    db.run(
      `INSERT INTO jobs (
         id, job_number, client_id, inspection_type, inspection_date, inspection_time,
         property_address, status, priority, agreement_status, real_estate, agent_name, notes, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, 'NONE', ?, ?, ?, NULL)`,
      [
        jobId,
        jobNumber,
        resolvedClientId,
        input.inspectionType,
        input.inspectionDate,
        input.inspectionTime,
        fullAddress,
        input.priority ?? 'NORMAL',
        input.realEstate?.trim() || null,
        input.agentName?.trim() || null,
        input.notes?.trim() || null,
      ],
    );

    db.run(
      `INSERT INTO inspections (id, job_id, status) VALUES (?, ?, 'DRAFT')`,
      [inspectionId, jobId],
    );

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  const rows = queryJobRows(db, `${JOB_SELECT} AND j.id = ?`, [jobId]);
  const job = rows[0];
  if (!job) {
    throw new Error('Failed to load created job.');
  }

  return { job, inspectionId };
}

export function listInProgressJobs(db: SqlDatabase): JobRow[] {
  return queryJobRows(
    db,
    `${JOB_SELECT}
     AND j.status IN ('NEW', 'IN_PROGRESS')
     ORDER BY j.inspection_date ASC, j.inspection_time ASC, j.job_number ASC`,
  );
}

export function listCompletedJobs(db: SqlDatabase): JobRow[] {
  return queryJobRows(
    db,
    `${JOB_SELECT}
     AND j.status = 'COMPLETED'
     ORDER BY j.updated_at DESC, j.job_number DESC`,
  );
}

export function listOutstandingInvoiceJobs(db: SqlDatabase): JobRow[] {
  return queryJobRows(
    db,
    `${JOB_SELECT}
     AND j.has_invoice = 1
     AND j.status != 'ARCHIVED'
     ORDER BY j.inspection_date DESC, j.inspection_time DESC, j.job_number DESC`,
  );
}

export function getJobDetail(db: SqlDatabase, jobId: string): JobDetail | null {
  const stmt = db.prepare(
    `${JOB_SELECT}
     AND j.id = ?
     LIMIT 1`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const base = mapJobRow(stmt.getAsObject() as Record<string, unknown>);
  stmt.free();

  const metaStmt = db.prepare(
    `SELECT
       j.client_id AS clientId,
       j.created_at AS createdAt,
       j.updated_at AS updatedAt,
       i.id AS inspectionId,
       i.status AS inspectionStatus
     FROM jobs j
     JOIN inspections i ON i.job_id = j.id
     WHERE j.id = ? AND IFNULL(j.deleted_at, '') = ''`,
  );
  metaStmt.bind([jobId]);
  if (!metaStmt.step()) {
    metaStmt.free();
    return null;
  }
  const meta = metaStmt.getAsObject() as {
    clientId: string;
    createdAt: string;
    updatedAt: string;
    inspectionId: string;
    inspectionStatus: InspectionRecordStatus;
  };
  metaStmt.free();

  return {
    ...base,
    clientId: meta.clientId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    inspectionId: meta.inspectionId,
    inspectionStatus: meta.inspectionStatus,
  };
}

export function softDeleteJob(db: SqlDatabase, jobId: string, input: DeleteJobInput) {
  const existing = db.prepare(
    `SELECT id FROM jobs WHERE id = ? AND IFNULL(deleted_at, '') = '' LIMIT 1`,
  );
  existing.bind([jobId]);
  if (!existing.step()) {
    existing.free();
    throw new Error('Job not found or already in the recycle bin.');
  }
  existing.free();

  db.run(
    `UPDATE jobs SET
       deleted_at = datetime('now'),
       updated_at = datetime('now'),
       cancel_reason = ?,
       cancel_notes = ?
     WHERE id = ?`,
    [input.reason, input.notes?.trim() || null, jobId],
  );
}

const DELETED_JOB_SELECT = `
  SELECT
    j.id,
    j.job_number AS jobNumber,
    j.inspection_type AS inspectionType,
    j.inspection_date AS inspectionDate,
    j.inspection_time AS inspectionTime,
    j.property_address AS propertyAddress,
    j.status,
    j.priority,
    j.agreement_status AS agreementStatus,
    j.has_invoice AS hasInvoice,
    j.has_report AS hasReport,
    j.real_estate AS realEstate,
    j.agent_name AS agentName,
    j.notes,
    j.deleted_at AS deletedAt,
    j.cancel_reason AS cancelReason,
    j.cancel_notes AS cancelNotes,
    c.first_name || ' ' || c.last_name AS clientName,
    COALESCE(c.mobile, '') AS mobile,
    COALESCE(c.email, '') AS email
  FROM jobs j
  JOIN clients c ON c.id = j.client_id
  WHERE IFNULL(j.deleted_at, '') != ''
`;

export function listDeletedJobs(db: SqlDatabase): Array<
  JobRow & {
    deletedAt: string;
    cancelReason: string | null;
    cancelNotes: string | null;
  }
> {
  const stmt = db.prepare(
    `${DELETED_JOB_SELECT}
     ORDER BY j.deleted_at DESC, j.job_number DESC`,
  );
  const rows: Array<
    JobRow & {
      deletedAt: string;
      cancelReason: string | null;
      cancelNotes: string | null;
    }
  > = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      ...mapJobRow(row),
      deletedAt: String(row.deletedAt),
      cancelReason: row.cancelReason ? String(row.cancelReason) : null,
      cancelNotes: row.cancelNotes ? String(row.cancelNotes) : null,
    });
  }
  stmt.free();
  return rows;
}

export function restoreJob(db: SqlDatabase, jobId: string) {
  const stmt = db.prepare(
    `SELECT id FROM jobs WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Deleted job not found in the recycle bin.');
  }
  stmt.free();

  db.run(
    `UPDATE jobs SET
       deleted_at = NULL,
       cancel_reason = NULL,
       cancel_notes = NULL,
       updated_at = datetime('now')
     WHERE id = ?`,
    [jobId],
  );
}

export function permanentlyDeleteJob(db: SqlDatabase, jobId: string) {
  const stmt = db.prepare(
    `SELECT id FROM jobs WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Deleted job not found in the recycle bin.');
  }
  stmt.free();

  const inspectionStmt = db.prepare(`SELECT id FROM inspections WHERE job_id = ?`);
  inspectionStmt.bind([jobId]);
  const inspectionIds: string[] = [];
  while (inspectionStmt.step()) {
    inspectionIds.push(String((inspectionStmt.getAsObject() as { id: string }).id));
  }
  inspectionStmt.free();

  for (const inspectionId of inspectionIds) {
    db.run(`DELETE FROM inspection_rooms WHERE inspection_id = ?`, [inspectionId]);
  }
  db.run(`DELETE FROM inspection_reports WHERE job_id = ?`, [jobId]);
  db.run(`DELETE FROM inspections WHERE job_id = ?`, [jobId]);
  db.run(`UPDATE agreements SET job_id = NULL, updated_at = datetime('now') WHERE job_id = ?`, [jobId]);
  db.run(`DELETE FROM jobs WHERE id = ?`, [jobId]);
}

export function startJob(db: SqlDatabase, jobId: string) {
  db.run(`UPDATE jobs SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE id = ?`, [jobId]);
  db.run(
    `UPDATE inspections SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE job_id = ?`,
    [jobId],
  );
}

export { splitClientName, localDateKey };
