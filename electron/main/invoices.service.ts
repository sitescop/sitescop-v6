import { mkdir, writeFile } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { Database as SqlDatabase } from 'sql.js';
import {
  DEFAULT_REPORT_SETTINGS,
  SITESCOP_PDF_FOOTER_TEXT,
} from '../../shared/company-branding.js';
import { generateInvoicePdf } from '../../shared/report-pdf/src/index.js';
import { getResolvedCompanyBranding, getResolvedReportSettings, getBillingSettings } from './settings.service.js';
import { getAgreement } from './agreements.service.js';
import { inspectionTypeLabel } from './agreement-legal.js';

function invoicesRoot(): string {
  return join(app.getPath('userData'), 'invoices');
}

function invoiceNumberForAgreement(agreementNumber: string): string {
  return `INV-${agreementNumber}`;
}

function resolveAgreementForJob(db: SqlDatabase, jobId: string): string | null {
  const stmt = db.prepare(
    `SELECT a.id
     FROM agreements a
     WHERE a.job_id = ?
       AND a.status != 'CANCELLED'
       AND IFNULL(a.deleted_at, '') = ''
     ORDER BY
       CASE a.status WHEN 'SIGNED' THEN 0 WHEN 'VIEWED' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END,
       a.updated_at DESC
     LIMIT 1`,
  );
  stmt.bind([jobId]);
  let agreementId: string | null = null;
  if (stmt.step()) {
    agreementId = String((stmt.getAsObject() as { id: string }).id);
  }
  stmt.free();
  return agreementId;
}

export async function generateInvoicePdfForJob(db: SqlDatabase, jobId: string): Promise<string> {
  const agreementId = resolveAgreementForJob(db, jobId);
  if (!agreementId) {
    throw new Error('No agreement found for this job. Create an agreement before generating an invoice.');
  }

  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');

  const root = invoicesRoot();
  await mkdir(root, { recursive: true });
  const fileName = `${invoiceNumberForAgreement(agreement.agreementNumber).replace(/[^\w-]+/g, '-')}.pdf`;
  const filePath = join(root, fileName);

  const existingStmt = db.prepare(`SELECT invoice_path AS invoicePath FROM jobs WHERE id = ? LIMIT 1`);
  existingStmt.bind([jobId]);
  if (existingStmt.step()) {
    const oldPath = (existingStmt.getAsObject() as { invoicePath?: string }).invoicePath;
    if (oldPath && oldPath !== filePath) {
      try {
        unlinkSync(oldPath);
      } catch {
        // previous file may already be missing
      }
    }
  }
  existingStmt.free();

  const jobStmt = db.prepare(
    `SELECT payment_received AS paymentReceived, paid_at AS paidAt FROM jobs WHERE id = ? LIMIT 1`,
  );
  jobStmt.bind([jobId]);
  if (!jobStmt.step()) {
    jobStmt.free();
    throw new Error('Job not found.');
  }
  const jobRow = jobStmt.getAsObject() as { paymentReceived: number; paidAt?: string };
  jobStmt.free();

  const isPaid = Boolean(jobRow.paymentReceived);
  const paidAt = isPaid ? jobRow.paidAt ?? agreement.signedAt ?? agreement.agreementDate : null;
  const issueDate = agreement.signedAt ?? agreement.agreementDate;
  const description = `${inspectionTypeLabel(agreement.inspectionType)} inspection — ${agreement.propertyAddress}`;
  const billing = getBillingSettings();

  const buffer = await generateInvoicePdf({
    company: getResolvedCompanyBranding(),
    invoiceNumber: invoiceNumberForAgreement(agreement.agreementNumber),
    issueDate,
    dueDate: null,
    clientName: agreement.clientName,
    clientEmail: agreement.clientEmail,
    propertyAddress: agreement.propertyAddress,
    description,
    subtotalCents: agreement.priceCents,
    gstCents: agreement.gstCents,
    totalCents: agreement.totalCents,
    paidAt,
    paymentMethod: isPaid ? 'Payment received' : null,
    paymentReference: isPaid ? agreement.agreementNumber : null,
    statusLabel: isPaid ? 'Paid' : 'Outstanding',
    bankAccountName: billing.bankAccountName || null,
    bankBsb: billing.bankBsb || null,
    bankAccountNumber: billing.bankAccountNumber || null,
    paymentTerms: billing.invoicePaymentTerms || null,
    paymentNotes: billing.invoicePaymentNotes || null,
    footerText: SITESCOP_PDF_FOOTER_TEXT,
    primaryColor: DEFAULT_REPORT_SETTINGS.primaryColor,
    secondaryColor: DEFAULT_REPORT_SETTINGS.secondaryColor,
    pdfIncludeLogo: getResolvedReportSettings().pdfIncludeLogo,
  });

  await writeFile(filePath, buffer);
  db.run(
    `UPDATE jobs SET invoice_path = ?, has_invoice = 1, updated_at = datetime('now') WHERE id = ?`,
    [filePath, jobId],
  );

  return filePath;
}
