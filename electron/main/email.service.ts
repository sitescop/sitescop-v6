import { BrowserWindow, clipboard, dialog, shell } from 'electron';
import { basename } from 'node:path';
import { existsSync } from 'node:fs';
import type { Database as SqlDatabase } from 'sql.js';
import type { ComposeEmailResult, EmailMailClient, SessionUser } from '../../shared/api-types.js';
import {
  SITESCOP_COMPANY_EMAIL,
  SITESCOP_COMPANY_NAME,
  SITESCOP_COMPANY_PHONE,
} from '../../shared/company-branding.js';
import { getAgreement } from './agreements.service.js';
import { getActiveSigningUrl } from './github-agreements.service.js';
import { assertJobPaidForReportDelivery } from './job-payment.service.js';
import { getJobDetail } from './jobs.service.js';
import { listReportsForJob } from './reports.service.js';
import { getCompanySettings, getEmailSettings } from './settings.service.js';
import { isSmtpSendReady, sendSmtpEmail } from './smtp.service.js';

function firstValidClientEmail(...candidates: (string | undefined | null)[]): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) continue;
    if (trimmed === SITESCOP_COMPANY_EMAIL.toLowerCase()) continue;
    if (trimmed === 'inspector@sitescop.com.au') continue;
    return candidate!.trim();
  }
  return null;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return vars[key] ?? '';
  });
}

function brandVars(extra: Record<string, string> = {}): Record<string, string> {
  const company = getCompanySettings();
  const email = getEmailSettings();
  const fromEmail = email.fromEmail.trim() || company.email || SITESCOP_COMPANY_EMAIL;
  return {
    companyName: company.name || SITESCOP_COMPANY_NAME,
    companyPhone: company.phone || SITESCOP_COMPANY_PHONE,
    fromEmail,
    ...extra,
  };
}

function firstNameFrom(clientName: string): string {
  return clientName.trim().split(/\s+/)[0] || 'Client';
}

function appendPdfAttachmentNote(
  body: string,
  pdfPaths: string[],
  mailClient: EmailMailClient,
): string {
  const appLabel =
    mailClient === 'zoho' ? 'Zoho' : mailClient === 'outlook' ? 'Outlook' : 'your email app';
  const paths = pdfPaths.filter((p) => existsSync(p));
  if (paths.length === 0) return body;
  return `${body}

---
Attach PDF${paths.length > 1 ? 's' : ''}: copy each path below, click Attach in ${appLabel}, paste into the file box, then delete these lines before sending.

${paths.join('\n')}`;
}

function normalizePdfPaths(options: { pdfPath?: string; pdfPaths?: string[] }): string[] {
  const paths = [...(options.pdfPaths ?? [])];
  if (options.pdfPath) paths.push(options.pdfPath);
  return [...new Set(paths.filter((p) => Boolean(p) && existsSync(p)))];
}

function openZohoCompose(to: string, subject: string, body: string): void {
  const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const zohoUrl = `https://mail.zoho.com.au/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct=${encodeURIComponent(mailtoLink)}`;
  void shell.openExternal(zohoUrl);
}

function openMailtoCompose(to: string, subject: string, body: string): void {
  const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  void shell.openExternal(mailtoLink);
}

function openCompose(mailClient: EmailMailClient, to: string, subject: string, body: string): void {
  if (mailClient === 'zoho') {
    openZohoCompose(to, subject, body);
    return;
  }
  openMailtoCompose(to, subject, body);
}

function mailClientLabel(mailClient: EmailMailClient): string {
  if (mailClient === 'zoho') return 'Zoho Mail';
  if (mailClient === 'outlook') return 'Outlook / default mail';
  return 'system mail';
}

function parentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
}

async function sendViaSmtp(options: {
  clientEmail: string;
  subject: string;
  body: string;
  pdfPath?: string;
  pdfPaths?: string[];
}): Promise<ComposeEmailResult> {
  const pdfPaths = normalizePdfPaths(options);
  const parent = parentWindow();
  const attachNote =
    pdfPaths.length > 0
      ? `\n\nAttachment${pdfPaths.length > 1 ? 's' : ''}: ${pdfPaths.map((p) => basename(p)).join(', ')}`
      : '';
  const messageOptions: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'Send email via SMTP',
    message: `Send to ${options.clientEmail}?`,
    detail: `SiteScop will send this email directly using your SMTP settings.${attachNote}`,
    buttons: ['Send', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  };

  const { response } = parent
    ? await dialog.showMessageBox(parent, messageOptions)
    : await dialog.showMessageBox(messageOptions);

  if (response !== 0) {
    return {
      clientEmail: options.clientEmail,
      method: 'smtp',
      message: '',
      cancelled: true,
    };
  }

  const attachments =
    pdfPaths.length > 0
      ? pdfPaths.map((path) => ({ filename: basename(path), path }))
      : undefined;

  await sendSmtpEmail({
    to: options.clientEmail,
    subject: options.subject,
    text: options.body,
    attachments,
  });

  return {
    clientEmail: options.clientEmail,
    method: 'smtp',
    message: attachments
      ? `Email sent to ${options.clientEmail} (${attachments.length} PDF${attachments.length > 1 ? 's' : ''} attached).`
      : `Email sent to ${options.clientEmail}.`,
  };
}

async function promptAndOpenEmail(options: {
  clientEmail: string;
  subject: string;
  body: string;
  pdfPath?: string;
  pdfPaths?: string[];
}): Promise<ComposeEmailResult> {
  if (isSmtpSendReady()) {
    return sendViaSmtp(options);
  }

  const emailSettings = getEmailSettings();
  const mailClient = emailSettings.mailClient;
  const label = mailClientLabel(mailClient);
  const pdfPaths = normalizePdfPaths(options);

  const pdfSteps =
    pdfPaths.length > 0 && emailSettings.includePdfAttachTip
      ? `\n3. Copy the PDF path${pdfPaths.length > 1 ? 's' : ''} at the bottom of the email → Attach in ${label} → paste → delete those lines before sending.`
      : '';

  const parent = parentWindow();
  const messageOptions: Electron.MessageBoxOptions = {
    type: 'info',
    title: `Send email to client (${label})`,
    message: `Client email: ${options.clientEmail}`,
    detail: `SiteScop will open ${label} to compose this email.

From / reply: ${emailSettings.fromEmail || SITESCOP_COMPANY_EMAIL}

Steps:
1. Click OK — ${label} opens.
2. Check the To field has the client email; if not, press Ctrl+V (copied to clipboard).
${pdfSteps}`,
    buttons: [`OK — open ${mailClient === 'zoho' ? 'Zoho' : 'mail'}`, 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  };

  const { response } = parent
    ? await dialog.showMessageBox(parent, messageOptions)
    : await dialog.showMessageBox(messageOptions);

  if (response !== 0) {
    return {
      clientEmail: options.clientEmail,
      method: mailClient,
      message: '',
      cancelled: true,
    };
  }

  clipboard.writeText(options.clientEmail);

  let emailBody = options.body;
  if (pdfPaths.length > 0 && emailSettings.includePdfAttachTip) {
    emailBody = appendPdfAttachmentNote(options.body, pdfPaths, mailClient);
  }

  openCompose(mailClient, options.clientEmail, options.subject, emailBody);

  if (pdfPaths.length > 0 && emailSettings.includePdfAttachTip) {
    return {
      clientEmail: options.clientEmail,
      method: mailClient,
      message: `${label} opened. PDF path${pdfPaths.length > 1 ? 's are' : ' is'} at the bottom of the email — copy into Attach, then delete those lines.`,
    };
  }

  return {
    clientEmail: options.clientEmail,
    method: mailClient,
    message: `${label} opened. Client email copied — paste in To if needed (Ctrl+V).`,
  };
}

function getClientEmailFromDb(db: SqlDatabase, jobId: string): string | null {
  const stmt = db.prepare(
    `SELECT COALESCE(c.email, '') AS email FROM jobs j
     JOIN clients c ON c.id = j.client_id
     WHERE j.id = ? AND IFNULL(j.deleted_at, '') = ''`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const email = String((stmt.getAsObject() as { email: string }).email);
  stmt.free();
  return firstValidClientEmail(email);
}

function getFormClientEmail(db: SqlDatabase, jobId: string): string | null {
  const stmt = db.prepare(`SELECT form_data FROM inspections WHERE job_id = ? LIMIT 1`);
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const raw = String((stmt.getAsObject() as { form_data: string }).form_data ?? '');
  stmt.free();
  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as {
      shared?: { jobInformation?: { clientEmail?: string } };
    };
    return firstValidClientEmail(parsed.shared?.jobInformation?.clientEmail);
  } catch {
    return null;
  }
}

function resolveClientEmail(db: SqlDatabase, jobId: string, jobEmail?: string): string {
  const clientEmail = firstValidClientEmail(
    getFormClientEmail(db, jobId),
    getClientEmailFromDb(db, jobId),
    jobEmail,
  );

  if (!clientEmail) {
    throw new Error(
      'No client email on file. Add the client email when creating the job or in the inspection form (Email field).',
    );
  }

  return clientEmail;
}

export async function composeClientEmail(
  db: SqlDatabase,
  jobId: string,
  _user: SessionUser,
): Promise<ComposeEmailResult> {
  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found');

  const emailSettings = getEmailSettings();
  const clientEmail = resolveClientEmail(db, jobId, job.email);
  const vars = brandVars({
    clientName: job.clientName,
    firstName: firstNameFrom(job.clientName),
    propertyAddress: job.propertyAddress,
    jobNumber: job.jobNumber,
  });

  return promptAndOpenEmail({
    clientEmail,
    subject: applyTemplate(emailSettings.generalSubject, vars),
    body: applyTemplate(emailSettings.generalBody, vars),
  });
}

export async function composeReportEmailToClient(
  db: SqlDatabase,
  reportId: string,
  user: SessionUser,
): Promise<ComposeEmailResult> {
  void user;

  const stmt = db.prepare(
    `SELECT
       r.report_type AS report_type,
       r.file_path AS file_path,
       j.job_number AS job_number,
       j.property_address AS property_address,
       j.id AS job_id,
       c.first_name || ' ' || c.last_name AS client_name,
       COALESCE(c.email, '') AS client_email,
       i.inspection_number AS inspection_number
     FROM inspection_reports r
     JOIN inspections i ON i.id = r.inspection_id
     JOIN jobs j ON j.id = r.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE r.id = ?`,
  );
  stmt.bind([reportId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Report not found');
  }
  const row = stmt.getAsObject();
  stmt.free();

  const jobId = String(row.job_id);
  assertJobPaidForReportDelivery(db, jobId);
  const clientEmail = resolveClientEmail(db, jobId, String(row.client_email));
  const filePath = String(row.file_path);

  if (!existsSync(filePath)) {
    throw new Error('PDF file not found. Regenerate the report first.');
  }

  const reportType = String(row.report_type);
  const reportLabel =
    reportType === 'PEST' ? 'pest inspection report' : 'building inspection report';
  const emailSettings = getEmailSettings();
  const vars = brandVars({
    clientName: String(row.client_name),
    firstName: firstNameFrom(String(row.client_name)),
    propertyAddress: String(row.property_address),
    jobNumber: String(row.job_number),
    inspectionNumber: String(row.inspection_number),
    reportLabel,
  });

  return promptAndOpenEmail({
    clientEmail,
    subject: applyTemplate(emailSettings.reportSubject, vars),
    body: applyTemplate(emailSettings.reportBody, vars),
    pdfPath: filePath,
  });
}

export async function composeJobReportsEmailToClient(
  db: SqlDatabase,
  jobId: string,
  user: SessionUser,
): Promise<ComposeEmailResult> {
  void user;

  const reports = listReportsForJob(db, jobId);
  if (reports.length === 0) {
    throw new Error('No reports found. Generate PDFs first.');
  }

  assertJobPaidForReportDelivery(db, jobId);

  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found');

  const clientEmail = resolveClientEmail(db, jobId, job.email);
  const pdfPaths = reports.map((r) => r.filePath).filter((p) => existsSync(p));
  if (pdfPaths.length === 0) {
    throw new Error('PDF files not found. Regenerate the reports first.');
  }
  if (pdfPaths.length < reports.length) {
    throw new Error('One or more PDF files are missing. Regenerate the reports first.');
  }

  const types = new Set(reports.map((r) => r.reportType));
  const reportLabel =
    types.has('BUILDING') && types.has('PEST')
      ? 'building and pest inspection reports'
      : types.has('PEST')
        ? 'pest inspection report'
        : 'building inspection report';

  const insp = db.prepare(
    `SELECT inspection_number AS inspectionNumber FROM inspections WHERE job_id = ? LIMIT 1`,
  );
  insp.bind([jobId]);
  const inspectionNumber = insp.step()
    ? String((insp.getAsObject() as { inspectionNumber: string }).inspectionNumber)
    : job.jobNumber;
  insp.free();

  const emailSettings = getEmailSettings();
  const vars = brandVars({
    clientName: job.clientName,
    firstName: firstNameFrom(job.clientName),
    propertyAddress: job.propertyAddress,
    jobNumber: job.jobNumber,
    inspectionNumber,
    reportLabel,
  });

  return promptAndOpenEmail({
    clientEmail,
    subject: applyTemplate(emailSettings.reportSubject, vars),
    body: applyTemplate(emailSettings.reportBody, vars),
    pdfPaths,
  });
}

export async function composeAgreementSigningEmail(
  db: SqlDatabase,
  agreementId: string,
  _user: SessionUser,
): Promise<ComposeEmailResult> {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found');
  if (agreement.status === 'SIGNED') {
    throw new Error('This agreement is already signed.');
  }
  if (!agreement.accessToken) {
    throw new Error('No signing link yet. Use Send to client or Resend / get link first.');
  }

  const clientEmail = firstValidClientEmail(agreement.clientEmail);
  if (!clientEmail) {
    throw new Error('No client email on this agreement. Add the client email and try again.');
  }

  const { url: signingUrl } = getActiveSigningUrl(agreement.accessToken);
  const emailSettings = getEmailSettings();
  const vars = brandVars({
    clientName: agreement.clientName,
    firstName: firstNameFrom(agreement.clientName),
    propertyAddress: agreement.propertyAddress,
    agreementNumber: agreement.agreementNumber,
    signingUrl,
    jobNumber: agreement.jobNumber ?? '',
  });

  return promptAndOpenEmail({
    clientEmail,
    subject: applyTemplate(emailSettings.signingSubject, vars),
    body: applyTemplate(emailSettings.signingBody, vars),
  });
}

export async function composeInvoiceEmailForJob(
  db: SqlDatabase,
  jobId: string,
  _user: SessionUser,
): Promise<ComposeEmailResult> {
  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found');

  const clientEmail = resolveClientEmail(db, jobId, job.email);
  const emailSettings = getEmailSettings();

  let invoicePath: string | null = null;
  let agreementNumber = job.jobNumber;
  const inv = db.prepare(
    `SELECT invoice_path AS invoicePath, has_invoice AS hasInvoice FROM jobs WHERE id = ? LIMIT 1`,
  );
  inv.bind([jobId]);
  if (inv.step()) {
    const row = inv.getAsObject() as { invoicePath?: string | null; hasInvoice?: number };
    if (row.hasInvoice && row.invoicePath) {
      invoicePath = String(row.invoicePath);
    }
  }
  inv.free();

  const agr = db.prepare(
    `SELECT agreement_number AS agreementNumber
     FROM agreements
     WHERE job_id = ?
       AND status != 'CANCELLED'
       AND IFNULL(deleted_at, '') = ''
       AND IFNULL(archived_at, '') = ''
     ORDER BY
       CASE status WHEN 'SIGNED' THEN 0 WHEN 'VIEWED' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END,
       updated_at DESC
     LIMIT 1`,
  );
  agr.bind([jobId]);
  if (agr.step()) {
    agreementNumber = String((agr.getAsObject() as { agreementNumber: string }).agreementNumber);
  }
  agr.free();

  if (!invoicePath || !existsSync(invoicePath)) {
    const { generateInvoicePdfForJob } = await import('./invoices.service.js');
    invoicePath = await generateInvoicePdfForJob(db, jobId);
  }

  const invoiceNumber = `INV-${agreementNumber}`;
  const vars = brandVars({
    clientName: job.clientName,
    firstName: firstNameFrom(job.clientName),
    propertyAddress: job.propertyAddress,
    jobNumber: job.jobNumber,
    invoiceNumber,
    agreementNumber,
  });

  return promptAndOpenEmail({
    clientEmail,
    subject: applyTemplate(emailSettings.invoiceSubject, vars),
    body: applyTemplate(emailSettings.invoiceBody, vars),
    pdfPath: invoicePath,
  });
}

async function resolveInvoicePathForJob(db: SqlDatabase, jobId: string, jobNumber: string): Promise<{
  invoicePath: string;
  agreementNumber: string;
  invoiceNumber: string;
}> {
  let invoicePath: string | null = null;
  let agreementNumber = jobNumber;
  const inv = db.prepare(
    `SELECT invoice_path AS invoicePath, has_invoice AS hasInvoice FROM jobs WHERE id = ? LIMIT 1`,
  );
  inv.bind([jobId]);
  if (inv.step()) {
    const row = inv.getAsObject() as { invoicePath?: string | null; hasInvoice?: number };
    if (row.hasInvoice && row.invoicePath) {
      invoicePath = String(row.invoicePath);
    }
  }
  inv.free();

  const agr = db.prepare(
    `SELECT agreement_number AS agreementNumber
     FROM agreements
     WHERE job_id = ?
       AND status != 'CANCELLED'
       AND IFNULL(deleted_at, '') = ''
       AND IFNULL(archived_at, '') = ''
     ORDER BY
       CASE status WHEN 'SIGNED' THEN 0 WHEN 'VIEWED' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END,
       updated_at DESC
     LIMIT 1`,
  );
  agr.bind([jobId]);
  if (agr.step()) {
    agreementNumber = String((agr.getAsObject() as { agreementNumber: string }).agreementNumber);
  }
  agr.free();

  if (!invoicePath || !existsSync(invoicePath)) {
    const { generateInvoicePdfForJob } = await import('./invoices.service.js');
    invoicePath = await generateInvoicePdfForJob(db, jobId);
  }

  return {
    invoicePath,
    agreementNumber,
    invoiceNumber: `INV-${agreementNumber}`,
  };
}

/** Overdue / unpaid payment reminder with invoice attached. */
export async function composePaymentReminderEmail(
  db: SqlDatabase,
  jobId: string,
  _user: SessionUser,
): Promise<ComposeEmailResult> {
  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found');
  if (job.paymentReceived) {
    throw new Error('This job is already marked as paid.');
  }

  const clientEmail = resolveClientEmail(db, jobId, job.email);
  const invoice = await resolveInvoicePathForJob(db, jobId, job.jobNumber);
  const company = getCompanySettings();

  const subject = `Payment reminder — Invoice ${invoice.invoiceNumber} — ${job.propertyAddress}`;
  const body = `Hello ${firstNameFrom(job.clientName)},

This is a friendly reminder that payment for your SiteScop inspection is still outstanding.

Property: ${job.propertyAddress}
Job: ${job.jobNumber}
Invoice: ${invoice.invoiceNumber}

Please find the invoice attached. If you have already paid, thank you — you can ignore this message.

Kind regards,
${company.name || 'SiteScop'}
${company.phone || ''}
${company.email || ''}`.trim();

  return promptAndOpenEmail({
    clientEmail,
    subject,
    body,
    pdfPath: invoice.invoicePath,
  });
}

export interface BroadcastOfferInput {
  subject: string;
  body: string;
}

export interface BroadcastOfferResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  message: string;
  cancelled?: boolean;
}

/** One-click offer / advertisement email to all clients with a valid email. */
export async function broadcastClientOfferEmail(
  db: SqlDatabase,
  input: BroadcastOfferInput,
  _user: SessionUser,
): Promise<BroadcastOfferResult> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) {
    throw new Error('Subject and message are required.');
  }

  const stmt = db.prepare(
    `SELECT DISTINCT LOWER(TRIM(email)) AS emailKey, TRIM(email) AS email, first_name AS firstName
     FROM clients
     WHERE TRIM(COALESCE(email, '')) != ''
     ORDER BY lower(last_name), lower(first_name)`,
  );
  const recipients: Array<{ email: string; firstName: string }> = [];
  const seen = new Set<string>();
  while (stmt.step()) {
    const row = stmt.getAsObject() as { emailKey: string; email: string; firstName: string };
    const key = String(row.emailKey || '');
    const email = firstValidClientEmail(String(row.email));
    if (!email || !key || seen.has(key)) continue;
    seen.add(key);
    recipients.push({ email, firstName: String(row.firstName || 'Client') });
  }
  stmt.free();

  if (recipients.length === 0) {
    throw new Error('No client emails on file.');
  }

  if (!isSmtpSendReady()) {
    throw new Error(
      'SMTP must be enabled to send offers to all clients. Open Settings → Email, enable SMTP, save, then try again.',
    );
  }

  const parent = parentWindow();
  const confirm = parent
    ? await dialog.showMessageBox(parent, {
        type: 'question',
        title: 'Send offer to all clients',
        message: `Send this offer to ${recipients.length} client${recipients.length === 1 ? '' : 's'}?`,
        detail: 'Each client with an email on file will receive the same message via SMTP.',
        buttons: ['Send to all', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
      })
    : await dialog.showMessageBox({
        type: 'question',
        title: 'Send offer to all clients',
        message: `Send this offer to ${recipients.length} clients?`,
        buttons: ['Send to all', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
      });

  if (confirm.response !== 0) {
    return {
      attempted: recipients.length,
      sent: 0,
      failed: 0,
      skipped: recipients.length,
      message: '',
      cancelled: true,
    };
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const personalized = body
      .replace(/\{\{\s*firstName\s*\}\}/gi, recipient.firstName)
      .replace(/\{\{\s*clientName\s*\}\}/gi, recipient.firstName);
    try {
      await sendSmtpEmail({
        to: recipient.email,
        subject,
        text: personalized,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    attempted: recipients.length,
    sent,
    failed,
    skipped: 0,
    message:
      failed > 0
        ? `Sent ${sent} of ${recipients.length}. ${failed} failed.`
        : `Sent offer to ${sent} client${sent === 1 ? '' : 's'}.`,
  };
}
