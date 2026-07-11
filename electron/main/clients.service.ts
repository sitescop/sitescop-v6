import type { Database as SqlDatabase } from 'sql.js';
import type {
  AgreementStatus,
  ClientDetail,
  ClientDetailJob,
  ClientDetailJobAgreement,
  ClientDetailJobReport,
  ClientRow,
  UpdateClientInput,
  UpdateClientAgentInput,
} from '../../shared/api-types.js';

function findOtherClientByContact(
  db: SqlDatabase,
  email: string | undefined,
  mobile: string | undefined,
  excludeClientId: string,
): string | null {
  if (email?.trim()) {
    const stmt = db.prepare(
      `SELECT id FROM clients WHERE lower(email) = lower(?) AND id != ? LIMIT 1`,
    );
    stmt.bind([email.trim(), excludeClientId]);
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
      `SELECT id FROM clients WHERE replace(mobile, ' ', '') = ? AND id != ? LIMIT 1`,
    );
    stmt.bind([normalized, excludeClientId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { id: string };
      stmt.free();
      return row.id;
    }
    stmt.free();
  }

  return null;
}

function mapClientRow(row: Record<string, unknown>): ClientRow {
  return {
    id: String(row.id),
    firstName: String(row.firstName),
    lastName: String(row.lastName),
    email: row.email ? String(row.email) : '',
    mobile: row.mobile ? String(row.mobile) : '',
    createdAt: String(row.createdAt),
    jobCount: Number(row.jobCount ?? 0),
    lastJobDate: row.lastJobDate ? String(row.lastJobDate) : null,
  };
}

export function listClients(db: SqlDatabase, search?: string): ClientRow[] {
  const term = search?.trim();
  const params: string[] = [];
  let where = '';

  if (term) {
    where = `
      WHERE lower(c.first_name || ' ' || c.last_name) LIKE lower(?)
         OR lower(c.email) LIKE lower(?)
         OR replace(c.mobile, ' ', '') LIKE replace(?, ' ', '')
    `;
    const like = `%${term}%`;
    params.push(like, like, like);
  }

  const stmt = db.prepare(
    `
    SELECT
      c.id,
      c.first_name AS firstName,
      c.last_name AS lastName,
      c.email,
      c.mobile,
      c.created_at AS createdAt,
      COUNT(j.id) AS jobCount,
      MAX(j.inspection_date) AS lastJobDate
    FROM clients c
    LEFT JOIN jobs j ON j.client_id = c.id AND IFNULL(j.deleted_at, '') = ''
    ${where}
    GROUP BY c.id
    ORDER BY lower(c.last_name), lower(c.first_name)
    `,
  );
  stmt.bind(params);

  const rows: ClientRow[] = [];
  while (stmt.step()) {
    rows.push(mapClientRow(stmt.getAsObject() as Record<string, unknown>));
  }
  stmt.free();

  return rows;
}

function loadReportsForJobs(db: SqlDatabase, jobIds: string[]): Map<string, ClientDetailJobReport[]> {
  const byJob = new Map<string, ClientDetailJobReport[]>();
  if (!jobIds.length) return byJob;

  const placeholders = jobIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT id, job_id AS jobId, inspection_id AS inspectionId, report_type AS reportType,
            file_name AS fileName, file_path AS filePath, generated_at AS generatedAt
     FROM inspection_reports
     WHERE job_id IN (${placeholders})
     ORDER BY report_type`,
  );
  stmt.bind(jobIds);

  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const jobId = String(row.jobId);
    const report: ClientDetailJobReport = {
      id: String(row.id),
      jobId,
      inspectionId: String(row.inspectionId),
      reportType: row.reportType as ClientDetailJobReport['reportType'],
      fileName: String(row.fileName),
      filePath: String(row.filePath),
      generatedAt: String(row.generatedAt),
    };
    const list = byJob.get(jobId) ?? [];
    list.push(report);
    byJob.set(jobId, list);
  }
  stmt.free();

  return byJob;
}

function loadAgreementsForJobs(
  db: SqlDatabase,
  jobIds: string[],
): Map<string, ClientDetailJobAgreement[]> {
  const byJob = new Map<string, ClientDetailJobAgreement[]>();
  if (!jobIds.length) return byJob;

  const placeholders = jobIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT id, job_id AS jobId, agreement_number AS agreementNumber, status,
            inspection_type AS inspectionType, signed_at AS signedAt
     FROM agreements
     WHERE job_id IN (${placeholders})
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
       updated_at DESC`,
  );
  stmt.bind(jobIds);

  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const jobId = String(row.jobId);
    const agreement: ClientDetailJobAgreement = {
      id: String(row.id),
      agreementNumber: String(row.agreementNumber),
      status: row.status as AgreementStatus,
      inspectionType: row.inspectionType as ClientDetailJobAgreement['inspectionType'],
      signedAt: row.signedAt ? String(row.signedAt) : null,
    };
    const list = byJob.get(jobId) ?? [];
    list.push(agreement);
    byJob.set(jobId, list);
  }
  stmt.free();

  return byJob;
}

export function getClientById(db: SqlDatabase, clientId: string): ClientDetail | null {
  const clientStmt = db.prepare(
    `SELECT id, first_name AS firstName, last_name AS lastName, email, mobile, created_at AS createdAt
     FROM clients WHERE id = ? LIMIT 1`,
  );
  clientStmt.bind([clientId]);
  if (!clientStmt.step()) {
    clientStmt.free();
    return null;
  }
  const clientRow = clientStmt.getAsObject() as Record<string, unknown>;
  clientStmt.free();

  const jobsStmt = db.prepare(
    `
    SELECT
      j.id,
      j.job_number AS jobNumber,
      j.inspection_type AS inspectionType,
      j.property_address AS propertyAddress,
      j.status,
      j.inspection_date AS inspectionDate,
      i.inspection_number AS inspectionNumber,
      (
        SELECT a.id
        FROM agreements a
        WHERE a.job_id = j.id
          AND a.status != 'CANCELLED'
          AND IFNULL(a.deleted_at, '') = ''
        ORDER BY
          CASE a.status
            WHEN 'DRAFT' THEN 0
            WHEN 'SENT' THEN 1
            WHEN 'VIEWED' THEN 2
            WHEN 'SIGNED' THEN 3
            ELSE 4
          END,
          a.updated_at DESC
        LIMIT 1
      ) AS agreementId,
      (
        SELECT a.agreement_number
        FROM agreements a
        WHERE a.job_id = j.id
          AND a.status != 'CANCELLED'
          AND IFNULL(a.deleted_at, '') = ''
        ORDER BY
          CASE a.status
            WHEN 'DRAFT' THEN 0
            WHEN 'SENT' THEN 1
            WHEN 'VIEWED' THEN 2
            WHEN 'SIGNED' THEN 3
            ELSE 4
          END,
          a.updated_at DESC
        LIMIT 1
      ) AS agreementNumber,
      (
        SELECT a.status
        FROM agreements a
        WHERE a.job_id = j.id
          AND a.status != 'CANCELLED'
          AND IFNULL(a.deleted_at, '') = ''
        ORDER BY
          CASE a.status
            WHEN 'DRAFT' THEN 0
            WHEN 'SENT' THEN 1
            WHEN 'VIEWED' THEN 2
            WHEN 'SIGNED' THEN 3
            ELSE 4
          END,
          a.updated_at DESC
        LIMIT 1
      ) AS agreementStatus,
      (
        SELECT a.pdf_path
        FROM agreements a
        WHERE a.job_id = j.id
          AND a.status != 'CANCELLED'
          AND IFNULL(a.deleted_at, '') = ''
        ORDER BY
          CASE a.status
            WHEN 'DRAFT' THEN 0
            WHEN 'SENT' THEN 1
            WHEN 'VIEWED' THEN 2
            WHEN 'SIGNED' THEN 3
            ELSE 4
          END,
          a.updated_at DESC
        LIMIT 1
      ) AS agreementPdfPath,
      j.invoice_path AS invoicePdfPath,
      j.has_invoice AS hasInvoice,
      j.ordering_party_type AS orderingPartyType,
      j.real_estate AS realEstate,
      j.agent_name AS agentName,
      j.agent_phone AS agentPhone,
      j.agent_mobile AS agentMobile,
      j.agent_email AS agentEmail
    FROM jobs j
    LEFT JOIN inspections i ON i.job_id = j.id
    WHERE j.client_id = ?
      AND IFNULL(j.deleted_at, '') = ''
    ORDER BY j.inspection_date DESC, j.created_at DESC
    `,
  );
  jobsStmt.bind([clientId]);

  const jobs: ClientDetailJob[] = [];
  const jobIds: string[] = [];
  while (jobsStmt.step()) {
    const row = jobsStmt.getAsObject() as Record<string, unknown>;
    const jobId = String(row.id);
    jobIds.push(jobId);
    jobs.push({
      id: jobId,
      jobNumber: String(row.jobNumber),
      inspectionType: row.inspectionType as ClientDetailJob['inspectionType'],
      propertyAddress: String(row.propertyAddress),
      status: row.status as ClientDetailJob['status'],
      inspectionDate: String(row.inspectionDate),
      inspectionNumber: row.inspectionNumber ? String(row.inspectionNumber) : null,
      agreementId: row.agreementId ? String(row.agreementId) : null,
      agreementNumber: row.agreementNumber ? String(row.agreementNumber) : null,
      agreementStatus: row.agreementStatus ? String(row.agreementStatus) : null,
      agreementPdfPath: row.agreementPdfPath ? String(row.agreementPdfPath) : null,
      agreements: [],
      invoicePdfPath: row.invoicePdfPath ? String(row.invoicePdfPath) : null,
      hasInvoice: Boolean(row.hasInvoice),
      orderingPartyType: row.orderingPartyType ? String(row.orderingPartyType) : null,
      realEstate: row.realEstate ? String(row.realEstate) : null,
      agentName: row.agentName ? String(row.agentName) : null,
      agentPhone: row.agentPhone ? String(row.agentPhone) : null,
      agentMobile: row.agentMobile ? String(row.agentMobile) : null,
      agentEmail: row.agentEmail ? String(row.agentEmail) : null,
      reports: [],
    });
  }
  jobsStmt.free();

  const reportsByJob = loadReportsForJobs(db, jobIds);
  const agreementsByJob = loadAgreementsForJobs(db, jobIds);
  for (const job of jobs) {
    job.reports = reportsByJob.get(job.id) ?? [];
    job.agreements = agreementsByJob.get(job.id) ?? [];
  }

  const propertyAddresses = [...new Set(jobs.map((j) => j.propertyAddress.trim()).filter(Boolean))];
  const primaryPropertyAddress = propertyAddresses[0] ?? null;

  return {
    id: String(clientRow.id),
    firstName: String(clientRow.firstName),
    lastName: String(clientRow.lastName),
    email: clientRow.email ? String(clientRow.email) : '',
    mobile: clientRow.mobile ? String(clientRow.mobile) : '',
    createdAt: String(clientRow.createdAt),
    primaryPropertyAddress,
    propertyAddresses,
    jobs,
  };
}

export function updateClient(
  db: SqlDatabase,
  clientId: string,
  input: UpdateClientInput,
): ClientDetail {
  const existing = getClientById(db, clientId);
  if (!existing) {
    throw new Error('Client not found');
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    throw new Error('First name and last name are required');
  }

  const email = input.email?.trim().toLowerCase() || null;
  const mobile = input.mobile?.trim() || null;

  const duplicateId = findOtherClientByContact(db, email ?? undefined, mobile ?? undefined, clientId);
  if (duplicateId) {
    throw new Error('Another client already uses this email or mobile number');
  }

  const clientName = `${firstName} ${lastName}`.trim();

  db.run('BEGIN TRANSACTION');

  try {
    db.run(
      `UPDATE clients SET first_name = ?, last_name = ?, email = ?, mobile = ? WHERE id = ?`,
      [firstName, lastName, email, mobile, clientId],
    );

    db.run(
      `
      UPDATE agreements
      SET client_name = ?, client_email = ?, client_phone = ?, updated_at = datetime('now')
      WHERE job_id IN (
        SELECT id FROM jobs WHERE client_id = ? AND IFNULL(deleted_at, '') = ''
      )
      `,
      [clientName, email ?? '', mobile, clientId],
    );

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  const updated = getClientById(db, clientId);
  if (!updated) {
    throw new Error('Client not found after update');
  }
  return updated;
}

export function updateClientAgent(
  db: SqlDatabase,
  clientId: string,
  input: UpdateClientAgentInput,
): ClientDetail {
  const existing = getClientById(db, clientId);
  if (!existing) {
    throw new Error('Client not found');
  }
  if (existing.jobs.length === 0) {
    throw new Error('Add a job for this client before saving agent details');
  }

  const realEstate = input.realEstate?.trim() || null;
  const agentName = input.agentName?.trim() || null;
  const agentPhone = input.agentPhone?.trim() || null;
  const agentMobile = input.agentMobile?.trim() || null;
  const agentEmail = input.agentEmail?.trim().toLowerCase() || null;
  const hasAgent = Boolean(realEstate || agentName || agentPhone || agentMobile || agentEmail);
  const orderingPartyType = hasAgent ? 'Agent' : null;

  db.run('BEGIN TRANSACTION');

  try {
    db.run(
      `
      UPDATE jobs
      SET
        real_estate = ?,
        agent_name = ?,
        agent_phone = ?,
        agent_mobile = ?,
        agent_email = ?,
        ordering_party_type = ?,
        updated_at = datetime('now')
      WHERE client_id = ? AND IFNULL(deleted_at, '') = ''
      `,
      [realEstate, agentName, agentPhone, agentMobile, agentEmail, orderingPartyType, clientId],
    );

    db.run(
      `
      UPDATE agreements
      SET
        agency_name = ?,
        agent_name = ?,
        agent_email = ?,
        updated_at = datetime('now')
      WHERE job_id IN (
        SELECT id FROM jobs WHERE client_id = ? AND IFNULL(deleted_at, '') = ''
      )
        AND status != 'CANCELLED'
        AND IFNULL(deleted_at, '') = ''
      `,
      [realEstate, agentName, agentEmail ?? '', clientId],
    );

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  const updated = getClientById(db, clientId);
  if (!updated) {
    throw new Error('Client not found after update');
  }
  return updated;
}
