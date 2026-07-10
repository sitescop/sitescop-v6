import type { PestInspectionSections } from '../../room-engine-core/src/index.js';
import {
  formatPestFutureInspectionFrequency,
  isPestEvidenceFound,
  isPestPresenceUndetermined,
} from '../../room-engine-core/src/index.js';
import { escapeHtml, renderHeadingGroup, renderSectionHeading } from './html-utils.js';

const SUMMARY_DISCLAIMER =
  'This summary highlights key inspection outcomes only and is not a substitute for the full report. ' +
  'Please read the complete report carefully. Where this summary and the detailed findings differ, ' +
  'the detailed findings in the body of this report take precedence.';

const URGENCY_NOTICE =
  'Unless stated otherwise, recommendations and remedial advice in this report should be addressed without ' +
  'undue delay. For further guidance on timber pest risk management and protecting the property, refer to ' +
  'Section E — Conclusion & Certification and Schedule 1.';

const CONDUCIVE_ITEM_KEYS: { item: string; read: (pest: PestInspectionSections) => string | undefined }[] = [
  { item: 'D9', read: (p) => p.d9SubfloorVentilation.answer },
  { item: 'D10', read: (p) => p.d10ExcessiveMoisture.answer },
  { item: 'D11', read: (p) => p.d11BarrierBridging.summaryAnswer },
  { item: 'D13', read: (p) => p.d13ConduciveConditions.summaryDuringInspection },
];

function presenceSummaryAnswer(value: string | undefined, itemRef: string): string {
  if (isPestEvidenceFound(value)) return `Evidence found — see Item ${itemRef}`;
  if (isPestPresenceUndetermined(value)) return `presence was undetermined — see Item ${itemRef}`;
  return 'No evidence found.';
}

function majorHazardSummaryAnswer(answer: string | undefined): string {
  return answer?.trim() === 'Hazard Found' ? 'Evidence found — see Item D14' : 'No evidence found.';
}

function resolveConduciveSummary(pest: PestInspectionSections): string {
  const foundItems = CONDUCIVE_ITEM_KEYS.filter(({ read }) => isPestEvidenceFound(read(pest))).map(
    ({ item }) => item,
  );
  if (!foundItems.length) return 'No evidence found.';
  if (foundItems.length === 1) return `Evidence found — see Item ${foundItems[0]}`;
  return `Evidence found — see Items ${foundItems.join(', ')}`;
}

function renderSummaryRow(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
}

function renderNarrativeParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p class="pest-summary-note">${escapeHtml(part)}</p>`)
    .join('\n');
}

function appendAccessibilityCrossReference(riskExplanation: string): string {
  const trimmed = riskExplanation.trim();
  if (!trimmed) return '';
  if (/section\s+c\b/i.test(trimmed)) return trimmed;
  return `${trimmed} See Section C — Site & Property Assessment (Accessibility & Obstructions) for detail.`;
}

/** Section B — executive summary for timber and pest reports. */
export function renderPestInspectionSummaryBlock(pest: PestInspectionSections): string {
  const nextInspection =
    formatPestFutureInspectionFrequency(pest.d5FutureInspection.frequency) || '—';

  const rows = [
    renderSummaryRow(
      'Evidence of active (live) termites',
      presenceSummaryAnswer(pest.d1ActiveTermites.evidenceAnswer, 'D1'),
    ),
    renderSummaryRow(
      'Evidence of termite activity (including workings) and/or damage',
      presenceSummaryAnswer(pest.d3TermiteWorkings.summaryAnswer, 'D3'),
    ),
    renderSummaryRow(
      'Evidence of a possible previous termite management program',
      presenceSummaryAnswer(pest.d4PreviousTreatment.evidenceAnswer, 'D4'),
    ),
    renderSummaryRow(
      'The next inspection to help detect future termite activity is recommended in',
      escapeHtml(nextInspection),
    ),
    renderSummaryRow(
      'Evidence of chemical delignification damage',
      presenceSummaryAnswer(pest.d6ChemicalDelignification.summaryAnswer, 'D6'),
    ),
    renderSummaryRow(
      'Evidence of fungal decay activity and/or damage',
      presenceSummaryAnswer(pest.d7FungalDecay.summaryAnswer, 'D7'),
    ),
    renderSummaryRow(
      'Evidence of wood borer activity and/or damage',
      presenceSummaryAnswer(pest.d8WoodBorers.answer, 'D8'),
    ),
    renderSummaryRow(
      'Evidence of conditions conducive to timber pest attack',
      resolveConduciveSummary(pest),
    ),
    renderSummaryRow(
      'Evidence of major safety hazards',
      majorHazardSummaryAnswer(pest.d14MajorSafetyHazards.summaryAnswer),
    ),
  ].join('\n');

  const riskNarrative = appendAccessibilityCrossReference(pest.undetectedTimberPestRisk.riskExplanation);

  const riskBlock = riskNarrative
    ? `<div class="pest-summary-risk">${renderNarrativeParagraphs(riskNarrative)}</div>`
    : '';

  return `
<section class="report-section inspection-findings-summary pest-inspection-summary">
  <p class="pest-summary-disclaimer">${escapeHtml(SUMMARY_DISCLAIMER)}</p>
  ${renderHeadingGroup(
    renderSectionHeading('Significant Items'),
    `<table class="field-table inspection-summary-ratings pest-summary-table">${rows}</table>${riskBlock}`,
    true,
  )}
  <p class="pest-summary-note">${escapeHtml(URGENCY_NOTICE)}</p>
</section>`;
}
