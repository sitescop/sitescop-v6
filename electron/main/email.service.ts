import { BrowserWindow, clipboard, dialog, shell } from 'electron';
import { existsSync } from 'node:fs';
import type { Database as SqlDatabase } from 'sql.js';
import type { SessionUser } from '../../shared/api-types.js';
import {
  SITESCOP_COMPANY_EMAIL,
  SITESCOP_COMPANY_NAME,
  SITESCOP_COMPANY_PHONE,
} from '../../shared/company-branding.js';
import { getJobDetail } from './jobs.service.js';

export interface ComposeEmailResult {
  clientEmail: string;
  method: 'zoho';
  message: string;
  cancelled?: boolean;
}

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

function reportEmailSubject(jobNumber: string): string {
  return `Your Inspection Report — ${jobNumber}`;
}

function reportEmailBody(params: {
  clientName: string;
  propertyAddress: string;
  jobNumber: string;
  inspectionNumber: string;
  reportLabel: string;
}): string {
  const firstName = params.clientName.split(' ')[0] || 'Client';
  return `Dear ${firstName},

Your ${params.reportLabel.toLowerCase()} for ${params.propertyAddress} is ready.

Job: ${params.jobNumber}
Inspection: ${params.inspectionNumber}

Please find the PDF report attached.

If you have any questions, reply to this email or call us on ${SITESCOP_COMPANY_PHONE}.

Kind regards,
${SITESCOP_COMPANY_NAME}`;
}

function generalEmailBody(clientName: string, jobNumber: string, propertyAddress: string): string {
  const firstName = clientName.split(' ')[0] || 'Client';
  return `Dear ${firstName},

This is regarding your inspection at ${propertyAddress} (${jobNumber}).

Kind regards,
${SITESCOP_COMPANY_NAME}`;
}

function appendPdfAttachmentNote(body: string, pdfPath: string): string {
  return `${body}

---
Attach PDF: copy the path below, click Attach in Zoho, paste into the file box, then delete these lines before sending.

${pdfPath}`;
}

/**
 * Opens Zoho Mail compose in the browser — avoids Windows mailto: which launches Outlook first.
 * @see https://www.zoho.com/blog/general/make-zoho-mail-your-mail-client-in-firefox-3x.html
 */
function openZohoCompose(to: string, subject: string, body: string): void {
  const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const zohoUrl = `https://mail.zoho.com.au/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct=${encodeURIComponent(mailtoLink)}`;
  void shell.openExternal(zohoUrl);
}

function parentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
}

async function promptAndOpenEmail(options: {
  clientEmail: string;
  subject: string;
  body: string;
  pdfPath?: string;
}): Promise<ComposeEmailResult> {
  const pdfSteps = options.pdfPath
    ? `\n3. Copy the PDF path at the bottom of the email → Attach in Zoho → paste the path → delete those lines before sending.`
    : '';

  const parent = parentWindow();
  const messageOptions: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'Send email to client (Zoho)',
    message: `Client email: ${options.clientEmail}`,
    detail: `Outlook will NOT open — SiteScop opens Zoho Mail directly.

Steps:
1. Click OK — Zoho Mail opens in your browser (log in if asked).
2. Check the To field has the client email; if not, press Ctrl+V (copied to clipboard).
${pdfSteps}`,
    buttons: ['OK — open Zoho', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  };

  const { response } = parent
    ? await dialog.showMessageBox(parent, messageOptions)
    : await dialog.showMessageBox(messageOptions);

  if (response !== 0) {
    return {
      clientEmail: options.clientEmail,
      method: 'zoho',
      message: '',
      cancelled: true,
    };
  }

  clipboard.writeText(options.clientEmail);

  const emailBody =
    options.pdfPath && existsSync(options.pdfPath)
      ? appendPdfAttachmentNote(options.body, options.pdfPath)
      : options.body;

  openZohoCompose(options.clientEmail, options.subject, emailBody);

  if (options.pdfPath && existsSync(options.pdfPath)) {
    return {
      clientEmail: options.clientEmail,
      method: 'zoho',
      message: `Zoho opened (not Outlook). PDF path is at the bottom of the email — copy into Attach, then delete those lines.`,
    };
  }

  return {
    clientEmail: options.clientEmail,
    method: 'zoho',
    message: `Zoho opened (not Outlook). Client email copied — paste in To if needed (Ctrl+V).`,
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

  const clientEmail = resolveClientEmail(db, jobId, job.email);
  const subject = `Inspection ${job.jobNumber}`;
  const body = generalEmailBody(job.clientName, job.jobNumber, job.propertyAddress);

  return promptAndOpenEmail({ clientEmail, subject, body });
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
  const clientEmail = resolveClientEmail(db, jobId, String(row.client_email));
  const filePath = String(row.file_path);

  if (!existsSync(filePath)) {
    throw new Error('PDF file not found. Regenerate the report first.');
  }

  const reportType = String(row.report_type);
  const reportLabel = reportType === 'PEST' ? 'Pest inspection report' : 'Building inspection report';
  const subject = reportEmailSubject(String(row.job_number));
  const body = reportEmailBody({
    clientName: String(row.client_name),
    propertyAddress: String(row.property_address),
    jobNumber: String(row.job_number),
    inspectionNumber: String(row.inspection_number),
    reportLabel,
  });

  return promptAndOpenEmail({ clientEmail, subject, body, pdfPath: filePath });
}
