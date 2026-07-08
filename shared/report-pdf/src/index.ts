import { SITESCOP_PDF_FOOTER_TEXT } from '../../company-branding.js';
import { renderBuildingReportHtml } from './building-template.js';
import { htmlToPdfBuffer } from './generate-pdf.js';
import { renderPestReportHtml } from './pest-template.js';
import { renderAgreementHtml } from './agreement-template.js';
import { renderInvoiceHtml } from './invoice-template.js';
import type { ReportRenderContext } from './types.js';
import type { AgreementPdfContext } from './agreement-template.js';
import type { InvoicePdfContext } from './invoice-template.js';

export { closePdfBrowser } from './generate-pdf.js';
export { reportFileNameStem, formatReportInspectionNumber } from './report-identifiers.js';
export type { PdfRenderOptions } from './pdf-layout.js';
export type { ReportRenderContext, LegalReportKind, ReportPdfType } from './types.js';
export type { AgreementPdfContext } from './agreement-template.js';
export type { InvoicePdfContext } from './invoice-template.js';
export { renderBuildingReportHtml } from './building-template.js';
export { renderPestReportHtml } from './pest-template.js';
export { renderAgreementHtml } from './agreement-template.js';
export { renderInvoiceHtml } from './invoice-template.js';
export {
  resolveBuildingReportTitle,
  resolveInspectionTypeLabel,
  resolvePestReportTitle,
  BUILDING_INSPECTION_TYPE_LABEL,
  PEST_INSPECTION_TYPE_LABEL,
} from './property-report-details-block.js';

function resolveFooterText(value: string | null | undefined): string {
  return value?.trim() || SITESCOP_PDF_FOOTER_TEXT;
}

export async function generateBuildingReportPdf(ctx: ReportRenderContext): Promise<Buffer> {
  const html = renderBuildingReportHtml({ ...ctx, reportType: 'BUILDING' });
  return htmlToPdfBuffer(html, { footerText: resolveFooterText(ctx.settings.pdfFooterText) });
}

export async function generatePestReportPdf(ctx: ReportRenderContext): Promise<Buffer> {
  const html = renderPestReportHtml({ ...ctx, reportType: 'PEST' });
  return htmlToPdfBuffer(html, { footerText: resolveFooterText(ctx.settings.pdfFooterText) });
}

export async function generateAgreementPdf(ctx: AgreementPdfContext): Promise<Buffer> {
  const html = renderAgreementHtml(ctx);
  return htmlToPdfBuffer(html, { footerText: resolveFooterText(ctx.footerText) });
}

export async function generateInvoicePdf(ctx: InvoicePdfContext): Promise<Buffer> {
  const html = renderInvoiceHtml(ctx);
  return htmlToPdfBuffer(html, { footerText: resolveFooterText(ctx.footerText) });
}
