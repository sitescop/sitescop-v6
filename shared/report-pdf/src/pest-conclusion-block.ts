import type { InspectorHazardAssessmentSection, PestInspectionSections } from '../../room-engine-core/src/index.js';
import { formatPestFutureInspectionFrequency } from '../../room-engine-core/src/index.js';
import { escapeHtml, formatDate } from './html-utils.js';
import { renderCertificationIntroHtml } from './certification-block.js';
import { renderInspectorHazardLowConclusionNote } from './hazard-assessment-block.js';
import { renderPdfLetterPartHeading } from './report-design.js';

function renderSignatureImage(dataUrl: string | undefined): string {
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
    return `<img src="${dataUrl.replace(/"/g, '&quot;')}" alt="Inspector signature" class="report-signature" />`;
  }
  return '<p class="signature-missing">Not signed</p>';
}

function renderConclusionParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((part) => part.trim())
    .map((part) => `<p>${escapeHtml(part.trim())}</p>`)
    .join('\n');
}

function renderRecommendationsList(recommendations: string[]): string {
  if (!recommendations.length) {
    return '<p>—</p>';
  }
  return `<ul class="report-list">${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

const NEXT_INSPECTION_PARAGRAPH =
  /^The next inspection to help detect future termite activity is recommended in .+ \(see Item D5\)\.$/;

function stripNextInspectionParagraph(text: string): string {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part && !NEXT_INSPECTION_PARAGRAPH.test(part))
    .join('\n\n');
}

function renderNextInspectionHighlight(pest: PestInspectionSections): string {
  const nextInspection = formatPestFutureInspectionFrequency(pest.d5FutureInspection.frequency);
  if (!nextInspection) return '';
  const sentence = `The next inspection to help detect future termite activity is recommended in ${nextInspection} (see Item D5).`;
  return `<p class="pest-next-inspection-highlight">${escapeHtml(sentence)}</p>`;
}

export function renderPestConclusionBlock(
  pest: PestInspectionSections,
  fallbackInspectorName?: string | null,
  fallbackDeclarationDate?: Date | null,
  hazardAssessment?: InspectorHazardAssessmentSection,
): string {
  const conclusion = pest.pestConclusion;
  const inspectorName = conclusion.inspectorName?.trim() || fallbackInspectorName?.trim() || '—';
  const declarationDate =
    conclusion.declarationDate?.trim() ||
    (fallbackDeclarationDate ? formatDate(fallbackDeclarationDate) : '—');
  const conclusionText = stripNextInspectionParagraph(conclusion.autoConclusion?.trim() || '');
  const recommendations = conclusion.autoRecommendations ?? [];
  const hazardLowNote = hazardAssessment ? renderInspectorHazardLowConclusionNote(hazardAssessment) : '';
  const nextInspectionHighlight = renderNextInspectionHighlight(pest);

  return `
${renderPdfLetterPartHeading('Section E — Conclusion & Certification')}
<section class="report-section conclusion-section">
  <div class="conclusion-narrative">
    <h3 class="report-section-heading">Conclusion</h3>
    ${conclusionText ? renderConclusionParagraphs(conclusionText) : '<p>—</p>'}
    ${nextInspectionHighlight}
    ${hazardLowNote}
  </div>
  <div class="recommendations-block">
    <h3 class="report-section-heading">Recommendations</h3>
    ${renderRecommendationsList(recommendations)}
  </div>
  <div class="declaration-block certification-section">
    <h3 class="report-section-heading">Certification</h3>
    ${renderCertificationIntroHtml()}
    <table class="field-table">
      <tr><th>Inspector Name</th><td>${escapeHtml(inspectorName)}</td></tr>
      <tr><th>Declaration Date</th><td>${escapeHtml(declarationDate)}</td></tr>
    </table>
    <div class="signature-block">
      <strong>Inspector Signature</strong>
      ${renderSignatureImage(conclusion.signatureData)}
    </div>
  </div>
</section>`;
}
