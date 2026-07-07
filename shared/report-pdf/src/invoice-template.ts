import { escapeHtml, formatDate } from './html-utils.js';
import { reportPrintStyles } from './styles.js';

export interface InvoicePdfContext {
  company: {
    name: string;
    abn?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  };
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  clientName: string;
  clientEmail: string;
  propertyAddress?: string | null;
  description: string;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  paidAt?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  statusLabel: string;
  footerText: string;
  primaryColor: string;
  secondaryColor: string;
  pdfIncludeLogo: boolean;
}

function formatAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function renderCompanyHeader(ctx: InvoicePdfContext): string {
  const { company, pdfIncludeLogo } = ctx;
  const logoHtml =
    pdfIncludeLogo && company.logoUrl
      ? `<div class="cover-company-logo"><img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" /></div>`
      : '';
  const contact: string[] = [];
  if (company.abn) contact.push(`<p><strong>ABN:</strong> ${escapeHtml(company.abn)}</p>`);
  if (company.phone) contact.push(`<p><strong>Phone:</strong> ${escapeHtml(company.phone)}</p>`);
  if (company.email) contact.push(`<p><strong>Email:</strong> ${escapeHtml(company.email)}</p>`);

  return `
<div class="cover-header">
  <div class="cover-company">
    ${logoHtml}
    <div class="cover-company-details">
      <p class="cover-company-name">${escapeHtml(company.name)}</p>
      ${contact.join('\n')}
    </div>
  </div>
</div>`;
}

export function renderInvoiceHtml(ctx: InvoicePdfContext): string {
  const styles = reportPrintStyles(ctx.primaryColor, ctx.secondaryColor);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(ctx.invoiceNumber)}</title>
  <style>${styles}
  .invoice-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .invoice-table th { background: #f5f5f5; }
  .invoice-totals { margin-top: 16px; max-width: 320px; margin-left: auto; }
  .invoice-totals table { width: 100%; }
  .invoice-totals td { padding: 4px 0; }
  .invoice-totals td:last-child { text-align: right; }
  .cover-meta { margin-top: 20px; }
  </style>
</head>
<body>
  <div class="cover-page">
    ${renderCompanyHeader(ctx)}
    <h1 class="cover-title">Tax Invoice</h1>
    <p class="cover-subtitle">${escapeHtml(ctx.invoiceNumber)}</p>
    <div class="cover-meta">
      <p><strong>Status:</strong> ${escapeHtml(ctx.statusLabel)}</p>
      <p><strong>Issue date:</strong> ${escapeHtml(formatDate(new Date(ctx.issueDate)))}</p>
      ${ctx.dueDate ? `<p><strong>Due date:</strong> ${escapeHtml(formatDate(new Date(ctx.dueDate)))}</p>` : ''}
      <p><strong>Bill to:</strong> ${escapeHtml(ctx.clientName)}</p>
      <p>${escapeHtml(ctx.clientEmail)}</p>
      ${ctx.propertyAddress ? `<p><strong>Property:</strong> ${escapeHtml(ctx.propertyAddress)}</p>` : ''}
    </div>
    <table class="invoice-table">
      <thead><tr><th>Description</th><th>Amount (ex GST)</th></tr></thead>
      <tbody>
        <tr><td>${escapeHtml(ctx.description)}</td><td>${formatAud(ctx.subtotalCents)}</td></tr>
      </tbody>
    </table>
    <div class="invoice-totals">
      <table>
        <tr><td>Subtotal</td><td>${formatAud(ctx.subtotalCents)}</td></tr>
        <tr><td>GST</td><td>${formatAud(ctx.gstCents)}</td></tr>
        <tr><td><strong>Total (inc GST)</strong></td><td><strong>${formatAud(ctx.totalCents)}</strong></td></tr>
      </table>
    </div>
    ${
      ctx.paidAt
        ? `<div class="cover-meta" style="margin-top:24px">
      <p><strong>Paid:</strong> ${escapeHtml(formatDate(new Date(ctx.paidAt)))}</p>
      ${ctx.paymentMethod ? `<p><strong>Method:</strong> ${escapeHtml(ctx.paymentMethod)}</p>` : ''}
      ${ctx.paymentReference ? `<p><strong>Reference:</strong> ${escapeHtml(ctx.paymentReference)}</p>` : ''}
    </div>`
        : ''
    }
  </div>
  <footer class="report-footer">${escapeHtml(ctx.footerText)}</footer>
</body>
</html>`;
}
