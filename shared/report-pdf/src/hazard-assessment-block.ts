import {
  INSPECTOR_HAZARD_LOW_CONCLUSION_TEXT,
  isLowInspectorHazardLevel,
  type InspectorHazardAssessmentSection,
} from '../../room-engine-core/src/index.js';
import { escapeHtml, renderComments, renderPhotos } from './html-utils.js';
import type { InspectionPhotoRef } from '../../room-engine-core/src/index.js';

export function renderInspectorHazardLowConclusionNote(
  section: InspectorHazardAssessmentSection,
): string {
  if (!isLowInspectorHazardLevel(section)) {
    return '';
  }

  return `<p class="hazard-conclusion-note">${escapeHtml(INSPECTOR_HAZARD_LOW_CONCLUSION_TEXT)}</p>`;
}

export function renderInspectorHazardAssessmentBlock(
  section: InspectorHazardAssessmentSection,
): string {
  if (isLowInspectorHazardLevel(section)) {
    return '';
  }

  const hazards = [...section.hazards.selected, ...section.hazards.custom].filter(Boolean);
  const level = section.overallLevel?.trim() || 'Low';

  const hazardList = hazards.length
    ? `<ul class="report-list">${hazards.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>None identified</p>';

  const summary = section.autoSummary?.trim()
    ? section.autoSummary
        .split(/\n\n+/)
        .filter(Boolean)
        .map((part) => `<p>${escapeHtml(part.trim())}</p>`)
        .join('\n')
    : '<p>—</p>';

  return `
<section class="report-section hazard-assessment-section">
  <h2>Inspector Hazard Assessment — At Door Before Entry</h2>
  <table class="field-table">
    <tr><th>Overall Hazard Level</th><td>${escapeHtml(level)}</td></tr>
    <tr><th>Inspection Outcome</th><td>${escapeHtml(section.inspectionOutcome || '—')}</td></tr>
    <tr><th>Client Advised</th><td>${escapeHtml(section.clientAdvised || '—')}</td></tr>
    <tr><th>Rebooking Required</th><td>${escapeHtml(section.rebookingRequired || '—')}</td></tr>
  </table>
  <div class="hazard-list-block">
    <strong>Hazards Identified</strong>
    ${hazardList}
  </div>
  <div class="hazard-summary-block">
    <strong>Assessment Summary</strong>
    ${summary}
  </div>
  ${renderComments(section.comments)}
  ${renderPhotos(section.photos as InspectionPhotoRef[])}
</section>`;
}
