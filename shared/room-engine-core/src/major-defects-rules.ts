import { normalizeCheckboxField } from './defaults.js';
import type { CheckboxFieldState, CrackingEntry, FinishElementDamageEntry, MajorDefectsSection } from './types.js';

const DRAINAGE_CONDUCIVE = new Set([
  'Water pooling adjacent to building',
  'Poor surface drainage',
  'Inadequate fall away from building',
  'Subfloor moisture / poor drainage',
]);

const WATERPROOFING_CONDUCIVE = new Set([
  'DPC below ground level or not visible',
  'Garden beds against external walls',
  'Timber in ground contact',
]);

const PLUMBER_CONDUCIVE = new Set(['Downpipe discharge against building']);

const STRUCTURAL_DEFORMATION = new Set(['Wall Bowing', 'Floor Deflection']);
const ROOF_CEILING_DEFORMATION = new Set([
  'Roof Deformation / Sagging',
  'Ceiling Deformation / Sagging',
]);

const CRACK_WIDTH_ALIASES: Record<string, string> = {
  Hairline: '< 1 mm',
  '1-2mm': '1-2 mm',
  '2-5mm': '2-5 mm',
  '5-10mm': '5-15 mm',
  '10mm+': '> 15 mm',
};

export const CRACK_WIDTH_INTERPRETATIONS: Record<string, string> = {
  '< 1 mm': 'Usually cosmetic (hairline), unless associated with movement.',
  '1-2 mm': 'Minor crack. Monitor and investigate if it is growing.',
  '2-5 mm': 'May indicate structural movement. Requires further assessment.',
  '5-15 mm': 'Significant crack. Should be assessed by a structural engineer.',
  '> 15 mm': 'Severe structural movement. Urgent investigation is recommended.',
  Undetermined: 'Crack width not determined. Photograph and measure where possible.',
};

/** Migrate legacy single `element` string to checkbox `elements`. */
export function normalizeFinishElementDamageEntry(
  entry: FinishElementDamageEntry & { element?: string },
): FinishElementDamageEntry {
  const photos = entry.photos ?? [];
  if (entry.elements) {
    return {
      id: entry.id,
      location: entry.location ?? '',
      comments: entry.comments ?? '',
      photos,
      elements: normalizeCheckboxField(entry.elements),
    };
  }
  const legacy = entry.element?.trim();
  return {
    id: entry.id,
    location: entry.location ?? '',
    comments: entry.comments ?? '',
    photos,
    elements: legacy ? { selected: [legacy], custom: [] } : { selected: [], custom: [] },
  };
}

export function normalizeFinishElementDamageEntries(
  entries: (FinishElementDamageEntry & { element?: string })[],
): FinishElementDamageEntry[] {
  return entries.map(normalizeFinishElementDamageEntry);
}

function checkboxItems(field: CheckboxFieldState | undefined): string[] {
  const normalized = normalizeCheckboxField(field);
  return [...normalized.selected, ...normalized.custom].filter(Boolean);
}

function includesItem(field: CheckboxFieldState | undefined, item: string): boolean {
  const target = item.trim().toLowerCase();
  return checkboxItems(field).some((entry) => entry.trim().toLowerCase() === target);
}

export function normalizeCrackWidth(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return CRACK_WIDTH_ALIASES[trimmed] ?? trimmed;
}

export function crackWidthMinMm(value: string): number | null {
  const normalized = normalizeCrackWidth(value);
  if (!normalized) return null;
  if (normalized === '< 1 mm') return 0;
  if (normalized === '1-2 mm') return 1;
  if (normalized === '2-5 mm') return 2;
  if (normalized === '5-15 mm') return 5;
  if (normalized === '> 15 mm') return 16;
  return null;
}

export function getCrackWidthInterpretation(value: string): string {
  const normalized = normalizeCrackWidth(value);
  return CRACK_WIDTH_INTERPRETATIONS[normalized] ?? '';
}

export function applyCrackingEntryRules(entry: CrackingEntry): CrackingEntry {
  const crackWidth = normalizeCrackWidth(entry.crackWidth);
  const minMm = crackWidthMinMm(crackWidth);
  const interpretation = getCrackWidthInterpretation(crackWidth);
  let monitoringRecommended = entry.monitoringRecommended;
  let engineeringRequired = entry.engineeringRequired;
  let comments = entry.comments?.trim() ?? '';

  if (minMm === null) {
    return { ...entry, crackWidth, photos: entry.photos ?? [] };
  }

  if (minMm < 1) {
    monitoringRecommended = monitoringRecommended === 'Yes' ? 'Yes' : 'No';
    engineeringRequired = engineeringRequired === 'Yes' ? 'Yes' : 'No';
  } else if (minMm < 2) {
    monitoringRecommended = 'Yes';
    engineeringRequired = engineeringRequired === 'Yes' ? 'Yes' : 'No';
  } else {
    monitoringRecommended = 'Yes';
    engineeringRequired = 'Yes';
  }

  if (interpretation && !comments.includes(interpretation)) {
    comments = comments ? `${comments}\n\n${interpretation}` : interpretation;
  }

  if (minMm >= 16 && !/urgent/i.test(comments)) {
    comments = comments
      ? `${comments}\n\nUrgent structural engineer investigation is recommended.`
      : 'Urgent structural engineer investigation is recommended.';
  }

  return {
    ...entry,
    crackWidth,
    monitoringRecommended,
    engineeringRequired,
    comments,
    photos: entry.photos ?? [],
  };
}

export function applyCrackingEntriesRules(entries: CrackingEntry[]): CrackingEntry[] {
  return entries.map(applyCrackingEntryRules);
}

function preserveNoOverride(current: string, shouldBeYes: boolean): string {
  if (current.trim() === 'No') return 'No';
  return shouldBeYes ? 'Yes' : current.trim() || 'No';
}

export function deriveStructuralEngineeringRequired(majorDefects: MajorDefectsSection): string {
  const structural = checkboxItems(majorDefects.structuralMovement);
  const cracking = applyCrackingEntriesRules(majorDefects.crackingEntries ?? []);
  const shouldBeYes =
    structural.length > 0 || cracking.some((entry) => entry.engineeringRequired === 'Yes');
  return preserveNoOverride(majorDefects.structuralEngineeringRequired, shouldBeYes);
}

export function deriveDeformationEngineeringRequired(majorDefects: MajorDefectsSection): string {
  const deformation = checkboxItems(majorDefects.deformation);
  const structural = checkboxItems(majorDefects.structuralMovement);
  const moisture = checkboxItems(majorDefects.moistureSources);

  if (deformation.length === 0) {
    return majorDefects.deformationEngineeringRequired.trim() || 'No';
  }

  const hasStructuralDeformation = deformation.some((item) => STRUCTURAL_DEFORMATION.has(item));
  if (hasStructuralDeformation || structural.length > 0) {
    return preserveNoOverride(majorDefects.deformationEngineeringRequired, true);
  }

  const onlyRoofCeiling = deformation.every((item) => ROOF_CEILING_DEFORMATION.has(item));

  if (onlyRoofCeiling && structural.length === 0) {
    return preserveNoOverride(majorDefects.deformationEngineeringRequired, false);
  }

  return preserveNoOverride(majorDefects.deformationEngineeringRequired, hasStructuralDeformation);
}

export function applyDerivedMajorDefectFields(majorDefects: MajorDefectsSection): MajorDefectsSection {
  const crackingEntries = applyCrackingEntriesRules(majorDefects.crackingEntries ?? []);
  const finishElementDamageEntries = normalizeFinishElementDamageEntries(
    majorDefects.finishElementDamageEntries ?? [],
  );
  return {
    ...majorDefects,
    crackingEntries,
    finishElementDamageEntries,
    structuralEngineeringRequired: deriveStructuralEngineeringRequired({
      ...majorDefects,
      crackingEntries,
    }),
    deformationEngineeringRequired: deriveDeformationEngineeringRequired(majorDefects),
  };
}

export function generateMoistureTradeRecommendations(majorDefects: MajorDefectsSection): string[] {
  const recs: string[] = [];
  const conducive = checkboxItems(majorDefects.conditionsConducive);
  const hasRisingDamp = includesItem(majorDefects.moistureSources, 'Rising Damp');
  const hasPlumbingLeak =
    includesItem(majorDefects.moistureSources, 'Plumbing Leak') ||
    majorDefects.plumbingDefectPhotos.length > 0;
  const hasRoofLeak = includesItem(majorDefects.moistureSources, 'Roof Leak');

  if (hasPlumbingLeak) {
    recs.push('Licensed Plumber Recommended');
  }
  if (hasRoofLeak) {
    recs.push('Licensed Roof Plumber Recommended');
  }

  if (hasRisingDamp) {
    const needsDrainage = conducive.some((item) => DRAINAGE_CONDUCIVE.has(item));
    const needsWaterproofing = conducive.some((item) => WATERPROOFING_CONDUCIVE.has(item));
    const needsPlumber =
      hasPlumbingLeak || conducive.some((item) => PLUMBER_CONDUCIVE.has(item));

    if (needsDrainage) {
      recs.push('Drainage Improvements Recommended');
      recs.push(
        'Engage a drainage contractor or landscaper to improve fall away from the building and address water pooling adjacent to walls.',
      );
    }
    if (needsWaterproofing) {
      recs.push(
        'Engage a licensed waterproofing contractor to assess the damp-proof course, membranes and external ground levels.',
      );
    }
    if (needsPlumber && !hasPlumbingLeak) {
      recs.push('Licensed Plumber Recommended');
    }
    if (!needsDrainage && !needsWaterproofing && !needsPlumber) {
      recs.push(
        'Investigate the source of moisture at the base of walls and engage the appropriate licensed trade once the cause is confirmed.',
      );
    }
  }

  return recs;
}

export function generateDeformationTradeRecommendations(majorDefects: MajorDefectsSection): string[] {
  const recs: string[] = [];
  const deformation = checkboxItems(majorDefects.deformation);

  for (const item of deformation) {
    if (item === 'Roof Deformation / Sagging') {
      recs.push(
        'Engage a licensed roofer or roof plumber to inspect roof structure, drainage and coverings.',
      );
    } else if (item === 'Ceiling Deformation / Sagging') {
      if (includesItem(majorDefects.moistureSources, 'Plumbing Leak')) {
        recs.push('Engage a licensed plumber to investigate plumbing leaks contributing to ceiling deformation.');
      } else if (includesItem(majorDefects.moistureSources, 'Roof Leak')) {
        recs.push('Engage a licensed roofer or roof plumber to investigate roof leaks contributing to ceiling deformation.');
      } else {
        recs.push('Investigate ceiling deformation or sagging and the supporting structure.');
      }
    } else if (item === 'Wall Bowing') {
      recs.push('Investigate wall bowing and engage a structural engineer where movement is suspected.');
    } else if (item === 'Floor Deflection') {
      recs.push('Investigate floor deflection and subfloor support with a structural engineer where required.');
    }
  }

  return recs;
}

export function generateFinishElementConduciveRecommendations(majorDefects: MajorDefectsSection): string[] {
  const conducive = checkboxItems(majorDefects.conditionsConducive);
  if (!conducive.length) return [];

  const recs: string[] = [];
  const hasDrainageConducive = conducive.some((item) => DRAINAGE_CONDUCIVE.has(item));
  if (hasDrainageConducive) {
    recs.push('Drainage Improvements Recommended');
  }
  recs.push(
    `Address conditions conducive to finish element damage including: ${conducive.join(', ')}.`,
  );
  return recs;
}
