import type { Database as SqlDatabase } from 'sql.js';

/** True when the value looks like a street number only / incomplete address. */
export function isIncompletePropertyAddress(address: string | null | undefined): boolean {
  const value = (address ?? '').trim();
  if (!value) return true;
  if (value.length < 8) return true;
  if (!/[A-Za-z]/.test(value)) return true;
  return false;
}

export function assertCompletePropertyAddress(address: string): string {
  const value = address.trim();
  if (isIncompletePropertyAddress(value)) {
    throw new Error(
      'Enter a full property address (street and suburb), not just a street number.',
    );
  }
  return value;
}

/**
 * Fix jobs/agreements saved with incomplete addresses (e.g. "15") by copying a
 * complete address from another job for the same client when available.
 */
export function repairIncompletePropertyAddresses(db: SqlDatabase): {
  repairedJobs: number;
  repairedAgreements: number;
  jobIds: string[];
} {
  const incompleteJobs: Array<{ id: string; clientId: string; address: string }> = [];
  const jobStmt = db.prepare(
    `SELECT id, client_id AS clientId, property_address AS address
     FROM jobs
     WHERE IFNULL(deleted_at, '') = ''`,
  );
  while (jobStmt.step()) {
    const row = jobStmt.getAsObject() as { id: string; clientId: string; address: string };
    if (isIncompletePropertyAddress(row.address)) {
      incompleteJobs.push({
        id: String(row.id),
        clientId: String(row.clientId),
        address: String(row.address ?? ''),
      });
    }
  }
  jobStmt.free();

  const jobIds: string[] = [];
  let repairedJobs = 0;
  let repairedAgreements = 0;

  for (const job of incompleteJobs) {
    const donorStmt = db.prepare(
      `SELECT property_address AS address
       FROM jobs
       WHERE client_id = ?
         AND id != ?
         AND IFNULL(deleted_at, '') = ''
       ORDER BY inspection_date DESC, created_at DESC`,
    );
    donorStmt.bind([job.clientId, job.id]);
    let donor: string | null = null;
    while (donorStmt.step()) {
      const address = String((donorStmt.getAsObject() as { address: string }).address ?? '');
      if (!isIncompletePropertyAddress(address)) {
        donor = address.trim();
        break;
      }
    }
    donorStmt.free();
    if (!donor) continue;

    db.run(`UPDATE jobs SET property_address = ?, updated_at = datetime('now') WHERE id = ?`, [
      donor,
      job.id,
    ]);
    repairedJobs += 1;
    jobIds.push(job.id);

    const agrStmt = db.prepare(
      `SELECT id, property_address AS address FROM agreements
       WHERE job_id = ? AND IFNULL(deleted_at, '') = ''`,
    );
    agrStmt.bind([job.id]);
    const agreementIds: string[] = [];
    while (agrStmt.step()) {
      const row = agrStmt.getAsObject() as { id: string; address: string };
      if (isIncompletePropertyAddress(row.address)) {
        agreementIds.push(String(row.id));
      }
    }
    agrStmt.free();

    for (const agreementId of agreementIds) {
      db.run(
        `UPDATE agreements SET property_address = ?, updated_at = datetime('now') WHERE id = ?`,
        [donor, agreementId],
      );
      repairedAgreements += 1;
    }

    const inspStmt = db.prepare(`SELECT id, form_data FROM inspections WHERE job_id = ? LIMIT 1`);
    inspStmt.bind([job.id]);
    if (inspStmt.step()) {
      const row = inspStmt.getAsObject() as { id: string; form_data: string | null };
      if (row.form_data) {
        try {
          const formData = JSON.parse(String(row.form_data)) as {
            jobInformation?: { propertyAddress?: string };
          };
          if (formData.jobInformation) {
            formData.jobInformation.propertyAddress = donor;
            db.run(`UPDATE inspections SET form_data = ?, updated_at = datetime('now') WHERE id = ?`, [
              JSON.stringify(formData),
              row.id,
            ]);
          }
        } catch {
          // ignore corrupt form_data
        }
      }
    }
    inspStmt.free();
  }

  // Agreements with incomplete address but a good linked job address
  const orphanAgr = db.prepare(
    `SELECT a.id AS id, j.property_address AS jobAddress, a.property_address AS address
     FROM agreements a
     JOIN jobs j ON j.id = a.job_id
     WHERE IFNULL(a.deleted_at, '') = ''
       AND IFNULL(j.deleted_at, '') = ''`,
  );
  while (orphanAgr.step()) {
    const row = orphanAgr.getAsObject() as { id: string; jobAddress: string; address: string };
    if (
      isIncompletePropertyAddress(row.address) &&
      !isIncompletePropertyAddress(row.jobAddress)
    ) {
      db.run(
        `UPDATE agreements SET property_address = ?, updated_at = datetime('now') WHERE id = ?`,
        [String(row.jobAddress).trim(), row.id],
      );
      repairedAgreements += 1;
    }
  }
  orphanAgr.free();

  return { repairedJobs, repairedAgreements, jobIds };
}
