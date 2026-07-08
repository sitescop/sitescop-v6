import fs from 'node:fs';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import { enrichInspectionFormData } from '../shared/room-engine-core/src/form-data.js';
import { mergeRoomDataForReport } from '../shared/room-engine-core/src/defaults.js';
import { generateBuildingReportPdf } from '../shared/report-pdf/src/index.js';
import { setLegalBasePath } from '../shared/report-pdf/src/legal-loader.js';
import { DEFAULT_REPORT_SETTINGS, SITESCOP_COMPANY_NAME } from '../shared/company-branding.js';

const userData = 'C:/Users/USER/AppData/Roaming/sitescop-v6';
const jobId = 'job-00000002';
const dbPath = join(userData, 'sitescop-v6.db');
const settingsPath = join(userData, 'settings.json');

setLegalBasePath(join(process.cwd(), 'shared/report-pdf/legal'));

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(dbPath));

const inspection = db.exec(
  `SELECT i.id, i.inspection_number, i.completed_at, i.started_at, i.form_data,
          j.job_number, j.inspection_type, j.property_address,
          TRIM(c.first_name || ' ' || c.last_name) AS client_name
   FROM inspections i
   JOIN jobs j ON j.id = i.job_id
   JOIN clients c ON c.id = j.client_id
   WHERE i.job_id = ?`,
  [jobId],
);
if (!inspection[0]?.values?.length) throw new Error('Inspection not found');

const [inspectionId, inspectionNumber, completedAt, startedAt, formJson, jobNumber, jobType, propertyAddress, clientName] =
  inspection[0].values[0];

const roomsResult = db.exec(
  `SELECT label, room_type, room_index, data FROM inspection_rooms WHERE inspection_id = ? ORDER BY room_index`,
  [inspectionId],
);
const rooms =
  roomsResult[0]?.values.map(([label, roomType, roomIndex, data]) => ({
    label: String(label),
    roomType: String(roomType),
    roomIndex: Number(roomIndex),
    data: JSON.parse(String(data)),
  })) ?? [];

let formData = JSON.parse(String(formJson));
formData = enrichInspectionFormData(formData, {
  rooms: rooms.map((room) => ({
    id: room.label,
    label: room.label,
    roomType: room.roomType,
    data: mergeRoomDataForReport(room.roomType, room.roomIndex, room.data),
  })),
});

const settingsFile = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  : {};
const reportSettings = { ...DEFAULT_REPORT_SETTINGS, ...(settingsFile.report ?? {}) };
const company = settingsFile.company ?? {};

const agreement = db.exec(
  `SELECT agreement_number FROM agreements WHERE job_id = ? AND IFNULL(deleted_at, '') = '' ORDER BY updated_at DESC LIMIT 1`,
  [jobId],
);
const agreementNumber = agreement[0]?.values?.[0]?.[0] ? String(agreement[0].values[0][0]) : null;

const ctx = {
  company: {
    name: company.name || SITESCOP_COMPANY_NAME,
    abn: company.abn || '',
    email: company.email || '',
    phone: company.phone || '',
    website: company.website || '',
    address: company.address || '',
    logoUrl: settingsFile.branding?.logoFileName
      ? `file:///${join(userData, 'branding', settingsFile.branding.logoFileName).replace(/\\/g, '/')}`
      : undefined,
  },
  settings: reportSettings,
  inspection: {
    inspectionNumber: String(inspectionNumber),
    completedAt: completedAt ? new Date(String(completedAt)) : null,
    startedAt: startedAt ? new Date(String(startedAt)) : null,
  },
  job: {
    jobNumber: String(jobNumber),
    jobType: String(jobType),
    propertyAddress: String(propertyAddress),
    clientName: String(clientName),
  },
  inspector: { name: 'Inspector', email: '' },
  formData,
  rooms: rooms.map((room) => ({
    label: room.label,
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    data: mergeRoomDataForReport(room.roomType, room.roomIndex, room.data),
  })),
  reportType: 'BUILDING',
  agreementNumber,
};

const outPath = join(userData, 'reports', jobId, 'INSP-2026-0005-Building.pdf');
const pdf = await generateBuildingReportPdf(ctx);
fs.mkdirSync(join(userData, 'reports', jobId), { recursive: true });
fs.writeFileSync(outPath, pdf);
console.log('Wrote', outPath, `(${pdf.length} bytes)`);
