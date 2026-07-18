import { ACCESSIBILITY_AREAS, INACCESSIBLE_AREA_PRESETS } from './options.js';
import { normalizeAccessibilityAreas, normalizeCheckboxField } from './defaults.js';
import type { AccessibilityObstructionsSection, CheckboxFieldState } from './types.js';

export type AccessibilityAreaName = (typeof ACCESSIBILITY_AREAS)[number];

const AREA_SET = new Set<string>(ACCESSIBILITY_AREAS);

/** Reason options shown when an Accessibility Area is auto-marked inaccessible. */
export const ACCESSIBILITY_AREA_REASON_OPTIONS: Record<AccessibilityAreaName, readonly string[]> = {
  Interior: [
    'Locked room(s)',
    'Stored goods restricting access',
    'Furniture restricting access',
    'Animal/pest activity restricting access',
    'Electrical hazards present',
  ],
  Exterior: [
    'Vegetation restricting access',
    'Construction materials restricting access',
    'Stored goods restricting access',
    'Animal/pest activity restricting access',
    'Moisture/flooding restricting access',
  ],
  'Roof Space': [
    'No roof space access hatch',
    'Insufficient roof space clearance',
    'Unsafe roof access',
    'Stored goods restricting access',
  ],
  Subfloor: [
    'Unsafe subfloor access',
    'Subfloor access obstructed',
    'Low height clearance — inspector unable to enter and inspect',
    'Restricted or undersized access hatch',
    'Low ground clearance',
    'Standing water or flooding',
    'Moisture/flooding restricting access',
    'Stored goods restricting access',
    'Animal/pest activity restricting access',
    'Electrical hazards present',
  ],
  Site: [
    'Vegetation restricting access',
    'Animal/pest activity restricting access',
    'Moisture/flooding restricting access',
    'Construction materials restricting access',
  ],
  Outbuilding: [
    'Locked garage/shed',
    'Stored goods restricting access',
    'Furniture restricting access',
    'Animal/pest activity restricting access',
  ],
  'Roof Exterior': [
    'Unsafe roof access',
    'Vegetation restricting access',
    'Construction materials restricting access',
  ],
};

/**
 * Workspace route IDs (and pest prefixes) controlled by each Accessibility Area.
 * Rooms under Interior are handled via room route IDs.
 */
export const ACCESSIBILITY_AREA_ROUTE_IDS: Record<AccessibilityAreaName, readonly string[]> = {
  Interior: ['kitchen', 'laundry', 'bedrooms', 'bathrooms', 'living-areas', 'garage'],
  Exterior: ['external', 'fencing'],
  'Roof Space': ['roof-space'],
  Subfloor: ['subfloor', 'pest-d9SubfloorVentilation'],
  Site: ['site-conditions'],
  Outbuilding: ['outbuildings'],
  'Roof Exterior': ['roof-exterior'],
};

/** Form section comment fields updated when an inaccessible reason is chosen. */
export const ACCESSIBILITY_AREA_COMMENT_TARGETS: Record<
  AccessibilityAreaName,
  readonly { realm: 'shared' | 'building' | 'pest'; section: string }[]
> = {
  Interior: [
    { realm: 'building', section: 'kitchen' },
    { realm: 'building', section: 'laundry' },
  ],
  Exterior: [
    { realm: 'shared', section: 'external' },
    { realm: 'building', section: 'fencing' },
  ],
  'Roof Space': [{ realm: 'shared', section: 'roofSpace' }],
  Subfloor: [
    { realm: 'building', section: 'subfloor' },
    { realm: 'pest', section: 'd9SubfloorVentilation' },
  ],
  Site: [{ realm: 'shared', section: 'siteConditions' }],
  Outbuilding: [{ realm: 'building', section: 'outbuildings' }],
  'Roof Exterior': [{ realm: 'shared', section: 'roofExterior' }],
};

const ROUTE_TO_AREA = (() => {
  const map = new Map<string, AccessibilityAreaName>();
  for (const area of ACCESSIBILITY_AREAS) {
    for (const routeId of ACCESSIBILITY_AREA_ROUTE_IDS[area]) {
      map.set(routeId, area);
    }
  }
  return map;
})();

export function lockedInaccessibleAreaMessage(area: string): string {
  return `${area} is inaccessible because it was not ticked in Accessibility Areas`;
}

export function formatInaccessibleAreaComment(area: string, reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) return '';
  return `${area} inaccessible — ${trimmed}`;
}

/** Fallback when area is locked but no reason has been chosen yet. */
export const INACCESSIBLE_REASON_FALLBACK = 'Not selected in Accessibility Areas — area not inspected';

export function resolveInaccessibleReasonText(
  area: string,
  reasons: Record<string, string> | undefined | null,
): string {
  const chosen = String(reasons?.[area] ?? '').trim();
  return chosen || INACCESSIBLE_REASON_FALLBACK;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Upsert or remove the auto inaccessible-reason line in a section comment.
 * When a reason is set, it takes over the section comments entirely.
 * When cleared, removes only the auto inaccessible line(s).
 */
export function applyInaccessibleReasonComment(
  current: string | undefined | null,
  area: string,
  reason: string,
): string {
  const next = formatInaccessibleAreaComment(area, reason);
  if (next) return next;

  const pattern = new RegExp(`^${escapeRegExp(area)}\\s+inaccessible\\s*[—\\-]`, 'i');
  return String(current ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !pattern.test(line))
    .join('\n\n');
}

/** Obstruction groups that apply only while that Accessibility Area is ticked. */
export const ACCESSIBILITY_AREA_OBSTRUCTION_FIELDS: Partial<
  Record<
    AccessibilityAreaName,
    {
      obstructions: keyof AccessibilityObstructionsSection;
      photos: keyof AccessibilityObstructionsSection;
    }
  >
> = {
  Interior: { obstructions: 'interiorObstructions', photos: 'interiorObstructionPhotos' },
  Exterior: { obstructions: 'exteriorObstructions', photos: 'exteriorObstructionPhotos' },
  'Roof Space': { obstructions: 'roofSpaceObstructions', photos: 'roofSpaceObstructionPhotos' },
  Subfloor: { obstructions: 'subfloorObstructions', photos: 'subfloorObstructionPhotos' },
};

function emptyObstructionField(): CheckboxFieldState {
  return { selected: [], custom: [] };
}

/** Clear obstruction ticks/photos for areas that are not accessible (inaccessible, not obstructed). */
export function clearObstructionsForInaccessibleAreas(
  section: AccessibilityObstructionsSection,
  missingAreas: readonly string[],
): AccessibilityObstructionsSection {
  const missingSet = new Set(missingAreas);
  let next: AccessibilityObstructionsSection = { ...section };
  for (const area of ACCESSIBILITY_AREAS) {
    if (!missingSet.has(area)) continue;
    const fields = ACCESSIBILITY_AREA_OBSTRUCTION_FIELDS[area];
    if (!fields) continue;
    next = {
      ...next,
      [fields.obstructions]: emptyObstructionField(),
      [fields.photos]: [],
    };
  }
  return next;
}

/** Form / PDF section keys → Accessibility Area. */
export const FORM_SECTION_KEY_TO_ACCESSIBILITY_AREA: Record<string, AccessibilityAreaName> = {
  siteConditions: 'Site',
  external: 'Exterior',
  fencing: 'Exterior',
  subfloor: 'Subfloor',
  outbuildings: 'Outbuilding',
  roofExterior: 'Roof Exterior',
  roofSpace: 'Roof Space',
  kitchen: 'Interior',
  laundry: 'Interior',
  d9SubfloorVentilation: 'Subfloor',
};

export function resolveAccessibilityAreaForFormSectionKey(
  sectionKey: string,
): AccessibilityAreaName | null {
  return FORM_SECTION_KEY_TO_ACCESSIBILITY_AREA[sectionKey] ?? null;
}

export function isFormSectionInaccessibleFromAccessibility(
  sectionKey: string,
  accessibilityAreas: CheckboxFieldState | string[] | undefined | null,
  subfloorApplicable: boolean,
): boolean {
  const area = resolveAccessibilityAreaForFormSectionKey(sectionKey);
  if (!area) return false;
  if (area === 'Subfloor' && !subfloorApplicable) return false;
  return getMissingAccessibilityAreas(accessibilityAreas, subfloorApplicable).includes(area);
}

export function applicableAccessibilityAreas(subfloorApplicable: boolean): AccessibilityAreaName[] {
  return ACCESSIBILITY_AREAS.filter((area) => area !== 'Subfloor' || subfloorApplicable);
}

export function getMissingAccessibilityAreas(
  accessibilityAreas: CheckboxFieldState | string[] | undefined | null,
  subfloorApplicable: boolean,
): AccessibilityAreaName[] {
  const field = normalizeAccessibilityAreas(accessibilityAreas);
  const selected = new Set([...field.selected, ...field.custom]);
  return applicableAccessibilityAreas(subfloorApplicable).filter((area) => !selected.has(area));
}

export function resolveAccessibilityAreaForRoute(routeId: string): AccessibilityAreaName | null {
  return ROUTE_TO_AREA.get(routeId) ?? null;
}

export function isRouteInaccessibleFromAccessibility(
  routeId: string,
  accessibilityAreas: CheckboxFieldState | string[] | undefined | null,
  subfloorApplicable: boolean,
): boolean {
  const area = resolveAccessibilityAreaForRoute(routeId);
  if (!area) return false;
  if (area === 'Subfloor' && !subfloorApplicable) return false;
  return getMissingAccessibilityAreas(accessibilityAreas, subfloorApplicable).includes(area);
}

export function normalizeInaccessibleAreaReasons(
  value: Record<string, string> | undefined | null,
): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const next: Record<string, string> = {};
  for (const [key, reason] of Object.entries(value)) {
    if (!AREA_SET.has(key)) continue;
    const trimmed = String(reason ?? '').trim();
    if (trimmed) next[key] = trimmed;
  }
  return next;
}

function withoutAllAreasPermitted(field: CheckboxFieldState): CheckboxFieldState {
  return {
    selected: field.selected.filter((item) => item !== 'All areas permitted entry'),
    custom: field.custom.filter((item) => item !== 'All areas permitted entry'),
  };
}

/**
 * Keep Inaccessible Areas in sync with unticked Accessibility Areas.
 * Locked area names are always selected; reasons stay in `inaccessibleAreaReasons`.
 * Previously locked areas that become accessible again are removed (not manual reasons).
 */
export function syncInaccessibleAreasFromAccessibility(
  section: AccessibilityObstructionsSection,
  subfloorApplicable: boolean,
): AccessibilityObstructionsSection {
  const accessibilityAreas = normalizeAccessibilityAreas(section.accessibilityAreas);
  const missing = getMissingAccessibilityAreas(accessibilityAreas, subfloorApplicable);
  const missingSet = new Set<string>(missing);
  const previousLocked = new Set(
    Object.keys(normalizeInaccessibleAreaReasons(section.inaccessibleAreaReasons)).filter((area) =>
      AREA_SET.has(area),
    ),
  );
  // Also treat area names currently in inaccessible selected as previously locked when they match areas
  const inaccessible = normalizeCheckboxField(section.inaccessibleAreas);
  for (const item of [...inaccessible.selected, ...inaccessible.custom]) {
    if (AREA_SET.has(item)) previousLocked.add(item);
  }

  let nextInaccessible = withoutAllAreasPermitted(inaccessible);

  // Drop auto-locked area names that are accessible again
  nextInaccessible = {
    selected: nextInaccessible.selected.filter((item) => !AREA_SET.has(item) || missingSet.has(item)),
    custom: nextInaccessible.custom.filter((item) => !AREA_SET.has(item) || missingSet.has(item)),
  };

  // Ensure missing areas are ticked as selected presets (area name)
  const selected = new Set(nextInaccessible.selected);
  for (const area of missing) {
    selected.add(area);
  }
  nextInaccessible = {
    selected: [...selected],
    custom: nextInaccessible.custom.filter((item) => !selected.has(item)),
  };

  const reasons = normalizeInaccessibleAreaReasons(section.inaccessibleAreaReasons);
  const nextReasons: Record<string, string> = {};
  for (const area of missing) {
    if (reasons[area]) nextReasons[area] = reasons[area];
  }

  // Keep Inaccessible Areas as area names only. Reasons live in inaccessibleAreaReasons
  // (mirroring reason presets into selected polluted the PDF checklist).
  let cleanedInaccessible = nextInaccessible;
  const presetReasonSet = new Set<string>(INACCESSIBLE_AREA_PRESETS);
  cleanedInaccessible = {
    selected: cleanedInaccessible.selected.filter((item) => !presetReasonSet.has(item)),
    custom: cleanedInaccessible.custom.filter((item) => !presetReasonSet.has(item)),
  };

  if (missing.length > 0) {
    cleanedInaccessible = withoutAllAreasPermitted(cleanedInaccessible);
  }

  const withClearedObstructions = clearObstructionsForInaccessibleAreas(
    {
      ...section,
      accessibilityAreas,
      inaccessibleAreas: cleanedInaccessible,
      inaccessibleAreaReasons: nextReasons,
    },
    missing,
  );

  return withClearedObstructions;
}

export function setInaccessibleAreaReason(
  section: AccessibilityObstructionsSection,
  area: string,
  reason: string,
  subfloorApplicable: boolean,
): AccessibilityObstructionsSection {
  const synced = syncInaccessibleAreasFromAccessibility(section, subfloorApplicable);
  const missing = getMissingAccessibilityAreas(synced.accessibilityAreas, subfloorApplicable);
  if (!missing.includes(area as AccessibilityAreaName)) return synced;

  const trimmed = reason.trim();
  const nextReasons = { ...normalizeInaccessibleAreaReasons(synced.inaccessibleAreaReasons) };
  if (trimmed) nextReasons[area] = trimmed;
  else delete nextReasons[area];

  return {
    ...synced,
    inaccessibleAreaReasons: nextReasons,
  };
}
