import { escapeHtml } from './html-utils.js';

/** First top-level section (or entire content) kept with the part heading on the same page. */
function splitFirstTopLevelBlock(html: string): { lead: string; rest: string } {
  const trimmed = html.trim();
  if (!trimmed) return { lead: '', rest: '' };

  const match = trimmed.match(/^<section\b[\s\S]*?<\/section>/i);
  if (match) {
    const lead = match[0];
    return { lead, rest: trimmed.slice(lead.length).trim() };
  }

  return { lead: trimmed, rest: '' };
}

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

export interface PdfPartBlockOptions {
  /** Inserts an explicit page break before this part (required for Chromium/Puppeteer). */
  startNewPage?: boolean;
  /** Inserts an explicit page break after this part. */
  endWithPageBreak?: boolean;
}

/** Wraps a major report part; heading + first section stay together when space is tight. */
export function renderPdfPartBlock(
  headingHtml: string,
  contentHtml: string,
  options: PdfPartBlockOptions = {},
): string {
  const content = contentHtml.trim();
  if (!content) return headingHtml;

  const { lead, rest } = splitFirstTopLevelBlock(content);
  const tail = rest
    ? `<div class="report-part-content">${rest}</div>`
    : '';
  const partClass = options.endWithPageBreak
    ? 'report-part-block report-part-block--page-after'
    : 'report-part-block';

  const leadInner = `${headingHtml}\n${lead}`;
  const leadHtml = options.startNewPage
    ? `<table class="report-part-lead-table report-part-lead-table--new-page" style="width:100%;border-collapse:collapse;break-before:page;page-break-before:always;"><tr><td style="border:none;padding:0;">${leadInner}</td></tr></table>`
    : `<div class="report-part-lead">${leadInner}</div>`;

  return `<div class="${partClass}">
  ${leadHtml}
  ${tail}
</div>`;
}

export function renderPdfLetterPartBlock(
  title: string,
  contentHtml: string,
  options: PdfPartBlockOptions = {},
): string {
  return renderPdfPartBlock(renderPdfLetterPartHeading(title), contentHtml, options);
}

export function renderPdfNumberedPartBlock(
  title: string,
  contentHtml: string,
  options: PdfPartBlockOptions = {},
): string {
  return renderPdfPartBlock(renderPdfPartHeading(title), contentHtml, options);
}
