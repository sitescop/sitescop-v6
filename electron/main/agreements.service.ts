import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { Database as SqlDatabase } from 'sql.js';
import type {
  AgreementDetail,
  AgreementRow,
  AgreementStatus,
  CreateAgreementInput,
  InspectionType,
  PublicAgreementView,
  SessionUser,
  SignAgreementInput,
  UpdateAgreementInput,
} from '../../shared/api-types.js';
import {
  DEFAULT_REPORT_SETTINGS,
  SITESCOP_PDF_FOOTER_TEXT,
} from '../../shared/company-branding.js';
import { getResolvedCompanyBranding, getResolvedReportSettings } from './settings.service.js';
import { generateAgreementPdf } from '../../shared/report-pdf/src/index.js';
import {
  ensureAgreementLegalPath,
  inspectionTypeLabel,
  loadLegalSectionsForType,
  resolveLegalSections,
  type AgreementLegalContent,
} from './agreement-legal.js';
import { setLegalBasePath } from '../../shared/report-pdf/src/legal-loader.js';
import { getJobDetail } from './jobs.service.js';

const GST_RATE = 10;

const DEFAULT_PRICES: Record<InspectionType, number> = {
  BUILDING: 55000,
  PEST: 35000,
  COMBINED: 85000,
};

function calculatePricing(priceCents: number) {
  const gstCents = Math.round(priceCents * (GST_RATE / 100));
  return { gstCents, totalCents: priceCents + gstCents };
}

function mapAgreementRow(row: Record<string, unknown>): AgreementRow {
  return {
    id: String(row.id),
    agreementNumber: String(row.agreementNumber),
    jobId: row.jobId ? String(row.jobId) : null,
    jobNumber: row.jobNumber ? String(row.jobNumber) : null,
    status: row.status as AgreementStatus,
    inspectionType: row.inspectionType as InspectionType,
    clientName: String(row.clientName),
    clientEmail: String(row.clientEmail),
    clientPhone: row.clientPhone ? String(row.clientPhone) : null,
    propertyAddress: String(row.propertyAddress),
    priceCents: Number(row.priceCents),
    gstCents: Number(row.gstCents),
    totalCents: Number(row.totalCents),
    agreementDate: String(row.agreementDate),
    notes: row.notes ? String(row.notes) : null,
    sentAt: row.sentAt ? String(row.sentAt) : null,
    signedAt: row.signedAt ? String(row.signedAt) : null,
    createdAt: String(row.createdAt),
  };
}

function mapAgreementDetail(row: Record<string, unknown>): AgreementDetail {
  const legalSections = JSON.parse(String(row.legalSections ?? '{"sections":[]}')) as AgreementLegalContent;
  return {
    ...mapAgreementRow(row),
    legalSections,
    accessToken: row.accessToken ? String(row.accessToken) : null,
    signatureName: row.signatureName ? String(row.signatureName) : null,
    signatureData: row.signatureData ? String(row.signatureData) : null,
    pdfPath: row.pdfPath ? String(row.pdfPath) : null,
    updatedAt: String(row.updatedAt),
  };
}

function queryAgreementRows(db: SqlDatabase, sql: string, params: (string | number)[] = []): AgreementRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: AgreementRow[] = [];
  while (stmt.step()) {
    rows.push(mapAgreementRow(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();
  return rows;
}

export function nextAgreementNumber(db: SqlDatabase): string {
  const year = new Date().getFullYear();
  const prefix = `AGR-${year}-`;
  const stmt = db.prepare(
    `SELECT agreement_number FROM agreements WHERE agreement_number LIKE ? ORDER BY agreement_number DESC LIMIT 1`,
  );
  stmt.bind([`${prefix}%`]);
  let nextSeq = 1;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { agreement_number: string };
    const parsed = Number.parseInt(row.agreement_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) nextSeq = parsed + 1;
  }
  stmt.free();
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

function syncJobAgreementStatus(db: SqlDatabase, jobId: string | null, status: AgreementStatus) {
  if (!jobId) return;
  let jobStatus: 'NONE' | 'DRAFT' | 'SENT' | 'SIGNED' = 'NONE';
  if (status === 'DRAFT') jobStatus = 'DRAFT';
  else if (status === 'SENT' || status === 'VIEWED') jobStatus = 'SENT';
  else if (status === 'SIGNED') jobStatus = 'SIGNED';
  db.run(
    `UPDATE jobs SET agreement_status = ?, updated_at = datetime('now') WHERE id = ?`,
    [jobStatus, jobId],
  );
}

function generateAccessToken(): string {
  return randomBytes(24).toString('hex');
}

function agreementsRoot(): string {
  return join(app.getPath('userData'), 'agreements');
}

function ensurePdfLegalPath(): void {
  setLegalBasePath(ensureAgreementLegalPath());
}

export function listAgreements(
  db: SqlDatabase,
  filter?: { status?: AgreementStatus | ''; search?: string },
): AgreementRow[] {
  const clauses = [`IFNULL(a.deleted_at, '') = ''`];
  const params: string[] = [];

  if (filter?.status) {
    clauses.push('a.status = ?');
    params.push(filter.status);
  }

  if (filter?.search?.trim()) {
    clauses.push(`(
      lower(a.agreement_number) LIKE ? OR
      lower(a.client_name) LIKE ? OR
      lower(a.property_address) LIKE ? OR
      lower(a.client_email) LIKE ? OR
      lower(IFNULL(j.job_number, '')) LIKE ?
    )`);
    const term = `%${filter.search.trim().toLowerCase()}%`;
    params.push(term, term, term, term, term);
  }

  return queryAgreementRows(
    db,
    `SELECT
       a.id,
       a.agreement_number AS agreementNumber,
       a.job_id AS jobId,
       j.job_number AS jobNumber,
       a.status,
       a.inspection_type AS inspectionType,
       a.client_name AS clientName,
       a.client_email AS clientEmail,
       a.client_phone AS clientPhone,
       a.property_address AS propertyAddress,
       a.price_cents AS priceCents,
       a.gst_cents AS gstCents,
       a.total_cents AS totalCents,
       a.agreement_date AS agreementDate,
       a.notes,
       a.sent_at AS sentAt,
       a.signed_at AS signedAt,
       a.created_at AS createdAt
     FROM agreements a
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY a.created_at DESC`,
    params,
  );
}

export function getAgreement(db: SqlDatabase, agreementId: string): AgreementDetail | null {
  const stmt = db.prepare(
    `SELECT
       a.*,
       j.job_number AS jobNumber
     FROM agreements a
     LEFT JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ? AND IFNULL(a.deleted_at, '') = ''`,
  );
  stmt.bind([agreementId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return mapAgreementDetail({
    ...row,
    id: row.id,
    agreementNumber: row.agreement_number,
    jobId: row.job_id,
    inspectionType: row.inspection_type,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    propertyAddress: row.property_address,
    priceCents: row.price_cents,
    gstCents: row.gst_cents,
    totalCents: row.total_cents,
    agreementDate: row.agreement_date,
    legalSections: row.legal_sections,
    accessToken: row.access_token,
    signatureName: row.signature_name,
    signatureData: row.signature_data,
    pdfPath: row.pdf_path,
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function findByToken(db: SqlDatabase, token: string): AgreementDetail | null {
  const stmt = db.prepare(`SELECT id FROM agreements WHERE access_token = ?`);
  stmt.bind([token]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as { id: string };
  stmt.free();
  return getAgreement(db, row.id);
}

export function createAgreement(db: SqlDatabase, input: CreateAgreementInput): AgreementDetail {
  const id = randomUUID();
  const agreementNumber = nextAgreementNumber(db);
  const priceCents = input.priceCents ?? DEFAULT_PRICES[input.inspectionType];
  const { gstCents, totalCents } = calculatePricing(priceCents);
  const legalSections = loadLegalSectionsForType(input.inspectionType);
  const agreementDate = input.agreementDate ?? new Date().toISOString().slice(0, 10);

  db.run(
    `INSERT INTO agreements (
       id, agreement_number, job_id, status, inspection_type,
       client_name, client_email, client_phone, property_address,
       price_cents, gst_cents, total_cents, agreement_date, notes, legal_sections
     ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      agreementNumber,
      input.jobId ?? null,
      input.inspectionType,
      input.clientName.trim(),
      input.clientEmail.trim().toLowerCase(),
      input.clientPhone?.trim() || null,
      input.propertyAddress.trim(),
      priceCents,
      gstCents,
      totalCents,
      agreementDate,
      input.notes?.trim() || null,
      JSON.stringify(legalSections),
    ],
  );

  if (input.jobId) {
    syncJobAgreementStatus(db, input.jobId, 'DRAFT');
  }

  return getAgreement(db, id)!;
}

export function createAgreementFromJob(db: SqlDatabase, jobId: string): AgreementDetail {
  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found.');

  const existing = db.prepare(`SELECT id FROM agreements WHERE job_id = ? AND status != 'CANCELLED' LIMIT 1`);
  existing.bind([jobId]);
  if (existing.step()) {
    const row = existing.getAsObject() as { id: string };
    existing.free();
    return getAgreement(db, row.id)!;
  }
  existing.free();

  return createAgreement(db, {
    jobId,
    inspectionType: job.inspectionType,
    clientName: job.clientName,
    clientEmail: job.email || `client+${job.jobNumber.toLowerCase()}@sitescop.local`,
    clientPhone: job.mobile || undefined,
    propertyAddress: job.propertyAddress,
    priceCents: DEFAULT_PRICES[job.inspectionType],
    notes: job.notes,
  });
}

export function updateAgreement(
  db: SqlDatabase,
  agreementId: string,
  input: UpdateAgreementInput,
): AgreementDetail {
  const existing = getAgreement(db, agreementId);
  if (!existing) throw new Error('Agreement not found.');
  if (existing.status !== 'DRAFT') throw new Error('Only draft agreements can be edited.');

  const inspectionType = input.inspectionType ?? existing.inspectionType;
  const priceCents = input.priceCents ?? existing.priceCents;
  const { gstCents, totalCents } = calculatePricing(priceCents);
  const legalSections =
    input.inspectionType && input.inspectionType !== existing.inspectionType
      ? loadLegalSectionsForType(inspectionType)
      : existing.legalSections;

  db.run(
    `UPDATE agreements SET
       inspection_type = ?,
       client_name = ?,
       client_email = ?,
       client_phone = ?,
       property_address = ?,
       price_cents = ?,
       gst_cents = ?,
       total_cents = ?,
       agreement_date = ?,
       notes = ?,
       legal_sections = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
    [
      inspectionType,
      (input.clientName ?? existing.clientName).trim(),
      (input.clientEmail ?? existing.clientEmail).trim().toLowerCase(),
      input.clientPhone !== undefined ? input.clientPhone?.trim() || null : existing.clientPhone,
      (input.propertyAddress ?? existing.propertyAddress).trim(),
      priceCents,
      gstCents,
      totalCents,
      input.agreementDate ?? existing.agreementDate,
      input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
      JSON.stringify(legalSections),
      agreementId,
    ],
  );

  return getAgreement(db, agreementId)!;
}

export function sendAgreement(db: SqlDatabase, agreementId: string): { signingUrl: string; accessToken: string } {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(agreement.status)) {
    throw new Error('This agreement cannot be sent.');
  }

  const accessToken = agreement.accessToken ?? generateAccessToken();
  db.run(
    `UPDATE agreements SET
       status = 'SENT',
       access_token = ?,
       sent_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
    [accessToken, agreementId],
  );

  syncJobAgreementStatus(db, agreement.jobId, 'SENT');

  const signingUrl = `#/agreements/sign/${accessToken}`;
  return { signingUrl, accessToken };
}

export function getPublicAgreement(db: SqlDatabase, token: string): PublicAgreementView | null {
  const agreement = findByToken(db, token);
  if (!agreement) return null;

  return {
    id: agreement.id,
    agreementNumber: agreement.agreementNumber,
    status: agreement.status,
    inspectionType: agreement.inspectionType,
    ...(() => {
      const branding = getResolvedCompanyBranding();
      return {
        companyName: branding.name,
        companyPhone: branding.phone,
        companyWebsite: branding.website,
        companyEmail: branding.email,
        companyAbn: branding.abn,
      };
    })(),
    clientName: agreement.clientName,
    clientEmail: agreement.clientEmail,
    propertyAddress: agreement.propertyAddress,
    priceCents: agreement.priceCents,
    gstCents: agreement.gstCents,
    totalCents: agreement.totalCents,
    agreementDate: agreement.agreementDate,
    legalSections: resolveLegalSections(agreement.legalSections, agreement.inspectionType),
    canSign: agreement.status === 'SENT' || agreement.status === 'VIEWED',
  };
}

export function markAgreementViewed(db: SqlDatabase, token: string): void {
  const agreement = findByToken(db, token);
  if (!agreement || agreement.status !== 'SENT') return;
  db.run(
    `UPDATE agreements SET status = 'VIEWED', viewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [agreement.id],
  );
}

export async function signAgreement(
  db: SqlDatabase,
  token: string,
  input: SignAgreementInput,
  user?: SessionUser,
): Promise<{ agreementNumber: string; jobId: string | null }> {
  void user;
  const agreement = findByToken(db, token);
  if (!agreement) throw new Error('Agreement link is invalid or expired.');
  if (agreement.status !== 'SENT' && agreement.status !== 'VIEWED') {
    throw new Error('This agreement cannot be signed.');
  }
  if (!input.signatureName.trim()) throw new Error('Signature name is required.');
  if (!input.signatureData.trim()) throw new Error('Please sign in the signature box.');

  db.run(
    `UPDATE agreements SET
       status = 'SIGNED',
       signature_name = ?,
       signature_data = ?,
       signed_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
    [input.signatureName.trim(), input.signatureData, agreement.id],
  );

  syncJobAgreementStatus(db, agreement.jobId, 'SIGNED');

  const signed = getAgreement(db, agreement.id)!;
  await generateAgreementPdfFile(db, signed);

  return { agreementNumber: signed.agreementNumber, jobId: signed.jobId };
}

export function cancelAgreement(db: SqlDatabase, agreementId: string): void {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');
  if (agreement.status === 'SIGNED') throw new Error('Signed agreements cannot be cancelled.');
  db.run(
    `UPDATE agreements SET status = 'CANCELLED', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [agreementId],
  );
  if (agreement.jobId) {
    db.run(`UPDATE jobs SET agreement_status = 'NONE', updated_at = datetime('now') WHERE id = ?`, [
      agreement.jobId,
    ]);
  }
}

export function softDeleteAgreement(db: SqlDatabase, agreementId: string): void {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');

  db.run(
    `UPDATE agreements SET
       deleted_at = datetime('now'),
       deleted_reason = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
    [`Removed from list (${agreement.status})`, agreementId],
  );

  if (agreement.jobId) {
    db.run(`UPDATE jobs SET agreement_status = 'NONE', updated_at = datetime('now') WHERE id = ?`, [
      agreement.jobId,
    ]);
  }
}

const DELETED_AGREEMENT_SELECT = `
  SELECT
    a.id,
    a.agreement_number AS agreementNumber,
    a.job_id AS jobId,
    j.job_number AS jobNumber,
    a.status,
    a.inspection_type AS inspectionType,
    a.client_name AS clientName,
    a.client_email AS clientEmail,
    a.client_phone AS clientPhone,
    a.property_address AS propertyAddress,
    a.price_cents AS priceCents,
    a.gst_cents AS gstCents,
    a.total_cents AS totalCents,
    a.agreement_date AS agreementDate,
    a.notes,
    a.sent_at AS sentAt,
    a.signed_at AS signedAt,
    a.created_at AS createdAt,
    a.deleted_at AS deletedAt,
    a.deleted_reason AS deletedReason
  FROM agreements a
  LEFT JOIN jobs j ON j.id = a.job_id
  WHERE IFNULL(a.deleted_at, '') != ''
`;

export function listDeletedAgreements(db: SqlDatabase): Array<
  AgreementRow & { deletedAt: string; deletedReason: string | null }
> {
  const stmt = db.prepare(`${DELETED_AGREEMENT_SELECT} ORDER BY a.deleted_at DESC`);
  const rows: Array<AgreementRow & { deletedAt: string; deletedReason: string | null }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      ...mapAgreementRow(row),
      deletedAt: String(row.deletedAt),
      deletedReason: row.deletedReason ? String(row.deletedReason) : null,
    });
  }
  stmt.free();
  return rows;
}

export function restoreAgreement(db: SqlDatabase, agreementId: string) {
  const stmt = db.prepare(
    `SELECT id, status, job_id AS jobId FROM agreements WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
  );
  stmt.bind([agreementId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Deleted agreement not found in the recycle bin.');
  }
  const row = stmt.getAsObject() as { id: string; status: AgreementStatus; jobId: string | null };
  stmt.free();

  db.run(
    `UPDATE agreements SET deleted_at = NULL, deleted_reason = NULL, updated_at = datetime('now') WHERE id = ?`,
    [agreementId],
  );

  if (row.jobId) {
    syncJobAgreementStatus(db, row.jobId, row.status);
  }
}

export function permanentlyDeleteAgreement(db: SqlDatabase, agreementId: string) {
  const stmt = db.prepare(
    `SELECT pdf_path AS pdfPath FROM agreements WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
  );
  stmt.bind([agreementId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Deleted agreement not found in the recycle bin.');
  }
  const row = stmt.getAsObject() as { pdfPath: string | null };
  stmt.free();

  db.run(`DELETE FROM agreements WHERE id = ?`, [agreementId]);

  if (row.pdfPath) {
    try {
      unlinkSync(row.pdfPath);
    } catch {
      // PDF may already be missing
    }
  }
}

async function generateAgreementPdfFile(db: SqlDatabase, agreement: AgreementDetail): Promise<string> {
  ensurePdfLegalPath();
  const root = agreementsRoot();
  await mkdir(root, { recursive: true });
  const fileName = `${agreement.agreementNumber.replace(/[^\w-]+/g, '-')}.pdf`;
  const filePath = join(root, fileName);

  const buffer = await generateAgreementPdf({
    company: getResolvedCompanyBranding(),
    agreementNumber: agreement.agreementNumber,
    agreementDate: agreement.agreementDate,
    typeLabel: inspectionTypeLabel(agreement.inspectionType),
    clientName: agreement.clientName,
    clientEmail: agreement.clientEmail,
    clientPhone: agreement.clientPhone,
    propertyAddress: agreement.propertyAddress,
    priceCents: agreement.priceCents,
    gstCents: agreement.gstCents,
    totalCents: agreement.totalCents,
    legalSections: agreement.legalSections.sections.map((s) => ({
      title: s.title,
      content: s.content,
    })),
    signatureName: agreement.signatureName,
    signatureData: agreement.signatureData,
    signedAt: agreement.signedAt,
    notes: agreement.notes,
    footerText: SITESCOP_PDF_FOOTER_TEXT,
    primaryColor: DEFAULT_REPORT_SETTINGS.primaryColor,
    secondaryColor: DEFAULT_REPORT_SETTINGS.secondaryColor,
    pdfIncludeLogo: DEFAULT_REPORT_SETTINGS.pdfIncludeLogo,
  });

  await writeFile(filePath, buffer);
  db.run(`UPDATE agreements SET pdf_path = ?, updated_at = datetime('now') WHERE id = ?`, [
    filePath,
    agreement.id,
  ]);
  return filePath;
}

export async function generateAgreementPdfForId(db: SqlDatabase, agreementId: string): Promise<string> {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');
  return generateAgreementPdfFile(db, agreement);
}

export { DEFAULT_PRICES };
