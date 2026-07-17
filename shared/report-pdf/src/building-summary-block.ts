import type {
  ConclusionSection,
  MajorDefectsSection,
  MinorDefectsSection,
  MoistureTestingSection,
} from '../../room-engine-core/src/index.js';
import {
  applyDerivedMajorDefectFields,
  filterFilledCrackingEntries,
  generateMajorDefectAutoRecommendations,
  normalizeCheckboxField,
  normalizeFinishElementDamageEntry,
} from '../../room-engine-core/src/index.js';
import type { CheckboxFieldState } from '../../room-engine-core/src/index.js';
import { escapeHtml, renderHeadingGroup, renderSectionHeading } from './html-utils.js';
import { buildingPdfSectionTitle } from './building-pdf-headings.js';
import type { ReportRenderContext } from './types.js';

const MAJOR_DEFECTS_SECTION_NAME = buildingPdfSectionTitle('majorDefects');
const MINOR_DEFECTS_SECTION_NAME = buildingPdfSectionTitle('minorDefects');
const MOISTURE_TESTING_SECTION_NAME = buildingPdfSectionTitle('moistureTesting');
const CONCLUSION_SECTION_NAME = buildingPdfSectionTitle('conclusion');
const RECOMMENDATIONS_SECTION_NAME = buildingPdfSectionTitle('recommendations');

const SUMMARY_DISCLAIMER =
  'This summary highlights key inspection outcomes only and is not a substitute for the full report. ' +
  'Please read the complete report carefully. Where this summary and the detailed findings differ, ' +
  'the detailed findings in the body of this report take precedence.';

const URGENCY_NOTICE =
  'Unless stated otherwise, recommendations and remedial advice in this report should be addressed without ' +
  'undue delay. Refer to the Recommendations and Major Defects sections for further action.';

function checkboxItems(field: CheckboxFieldState | undefined): string[] {
  const normalized = normalizeCheckboxField(field);
  return [...normalized.selected, ...normalized.custom].filter(Boolean);
}

function displayValue(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : '—';
}

function renderSummaryRow(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
}

function seeSection(sectionName: string): string {
  return `(see section ${escapeHtml(sectionName)})`;
}

function observedItemsAnswer(items: string[], sectionName: string): string {
  if (!items.length) return 'was not observed.';
  return `was observed — ${escapeHtml(items.join(', '))} ${seeSection(sectionName)}`;
}

function crackingSummaryAnswer(majorDefects: MajorDefectsSection | undefined): string {
  const cracking = filterFilledCrackingEntries(majorDefects?.crackingEntries);
  if (!cracking.length) return 'was not observed.';
  const locations = cracking.map((entry) => entry.location.trim()).filter(Boolean);
  if (locations.length) {
    return `was observed — ${escapeHtml(locations.join(', '))} ${seeSection(MAJOR_DEFECTS_SECTION_NAME)}`;
  }
  const countLabel = cracking.length === 1 ? '1 entry recorded' : `${cracking.length} entries recorded`;
  return `was observed — ${escapeHtml(countLabel)} ${seeSection(MAJOR_DEFECTS_SECTION_NAME)}`;
}

function finishDamageSummaryAnswer(majorDefects: MajorDefectsSection | undefined): string {
  const entries = (majorDefects?.finishElementDamageEntries ?? []).map(normalizeFinishElementDamageEntry);
  if (!entries.length) return 'was not observed.';
  const items = entries
    .map((entry) => {
      const elements = checkboxItems(entry.elements).join(', ');
      return [elements, entry.location.trim()].filter(Boolean).join(' — ');
    })
    .filter(Boolean);
  if (!items.length) return `was observed ${seeSection(MAJOR_DEFECTS_SECTION_NAME)}`;
  return `was observed — ${escapeHtml(items.join('; '))} ${seeSection(MAJOR_DEFECTS_SECTION_NAME)}`;
}

function minorDefectsSummaryAnswer(minorDefects: MinorDefectsSection | undefined): string {
  const items = checkboxItems(minorDefects?.checklist);
  const comments = minorDefects?.comments?.trim();
  if (!items.length && !comments) return 'were not noted.';
  if (items.length && comments) {
    return `were noted — ${escapeHtml(items.join('; '))}. ${escapeHtml(comments)} ${seeSection(MINOR_DEFECTS_SECTION_NAME)}`;
  }
  if (items.length) {
    return `were noted — ${escapeHtml(items.join('; '))} ${seeSection(MINOR_DEFECTS_SECTION_NAME)}`;
  }
  return `were noted — ${escapeHtml(comments!)} ${seeSection(MINOR_DEFECTS_SECTION_NAME)}`;
}

function moistureEvidenceAnswer(moistureTesting: MoistureTestingSection | undefined): string {
  const visual = moistureTesting?.visualMoistureEvidence?.trim() === 'Yes';
  const excessive = moistureTesting?.excessiveMoistureEvidence?.trim() === 'Yes';
  if (!visual && !excessive) return 'was not observed.';
  const parts: string[] = [];
  if (visual) parts.push('visual moisture evidence');
  if (excessive) parts.push('excessive moisture evidence');
  return `was observed — ${escapeHtml(parts.join('; '))} ${seeSection(MOISTURE_TESTING_SECTION_NAME)}`;
}

function isYesAnswer(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'yes';
}

/** Yes when structural/deformation ticks, crack engineering, or derived eng fields say so. */
function engineeringRecommendedAnswer(majorDefects: MajorDefectsSection | undefined): string {
  if (!majorDefects) return 'No';
  const derived = applyDerivedMajorDefectFields(majorDefects);
  const cracking = filterFilledCrackingEntries(derived.crackingEntries);
  const recommended =
    isYesAnswer(derived.structuralEngineeringRequired) ||
    isYesAnswer(derived.deformationEngineeringRequired) ||
    isYesAnswer(majorDefects.structuralEngineeringRequired) ||
    isYesAnswer(majorDefects.deformationEngineeringRequired) ||
    checkboxItems(majorDefects.structuralMovement).length > 0 ||
    checkboxItems(majorDefects.deformation).length > 0 ||
    cracking.some((entry) => isYesAnswer(entry.engineeringRequired));
  return recommended ? `Yes ${seeSection(MAJOR_DEFECTS_SECTION_NAME)}` : 'No';
}

function crackingMonitoringAnswer(majorDefects: MajorDefectsSection | undefined): string {
  const cracking = filterFilledCrackingEntries(majorDefects?.crackingEntries);
  const recommended = cracking.some((entry) => entry.monitoringRecommended === 'Yes');
  return recommended ? `Yes ${seeSection(MAJOR_DEFECTS_SECTION_NAME)}` : 'No';
}

function resolveOverallConditionAnswer(conclusion: ConclusionSection): string {
  const condition = conclusion.overallBuildingCondition?.trim() || conclusion.overallComparison?.trim();
  if (!condition) return '—';
  return `${escapeHtml(condition)} ${seeSection(CONCLUSION_SECTION_NAME)}`;
}

function renderRecommendationsList(recommendations: string[]): string {
  if (!recommendations.length) return '';
  return `<ul class="report-list">${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export { resolveBuildingReportTitle } from './property-report-details-block.js';

/** Early summary block — after Property & Report Details, before Services & Utilities. */
export function renderInspectionFindingsSummaryBlock(ctx: ReportRenderContext): string {
  const building = ctx.formData.building;
  const conclusion = building?.conclusion;
  if (!conclusion) return '';

  const majorDefects = building?.majorDefects;
  const minorDefects = building?.minorDefects;
  const moistureTesting = building?.moistureTesting;
  const inspectorName = ctx.inspector?.name?.trim() || '—';

  const ratingRows = [
    renderSummaryRow('In the opinion of this Consultant:', escapeHtml(inspectorName)),
    renderSummaryRow('Quality of workmanship and materials:', displayValue(conclusion.qualityOfWorkmanship)),
    renderSummaryRow('Overall condition of the building:', resolveOverallConditionAnswer(conclusion)),
    renderSummaryRow('Major Defects Rating:', displayValue(conclusion.majorDefectsRating)),
    renderSummaryRow('Minor Defects Rating:', displayValue(conclusion.minorDefectsRating)),
    renderSummaryRow('Structural Damage Rating:', displayValue(conclusion.structuralDamageRating)),
    renderSummaryRow(
      'Conditions Conducive to Finish Element Damage Rating:',
      displayValue(conclusion.conditionsConduciveRating),
    ),
  ].join('\n');

  const significantRows = [
    renderSummaryRow(
      'Structural movement',
      observedItemsAnswer(checkboxItems(majorDefects?.structuralMovement), MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow(
      'Deformation or sagging',
      observedItemsAnswer(checkboxItems(majorDefects?.deformation), MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow('Cracking recorded', crackingSummaryAnswer(majorDefects)),
    renderSummaryRow(
      'Sources of moisture',
      observedItemsAnswer(checkboxItems(majorDefects?.moistureSources), MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow(
      'Conditions conducive to finish element damage',
      observedItemsAnswer(checkboxItems(majorDefects?.conditionsConducive), MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow('Finish element damage', finishDamageSummaryAnswer(majorDefects)),
    renderSummaryRow(
      'Major safety hazards',
      observedItemsAnswer(checkboxItems(majorDefects?.safetyHazards), MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow('Minor defects / maintenance items', minorDefectsSummaryAnswer(minorDefects)),
    renderSummaryRow('Moisture testing findings', moistureEvidenceAnswer(moistureTesting)),
    renderSummaryRow('Structural engineering recommended', engineeringRecommendedAnswer(majorDefects)),
    renderSummaryRow('Cracking monitoring recommended', crackingMonitoringAnswer(majorDefects)),
  ].join('\n');

  const autoRecommendations = majorDefects ? generateMajorDefectAutoRecommendations(majorDefects) : [];
  const manualRecommendations = building?.recommendations.manualRecommendations ?? [];
  const priorityRecommendations = [...new Set([...autoRecommendations, ...manualRecommendations])]
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  const recommendationsBlock = priorityRecommendations.length
    ? renderHeadingGroup(
        renderSectionHeading('Priority Recommendations'),
        `${renderRecommendationsList(priorityRecommendations)}
    <p class="building-summary-note">Further recommendations may appear in section ${escapeHtml(RECOMMENDATIONS_SECTION_NAME)}.</p>`,
        false,
      )
    : '';

  return `
<section class="report-section inspection-findings-summary building-inspection-summary">
  <p class="building-summary-disclaimer">${escapeHtml(SUMMARY_DISCLAIMER)}</p>
  ${renderHeadingGroup(
    renderSectionHeading('Summary of Inspection Findings'),
    `<table class="field-table inspection-summary-ratings building-summary-table">${ratingRows}</table>`,
    true,
  )}
  ${renderHeadingGroup(
    renderSectionHeading('Significant Items'),
    `<table class="field-table inspection-summary-ratings building-summary-table">${significantRows}</table>`,
    true,
  )}
  ${recommendationsBlock}
  <p class="building-summary-note">${escapeHtml(URGENCY_NOTICE)}</p>
</section>`;
}

function renderConclusionParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n');
}

/** Late conclusion block — narrative only at end of inspection findings area. */
export function renderConclusionNarrativeBlock(
  conclusion: ConclusionSection,
  hazardNote?: string,
): string {
  const text = conclusion.autoConclusion?.trim() ?? '';
  if (!text && !hazardNote?.trim()) return '';

  const body = [
    text ? `<div class="conclusion-narrative">${renderConclusionParagraphs(text)}</div>` : '',
    hazardNote ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  return `
<section class="report-section conclusion-section">
  ${renderHeadingGroup(renderSectionHeading('Conclusion'), body, false)}
</section>`;
}
