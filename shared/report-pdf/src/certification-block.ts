import { INSPECTOR_CERTIFICATION_STATEMENT } from '../../room-engine-core/src/certification.js';
import { escapeHtml, renderFieldRows } from './html-utils.js';
import type { SectionFieldDef } from './section-fields.js';

function renderSignatureImage(dataUrl: string | undefined, label: string): string {
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
    return `<div class="signature-block"><strong>${escapeHtml(label)}</strong><img src="${dataUrl.replace(/"/g, '&quot;')}" alt="${escapeHtml(label)}" class="report-signature" /></div>`;
  }
  return `<div class="signature-block"><strong>${escapeHtml(label)}</strong><p class="signature-missing">Not signed</p></div>`;
}

export function renderCertificationIntroHtml(): string {
  return `<p class="certification-statement">${escapeHtml(INSPECTOR_CERTIFICATION_STATEMENT)}</p>`;
}

export function renderCertificationSectionBlock(
  title: string,
  data: Record<string, unknown>,
  fieldLabels?: Record<string, string>,
  fieldDefs?: SectionFieldDef[],
): string {
  const skip = new Set(['clientSignatureData', 'licenceNumber', 'reportComplete', 'sectionReviewed', 'signatureData']);
  const rows = renderFieldRows(data, skip, fieldLabels, fieldDefs);
  const signature = typeof data.signatureData === 'string' ? data.signatureData : '';
  if (!rows && !signature.trim()) return '';

  return `
<section class="report-section certification-section">
  <h3 class="report-section-heading">${escapeHtml(title)}</h3>
  ${renderCertificationIntroHtml()}
  ${rows ? `<table class="field-table">${rows}</table>` : ''}
  ${renderSignatureImage(signature, 'Inspector Signature')}
</section>`;
}
