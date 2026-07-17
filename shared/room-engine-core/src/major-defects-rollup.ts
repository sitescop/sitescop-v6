import { emptyCheckboxField, normalizeCheckboxField } from './defaults.js';
import { isLowInspectorHazardLevel } from './hazard-assessment.js';
import { applyDerivedMajorDefectFields } from './major-defects-rules.js';
import {
  SITE_DRAINAGE_CONCERNS,
} from './options.js';
import { isMajorDefectObserved, MAJOR_DEFECT_OBSERVED_COMMENT } from './property-profile.js';
import type {
  AccessibilityObstructionsSection,
  CheckboxFieldState,
  CrackingEntry,
  FinishElementDamageEntry,
  ExternalSection,
  InspectionPhotoRef,
  InspectorHazardAssessmentSection,
  KitchenSection,
  LaundrySection,
  SubfloorSection,
  MajorDefectRollupDismissed,
  MajorDefectRollupDismissibleField,
  MajorDefectsSection,
  MoistureTestingSection,
  RoofExteriorSection,
  RoofSpaceSection,
  SiteConditionsSection,
  SectionBase,
} from './types.js';

export interface MajorDefectRollupRoom {
  id: string;
  label: string;
  roomType: string;
  data: Record<string, unknown>;
}

export interface MajorDefectRollupInput {
  shared: {
    external: ExternalSection;
    roofExterior: RoofExteriorSection;
    roofSpace: RoofSpaceSection;
    siteConditions: SiteConditionsSection;
    accessibilityObstructions: AccessibilityObstructionsSection;
    inspectorHazardAssessment: InspectorHazardAssessmentSection;
  };
  building: {
    majorDefects: MajorDefectsSection;
    kitchen: KitchenSection;
    laundry: LaundrySection;
    moistureTesting: MoistureTestingSection;
    subfloor?: SubfloorSection;
    fencing?: SectionBase;
    outbuildings?: SectionBase;
    corrosion?: SectionBase;
  };
  rooms?: MajorDefectRollupRoom[];
  subfloorApplicable?: boolean;
}

export interface MajorDefectAutoSuggestions {
  structuralMovement: string[];
  deformation: string[];
  moistureSources: string[];
  conditionsConducive: string[];
  /** Always empty — Areas Not Inspected is no longer used in major defects. */
  areasNotInspected: [];
  safetyHazards: string[];
  crackingEntries: CrackingEntry[];
  /** Always empty — plumbing photos are no longer auto-linked into major defects. */
  plumbingDefectPhotos: [];
}

export function emptyMajorDefectRollupDismissed(): MajorDefectRollupDismissed {
  return {
    structuralMovement: [],
    deformation: [],
    moistureSources: [],
    conditionsConducive: [],
    areasNotInspected: [],
    safetyHazards: [],
    crackingEntries: [],
  };
}

function normalizeRollupDismissed(
  dismissed: MajorDefectRollupDismissed | undefined,
): MajorDefectRollupDismissed {
  return { ...emptyMajorDefectRollupDismissed(), ...dismissed };
}

function includesCheckboxValue(
  field: CheckboxFieldState | undefined,
  value: string,
): boolean {
  const target = value.trim().toLowerCase();
  if (!target) return false;
  return [...(field?.selected ?? []), ...(field?.custom ?? [])].some(
    (item) => item.trim().toLowerCase() === target,
  );
}

function checkboxItems(field: CheckboxFieldState | undefined): string[] {
  const normalized = normalizeCheckboxField(field);
  return [...normalized.selected, ...normalized.custom].filter(Boolean);
}

function mergeAutoCheckboxPreservingManual(
  field: CheckboxFieldState,
  autoItems: Iterable<string>,
  dismissed: readonly string[],
): CheckboxFieldState {
  const normalized = normalizeCheckboxField(field);
  const dismissedSet = new Set(dismissed);
  const autoToApply = [...autoItems].filter((item) => !dismissedSet.has(item));
  return {
    selected: [...new Set([...normalized.selected, ...autoToApply])],
    custom: [...new Set(normalized.custom)],
  };
}

export function updateMajorDefectCheckboxField(
  majorDefects: MajorDefectsSection,
  field: MajorDefectRollupDismissibleField,
  next: CheckboxFieldState,
  autoItems: string[],
): Partial<MajorDefectsSection> {
  const dismissed = normalizeRollupDismissed(majorDefects.rollupDismissed);
  const prevField = majorDefects[field];
  const prevItems = Array.isArray(prevField) ? [] : checkboxItems(prevField);
  const nextItems = checkboxItems(next);
  const dismissedSet = new Set(dismissed[field]);

  for (const item of autoItems) {
    if (prevItems.includes(item) && !nextItems.includes(item)) dismissedSet.add(item);
    if (nextItems.includes(item)) dismissedSet.delete(item);
  }

  const partial: Partial<MajorDefectsSection> = {
    [field]: next,
    rollupDismissed: { ...dismissed, [field]: [...dismissedSet] },
  };

  // Keep engineering Yes/No in sync as soon as structural/deformation ticks change.
  if (field === 'structuralMovement' || field === 'deformation') {
    const derived = applyDerivedMajorDefectFields({
      ...majorDefects,
      ...partial,
    } as MajorDefectsSection);
    partial.structuralEngineeringRequired = derived.structuralEngineeringRequired;
    partial.deformationEngineeringRequired = derived.deformationEngineeringRequired;
  }

  return partial;
}

function isYes(value: unknown): boolean {
  return value === 'Yes';
}

function hasCracking(field: CheckboxFieldState | undefined): boolean {
  return includesCheckboxValue(field, 'Cracking');
}

function hasDeformation(field: CheckboxFieldState | undefined): boolean {
  return includesCheckboxValue(field, 'Deformation');
}

function hasMoistureDamage(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'moderate' || normalized === 'major';
}

function createAutoCrackingEntry(id: string, location: string, comments = ''): CrackingEntry {
  return {
    id,
    location,
    crackWidth: '',
    monitoringRecommended: 'Yes',
    engineeringRequired: 'No',
    comments,
    photos: [],
  };
}

function syncCrackingEntries(
  current: CrackingEntry[],
  autoEntries: CrackingEntry[],
  dismissedAutoIds: readonly string[] = [],
): CrackingEntry[] {
  const suppressAllAuto = dismissedAutoIds.includes('*');
  const dismissed = new Set(dismissedAutoIds);
  const manual = current.filter((entry) => !entry.id.startsWith('auto-'));
  const byId = new Map(manual.map((entry) => [entry.id, entry]));

  if (!suppressAllAuto) {
    for (const entry of autoEntries) {
      if (dismissed.has(entry.id)) continue;
      const existing = current.find((item) => item.id === entry.id);
      byId.set(
        entry.id,
        existing
          ? {
              ...existing,
              location: entry.location,
              comments: entry.comments || existing.comments,
              photos: existing.photos ?? [],
            }
          : entry,
      );
    }
  }

  return [...byId.values()];
}

function mapInspectorHazardsToSafety(hazards: string[]): string[] {
  const mapped: string[] = [];
  for (const hazard of hazards) {
    const lower = hazard.toLowerCase();
    if (/asbestos/i.test(hazard)) mapped.push('Friable Asbestos Suspected');
    else if (/electrical/i.test(hazard)) mapped.push('Electrical Hazard');
    else if (/structural|collapse|unsafe/i.test(hazard)) mapped.push('Structural Hazard');
    else if (/trip|slip|fall/i.test(hazard)) mapped.push('Trip Hazard');
    else if (/dog|animal/i.test(lower)) mapped.push('Aggressive dog / dangerous animal');
    else if (/aggressive|hostile client/i.test(lower)) mapped.push('Aggressive or hostile client');
    else mapped.push('Other');
  }
  return [...new Set(mapped)];
}

function sectionHasMajorQuick(section: SectionBase | Record<string, unknown> | undefined): boolean {
  if (!section) return false;
  return isMajorDefectObserved(section as { majorDefectObserved?: boolean; comments?: string });
}

function usablePhotos(section: SectionBase | Record<string, unknown> | undefined): InspectionPhotoRef[] {
  const photos = (section as { photos?: InspectionPhotoRef[] } | undefined)?.photos;
  if (!Array.isArray(photos)) return [];
  return photos.filter(
    (photo) => typeof photo?.dataUrl === 'string' && photo.dataUrl.trim().length > 20,
  );
}

function mergeUniquePhotos(
  current: InspectionPhotoRef[] | undefined,
  incoming: InspectionPhotoRef[],
): InspectionPhotoRef[] {
  const byId = new Map<string, InspectionPhotoRef>();
  for (const photo of current ?? []) {
    if (photo?.id) byId.set(photo.id, photo);
  }
  for (const photo of incoming) {
    if (photo?.id) byId.set(photo.id, photo);
  }
  return [...byId.values()];
}

function appendUniqueCommentBlock(existing: string, block: string): string {
  const current = existing.trim();
  const next = block.trim();
  if (!next) return current;
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current}\n\n${next}`;
}

/** Collect "Major defect observed" quick-actions from rooms and building sections. */
export function collectMajorDefectQuickFindings(input: MajorDefectRollupInput): {
  labels: string[];
  commentBlocks: string[];
  photos: InspectionPhotoRef[];
  safetyLabels: string[];
} {
  const labels: string[] = [];
  const commentBlocks: string[] = [];
  const photos: InspectionPhotoRef[] = [];
  const safetyLabels: string[] = [];

  const pushFinding = (label: string, section: SectionBase | Record<string, unknown> | undefined) => {
    if (!sectionHasMajorQuick(section)) return;
    labels.push(label);
    safetyLabels.push(`Major defect observed — ${label}`);
    const comments = String((section as { comments?: string }).comments ?? '').trim();
    if (comments) {
      commentBlocks.push(`${label}: ${comments}`);
    } else {
      commentBlocks.push(`${label}: ${MAJOR_DEFECT_OBSERVED_COMMENT}`);
    }
    photos.push(...usablePhotos(section));
  };

  pushFinding('External', input.shared.external);
  pushFinding('Roof Exterior', input.shared.roofExterior);
  pushFinding('Roof Space', input.shared.roofSpace);
  pushFinding('Kitchen', input.building.kitchen);
  pushFinding('Laundry', input.building.laundry);
  pushFinding('Moisture & Thermal Testing', input.building.moistureTesting);
  if (input.subfloorApplicable !== false) pushFinding('Subfloor', input.building.subfloor);
  pushFinding('Fencing', input.building.fencing);
  pushFinding('Outbuildings', input.building.outbuildings);
  pushFinding('Corrosion', input.building.corrosion);

  for (const room of input.rooms ?? []) {
    const label = room.label?.trim() || room.roomType;
    pushFinding(label, room.data);
  }

  return {
    labels: [...new Set(labels)],
    commentBlocks,
    photos,
    safetyLabels: [...new Set(safetyLabels)],
  };
}

export function collectMajorDefectAutoSuggestions(input: MajorDefectRollupInput): MajorDefectAutoSuggestions {
  const { shared, building, rooms = [] } = input;
  const structural = new Set<string>();
  const deformation = new Set<string>();
  const moisture = new Set<string>();
  const conducive = new Set<string>();
  const safety = new Set<string>();
  const autoCracking: CrackingEntry[] = [];

  if (hasCracking(shared.external.damageObserved)) {
    structural.add('Walls');
    autoCracking.push(createAutoCrackingEntry('auto-external-cracking', 'External walls', 'Cracking observed to external walls.'));
  }
  if (hasDeformation(shared.external.damageObserved)) {
    deformation.add('Wall Bowing');
  }
  if (includesCheckboxValue(shared.external.damageObserved, 'Moisture Damage')) {
    moisture.add('Rising Damp');
  }

  if (shared.roofExterior.condition === 'Poor') {
    deformation.add('Roof Deformation / Sagging');
    moisture.add('Roof Leak');
  }
  if (includesCheckboxValue(shared.roofSpace.defects, 'Moisture Evidence')) {
    deformation.add('Ceiling Deformation / Sagging');
    moisture.add('Roof Leak');
  }

  if (isYes(shared.siteConditions.evidenceOfWaterPooling)) {
    conducive.add('Water pooling adjacent to building');
  }
  if (shared.siteConditions.surfaceDrainage === 'Poor') {
    conducive.add('Poor surface drainage');
  }
  if (shared.siteConditions.surfaceDrainage === 'Fair') {
    conducive.add('Inadequate fall away from building');
  }
  for (const concern of checkboxItems(shared.siteConditions.siteDrainageConcerns)) {
    if ((SITE_DRAINAGE_CONCERNS as readonly string[]).includes(concern)) {
      if (concern === 'Water Pooling') conducive.add('Water pooling adjacent to building');
      if (concern === 'Poor Surface Drainage') conducive.add('Poor surface drainage');
      if (concern === 'Inadequate Fall Away From Building') conducive.add('Inadequate fall away from building');
      if (concern === 'Ponding Adjacent To Building') conducive.add('Water pooling adjacent to building');
      if (concern === 'Downpipe Discharge Issue') conducive.add('Downpipe discharge against building');
    }
  }

  if (isYes(building.kitchen.leakInsideCabinet)) {
    moisture.add('Plumbing Leak');
  }
  if (hasMoistureDamage(building.kitchen.moistureDamage)) {
    moisture.add('Plumbing Leak');
  }
  if (isYes(building.laundry.activeLeak) || isYes(building.laundry.leakage) || isYes(building.laundry.waterPooling)) {
    moisture.add('Plumbing Leak');
  }
  if (hasMoistureDamage(building.laundry.moistureDamage)) {
    moisture.add('Plumbing Leak');
  }

  if (building.moistureTesting.visualMoistureEvidence === 'Yes') {
    moisture.add('Rising Damp');
  }
  if (building.moistureTesting.excessiveMoistureEvidence === 'Yes') {
    moisture.add('Plumbing Leak');
  }

  if (input.subfloorApplicable !== false && building.subfloor) {
    const subfloorElements = checkboxItems(building.subfloor.elements);
    if (subfloorElements.includes('Moisture') || subfloorElements.includes('Drainage')) {
      conducive.add('Subfloor moisture / poor drainage');
      moisture.add('Rising Damp');
    }
  }

  for (const room of rooms) {
    const damage = normalizeCheckboxField(room.data.damageObserved as CheckboxFieldState | undefined);
    if (hasCracking(damage)) {
      if (room.roomType === 'GARAGE') structural.add('Floor');
      else structural.add('Walls');
      autoCracking.push(
        createAutoCrackingEntry(`auto-room-${room.id}`, room.label, `Cracking observed in ${room.label}.`),
      );
    }
    if (hasDeformation(damage)) {
      deformation.add(room.roomType === 'GARAGE' ? 'Floor Deflection' : 'Wall Bowing');
    }
    if (includesCheckboxValue(damage, 'Moisture Damage')) {
      moisture.add('Plumbing Leak');
    }

    if (room.roomType === 'BATHROOM') {
      if (isYes(room.data.waterPoolingPresent) || hasMoistureDamage(room.data.moistureDamage)) {
        moisture.add('Plumbing Leak');
      }
    }
  }

  const inspectorHazards = checkboxItems(shared.inspectorHazardAssessment.hazards);
  if (!isLowInspectorHazardLevel(shared.inspectorHazardAssessment) || inspectorHazards.length > 0) {
    for (const item of mapInspectorHazardsToSafety(inspectorHazards)) safety.add(item);
  }
  if (includesCheckboxValue(shared.accessibilityObstructions.inaccessibleAreas, 'Electrical hazards present')) {
    safety.add('Electrical Hazard');
  }

  const quick = collectMajorDefectQuickFindings(input);
  if (quick.labels.length > 0) {
    safety.add('Structural Hazard');
  }

  return {
    structuralMovement: [...structural],
    deformation: [...deformation],
    moistureSources: [...moisture],
    conditionsConducive: [...conducive],
    areasNotInspected: [],
    safetyHazards: [...safety],
    crackingEntries: autoCracking,
    plumbingDefectPhotos: [],
  };
}

function migrateSafetyHazardLabels(field: CheckboxFieldState): CheckboxFieldState {
  const normalized = normalizeCheckboxField(field);
  return {
    selected: normalized.selected.map((item) =>
      item === 'Asbestos Suspected' ? 'Friable Asbestos Suspected' : item,
    ),
    custom: normalized.custom.map((item) =>
      item === 'Asbestos Suspected' ? 'Friable Asbestos Suspected' : item,
    ),
  };
}

export function applyMajorDefectsRollup(
  majorDefects: MajorDefectsSection,
  input: MajorDefectRollupInput,
): MajorDefectsSection {
  const migratedMajorDefects: MajorDefectsSection = {
    ...majorDefects,
    safetyHazards: migrateSafetyHazardLabels(majorDefects.safetyHazards),
    rollupDismissed: {
      ...normalizeRollupDismissed(majorDefects.rollupDismissed),
      safetyHazards: normalizeRollupDismissed(majorDefects.rollupDismissed).safetyHazards.map(
        (item) => (item === 'Asbestos Suspected' ? 'Friable Asbestos Suspected' : item),
      ),
    },
  };

  const auto = collectMajorDefectAutoSuggestions(input);
  const dismissed = normalizeRollupDismissed(migratedMajorDefects.rollupDismissed);
  const quick = collectMajorDefectQuickFindings(input);

  let rolledComments = migratedMajorDefects.comments ?? '';
  for (const block of quick.commentBlocks) {
    rolledComments = appendUniqueCommentBlock(rolledComments, block);
  }

  const nextMajorDefects: MajorDefectsSection = {
    ...migratedMajorDefects,
    rollupDismissed: dismissed,
    comments: rolledComments,
    photos: mergeUniquePhotos(migratedMajorDefects.photos, quick.photos),
    structuralMovement: mergeAutoCheckboxPreservingManual(
      migratedMajorDefects.structuralMovement,
      auto.structuralMovement,
      dismissed.structuralMovement,
    ),
    deformation: mergeAutoCheckboxPreservingManual(
      migratedMajorDefects.deformation,
      auto.deformation,
      dismissed.deformation,
    ),
    moistureSources: mergeAutoCheckboxPreservingManual(
      migratedMajorDefects.moistureSources,
      auto.moistureSources,
      dismissed.moistureSources,
    ),
    conditionsConducive: mergeAutoCheckboxPreservingManual(
      migratedMajorDefects.conditionsConducive,
      auto.conditionsConducive,
      dismissed.conditionsConducive,
    ),
    areasNotInspected: emptyCheckboxField(),
    safetyHazards: mergeAutoCheckboxPreservingManual(
      migratedMajorDefects.safetyHazards,
      auto.safetyHazards,
      dismissed.safetyHazards,
    ),
    crackingEntries: syncCrackingEntries(
      migratedMajorDefects.crackingEntries,
      auto.crackingEntries,
      dismissed.crackingEntries,
    ),
    plumbingDefectPhotos: [],
  };

  return applyDerivedMajorDefectFields(nextMajorDefects);
}

export function createEmptyFinishElementDamageEntry(): FinishElementDamageEntry {
  return {
    id: `finish-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    elements: emptyCheckboxField(),
    location: '',
    comments: '',
    photos: [],
  };
}

export function createEmptyCrackingEntry(): CrackingEntry {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    location: '',
    crackWidth: '',
    monitoringRecommended: 'No',
    engineeringRequired: 'No',
    comments: '',
    photos: [],
  };
}
