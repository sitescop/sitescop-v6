import type {
  AccessibilityObstructionsSection,
  BuildingInspectionFormData,
  ExternalSection,
  InspectorDeclarationSection,
  InspectorHazardAssessmentSection,
  JobInformationSection,
  KitchenSection,
  LaundrySection,
  ElectricalGeneralSection,
  PropertyDescriptionSection,
  RoofExteriorSection,
  RoofSpaceSection,
  ServicesSection,
  SiteConditionsSection,
  ConclusionSection,
  RecommendationsSection,
  SubfloorSection,
  FencingSection,
  OutbuildingsSection,
  CorrosionSection,
  MinorDefectsSection,
  MajorDefectsSection,
  ThermalImagingSection,
  MoistureTestingSection,
  RiskAssessmentSection,
  PrefillJobContext,
  InspectionPhotoRef,
} from './types.js';
import type { PestInspectionSections } from './pest-types.js';
import { createEmptyFormData, normalizeAccessibilityAreas, normalizeCheckboxField, mergeSectionRecord, applyRoomElectricalDefaults, applySharedInspectionDefaults, defaultElectricalDisclaimersField, defaultKitchenDisclaimersField, defaultLaundryDisclaimersField, defaultIfEmptyWorkingStatus, defaultSwitchesStatus, applyLaundrySurfaceDefaults } from './defaults.js';
import {
  DEFAULT_INCOMPLETE_CONSTRUCTION,
  DEFAULT_OCCUPANCY_STATUS,
  DEFAULT_WEATHER_CONDITIONS,
} from './options.js';
import { createEmptyPestSections, applyPestSectionDefaults } from './pest-defaults.js';
import { applyAccessibilityRiskAssessment } from './risk-assessment.js';
import { applyInspectorHazardAssessment, createEmptyInspectorHazardAssessment } from './hazard-assessment.js';
import {
  applyConclusionUpdates,
  generateAutoRecommendations,
} from './conclusion.js';
import { applyPestConclusionUpdates, applyPestSectionUpdates, enrichPestConclusion } from './pest-conclusion.js';
import { applyMajorDefectsRollup, type MajorDefectRollupRoom } from './major-defects-rollup.js';
import { isSubfloorApplicable, resolveSubfloorPresent } from './property-profile.js';

export const INSPECTION_FORM_VERSION = 2 as const;

export interface InspectionEnrichmentOptions {
  rooms?: MajorDefectRollupRoom[];
  /** Keep accessibility comment photos exactly as stored while editing; strip only on load/save. */
  preserveAccessibilityPhotos?: boolean;
}

/** Shared by building, pest, and combined — Job Information through Roof Space (kitchen excluded). */
export interface SharedInspectionSections {
  inspectorHazardAssessment: InspectorHazardAssessmentSection;
  jobInformation: JobInformationSection;
  services: ServicesSection;
  propertyDescription: PropertyDescriptionSection;
  accessibilityObstructions: AccessibilityObstructionsSection;
  siteConditions: SiteConditionsSection;
  external: ExternalSection;
  roofExterior: RoofExteriorSection;
  roofSpace: RoofSpaceSection;
}

export type SharedInspectionSectionKey = keyof SharedInspectionSections;

export const SHARED_INSPECTION_SECTION_KEYS: SharedInspectionSectionKey[] = [
  'jobInformation',
  'services',
  'propertyDescription',
  'accessibilityObstructions',
  'siteConditions',
  'external',
  'roofExterior',
  'roofSpace',
];

/** Shared sections that can be patched via API (includes hazard, rendered separately in UI/PDF). */
export const SHARED_INSPECTION_PATCH_KEYS: SharedInspectionSectionKey[] = [
  ...SHARED_INSPECTION_SECTION_KEYS,
  'inspectorHazardAssessment',
];

export const SHARED_INSPECTION_SECTION_LABELS: Record<SharedInspectionSectionKey, string> = {
  jobInformation: 'Job Information',
  services: 'Services',
  propertyDescription: 'Property Description',
  accessibilityObstructions: 'Accessibility',
  inspectorHazardAssessment: 'Inspector Hazard Assessment',
  siteConditions: 'Site Conditions',
  external: 'External',
  roofExterior: 'Roof Exterior',
  roofSpace: 'Roof Space',
};

/** Building-only sections from Kitchen onward. */
export interface BuildingExtensionSections {
  kitchen: KitchenSection;
  laundry: LaundrySection;
  electricalGeneral: ElectricalGeneralSection;
  subfloor: SubfloorSection;
  fencing: FencingSection;
  outbuildings: OutbuildingsSection;
  corrosion: CorrosionSection;
  minorDefects: MinorDefectsSection;
  majorDefects: MajorDefectsSection;
  thermalImaging: ThermalImagingSection;
  moistureTesting: MoistureTestingSection;
  riskAssessment: RiskAssessmentSection;
  conclusion: ConclusionSection;
  recommendations: RecommendationsSection;
  inspectorDeclaration: InspectorDeclarationSection;
}

export type BuildingExtensionSectionKey = keyof BuildingExtensionSections;

export const BUILDING_EXTENSION_SECTION_KEYS: BuildingExtensionSectionKey[] = [
  'kitchen',
  'laundry',
  'electricalGeneral',
  'subfloor',
  'fencing',
  'outbuildings',
  'corrosion',
  'minorDefects',
  'majorDefects',
  'thermalImaging',
  'moistureTesting',
  'riskAssessment',
  'conclusion',
  'recommendations',
  'inspectorDeclaration',
];

export const BUILDING_EXTENSION_SECTION_LABELS: Record<BuildingExtensionSectionKey, string> = {
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  electricalGeneral: 'General Electrical Disclaimer',
  subfloor: 'Subfloor',
  fencing: 'Fencing',
  outbuildings: 'Outbuildings',
  corrosion: 'Corrosion',
  minorDefects: 'Minor Defects',
  majorDefects: 'Major Defects',
  thermalImaging: 'Thermal Imaging',
  moistureTesting: 'Moisture & Thermal Testing',
  riskAssessment: 'Risk Assessment',
  conclusion: 'Conclusion',
  recommendations: 'Recommendations',
  inspectorDeclaration: 'Certification',
};

export type InspectionFormRealm = 'shared' | 'building' | 'pest';

export interface InspectionFormDataV2 {
  version: typeof INSPECTION_FORM_VERSION;
  shared: SharedInspectionSections;
  building?: BuildingExtensionSections;
  pest?: PestInspectionSections;
}

export type InspectionJobFormKind = 'BUILDING' | 'PEST' | 'COMBINED';

function splitLegacyBuildingFormData(legacy: BuildingInspectionFormData): InspectionFormDataV2 {
  const {
    jobInformation,
    services,
    propertyDescription,
    accessibilityObstructions,
    siteConditions,
    external,
    roofExterior,
    roofSpace,
    ...buildingRest
  } = legacy;

  return {
    version: INSPECTION_FORM_VERSION,
    shared: withSharedDefaults({
      jobInformation,
      services,
      propertyDescription,
      accessibilityObstructions,
      siteConditions,
      external,
      roofExterior,
      roofSpace,
    }),
    building: buildingRest as BuildingExtensionSections,
  };
}

function extractSharedFromLegacy(legacy: BuildingInspectionFormData): SharedInspectionSections {
  return splitLegacyBuildingFormData(legacy).shared;
}

function isSectionObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mergeSharedSection(
  key: SharedInspectionSectionKey,
  raw: Record<string, unknown>,
  shared: Partial<SharedInspectionSections> | undefined,
  template: SharedInspectionSections,
) {
  const partial: Record<string, unknown> = {};
  if (isSectionObject(raw[key])) Object.assign(partial, raw[key]);
  if (isSectionObject(shared?.[key])) Object.assign(partial, shared[key]);
  return mergeSectionRecord(template[key] as unknown as Record<string, unknown>, partial);
}

/** Merge v2 shared sections with any legacy root-level section objects still on the JSON blob. */
function coalesceSharedSections(
  raw: Record<string, unknown>,
  shared: Partial<SharedInspectionSections> | undefined,
  template: SharedInspectionSections,
): SharedInspectionSections {
  const merged = Object.fromEntries(
    SHARED_INSPECTION_SECTION_KEYS.map((key) => [key, mergeSharedSection(key, raw, shared, template)]),
  );
  return {
    ...merged,
    inspectorHazardAssessment: mergeSharedSection(
      'inspectorHazardAssessment',
      raw,
      shared,
      template,
    ),
  } as unknown as SharedInspectionSections;
}

/** Merge v2 building sections with any legacy root-level building section objects. */
function coalesceBuildingSections(
  raw: Record<string, unknown>,
  building: Partial<BuildingExtensionSections> | undefined,
  template: BuildingExtensionSections,
): BuildingExtensionSections {
  const merged = Object.fromEntries(
    BUILDING_EXTENSION_SECTION_KEYS.map((key) => {
      const partial: Record<string, unknown> = {};
      if (isSectionObject(raw[key])) Object.assign(partial, raw[key]);
      if (isSectionObject(building?.[key])) Object.assign(partial, building[key]);
      return [
        key,
        mergeSectionRecord(template[key] as unknown as Record<string, unknown>, partial),
      ];
    }),
  ) as unknown as BuildingExtensionSections;
  return mergeThermalImagingIntoMoistureTesting(merged);
}

function mergeThermalImagingIntoMoistureTesting(
  building: BuildingExtensionSections,
): BuildingExtensionSections {
  const thermal = building.thermalImaging;
  const moisture = building.moistureTesting;
  const hasThermalData =
    Boolean(thermal.comments?.trim()) ||
    (Array.isArray(thermal.photos) && thermal.photos.length > 0);
  if (!hasThermalData) return building;

  const mergedComments = [moisture.comments?.trim(), thermal.comments?.trim()]
    .filter(Boolean)
    .join('\n\n');

  return {
    ...building,
    moistureTesting: {
      ...moisture,
      comments: mergedComments || moisture.comments,
      thermalImages: mergePhotoRefs(moisture.thermalImages, thermal.photos ?? []),
    },
    thermalImaging: { comments: '', photos: [] },
  };
}

function migrateLegacyJobInformationFields(
  form: InspectionFormDataV2,
  raw?: Record<string, unknown>,
): InspectionFormDataV2 {
  const job = { ...form.shared.jobInformation };
  const site = form.shared.siteConditions as SiteConditionsSection & { weatherPrevailing?: string };
  const sharedRaw = (raw?.shared ?? form.shared) as Record<string, unknown> | undefined;
  const legacyIncomplete = (sharedRaw?.incompleteConstruction ?? raw?.incompleteConstruction) as
    | { evidenceFinding?: string }
    | undefined;

  const LEGACY_INCOMPLETE_CONSTRUCTION: Record<string, string> = {
    'Evidence found — minor': 'Incomplete construction observed',
    'Evidence found — moderate': 'Renovations incomplete',
    'Evidence found — significant': 'Building works in progress',
  };

  if (!job.weatherConditions?.trim()) {
    job.weatherConditions = site.weatherPrevailing?.trim() || DEFAULT_WEATHER_CONDITIONS;
  }
  if (!job.occupancyStatus?.trim()) {
    job.occupancyStatus = DEFAULT_OCCUPANCY_STATUS;
  }
  if (!job.incompleteConstruction?.trim()) {
    job.incompleteConstruction = legacyIncomplete?.evidenceFinding?.trim() || DEFAULT_INCOMPLETE_CONSTRUCTION;
  }
  if (LEGACY_INCOMPLETE_CONSTRUCTION[job.incompleteConstruction]) {
    job.incompleteConstruction = LEGACY_INCOMPLETE_CONSTRUCTION[job.incompleteConstruction]!;
  }
  if (!Array.isArray(job.incompleteConstructionPhotos)) {
    job.incompleteConstructionPhotos = [];
  }
  if (typeof job.agentPhone !== 'string') {
    job.agentPhone = '';
  }

  return {
    ...form,
    shared: {
      ...form.shared,
      jobInformation: job,
    },
  };
}

export interface JobOrderingPartyContext {
  orderingPartyType?: string;
  realEstate?: string;
  clientName?: string;
  clientEmail?: string;
  clientMobile?: string;
  agentName?: string;
  agentPhone?: string;
  agentMobile?: string;
  agentEmail?: string;
}

function trimField(value: string | undefined | null): string {
  return value?.trim() ?? '';
}

/** Prefer the job's purchaser contact when the form still blank or mirrors agent details. */
function shouldUseJobClientValue(
  formClientValue: string | undefined,
  formAgentValue: string | undefined,
  jobClientValue: string | undefined,
): boolean {
  const formClient = trimField(formClientValue);
  const formAgent = trimField(formAgentValue);
  const jobClient = trimField(jobClientValue);
  if (!jobClient) return false;
  if (!formClient) return true;
  if (formAgent && formClient === formAgent && formClient !== jobClient) return true;
  return false;
}

/** Prefer the job's agent contact when the form is still blank or mirrors purchaser details. */
function shouldUseJobAgentValue(
  formAgentValue: string | undefined,
  formClientValue: string | undefined,
  jobAgentValue: string | undefined,
): boolean {
  const formAgent = trimField(formAgentValue);
  const formClient = trimField(formClientValue);
  const jobAgent = trimField(jobAgentValue);
  if (!jobAgent) return false;
  if (!formAgent) return true;
  if (formClient && formAgent === formClient && formAgent !== jobAgent) return true;
  return false;
}

/** Fill Job Information client and ordering-party fields from the job record when appropriate. */
export function mergeJobContextIntoJobInformation(
  form: InspectionFormDataV2,
  context: JobOrderingPartyContext,
): InspectionFormDataV2 {
  const jobInfo = form.shared.jobInformation;
  const patch: Partial<JobInformationSection> = {};

  if (shouldUseJobClientValue(jobInfo.clientName, jobInfo.agentName, context.clientName)) {
    patch.clientName = trimField(context.clientName);
  }
  if (shouldUseJobClientValue(jobInfo.clientMobile, jobInfo.agentMobile, context.clientMobile)) {
    patch.clientMobile = trimField(context.clientMobile);
  }
  if (shouldUseJobClientValue(jobInfo.clientEmail, jobInfo.agentEmail, context.clientEmail)) {
    patch.clientEmail = trimField(context.clientEmail);
  }

  if (context.realEstate?.trim() && !jobInfo.agencyName?.trim()) {
    patch.agencyName = context.realEstate.trim();
  }
  if (shouldUseJobAgentValue(jobInfo.agentName, jobInfo.clientName, context.agentName)) {
    patch.agentName = trimField(context.agentName);
  }
  if (shouldUseJobAgentValue(jobInfo.agentPhone, jobInfo.clientMobile, context.agentPhone)) {
    patch.agentPhone = trimField(context.agentPhone);
  }
  if (shouldUseJobAgentValue(jobInfo.agentMobile, jobInfo.clientMobile, context.agentMobile)) {
    patch.agentMobile = trimField(context.agentMobile);
  } else if (
    !trimField(jobInfo.agentMobile) &&
    !trimField(context.agentMobile) &&
    shouldUseJobAgentValue(jobInfo.agentMobile, jobInfo.clientMobile, context.agentPhone)
  ) {
    // Legacy jobs that only stored landline under agent phone — keep mobile usable.
    patch.agentMobile = trimField(context.agentPhone);
  }
  if (shouldUseJobAgentValue(jobInfo.agentEmail, jobInfo.clientEmail, context.agentEmail)) {
    patch.agentEmail = trimField(context.agentEmail);
  }

  if (Object.keys(patch).length === 0) return form;

  return {
    ...form,
    shared: {
      ...form.shared,
      jobInformation: { ...jobInfo, ...patch },
    },
  };
}

function finalizeNormalizedForm(
  form: InspectionFormDataV2,
  jobFormKind: InspectionJobFormKind,
  raw?: Record<string, unknown>,
): InspectionFormDataV2 {
  return migrateLegacyJobInformationFields(mergeInspectionFormWithDefaults(form, jobFormKind), raw);
}

export function normalizeInspectionFormData(
  raw: unknown,
  jobFormKind: InspectionJobFormKind = 'BUILDING',
): InspectionFormDataV2 {
  const template = createEmptyInspectionFormData(jobFormKind);

  if (raw && typeof raw === 'object' && (raw as InspectionFormDataV2).version === INSPECTION_FORM_VERSION) {
    const v2 = raw as InspectionFormDataV2 & Record<string, unknown>;
    const shared = coalesceSharedSections(v2, v2.shared, template.shared);

    const building =
      jobFormKind !== 'PEST' && template.building
        ? coalesceBuildingSections(v2, v2.building, template.building)
        : undefined;

    const pest =
      jobFormKind === 'PEST' || jobFormKind === 'COMBINED'
        ? v2.pest
          ? applyPestSectionDefaults(v2.pest)
          : template.pest
        : undefined;

    return finalizeNormalizedForm(
      {
        version: INSPECTION_FORM_VERSION,
        shared,
        building,
        pest,
      },
      jobFormKind,
      v2,
    );
  }

  const legacy = raw as BuildingInspectionFormData;
  if (legacy?.jobInformation) {
    const migrated = splitLegacyBuildingFormData(legacy);
    if (jobFormKind === 'PEST') {
      return finalizeNormalizedForm(
        {
          version: INSPECTION_FORM_VERSION,
          shared: migrated.shared,
          pest: createEmptyPestSections(),
        },
        jobFormKind,
      );
    }
    if (jobFormKind === 'COMBINED') {
      return finalizeNormalizedForm(
        {
          version: INSPECTION_FORM_VERSION,
          shared: migrated.shared,
          building: migrated.building,
          pest: createEmptyPestSections(),
        },
        jobFormKind,
      );
    }
    return finalizeNormalizedForm(migrated, jobFormKind);
  }

  return template;
}

function withSharedDefaults(
  shared: Omit<SharedInspectionSections, 'inspectorHazardAssessment'> &
    Partial<Pick<SharedInspectionSections, 'inspectorHazardAssessment'>>,
): SharedInspectionSections {
  return {
    ...shared,
    inspectorHazardAssessment:
      shared.inspectorHazardAssessment ?? createEmptyInspectorHazardAssessment(),
  };
}

function includesCheckboxValue(
  field: { selected?: string[]; custom?: string[] } | undefined,
  value: string,
): boolean {
  const target = value.trim().toLowerCase();
  if (!target) return false;
  return [...(field?.selected ?? []), ...(field?.custom ?? [])].some(
    (item) => item.trim().toLowerCase() === target,
  );
}

function setObstructionItem(
  field: { selected: string[]; custom: string[] },
  item: string,
  enabled: boolean,
): { selected: string[]; custom: string[] } {
  const selected = field.selected.filter((entry) => entry !== item);
  const custom = field.custom.filter((entry) => entry !== item);
  if (enabled) selected.push(item);
  return { selected: [...new Set(selected)], custom: [...new Set(custom)] };
}

function mergePhotoRefs(
  existing: InspectionPhotoRef[],
  incoming: InspectionPhotoRef[],
): InspectionPhotoRef[] {
  const merged = [...existing];
  const seen = new Set(
    existing.map((photo) => `${photo.id ?? ''}|${photo.dataUrl ?? ''}`),
  );
  for (const photo of incoming) {
    const key = `${photo.id ?? ''}|${photo.dataUrl ?? ''}`;
    if (seen.has(key)) continue;
    merged.push(photo);
    seen.add(key);
  }
  return merged;
}

function hasLpgGasSelected(services: SharedInspectionSections['services']): boolean {
  const gasField = services.gas;
  const hasOption = includesCheckboxValue(gasField, 'LPG');
  const hasOther = services.gasOther.trim().toLowerCase().includes('lpg');
  return hasOption || hasOther;
}

/** Service photos that can be mirrored into obstruction photo fields. */
function collectMirrorableServicePhotos(services: ServicesSection): InspectionPhotoRef[] {
  return [
    ...(services.airConPhotos ?? []),
    ...(services.hotWaterPhotos ?? []),
    ...(services.gasBottlePhotos ?? []),
    ...(services.rainwaterTankPhotos ?? []),
  ];
}

function collectExteriorServiceObstructionPhotos(services: ServicesSection): InspectionPhotoRef[] {
  const photos: InspectionPhotoRef[] = [];
  if (services.airConPresent === 'Yes') {
    photos.push(...(services.airConPhotos ?? []));
  }
  if (services.hotWaterPresent === 'Yes' && services.hotWaterLocation !== 'Internal') {
    photos.push(...(services.hotWaterPhotos ?? []));
  }
  if (hasLpgGasSelected(services)) {
    photos.push(...(services.gasBottlePhotos ?? []));
  }
  if (services.rainwaterTankPresent === 'Yes') {
    photos.push(...(services.rainwaterTankPhotos ?? []));
  }
  return photos;
}

function collectInteriorServiceObstructionPhotos(services: ServicesSection): InspectionPhotoRef[] {
  if (services.hotWaterPresent === 'Yes' && services.hotWaterLocation === 'Internal') {
    return [...(services.hotWaterPhotos ?? [])];
  }
  return [];
}

function syncObstructionPhotosWithServices(
  existing: InspectionPhotoRef[] | undefined,
  linked: InspectionPhotoRef[],
  mirrorable: InspectionPhotoRef[],
): InspectionPhotoRef[] {
  const stripped = stripPhotosByKeys(existing ?? [], mirrorable);
  return mergePhotoRefs(stripped, linked);
}

function stripPhotosByKeys(
  photos: InspectionPhotoRef[],
  remove: InspectionPhotoRef[],
): InspectionPhotoRef[] {
  const removeKeys = new Set(remove.map(photoRefKey));
  if (removeKeys.size === 0) return photos;
  return photos.filter((photo) => !removeKeys.has(photoRefKey(photo)));
}

function syncServiceObstructions(shared: SharedInspectionSections): SharedInspectionSections {
  const accessibility = { ...shared.accessibilityObstructions };
  const services = shared.services;
  const hotWaterExternal = services.hotWaterPresent === 'Yes' && services.hotWaterLocation !== 'Internal';
  const hotWaterInternal = services.hotWaterPresent === 'Yes' && services.hotWaterLocation === 'Internal';
  const hasLpg = hasLpgGasSelected(services);
  const mirrorable = collectMirrorableServicePhotos(services);

  const exterior = setObstructionItem(
    setObstructionItem(
      setObstructionItem(
        setObstructionItem(
          normalizeCheckboxField(accessibility.exteriorObstructions),
          'Air conditioning',
          services.airConPresent === 'Yes',
        ),
        'Hot water service',
        hotWaterExternal,
      ),
      'Gas storage cylinders',
      hasLpg,
    ),
    'Rainwater tank',
    services.rainwaterTankPresent === 'Yes',
  );

  const interior = setObstructionItem(
    normalizeCheckboxField(accessibility.interiorObstructions),
    'Hot water service',
    hotWaterInternal,
  );

  return {
    ...shared,
    accessibilityObstructions: {
      ...accessibility,
      interiorObstructions: interior,
      exteriorObstructions: exterior,
      interiorObstructionPhotos: syncObstructionPhotosWithServices(
        accessibility.interiorObstructionPhotos,
        collectInteriorServiceObstructionPhotos(services),
        mirrorable,
      ),
      exteriorObstructionPhotos: syncObstructionPhotosWithServices(
        accessibility.exteriorObstructionPhotos,
        collectExteriorServiceObstructionPhotos(services),
        mirrorable,
      ),
    },
  };
}

export function hasLinkedServiceObstructionPhotos(services: ServicesSection): boolean {
  return (
    services.airConPresent === 'Yes' ||
    services.hotWaterPresent === 'Yes' ||
    services.rainwaterTankPresent === 'Yes' ||
    hasLpgGasSelected(services)
  );
}

export function collectLinkedServiceObstructionPhotos(services: ServicesSection): InspectionPhotoRef[] {
  if (!hasLinkedServiceObstructionPhotos(services)) return [];
  return [
    ...services.photos,
    ...(services.waterSupplyPhotos ?? []),
    ...(services.sewerPhotos ?? []),
    ...(services.electricityPhotos ?? []),
    ...(services.gasPhotos ?? []),
    ...services.hotWaterPhotos,
    ...(services.airConPhotos ?? []),
    ...services.gasBottlePhotos,
    ...services.rainwaterTankPhotos,
  ];
}

function photoRefKey(photo: InspectionPhotoRef): string {
  return `${photo.id ?? ''}|${photo.dataUrl ?? ''}`;
}

/** Removes service-section photos that were previously auto-merged into accessibility comments. */
export function stripLinkedServicePhotosFromAccessibility(
  photos: InspectionPhotoRef[] | undefined,
  services: ServicesSection,
): InspectionPhotoRef[] {
  const linkedKeys = new Set(collectLinkedServiceObstructionPhotos(services).map(photoRefKey));
  if (linkedKeys.size === 0) return photos ?? [];
  return (photos ?? []).filter((photo) => !linkedKeys.has(photoRefKey(photo)));
}

export function createEmptyInspectionFormData(
  jobFormKind: InspectionJobFormKind,
  prefill?: PrefillJobContext,
): InspectionFormDataV2 {
  const legacy = createEmptyFormData(prefill);
  const { shared, building } = splitLegacyBuildingFormData(legacy);
  const sharedWithHazard = withSharedDefaults(shared);

  if (jobFormKind === 'PEST') {
    return {
      version: INSPECTION_FORM_VERSION,
      shared: sharedWithHazard,
      pest: createEmptyPestSections(prefill),
    };
  }

  if (jobFormKind === 'COMBINED') {
    return {
      version: INSPECTION_FORM_VERSION,
      shared: sharedWithHazard,
      building,
      pest: createEmptyPestSections(prefill),
    };
  }

  return {
    version: INSPECTION_FORM_VERSION,
    shared: sharedWithHazard,
    building,
  };
}

export function jobTypeToFormKind(jobType: string): InspectionJobFormKind {
  if (jobType === 'PEST') return 'PEST';
  if (jobType === 'COMBINED') return 'COMBINED';
  return 'BUILDING';
}

export function flattenToLegacyBuildingFormData(form: InspectionFormDataV2): BuildingInspectionFormData {
  if (!form.building) {
    throw new Error('Building extension data is required to flatten legacy building form');
  }
  return {
    ...form.shared,
    ...form.building,
  };
}

/** Building auto-enrichment using flattened legacy shape for existing generators. */
export function enrichBuildingExtension(
  building: BuildingExtensionSections,
  shared: SharedInspectionSections,
  rooms?: MajorDefectRollupRoom[],
): BuildingExtensionSections {
  const subfloorPresent = resolveSubfloorPresent(
    shared.propertyDescription,
    building.subfloor,
    shared.accessibilityObstructions,
  );
  const subfloorApplicable = isSubfloorApplicable(subfloorPresent);
  const majorDefects = applyMajorDefectsRollup(building.majorDefects, {
    shared,
    building,
    rooms,
    subfloorApplicable,
  });
  const flat = { ...shared, ...building, majorDefects } as BuildingInspectionFormData;
  const enriched = {
    ...building,
    majorDefects,
    conclusion: applyConclusionUpdates(building.conclusion, majorDefects),
    recommendations: {
      ...building.recommendations,
      autoRecommendations: generateAutoRecommendations(flat),
    },
  };
  return applyBuildingElectricalDefaults(enriched);
}

function applyBuildingElectricalDefaults(building: BuildingExtensionSections): BuildingExtensionSections {
  return {
    ...building,
    kitchen: {
      ...building.kitchen,
      lights: defaultIfEmptyWorkingStatus(building.kitchen.lights),
      switches: defaultSwitchesStatus(),
      powerPoints: defaultIfEmptyWorkingStatus(building.kitchen.powerPoints),
      disclaimers: defaultKitchenDisclaimersField(),
    },
    laundry: applyLaundrySurfaceDefaults({
      ...building.laundry,
      lights: defaultIfEmptyWorkingStatus(building.laundry.lights),
      switches: defaultSwitchesStatus(),
      powerPoints: defaultIfEmptyWorkingStatus(building.laundry.powerPoints),
      handle: building.laundry.handle || (building.laundry as { lockLatch?: string }).lockLatch || '',
      disclaimers: defaultLaundryDisclaimersField(),
    }),
    electricalGeneral: {
      ...building.electricalGeneral,
      disclaimers: defaultElectricalDisclaimersField(),
    },
  };
}

export function enrichSharedSections(
  shared: SharedInspectionSections,
  options: { preserveAccessibilityPhotos?: boolean } = {},
): SharedInspectionSections {
  const sharedDefaults = applySharedInspectionDefaults(shared);
  const synced = syncServiceObstructions({
    ...shared,
    services: sharedDefaults.services,
    accessibilityObstructions: sharedDefaults.accessibilityObstructions,
  });
  const accessibility = { ...synced.accessibilityObstructions };
  const noteLines = [...(accessibility.inaccessibleCustomLines ?? [''])];
  while (noteLines.length < 1) noteLines.push('');

  for (const custom of accessibility.inaccessibleAreas?.custom ?? []) {
    const text = custom.trim();
    if (!text) continue;
    if (noteLines.some((line) => line.trim() === text)) continue;
    const emptyIndex = noteLines.findIndex((line) => !line.trim());
    if (emptyIndex >= 0) noteLines[emptyIndex] = text;
  }

  const accessibilityPhotos = options.preserveAccessibilityPhotos
    ? (accessibility.photos ?? [])
    : stripLinkedServicePhotosFromAccessibility(accessibility.photos, synced.services);

  return {
    ...synced,
    accessibilityObstructions: applyAccessibilityRiskAssessment({
      ...accessibility,
      photos: accessibilityPhotos,
      inaccessibleCustomLines: noteLines.slice(0, 1),
      accessibilityAreas: normalizeAccessibilityAreas(accessibility.accessibilityAreas),
    }),
    inspectorHazardAssessment: applyInspectorHazardAssessment(
      shared.inspectorHazardAssessment ?? createEmptyInspectorHazardAssessment(),
    ),
  };
}

export function enrichInspectionFormData(
  form: InspectionFormDataV2,
  options?: InspectionEnrichmentOptions,
): InspectionFormDataV2 {
  const sharedBase = {
    ...form.shared,
    inspectorHazardAssessment:
      form.shared?.inspectorHazardAssessment ??
      createEmptyInspectorHazardAssessment(),
  };
  if (
    form.building?.riskAssessment?.level?.trim() &&
    sharedBase.inspectorHazardAssessment.overallLevel === 'Low'
  ) {
    const selectedHazards = [
      ...(sharedBase.inspectorHazardAssessment.hazards?.selected ?? []),
      ...(sharedBase.inspectorHazardAssessment.hazards?.custom ?? []),
    ].filter(Boolean);
    if (selectedHazards.length === 0) {
      sharedBase.inspectorHazardAssessment = {
        ...sharedBase.inspectorHazardAssessment,
        overallLevel: form.building.riskAssessment.level,
      };
    }
  }
  const shared = enrichSharedSections(sharedBase, {
    preserveAccessibilityPhotos: options?.preserveAccessibilityPhotos,
  });
  const building = form.building ? enrichBuildingExtension(form.building, shared, options?.rooms) : undefined;
  const subfloorPresent = resolveSubfloorPresent(
    shared.propertyDescription,
    building?.subfloor,
    shared.accessibilityObstructions,
  );
  const subfloorApplicable = isSubfloorApplicable(subfloorPresent);
  let pest = form.pest
    ? applyPestSectionUpdates(form.pest, shared.accessibilityObstructions, shared.services, {
        subfloorApplicable,
      })
    : undefined;
  if (pest) {
    pest = applyPestConclusionUpdates(pest, building);
    pest = enrichPestConclusion(pest, { building });
  }
  return {
    version: INSPECTION_FORM_VERSION,
    shared,
    building,
    pest,
  };
}

export function calculateInspectionProgress(form: InspectionFormDataV2): number {
  let filled = 0;
  let total = 0;

  const walk = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      total += 1;
      if (value.trim()) filled += 1;
      return;
    }
    if (typeof value === 'number') {
      total += 1;
      if (value > 0) filled += 1;
      return;
    }
    if (typeof value === 'boolean') {
      total += 1;
      if (value) filled += 1;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        total += 1;
        return;
      }
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(form.shared);
  if (form.building) walk(form.building);
  if (form.pest) walk(form.pest);

  if (total === 0) return 0;
  return Math.min(100, Math.round((filled / total) * 100));
}

export function getSectionData(
  form: InspectionFormDataV2,
  realm: InspectionFormRealm,
  section: string,
): Record<string, unknown> | undefined {
  if (realm === 'shared') {
    return form.shared[section as SharedInspectionSectionKey] as unknown as Record<string, unknown>;
  }
  if (realm === 'building' && form.building) {
    return form.building[section as BuildingExtensionSectionKey] as unknown as Record<string, unknown>;
  }
  if (realm === 'pest' && form.pest) {
    return form.pest[section as keyof PestInspectionSections] as unknown as Record<string, unknown>;
  }
  return undefined;
}

export function patchSectionData(
  form: InspectionFormDataV2,
  realm: InspectionFormRealm,
  section: string,
  partial: Record<string, unknown>,
): InspectionFormDataV2 {
  if (realm === 'shared') {
    const key = section as SharedInspectionSectionKey;
    return {
      ...form,
      shared: {
        ...form.shared,
        [key]: { ...(form.shared[key] as object), ...partial },
      },
    };
  }
  if (realm === 'building' && form.building) {
    const key = section as BuildingExtensionSectionKey;
    return {
      ...form,
      building: {
        ...form.building,
        [key]: { ...(form.building[key] as object), ...partial },
      },
    };
  }
  if (realm === 'pest' && form.pest) {
    const key = section as keyof PestInspectionSections;
    return {
      ...form,
      pest: {
        ...form.pest,
        [key]: { ...(form.pest[key] as object), ...partial },
      },
    };
  }
  return form;
}

/** Property description lives under shared in v2 form. */
export function getPropertyDescription(form: InspectionFormDataV2) {
  return form.shared.propertyDescription;
}

/** Deep-merge persisted form data with empty defaults so every form field appears in reports. */
export function mergeInspectionFormWithDefaults(
  form: InspectionFormDataV2,
  jobFormKind: InspectionJobFormKind,
): InspectionFormDataV2 {
  const template = createEmptyInspectionFormData(jobFormKind);
  const sharedEntries = [
    ...SHARED_INSPECTION_SECTION_KEYS.map((key) => [
      key,
      mergeSectionRecord(
        template.shared[key] as unknown as Record<string, unknown>,
        form.shared?.[key] as unknown as Record<string, unknown> | undefined,
      ),
    ]),
    [
      'inspectorHazardAssessment',
      mergeSectionRecord(
        template.shared.inspectorHazardAssessment as unknown as Record<string, unknown>,
        form.shared?.inspectorHazardAssessment as unknown as Record<string, unknown> | undefined,
      ),
    ],
  ];
  const shared = {
    ...template.shared,
    ...Object.fromEntries(sharedEntries),
  } as SharedInspectionSections;

  const needsBuilding = jobFormKind === 'BUILDING' || jobFormKind === 'COMBINED';
  const building =
    template.building && needsBuilding
      ? ({
          ...template.building,
          ...Object.fromEntries(
            BUILDING_EXTENSION_SECTION_KEYS.map((key) => [
              key,
              mergeSectionRecord(
                template.building![key] as unknown as Record<string, unknown>,
                form.building?.[key] as unknown as Record<string, unknown> | undefined,
              ),
            ]),
          ),
        } as BuildingExtensionSections)
      : undefined;

  const needsPest = jobFormKind === 'PEST' || jobFormKind === 'COMBINED';
  const pest =
    template.pest && needsPest
      ? ({
          ...template.pest,
          ...Object.fromEntries(
            (Object.keys(template.pest!) as (keyof PestInspectionSections)[]).map((key) => [
              key,
              mergeSectionRecord(
                template.pest![key] as unknown as Record<string, unknown>,
                form.pest?.[key] as unknown as Record<string, unknown> | undefined,
              ),
            ]),
          ),
        } as PestInspectionSections)
      : undefined;

  return {
    version: INSPECTION_FORM_VERSION,
    shared,
    building,
    pest,
  };
}

export { extractSharedFromLegacy };
