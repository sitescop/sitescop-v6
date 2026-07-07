import {
  PEST_INSPECTION_SECTION_KEYS,
  PEST_INSPECTION_SECTION_LABELS,
  SHARED_INSPECTION_SECTION_KEYS,
  SHARED_INSPECTION_SECTION_LABELS,
} from '../../room-engine-core/src/index.js';
import { SITESCOP_PDF_FOOTER_TEXT } from '../../company-branding.js';
import { escapeHtml, formatDate, renderSectionBlock } from './html-utils.js';
import { renderCoverHeader } from './cover-header.js';
import { renderInspectorHazardAssessmentBlock } from './hazard-assessment-block.js';
import { loadLegalScheduleHtml } from './legal-loader.js';
import { renderPestConclusionBlock } from './pest-conclusion-block.js';
import { getPestSectionFieldDefs, getSharedSectionFieldDefs } from './section-fields.js';
import { reportPrintStyles } from './styles.js';
import type { ReportRenderContext } from './types.js';

const PEST_SECTION_A_FIELDS = [
  { key: 'propertyAddress', label: 'Property Address' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'jobNumber', label: 'Job Number' },
  { key: 'inspectionNumber', label: 'Inspection Number' },
  { key: 'inspector', label: 'Inspector' },
  { key: 'inspectionDate', label: 'Inspection Date' },
  { key: 'propertyType', label: 'Property Type' },
  { key: 'storeys', label: 'Storeys' },
  { key: 'inaccessibleCustomLines', label: 'Inaccessible Area Notes' },
] as const;

function pestPropertyTypeLabel(propertyType: string, propertyTypeOther: string): string {
  if (propertyType === 'Other') return propertyTypeOther.trim() || 'Other';
  return propertyType.trim();
}

export function renderPestReportHtml(ctx: ReportRenderContext): string {
  const { company, settings } = ctx;
  const footerText = settings.pdfFooterText?.trim() || SITESCOP_PDF_FOOTER_TEXT;
  const pd = ctx.formData.shared.propertyDescription;
  const acc = ctx.formData.shared.accessibilityObstructions;

  const sections: string[] = [];
  const skipJobPhotos = new Set(['photos']);

  sections.push(
    renderSectionBlock(
      'Section A — Property Details',
      {
        propertyAddress: ctx.job.propertyAddress,
        clientName: ctx.job.clientName,
        jobNumber: ctx.job.jobNumber,
        inspectionNumber: ctx.inspection.inspectionNumber,
        inspector: ctx.inspector?.name ?? '—',
        inspectionDate: formatDate(ctx.inspection.completedAt ?? ctx.inspection.startedAt),
        propertyType: pestPropertyTypeLabel(pd.propertyType, pd.propertyTypeOther),
        storeys: pd.storeys,
        inaccessibleCustomLines: acc.inaccessibleCustomLines,
      },
      new Set(),
      undefined,
      [...PEST_SECTION_A_FIELDS],
    ),
  );

  for (const key of SHARED_INSPECTION_SECTION_KEYS) {
    const data = ctx.formData.shared[key] as unknown as Record<string, unknown>;
    const block = renderSectionBlock(
      SHARED_INSPECTION_SECTION_LABELS[key],
      data,
      key === 'jobInformation' ? skipJobPhotos : new Set(),
      undefined,
      getSharedSectionFieldDefs(key),
    );
    if (block) sections.push(block);
  }

  if (ctx.formData.pest) {
    for (const key of PEST_INSPECTION_SECTION_KEYS) {
      if (key === 'pestConclusion') continue;
      const data = ctx.formData.pest[key] as unknown as Record<string, unknown>;
      const block = renderSectionBlock(
        PEST_INSPECTION_SECTION_LABELS[key],
        data,
        new Set(),
        undefined,
        getPestSectionFieldDefs(key),
      );
      if (block) sections.push(block);
    }

    const hazardBlock = renderInspectorHazardAssessmentBlock(
      ctx.formData.shared.inspectorHazardAssessment,
    );
    if (hazardBlock) sections.push(hazardBlock);

    sections.push(
      renderPestConclusionBlock(
        ctx.formData.pest,
        ctx.inspector?.name,
        ctx.inspection.completedAt ?? ctx.inspection.startedAt,
        ctx.formData.shared.inspectorHazardAssessment,
      ),
    );
  }

  if (settings.reportFooter?.trim()) {
    sections.push(`<section class="report-section"><p>${escapeHtml(settings.reportFooter)}</p></section>`);
  }

  const body = sections.filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Timber Pest Inspection Report</title>
<style>${reportPrintStyles(settings.primaryColor, settings.secondaryColor)}</style>
</head>
<body>
<div class="cover-page">
  ${renderCoverHeader(ctx)}
  <h1 class="cover-title">Timber Pest Inspection Report</h1>
  <p class="cover-subtitle">Prepared in accordance with AS 4349.3</p>
  ${settings.reportHeader ? `<p>${escapeHtml(settings.reportHeader)}</p>` : ''}
  <div class="cover-meta">
    <p><strong>Property:</strong> ${escapeHtml(ctx.job.propertyAddress)}</p>
    <p><strong>Client:</strong> ${escapeHtml(ctx.job.clientName)}</p>
    <p><strong>Job:</strong> ${escapeHtml(ctx.job.jobNumber)}</p>
    <p><strong>Inspection:</strong> ${escapeHtml(ctx.inspection.inspectionNumber)}</p>
    <p><strong>Inspector:</strong> ${escapeHtml(ctx.inspector?.name ?? '—')}</p>
    <p><strong>Inspection date:</strong> ${formatDate(ctx.inspection.completedAt ?? ctx.inspection.startedAt)}</p>
    ${company.abn ? `<p><strong>ABN:</strong> ${escapeHtml(company.abn)}</p>` : ''}
  </div>
</div>
${body}
${loadLegalScheduleHtml('pest')}
<div class="page-footer">${escapeHtml(footerText)}</div>
</body>
</html>`;
}
