import type { Database as SqlDatabase } from 'sql.js';
import type {
  AccountingJobRow,
  AccountingSummary,
  ClientAccountingRow,
  InspectionType,
  JobPriority,
  JobRow,
  JobStatus,
} from '../../shared/api-types.js';
import { localDateKey } from './database.js';

const OVERDUE_DAYS = 7;

function weekStartKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

function monthStartKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function scalar(db: SqlDatabase, sql: string, params: (string | number)[] = []): number {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  const value = stmt.get()[0];
  stmt.free();
  return Number(value ?? 0);
}

function signedAtExpression(): string {
  return `COALESCE(
    (
      SELECT date(a.signed_at)
      FROM agreements a
      WHERE a.job_id = j.id
        AND a.status = 'SIGNED'
        AND IFNULL(a.deleted_at, '') = ''
      AND IFNULL(a.archived_at, '') = ''
      ORDER BY a.updated_at DESC
      LIMIT 1
    ),
    j.inspection_date
  )`;
}

function agreementTotalExpression(): string {
  return `(
    SELECT a.total_cents
    FROM agreements a
    WHERE a.job_id = j.id
      AND a.status = 'SIGNED'
      AND IFNULL(a.deleted_at, '') = ''
      AND IFNULL(a.archived_at, '') = ''
    ORDER BY a.updated_at DESC
    LIMIT 1
  )`;
}

function awaitingJobWhere(): string {
  return `
    j.agreement_status = 'SIGNED'
    AND j.payment_received = 0
    AND j.status != 'ARCHIVED'
    AND IFNULL(j.deleted_at, '') = ''
  `;
}

function truthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function mapAccountingJobRow(row: Record<string, unknown>): AccountingJobRow {
  const paymentValue = row.paymentReceived ?? row.payment_received;
  const totalRaw = row.totalCents ?? row.total_cents;
  return {
    id: String(row.id),
    clientId: String(row.clientId),
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
    hasInvoice: truthyFlag(row.hasInvoice ?? row.has_invoice),
    hasReport: truthyFlag(row.hasReport ?? row.has_report),
    paymentReceived: truthyFlag(paymentValue),
    paidAt: (row.paidAt ?? row.paid_at) ? String(row.paidAt ?? row.paid_at) : undefined,
    totalCents: totalRaw == null || totalRaw === '' ? null : Number(totalRaw),
    signedAt: (row.signedAt ?? row.signed_at) ? String(row.signedAt ?? row.signed_at) : null,
    xeroInvoiceId: row.xeroInvoiceId ? String(row.xeroInvoiceId) : null,
  };
}

const ACCOUNTING_JOB_SELECT = `
  SELECT
    j.id,
    j.client_id AS clientId,
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
    j.payment_received AS paymentReceived,
    j.paid_at AS paidAt,
    j.xero_invoice_id AS xeroInvoiceId,
    c.first_name || ' ' || c.last_name AS clientName,
    COALESCE(c.mobile, '') AS mobile,
    COALESCE(c.email, '') AS email,
    (
      SELECT a.total_cents
      FROM agreements a
      WHERE a.job_id = j.id
        AND a.status = 'SIGNED'
        AND IFNULL(a.deleted_at, '') = ''
      AND IFNULL(a.archived_at, '') = ''
      ORDER BY a.updated_at DESC
      LIMIT 1
    ) AS totalCents,
    (
      SELECT a.signed_at
      FROM agreements a
      WHERE a.job_id = j.id
        AND a.status = 'SIGNED'
        AND IFNULL(a.deleted_at, '') = ''
      AND IFNULL(a.archived_at, '') = ''
      ORDER BY a.updated_at DESC
      LIMIT 1
    ) AS signedAt
  FROM jobs j
  JOIN clients c ON c.id = j.client_id
  WHERE IFNULL(j.deleted_at, '') = ''
`;

function queryAccountingJobs(
  db: SqlDatabase,
  sql: string,
  params: (string | number)[] = [],
): AccountingJobRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: AccountingJobRow[] = [];
  while (stmt.step()) {
    rows.push(mapAccountingJobRow(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return rows;
}

export function getAccountingSummary(db: SqlDatabase): AccountingSummary {
  const today = localDateKey();
  const weekStart = weekStartKey();
  const monthStart = monthStartKey();
  const signedAt = signedAtExpression();
  const agreementTotal = agreementTotalExpression();

  const revenueThisWeekCents = scalar(
    db,
    `
    SELECT COALESCE(SUM(${agreementTotal}), 0)
    FROM jobs j
    WHERE j.payment_received = 1
      AND j.agreement_status = 'SIGNED'
      AND j.status != 'ARCHIVED'
      AND IFNULL(j.deleted_at, '') = ''
      AND date(j.paid_at) >= ?
      AND date(j.paid_at) <= ?
    `,
    [weekStart, today],
  );

  const revenueThisMonthCents = scalar(
    db,
    `
    SELECT COALESCE(SUM(${agreementTotal}), 0)
    FROM jobs j
    WHERE j.payment_received = 1
      AND j.agreement_status = 'SIGNED'
      AND j.status != 'ARCHIVED'
      AND IFNULL(j.deleted_at, '') = ''
      AND date(j.paid_at) >= ?
      AND date(j.paid_at) <= ?
    `,
    [monthStart, today],
  );

  const overdueJobCount = scalar(
    db,
    `
    SELECT COUNT(*)
    FROM jobs j
    WHERE ${awaitingJobWhere()}
      AND julianday(?) - julianday(${signedAt}) >= ?
    `,
    [today, OVERDUE_DAYS],
  );

  const overdueAmountCents = scalar(
    db,
    `
    SELECT COALESCE(SUM(${agreementTotal}), 0)
    FROM jobs j
    WHERE ${awaitingJobWhere()}
      AND julianday(?) - julianday(${signedAt}) >= ?
    `,
    [today, OVERDUE_DAYS],
  );

  const readyToSendCount = scalar(
    db,
    `
    SELECT COUNT(*)
    FROM jobs j
    WHERE ${awaitingJobWhere()}
      AND j.has_report = 1
    `,
  );

  return {
    revenueThisWeekCents,
    revenueThisMonthCents,
    overdueJobCount,
    overdueAmountCents,
    readyToSendCount,
  };
}

export function listAwaitingPaymentJobs(db: SqlDatabase): AccountingJobRow[] {
  return queryAccountingJobs(
    db,
    `${ACCOUNTING_JOB_SELECT}
     AND j.agreement_status = 'SIGNED'
     AND j.payment_received = 0
     AND j.status != 'ARCHIVED'
     ORDER BY j.inspection_date DESC, j.inspection_time DESC, j.job_number DESC`,
  );
}

export function listPaidJobs(db: SqlDatabase): AccountingJobRow[] {
  return queryAccountingJobs(
    db,
    `${ACCOUNTING_JOB_SELECT}
     AND j.agreement_status = 'SIGNED'
     AND j.payment_received = 1
     AND j.status != 'ARCHIVED'
     ORDER BY j.paid_at DESC, j.inspection_date DESC, j.job_number DESC`,
  );
}

export function listAccountingByClient(db: SqlDatabase): ClientAccountingRow[] {
  const stmt = db.prepare(
    `
    SELECT
      c.id AS clientId,
      c.first_name || ' ' || c.last_name AS clientName,
      SUM(
        CASE
          WHEN j.agreement_status = 'SIGNED' AND j.payment_received = 0 THEN 1
          ELSE 0
        END
      ) AS unpaidJobCount,
      SUM(
        CASE
          WHEN j.agreement_status = 'SIGNED' AND j.payment_received = 1 THEN 1
          ELSE 0
        END
      ) AS paidJobCount,
      COALESCE(
        SUM(
          CASE
            WHEN j.agreement_status = 'SIGNED' AND j.payment_received = 0 THEN (
              SELECT a.total_cents
              FROM agreements a
              WHERE a.job_id = j.id
                AND a.status = 'SIGNED'
                AND IFNULL(a.deleted_at, '') = ''
      AND IFNULL(a.archived_at, '') = ''
              ORDER BY a.updated_at DESC
              LIMIT 1
            )
            ELSE 0
          END
        ),
        0
      ) AS amountOwedCents,
      COALESCE(
        SUM(
          CASE
            WHEN j.agreement_status = 'SIGNED' AND j.payment_received = 1 THEN (
              SELECT a.total_cents
              FROM agreements a
              WHERE a.job_id = j.id
                AND a.status = 'SIGNED'
                AND IFNULL(a.deleted_at, '') = ''
      AND IFNULL(a.archived_at, '') = ''
              ORDER BY a.updated_at DESC
              LIMIT 1
            )
            ELSE 0
          END
        ),
        0
      ) AS amountPaidCents
    FROM clients c
    INNER JOIN jobs j ON j.client_id = c.id AND IFNULL(j.deleted_at, '') = ''
    GROUP BY c.id
    HAVING unpaidJobCount > 0 OR paidJobCount > 0
    ORDER BY amountOwedCents DESC, lower(c.last_name), lower(c.first_name)
    `,
  );

  const rows: ClientAccountingRow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      clientId: String(row.clientId),
      clientName: String(row.clientName).trim(),
      unpaidJobCount: Number(row.unpaidJobCount ?? 0),
      paidJobCount: Number(row.paidJobCount ?? 0),
      amountOwedCents: Number(row.amountOwedCents ?? 0),
      amountPaidCents: Number(row.amountPaidCents ?? 0),
    });
  }
  stmt.free();
  return rows;
}
