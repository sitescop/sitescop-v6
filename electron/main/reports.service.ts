import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { Database as SqlDatabase } from 'sql.js';
import type { InspectionType, SessionUser } from '../../shared/api-types.js';
import {
  SITESCOP_COMPANY_NAME,
  SITESCOP_COMPANY_EMAIL,
} from '../../shared/company-branding.js';
import { getResolvedCompanyBranding, getResolvedReportSettings } from './settings.service.js';
import { mergeRoomDataForReport } from '../../shared/room-engine-core/src/defaults.js';
import { resolveRoomReportLabels } from '../../shared/room-engine-core/src/property-profile.js';
import { enrichInspectionFormData } from '../../shared/room-engine-core/src/form-data.js';
import { enrichPestConclusion } from '../../shared/room-engine-core/src/pest-conclusion.js';
import {
  closePdfBrowser,
  generateBuildingReportPdf,
  generatePestReportPdf,
  reportFileNameStem,
} from '../../shared/report-pdf/src/index.js';
import { setLegalBasePath } from '../../shared/report-pdf/src/legal-loader.js';
import type { ReportRenderContext } from '../../shared/report-pdf/src/types.js';
import { getInspectionByJob } from './inspections.service.js';
import { compressPhotosForPdf } from './pdf-photo-compress.js';

export type ReportType = 'BUILDING' | 'PEST';

export interface GeneratedReport {
  id: string;
  jobId: string;
  inspectionId: string;
  reportType: ReportType;
  fileName: string;
  filePath: string;
  generatedAt: string;
}

let legalPathInitialized = false;

function ensureLegalPath(): void {
  if (legalPathInitialized) return;
  const base = app.isPackaged
    ? join(process.resourcesPath, 'report-pdf', 'legal')
    : join(app.getAppPath(), 'shared/report-pdf/legal');
  setLegalBasePath(base);
  legalPathInitialized = true;
}

function reportTypesForJob(jobType: InspectionType): ReportType[] {
  switch (jobType) {
    case 'PEST':
      return ['PEST'];
    case 'COMBINED':
      return ['BUILDING', 'PEST'];
    case 'BUILDING':
    default:
      return ['BUILDING'];
  }
}

function reportFileName(
  inspectionNumber: string,
  reportType: ReportType,
  jobType: InspectionType,
): string {
  const suffix = reportType === 'BUILDING' ? 'Building' : 'Pest';
  const safeNumber = reportFileNameStem(inspectionNumber, reportType, jobType);
  return `${safeNumber}-${suffix}.pdf`;
}

function getAgreementNumberForJob(db: SqlDatabase, jobId: string): string | null {
  const stmt = db.prepare(
    `SELECT agreement_number FROM agreements
     WHERE job_id = ?
       AND status != 'CANCELLED'
       AND IFNULL(deleted_at, '') = ''
       AND IFNULL(archived_at, '') = ''
     ORDER BY
       CASE status WHEN 'SIGNED' THEN 0 WHEN 'VIEWED' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END,
       updated_at DESC
     LIMIT 1`,
  );
  stmt.bind([jobId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as { agreement_number: string };
  stmt.free();
  return row.agreement_number?.trim() || null;
}

function reportsRoot(): string {
  return join(app.getPath('userData'), 'reports');
}

function mapReportRow(row: Record<string, unknown>): GeneratedReport {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    inspectionId: String(row.inspection_id),
    reportType: row.report_type as ReportType,
    fileName: String(row.file_name),
    filePath: String(row.file_path),
    generatedAt: String(row.generated_at),
  };
}

export function listReportsForJob(db: SqlDatabase, jobId: string): GeneratedReport[] {
  const stmt = db.prepare(
    `SELECT id, job_id, inspection_id, report_type, file_name, file_path, generated_at
     FROM inspection_reports
     WHERE job_id = ?
     ORDER BY report_type`,
  );
  stmt.bind([jobId]);
  const rows: GeneratedReport[] = [];
  while (stmt.step()) {
    rows.push(mapReportRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

async function buildRenderContext(
  db: SqlDatabase,
  jobId: string,
  user: SessionUser,
): Promise<{ ctx: ReportRenderContext; inspectionId: string; inspectionNumber: string; jobType: InspectionType }> {
  const inspection = getInspectionByJob(db, jobId, user);
  if (!inspection) throw new Error('Inspection not found');
  const canGeneratePdf = inspection.status === 'COMPLETED' || Boolean(inspection.completedAt);
  if (!canGeneratePdf) {
    throw new Error('Complete the inspection before generating a PDF report.');
  }

  let formData = { ...inspection.formData };

  const inspectorName =
    inspection.inspectorName.trim() || `${user.firstName} ${user.lastName}`.trim();

  const enrichedRooms = inspection.rooms.map((room) => ({
    id: room.id,
    label: room.label,
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    data: mergeRoomDataForReport(room.roomType, room.roomIndex, room.data),
  }));
  const roomLabels = resolveRoomReportLabels(enrichedRooms);
  const labeledRooms = enrichedRooms.map((room, index) => ({
    ...room,
    label: roomLabels[index] ?? room.label,
  }));

  if (formData.building) {
    formData = enrichInspectionFormData(formData, {
      rooms: labeledRooms,
    });
  }

  if (formData.pest) {
    formData = {
      ...formData,
      pest: enrichPestConclusion(formData.pest, {
        building: formData.building,
        inspectorName,
      }),
    };
  }

  // Full-resolution photos can be tens of MB and crash Chromium during PDF print.
  formData = compressPhotosForPdf(formData);
  const pdfRooms = labeledRooms.map((room) => ({
    ...room,
    data: compressPhotosForPdf(room.data),
  }));

  const branding = getResolvedCompanyBranding();
  const agreementNumber = getAgreementNumberForJob(db, jobId);
  const ctx: ReportRenderContext = {
    company: {
      name: user.companyName || branding.name,
      abn: branding.abn,
      email: branding.email || user.email,
      phone: branding.phone,
      website: branding.website,
      address: branding.address,
      logoUrl: branding.logoUrl,
    },
    settings: getResolvedReportSettings(),
    inspection: {
      inspectionNumber: inspection.inspectionNumber,
      completedAt: inspection.completedAt ? new Date(inspection.completedAt) : null,
      startedAt: inspection.startedAt ? new Date(inspection.startedAt) : null,
    },
    job: {
      jobNumber: inspection.jobNumber,
      jobType: inspection.jobType,
      propertyAddress: inspection.propertyAddress,
      clientName: inspection.clientName,
    },
    inspector: {
      name: inspectorName,
      email: user.email,
    },
    formData,
    rooms: pdfRooms.map(({ label, roomType, roomIndex, data }) => ({
      label,
      roomType,
      roomIndex,
      data,
    })),
    reportType: 'BUILDING',
    agreementNumber,
  };

  return {
    ctx,
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspectionNumber || jobId,
    jobType: inspection.jobType,
  };
}

export async function generateReportsForJob(
  db: SqlDatabase,
  jobId: string,
  user: SessionUser,
): Promise<GeneratedReport[]> {
  ensureLegalPath();

  const { ctx, inspectionId, inspectionNumber, jobType } = await buildRenderContext(db, jobId, user);
  const types = reportTypesForJob(jobType);
  const outDir = join(reportsRoot(), jobId);
  await mkdir(outDir, { recursive: true });

  const generated: GeneratedReport[] = [];

  for (const reportType of types) {
    if (reportType === 'PEST' && !ctx.formData.pest) {
      throw new Error('Pest inspection data is missing.');
    }

    const buffer =
      reportType === 'PEST'
        ? await generatePestReportPdf({ ...ctx, reportType: 'PEST' })
        : await generateBuildingReportPdf({ ...ctx, reportType: 'BUILDING' });

    const fileName = reportFileName(inspectionNumber, reportType, jobType);
    const filePath = join(outDir, fileName);
    await writeFile(filePath, buffer);

    const id = randomUUID();
    const generatedAt = new Date().toISOString();

    db.run(`DELETE FROM inspection_reports WHERE job_id = ? AND report_type = ?`, [jobId, reportType]);
    db.run(
      `INSERT INTO inspection_reports
         (id, job_id, inspection_id, report_type, file_name, file_path, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, jobId, inspectionId, reportType, fileName, filePath, generatedAt],
    );

    generated.push({
      id,
      jobId,
      inspectionId,
      reportType,
      fileName,
      filePath,
      generatedAt,
    });
  }

  db.run(`UPDATE jobs SET has_report = 1, updated_at = datetime('now') WHERE id = ?`, [jobId]);
  await closePdfBrowser();
  return generated;
}

export function getReportsFolder(jobId: string): string {
  return join(reportsRoot(), jobId);
}

export { closePdfBrowser };
