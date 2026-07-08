import { escapeHtml } from './html-utils.js';

/** Clean part heading for PDF (table-safe, no flex). */
export function renderPdfPartHeading(title: string): string {
  const match = title.match(/^(\d+)\.\s*(.+)$/);
  if (match) {
    return `<h2 class="report-part-heading"><span class="report-part-num">${escapeHtml(match[1])}</span>${escapeHtml(match[2])}</h2>`;
  }
  return `<h2 class="report-part-heading">${escapeHtml(title)}</h2>`;
}

export function renderPdfLetterPartHeading(title: string): string {
  return `<h2 class="report-part-heading report-part-heading-letter">${escapeHtml(title)}</h2>`;
}
