import { renderBuildingReportHtml } from './building-template.js';
import { htmlToPdfBuffer } from './generate-pdf.js';
import { renderPestReportHtml } from './pest-template.js';
import { renderAgreementHtml } from './agreement-template.js';
import { renderInvoiceHtml } from './invoice-template.js';
import type { ReportRenderContext } from './types.js';
import type { AgreementPdfContext } from './agreement-template.js';
import type { InvoicePdfContext } from './invoice-template.js';

export { closePdfBrowser } from './generate-pdf.js';
export type { ReportRenderContext, LegalReportKind } from './types.js';
export type { AgreementPdfContext } from './agreement-template.js';
export type { InvoicePdfContext } from './invoice-template.js';
export { renderBuildingReportHtml } from './building-template.js';
export { renderPestReportHtml } from './pest-template.js';
export { renderAgreementHtml } from './agreement-template.js';
export { renderInvoiceHtml } from './invoice-template.js';

export async function generateBuildingReportPdf(ctx: ReportRenderContext): Promise<Buffer> {
  const html = renderBuildingReportHtml(ctx);
  return htmlToPdfBuffer(html);
}

export async function generatePestReportPdf(ctx: ReportRenderContext): Promise<Buffer> {
  const html = renderPestReportHtml(ctx);
  return htmlToPdfBuffer(html);
}

export async function generateAgreementPdf(ctx: AgreementPdfContext): Promise<Buffer> {
  const html = renderAgreementHtml(ctx);
  return htmlToPdfBuffer(html);
}

export async function generateInvoicePdf(ctx: InvoicePdfContext): Promise<Buffer> {
  const html = renderInvoiceHtml(ctx);
  return htmlToPdfBuffer(html);
}
