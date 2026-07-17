import type { AccessibilityObstructionsSection, PropertyDescriptionSection, SubfloorSection } from './types.js';
import { normalizeCheckboxField } from './defaults.js';

export const SUBFLOOR_PRESENT_OPTIONS = ['Yes', 'No', 'Unable to determine'] as const;

/** Standard comment when inspector confirms no major defects in a section. */
export const NO_MAJOR_DEFECT_OBSERVED_COMMENT =
  'No major defect observed in this area at the time of inspection.';

/** Standard comment when inspector confirms a major defect and uses comments/photos only. */
export const MAJOR_DEFECT_OBSERVED_COMMENT =
  'Major defect observed in this area at the time of inspection.';

/** @deprecated Use NO_MAJOR_DEFECT_OBSERVED_COMMENT */
export const NO_ISSUES_OBSERVED_COMMENT = NO_MAJOR_DEFECT_OBSERVED_COMMENT;

const LEGACY_NO_ISSUES_SNIPPET = 'No significant issues were observed';

export function buildNoMajorDefectPatch(currentComments?: string): {
  noMajorDefectObserved: true;
  majorDefectObserved: false;
  comments: string;
} {
  const existing = currentComments?.trim() ?? '';
  const cleaned = existing
    .replace(MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(NO_MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(LEGACY_NO_ISSUES_SNIPPET, '')
    .trim();
  return {
    noMajorDefectObserved: true,
    majorDefectObserved: false,
    comments: cleaned
      ? `${NO_MAJOR_DEFECT_OBSERVED_COMMENT}\n${cleaned}`
      : NO_MAJOR_DEFECT_OBSERVED_COMMENT,
  };
}

export function buildMajorDefectPatch(currentComments?: string): {
  majorDefectObserved: true;
  noMajorDefectObserved: false;
  comments: string;
} {
  const existing = currentComments?.trim() ?? '';
  const cleaned = existing
    .replace(MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(NO_MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(LEGACY_NO_ISSUES_SNIPPET, '')
    .trim();
  return {
    majorDefectObserved: true,
    noMajorDefectObserved: false,
    comments: cleaned
      ? `${MAJOR_DEFECT_OBSERVED_COMMENT}\n${cleaned}`
      : MAJOR_DEFECT_OBSERVED_COMMENT,
  };
}

export function clearDefectQuickPatch(): {
  noMajorDefectObserved: false;
  majorDefectObserved: false;
  comments: string;
} {
  return {
    noMajorDefectObserved: false,
    majorDefectObserved: false,
    comments: '',
  };
}

export function isNoMajorDefectObserved(section: {
  noMajorDefectObserved?: boolean;
  majorDefectObserved?: boolean;
  comments?: string;
}): boolean {
  if (section.majorDefectObserved === true) return false;
  if (section.noMajorDefectObserved === true) return true;
  const text = section.comments?.trim() ?? '';
  if (!text) return false;
  if (text.includes(MAJOR_DEFECT_OBSERVED_COMMENT)) return false;
  return (
    text.includes(NO_MAJOR_DEFECT_OBSERVED_COMMENT) ||
    text.includes(LEGACY_NO_ISSUES_SNIPPET)
  );
}

export function isMajorDefectObserved(section: {
  majorDefectObserved?: boolean;
  comments?: string;
}): boolean {
  if (section.majorDefectObserved === true) return true;
  const text = section.comments?.trim() ?? '';
  if (!text) return false;
  return text.includes(MAJOR_DEFECT_OBSERVED_COMMENT);
}

/** True when either quick action collapsed the detailed fields. */
export function isDefectQuickCollapsed(section: {
  noMajorDefectObserved?: boolean;
  majorDefectObserved?: boolean;
  comments?: string;
}): boolean {
  return isNoMajorDefectObserved(section) || isMajorDefectObserved(section);
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

/** Generic room names that always get a number for identification (Bedroom 1, Bedroom 2). */
const GENERIC_ROOM_NAMES_ALWAYS_NUMBERED = new Set(['Bedroom', 'Bathroom', 'Living Area', 'Garage']);

export function resolveRoomReportLabels(rooms: RoomReportLabelInput[]): string[] {
  const raw = rooms.map((room) => resolveRoomNameFromData(room.roomType, room.data) || room.label);
  const totalCounts = new Map<string, number>();
  for (const name of raw) {
    totalCounts.set(name, (totalCounts.get(name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return raw.map((name) => {
    const count = totalCounts.get(name) ?? 0;
    const alwaysNumber = GENERIC_ROOM_NAMES_ALWAYS_NUMBERED.has(name);
    // Specific types (Master Bedroom, Ensuite, …) keep their selected name.
    // Generic "Bedroom" / "Bathroom" always get numbers so tabs stay distinct.
    if (!alwaysNumber && count <= 1) return name;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (alwaysNumber) return `${name} ${n}`;
    return n === 1 ? name : `${name} (${n})`;
  });
}

/** Short ordinal heading for no-major-defect room PDF sections, e.g. "Bed 1", "Bath 2". */
export function roomOrdinalPdfTitle(label: string, roomType: string, roomIndex: number): string {
  const normalized = roomType.toUpperCase();
  if (normalized === 'BEDROOM') {
    const match = label.match(/^Bedroom\s+(\d+)$/i);
    if (match) return `Bed ${match[1]}`;
    // Keep selected type names (Master Bedroom, Guest Bedroom, …).
    if (label.trim() && !/^Bedroom$/i.test(label.trim())) return label.trim();
    return `Bed ${roomIndex + 1}`;
  }
  if (normalized === 'BATHROOM') {
    const match = label.match(/^Bathroom\s+(\d+)$/i);
    if (match) return `Bath ${match[1]}`;
    if (label.trim() && !/^Bathroom$/i.test(label.trim())) return label.trim();
    return `Bath ${roomIndex + 1}`;
  }
  if (normalized === 'LIVING') {
    const match = label.match(/^Living Area\s+(\d+)$/i);
    if (match) return `Living ${match[1]}`;
    if (label.trim() && !/^Living Area$/i.test(label.trim())) return label.trim();
    return `Living ${roomIndex + 1}`;
  }
  return label;
}

/** PDF comment line when a room has no major defects (no room-name prefix — title already has it). */
export function noMajorDefectRoomPdfComments(
  roomType: string,
  data: Record<string, unknown>,
): string {
  const roomName = resolveRoomNameFromData(roomType, data);
  const existing = typeof data.comments === 'string' ? data.comments.trim() : '';
  const cleaned = existing
    .replace(MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(NO_MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(LEGACY_NO_ISSUES_SNIPPET, '')
    .replace(roomName ? new RegExp(`^${escapeRegExp(roomName)}\\s*[—\\-–:]\\s*`, 'i') : /^/, '')
    .replace(/^[\s—\-–:]+|[\s—\-–:]+$/g, '')
    .trim();
  return cleaned
    ? `${NO_MAJOR_DEFECT_OBSERVED_COMMENT} ${cleaned}`
    : NO_MAJOR_DEFECT_OBSERVED_COMMENT;
}

/** PDF comment line when a room has major defects recorded via quick action. */
export function majorDefectRoomPdfComments(
  roomType: string,
  data: Record<string, unknown>,
): string {
  const roomName = resolveRoomNameFromData(roomType, data);
  const existing = typeof data.comments === 'string' ? data.comments.trim() : '';
  // Never leave a stale "No major defect…" line when Major was selected.
  const cleaned = existing
    .replace(NO_MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(LEGACY_NO_ISSUES_SNIPPET, '')
    .replace(MAJOR_DEFECT_OBSERVED_COMMENT, '')
    .replace(roomName ? new RegExp(`^${escapeRegExp(roomName)}\\s*[—\\-–:]\\s*`, 'i') : /^/, '')
    .replace(/^[\s—\-–:]+|[\s—\-–:]+$/g, '')
    .trim();
  return cleaned
    ? `${MAJOR_DEFECT_OBSERVED_COMMENT} ${cleaned}`
    : MAJOR_DEFECT_OBSERVED_COMMENT;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve PDF comments for any section using Major / No Major quick actions.
 * Ensures the printed text matches the selected action (never leaves the opposite stock line).
 */
export function resolveDefectQuickPdfComments(data: {
  noMajorDefectObserved?: boolean;
  majorDefectObserved?: boolean;
  comments?: string;
}): string {
  const existing = data.comments?.trim() ?? '';
  if (isMajorDefectObserved(data)) {
    if (
      existing.includes(MAJOR_DEFECT_OBSERVED_COMMENT) &&
      !existing.includes(NO_MAJOR_DEFECT_OBSERVED_COMMENT) &&
      !existing.includes(LEGACY_NO_ISSUES_SNIPPET)
    ) {
      return existing;
    }
    const cleaned = existing
      .replace(NO_MAJOR_DEFECT_OBSERVED_COMMENT, '')
      .replace(LEGACY_NO_ISSUES_SNIPPET, '')
      .replace(MAJOR_DEFECT_OBSERVED_COMMENT, '')
      .replace(/^[\s—\-]+|[\s—\-]+$/g, '')
      .trim();
    return cleaned
      ? `${MAJOR_DEFECT_OBSERVED_COMMENT} ${cleaned}`
      : MAJOR_DEFECT_OBSERVED_COMMENT;
  }
  if (isNoMajorDefectObserved(data)) {
    if (
      (existing.includes(NO_MAJOR_DEFECT_OBSERVED_COMMENT) ||
        existing.includes(LEGACY_NO_ISSUES_SNIPPET)) &&
      !existing.includes(MAJOR_DEFECT_OBSERVED_COMMENT)
    ) {
      return existing;
    }
    const cleaned = existing
      .replace(MAJOR_DEFECT_OBSERVED_COMMENT, '')
      .replace(NO_MAJOR_DEFECT_OBSERVED_COMMENT, '')
      .replace(LEGACY_NO_ISSUES_SNIPPET, '')
      .replace(/^[\s—\-]+|[\s—\-]+$/g, '')
      .trim();
    return cleaned
      ? `${NO_MAJOR_DEFECT_OBSERVED_COMMENT} ${cleaned}`
      : NO_MAJOR_DEFECT_OBSERVED_COMMENT;
  }
  return existing;
}

/** Build the auto comment for a roof framing finding. */
export function buildRoofFramingFindingComment(
  element: string,
  defects: string[],
  trades: string[],
): string {
  const defectText = defects.length > 0 ? defects.join('; ').toLowerCase() : 'significant defect';
  const tradeText =
    trades.length > 0
      ? ` Recommended: ${trades.join('; ')}.`
      : '';
  return `Significant defect observed (${element}) — ${defectText}.${tradeText}`;
}

/**
 * Apply a roof framing finding from the interactive diagram.
 * Marks the element selected and appends (or replaces) the matching auto comment.
 */
export function applyRoofFramingFinding(
  framingElements: CheckboxFieldState | undefined,
  comments: string | undefined,
  element: string,
  defects: string[],
  trades: string[],
): { framingElements: CheckboxFieldState; comments: string } {
  const current = normalizeCheckboxField(framingElements);
  const selected = new Set(current.selected);
  selected.add(element);

  const nextComment = buildRoofFramingFindingComment(element, defects, trades);
  const marker = `Significant defect observed (${element})`;
  const existingLines = (comments ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith(marker));

  return {
    framingElements: {
      selected: [...selected],
      custom: current.custom.filter((item) => item !== element),
    },
    comments: [...existingLines, nextComment].join('\n\n'),
  };
}

/** Clear a roof framing element selection and its matching auto comment. */
export function clearRoofFramingFinding(
  framingElements: CheckboxFieldState | undefined,
  comments: string | undefined,
  element: string,
): { framingElements: CheckboxFieldState; comments: string } {
  const current = normalizeCheckboxField(framingElements);
  const marker = `Significant defect observed (${element})`;
  return {
    framingElements: {
      selected: current.selected.filter((item) => item !== element),
      custom: current.custom.filter((item) => item !== element),
    },
    comments: (comments ?? '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith(marker))
      .join('\n\n'),
  };
}
