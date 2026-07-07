import {
  BUILDING_EXTENSION_SECTION_KEYS,
  BUILDING_EXTENSION_SECTION_LABELS,
  SHARED_INSPECTION_SECTION_KEYS,
  SHARED_INSPECTION_SECTION_LABELS,
  type InspectionPhotoRef,
} from '../../room-engine-core/src/index.js';
import { SITESCOP_PDF_FOOTER_TEXT } from '../../company-branding.js';
import { escapeHtml, formatDate, renderComments, renderPhotos, renderSectionBlock } from './html-utils.js';
import { renderInspectorHazardAssessmentBlock, renderInspectorHazardLowConclusionNote } from './hazard-assessment-block.js';
import { renderCoverHeader } from './cover-header.js';
import { loadLegalScheduleHtml } from './legal-loader.js';
import {
  getBuildingSectionFieldDefs,
  getRoomFieldDefs,
  getSharedSectionFieldDefs,
} from './section-fields.js';
import { reportPrintStyles } from './styles.js';
import type { ReportRenderContext, ReportRoomInfo } from './types.js';

const ROOM_SECTION_ORDER: Record<string, number> = {
  BATHROOM: 0,
  BEDROOM: 1,
  LIVING: 2,
  GARAGE: 3,
};

function sortInspectionRooms(rooms: ReportRoomInfo[]): ReportRoomInfo[] {
  return [...rooms].sort((a, b) => {
    const typeOrder =
      (ROOM_SECTION_ORDER[a.roomType] ?? 99) - (ROOM_SECTION_ORDER[b.roomType] ?? 99);
    if (typeOrder !== 0) return typeOrder;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}

function renderRecommendationsBlock(data: Record<string, unknown>): string {
  const auto = Array.isArray(data.autoRecommendations)
    ? data.autoRecommendations.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  const manual = Array.isArray(data.manualRecommendations)
    ? data.manualRecommendations.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  const combined = [...new Set([...auto, ...manual])];
  const comments = typeof data.comments === 'string' ? data.comments : '';
  const photos = Array.isArray(data.photos) ? data.photos : [];

  const listHtml = combined.length
    ? `<ul class="report-list">${combined.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>—</p>';

  if (!combined.length && !comments.trim() && !photos.length) return '';

  return `
<section class="report-section">
  <h2>Recommendations</h2>
  ${listHtml}
  ${renderComments(comments)}
  ${renderPhotos(photos as InspectionPhotoRef[])}
</section>`;
}

function renderBuildingSection(
  sections: string[],
  key: string,
  data: Record<string, unknown>,
  hazardNote?: string,
): void {
  if (key === 'recommendations') {
    const block = renderRecommendationsBlock(data);
    if (block) sections.push(block);
    return;
  }
  if (key === 'riskAssessment') {
    return;
  }

  if (key === 'conclusion') {
    const block = renderSectionBlock(
      BUILDING_EXTENSION_SECTION_LABELS.conclusion,
      data,
      new Set(),
      BUILDING_FIELD_LABEL_OVERRIDES.conclusion,
      getBuildingSectionFieldDefs('conclusion'),
    );
    if (!block && !hazardNote) return;
    if (block && hazardNote) {
      sections.push(block.replace('</h2>', `</h2>\n${hazardNote}`));
      return;
    }
    if (block) {
      sections.push(block);
      return;
    }
    sections.push(`<section class="report-section"><h2>Conclusion</h2>${hazardNote ?? ''}</section>`);
    return;
  }

  const block = renderSectionBlock(
    BUILDING_EXTENSION_SECTION_LABELS[key as keyof typeof BUILDING_EXTENSION_SECTION_LABELS],
    data,
    new Set(),
    BUILDING_FIELD_LABEL_OVERRIDES[key],
    getBuildingSectionFieldDefs(key),
  );
  if (block) sections.push(block);
}

function renderInspectionRooms(sections: string[], rooms: ReportRoomInfo[]): void {
  for (const room of sortInspectionRooms(rooms)) {
    const block = renderSectionBlock(
      room.label,
      room.data,
      new Set(),
      undefined,
      getRoomFieldDefs(room.roomType, room.roomIndex),
    );
    if (block) sections.push(block);
  }
}

const BUILDING_FIELD_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  conclusion: { autoConclusion: 'Conclusion' },
};

function wrapDocument(ctx: ReportRenderContext, body: string, title: string): string {
  const { company, settings } = ctx;
  const footerText = settings.pdfFooterText?.trim() || SITESCOP_PDF_FOOTER_TEXT;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>${reportPrintStyles(settings.primaryColor, settings.secondaryColor)}</style>
</head>
<body>
<div class="cover-page">
  ${renderCoverHeader(ctx)}
  <h1 class="cover-title">${escapeHtml(title)}</h1>
  <p class="cover-subtitle">Prepared in accordance with AS 4349.1</p>
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
${loadLegalScheduleHtml('building')}
<div class="page-footer">${escapeHtml(footerText)}</div>
</body>
</html>`;
}

export function renderBuildingReportHtml(ctx: ReportRenderContext): string {
  const sections: string[] = [];
  const skipJobPhotos = new Set(['photos']);

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

  if (ctx.formData.building) {
    const hazard = ctx.formData.shared.inspectorHazardAssessment;
    const hazardLowNote = renderInspectorHazardLowConclusionNote(hazard);

    for (const key of BUILDING_EXTENSION_SECTION_KEYS) {
      if (key === 'conclusion') {
        const hazardBlock = renderInspectorHazardAssessmentBlock(hazard);
        if (hazardBlock) sections.push(hazardBlock);
      }
      const data = ctx.formData.building[key] as unknown as Record<string, unknown>;
      renderBuildingSection(sections, key, data, key === 'conclusion' ? hazardLowNote : undefined);
      if (key === 'laundry') {
        renderInspectionRooms(sections, ctx.rooms);
      }
    }
  }

  if (settingsFooter(ctx)) {
    sections.push(`<section class="report-section"><p>${escapeHtml(ctx.settings.reportFooter!)}</p></section>`);
  }

  return wrapDocument(ctx, sections.join('\n'), 'Building Inspection Report');
}

function settingsFooter(ctx: ReportRenderContext): boolean {
  return Boolean(ctx.settings.reportFooter?.trim());
}
