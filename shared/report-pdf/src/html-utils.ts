import type { CheckboxFieldState, InspectionPhotoRef } from '../../room-engine-core/src/index.js';
import { formatPestEvidenceAnswer, isNoMajorDefectObserved, normalizeCheckboxField } from '../../room-engine-core/src/index.js';
import type { SectionFieldDef } from './section-fields.js';

const SKIP_KEYS = new Set(['photos', 'comments', 'noMajorDefectObserved']);

const EXTRA_PHOTO_KEYS = [
  'interiorObstructionPhotos',
  'exteriorObstructionPhotos',
  'roofSpaceObstructionPhotos',
  'subfloorObstructionPhotos',
  'waterPoolingPhotos',
  'moistureMeterPhotos',
  'thermalImages',
  'waterEscapingPhotos',
  'moistureEvidencePhotos',
  'incompleteConstructionPhotos',
  'waterSupplyPhotos',
  'sewerPhotos',
  'electricityPhotos',
  'gasPhotos',
  'hotWaterPhotos',
  'airConPhotos',
  'gasBottlePhotos',
  'rainwaterTankPhotos',
  'plumbingDefectPhotos',
  'deformationPhotos',
  'moistureSourcePhotos',
  'safetyHazardPhotos',
] as const;

/** Render these photo fields immediately after the named field row (matches inspection form order). */
const INLINE_PHOTO_AFTER_FIELD: Partial<Record<string, (typeof EXTRA_PHOTO_KEYS)[number]>> = {
  interiorObstructions: 'interiorObstructionPhotos',
  exteriorObstructions: 'exteriorObstructionPhotos',
  roofSpaceObstructions: 'roofSpaceObstructionPhotos',
  subfloorObstructions: 'subfloorObstructionPhotos',
  deformationEngineeringRequired: 'deformationPhotos',
  moistureSources: 'moistureSourcePhotos',
  safetyHazards: 'safetyHazardPhotos',
  waterSupplyOther: 'waterSupplyPhotos',
  sewer: 'sewerPhotos',
  electricity: 'electricityPhotos',
  gas: 'gasPhotos',
  hotWaterOperating: 'hotWaterPhotos',
  airConOperating: 'airConPhotos',
  rainwaterTankPresent: 'rainwaterTankPhotos',
  incompleteConstruction: 'incompleteConstructionPhotos',
  evidenceOfWaterPooling: 'waterPoolingPhotos',
  excessiveMoistureEvidence: 'moistureEvidencePhotos',
};

const SIGNATURE_KEYS = new Set(['signatureData', 'clientSignatureData']);

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLabel(key: string, overrides?: Record<string, string>): string {
  if (overrides?.[key]) return overrides[key]!;
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function renderCheckboxState(state: CheckboxFieldState | undefined): string {
  if (!state) return '—';
  const items = [...(state.selected ?? []), ...(state.custom ?? [])].filter(Boolean);
  return items.length ? items.join(', ') : '—';
}

function renderFinishElementDamageEntries(entries: unknown): string {
  if (!Array.isArray(entries) || entries.length === 0) return '—';
  const rows = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const row = entry as Record<string, unknown>;
      const elements =
        row.elements && typeof row.elements === 'object'
          ? renderCheckboxState(normalizeCheckboxField(row.elements as CheckboxFieldState))
          : typeof row.element === 'string'
            ? row.element
            : '';
      const parts = [
        elements && elements !== '—' && `Damage to: ${elements}`,
        row.location && `Location: ${row.location}`,
        row.comments && `Comments: ${row.comments}`,
      ].filter(Boolean);
      const photos = Array.isArray(row.photos) ? (row.photos as InspectionPhotoRef[]) : [];
      const photoHtml = photos.length ? renderPhotos(photos, 'Damage photos') : '';
      return parts.length ? `<li>${escapeHtml(parts.join(' · '))}${photoHtml}</li>` : '';
    })
    .filter(Boolean)
    .join('');
  return rows ? `<ul class="report-list">${rows}</ul>` : '—';
}

function renderCrackingEntries(entries: unknown): string {
  if (!Array.isArray(entries) || entries.length === 0) return '—';
  const rows = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const row = entry as Record<string, unknown>;
      const parts = [
        row.location && `Location: ${row.location}`,
        row.crackWidth && `Crack Width: ${row.crackWidth}`,
        row.monitoringRecommended && `Monitoring: ${row.monitoringRecommended}`,
        row.engineeringRequired && `Engineering: ${row.engineeringRequired}`,
        row.comments && `Comments: ${row.comments}`,
      ].filter(Boolean);
      return parts.length ? `<li>${escapeHtml(parts.join(' · '))}</li>` : '';
    })
    .filter(Boolean)
    .join('');
  return rows ? `<ul class="report-list">${rows}</ul>` : '—';
}

function renderCrackingEntryPhotoRows(entries: unknown): string {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const rows: string[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const photos = Array.isArray(row.photos) ? (row.photos as InspectionPhotoRef[]) : [];
    if (!photos.length) continue;
    const location = typeof row.location === 'string' ? row.location.trim() : '';
    const label =
      entries.length > 1
        ? location
          ? `Cracking photos — ${location}`
          : `Cracking photos (${index + 1})`
        : 'Cracking photos';
    const photoHtml = renderPhotos(photos, label);
    if (photoHtml) {
      rows.push(`<tr class="field-photo-row"><td colspan="2">${photoHtml}</td></tr>`);
    }
  }
  return rows.join('\n');
}

function renderStringList(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return '—';
  const filtered = items.filter((item) => typeof item === 'string' && item.trim());
  if (!filtered.length) return '—';
  return `<ul class="report-list">${filtered.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderValue(key: string, value: unknown): string {
  if (SIGNATURE_KEYS.has(key)) {
    const dataUrl = typeof value === 'string' ? value : '';
    if (dataUrl.startsWith('data:image')) {
      return `<img src="${dataUrl.replace(/"/g, '&quot;')}" alt="Signature" class="report-signature" style="max-height:80px;max-width:240px;" />`;
    }
    return '—';
  }
  if (key === 'crackingEntries') return renderCrackingEntries(value);
  if (key === 'finishElementDamageEntries') return renderFinishElementDamageEntries(value);
  if (key === 'autoRecommendations' || key === 'manualRecommendations') return renderStringList(value);
  if (key === 'inaccessibleCustomLines') {
    if (!Array.isArray(value)) return '—';
    const lines = value.filter((line) => typeof line === 'string' && line.trim());
    return lines.length ? escapeHtml(lines.join('; ')) : '—';
  }
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return escapeHtml(String(value));
  if (typeof value === 'string') {
    if (
      key === 'evidenceAnswer' ||
      key === 'summaryAnswer' ||
      key === 'answer' ||
      key === 'summaryDuringInspection' ||
      key === 'otherEvidenceAnswer'
    ) {
      return escapeHtml(formatPestEvidenceAnswer(value) || value);
    }
    return escapeHtml(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.every((item) => typeof item === 'string')) return escapeHtml(value.join(', '));
    return '—';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('selected' in obj || 'custom' in obj) {
      return escapeHtml(renderCheckboxState(normalizeCheckboxField(obj as unknown as CheckboxFieldState)));
    }
    return '—';
  }
  return escapeHtml(String(value));
}

export function renderFieldRows(
  data: Record<string, unknown>,
  extraSkip = new Set<string>(),
  fieldLabels?: Record<string, string>,
  fieldDefs?: SectionFieldDef[],
  inlinedPhotoKeys = new Set<string>(),
): string {
  const labelByKey = new Map(fieldDefs?.map((def) => [def.key, def.label]));
  const defs =
    fieldDefs ??
    Object.keys(data)
      .filter((key) => !SKIP_KEYS.has(key) && !extraSkip.has(key))
      .map((key) => ({ key, label: formatLabel(key, fieldLabels) }));

  const groups: string[] = [];
  for (const def of defs) {
    if (SKIP_KEYS.has(def.key) || extraSkip.has(def.key) || EXTRA_PHOTO_KEYS.includes(def.key as (typeof EXTRA_PHOTO_KEYS)[number])) {
      continue;
    }
    const groupRows: string[] = [
      `<tr><th>${escapeHtml(def.label)}</th><td>${renderValue(def.key, data[def.key])}</td></tr>`,
    ];
    let hasInlinePhotos = false;

    if (def.key === 'crackingEntries') {
      const crackingPhotoRows = renderCrackingEntryPhotoRows(data[def.key]);
      if (crackingPhotoRows) {
        hasInlinePhotos = true;
        groupRows.push(crackingPhotoRows);
      }
    }

    const inlinePhotoKey = INLINE_PHOTO_AFTER_FIELD[def.key];
    if (inlinePhotoKey && !inlinedPhotoKeys.has(inlinePhotoKey)) {
      const inlinePhotos = data[inlinePhotoKey];
      if (Array.isArray(inlinePhotos) && inlinePhotos.length > 0) {
        inlinedPhotoKeys.add(inlinePhotoKey);
        const photoRows = renderInlineFieldPhotoTableRows(
          inlinePhotos as InspectionPhotoRef[],
          labelByKey.get(inlinePhotoKey),
        );
        if (photoRows.length) {
          hasInlinePhotos = true;
          groupRows.push(...photoRows);
        }
      }
    }

    const groupClass = hasInlinePhotos ? 'field-row-group field-row-group--with-photos' : 'field-row-group';
    groups.push(`<tbody class="${groupClass}">${groupRows.join('\n')}</tbody>`);
  }
  return groups.join('\n');
}

export function renderComments(comments: string | undefined): string {
  if (!comments?.trim()) return '';
  return `<div class="comments"><strong>Comments</strong><p>${escapeHtml(comments)}</p></div>`;
}

/** Groups comments and splittable photo rows for a section supplement area. */
export function renderSupplementBlock(...parts: Array<string | undefined>): string {
  const content = parts.filter(Boolean).join('\n').trim();
  if (!content) return '';
  return `<div class="report-supplement-block">${content}</div>`;
}

function looksLikePhotoFileName(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i.test(text)) return true;
  if (/^(screenshot|screen shot|img[_-]?|image[_-]?|photo[_-]?|dsc[_-]?|pxl[_-]?)/i.test(text)) {
    return true;
  }
  return false;
}

function resolvePhotoCaption(
  photo: InspectionPhotoRef,
  photoNumber: number,
  photosLength: number,
  label?: string,
): string {
  const raw = photo.caption?.trim() || '';
  if (raw && !looksLikePhotoFileName(raw)) return raw;
  if (photosLength > 1) return `Photo ${photoNumber}`;
  return label?.trim() || 'Inspection photo';
}

function renderPhotoFigure(
  photo: InspectionPhotoRef,
  photoNumber: number,
  photosLength: number,
  label?: string,
): string {
  const captionText = resolvePhotoCaption(photo, photoNumber, photosLength, label);
  return `<figure class="photo">
        <img src="${photo.dataUrl}" alt="${escapeHtml(captionText)}" />
        <figcaption class="photo-caption">${escapeHtml(captionText)}</figcaption>
      </figure>`;
}

function renderPhotoGridRowHtml(
  photos: InspectionPhotoRef[],
  pairStartIndex: number,
  label?: string,
): string {
  const pair = photos.slice(pairStartIndex, pairStartIndex + 2);
  const cells = pair
    .map((photo, pairIndex) =>
      renderPhotoFigure(photo, pairStartIndex + pairIndex + 1, photos.length, label),
    )
    .join('\n');
  return `<div class="photo-grid-row">${cells}</div>`;
}

/** One table row per photo pair; lead row stays with the field label, later rows may break across pages. */
function renderInlineFieldPhotoTableRows(
  photos: InspectionPhotoRef[],
  label?: string,
): string[] {
  if (!photos.length) return [];
  const labelHtml = label ? `<strong class="photo-group-label">${escapeHtml(label)}</strong>` : '';
  const rows = [
    `<tr class="field-photo-row field-photo-row--lead"><td colspan="2"><div class="photo-group photo-group--lead">${labelHtml}${renderPhotoGridRowHtml(photos, 0, label)}</div></td></tr>`,
  ];
  for (let index = 2; index < photos.length; index += 2) {
    rows.push(
      `<tr class="field-photo-row field-photo-row--cont"><td colspan="2"><div class="photo-group photo-group--cont">${renderPhotoGridRowHtml(photos, index, label)}</div></td></tr>`,
    );
  }
  return rows;
}

/** Label + first photo row stay together; later rows may continue on the following page. */
export function renderPhotos(photos: InspectionPhotoRef[] | undefined, label?: string): string {
  if (!photos?.length) return '';
  const labelHtml = label ? `<strong class="photo-group-label">${escapeHtml(label)}</strong>` : '';
  const parts = [
    `<div class="photo-group photo-group--lead">${labelHtml}${renderPhotoGridRowHtml(photos, 0, label)}</div>`,
  ];
  for (let index = 2; index < photos.length; index += 2) {
    parts.push(
      `<div class="photo-group photo-group--cont">${renderPhotoGridRowHtml(photos, index, label)}</div>`,
    );
  }
  return parts.join('\n');
}

function renderExtraPhotoFields(
  data: Record<string, unknown>,
  fieldDefs?: SectionFieldDef[],
  skipKeys = new Set<string>(),
): string {
  const labelByKey = new Map(fieldDefs?.map((def) => [def.key, def.label]));
  const parts: string[] = [];
  for (const key of EXTRA_PHOTO_KEYS) {
    if (skipKeys.has(key)) continue;
    const photos = data[key];
    if (!Array.isArray(photos) || photos.length === 0) continue;
    parts.push(renderPhotos(photos as InspectionPhotoRef[], labelByKey.get(key) ?? formatLabel(key)));
  }
  return parts.join('\n');
}

/** Keeps a section heading on the same page as the content that follows it. */
export function renderSectionHeading(title: string): string {
  return `<h3 class="report-section-heading">${escapeHtml(title)}</h3>`;
}

export function renderHeadingGroup(
  headingHtml: string,
  bodyHtml: string,
  splittable = false,
): string {
  const body = bodyHtml.trim();
  if (!body) return headingHtml;
  const modifier = splittable ? ' report-heading-group--splittable' : '';
  return `<div class="report-heading-group${modifier}">${headingHtml}${body}</div>`;
}

export interface ReportSectionRenderOptions {
  startNewPage?: boolean;
}

export function renderSectionBlock(
  title: string,
  data: Record<string, unknown>,
  extraSkip = new Set<string>(),
  fieldLabels?: Record<string, string>,
  fieldDefs?: SectionFieldDef[],
  options: ReportSectionRenderOptions = {},
): string {
  const noMajorDefect = isNoMajorDefectObserved(data as { noMajorDefectObserved?: boolean; comments?: string });
  const comments = typeof data.comments === 'string' ? data.comments : '';
  const photos = extraSkip.has('photos')
    ? []
    : Array.isArray(data.photos)
      ? (data.photos as InspectionPhotoRef[])
      : [];
  const inlinedPhotoKeys = new Set<string>();
  const rowGroups = noMajorDefect
    ? ''
    : renderFieldRows(data, extraSkip, fieldLabels, fieldDefs, inlinedPhotoKeys);
  const extraPhotos = noMajorDefect
    ? ''
    : renderExtraPhotoFields(data, fieldDefs, inlinedPhotoKeys);

  const sectionPhotoRows =
    photos.length && rowGroups
      ? `<tbody class="field-row-group field-row-group--with-photos field-section-photos-group">${renderInlineFieldPhotoTableRows(photos, 'Inspection photos').join('\n')}</tbody>`
      : '';

  const tableHtml = rowGroups || sectionPhotoRows ? `<table class="field-table">${rowGroups}${sectionPhotoRows}</table>` : '';
  const commentsHtml = comments.trim() ? renderComments(comments) : '';
  const orphanPhotosHtml =
    photos.length && !rowGroups ? renderPhotos(photos, 'Inspection photos') : '';
  const supplementHtml = renderSupplementBlock(extraPhotos, commentsHtml, orphanPhotosHtml);

  const heading = renderSectionHeading(title);
  const sectionClass = options.startNewPage ? 'report-section report-section-new-page' : 'report-section';

  if (!tableHtml && !supplementHtml) return '';

  const sectionBody =
    tableHtml && supplementHtml
      ? `${heading}${tableHtml}${supplementHtml}`
      : tableHtml
        ? `${heading}${tableHtml}`
        : renderHeadingGroup(heading, supplementHtml, true);

  return `
<section class="${sectionClass}">
  <div class="report-section-block">
    ${sectionBody}
  </div>
</section>`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
