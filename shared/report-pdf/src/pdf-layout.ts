/** A4 printable layout — keep in sync with @page rules in styles.ts and generate-pdf.ts */
export const PDF_PAGE_SIZE_MM = 297;
export const PDF_PAGE_WIDTH_MM = 210;

export const PDF_MARGIN_TOP = '18mm';
export const PDF_MARGIN_RIGHT = '15mm';
export const PDF_MARGIN_BOTTOM = '28mm';
export const PDF_MARGIN_LEFT = '15mm';

/** Bottom margin band reserved exclusively for the repeating PDF footer. */
export const PDF_FOOTER_BAND_MM = 12;

export const PDF_PAGE_MARGINS = {
  top: PDF_MARGIN_TOP,
  right: PDF_MARGIN_RIGHT,
  bottom: PDF_MARGIN_BOTTOM,
  left: PDF_MARGIN_LEFT,
} as const;

/** Printable content height on A4 after top/bottom margins (footer sits in bottom margin). */
export const PDF_CONTENT_HEIGHT_MM =
  PDF_PAGE_SIZE_MM -
  parseFloat(PDF_MARGIN_TOP) -
  parseFloat(PDF_MARGIN_BOTTOM);

export function escapePdfTemplateText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPdfFooterTemplate(footerText: string): string {
  const safe = escapePdfTemplateText(footerText.trim());
  return `<div style="box-sizing:border-box;width:100%;height:${PDF_FOOTER_BAND_MM}mm;font-size:8px;line-height:1.35;color:#666;text-align:center;border-top:1px solid #ddd;padding-top:1mm;margin:0;"><span>${safe}</span></div>`;
}

export interface PdfRenderOptions {
  footerText?: string | null;
}
