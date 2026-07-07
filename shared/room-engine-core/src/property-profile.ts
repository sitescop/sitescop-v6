import type { AccessibilityObstructionsSection, PropertyDescriptionSection, SubfloorSection } from './types.js';
import { normalizeCheckboxField } from './defaults.js';

export const SUBFLOOR_PRESENT_OPTIONS = ['Yes', 'No', 'Unable to determine'] as const;

/** Standard comment when inspector confirms no issues in a section. */
export const NO_ISSUES_OBSERVED_COMMENT =
  'No significant issues were observed in this area at the time of inspection.';

const SUBFLOOR_INACCESSIBLE_PRESETS = new Set([
  'Unsafe subfloor access',
  'Subfloor access obstructed',
]);

/** Subfloor inspection sections apply unless the property has no subfloor space. */
export function isSubfloorApplicable(subfloorPresent: string | undefined): boolean {
  return subfloorPresent?.trim() !== 'No';
}

export function hasSubfloorPresentAnswer(subfloorPresent: string | undefined): boolean {
  return Boolean(subfloorPresent?.trim());
}

/** Legacy inspections without subfloorPresent keep subfloor sections visible until answered. */
export function inferLegacySubfloorPresent(
  property: PropertyDescriptionSection,
  buildingSubfloor?: SubfloorSection,
  accessibility?: AccessibilityObstructionsSection,
): string {
  if (property.subfloorPresent?.trim()) return property.subfloorPresent;

  const subfloorSection = buildingSubfloor;
  if (subfloorSection) {
    const hasSubfloorData =
      (subfloorSection.comments?.trim().length ?? 0) > 0 ||
      (subfloorSection.photos?.length ?? 0) > 0 ||
      normalizeCheckboxField(subfloorSection.elements).selected.length > 0 ||
      normalizeCheckboxField(subfloorSection.elements).custom.length > 0;
    if (hasSubfloorData) return 'Yes';
  }

  if (accessibility) {
    const areas = normalizeCheckboxField(accessibility.accessibilityAreas);
    if (areas.selected.includes('Subfloor') || areas.custom.includes('Subfloor')) return 'Yes';
    const obstructions = normalizeCheckboxField(accessibility.subfloorObstructions);
    if (obstructions.selected.length > 0 || obstructions.custom.length > 0) return 'Yes';
  }

  return '';
}

export function resolveSubfloorPresent(
  property: PropertyDescriptionSection,
  buildingSubfloor?: SubfloorSection,
  accessibility?: AccessibilityObstructionsSection,
): string {
  return property.subfloorPresent?.trim() || inferLegacySubfloorPresent(property, buildingSubfloor, accessibility);
}

export function accessibilityAreasWithoutSubfloor<T extends readonly string[]>(options: T): T[number][] {
  return options.filter((option) => option !== 'Subfloor') as T[number][];
}

export function inaccessibleAreasWithoutSubfloor<T extends readonly string[]>(options: T): T[number][] {
  return options.filter((option) => !SUBFLOOR_INACCESSIBLE_PRESETS.has(option)) as T[number][];
}
