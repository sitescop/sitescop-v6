import {
  BUILDING_EXTENSION_SECTION_KEYS,
  GENERAL_ELECTRICAL_DISCLAIMERS,
  SHARED_INSPECTION_SECTION_KEYS,
  isFormSectionInaccessibleFromAccessibility,
  isSubfloorApplicable,
  resolveInaccessibleReasonText,
  resolveSubfloorPresent,
  type ConclusionSection,
  type InspectionPhotoRef,
} from '../../room-engine-core/src/index.js';
import { escapeHtml, renderComments, renderHeadingGroup, renderPhotos, renderSectionBlock, renderSectionHeading, renderSupplementBlock } from './html-utils.js';
import { sharedSectionDataForReport } from './shared-section-report-data.js';
import { renderInspectorHazardAssessmentBlock, renderInspectorHazardLowConclusionNote } from './hazard-assessment-block.js';
import {
  BUILDING_PDF_PART_TITLES,
  buildingPdfPartTitleForKey,
  buildingPdfSectionTitle,
} from './building-pdf-headings.js';
import { renderCertificationSectionBlock } from './certification-block.js';
import {
  renderConclusionNarrativeBlock,
  renderInspectionFindingsSummaryBlock,
} from './building-summary-block.js';
import { renderCoverHeader } from './cover-header.js';
import { loadLegalScheduleHtml } from './legal-loader.js';
import { renderCoverReferenceMeta } from './report-identifiers.js';
import { renderPdfNumberedPartBlock } from './report-design.js';
import { renderRoomSectionBlock, resolveSortedRoomReportLabels } from './room-section-block.js';
import {
  getBuildingSectionFieldDefs,
  getSharedSectionFieldDefs,
} from './section-fields.js';
import { reportPrintStyles } from './styles.js';
import { renderPropertyReportDetailsBlock, resolveBuildingReportTitle } from './property-report-details-block.js';
import { pdfSectionInaccessibleOptions } from './inaccessible-pdf.js';
import type { ReportRenderContext, ReportRoomInfo } from './types.js';

const ROOM_SECTION_ORDER: Record<string, number> = {
  BATHROOM: 0,
  BEDROOM: 1,
  LIVING: 2,
  GARAGE: 3,
};

const SHARED_SECTION_TITLES: Record<string, string> = {
  services: 'Services & Utilities',
  propertyDescription: 'Property Description',
  accessibilityObstructions: 'Accessibility & Obstructions',
  siteConditions: 'Site Conditions',
  external: 'External Building Elements',
  roofExterior: 'Roof Exterior',
  roofSpace: 'Roof Space',
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
  <div class="report-section-block">
    ${renderHeadingGroup(renderSectionHeading(buildingPdfSectionTitle('recommendations')), listHtml, false)}
    ${renderSupplementBlock(renderComments(comments), renderPhotos(photos as InspectionPhotoRef[]))}
  </div>
</section>`;
}

class BuildingPartCollector {
  private readonly partBlocks: string[] = [];
  private activePartTitle: string | null = null;
  private buffer: string[] = [];
  private hasPriorParts = false;

  flush(): void {
    if (this.activePartTitle && this.buffer.length) {
      this.partBlocks.push(
        renderPdfNumberedPartBlock(this.activePartTitle, this.buffer.join('\n'), {
          startNewPage: this.hasPriorParts,
          endWithPageBreak: true,
        }),
      );
      this.hasPriorParts = true;
    } else if (!this.activePartTitle && this.buffer.length) {
      this.partBlocks.push(this.buffer.join('\n'));
    }
    this.buffer = [];
    this.activePartTitle = null;
  }

  startPart(title: string): void {
    if (this.activePartTitle === title) return;
    this.flush();
    this.activePartTitle = title;
  }

  push(html: string): void {
    if (html.trim()) this.buffer.push(html);
  }

  finish(): string[] {
    this.flush();
    return this.partBlocks;
  }
}

function renderBuildingSection(
  collector: BuildingPartCollector,
  key: string,
  data: Record<string, unknown>,
  ctx: ReportRenderContext,
): void {
  const partTitle = buildingPdfPartTitleForKey(key);
  if (partTitle) {
    collector.flush();
    collector.startPart(partTitle);
  }

  if (key === 'recommendations') {
    collector.push(renderRecommendationsBlock(data));
    return;
  }
  if (key === 'riskAssessment' || key === 'thermalImaging') {
    return;
  }

  if (key === 'inspectorDeclaration') {
    collector.push(
      renderCertificationSectionBlock(
        buildingPdfSectionTitle('inspectorDeclaration'),
        data,
        BUILDING_FIELD_LABEL_OVERRIDES.inspectorDeclaration,
        getBuildingSectionFieldDefs('inspectorDeclaration'),
        { startNewPage: true },
      ),
    );
    return;
  }

  if (key === 'conclusion') {
    return;
  }

  const inaccessible = pdfSectionInaccessibleOptions(key, data, ctx);
  collector.push(
    renderSectionBlock(
      buildingPdfSectionTitle(key),
      inaccessible.data,
      new Set(),
      BUILDING_FIELD_LABEL_OVERRIDES[key],
      getBuildingSectionFieldDefs(key),
      { collapseFields: inaccessible.collapseFields },
    ),
  );
}

function renderInspectionRooms(
  collector: BuildingPartCollector,
  rooms: ReportRoomInfo[],
  ctx: ReportRenderContext,
): void {
  const sorted = sortInspectionRooms(rooms);
  const resolvedLabels = resolveSortedRoomReportLabels(sorted);
  const accessibility = ctx.formData.shared.accessibilityObstructions;
  const subfloorApplicable = isSubfloorApplicable(
    resolveSubfloorPresent(
      ctx.formData.shared.propertyDescription,
      ctx.formData.building?.subfloor,
      accessibility,
    ),
  );
  const interiorLocked = isFormSectionInaccessibleFromAccessibility(
    'kitchen',
    accessibility.accessibilityAreas,
    subfloorApplicable,
  );
  const interiorReason = interiorLocked
    ? resolveInaccessibleReasonText('Interior', accessibility.inaccessibleAreaReasons)
    : '';

  sorted.forEach((room, index) => {
    collector.push(
      renderRoomSectionBlock(room, resolvedLabels, index, {
        collapseFields: interiorLocked,
        inaccessibleArea: interiorLocked ? 'Interior' : null,
        inaccessibleReason: interiorReason,
      }),
    );
  });
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
  const collector = new BuildingPartCollector();
  const reportTitle = resolveBuildingReportTitle(ctx);

  collector.startPart(BUILDING_PDF_PART_TITLES.jobInformation);
  collector.push(renderPropertyReportDetailsBlock(ctx));

  if (ctx.formData.building) {
    const summaryBlock = renderInspectionFindingsSummaryBlock(ctx);
    if (summaryBlock) {
      collector.flush();
      collector.startPart(BUILDING_PDF_PART_TITLES.inspectionSummary);
      collector.push(summaryBlock);
      collector.flush();
    }
  }

  const subfloorApplicable = isSubfloorApplicable(
    resolveSubfloorPresent(
      ctx.formData.shared.propertyDescription,
      ctx.formData.building?.subfloor,
      ctx.formData.shared.accessibilityObstructions,
    ),
  );

  // Match workspace order: External → Subfloor → Fencing → Outbuildings → Roof Exterior → Roof Space,
  // then Internal Areas. (Previously Subfloor sat after all rooms, so it looked "missing" vs Roof Space.)
  const outsideBuildingKeys = ['subfloor', 'fencing', 'outbuildings'] as const;
  const deferredRoofKeys = new Set(['roofExterior', 'roofSpace']);

  for (const key of SHARED_INSPECTION_SECTION_KEYS) {
    if (key === 'jobInformation') continue;
    if (deferredRoofKeys.has(key)) continue;

    const partTitle = buildingPdfPartTitleForKey(key);
    if (partTitle) {
      collector.flush();
      collector.startPart(partTitle);
    }

    const data = sharedSectionDataForReport(key, ctx.formData.shared);
    const inaccessible = pdfSectionInaccessibleOptions(key, data, ctx);
    collector.push(
      renderSectionBlock(
        SHARED_SECTION_TITLES[key] ?? buildingPdfSectionTitle(key),
        inaccessible.data,
        new Set(),
        BUILDING_FIELD_LABEL_OVERRIDES[key],
        getSharedSectionFieldDefs(key),
        {
          startNewPage: key === 'services' || key === 'propertyDescription',
          collapseFields: inaccessible.collapseFields,
        },
      ),
    );

    if (key === 'external' && ctx.formData.building) {
      for (const outsideKey of outsideBuildingKeys) {
        if (outsideKey === 'subfloor' && !subfloorApplicable) continue;
        const outsideData = ctx.formData.building[outsideKey] as unknown as Record<string, unknown>;
        renderBuildingSection(collector, outsideKey, outsideData, ctx);
      }
    }
  }

  for (const key of ['roofExterior', 'roofSpace'] as const) {
    const data = sharedSectionDataForReport(key, ctx.formData.shared);
    const inaccessible = pdfSectionInaccessibleOptions(key, data, ctx);
    collector.push(
      renderSectionBlock(
        SHARED_SECTION_TITLES[key] ?? buildingPdfSectionTitle(key),
        inaccessible.data,
        new Set(),
        BUILDING_FIELD_LABEL_OVERRIDES[key],
        getSharedSectionFieldDefs(key),
        { collapseFields: inaccessible.collapseFields },
      ),
    );
  }

  if (ctx.formData.building) {
    const hazard = ctx.formData.shared.inspectorHazardAssessment;
    const hazardLowNote = renderInspectorHazardLowConclusionNote(hazard);
    const outsideRendered = new Set<string>(outsideBuildingKeys);

    for (const key of BUILDING_EXTENSION_SECTION_KEYS) {
      if (key === 'electricalGeneral') continue;
      if (outsideRendered.has(key)) continue;

      const data = ctx.formData.building[key] as unknown as Record<string, unknown>;

      if (key === 'conclusion') {
        collector.flush();
        collector.startPart(BUILDING_PDF_PART_TITLES.conclusion);
        const hazardBlock = renderInspectorHazardAssessmentBlock(hazard);
        if (hazardBlock) collector.push(hazardBlock);
        collector.push(
          renderConclusionNarrativeBlock(data as unknown as ConclusionSection, hazardLowNote),
        );
        continue;
      }

      renderBuildingSection(collector, key, data, ctx);
      if (key === 'laundry') {
        renderInspectionRooms(collector, ctx.rooms, ctx);
      }
    }
  }

  const partBlocks = collector.finish();

  if (settingsFooter(ctx)) {
    partBlocks.push(`<section class="report-section"><p>${escapeHtml(ctx.settings.reportFooter!)}</p></section>`);
  }

  return wrapDocument(ctx, partBlocks.join('\n'), reportTitle);
}

function settingsFooter(ctx: ReportRenderContext): boolean {
  return Boolean(ctx.settings.reportFooter?.trim());
}
