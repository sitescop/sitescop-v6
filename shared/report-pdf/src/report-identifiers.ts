import type { ReportPdfType, ReportRenderContext } from './types.js';
import { escapeHtml, formatDate } from './html-utils.js';

/** Combined jobs append B (building) or P (pest) to the inspection number on reports. */
export function formatReportInspectionNumber(
  inspectionNumber: string,
  reportType: ReportPdfType,
  jobType: string,
): string {
  const base = inspectionNumber.trim();
  if (!base) return '—';
  if (jobType !== 'COMBINED') return base;
  return `${base}${reportType === 'BUILDING' ? 'B' : 'P'}`;
}

export function reportFileNameStem(
  inspectionNumber: string,
  reportType: ReportPdfType,
  jobType: string,
): string {
  const display = formatReportInspectionNumber(inspectionNumber, reportType, jobType);
  return display.replace(/[^\w-]+/g, '-');
}

export function renderCoverReferenceMeta(ctx: ReportRenderContext): string {
  const inspectionNo = formatReportInspectionNumber(
    ctx.inspection.inspectionNumber,
    ctx.reportType,
    ctx.job.jobType,
  );
  const agreement = ctx.agreementNumber?.trim();

  return `
  <div class="cover-meta">
    ${agreement ? `<p><strong>Agreement No.:</strong> ${escapeHtml(agreement)}</p>` : ''}
    <p><strong>Inspection No.:</strong> ${escapeHtml(inspectionNo)}</p>
    <p><strong>Property:</strong> ${escapeHtml(ctx.job.propertyAddress)}</p>
    <p><strong>Client:</strong> ${escapeHtml(ctx.job.clientName)}</p>
    <p><strong>Inspector:</strong> ${escapeHtml(ctx.inspector?.name ?? '—')}</p>
    <p><strong>Inspection date:</strong> ${escapeHtml(formatDate(ctx.inspection.completedAt ?? ctx.inspection.startedAt))}</p>
  </div>`;
}
