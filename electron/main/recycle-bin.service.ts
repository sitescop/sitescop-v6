import type { Database as SqlDatabase } from 'sql.js';
import type {
  RecycleBinAgreementItem,
  RecycleBinItem,
  RecycleBinItemType,
  RecycleBinJobItem,
} from '../../shared/api-types.js';
import {
  listDeletedAgreements,
  permanentlyDeleteAgreement,
  restoreAgreement,
} from './agreements.service.js';
import {
  listDeletedJobs,
  permanentlyDeleteJob,
  restoreJob,
} from './jobs.service.js';

export function listRecycleBinItems(db: SqlDatabase): RecycleBinItem[] {
  const jobs: RecycleBinJobItem[] = listDeletedJobs(db)
    .filter((job) => !isBulkArchiveReason(job.cancelNotes))
    .map((job) => ({
      type: 'job',
      id: job.id,
      deletedAt: job.deletedAt,
      reason: (job.cancelReason as RecycleBinJobItem['reason']) ?? null,
      notes: job.cancelNotes,
      jobNumber: job.jobNumber,
      clientName: job.clientName,
      inspectionDate: job.inspectionDate,
      inspectionType: job.inspectionType,
      status: job.status,
      propertyAddress: job.propertyAddress,
    }));

  const agreements: RecycleBinAgreementItem[] = listDeletedAgreements(db)
    .filter((agreement) => !isBulkArchiveReason(agreement.deletedReason))
    .map((agreement) => ({
      type: 'agreement',
      id: agreement.id,
      deletedAt: agreement.deletedAt,
      reason: agreement.deletedReason,
      agreementNumber: agreement.agreementNumber,
      clientName: agreement.clientName,
      propertyAddress: agreement.propertyAddress,
      status: agreement.status,
      inspectionType: agreement.inspectionType,
      jobNumber: agreement.jobNumber,
    }));

  return [...jobs, ...agreements].sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );
}

export function restoreRecycleBinItem(db: SqlDatabase, type: RecycleBinItemType, id: string) {
  if (type === 'job') {
    restoreJob(db, id);
    return;
  }
  restoreAgreement(db, id);
}

export function purgeRecycleBinItem(db: SqlDatabase, type: RecycleBinItemType, id: string) {
  if (type === 'job') {
    permanentlyDeleteJob(db, id);
    return;
  }
  permanentlyDeleteAgreement(db, id);
}

function isBulkArchiveReason(reason: string | null | undefined): boolean {
  return Boolean(reason?.startsWith('Bulk archive '));
}

/**
 * Permanently removes everything currently in the recycle bin (and soft-deleted clients).
 * Call this before a new Clear test data archive so old trash is wiped; the new archive
 * soft-deletes stay restorable from Settings.
 */
export function emptyExistingRecycleBin(db: SqlDatabase): {
  purgedJobs: number;
  purgedAgreements: number;
  purgedClients: number;
} {
  const deletedJobs = listDeletedJobs(db);
  const deletedAgreements = listDeletedAgreements(db);

  let purgedAgreements = 0;
  for (const agreement of deletedAgreements) {
    permanentlyDeleteAgreement(db, agreement.id);
    purgedAgreements += 1;
  }

  let purgedJobs = 0;
  for (const job of deletedJobs) {
    permanentlyDeleteJob(db, job.id);
    purgedJobs += 1;
  }

  const clientIds: string[] = [];
  const clientStmt = db.prepare(
    `SELECT id FROM clients WHERE IFNULL(deleted_at, '') != ''`,
  );
  while (clientStmt.step()) {
    clientIds.push(String((clientStmt.getAsObject() as { id: string }).id));
  }
  clientStmt.free();

  let purgedClients = 0;
  for (const clientId of clientIds) {
    db.run(`DELETE FROM clients WHERE id = ?`, [clientId]);
    purgedClients += 1;
  }

  return { purgedJobs, purgedAgreements, purgedClients };
}
