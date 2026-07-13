import type { InspectionFormDataV2, InspectionPhotoRef } from '../../room-engine-core/src/index.js';
import { escapeHtml, formatDate } from './html-utils.js';
import { formatReportInspectionNumber } from './report-identifiers.js';
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

function renderCompanyBar(ctx: ReportRenderContext): string {
  const { company, settings } = ctx;
  const logoHtml =
    settings.pdfIncludeLogo && company.logoUrl
      ? `<td class="cover-logo-cell"><img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" class="cover-logo-img" /></td>`
      : '';

  const contact: string[] = [];
  if (company.abn) contact.push(`ABN ${escapeHtml(company.abn)}`);
  if (company.phone) contact.push(escapeHtml(company.phone));
  if (company.email) contact.push(escapeHtml(company.email));
  if (company.website) {
    contact.push(
      `<a href="${escapeHtml(websiteHref(company.website))}">${escapeHtml(company.website)}</a>`,
    );
  }

  return `
  <table class="cover-company-bar" cellpadding="0" cellspacing="0">
    <tr>
      ${logoHtml}
      <td class="cover-company-text">
        <p class="cover-company-name">${escapeHtml(company.name)}</p>
        ${contact.length ? `<p class="cover-company-contact">${contact.join(' &nbsp;|&nbsp; ')}</p>` : ''}
      </td>
    </tr>
  </table>`;
}

function renderReferenceTable(ctx: ReportRenderContext): string {
  const inspectionNo = formatReportInspectionNumber(
    ctx.inspection.inspectionNumber,
    ctx.reportType,
    ctx.job.jobType,
  );
  const agreement = ctx.agreementNumber?.trim();
  const agreementCell = agreement
    ? escapeHtml(agreement)
    : '<span class="cover-ref-na">Not linked</span>';

  return `
  <table class="cover-ref-table" cellpadding="0" cellspacing="0">
    <tr>
      <th>Agreement No.</th>
      <td>${agreementCell}</td>
      <th>Inspection No.</th>
      <td>${escapeHtml(inspectionNo)}</td>
    </tr>
  </table>`;
}

function renderDetailsTable(ctx: ReportRenderContext): string {
  const inspectionDate = formatDate(ctx.inspection.completedAt ?? ctx.inspection.startedAt);
  return `
  <table class="cover-details-table" cellpadding="0" cellspacing="0">
    <tr>
      <th>Property</th>
      <td colspan="3">${escapeHtml(ctx.job.propertyAddress)}</td>
    </tr>
    <tr>
      <th>Client</th>
      <td>${escapeHtml(ctx.job.clientName)}</td>
      <th>Inspector</th>
      <td>${escapeHtml(ctx.inspector?.name ?? '—')}</td>
    </tr>
    <tr>
      <th>Inspection date</th>
      <td colspan="3">${escapeHtml(inspectionDate)}</td>
    </tr>
  </table>`;
}

function renderPropertyPhoto(ctx: ReportRenderContext): string {
  const frontPhoto = getPropertyFrontPhoto(ctx.formData);
  const rawCaption = frontPhoto?.caption?.trim() || '';
  const caption =
    rawCaption && !/\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i.test(rawCaption) &&
    !/^(screenshot|screen shot|img[_-]?|image[_-]?|photo[_-]?|dsc[_-]?|pxl[_-]?)/i.test(rawCaption)
      ? rawCaption
      : '';
  const img = frontPhoto
    ? `<img src="${frontPhoto.dataUrl}" alt="${escapeHtml(caption || 'Property front photo')}" class="cover-photo-img" />`
    : `<div class="cover-photo-placeholder">Property front photo not provided</div>`;

  const captionHtml = caption
    ? `<p class="cover-photo-caption">${escapeHtml(caption)}</p>`
    : '';

  return `
  <div class="cover-photo-block">
    <p class="cover-photo-label">Property Front Photo</p>
    ${img}
    ${captionHtml}
  </div>`;
}

/** Single-page cover: company bar, title, reference numbers, details, and front photo. */
export function renderCoverPage(
  ctx: ReportRenderContext,
  reportTitle: string,
  subtitle: string,
): string {
  const headerNote = ctx.settings.reportHeader?.trim()
    ? `<p class="cover-header-note">${escapeHtml(ctx.settings.reportHeader)}</p>`
    : '';

  return `
<div class="cover-page">
  ${renderCompanyBar(ctx)}
  <div class="cover-accent-line"></div>
  <table class="cover-main-table" cellpadding="0" cellspacing="0">
    <tr>
      <td class="cover-main-left">
        <h1 class="cover-title">${escapeHtml(reportTitle)}</h1>
        <p class="cover-subtitle">${escapeHtml(subtitle)}</p>
        ${headerNote}
        ${renderReferenceTable(ctx)}
        ${renderDetailsTable(ctx)}
      </td>
      <td class="cover-main-right">
        ${renderPropertyPhoto(ctx)}
      </td>
    </tr>
  </table>
</div>`;
}
