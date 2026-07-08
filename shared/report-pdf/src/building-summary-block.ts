import type {
  ConclusionSection,
  MajorDefectsSection,
} from '../../room-engine-core/src/index.js';
import { normalizeCheckboxField } from '../../room-engine-core/src/index.js';
import type { CheckboxFieldState } from '../../room-engine-core/src/index.js';
import { escapeHtml } from './html-utils.js';
import { buildingPdfSectionTitle } from './building-pdf-headings.js';
import type { ReportRenderContext } from './types.js';

const MAJOR_DEFECTS_SECTION_NAME = buildingPdfSectionTitle('majorDefects');
const CONCLUSION_SECTION_NAME = buildingPdfSectionTitle('conclusion');

const OVERALL_PROPERTY_QUESTION =
  'In respect to the overall condition of the property: Following the inspection of surface work in the readily accessible areas of the property, the overall condition of the building relative to the average condition of similar buildings of approximately the same age that have been reasonably well maintained was considered:';

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

function ratingImpliesObserved(rating: string | undefined): boolean {
  const value = rating?.trim();
  if (!value) return false;
  return value === 'High' || value === 'Above Average';
}

function hasStructuralDamageEvidence(
  majorDefects: MajorDefectsSection | undefined,
  conclusion: ConclusionSection,
): boolean {
  if (ratingImpliesObserved(conclusion.structuralDamageRating)) return true;
  if (!majorDefects) return false;

  const cracking = majorDefects.crackingEntries ?? [];
  const finishDamage = majorDefects.finishElementDamageEntries ?? [];
  return (
    checkboxItems(majorDefects.structuralMovement).length > 0 ||
    checkboxItems(majorDefects.deformation).length > 0 ||
    cracking.length > 0 ||
    finishDamage.length > 0 ||
    majorDefects.structuralEngineeringRequired === 'Yes' ||
    majorDefects.deformationEngineeringRequired === 'Yes'
  );
}

function hasConduciveStructuralEvidence(
  majorDefects: MajorDefectsSection | undefined,
  conclusion: ConclusionSection,
): boolean {
  if (ratingImpliesObserved(conclusion.conditionsConduciveRating)) return true;
  if (!majorDefects) return false;

  return (
    checkboxItems(majorDefects.conditionsConducive).length > 0 ||
    checkboxItems(majorDefects.moistureSources).length > 0 ||
    (majorDefects.finishElementDamageEntries ?? []).length > 0
  );
}

function evidenceAnswer(observed: boolean, sectionName: string): string {
  return observed
    ? `was observed (see section ${escapeHtml(sectionName)})`
    : 'was not observed';
}

function resolveBuildingConditionAnswer(conclusion: ConclusionSection): string {
  return displayValue(
    conclusion.overallBuildingCondition?.trim() || conclusion.overallComparison?.trim(),
  );
}

function resolveOverallPropertyAnswer(conclusion: ConclusionSection): string {
  const comparison = conclusion.overallComparison?.trim();
  if (!comparison) return '—';
  return `${escapeHtml(comparison)} (see section ${escapeHtml(CONCLUSION_SECTION_NAME)})`;
}

export { resolveBuildingReportTitle } from './property-report-details-block.js';

/** Early summary block — after Property & Report Details, before Services & Utilities. */
export function renderInspectionFindingsSummaryBlock(ctx: ReportRenderContext): string {
  const conclusion = ctx.formData.building?.conclusion;
  if (!conclusion) return '';

  const majorDefects = ctx.formData.building?.majorDefects;
  const inspectorName = ctx.inspector?.name?.trim() || '—';
  const structuralObserved = hasStructuralDamageEvidence(majorDefects, conclusion);
  const conduciveObserved = hasConduciveStructuralEvidence(majorDefects, conclusion);

  const rows = [
    renderSummaryRow('In the opinion of this Consultant:', escapeHtml(inspectorName)),
    renderSummaryRow(
      'Quality of workmanship and materials:',
      displayValue(conclusion.qualityOfWorkmanship),
    ),
    renderSummaryRow(
      'Evidence of structural damage:',
      evidenceAnswer(structuralObserved, MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow(
      'Evidence of conditions conducive to structural damage:',
      evidenceAnswer(conduciveObserved, MAJOR_DEFECTS_SECTION_NAME),
    ),
    renderSummaryRow(
      'Condition of the building relative to the average condition of similar buildings:',
      resolveBuildingConditionAnswer(conclusion),
    ),
    renderSummaryRow(OVERALL_PROPERTY_QUESTION, resolveOverallPropertyAnswer(conclusion)),
  ].join('\n');

  return `
<section class="report-section inspection-findings-summary">
  <h3 class="report-section-heading">Summary of Inspection Findings</h3>
  <table class="field-table inspection-summary-ratings">${rows}</table>
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

  return `
<section class="report-section conclusion-section">
  <h3 class="report-section-heading">Conclusion</h3>
  ${text ? `<div class="conclusion-narrative">${renderConclusionParagraphs(text)}</div>` : ''}
  ${hazardNote ?? ''}
</section>`;
}
