import { escapeHtml, formatDate } from './html-utils.js';
import { reportPrintStyles } from './styles.js';

export interface AgreementPdfContext {
  company: {
    name: string;
    abn?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  };
  agreementNumber: string;
  agreementDate: string;
  typeLabel: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  propertyAddress: string;
  priceCents: number;
  gstCents: number;
  totalCents: number;
  legalSections: Array<{ title: string; content: string }>;
  signatureName?: string | null;
  signatureData?: string | null;
  signedAt?: string | null;
  notes?: string | null;
  footerText: string;
  primaryColor: string;
  secondaryColor: string;
  pdfIncludeLogo: boolean;
}

function formatAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function renderCompanyHeader(ctx: AgreementPdfContext): string {
  const { company, pdfIncludeLogo } = ctx;
  const logoHtml =
    pdfIncludeLogo && company.logoUrl
      ? `<div class="cover-company-logo"><img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" /></div>`
      : '';
  const contact: string[] = [];
  if (company.abn) contact.push(`<p><strong>ABN:</strong> ${escapeHtml(company.abn)}</p>`);
  if (company.phone) contact.push(`<p><strong>Phone:</strong> ${escapeHtml(company.phone)}</p>`);
  if (company.email) contact.push(`<p><strong>Email:</strong> ${escapeHtml(company.email)}</p>`);
  if (company.website) contact.push(`<p><strong>Website:</strong> ${escapeHtml(company.website)}</p>`);

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

function renderLegalSections(sections: AgreementPdfContext['legalSections']): string {
  return sections
    .map(
      (section) => `
<section class="report-section">
  <h2>${escapeHtml(section.title)}</h2>
  <div class="legal-content">${section.content.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>
</section>`,
    )
    .join('');
}

function renderSignatureBlock(ctx: AgreementPdfContext): string {
  if (!ctx.signatureName || !ctx.signatureData) {
    return `
<section class="report-section">
  <h2>Client Signature</h2>
  <p>Unsigned — awaiting client signature.</p>
</section>`;
  }

  return `
<section class="report-section">
  <h2>Client Signature</h2>
  <p><strong>Signed by:</strong> ${escapeHtml(ctx.signatureName)}</p>
  ${ctx.signedAt ? `<p><strong>Date:</strong> ${escapeHtml(formatDate(new Date(ctx.signedAt)))}</p>` : ''}
  <div class="signature-image">
    <img src="${ctx.signatureData}" alt="Client signature" />
  </div>
</section>`;
}

export function renderAgreementHtml(ctx: AgreementPdfContext): string {
  const styles = reportPrintStyles(ctx.primaryColor, ctx.secondaryColor);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Agreement ${escapeHtml(ctx.agreementNumber)}</title>
  <style>${styles}
  .pricing-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .pricing-table th, .pricing-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .pricing-table th { background: #f5f5f5; }
  .signature-image img { max-width: 280px; max-height: 120px; border: 1px solid #ccc; }
  .legal-content p { margin: 0 0 8px; }
  .cover-meta { margin-top: 20px; }
  </style>
</head>
<body>
  <div class="cover-page">
    ${renderCompanyHeader(ctx)}
    <h1 class="cover-title">Inspection Agreement</h1>
    <p class="cover-subtitle">${escapeHtml(ctx.agreementNumber)}</p>
    <div class="cover-meta">
      <p><strong>Service:</strong> ${escapeHtml(ctx.typeLabel)}</p>
      <p><strong>Client:</strong> ${escapeHtml(ctx.clientName)}</p>
      <p><strong>Property:</strong> ${escapeHtml(ctx.propertyAddress)}</p>
      <p><strong>Agreement date:</strong> ${escapeHtml(formatDate(new Date(ctx.agreementDate)))}</p>
    </div>
    <table class="pricing-table">
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>${escapeHtml(ctx.typeLabel)} (ex GST)</td><td>${formatAud(ctx.priceCents)}</td></tr>
        <tr><td>GST</td><td>${formatAud(ctx.gstCents)}</td></tr>
        <tr><td><strong>Total (inc GST)</strong></td><td><strong>${formatAud(ctx.totalCents)}</strong></td></tr>
      </tbody>
    </table>
    ${ctx.notes ? `<p class="cover-notes"><strong>Notes:</strong> ${escapeHtml(ctx.notes)}</p>` : ''}
  </div>
  ${renderLegalSections(ctx.legalSections)}
  ${renderSignatureBlock(ctx)}
  <footer class="report-footer">${escapeHtml(ctx.footerText)}</footer>
</body>
</html>`;
}
