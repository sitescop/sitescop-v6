import {
  PEST_INSPECTION_SECTION_KEYS,
  PEST_INSPECTION_SECTION_LABELS,
  SHARED_INSPECTION_SECTION_KEYS,
} from '../../room-engine-core/src/index.js';
import { escapeHtml, renderSectionBlock } from './html-utils.js';
import { renderCoverHeader } from './cover-header.js';
import { renderInspectorHazardAssessmentBlock } from './hazard-assessment-block.js';
import { loadLegalScheduleHtml } from './legal-loader.js';
import { renderPestConclusionBlock } from './pest-conclusion-block.js';
import { renderCoverReferenceMeta } from './report-identifiers.js';
import { renderPdfLetterPartHeading } from './report-design.js';
import { getPestSectionFieldDefs, getSharedSectionFieldDefs } from './section-fields.js';
import { reportPrintStyles } from './styles.js';
import { renderPestInspectionSummaryBlock } from './pest-inspection-summary-block.js';
import {
  renderPropertyReportDetailsBlock,
  resolvePestReportTitle,
} from './property-report-details-block.js';
import type { ReportRenderContext } from './types.js';

const PEST_PDF_SECTION_TITLES: Record<string, string> = {
  undetectedTimberPestRisk: 'Undetected Timber Pest Risk Assessment',
  d1ActiveTermites: 'D1 — Active (Live) Termites',
  d2ManagementProposal: 'D2 — Subterranean Termite Management Proposal',
  d3TermiteWorkings: 'D3 — Termite Workings and/or Damage',
  d4PreviousTreatment: 'D4 — Previous Termite Management Program',
  d5FutureInspection: 'D5 — Frequency of Future Inspections',
  d6ChemicalDelignification: 'D6 — Chemical Delignification',
  d7FungalDecay: 'D7 — Fungal Decay',
  d8WoodBorers: 'D8 — Wood Borers',
  d9SubfloorVentilation: 'D9 — Lack of Adequate Subfloor Ventilation',
  d10ExcessiveMoisture: 'D10 — The Presence of Excessive Moisture',
  d11BarrierBridging: 'D11 — Bridging of Termite Barriers',
  d13ConduciveConditions: 'D13 — Other Conditions Conducive',
  d14MajorSafetyHazards: 'D14 — Major Safety Hazards',
};

function pestPdfSectionTitle(key: string): string {
  return PEST_PDF_SECTION_TITLES[key] ?? PEST_INSPECTION_SECTION_LABELS[key as keyof typeof PEST_INSPECTION_SECTION_LABELS] ?? key;
}

const PEST_SECTION_FIELD_LABELS: Partial<Record<string, Record<string, string>>> = {
  d1ActiveTermites: {
    evidenceAnswer: 'Active (Live) Termites',
  },
  d3TermiteWorkings: {
    summaryAnswer: 'Termite Workings and/or Damage',
    evidenceAnswer: 'Termite workings / damage evidence',
  },
  d4PreviousTreatment: {
    evidenceAnswer: 'Previous Termite Management Program',
  },
  d6ChemicalDelignification: {
    summaryAnswer: 'Chemical Delignification',
  },
  d7FungalDecay: {
    summaryAnswer: 'Fungal Decay',
  },
  d8WoodBorers: {
    answer: 'Wood Borers',
  },
  d9SubfloorVentilation: {
    answer: 'Lack of Adequate Subfloor Ventilation',
  },
  d10ExcessiveMoisture: {
    answer: 'Presence of Excessive Moisture',
  },
  d11BarrierBridging: {
    summaryAnswer: 'Bridging of Termite Barriers',
  },
  d13ConduciveConditions: {
    summaryDuringInspection: 'Other Conditions Conducive',
  },
  d14MajorSafetyHazards: {
    summaryAnswer: 'Major Safety Hazards',
  },
};

export { resolvePestReportTitle } from './property-report-details-block.js';

export function renderPestReportHtml(ctx: ReportRenderContext): string {
  const { settings } = ctx;

  const sections: string[] = [];

  if (ctx.formData.pest) {
    sections.push(
      renderPdfLetterPartHeading('Section A — Results of Inspection (Summary)'),
      renderPestInspectionSummaryBlock(ctx.formData.pest),
    );
  }

  sections.push(
    renderPdfLetterPartHeading('Section B — Property & Report Details'),
    renderPropertyReportDetailsBlock(ctx),
  );

  sections.push(renderPdfLetterPartHeading('Section C — Site & Property Assessment'));
  for (const key of SHARED_INSPECTION_SECTION_KEYS) {
    if (key === 'jobInformation') continue;

    const data = ctx.formData.shared[key] as unknown as Record<string, unknown>;
    const extraSkip =
      key === 'accessibilityObstructions'
        ? new Set<string>(['undetectedStructuralRisk', 'riskExplanation'])
        : new Set<string>();
    const block = renderSectionBlock(
      key === 'services' ? 'Services & Utilities' : key === 'propertyDescription' ? 'Property Description' : key === 'accessibilityObstructions' ? 'Accessibility & Obstructions' : key === 'siteConditions' ? 'Site Conditions' : key === 'external' ? 'External Building Elements' : key === 'roofExterior' ? 'Roof Exterior' : 'Roof Space',
      data,
      extraSkip,
      undefined,
      getSharedSectionFieldDefs(key),
    );
    if (block) sections.push(block);
  }

  if (ctx.formData.pest) {
    sections.push(renderPdfLetterPartHeading('Section D — Timber Pest Inspection Findings'));
    for (const key of PEST_INSPECTION_SECTION_KEYS) {
      if (key === 'pestConclusion') continue;
      const data = ctx.formData.pest[key] as unknown as Record<string, unknown>;
      const fieldDefs = getPestSectionFieldDefs(key).map((def) => {
        const override = PEST_SECTION_FIELD_LABELS[key]?.[def.key];
        return override ? { ...def, label: override } : def;
      });
      const block = renderSectionBlock(
        pestPdfSectionTitle(key),
        data,
        new Set(),
        PEST_SECTION_FIELD_LABELS[key],
        fieldDefs,
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
  const reportTitle = resolvePestReportTitle();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(reportTitle)}</title>
<style>${reportPrintStyles(settings.primaryColor, settings.secondaryColor)}</style>
</head>
<body class="report-body">
<div class="cover-page">
  ${renderCoverHeader(ctx)}
  <h1 class="cover-title">${escapeHtml(reportTitle)}</h1>
  <p class="cover-subtitle">Prepared in accordance with AS 4349.3</p>
  ${settings.reportHeader ? `<p>${escapeHtml(settings.reportHeader)}</p>` : ''}
  ${renderCoverReferenceMeta(ctx)}
</div>
${body}
${loadLegalScheduleHtml('pest')}
</body>
</html>`;
}
