import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { Database as SqlDatabase } from 'sql.js';
import type {
  AgreementDetail,
  AgreementLegalSection,
  AgreementRow,
  AgreementSignerRole,
  AgreementStatus,
  CreateAgreementInput,
  CreateJobResult,
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
import { getResolvedCompanyBranding, getResolvedReportSettings, getDefaultInspectionPriceCents, getReportLogoPreviewDataUrl } from './settings.service.js';
import { generateAgreementPdf } from '../../shared/report-pdf/src/index.js';
import {
  ensureAgreementLegalPath,
  inspectionTypeLabel,
  loadLegalSectionsForType,
  resolveLegalSections,
  buildAgentAuthoritySection,
  withAgentAuthoritySection,
  type AgreementLegalContent,
} from './agreement-legal.js';
import { setLegalBasePath } from '../../shared/report-pdf/src/legal-loader.js';
import {
  calculatePricingFromExCents,
  gstPricePairFromExCents,
} from '../../shared/gst-pricing.js';
import { createJob, getJobDetail } from './jobs.service.js';

function calculatePricing(priceCents: number) {
  const { gstCents, totalCents } = calculatePricingFromExCents(priceCents);
  return { gstCents, totalCents };
}

function parseSignerRole(value: unknown): AgreementSignerRole {
  return value === 'AGENT' ? 'AGENT' : 'CLIENT';
}

function mapAgreementRow(row: Record<string, unknown>): AgreementRow {
  return {
    id: String(row.id),
    agreementNumber: String(row.agreementNumber),
    jobId: row.jobId ? String(row.jobId) : null,
    jobNumber: row.jobNumber ? String(row.jobNumber) : null,
    status: row.status as AgreementStatus,
    inspectionType: row.inspectionType as InspectionType,
    signerRole: parseSignerRole(row.signerRole ?? row.signer_role),
    agencyName: row.agencyName || row.agency_name ? String(row.agencyName ?? row.agency_name) : null,
    agentName: row.agentName || row.agent_name ? String(row.agentName ?? row.agent_name) : null,
    agentEmail: row.agentEmail || row.agent_email ? String(row.agentEmail ?? row.agent_email) : null,
    signedOnBehalfOf:
      row.signedOnBehalfOf || row.signed_on_behalf_of
        ? String(row.signedOnBehalfOf ?? row.signed_on_behalf_of)
        : null,
    agentAuthorityAccepted: Boolean(Number(row.agentAuthorityAccepted ?? row.agent_authority_accepted ?? 0)),
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
       a.signer_role AS signerRole,
       a.agency_name AS agencyName,
       a.agent_name AS agentName,
       a.agent_email AS agentEmail,
       a.signed_on_behalf_of AS signedOnBehalfOf,
       a.agent_authority_accepted AS agentAuthorityAccepted,
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
    signerRole: row.signer_role,
    agencyName: row.agency_name,
    agentName: row.agent_name,
    agentEmail: row.agent_email,
    signedOnBehalfOf: row.signed_on_behalf_of,
    agentAuthorityAccepted: row.agent_authority_accepted,
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
  const priceCents = input.priceCents ?? getDefaultInspectionPriceCents(input.inspectionType);
  const { gstCents, totalCents } = calculatePricing(priceCents);
  const legalSections = loadLegalSectionsForType(input.inspectionType);
  const agreementDate = input.agreementDate ?? new Date().toISOString().slice(0, 10);
  const agentFields = resolveCreateAgentFields(db, input);

  db.run(
    `INSERT INTO agreements (
       id, agreement_number, job_id, status, inspection_type,
       signer_role, agency_name, agent_name, agent_email,
       client_name, client_email, client_phone, property_address,
       price_cents, gst_cents, total_cents, agreement_date, notes, legal_sections
     ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      agreementNumber,
      input.jobId ?? null,
      input.inspectionType,
      agentFields.signerRole,
      agentFields.agencyName,
      agentFields.agentName,
      agentFields.agentEmail,
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

  const created = getAgreement(db, id)!;
  if (input.jobId) {
    syncAgentDetailsFromJob(db, id);
  }
  return resolveAgreementAgentView(db, getAgreement(db, id)! ?? created);
}

export function createAgreementFromJob(db: SqlDatabase, jobId: string): AgreementDetail {
  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found.');

  /** Prefer an active (unsigned) agreement for workflow; fall back to latest signed. */
  const existing = db.prepare(
    `SELECT id FROM agreements
     WHERE job_id = ?
       AND status != 'CANCELLED'
       AND IFNULL(deleted_at, '') = ''
     ORDER BY
       CASE status
         WHEN 'DRAFT' THEN 0
         WHEN 'SENT' THEN 1
         WHEN 'VIEWED' THEN 2
         WHEN 'SIGNED' THEN 3
         ELSE 4
       END,
       updated_at DESC
     LIMIT 1`,
  );
  existing.bind([jobId]);
  if (existing.step()) {
    const row = existing.getAsObject() as { id: string };
    existing.free();
    syncAgentDetailsFromJob(db, row.id);
    return resolveAgreementAgentView(db, getAgreement(db, row.id)!);
  }
  existing.free();

  return createAgreement(db, {
    jobId,
    inspectionType: job.inspectionType,
    clientName: job.clientName,
    clientEmail: job.email || `client+${job.jobNumber.toLowerCase()}@sitescop.local`,
    clientPhone: job.mobile || undefined,
    propertyAddress: job.propertyAddress,
    priceCents: getDefaultInspectionPriceCents(job.inspectionType),
    notes: job.notes,
    signerRole: 'CLIENT',
    agencyName: job.realEstate?.trim() || undefined,
    agentName: job.agentName?.trim() || undefined,
    agentEmail: job.agentEmail?.trim() || undefined,
  });
}

/**
 * Creates a new DRAFT agreement from a signed one so the client can change
 * inspection type / price. The original signed agreement is kept on file.
 */
export function createRevisedAgreement(db: SqlDatabase, signedAgreementId: string): AgreementDetail {
  const source = getAgreement(db, signedAgreementId);
  if (!source) throw new Error('Agreement not found.');
  if (source.status !== 'SIGNED') {
    throw new Error('Only a signed agreement can be revised. Use Edit on a draft instead.');
  }

  if (source.jobId) {
    const active = db.prepare(
      `SELECT id, agreement_number AS agreementNumber, status
       FROM agreements
       WHERE job_id = ?
         AND id != ?
         AND status IN ('DRAFT', 'SENT', 'VIEWED')
         AND IFNULL(deleted_at, '') = ''
       ORDER BY updated_at DESC
       LIMIT 1`,
    );
    active.bind([source.jobId, signedAgreementId]);
    if (active.step()) {
      const row = active.getAsObject() as { id: string; agreementNumber: string; status: string };
      active.free();
      throw new Error(
        `A revised agreement (${row.agreementNumber}) is already in progress (${row.status}). Open that agreement instead.`,
      );
    }
    active.free();
  }

  const revisionNote = `Revised from ${source.agreementNumber}. Previous signed agreement kept on file.`;
  const combinedNotes = [revisionNote, source.notes?.trim()].filter(Boolean).join('\n\n');

  const revised = createAgreement(db, {
    jobId: source.jobId ?? undefined,
    inspectionType: source.inspectionType,
    clientName: source.clientName,
    clientEmail: source.clientEmail,
    clientPhone: source.clientPhone ?? undefined,
    propertyAddress: source.propertyAddress,
    priceCents: source.priceCents,
    notes: combinedNotes,
    signerRole: 'CLIENT',
    agencyName: source.agencyName ?? undefined,
    agentName: source.agentName ?? undefined,
    agentEmail: source.agentEmail ?? undefined,
  });

  const supersedeNote = `Superseded by ${revised.agreementNumber} (revised agreement).`;
  const sourceNotes = [source.notes?.trim(), supersedeNote].filter(Boolean).join('\n\n');
  db.run(`UPDATE agreements SET notes = ?, updated_at = datetime('now') WHERE id = ?`, [
    sourceNotes,
    source.id,
  ]);

  return resolveAgreementAgentView(db, getAgreement(db, revised.id)!);
}

function splitAgreementClientName(clientName: string): { firstName: string; lastName: string } {
  const trimmed = clientName.trim();
  if (!trimmed) return { firstName: 'Client', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export async function createJobFromSignedAgreement(
  db: SqlDatabase,
  agreementId: string,
): Promise<CreateJobResult & { agreement: AgreementDetail }> {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');
  if (agreement.status !== 'SIGNED') {
    throw new Error('Only signed agreements can be converted to a job.');
  }
  if (agreement.jobId) {
    throw new Error('This agreement is already linked to a job.');
  }

  const { firstName, lastName } = splitAgreementClientName(agreement.clientName);
  const inspectionDate =
    agreement.signedAt?.slice(0, 10) ||
    agreement.agreementDate ||
    new Date().toISOString().slice(0, 10);
  const hasAgent = Boolean(agreement.agencyName?.trim() || agreement.agentName?.trim());

  const result = createJob(db, {
    clientFirstName: firstName,
    clientLastName: lastName,
    clientEmail: agreement.clientEmail || undefined,
    clientMobile: agreement.clientPhone || undefined,
    propertyAddress: agreement.propertyAddress,
    inspectionType: agreement.inspectionType,
    inspectionDate,
    inspectionTime: '09:00',
    realEstate: agreement.agencyName?.trim() || undefined,
    orderingPartyType: hasAgent ? 'Agent' : undefined,
    agentName: agreement.agentName?.trim() || undefined,
    agentEmail: agreement.agentEmail?.trim() || undefined,
    notes: agreement.notes?.trim() || undefined,
  });

  db.run(`UPDATE agreements SET job_id = ?, updated_at = datetime('now') WHERE id = ?`, [
    result.job.id,
    agreementId,
  ]);
  syncJobAgreementStatus(db, result.job.id, 'SIGNED');

  try {
    const { generateInvoicePdfForJob } = await import('./invoices.service.js');
    await generateInvoicePdfForJob(db, result.job.id);
  } catch {
    // Invoice can be generated later from the job or client screen.
  }

  const linked = getAgreement(db, agreementId)!;
  return { ...result, agreement: linked };
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
  const signerRole = input.signerRole ?? existing.signerRole;
  const agencyName =
    input.agencyName !== undefined ? input.agencyName?.trim() || null : existing.agencyName;
  const agentName = input.agentName !== undefined ? input.agentName?.trim() || null : existing.agentName;
  const agentEmail =
    input.agentEmail !== undefined ? input.agentEmail?.trim().toLowerCase() || null : existing.agentEmail;

  db.run(
    `UPDATE agreements SET
       inspection_type = ?,
       signer_role = ?,
       agency_name = ?,
       agent_name = ?,
       agent_email = ?,
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
      signerRole,
      agencyName,
      agentName,
      agentEmail,
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

  syncAgentDetailsFromJob(db, agreementId);
  return resolveAgreementAgentView(db, getAgreement(db, agreementId)!);
}

function getAvailableAgentContext(
  db: SqlDatabase,
  agreement: AgreementDetail,
): {
  agencyName: string | null;
  agentName: string | null;
  agentEmail: string | null;
} {
  if (agreement.agentName?.trim()) {
    return {
      agencyName: agreement.agencyName,
      agentName: agreement.agentName.trim(),
      agentEmail: agreement.agentEmail,
    };
  }

  if (agreement.jobId) {
    const job = getJobDetail(db, agreement.jobId);
    if (job?.agentName?.trim()) {
      return {
        agencyName: job.realEstate?.trim() || agreement.agencyName,
        agentName: job.agentName.trim(),
        agentEmail: job.agentEmail?.trim().toLowerCase() || agreement.agentEmail,
      };
    }
  }

  return {
    agencyName: agreement.agencyName,
    agentName: agreement.agentName,
    agentEmail: agreement.agentEmail,
  };
}

function resolveAgentSigningContext(db: SqlDatabase, agreement: AgreementDetail) {
  const agentCtx = getAvailableAgentContext(db, agreement);
  if (agentCtx.agentName) {
    return {
      signerRole: 'AGENT' as const,
      agencyName: agentCtx.agencyName,
      agentName: agentCtx.agentName,
      agentEmail: agentCtx.agentEmail,
    };
  }

  return {
    signerRole: agreement.signerRole,
    agencyName: agreement.agencyName,
    agentName: agreement.agentName,
    agentEmail: agreement.agentEmail,
  };
}

export function syncAgentDetailsFromJob(db: SqlDatabase, agreementId: string): void {
  const agreement = getAgreement(db, agreementId);
  if (!agreement?.jobId) return;
  const job = getJobDetail(db, agreement.jobId);
  if (!job?.agentName?.trim()) return;

  db.run(
    `UPDATE agreements SET
       agency_name = ?,
       agent_name = ?,
       agent_email = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
    [
      job.realEstate?.trim() || agreement.agencyName,
      job.agentName.trim(),
      job.agentEmail?.trim().toLowerCase() || agreement.agentEmail,
      agreementId,
    ],
  );
}

export function resolveAgreementAgentView(
  db: SqlDatabase,
  agreement: AgreementDetail,
): AgreementDetail {
  const agentCtx = getAvailableAgentContext(db, agreement);
  return {
    ...agreement,
    agencyName: agentCtx.agencyName,
    agentName: agentCtx.agentName,
    agentEmail: agentCtx.agentEmail,
  };
}

function resolveCreateAgentFields(
  db: SqlDatabase,
  input: CreateAgreementInput,
): {
  signerRole: AgreementSignerRole;
  agencyName: string | null;
  agentName: string | null;
  agentEmail: string | null;
} {
  if (input.agentName?.trim()) {
    return {
      signerRole: input.signerRole ?? 'AGENT',
      agencyName: input.agencyName?.trim() || null,
      agentName: input.agentName.trim(),
      agentEmail: input.agentEmail?.trim().toLowerCase() || null,
    };
  }

  if (input.jobId) {
    const job = getJobDetail(db, input.jobId);
    if (job?.agentName?.trim()) {
      return {
        signerRole: 'CLIENT',
        agencyName: job.realEstate?.trim() || null,
        agentName: job.agentName.trim(),
        agentEmail: job.agentEmail?.trim().toLowerCase() || null,
      };
    }
  }

  return {
    signerRole: input.signerRole ?? 'CLIENT',
    agencyName: input.agencyName?.trim() || null,
    agentName: null,
    agentEmail: null,
  };
}

export function sendAgreement(db: SqlDatabase, agreementId: string): { signingUrl: string; accessToken: string } {
  const agreement = getAgreement(db, agreementId);
  if (!agreement) throw new Error('Agreement not found.');
  if (agreement.status === 'SIGNED') {
    throw new Error('This agreement is already signed.');
  }
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(agreement.status)) {
    throw new Error('This agreement cannot be sent.');
  }

  syncAgentDetailsFromJob(db, agreementId);

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

  const agentCtx = getAvailableAgentContext(db, agreement);
  const agentSigningAvailable = Boolean(agentCtx.agentName?.trim());

  let legalSections = resolveLegalSections(agreement.legalSections, agreement.inspectionType);
  legalSections = {
    sections: legalSections.sections.filter((section) => section.id !== 'agent-authority'),
  };

  const agentAuthoritySection = agentSigningAvailable
    ? buildAgentAuthoritySection({
        agentName: agentCtx.agentName!,
        agencyName: agentCtx.agencyName,
        clientName: agreement.clientName,
        propertyAddress: agreement.propertyAddress,
      })
    : null;

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
        companyLogoUrl: getReportLogoPreviewDataUrl(),
      };
    })(),
    signerRole: agreement.signerRole,
    agencyName: agentCtx.agencyName,
    agentName: agentCtx.agentName,
    agentEmail: agentCtx.agentEmail,
    clientName: agreement.clientName,
    clientEmail: agreement.clientEmail,
    propertyAddress: agreement.propertyAddress,
    priceCents: agreement.priceCents,
    gstCents: agreement.gstCents,
    totalCents: agreement.totalCents,
    agreementDate: agreement.agreementDate,
    legalSections,
    canSign: agreement.status === 'SENT' || agreement.status === 'VIEWED',
    agentSigningAvailable,
    agentAuthoritySection,
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

  syncAgentDetailsFromJob(db, agreement.id);
  const refreshed = getAgreement(db, agreement.id)!;
  const agentCtx = getAvailableAgentContext(db, refreshed);
  const agentAvailable = Boolean(agentCtx.agentName?.trim());
  const signingParty: AgreementSignerRole =
    input.signingParty === 'AGENT' && agentAvailable ? 'AGENT' : 'CLIENT';

  if (!input.signatureName.trim()) throw new Error('Signature name is required.');
  if (!input.signatureData.trim()) throw new Error('Please sign in the signature box.');
  if (!input.declarationsAccepted) throw new Error('You must accept the agreement declarations.');
  if (signingParty === 'AGENT') {
    if (!input.agentAuthorityAccepted) {
      throw new Error('You must confirm the Agent Authority Declaration before signing.');
    }
  }

  const signedOnBehalfOf = signingParty === 'AGENT' ? agreement.clientName.trim() : null;
  const agentAuthorityAccepted = signingParty === 'AGENT' ? 1 : 0;

  db.run(
    `UPDATE agreements SET
       status = 'SIGNED',
       signer_role = ?,
       agency_name = ?,
       agent_name = ?,
       agent_email = ?,
       signature_name = ?,
       signature_data = ?,
       signed_on_behalf_of = ?,
       agent_authority_accepted = ?,
       signed_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
    [
      signingParty,
      agentCtx.agencyName,
      agentCtx.agentName,
      agentCtx.agentEmail,
      input.signatureName.trim(),
      input.signatureData,
      signedOnBehalfOf,
      agentAuthorityAccepted,
      agreement.id,
    ],
  );

  syncJobAgreementStatus(db, agreement.jobId, 'SIGNED');

  let signed = getAgreement(db, agreement.id)!;
  await generateAgreementPdfFile(db, signed);

  let jobId = signed.jobId;
  if (!jobId) {
    const created = await createJobFromSignedAgreement(db, agreement.id);
    jobId = created.job.id;
    signed = created.agreement;
  } else {
    const { generateInvoicePdfForJob } = await import('./invoices.service.js');
    try {
      await generateInvoicePdfForJob(db, jobId);
    } catch {
      // Invoice can be generated later from the client or job screen
    }
  }

  return { agreementNumber: signed.agreementNumber, jobId };
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
    signerRole: agreement.signerRole,
    signedOnBehalfOf: agreement.signedOnBehalfOf,
    agentName: agreement.agentName,
    agencyName: agreement.agencyName,
    notes: agreement.notes,
    footerText: SITESCOP_PDF_FOOTER_TEXT,
    primaryColor: DEFAULT_REPORT_SETTINGS.primaryColor,
    secondaryColor: DEFAULT_REPORT_SETTINGS.secondaryColor,
    pdfIncludeLogo: getResolvedReportSettings().pdfIncludeLogo,
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
