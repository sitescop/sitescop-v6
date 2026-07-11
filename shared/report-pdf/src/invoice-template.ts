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
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  paymentTerms?: string | null;
  paymentNotes?: string | null;
  thankYouMessage?: string | null;
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

function renderPaymentDetails(ctx: InvoicePdfContext): string {
  const hasBankDetails = Boolean(ctx.bankAccountName || ctx.bankBsb || ctx.bankAccountNumber);
  const hasTerms = Boolean(ctx.paymentTerms?.trim());
  const hasNotes = Boolean(ctx.paymentNotes?.trim());
  const hasThanks = Boolean(ctx.thankYouMessage?.trim());
  if (!hasBankDetails && !hasTerms && !hasNotes && !hasThanks) return '';

  const bankRows: string[] = [];
  if (ctx.bankAccountName) {
    bankRows.push(`<p><strong>Account name:</strong> ${escapeHtml(ctx.bankAccountName)}</p>`);
  }
  if (ctx.bankBsb) {
    bankRows.push(`<p><strong>BSB:</strong> ${escapeHtml(ctx.bankBsb)}</p>`);
  }
  if (ctx.bankAccountNumber) {
    bankRows.push(`<p><strong>Account number:</strong> ${escapeHtml(ctx.bankAccountNumber)}</p>`);
  }

  return `
<div class="invoice-payment-box">
  <h2>Payment details</h2>
  ${hasBankDetails ? `<div class="invoice-payment-stack">${bankRows.join('\n')}</div>` : ''}
  ${hasTerms ? `<p style="margin-top:12px"><strong>Payment terms:</strong> ${escapeHtml(ctx.paymentTerms!)}</p>` : ''}
  ${hasNotes ? `<div class="invoice-payment-notes"><strong>Important:</strong> ${escapeHtml(ctx.paymentNotes!)}</div>` : ''}
  ${hasThanks ? `<div class="invoice-thank-you">${escapeHtml(ctx.thankYouMessage!)}</div>` : ''}
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
  .invoice-payment-box {
    margin-top: 28px;
    padding: 16px 18px;
    border-radius: 8px;
    border: 1px solid ${ctx.primaryColor}33;
    background: linear-gradient(135deg, ${ctx.primaryColor}12, ${ctx.secondaryColor}10);
  }
  .invoice-payment-box h2 {
    margin: 0 0 10px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${ctx.primaryColor};
  }
  .invoice-payment-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .invoice-payment-stack p { margin: 0; }
  .invoice-payment-notes {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid ${ctx.primaryColor}22;
    font-size: 12px;
    line-height: 1.5;
    color: #444;
  }
  .invoice-thank-you {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid ${ctx.primaryColor}22;
    font-size: 13px;
    line-height: 1.5;
    font-style: italic;
    color: ${ctx.primaryColor};
  }
  </style>
</head>
<body class="report-body">
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
    ${renderPaymentDetails(ctx)}
  </div>
</body>
</html>`;
}
