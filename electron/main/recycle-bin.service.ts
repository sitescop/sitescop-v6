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
  const jobs: RecycleBinJobItem[] = listDeletedJobs(db).map((job) => ({
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

  const agreements: RecycleBinAgreementItem[] = listDeletedAgreements(db).map((agreement) => ({
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
