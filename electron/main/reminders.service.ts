import { existsSync } from 'node:fs';
import type { Database as SqlDatabase } from 'sql.js';
import type { ReminderRunResult } from '../../shared/api-types.js';
import { SITESCOP_COMPANY_EMAIL, SITESCOP_COMPANY_NAME, SITESCOP_COMPANY_PHONE } from '../../shared/company-branding.js';
import { localDateKey } from './database.js';
import { isSmtpSendReady, sendSmtpEmail } from './smtp.service.js';
import { getCompanySettings, getReminderSettings } from './settings.service.js';

function addDaysKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function daysBetween(earlierKey: string, laterKey: string): number {
  const a = new Date(`${earlierKey.slice(0, 10)}T12:00:00`);
  const b = new Date(`${laterKey.slice(0, 10)}T12:00:00`);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Client';
}

function formatAuDate(dateKey: string): string {
  const d = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function validClientEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed.includes('@')) return null;
  if (trimmed.toLowerCase() === SITESCOP_COMPANY_EMAIL.toLowerCase()) return null;
  if (trimmed.toLowerCase() === 'inspector@sitescop.com.au') return null;
  return trimmed;
}

interface ReminderJobRow {
  id: string;
  jobNumber: string;
  clientName: string;
  email: string;
  mobile: string;
  propertyAddress: string;
  inspectionDate: string;
  inspectionTime: string;
  inspectionReminderForDate: string | null;
  overdueReminderLastSentAt: string | null;
  signedAt: string | null;
}

function listUpcomingInspectionJobs(db: SqlDatabase): ReminderJobRow[] {
  const stmt = db.prepare(
    `SELECT
       j.id,
       j.job_number AS jobNumber,
       c.first_name || ' ' || c.last_name AS clientName,
       COALESCE(c.email, '') AS email,
       COALESCE(c.mobile, '') AS mobile,
       j.property_address AS propertyAddress,
       j.inspection_date AS inspectionDate,
       j.inspection_time AS inspectionTime,
       j.inspection_reminder_for_date AS inspectionReminderForDate,
       j.overdue_reminder_last_sent_at AS overdueReminderLastSentAt,
       NULL AS signedAt
     FROM jobs j
     JOIN clients c ON c.id = j.client_id
     WHERE IFNULL(j.deleted_at, '') = ''
       AND j.status != 'ARCHIVED'
       AND j.status != 'COMPLETED'
       AND j.inspection_date IS NOT NULL
       AND TRIM(j.inspection_date) != ''
     ORDER BY j.inspection_date ASC`,
  );
  const rows: ReminderJobRow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      id: String(row.id),
      jobNumber: String(row.jobNumber),
      clientName: String(row.clientName),
      email: String(row.email ?? ''),
      mobile: String(row.mobile ?? ''),
      propertyAddress: String(row.propertyAddress),
      inspectionDate: String(row.inspectionDate).slice(0, 10),
      inspectionTime: String(row.inspectionTime ?? ''),
      inspectionReminderForDate: row.inspectionReminderForDate
        ? String(row.inspectionReminderForDate).slice(0, 10)
        : null,
      overdueReminderLastSentAt: row.overdueReminderLastSentAt
        ? String(row.overdueReminderLastSentAt)
        : null,
      signedAt: null,
    });
  }
  stmt.free();
  return rows;
}

function listUnpaidSignedJobs(db: SqlDatabase): ReminderJobRow[] {
  const stmt = db.prepare(
    `SELECT
       j.id,
       j.job_number AS jobNumber,
       c.first_name || ' ' || c.last_name AS clientName,
       COALESCE(c.email, '') AS email,
       COALESCE(c.mobile, '') AS mobile,
       j.property_address AS propertyAddress,
       j.inspection_date AS inspectionDate,
       j.inspection_time AS inspectionTime,
       j.inspection_reminder_for_date AS inspectionReminderForDate,
       j.overdue_reminder_last_sent_at AS overdueReminderLastSentAt,
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
       AND j.status != 'ARCHIVED'
       AND j.agreement_status = 'SIGNED'
       AND j.payment_received = 0
     ORDER BY j.inspection_date ASC`,
  );
  const rows: ReminderJobRow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      id: String(row.id),
      jobNumber: String(row.jobNumber),
      clientName: String(row.clientName),
      email: String(row.email ?? ''),
      mobile: String(row.mobile ?? ''),
      propertyAddress: String(row.propertyAddress),
      inspectionDate: String(row.inspectionDate).slice(0, 10),
      inspectionTime: String(row.inspectionTime ?? ''),
      inspectionReminderForDate: row.inspectionReminderForDate
        ? String(row.inspectionReminderForDate).slice(0, 10)
        : null,
      overdueReminderLastSentAt: row.overdueReminderLastSentAt
        ? String(row.overdueReminderLastSentAt)
        : null,
      signedAt: row.signedAt ? String(row.signedAt).slice(0, 10) : null,
    });
  }
  stmt.free();
  return rows;
}

async function resolveInvoicePath(db: SqlDatabase, jobId: string): Promise<string | null> {
  const inv = db.prepare(
    `SELECT invoice_path AS invoicePath, has_invoice AS hasInvoice FROM jobs WHERE id = ? LIMIT 1`,
  );
  inv.bind([jobId]);
  let invoicePath: string | null = null;
  if (inv.step()) {
    const row = inv.getAsObject() as { invoicePath?: string | null; hasInvoice?: number };
    if (row.hasInvoice && row.invoicePath) invoicePath = String(row.invoicePath);
  }
  inv.free();
  if (invoicePath && existsSync(invoicePath)) return invoicePath;
  try {
    const { generateInvoicePdfForJob } = await import('./invoices.service.js');
    return await generateInvoicePdfForJob(db, jobId);
  } catch {
    return null;
  }
}

/**
 * Sends due inspection + overdue payment reminder emails via SMTP.
 * Safe to call on startup and on an interval — each reminder is sent at most once per rules.
 */
export async function processAutomaticReminders(db: SqlDatabase): Promise<ReminderRunResult> {
  const settings = getReminderSettings();
  const company = getCompanySettings();
  const today = localDateKey();
  const errors: string[] = [];
  let inspectionSent = 0;
  let overdueSent = 0;
  let skipped = 0;

  if (!settings.inspectionReminderEnabled && !settings.overduePaymentReminderEnabled) {
    return {
      inspectionSent: 0,
      overdueSent: 0,
      skipped: 0,
      errors: [],
      message: 'Automatic reminders are turned off in Settings → Email.',
    };
  }

  if (!isSmtpSendReady()) {
    return {
      inspectionSent: 0,
      overdueSent: 0,
      skipped: 0,
      errors: ['SMTP is not ready. Enable SMTP in Settings → Email.'],
      message: 'Reminders need SMTP. Enable and save SMTP settings first.',
    };
  }

  const brand = {
    companyName: company.name || SITESCOP_COMPANY_NAME,
    companyPhone: company.phone || SITESCOP_COMPANY_PHONE,
    fromEmail: company.email || SITESCOP_COMPANY_EMAIL,
  };

  if (settings.inspectionReminderEnabled) {
    const daysBefore = settings.inspectionReminderDaysBefore;
    for (const job of listUpcomingInspectionJobs(db)) {
      const reminderDay = addDaysKey(job.inspectionDate, -daysBefore);
      // Due if today is on/after reminder day and on/before inspection day (catch-up if PC was off).
      const due = today >= reminderDay && today <= job.inspectionDate;
      if (!due) {
        skipped += 1;
        continue;
      }
      if (job.inspectionReminderForDate === job.inspectionDate) {
        skipped += 1;
        continue;
      }
      const to = validClientEmail(job.email);
      if (!to) {
        skipped += 1;
        continue;
      }

      const when =
        daysBefore === 0
          ? 'today'
          : daysBefore === 1
            ? 'tomorrow'
            : `in ${daysBefore} days`;
      const subject = `Inspection reminder — ${job.propertyAddress} (${when})`;
      const text = `Hello ${firstName(job.clientName)},

This is an important reminder about your upcoming SiteScop inspection.

Property / address: ${job.propertyAddress}
Scheduled: ${formatAuDate(job.inspectionDate)}${job.inspectionTime ? ` at ${job.inspectionTime}` : ''}
Job: ${job.jobNumber}

Please make sure someone is available for access if required.

Kind regards,
${brand.companyName}
${brand.companyPhone}
${brand.fromEmail}`;

      try {
        await sendSmtpEmail({ to, subject, text });
        db.run(
          `UPDATE jobs SET inspection_reminder_for_date = ?, updated_at = datetime('now') WHERE id = ?`,
          [job.inspectionDate, job.id],
        );
        inspectionSent += 1;
      } catch (error) {
        errors.push(
          `Inspection ${job.jobNumber}: ${error instanceof Error ? error.message : 'send failed'}`,
        );
      }
    }
  }

  if (settings.overduePaymentReminderEnabled) {
    const afterDays = settings.overduePaymentAfterDays;
    const repeatDays = settings.overduePaymentRepeatDays;
    for (const job of listUnpaidSignedJobs(db)) {
      const refDate = (job.signedAt || job.inspectionDate).slice(0, 10);
      const age = daysBetween(refDate, today);
      if (age < afterDays) {
        skipped += 1;
        continue;
      }
      if (job.overdueReminderLastSentAt) {
        const last = job.overdueReminderLastSentAt.slice(0, 10);
        if (daysBetween(last, today) < repeatDays) {
          skipped += 1;
          continue;
        }
      }
      const to = validClientEmail(job.email);
      if (!to) {
        skipped += 1;
        continue;
      }

      const invoicePath = await resolveInvoicePath(db, job.id);
      const subject = `Payment reminder — ${job.propertyAddress} (${job.jobNumber})`;
      const text = `Hello ${firstName(job.clientName)},

This is an automatic reminder that payment for your SiteScop inspection is still outstanding.

Property: ${job.propertyAddress}
Job: ${job.jobNumber}
Reference date: ${formatAuDate(refDate)}
Days outstanding: ${age}

${invoicePath ? 'Please find the invoice attached.' : 'Please contact us for your invoice.'}

If you have already paid, thank you — you can ignore this message.

Kind regards,
${brand.companyName}
${brand.companyPhone}
${brand.fromEmail}`;

      try {
        await sendSmtpEmail({
          to,
          subject,
          text,
          attachments: invoicePath
            ? [{ filename: `Invoice-${job.jobNumber}.pdf`, path: invoicePath }]
            : undefined,
        });
        db.run(
          `UPDATE jobs SET overdue_reminder_last_sent_at = ?, updated_at = datetime('now') WHERE id = ?`,
          [new Date().toISOString(), job.id],
        );
        overdueSent += 1;
      } catch (error) {
        errors.push(
          `Overdue ${job.jobNumber}: ${error instanceof Error ? error.message : 'send failed'}`,
        );
      }
    }
  }

  const parts: string[] = [];
  if (inspectionSent) parts.push(`${inspectionSent} inspection reminder(s)`);
  if (overdueSent) parts.push(`${overdueSent} overdue payment reminder(s)`);
  const message =
    parts.length > 0
      ? `Sent ${parts.join(' and ')}.`
      : errors.length > 0
        ? 'Reminders ran with errors.'
        : 'No new reminders were due.';

  return { inspectionSent, overdueSent, skipped, errors, message };
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(getDb: () => SqlDatabase, persist: () => void): void {
  const run = () => {
    void processAutomaticReminders(getDb())
      .then((result) => {
        if (result.inspectionSent > 0 || result.overdueSent > 0) persist();
        if (result.errors.length > 0) {
          console.warn('[reminders]', result.message, result.errors.slice(0, 3));
        }
      })
      .catch((error) => {
        console.warn('[reminders] failed', error);
      });
  };

  // Catch up shortly after launch (PC was off / app closed).
  setTimeout(run, 8_000);
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(run, 15 * 60 * 1000);
}

export function stopReminderScheduler(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
