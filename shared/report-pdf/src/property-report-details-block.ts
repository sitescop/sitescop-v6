import { formatDate, renderSectionBlock } from './html-utils.js';
import { formatReportInspectionNumber } from './report-identifiers.js';
import type { ReportPdfType, ReportRenderContext } from './types.js';
import type { SectionFieldDef } from './section-fields.js';
import { DEFAULT_BUILDING_REPORT_TYPE } from '../../room-engine-core/src/options.js';

export const BUILDING_INSPECTION_TYPE_LABEL = 'Building Inspection Report';
export const PEST_INSPECTION_TYPE_LABEL = 'Timber and Pest Inspection report';

export function resolveInspectionTypeLabel(reportType: ReportPdfType): string {
  return reportType === 'BUILDING' ? BUILDING_INSPECTION_TYPE_LABEL : PEST_INSPECTION_TYPE_LABEL;
}

export function resolveBuildingReportTitle(ctx: ReportRenderContext): string {
  return ctx.formData.shared.jobInformation.buildingReportType?.trim() || DEFAULT_BUILDING_REPORT_TYPE;
}

export function resolvePestReportTitle(): string {
  return PEST_INSPECTION_TYPE_LABEL;
}

function resolvePropertyReportDetailsTitle(reportType: ReportPdfType): string {
  return reportType === 'PEST' ? 'Property & Engagement Information' : 'Property & Report Details';
}

function resolvePropertyInspectionTypeLabel(ctx: ReportRenderContext): string {
  const jobInfo = ctx.formData.shared.jobInformation;
  if (ctx.reportType === 'PEST') {
    return jobInfo.pestReportType?.trim() || PEST_INSPECTION_TYPE_LABEL;
  }
  return jobInfo.buildingReportType?.trim() || DEFAULT_BUILDING_REPORT_TYPE;
}

/** Ordered fields for property / engagement details (no Job Number, no report-type dropdowns). */
export const PROPERTY_REPORT_DETAILS_FIELDS: SectionFieldDef[] = [
  { key: 'inspectionType', label: 'Inspection Type' },
  { key: 'inspectionNumber', label: 'Inspection Number' },
  { key: 'agreementNumber', label: 'Agreement Number' },
  { key: 'inspector', label: 'Inspector' },
  { key: 'clientType', label: 'Client Type' },
  { key: 'agencyName', label: 'Agency Name' },
  { key: 'agentName', label: 'Agent Name' },
  { key: 'agentMobile', label: 'Agent Mobile' },
  { key: 'agentEmail', label: 'Agent Email' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'clientMobile', label: 'Client Mobile' },
  { key: 'clientEmail', label: 'Client Email' },
  { key: 'inspectionDate', label: 'Inspection Date' },
  { key: 'inspectionTime', label: 'Inspection Time' },
  { key: 'propertyAddress', label: 'Property Address' },
  { key: 'weatherConditions', label: 'Weather Conditions' },
  { key: 'occupancyStatus', label: 'Occupancy Status' },
  { key: 'incompleteConstruction', label: 'Incomplete Construction' },
  { key: 'gpsLatitude', label: 'GPS Latitude' },
  { key: 'gpsLongitude', label: 'GPS Longitude' },
];

const JOB_INFO_PDF_SKIP = new Set([
  'buildingReportType',
  'pestReportType',
  'frontPhotoAngle',
  'frontPhotoAngles',
  'photos',
]);

export function buildPropertyReportDetailsData(ctx: ReportRenderContext): Record<string, unknown> {
  const jobInfo = ctx.formData.shared.jobInformation;
  const inspectionNumber = formatReportInspectionNumber(
    ctx.inspection.inspectionNumber,
    ctx.reportType,
    ctx.job.jobType,
  );

  const inspectionDate =
    jobInfo.inspectionDate?.trim() ||
    formatDate(ctx.inspection.completedAt ?? ctx.inspection.startedAt);

  const data: Record<string, unknown> = {
    inspectionType: resolvePropertyInspectionTypeLabel(ctx),
    inspectionNumber,
    agreementNumber: ctx.agreementNumber?.trim() || '—',
    inspector: ctx.inspector?.name?.trim() || '—',
    clientType: jobInfo.clientType,
    agencyName: jobInfo.agencyName,
    agentName: jobInfo.agentName,
    agentMobile: jobInfo.agentMobile,
    agentEmail: jobInfo.agentEmail,
    clientName: jobInfo.clientName?.trim() || ctx.job.clientName,
    clientMobile: jobInfo.clientMobile,
    clientEmail: jobInfo.clientEmail,
    inspectionDate,
    inspectionTime: jobInfo.inspectionTime,
    propertyAddress: jobInfo.propertyAddress?.trim() || ctx.job.propertyAddress,
    weatherConditions: jobInfo.weatherConditions,
    occupancyStatus: jobInfo.occupancyStatus,
    incompleteConstruction: jobInfo.incompleteConstruction,
    incompleteConstructionPhotos: jobInfo.incompleteConstructionPhotos,
    comments: jobInfo.comments,
    gpsLatitude: jobInfo.gpsLatitude,
    gpsLongitude: jobInfo.gpsLongitude,
  };

  for (const key of JOB_INFO_PDF_SKIP) {
    delete data[key];
  }

  return data;
}

export function renderPropertyReportDetailsBlock(ctx: ReportRenderContext): string {
  const data = buildPropertyReportDetailsData(ctx);
  const clientType = String(data.clientType ?? '').trim();
  const showAgentFields = clientType === 'Agent';

  const fieldDefs = PROPERTY_REPORT_DETAILS_FIELDS.filter((def) => {
    if (!showAgentFields && ['agencyName', 'agentName', 'agentMobile', 'agentEmail'].includes(def.key)) {
      return false;
    }
    return true;
  });

  return renderSectionBlock(
    resolvePropertyReportDetailsTitle(ctx.reportType),
    data,
    new Set(['photos']),
    undefined,
    fieldDefs,
  );
}
