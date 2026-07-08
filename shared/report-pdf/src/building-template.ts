import {
  BUILDING_EXTENSION_SECTION_KEYS,
  GENERAL_ELECTRICAL_DISCLAIMERS,
  SHARED_INSPECTION_SECTION_KEYS,
  type ConclusionSection,
  type InspectionPhotoRef,
} from '../../room-engine-core/src/index.js';
import { escapeHtml, renderComments, renderPhotos, renderSectionBlock } from './html-utils.js';
import { renderInspectorHazardAssessmentBlock, renderInspectorHazardLowConclusionNote } from './hazard-assessment-block.js';
import {
  buildingPdfPartTitleForKey,
  buildingPdfSectionTitle,
  renderPdfPartHeading,
} from './building-pdf-headings.js';
import { renderCertificationSectionBlock } from './certification-block.js';
import {
  renderConclusionNarrativeBlock,
  renderInspectionFindingsSummaryBlock,
} from './building-summary-block.js';
import { renderCoverHeader } from './cover-header.js';
import { loadLegalScheduleHtml } from './legal-loader.js';
import { renderCoverReferenceMeta } from './report-identifiers.js';
import {
  getBuildingSectionFieldDefs,
  getRoomFieldDefs,
  getSharedSectionFieldDefs,
} from './section-fields.js';
import { reportPrintStyles } from './styles.js';
import { renderPropertyReportDetailsBlock, resolveBuildingReportTitle } from './property-report-details-block.js';
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
  <h3 class="report-section-heading">${escapeHtml(buildingPdfSectionTitle('recommendations'))}</h3>
  ${listHtml}
  ${renderComments(comments)}
  ${renderPhotos(photos as InspectionPhotoRef[])}
</section>`;
}

function maybeRenderPartHeading(sections: string[], key: string, renderedParts: Set<string>): void {
  const partTitle = buildingPdfPartTitleForKey(key);
  if (!partTitle || renderedParts.has(partTitle)) return;
  renderedParts.add(partTitle);
  sections.push(renderPdfPartHeading(partTitle));
}

function renderBuildingSection(
  sections: string[],
  key: string,
  data: Record<string, unknown>,
  hazardNote?: string,
  renderedParts?: Set<string>,
): void {
  if (renderedParts) maybeRenderPartHeading(sections, key, renderedParts);

  if (key === 'recommendations') {
    const block = renderRecommendationsBlock(data);
    if (block) sections.push(block);
    return;
  }
  if (key === 'riskAssessment' || key === 'thermalImaging') {
    return;
  }

  if (key === 'inspectorDeclaration') {
    const block = renderCertificationSectionBlock(
      buildingPdfSectionTitle('inspectorDeclaration'),
      data,
      BUILDING_FIELD_LABEL_OVERRIDES.inspectorDeclaration,
      getBuildingSectionFieldDefs('inspectorDeclaration'),
    );
    if (block) sections.push(block);
    return;
  }

  if (key === 'conclusion') {
    const conclusion = data as unknown as ConclusionSection;
    const block = renderConclusionNarrativeBlock(conclusion, hazardNote);
    if (block) sections.push(block);
    return;
  }

  const block = renderSectionBlock(
    buildingPdfSectionTitle(key),
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

const BUILDING_FIELD_LABEL_OVERRIDES: Record<string, Record<string, string>> = {};

function renderBuildingElectricalDisclaimerLegalHtml(): string {
  const items = GENERAL_ELECTRICAL_DISCLAIMERS.map(
    (statement) => `<li>${escapeHtml(statement)}</li>`,
  ).join('');
  return `<div class="legal-doc"><h2>General Electrical Disclaimer</h2><ul class="report-list">${items}</ul></div>`;
}

function loadBuildingLegalScheduleHtml(): string {
  const schedule = loadLegalScheduleHtml('building');
  const electrical = renderBuildingElectricalDisclaimerLegalHtml();
  return schedule.replace('</section>', `${electrical}\n</section>`);
}

function wrapDocument(ctx: ReportRenderContext, body: string, title: string): string {
  const { settings } = ctx;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>${reportPrintStyles(settings.primaryColor, settings.secondaryColor)}</style>
</head>
<body class="report-body">
<div class="cover-page">
  ${renderCoverHeader(ctx)}
  <h1 class="cover-title">${escapeHtml(title)}</h1>
  <p class="cover-subtitle">Prepared in accordance with AS 4349.1</p>
  ${settings.reportHeader ? `<p>${escapeHtml(settings.reportHeader)}</p>` : ''}
  ${renderCoverReferenceMeta(ctx)}
</div>
${body}
${loadBuildingLegalScheduleHtml()}
</body>
</html>`;
}

export function renderBuildingReportHtml(ctx: ReportRenderContext): string {
  const sections: string[] = [];
  const renderedParts = new Set<string>();
  const reportTitle = resolveBuildingReportTitle(ctx);

  maybeRenderPartHeading(sections, 'jobInformation', renderedParts);
  const propertyDetailsBlock = renderPropertyReportDetailsBlock(ctx);
  if (propertyDetailsBlock) sections.push(propertyDetailsBlock);

  if (ctx.formData.building) {
    const summaryBlock = renderInspectionFindingsSummaryBlock(ctx);
    if (summaryBlock) sections.push(summaryBlock);
  }

  for (const key of SHARED_INSPECTION_SECTION_KEYS) {
    if (key === 'jobInformation') continue;

    maybeRenderPartHeading(sections, key, renderedParts);
    const data = ctx.formData.shared[key] as unknown as Record<string, unknown>;
    const block = renderSectionBlock(
      buildingPdfSectionTitle(key),
      data,
      new Set(),
      BUILDING_FIELD_LABEL_OVERRIDES[key],
      getSharedSectionFieldDefs(key),
    );
    if (block) sections.push(block);
  }

  if (ctx.formData.building) {
    const hazard = ctx.formData.shared.inspectorHazardAssessment;
    const hazardLowNote = renderInspectorHazardLowConclusionNote(hazard);

    for (const key of BUILDING_EXTENSION_SECTION_KEYS) {
      if (key === 'electricalGeneral') continue;
      if (key === 'conclusion') {
        const hazardBlock = renderInspectorHazardAssessmentBlock(hazard);
        if (hazardBlock) sections.push(hazardBlock);
      }
      const data = ctx.formData.building[key] as unknown as Record<string, unknown>;
      renderBuildingSection(sections, key, data, key === 'conclusion' ? hazardLowNote : undefined, renderedParts);
      if (key === 'laundry') {
        renderInspectionRooms(sections, ctx.rooms);
      }
    }
  }

  if (settingsFooter(ctx)) {
    sections.push(`<section class="report-section"><p>${escapeHtml(ctx.settings.reportFooter!)}</p></section>`);
  }

  return wrapDocument(ctx, sections.join('\n'), reportTitle);
}

function settingsFooter(ctx: ReportRenderContext): boolean {
  return Boolean(ctx.settings.reportFooter?.trim());
}
