import { app, shell } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database as SqlDatabase } from 'sql.js';
import { emptyExistingRecycleBin } from './recycle-bin.service.js';

export interface DataArchiveSummary {
  id: string;
  createdAt: string;
  folderPath: string;
  jobCount: number;
  agreementCount: number;
  clientCount: number;
  label: string;
}

export interface ArchiveAllWorkResult {
  archive: DataArchiveSummary;
  message: string;
}

interface ArchiveManifest {
  id: string;
  createdAt: string;
  label: string;
  jobIds: string[];
  agreementIds: string[];
  clientIds?: string[];
}

function archivesRoot(): string {
  const dir = join(app.getPath('userData'), 'sitescop-archives');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function listIds(db: SqlDatabase, sql: string): string[] {
  const stmt = db.prepare(sql);
  const ids: string[] = [];
  while (stmt.step()) {
    ids.push(String((stmt.getAsObject() as { id: string }).id));
  }
  stmt.free();
  return ids;
}

function toSummary(
  manifest: ArchiveManifest,
  folderPath: string,
  counts?: { jobs?: number; agreements?: number; clients?: number },
): DataArchiveSummary {
  return {
    id: manifest.id,
    createdAt: manifest.createdAt,
    folderPath,
    jobCount: counts?.jobs ?? manifest.jobIds?.length ?? 0,
    agreementCount: counts?.agreements ?? manifest.agreementIds?.length ?? 0,
    clientCount: counts?.clients ?? manifest.clientIds?.length ?? 0,
    label: manifest.label || `Archive ${manifest.id}`,
  };
}

export function listDataArchives(): DataArchiveSummary[] {
  const root = archivesRoot();
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const archives: DataArchiveSummary[] = [];
  for (const id of entries) {
    const folderPath = join(root, id);
    const manifestPath = join(folderPath, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ArchiveManifest;
      archives.push(toSummary({ ...manifest, id: manifest.id || id }, folderPath));
    } catch {
      // skip corrupt archives
    }
  }
  return archives;
}

export function openDataArchivesFolder(): string {
  const root = archivesRoot();
  void shell.openPath(root);
  return root;
}

/**
 * Empties the existing Recycle Bin (permanent), then snapshots active
 * clients/jobs/agreements and soft-deletes them for Settings restore.
 */
export function archiveAllWorkData(db: SqlDatabase): ArchiveAllWorkResult {
  const purged = emptyExistingRecycleBin(db);

  const clientIds = listIds(
    db,
    `SELECT id FROM clients WHERE IFNULL(deleted_at, '') = '' ORDER BY created_at`,
  );
  const jobIds = listIds(
    db,
    `SELECT id FROM jobs WHERE IFNULL(deleted_at, '') = '' ORDER BY created_at`,
  );
  const agreementIds = listIds(
    db,
    `SELECT id FROM agreements WHERE IFNULL(deleted_at, '') = '' ORDER BY created_at`,
  );

  if (clientIds.length === 0 && jobIds.length === 0 && agreementIds.length === 0) {
    throw new Error('Nothing to archive — there are no active clients, jobs, or agreements.');
  }

  const createdAt = new Date().toISOString();
  const id = createdAt.replace(/[:.]/g, '-');
  const folderPath = join(archivesRoot(), id);
  mkdirSync(folderPath, { recursive: true });

  const manifest: ArchiveManifest = {
    id,
    createdAt,
    label: `Test data clear — ${createdAt.slice(0, 19).replace('T', ' ')}`,
    clientIds,
    jobIds,
    agreementIds,
  };

  writeFileSync(join(folderPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const reason = `Bulk archive ${id}`;
  for (const jobId of jobIds) {
    db.run(
      `UPDATE jobs SET
         deleted_at = datetime('now'),
         cancel_reason = 'OTHER',
         cancel_notes = ?,
         updated_at = datetime('now')
       WHERE id = ? AND IFNULL(deleted_at, '') = ''`,
      [reason, jobId],
    );
  }
  for (const agreementId of agreementIds) {
    db.run(
      `UPDATE agreements SET
         deleted_at = datetime('now'),
         deleted_reason = ?,
         updated_at = datetime('now')
       WHERE id = ? AND IFNULL(deleted_at, '') = ''`,
      [reason, agreementId],
    );
  }
  for (const clientId of clientIds) {
    db.run(
      `UPDATE clients SET
         deleted_at = datetime('now'),
         deleted_reason = ?
       WHERE id = ? AND IFNULL(deleted_at, '') = ''`,
      [reason, clientId],
    );
  }

  return {
    archive: toSummary(manifest, folderPath),
    message: `Emptied Recycle Bin (${purged.purgedClients} client(s), ${purged.purgedJobs} job(s), ${purged.purgedAgreements} agreement(s) permanently removed). Archived ${clientIds.length} client(s), ${jobIds.length} job(s), and ${agreementIds.length} agreement(s) — restore from Settings to bring them back.`,
  };
}

export function restoreDataArchive(db: SqlDatabase, archiveId: string): ArchiveAllWorkResult {
  const folderPath = join(archivesRoot(), archiveId);
  const manifestPath = join(folderPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error('Archive not found.');
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ArchiveManifest;
  let restoredJobs = 0;
  let restoredAgreements = 0;
  let restoredClients = 0;

  for (const clientId of manifest.clientIds ?? []) {
    const stmt = db.prepare(
      `SELECT id FROM clients WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
    );
    stmt.bind([clientId]);
    const exists = stmt.step();
    stmt.free();
    if (!exists) continue;
    db.run(
      `UPDATE clients SET
         deleted_at = NULL,
         deleted_reason = NULL
       WHERE id = ?`,
      [clientId],
    );
    restoredClients += 1;
  }

  for (const jobId of manifest.jobIds ?? []) {
    const stmt = db.prepare(
      `SELECT id FROM jobs WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
    );
    stmt.bind([jobId]);
    const exists = stmt.step();
    stmt.free();
    if (!exists) continue;
    db.run(
      `UPDATE jobs SET
         deleted_at = NULL,
         cancel_reason = NULL,
         cancel_notes = NULL,
         updated_at = datetime('now')
       WHERE id = ?`,
      [jobId],
    );
    restoredJobs += 1;
  }

  for (const agreementId of manifest.agreementIds ?? []) {
    const stmt = db.prepare(
      `SELECT id FROM agreements WHERE id = ? AND IFNULL(deleted_at, '') != '' LIMIT 1`,
    );
    stmt.bind([agreementId]);
    const exists = stmt.step();
    stmt.free();
    if (!exists) continue;
    db.run(
      `UPDATE agreements SET
         deleted_at = NULL,
         deleted_reason = NULL,
         updated_at = datetime('now')
       WHERE id = ?`,
      [agreementId],
    );
    restoredAgreements += 1;
  }

  if (restoredJobs === 0 && restoredAgreements === 0 && restoredClients === 0) {
    throw new Error(
      'Nothing restored. Items may already be active, or were permanently deleted from Recycle Bin.',
    );
  }

  return {
    archive: toSummary(manifest, folderPath, {
      jobs: restoredJobs,
      agreements: restoredAgreements,
      clients: restoredClients,
    }),
    message: `Restored ${restoredClients} client(s), ${restoredJobs} job(s), and ${restoredAgreements} agreement(s) from the archive.`,
  };
}
