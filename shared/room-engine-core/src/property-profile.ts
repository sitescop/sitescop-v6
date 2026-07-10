import type { AccessibilityObstructionsSection, PropertyDescriptionSection, SubfloorSection } from './types.js';
import { normalizeCheckboxField } from './defaults.js';

export const SUBFLOOR_PRESENT_OPTIONS = ['Yes', 'No', 'Unable to determine'] as const;

/** Standard comment when inspector confirms no major defects in a section. */
export const NO_MAJOR_DEFECT_OBSERVED_COMMENT =
  'No major defect observed in this area at the time of inspection.';

/** @deprecated Use NO_MAJOR_DEFECT_OBSERVED_COMMENT */
export const NO_ISSUES_OBSERVED_COMMENT = NO_MAJOR_DEFECT_OBSERVED_COMMENT;

const LEGACY_NO_ISSUES_SNIPPET = 'No significant issues were observed';

export function buildNoMajorDefectPatch(): {
  noMajorDefectObserved: true;
  comments: string;
} {
  return {
    noMajorDefectObserved: true,
    comments: NO_MAJOR_DEFECT_OBSERVED_COMMENT,
  };
}

export function isNoMajorDefectObserved(section: {
  noMajorDefectObserved?: boolean;
  comments?: string;
}): boolean {
  if (section.noMajorDefectObserved === true) return true;
  const text = section.comments?.trim() ?? '';
  if (!text) return false;
  return (
    text.includes(NO_MAJOR_DEFECT_OBSERVED_COMMENT) ||
    text.includes(LEGACY_NO_ISSUES_SNIPPET)
  );
}

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

export function resolveRoomNameFromData(roomType: string, data: Record<string, unknown>): string {
  const normalized = roomType.toUpperCase();
  if (normalized === 'BEDROOM') {
    const name = String(data.roomType ?? '').trim();
    return name || 'Bedroom';
  }
  if (normalized === 'BATHROOM') {
    const type = String(data.bathroomType ?? '').trim();
    if (!type) return 'Bathroom';
    if (type === 'Main') return 'Main Bathroom';
    if (type === 'Master bed') return 'Master Bathroom';
    if (type === 'Ensuite') return 'Ensuite';
    if (type === 'Toilet') return 'Toilet';
    return type;
  }
  if (normalized === 'LIVING') {
    const name = String(data.areaName ?? '').trim();
    return name || 'Living Area';
  }
  return '';
}

export interface RoomReportLabelInput {
  roomType: string;
  roomIndex: number;
  label: string;
  data: Record<string, unknown>;
}

export function resolveRoomReportLabels(rooms: RoomReportLabelInput[]): string[] {
  const raw = rooms.map((room) => resolveRoomNameFromData(room.roomType, room.data) || room.label);
  const totalCounts = new Map<string, number>();
  for (const name of raw) {
    totalCounts.set(name, (totalCounts.get(name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return raw.map((name) => {
    if ((totalCounts.get(name) ?? 0) <= 1) return name;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} (${n})`;
  });
}

/** Short ordinal heading for no-major-defect room PDF sections, e.g. "Bed 1", "Bath 2". */
export function roomOrdinalPdfTitle(label: string, roomType: string, roomIndex: number): string {
  const normalized = roomType.toUpperCase();
  if (normalized === 'BEDROOM') {
    const match = label.match(/^Bedroom\s+(\d+)$/i);
    if (match) return `Bed ${match[1]}`;
    return `Bed ${roomIndex + 1}`;
  }
  if (normalized === 'BATHROOM') {
    const match = label.match(/^Bathroom\s+(\d+)$/i);
    if (match) return `Bath ${match[1]}`;
    return `Bath ${roomIndex + 1}`;
  }
  if (normalized === 'LIVING') {
    const match = label.match(/^Living Area\s+(\d+)$/i);
    if (match) return `Living ${match[1]}`;
    return `Living ${roomIndex + 1}`;
  }
  return label;
}

/** PDF comment line when a room has no major defects, e.g. "Master Bedroom — No major defect observed…". */
export function noMajorDefectRoomPdfComments(
  roomType: string,
  data: Record<string, unknown>,
): string {
  const roomName = resolveRoomNameFromData(roomType, data);
  return `${roomName} — ${NO_MAJOR_DEFECT_OBSERVED_COMMENT}`;
}
