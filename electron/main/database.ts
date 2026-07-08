import type { SqlValue } from 'sql.js';
import initSqlJs, { type Database as SqlDatabase } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  DashboardSummary,
  InspectionType,
  JobPriority,
  JobStatus,
  SessionUser,
  TodayJobRow,
} from '../../shared/api-types.js';

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  BUILDING: 'Building',
  PEST: 'Pest',
  COMBINED: 'Building & Pest',
};

export interface LocalDatabase {
  db: SqlDatabase;
  persist: () => void;
}

function resolveSqlWasmPath(): string {
  const candidates = [
    join(process.resourcesPath, 'sql-wasm.wasm'),
    join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[1];
}

export async function openDatabase(dbPath: string): Promise<LocalDatabase> {
  mkdirSync(dirname(dbPath), { recursive: true });

  const wasmPath = resolveSqlWasmPath();
  const wasmBinary = readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });

  const db = existsSync(dbPath)
    ? new SQL.Database(new Uint8Array(readFileSync(dbPath)))
    : new SQL.Database();

  migrate(db);

  return {
    db,
    persist: () => {
      const data = db.export();
      writeFileSync(dbPath, Buffer.from(data));
    },
  };
}

function migrate(db: SqlDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      mobile TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      inspection_type TEXT NOT NULL,
      inspection_date TEXT NOT NULL,
      inspection_time TEXT NOT NULL,
      property_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      agreement_status TEXT NOT NULL DEFAULT 'NONE',
      has_invoice INTEGER NOT NULL DEFAULT 0,
      has_report INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      real_estate TEXT,
      agent_name TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      form_data TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      inspection_number TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_rooms (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      room_type TEXT NOT NULL,
      room_index INTEGER NOT NULL,
      label TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_reports (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      inspection_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agreements (
      id TEXT PRIMARY KEY,
      agreement_number TEXT NOT NULL UNIQUE,
      job_id TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      inspection_type TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT,
      property_address TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      gst_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL DEFAULT 0,
      agreement_date TEXT NOT NULL,
      notes TEXT,
      legal_sections TEXT NOT NULL DEFAULT '{"sections":[]}',
      access_token TEXT UNIQUE,
      sent_at TEXT,
      viewed_at TEXT,
      signed_at TEXT,
      cancelled_at TEXT,
      signature_name TEXT,
      signature_data TEXT,
      pdf_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  ensureInspectionColumns(db);

  ensureJobColumns(db);
  ensureAgreementColumns(db);
  ensureUserColumns(db);
  backfillInspections(db);
  backfillCompletedJobInspections(db);

  db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_inspection_date ON jobs(inspection_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_deleted ON jobs(deleted_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_rooms_inspection ON inspection_rooms(inspection_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_reports_job ON inspection_reports(job_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agreements_job ON agreements(job_id)`);
}

function columnExists(db: SqlDatabase, table: string, column: string): boolean {
  const result = db.exec(`PRAGMA table_info(${table})`);
  const columns = result[0]?.values.map((row: SqlValue[]) => String(row[1])) ?? [];
  return columns.includes(column);
}

function ensureInspectionColumns(db: SqlDatabase) {
  const alters: Array<[string, string]> = [
    ['form_data', 'TEXT'],
    ['progress_percent', 'INTEGER NOT NULL DEFAULT 0'],
    ['inspection_number', 'TEXT'],
    ['started_at', 'TEXT'],
    ['completed_at', 'TEXT'],
  ];
  for (const [name, type] of alters) {
    if (!columnExists(db, 'inspections', name)) {
      db.run(`ALTER TABLE inspections ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureJobColumns(db: SqlDatabase) {
  const alters: Array<[string, string]> = [
    ['real_estate', 'TEXT'],
    ['agent_name', 'TEXT'],
    ['deleted_at', 'TEXT'],
    ['cancel_reason', 'TEXT'],
    ['cancel_notes', 'TEXT'],
    ['invoice_path', 'TEXT'],
  ];
  for (const [name, type] of alters) {
    if (!columnExists(db, 'jobs', name)) {
      db.run(`ALTER TABLE jobs ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureUserColumns(db: SqlDatabase) {
  if (!columnExists(db, 'users', 'mobile')) {
    db.run(`ALTER TABLE users ADD COLUMN mobile TEXT`);
  }
}

function ensureAgreementColumns(db: SqlDatabase) {
  const alters: Array<[string, string]> = [
    ['deleted_at', 'TEXT'],
    ['deleted_reason', 'TEXT'],
  ];
  for (const [name, type] of alters) {
    if (!columnExists(db, 'agreements', name)) {
      db.run(`ALTER TABLE agreements ADD COLUMN ${name} ${type}`);
    }
  }
  db.run(`CREATE INDEX IF NOT EXISTS idx_agreements_deleted ON agreements(deleted_at)`);
}

function backfillInspections(db: SqlDatabase) {
  const stmt = db.prepare(
    `SELECT j.id FROM jobs j
     LEFT JOIN inspections i ON i.job_id = j.id
     WHERE i.id IS NULL`,
  );
  const missing: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    missing.push(row.id);
  }
  stmt.free();

  for (const jobId of missing) {
    db.run(`INSERT INTO inspections (id, job_id, status) VALUES (?, ?, 'DRAFT')`, [
      `insp-backfill-${jobId}`,
      jobId,
    ]);
  }
}

function backfillCompletedJobInspections(db: SqlDatabase) {
  db.run(
    `UPDATE inspections SET
       status = 'COMPLETED',
       completed_at = COALESCE(completed_at, datetime('now')),
       updated_at = datetime('now')
     WHERE job_id IN (
       SELECT id FROM jobs WHERE status = 'COMPLETED' AND IFNULL(deleted_at, '') = ''
     )
     AND status != 'COMPLETED'`,
  );
}

export function isDatabaseEmpty(db: SqlDatabase): boolean {
  const result = db.exec('SELECT COUNT(*) AS count FROM users');
  const count = Number(result[0]?.values[0]?.[0] ?? 0);
  return !count;
}

export function getUserByEmail(db: SqlDatabase, email: string) {
  const stmt = db.prepare(
    `SELECT id, email, password_hash AS passwordHash, first_name AS firstName, last_name AS lastName, company_name AS companyName, mobile
     FROM users WHERE lower(email) = lower(?)`,
  );
  stmt.bind([email]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    companyName: string;
    mobile: string | null;
  };
  stmt.free();
  return row;
}

export function getUserById(db: SqlDatabase, userId: string) {
  const stmt = db.prepare(
    `SELECT id, email, password_hash AS passwordHash, first_name AS firstName, last_name AS lastName, company_name AS companyName, mobile
     FROM users WHERE id = ?`,
  );
  stmt.bind([userId]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    companyName: string;
    mobile: string | null;
  };
  stmt.free();
  return row;
}

export function toSessionUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  mobile: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName,
    mobile: user.mobile,
  };
}

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekStartKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

function scalar(db: SqlDatabase, sql: string, params: (string | number)[] = []): number {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  const value = stmt.get()[0];
  stmt.free();
  return Number(value ?? 0);
}

export function getDashboardSummary(db: SqlDatabase): DashboardSummary {
  const today = localDateKey();
  const weekStart = weekStartKey();

  return {
    todaysJobs: scalar(
      db,
      `SELECT COUNT(*) FROM jobs WHERE inspection_date = ? AND IFNULL(deleted_at, '') = ''`,
      [today],
    ),
    inProgress: scalar(
      db,
      `SELECT COUNT(*) FROM jobs WHERE status IN ('NEW', 'IN_PROGRESS') AND IFNULL(deleted_at, '') = ''`,
    ),
    waitingAgreements: scalar(
      db,
      `SELECT COUNT(*) FROM jobs WHERE agreement_status IN ('DRAFT', 'SENT') AND status != 'COMPLETED' AND IFNULL(deleted_at, '') = ''`,
    ),
    completedThisWeek: scalar(
      db,
      `SELECT COUNT(*) FROM jobs WHERE status = 'COMPLETED' AND inspection_date >= ? AND inspection_date <= ? AND IFNULL(deleted_at, '') = ''`,
      [weekStart, today],
    ),
    outstandingInvoices: scalar(
      db,
      `SELECT COUNT(*) FROM jobs WHERE has_invoice = 1 AND status != 'ARCHIVED' AND IFNULL(deleted_at, '') = ''`,
    ),
    upcomingInspections: scalar(
      db,
      `SELECT COUNT(*) FROM jobs WHERE inspection_date > ? AND IFNULL(deleted_at, '') = ''`,
      [today],
    ),
  };
}

const PRIORITY_ORDER: Record<JobPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

const STATUS_ORDER: Record<JobStatus, number> = {
  IN_PROGRESS: 0,
  NEW: 1,
  COMPLETED: 2,
  ARCHIVED: 3,
};

export function getTodayJobs(db: SqlDatabase): TodayJobRow[] {
  const today = localDateKey();
  const stmt = db.prepare(
    `SELECT
       j.id,
       j.job_number AS jobNumber,
       j.inspection_type AS inspectionType,
       j.inspection_time AS inspectionTime,
       j.property_address AS propertyAddress,
       j.status,
       j.priority,
       j.agreement_status AS agreementStatus,
       j.has_invoice AS hasInvoice,
       j.has_report AS hasReport,
       c.first_name || ' ' || c.last_name AS clientName,
       COALESCE(c.mobile, '') AS mobile,
       COALESCE(c.email, '') AS email
     FROM jobs j
     JOIN clients c ON c.id = j.client_id
     WHERE j.inspection_date = ? AND IFNULL(j.deleted_at, '') = ''
     ORDER BY j.inspection_time ASC`,
  );
  stmt.bind([today]);

  const rows: TodayJobRow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as TodayJobRow;
    rows.push({
      ...row,
      hasInvoice: Boolean(row.hasInvoice),
      hasReport: Boolean(row.hasReport),
    });
  }
  stmt.free();

  return rows.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.inspectionTime.localeCompare(b.inspectionTime);
  });
}

export function updateJobStatus(db: SqlDatabase, jobId: string, status: JobStatus) {
  db.run(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, jobId]);
  if (status === 'COMPLETED') {
    db.run(
      `UPDATE inspections SET
         status = 'COMPLETED',
         completed_at = COALESCE(completed_at, datetime('now')),
         updated_at = datetime('now')
       WHERE job_id = ?`,
      [jobId],
    );
  }
}

export function formatInspectionType(type: InspectionType): string {
  return INSPECTION_TYPE_LABELS[type] ?? type;
}
