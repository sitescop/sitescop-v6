import { emptyCheckboxField, normalizeCheckboxField } from './defaults.js';
import { isLowInspectorHazardLevel } from './hazard-assessment.js';
import { applyDerivedMajorDefectFields } from './major-defects-rules.js';
import {
  SITE_DRAINAGE_CONCERNS,
} from './options.js';
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
  };
  rooms?: MajorDefectRollupRoom[];
  subfloorApplicable?: boolean;
}


const SKIP_INACCESSIBLE = new Set(['All areas permitted entry', 'Not applicable']);

export interface MajorDefectAutoSuggestions {
  structuralMovement: string[];
  deformation: string[];
  moistureSources: string[];
  conditionsConducive: string[];
  areasNotInspected: string[];
  safetyHazards: string[];
  crackingEntries: CrackingEntry[];
  plumbingDefectPhotos: InspectionPhotoRef[];
}

export function emptyMajorDefectRollupDismissed(): MajorDefectRollupDismissed {
  return {
    structuralMovement: [],
    deformation: [],
    moistureSources: [],
    conditionsConducive: [],
    areasNotInspected: [],
    safetyHazards: [],
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
  const prevItems = checkboxItems(majorDefects[field]);
  const nextItems = checkboxItems(next);
  const dismissedSet = new Set(dismissed[field]);

  for (const item of autoItems) {
    if (prevItems.includes(item) && !nextItems.includes(item)) dismissedSet.add(item);
    if (nextItems.includes(item)) dismissedSet.delete(item);
  }

  return {
    [field]: next,
    rollupDismissed: { ...dismissed, [field]: [...dismissedSet] },
  };
}

function mergePhotoRefs(
  existing: InspectionPhotoRef[],
  incoming: InspectionPhotoRef[],
): InspectionPhotoRef[] {
  const merged = [...existing];
  const seen = new Set(existing.map((photo) => `${photo.id ?? ''}|${photo.dataUrl ?? ''}`));
  for (const photo of incoming) {
    const key = `${photo.id ?? ''}|${photo.dataUrl ?? ''}`;
    if (seen.has(key)) continue;
    merged.push(photo);
    seen.add(key);
  }
  return merged;
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
): CrackingEntry[] {
  const manual = current.filter((entry) => !entry.id.startsWith('auto-'));
  const byId = new Map(manual.map((entry) => [entry.id, entry]));
  for (const entry of autoEntries) {
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
  return [...byId.values()];
}

function mapInspectorHazardsToSafety(hazards: string[]): string[] {
  const mapped: string[] = [];
  for (const hazard of hazards) {
    const lower = hazard.toLowerCase();
    if (/asbestos/i.test(hazard)) mapped.push('Asbestos Suspected');
    else if (/electrical/i.test(hazard)) mapped.push('Electrical Hazard');
    else if (/structural|collapse|unsafe/i.test(hazard)) mapped.push('Structural Hazard');
    else if (/trip|slip|fall/i.test(hazard)) mapped.push('Trip Hazard');
    else if (/dog|animal/i.test(lower)) mapped.push('Aggressive dog / dangerous animal');
    else if (/aggressive|hostile client/i.test(lower)) mapped.push('Aggressive or hostile client');
    else mapped.push('Other');
  }
  return [...new Set(mapped)];
}

export function collectMajorDefectAutoSuggestions(input: MajorDefectRollupInput): MajorDefectAutoSuggestions {
  const { shared, building, rooms = [] } = input;
  const structural = new Set<string>();
  const deformation = new Set<string>();
  const moisture = new Set<string>();
  const conducive = new Set<string>();
  const notInspected = new Set<string>();
  const safety = new Set<string>();
  const autoCracking: CrackingEntry[] = [];
  const plumbingPhotos: InspectionPhotoRef[] = [];

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
    plumbingPhotos.push(...building.kitchen.photos);
  }
  if (hasMoistureDamage(building.kitchen.moistureDamage)) {
    moisture.add('Plumbing Leak');
    plumbingPhotos.push(...building.kitchen.photos);
  }
  if (isYes(building.laundry.activeLeak) || isYes(building.laundry.leakage) || isYes(building.laundry.waterPooling)) {
    moisture.add('Plumbing Leak');
    plumbingPhotos.push(...building.laundry.photos, ...building.laundry.waterPoolingPhotos);
  }
  if (hasMoistureDamage(building.laundry.moistureDamage)) {
    moisture.add('Plumbing Leak');
    plumbingPhotos.push(...building.laundry.photos, ...building.laundry.waterPoolingPhotos);
  }

  if (building.moistureTesting.visualMoistureEvidence === 'Yes') {
    moisture.add('Rising Damp');
  }
  if (building.moistureTesting.excessiveMoistureEvidence === 'Yes') {
    moisture.add('Plumbing Leak');
    plumbingPhotos.push(...building.moistureTesting.moistureMeterPhotos);
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
      const bathPhotos = [
        ...(Array.isArray(room.data.waterPoolingPhotos) ? (room.data.waterPoolingPhotos as InspectionPhotoRef[]) : []),
        ...(Array.isArray(room.data.moistureEvidencePhotos) ? (room.data.moistureEvidencePhotos as InspectionPhotoRef[]) : []),
        ...(Array.isArray(room.data.waterEscapingPhotos) ? (room.data.waterEscapingPhotos as InspectionPhotoRef[]) : []),
        ...(Array.isArray(room.data.photos) ? (room.data.photos as InspectionPhotoRef[]) : []),
      ];
      if (bathPhotos.length) plumbingPhotos.push(...bathPhotos);
    }

    const accessAvailable = String(room.data.accessAvailable ?? 'Yes');
    if (accessAvailable === 'No') {
      const reason = String(room.data.noAccessReason ?? '').trim();
      notInspected.add(reason ? `${room.label} — ${reason}` : room.label);
    }
  }

  for (const area of checkboxItems(shared.accessibilityObstructions.inaccessibleAreas)) {
    if (!SKIP_INACCESSIBLE.has(area)) notInspected.add(area);
  }
  for (const line of shared.accessibilityObstructions.inaccessibleCustomLines ?? []) {
    const text = line.trim();
    if (text) notInspected.add(text);
  }

  const inspectorHazards = checkboxItems(shared.inspectorHazardAssessment.hazards);
  if (!isLowInspectorHazardLevel(shared.inspectorHazardAssessment) || inspectorHazards.length > 0) {
    for (const item of mapInspectorHazardsToSafety(inspectorHazards)) safety.add(item);
  }
  if (includesCheckboxValue(shared.accessibilityObstructions.inaccessibleAreas, 'Electrical hazards present')) {
    safety.add('Electrical Hazard');
  }

  return {
    structuralMovement: [...structural],
    deformation: [...deformation],
    moistureSources: [...moisture],
    conditionsConducive: [...conducive],
    areasNotInspected: [...notInspected],
    safetyHazards: [...safety],
    crackingEntries: autoCracking,
    plumbingDefectPhotos: mergePhotoRefs([], plumbingPhotos),
  };
}

export function applyMajorDefectsRollup(
  majorDefects: MajorDefectsSection,
  input: MajorDefectRollupInput,
): MajorDefectsSection {
  const auto = collectMajorDefectAutoSuggestions(input);
  const dismissed = normalizeRollupDismissed(majorDefects.rollupDismissed);

  const nextMajorDefects: MajorDefectsSection = {
    ...majorDefects,
    rollupDismissed: dismissed,
    structuralMovement: mergeAutoCheckboxPreservingManual(
      majorDefects.structuralMovement,
      auto.structuralMovement,
      dismissed.structuralMovement,
    ),
    deformation: mergeAutoCheckboxPreservingManual(
      majorDefects.deformation,
      auto.deformation,
      dismissed.deformation,
    ),
    moistureSources: mergeAutoCheckboxPreservingManual(
      majorDefects.moistureSources,
      auto.moistureSources,
      dismissed.moistureSources,
    ),
    conditionsConducive: mergeAutoCheckboxPreservingManual(
      majorDefects.conditionsConducive,
      auto.conditionsConducive,
      dismissed.conditionsConducive,
    ),
    areasNotInspected: mergeAutoCheckboxPreservingManual(
      majorDefects.areasNotInspected,
      auto.areasNotInspected,
      dismissed.areasNotInspected,
    ),
    safetyHazards: mergeAutoCheckboxPreservingManual(
      majorDefects.safetyHazards,
      auto.safetyHazards,
      dismissed.safetyHazards,
    ),
    crackingEntries: syncCrackingEntries(majorDefects.crackingEntries, auto.crackingEntries),
    plumbingDefectPhotos: mergePhotoRefs(majorDefects.plumbingDefectPhotos, auto.plumbingDefectPhotos),
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
