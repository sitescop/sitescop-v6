import { randomUUID } from 'node:crypto';
import type { Database as SqlDatabase } from 'sql.js';
import type { InspectionType, SessionUser } from '../../shared/api-types.js';
import type {
  InspectionDetail,
  InspectionRoomDetail,
  InspectionRoomType,
  InspectionStatus,
  UpdateInspectionRoomInput,
  UpdateInspectionSectionInput,
} from '../../shared/inspection-types.js';
import {
  calculateInspectionProgress,
  createEmptyInspectionFormData,
  enrichInspectionFormData,
  jobTypeToFormKind,
  mergeJobContextIntoJobInformation,
  normalizeInspectionFormData,
  patchSectionData,
} from '../../shared/room-engine-core/src/form-data.js';
import type { MajorDefectRollupRoom } from '../../shared/room-engine-core/src/major-defects-rollup.js';
import { buildRoomsFromCounts, mergeRoomDataForReport } from '../../shared/room-engine-core/src/defaults.js';
import type { PrefillJobContext, RoomEngineType } from '../../shared/room-engine-core/src/types.js';
import { ROOM_ENGINE_TO_INSPECTION_ROOM } from '../../shared/inspection-types.js';
import { getJobDetail } from './jobs.service.js';

function mapEngineToRoomType(type: RoomEngineType): InspectionRoomType {
  return ROOM_ENGINE_TO_INSPECTION_ROOM[type];
}

function roomsForMajorDefectRollup(rooms: InspectionRoomDetail[]): MajorDefectRollupRoom[] {
  return rooms.map((room) => ({
    id: room.id,
    label: room.label,
    roomType: room.roomType,
    data: room.data,
  }));
}

function nextInspectionNumber(db: SqlDatabase): string {
  const year = new Date().getFullYear();
  const prefix = `INSP-${year}-`;
  const stmt = db.prepare(
    `SELECT inspection_number FROM inspections WHERE inspection_number LIKE ? ORDER BY inspection_number DESC LIMIT 1`,
  );
  stmt.bind([`${prefix}%`]);
  let nextSeq = 1;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { inspection_number: string };
    const parsed = Number.parseInt(row.inspection_number.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) nextSeq = parsed + 1;
  }
  stmt.free();
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

function buildPrefill(job: NonNullable<Awaited<ReturnType<typeof getJobDetail>>>, user: SessionUser): PrefillJobContext {
  return {
    jobNumber: job.jobNumber,
    clientName: job.clientName,
    clientEmail: job.email ?? '',
    clientPhone: job.mobile ?? '',
    agencyName: job.realEstate ?? '',
    agentName: job.agentName ?? '',
    agentPhone: job.agentMobile?.trim() || job.agentPhone?.trim() || '',
    agentEmail: job.agentEmail ?? '',
    propertyAddress: job.propertyAddress,
    scheduledDate: job.inspectionDate,
    scheduledTime: job.inspectionTime,
    inspectorName: `${user.firstName} ${user.lastName}`.trim(),
    inspectorLicence: '',
  };
}

function loadRooms(db: SqlDatabase, inspectionId: string): InspectionRoomDetail[] {
  const stmt = db.prepare(
    `SELECT id, room_type AS roomType, room_index AS roomIndex, label, data
     FROM inspection_rooms WHERE inspection_id = ? ORDER BY room_type, room_index`,
  );
  stmt.bind([inspectionId]);
  const rows: InspectionRoomDetail[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      roomType: InspectionRoomType;
      roomIndex: number;
      label: string;
      data: string;
    };
    rows.push({
      id: row.id,
      roomType: row.roomType,
      roomIndex: row.roomIndex,
      label: row.label,
      data: mergeRoomDataForReport(
        row.roomType,
        row.roomIndex,
        JSON.parse(row.data || '{}') as Record<string, unknown>,
      ),
    });
  }
  stmt.free();
  return rows;
}

function persistRooms(
  db: SqlDatabase,
  inspectionId: string,
  counts: {
    bedroomCount: number;
    bathroomCount: number;
    livingAreaCount: number;
    garageCount: number;
  },
) {
  const existing = loadRooms(db, inspectionId);
  const generated = buildRoomsFromCounts({
    bedrooms: counts.bedroomCount,
    bathrooms: counts.bathroomCount,
    livingAreas: counts.livingAreaCount,
    garages: counts.garageCount,
  });

  const existingMap = new Map(existing.map((room) => [`${room.roomType}:${room.roomIndex}`, room]));
  const keepKeys = new Set<string>();

  for (const room of generated) {
    const roomType = mapEngineToRoomType(room.roomType);
    const key = `${roomType}:${room.roomIndex}`;
    keepKeys.add(key);
    const match = existingMap.get(key);
    if (match) {
      db.run(`UPDATE inspection_rooms SET label = ?, updated_at = datetime('now') WHERE id = ?`, [
        room.label,
        match.id,
      ]);
    } else {
      db.run(
        `INSERT INTO inspection_rooms (id, inspection_id, room_type, room_index, label, data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), inspectionId, roomType, room.roomIndex, room.label, JSON.stringify(room.data)],
      );
    }
  }

  for (const room of existing) {
    const key = `${room.roomType}:${room.roomIndex}`;
    if (!keepKeys.has(key)) {
      db.run(`DELETE FROM inspection_rooms WHERE id = ?`, [room.id]);
    }
  }
}

function mapDetail(
  db: SqlDatabase,
  inspectionRow: Record<string, unknown>,
  jobType: InspectionType,
): InspectionDetail {
  const formKind = jobTypeToFormKind(jobType);
  const rawForm = inspectionRow.form_data
    ? (JSON.parse(String(inspectionRow.form_data)) as Record<string, unknown>)
    : {};
  const inspectionId = String(inspectionRow.id);
  const rooms = loadRooms(db, inspectionId);
  let formData = enrichInspectionFormData(
    normalizeInspectionFormData(rawForm, formKind),
    { rooms: roomsForMajorDefectRollup(rooms) },
  );

  const jobId = String(inspectionRow.job_id);
  const job = getJobDetail(db, jobId);
  if (job) {
    formData = mergeJobContextIntoJobInformation(formData, {
      orderingPartyType: job.orderingPartyType,
      realEstate: job.realEstate,
      clientName: job.clientName,
      clientEmail: job.email,
      clientMobile: job.mobile,
      agentName: job.agentName,
      agentPhone: job.agentPhone,
      agentMobile: job.agentMobile,
      agentEmail: job.agentEmail,
    });
  }

  return {
    id: inspectionId,
    inspectionNumber: String(inspectionRow.inspection_number ?? ''),
    status: inspectionRow.status as InspectionStatus,
    jobId,
    jobNumber: String(inspectionRow.job_number),
    jobType,
    propertyAddress: String(inspectionRow.property_address ?? ''),
    clientName: String(inspectionRow.client_name ?? ''),
    clientPhone: String(inspectionRow.client_mobile ?? ''),
    clientEmail: String(inspectionRow.client_email ?? ''),
    inspectorName: String(inspectionRow.inspector_name ?? ''),
    progressPercent: Number(inspectionRow.progress_percent ?? 0),
    startedAt: inspectionRow.started_at ? String(inspectionRow.started_at) : null,
    completedAt: inspectionRow.completed_at ? String(inspectionRow.completed_at) : null,
    createdAt: String(inspectionRow.created_at),
    updatedAt: String(inspectionRow.updated_at),
    formData,
    rooms,
  };
}

function getInspectionRow(db: SqlDatabase, jobId: string) {
  const stmt = db.prepare(
    `SELECT
       i.id, i.job_id, i.status, i.form_data, i.progress_percent, i.inspection_number,
       i.started_at, i.completed_at, i.created_at, i.updated_at,
       j.job_number AS job_number, j.inspection_type AS inspection_type, j.property_address AS property_address,
       c.first_name || ' ' || c.last_name AS client_name,
       COALESCE(c.mobile, '') AS client_mobile,
       COALESCE(c.email, '') AS client_email
     FROM inspections i
     JOIN jobs j ON j.id = i.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE i.job_id = ? AND IFNULL(j.deleted_at, '') = ''
     LIMIT 1`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function initializeInspection(
  db: SqlDatabase,
  jobId: string,
  user: SessionUser,
): InspectionDetail {
  const job = getJobDetail(db, jobId);
  if (!job) throw new Error('Job not found');

  const formKind = jobTypeToFormKind(job.inspectionType);
  const formData = enrichInspectionFormData(
    createEmptyInspectionFormData(formKind, buildPrefill(job, user)),
  );
  const inspectionNumber = nextInspectionNumber(db);
  const progressPercent = calculateInspectionProgress(formData);
  const now = new Date().toISOString();

  db.run(
    `UPDATE inspections SET
       status = 'IN_PROGRESS',
       form_data = ?,
       progress_percent = ?,
       inspection_number = ?,
       started_at = COALESCE(started_at, ?),
       updated_at = datetime('now')
     WHERE job_id = ?`,
    [JSON.stringify(formData), progressPercent, inspectionNumber, now, jobId],
  );

  const row = getInspectionRow(db, jobId);
  if (!row) throw new Error('Failed to initialize inspection');

  const inspectionId = String(row.id);
  const needsRooms = formKind === 'BUILDING' || formKind === 'COMBINED';
  if (needsRooms) {
    persistRooms(db, inspectionId, {
      bedroomCount: formData.shared.propertyDescription.bedroomCount,
      bathroomCount: formData.shared.propertyDescription.bathroomCount,
      livingAreaCount: formData.shared.propertyDescription.livingAreaCount,
      garageCount: formData.shared.propertyDescription.garageCount,
    });
  }

  if (job.status === 'NEW') {
    db.run(`UPDATE jobs SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE id = ?`, [jobId]);
  }

  row.inspector_name = `${user.firstName} ${user.lastName}`.trim();
  return mapDetail(db, row, job.inspectionType);
}

export function getInspectionByJob(
  db: SqlDatabase,
  jobId: string,
  user: SessionUser,
): InspectionDetail | null {
  let row = getInspectionRow(db, jobId);
  if (!row) return null;

  if (!row.form_data || String(row.form_data).trim() === '' || String(row.form_data) === '{}') {
    return initializeInspection(db, jobId, user);
  }

  row.inspector_name = `${user.firstName} ${user.lastName}`.trim();
  const jobType = row.inspection_type as InspectionType;
  return mapDetail(db, row, jobType);
}

export function updateInspectionSection(
  db: SqlDatabase,
  inspectionId: string,
  input: UpdateInspectionSectionInput,
): InspectionDetail {
  const stmt = db.prepare(
    `SELECT i.*, j.inspection_type, j.job_number, j.property_address,
            c.first_name || ' ' || c.last_name AS client_name,
            COALESCE(c.mobile, '') AS client_mobile,
            COALESCE(c.email, '') AS client_email
     FROM inspections i
     JOIN jobs j ON j.id = i.job_id
     JOIN clients c ON c.id = j.client_id
     WHERE i.id = ?`,
  );
  stmt.bind([inspectionId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Inspection not found');
  }
  const row = stmt.getAsObject();
  stmt.free();

  const jobType = row.inspection_type as InspectionType;
  const formKind = jobTypeToFormKind(jobType);
  const rooms = loadRooms(db, inspectionId);
  const enrichment = { rooms: roomsForMajorDefectRollup(rooms) };
  const rawForm = normalizeInspectionFormData(
    JSON.parse(String(row.form_data || '{}')) as Record<string, unknown>,
    formKind,
  );
  const patched = enrichInspectionFormData(
    patchSectionData(rawForm, input.realm, input.section, input.data),
    enrichment,
  );
  const progressPercent = calculateInspectionProgress(patched);
  const previousStatus = String(row.status ?? 'IN_PROGRESS');
  const nextStatus = previousStatus === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';

  db.run(
    `UPDATE inspections SET form_data = ?, progress_percent = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [JSON.stringify(patched), progressPercent, nextStatus, inspectionId],
  );

  if (input.realm === 'shared' && input.section === 'propertyDescription') {
    persistRooms(db, inspectionId, {
      bedroomCount: patched.shared.propertyDescription.bedroomCount,
      bathroomCount: patched.shared.propertyDescription.bathroomCount,
      livingAreaCount: patched.shared.propertyDescription.livingAreaCount,
      garageCount: patched.shared.propertyDescription.garageCount,
    });
  }

  const refreshed = getInspectionRow(db, String(row.job_id));
  if (!refreshed) throw new Error('Inspection not found after update');
  refreshed.inspector_name = String(row.inspector_name ?? '');
  return mapDetail(db, refreshed, jobType);
}

export function updateInspectionRoom(
  db: SqlDatabase,
  inspectionId: string,
  roomId: string,
  input: UpdateInspectionRoomInput,
): InspectionDetail {
  const roomStmt = db.prepare(`SELECT room_type, room_index FROM inspection_rooms WHERE id = ? AND inspection_id = ?`);
  roomStmt.bind([roomId, inspectionId]);
  if (!roomStmt.step()) {
    roomStmt.free();
    throw new Error('Room not found');
  }
  const roomMeta = roomStmt.getAsObject() as { room_type: InspectionRoomType; room_index: number };
  roomStmt.free();

  const sanitized = mergeRoomDataForReport(roomMeta.room_type, roomMeta.room_index, input.data);
  db.run(
    `UPDATE inspection_rooms SET data = ?, label = COALESCE(?, label), updated_at = datetime('now') WHERE id = ?`,
    [JSON.stringify(sanitized), input.label ?? null, roomId],
  );

  const stmt = db.prepare(`SELECT job_id FROM inspections WHERE id = ?`);
  stmt.bind([inspectionId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Inspection not found');
  }
  const jobId = String((stmt.getAsObject() as { job_id: string }).job_id);
  stmt.free();

  const refreshed = getInspectionRow(db, jobId);
  if (!refreshed) throw new Error('Inspection not found after room update');

  const jobType = refreshed.inspection_type as InspectionType;
  const formKind = jobTypeToFormKind(jobType);
  const rooms = loadRooms(db, inspectionId);
  const enriched = enrichInspectionFormData(
    normalizeInspectionFormData(JSON.parse(String(refreshed.form_data || '{}')), formKind),
    { rooms: roomsForMajorDefectRollup(rooms) },
  );
  db.run(
    `UPDATE inspections SET form_data = ?, progress_percent = ?, updated_at = datetime('now') WHERE id = ?`,
    [JSON.stringify(enriched), calculateInspectionProgress(enriched), inspectionId],
  );

  const latest = getInspectionRow(db, jobId);
  if (!latest) throw new Error('Inspection not found after room update');
  return mapDetail(db, latest, jobType);
}

export function completeInspection(db: SqlDatabase, inspectionId: string): InspectionDetail {
  db.run(
    `UPDATE inspections SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [inspectionId],
  );

  const stmt = db.prepare(`SELECT job_id FROM inspections WHERE id = ?`);
  stmt.bind([inspectionId]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Inspection not found');
  }
  const jobId = String((stmt.getAsObject() as { job_id: string }).job_id);
  stmt.free();

  db.run(`UPDATE jobs SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ?`, [jobId]);

  const refreshed = getInspectionRow(db, jobId);
  if (!refreshed) throw new Error('Inspection not found after complete');
  return mapDetail(db, refreshed, refreshed.inspection_type as InspectionType);
}
