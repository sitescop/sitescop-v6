import type { CheckboxFieldState, InspectionPhotoRef } from '../../room-engine-core/src/index.js';
import { normalizeCheckboxField } from '../../room-engine-core/src/index.js';
import type { SectionFieldDef } from './section-fields.js';

const SKIP_KEYS = new Set(['photos', 'comments']);

const EXTRA_PHOTO_KEYS = [
  'waterPoolingPhotos',
  'moistureMeterPhotos',
  'thermalImages',
  'waterEscapingPhotos',
  'moistureEvidencePhotos',
  'incompleteConstructionPhotos',
] as const;

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
  if (key === 'autoRecommendations' || key === 'manualRecommendations') return renderStringList(value);
  if (key === 'inaccessibleCustomLines') {
    if (!Array.isArray(value)) return '—';
    const lines = value.filter((line) => typeof line === 'string' && line.trim());
    return lines.length ? escapeHtml(lines.join('; ')) : '—';
  }
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return escapeHtml(String(value));
  if (typeof value === 'string') return escapeHtml(value);
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
): string {
  const defs =
    fieldDefs ??
    Object.keys(data)
      .filter((key) => !SKIP_KEYS.has(key) && !extraSkip.has(key))
      .map((key) => ({ key, label: formatLabel(key, fieldLabels) }));

  const rows: string[] = [];
  for (const def of defs) {
    if (SKIP_KEYS.has(def.key) || extraSkip.has(def.key) || EXTRA_PHOTO_KEYS.includes(def.key as (typeof EXTRA_PHOTO_KEYS)[number])) {
      continue;
    }
    rows.push(
      `<tr><th>${escapeHtml(def.label)}</th><td>${renderValue(def.key, data[def.key])}</td></tr>`,
    );
  }
  return rows.join('\n');
}

export function renderComments(comments: string | undefined): string {
  if (!comments?.trim()) return '';
  return `<div class="comments"><strong>Comments</strong><p>${escapeHtml(comments)}</p></div>`;
}

export function renderPhotos(photos: InspectionPhotoRef[] | undefined, label?: string): string {
  if (!photos?.length) return '';
  const items = photos
    .map(
      (photo) =>
        `<figure class="photo"><img src="${photo.dataUrl}" alt="${escapeHtml(photo.caption ?? 'Inspection photo')}" /><figcaption>${escapeHtml(photo.caption ?? '')}</figcaption></figure>`,
    )
    .join('\n');
  return `<div class="photo-group">${label ? `<strong>${escapeHtml(label)}</strong>` : ''}<div class="photo-grid">${items}</div></div>`;
}

function renderExtraPhotoFields(data: Record<string, unknown>, fieldDefs?: SectionFieldDef[]): string {
  const labelByKey = new Map(fieldDefs?.map((def) => [def.key, def.label]));
  const parts: string[] = [];
  for (const key of EXTRA_PHOTO_KEYS) {
    const photos = data[key];
    if (!Array.isArray(photos) || photos.length === 0) continue;
    parts.push(renderPhotos(photos as InspectionPhotoRef[], labelByKey.get(key) ?? formatLabel(key)));
  }
  return parts.join('\n');
}

export function renderSectionBlock(
  title: string,
  data: Record<string, unknown>,
  extraSkip = new Set<string>(),
  fieldLabels?: Record<string, string>,
  fieldDefs?: SectionFieldDef[],
): string {
  const comments = typeof data.comments === 'string' ? data.comments : '';
  const photos = extraSkip.has('photos')
    ? []
    : Array.isArray(data.photos)
      ? (data.photos as InspectionPhotoRef[])
      : [];
  const rows = renderFieldRows(data, extraSkip, fieldLabels, fieldDefs);
  const extraPhotos = renderExtraPhotoFields(data, fieldDefs);
  if (!rows && !comments && !photos.length && !extraPhotos) return '';

  return `
<section class="report-section">
  <h2>${escapeHtml(title)}</h2>
  ${rows ? `<table class="field-table">${rows}</table>` : ''}
  ${renderComments(comments)}
  ${renderPhotos(photos)}
  ${extraPhotos}
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
