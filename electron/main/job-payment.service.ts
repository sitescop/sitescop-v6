import type { Database as SqlDatabase } from 'sql.js';
import {
  NOT_PAID_REPORT_MESSAGE,
  jobRequiresPaymentForReportDelivery,
} from '../../shared/job-payment.js';

export { NOT_PAID_REPORT_MESSAGE };

export function assertJobPaidForReportDelivery(db: SqlDatabase, jobId: string): void {
  const stmt = db.prepare(
    `SELECT agreement_status AS agreementStatus, payment_received AS paymentReceived
     FROM jobs WHERE id = ? LIMIT 1`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Job not found.');
  }
  const row = stmt.getAsObject() as { agreementStatus: string; paymentReceived: number };
  stmt.free();
  if (
    jobRequiresPaymentForReportDelivery(String(row.agreementStatus), Boolean(row.paymentReceived))
  ) {
    throw new Error(NOT_PAID_REPORT_MESSAGE);
  }
}

export function assertReportFilesPaidForDelivery(db: SqlDatabase, filePaths: string[]): void {
  if (filePaths.length === 0) return;

  const placeholders = filePaths.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT DISTINCT j.agreement_status AS agreementStatus, j.payment_received AS paymentReceived
     FROM inspection_reports r
     JOIN jobs j ON j.id = r.job_id
     WHERE r.file_path IN (${placeholders})`,
  );
  stmt.bind(filePaths);
  while (stmt.step()) {
    const row = stmt.getAsObject() as { agreementStatus: string; paymentReceived: number };
    if (
      jobRequiresPaymentForReportDelivery(String(row.agreementStatus), Boolean(row.paymentReceived))
    ) {
      stmt.free();
      throw new Error(NOT_PAID_REPORT_MESSAGE);
    }
  }
  stmt.free();
}
