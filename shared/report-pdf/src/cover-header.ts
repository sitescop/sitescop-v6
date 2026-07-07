import type { InspectionFormDataV2, InspectionPhotoRef } from '../../room-engine-core/src/index.js';
import { escapeHtml } from './html-utils.js';
import type { ReportRenderContext } from './types.js';

export function getPropertyFrontPhoto(formData: InspectionFormDataV2): InspectionPhotoRef | null {
  const photos = formData.shared.jobInformation.photos;
  if (!photos?.length) return null;
  return photos[0] ?? null;
}

function websiteHref(website: string): string {
  const trimmed = website.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, '')}`;
}

function renderCompanyContactDetails(ctx: ReportRenderContext): string {
  const { company } = ctx;
  const lines: string[] = [];

  if (company.abn) lines.push(`<p><strong>ABN:</strong> ${escapeHtml(company.abn)}</p>`);
  if (company.phone) lines.push(`<p><strong>Phone:</strong> ${escapeHtml(company.phone)}</p>`);
  if (company.website) {
    lines.push(
      `<p><strong>Website:</strong> <a href="${escapeHtml(websiteHref(company.website))}">${escapeHtml(company.website)}</a></p>`,
    );
  }
  if (company.email) lines.push(`<p><strong>Email:</strong> ${escapeHtml(company.email)}</p>`);
  if (company.address) lines.push(`<p><strong>Address:</strong> ${escapeHtml(company.address)}</p>`);

  if (!lines.length) return '';

  return `<div class="cover-company-contact">${lines.join('\n')}</div>`;
}

function renderCompanyDetails(ctx: ReportRenderContext): string {
  const { company, settings } = ctx;
  const parts: string[] = [];

  if (!settings.pdfIncludeLogo || !company.logoUrl) {
    parts.push(`<p class="cover-company-name">${escapeHtml(company.name)}</p>`);
  }

  parts.push(renderCompanyContactDetails(ctx));

  return parts.filter(Boolean).join('\n');
}

export function renderCoverHeader(ctx: ReportRenderContext): string {
  const { company, settings } = ctx;
  const frontPhoto = getPropertyFrontPhoto(ctx.formData);

  const logoHtml =
    settings.pdfIncludeLogo && company.logoUrl
      ? `<div class="cover-company-logo"><img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" /></div>`
      : '';

  const photoHtml = frontPhoto
    ? `<img src="${frontPhoto.dataUrl}" alt="Property front photo" />`
    : `<div class="cover-property-photo-placeholder">Property front photo not provided</div>`;

  return `
<div class="cover-header">
  <div class="cover-company">
    ${logoHtml}
    <div class="cover-company-details">
      ${settings.pdfIncludeLogo && company.logoUrl ? `<p class="cover-company-name">${escapeHtml(company.name)}</p>` : ''}
      ${renderCompanyDetails(ctx)}
    </div>
  </div>
  <div class="cover-property-photo">
    <p class="cover-property-photo-label">Property Front Photo</p>
    ${photoHtml}
  </div>
</div>`;
}
