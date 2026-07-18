import type {
  AccessibilityObstructionsSection,
  BathroomRoomData,
  BedroomRoomData,
  BuildingInspectionFormData,
  CheckboxFieldState,
  GarageRoomData,
  LivingRoomData,
  PrefillJobContext,
  RoomCounts,
  RoomEngineType,
  ServicesSection,
} from './types.js';
import { isSubfloorApplicable, resolveSubfloorPresent } from './property-profile.js';
import {
  ACCESSIBILITY_AREAS,
  DEFAULT_BUILDING_REPORT_TYPE,
  DEFAULT_INCOMPLETE_CONSTRUCTION,
  DEFAULT_PEST_REPORT_TYPE,
  DEFAULT_OCCUPANCY_STATUS,
  DEFAULT_WEATHER_CONDITIONS,
  ELECTRICAL_WORKING,
  GENERAL_ELECTRICAL_DISCLAIMERS,
  KITCHEN_DISCLAIMERS,
  LAUNDRY_DISCLAIMERS,
  LICENSED_ELECTRICIAN_INSPECTION,
  LIVING_AREA_NAMES,
} from './options.js';

export const DEFAULT_WATER_SUPPLY_SELECTION = ['Town Water'] as const;
export const DEFAULT_SERVICES_COMMENTS =
  'Services were visually identified only. Specialist testing was not undertaken.';
export const DEFAULT_ELECTRICITY_SELECTION = ['Mains'] as const;

export const DEFAULT_INTERIOR_OBSTRUCTION_SELECTION = [
  'Wall linings',
  'Ceiling linings',
  'Floor coverings',
  'Window furniture',
  'Cabinetry',
  'Appliances',
  'Storage to cupboards',
  'Furniture and stored goods will limit access',
] as const;

export const DEFAULT_EXTERIOR_OBSTRUCTION_SELECTION = [
  'Landscaping',
  'Foliage',
  'Gates and fences',
  'Stored items',
] as const;

export function emptyCheckboxField(): CheckboxFieldState {
  return { selected: [], custom: [] };
}

export function isCheckboxFieldEmpty(value: CheckboxFieldState | string[] | undefined | null): boolean {
  const field = normalizeCheckboxField(value);
  return field.selected.length === 0 && field.custom.length === 0;
}

export function checkboxFieldFromPresets(presets: readonly string[]): CheckboxFieldState {
  return { selected: [...presets], custom: [] };
}

export function defaultAccessibilityAreaSelection(subfloorApplicable: boolean): string[] {
  return ACCESSIBILITY_AREAS.filter((area) => area !== 'Subfloor' || subfloorApplicable);
}

export function applyServicesDefaults(services: ServicesSection): ServicesSection {
  return {
    ...services,
    waterSupply: isCheckboxFieldEmpty(services.waterSupply)
      ? checkboxFieldFromPresets(DEFAULT_WATER_SUPPLY_SELECTION)
      : normalizeCheckboxField(services.waterSupply),
    waterSupplyPhotos: Array.isArray(services.waterSupplyPhotos) ? services.waterSupplyPhotos : [],
    electricity: isCheckboxFieldEmpty(services.electricity)
      ? checkboxFieldFromPresets(DEFAULT_ELECTRICITY_SELECTION)
      : normalizeCheckboxField(services.electricity),
    electricityPhotos: Array.isArray(services.electricityPhotos) ? services.electricityPhotos : [],
    sewerPhotos: Array.isArray(services.sewerPhotos) ? services.sewerPhotos : [],
    gasPhotos: Array.isArray(services.gasPhotos) ? services.gasPhotos : [],
    hotWaterPresent: services.hotWaterPresent?.trim() ? services.hotWaterPresent : 'Yes',
    hotWaterPhotos: Array.isArray(services.hotWaterPhotos) ? services.hotWaterPhotos : [],
    hotWaterComments: services.hotWaterComments ?? '',
    airConPresent: services.airConPresent?.trim() ? services.airConPresent : 'Yes',
    airConPhotos: Array.isArray(services.airConPhotos) ? services.airConPhotos : [],
    airConComments: services.airConComments ?? '',
    rainwaterTankPresent: services.rainwaterTankPresent?.trim() ? services.rainwaterTankPresent : 'Yes',
    rainwaterTankPhotos: Array.isArray(services.rainwaterTankPhotos) ? services.rainwaterTankPhotos : [],
    rainwaterTankComments: services.rainwaterTankComments ?? '',
    comments: services.comments?.trim() ? services.comments : DEFAULT_SERVICES_COMMENTS,
  };
}

export function applyAccessibilityObstructionDefaults(
  section: AccessibilityObstructionsSection,
  subfloorApplicable: boolean,
): AccessibilityObstructionsSection {
  return {
    ...section,
    undetectedStructuralRisk: section.undetectedStructuralRisk?.trim() || 'Moderate',
    accessibilityAreas: isCheckboxFieldEmpty(section.accessibilityAreas)
      ? checkboxFieldFromPresets(defaultAccessibilityAreaSelection(subfloorApplicable))
      : normalizeAccessibilityAreas(section.accessibilityAreas),
    interiorObstructions: isCheckboxFieldEmpty(section.interiorObstructions)
      ? checkboxFieldFromPresets(DEFAULT_INTERIOR_OBSTRUCTION_SELECTION)
      : normalizeCheckboxField(section.interiorObstructions),
    exteriorObstructions: isCheckboxFieldEmpty(section.exteriorObstructions)
      ? checkboxFieldFromPresets(DEFAULT_EXTERIOR_OBSTRUCTION_SELECTION)
      : normalizeCheckboxField(section.exteriorObstructions),
    inaccessibleAreaReasons:
      section.inaccessibleAreaReasons && typeof section.inaccessibleAreaReasons === 'object'
        ? section.inaccessibleAreaReasons
        : {},
  };
}

export function applySharedInspectionDefaults(shared: {
  propertyDescription: { subfloorPresent?: string };
  services: ServicesSection;
  accessibilityObstructions: AccessibilityObstructionsSection;
}): {
  services: ServicesSection;
  accessibilityObstructions: AccessibilityObstructionsSection;
} {
  const subfloorApplicable = isSubfloorApplicable(
    resolveSubfloorPresent(
      shared.propertyDescription,
      undefined,
      shared.accessibilityObstructions,
    ),
  );
  return {
    services: applyServicesDefaults(shared.services),
    accessibilityObstructions: applyAccessibilityObstructionDefaults(
      shared.accessibilityObstructions,
      subfloorApplicable,
    ),
  };
}

export function defaultElectricalDisclaimersField(): CheckboxFieldState {
  return { selected: [...GENERAL_ELECTRICAL_DISCLAIMERS], custom: [] };
}

export function defaultKitchenDisclaimersField(): CheckboxFieldState {
  return { selected: [...KITCHEN_DISCLAIMERS], custom: [] };
}

export function defaultLaundryDisclaimersField(): CheckboxFieldState {
  return { selected: [...LAUNDRY_DISCLAIMERS], custom: [] };
}

export function defaultIfEmptyWorkingStatus(value: string): string {
  return value?.trim() ? value : ELECTRICAL_WORKING;
}

export function defaultIfEmptySmokeAlarmStatus(value: string): string {
  return value?.trim() ? value : LICENSED_ELECTRICIAN_INSPECTION;
}

export function defaultSmokeAlarmStatus(): string {
  return LICENSED_ELECTRICIAN_INSPECTION;
}

export function defaultSwitchesStatus(): string {
  return LICENSED_ELECTRICIAN_INSPECTION;
}

function setIfEmptyField(data: Record<string, unknown>, key: string, value: string): void {
  if (!(key in data)) return;
  if (!String(data[key] ?? '').trim()) data[key] = value;
}

export function applyLaundrySurfaceDefaults<T extends Record<string, unknown>>(laundry: T): T {
  const next = { ...laundry };
  setIfEmptyField(next, 'splashback', 'Good');
  setIfEmptyField(next, 'floorType', 'Tiles');
  setIfEmptyField(next, 'floorCondition', 'Good');
  return next;
}

/** Sensible defaults for bathroom wet-area, tiling, and joinery fields. */
export function applyBathroomRoomDefaults(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  setIfEmptyField(next, 'floorTilesCondition', 'Good');
  setIfEmptyField(next, 'floorTilesBrokenCracked', 'No');
  setIfEmptyField(next, 'floorTilesLoose', 'No');
  setIfEmptyField(next, 'floorTilesHollowSounding', 'No');
  setIfEmptyField(next, 'wallTilesCondition', 'Good');
  setIfEmptyField(next, 'wallTilesBrokenCracked', 'No');
  setIfEmptyField(next, 'wallTilesLoose', 'No');
  setIfEmptyField(next, 'wallTilesHollowSounding', 'No');
  setIfEmptyField(next, 'groutMissing', 'No');
  setIfEmptyField(next, 'groutDeteriorated', 'No');
  setIfEmptyField(next, 'showerOperating', 'Yes');
  setIfEmptyField(next, 'showerDrainage', 'Not Blocked');
  setIfEmptyField(next, 'doorCondition', 'Good');
  setIfEmptyField(next, 'doorOperating', 'Yes');
  setIfEmptyField(next, 'doorMoistureDamage', 'No');
  setIfEmptyField(next, 'doorJambCondition', 'Good');
  setIfEmptyField(next, 'doorJambMoistureDamage', 'No');
  setIfEmptyField(next, 'windowCondition', 'Good');
  setIfEmptyField(next, 'windowOperating', 'Good');
  setIfEmptyField(next, 'lightsWorking', 'Yes');
  setIfEmptyField(next, 'siliconeCondition', 'Good');
  setIfEmptyField(next, 'moistureDamage', 'None');
  setIfEmptyField(next, 'toiletCracksDamage', 'No');
  if ('switchesWorking' in next) {
    next.switchesWorking = defaultSwitchesStatus();
  }
  return next;
}

/** Apply standard electrical guard defaults to persisted room data. */
export function applyRoomElectricalDefaults(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  if ('lights' in next) {
    next.lights = defaultIfEmptyWorkingStatus(String(next.lights ?? ''));
  }
  if ('switches' in next) {
    next.switches = defaultSwitchesStatus();
  }
  if ('powerPoints' in next) {
    next.powerPoints = defaultIfEmptyWorkingStatus(String(next.powerPoints ?? ''));
  }
  if ('smokeAlarm' in next) {
    next.smokeAlarm = defaultIfEmptySmokeAlarmStatus(String(next.smokeAlarm ?? ''));
  }
  return next;
}

/** Coerce persisted or legacy checkbox values into `{ selected, custom }`. */
export function normalizeCheckboxField(
  value: CheckboxFieldState | string[] | undefined | null,
): CheckboxFieldState {
  if (!value) return emptyCheckboxField();
  if (Array.isArray(value)) {
    return { selected: value, custom: [] };
  }
  if (typeof value !== 'object') return emptyCheckboxField();

  const selectedRaw = value.selected;
  const customRaw = value.custom;

  let selected: string[] = [];
  if (Array.isArray(selectedRaw)) {
    selected = selectedRaw;
  } else if (typeof selectedRaw === 'string' && selectedRaw) {
    selected = [selectedRaw];
  }

  let custom: string[] = [];
  if (Array.isArray(customRaw)) {
    custom = customRaw;
  } else if (typeof customRaw === 'string' && customRaw) {
    custom = [customRaw];
  }

  selected = [...new Set(selected)];
  custom = [...new Set(custom)].filter((item) => !selected.includes(item));

  return { selected, custom };
}

const LEGACY_ACCESSIBILITY_AREA_LABELS: Record<string, string> = {
  'Interior Obstructions': 'Interior',
  'Exterior Obstructions': 'Exterior',
};

function remapAccessibilityAreaLabel(item: string): string {
  return LEGACY_ACCESSIBILITY_AREA_LABELS[item] ?? item;
}

/** Merge preset accessibility area labels out of custom into selected (fixes duplicate Subfloor rows). */
export function normalizeAccessibilityAreas(
  value: CheckboxFieldState | string[] | undefined | null,
): CheckboxFieldState {
  const field = normalizeCheckboxField(value);
  const presets = new Set<string>(ACCESSIBILITY_AREAS);
  const selected = field.selected.map(remapAccessibilityAreaLabel);
  const custom = field.custom.map(remapAccessibilityAreaLabel);
  const fromCustom = custom.filter((item) => presets.has(item));
  return {
    selected: [...new Set([...selected, ...fromCustom])],
    custom: custom.filter((item) => !presets.has(item)),
  };
}

export function emptySectionBase() {
  return { comments: '', photos: [], noMajorDefectObserved: false, majorDefectObserved: false };
}

export function createEmptyFormData(prefill?: PrefillJobContext): BuildingInspectionFormData {
  const base = emptySectionBase();
  return {
    jobInformation: {
      ...base,
      clientType: 'Purchaser',
      agencyName: prefill?.agencyName?.trim() ?? '',
      agentName: prefill?.agentName ?? '',
      agentPhone: prefill?.agentPhone ?? '',
      agentMobile: prefill?.agentMobile ?? prefill?.agentPhone ?? '',
      agentEmail: prefill?.agentEmail ?? '',
      clientName: prefill?.clientName ?? '',
      clientMobile: prefill?.clientPhone ?? '',
      clientEmail: prefill?.clientEmail ?? '',
      inspectionDate: prefill?.scheduledDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      inspectionTime: prefill?.scheduledTime ?? '',
      propertyAddress: prefill?.propertyAddress ?? '',
      weatherConditions: DEFAULT_WEATHER_CONDITIONS,
      occupancyStatus: DEFAULT_OCCUPANCY_STATUS,
      incompleteConstruction: DEFAULT_INCOMPLETE_CONSTRUCTION,
      incompleteConstructionPhotos: [],
      gpsLatitude: '',
      gpsLongitude: '',
      frontPhotoAngle: 'driveway',
      frontPhotoAngles: emptyCheckboxField(),
      buildingReportType: DEFAULT_BUILDING_REPORT_TYPE,
      pestReportType: DEFAULT_PEST_REPORT_TYPE,
    },
    services: {
      ...base,
      comments: DEFAULT_SERVICES_COMMENTS,
      waterSupply: checkboxFieldFromPresets(DEFAULT_WATER_SUPPLY_SELECTION),
      waterSupplyOther: '',
      waterSupplyPhotos: [],
      sewer: emptyCheckboxField(),
      sewerOther: '',
      sewerPhotos: [],
      electricity: checkboxFieldFromPresets(DEFAULT_ELECTRICITY_SELECTION),
      electricityOther: '',
      electricityPhotos: [],
      gas: emptyCheckboxField(),
      gasOther: '',
      gasPhotos: [],
      hotWaterPresent: 'Yes',
      hotWaterLocation: '',
      hotWaterType: emptyCheckboxField(),
      hotWaterTypeOther: '',
      hotWaterOperating: '',
      hotWaterPhotos: [],
      hotWaterComments: '',
      airConPresent: 'Yes',
      airConType: emptyCheckboxField(),
      airConTypeOther: '',
      airConOperating: '',
      airConPhotos: [],
      airConComments: '',
      gasBottlePhotos: [],
      rainwaterTankPresent: 'Yes',
      rainwaterTankPhotos: [],
      rainwaterTankComments: '',
    },
    propertyDescription: {
      ...base,
      propertyType: '',
      propertyTypeOther: '',
      positionOnBlock: '',
      orientation: '',
      storeys: '',
      buildingAgeYears: '',
      bedroomCount: 0,
      bathroomCount: 0,
      livingAreaCount: 0,
      garageCount: 0,
      subfloorPresent: '',
      walls: emptyCheckboxField(),
      frame: emptyCheckboxField(),
      roof: emptyCheckboxField(),
      floor: emptyCheckboxField(),
      fencing: emptyCheckboxField(),
    },
    accessibilityObstructions: {
      ...base,
      accessibilityAreas: checkboxFieldFromPresets(defaultAccessibilityAreaSelection(true)),
      interiorObstructions: checkboxFieldFromPresets(DEFAULT_INTERIOR_OBSTRUCTION_SELECTION),
      exteriorObstructions: checkboxFieldFromPresets(DEFAULT_EXTERIOR_OBSTRUCTION_SELECTION),
      roofSpaceObstructions: emptyCheckboxField(),
      subfloorObstructions: emptyCheckboxField(),
      interiorObstructionPhotos: [],
      exteriorObstructionPhotos: [],
      roofSpaceObstructionPhotos: [],
      subfloorObstructionPhotos: [],
      inaccessibleAreas: emptyCheckboxField(),
      inaccessibleCustomLines: [''],
      inaccessibleAreaReasons: {},
      undetectedStructuralRisk: 'Moderate',
      riskExplanation: '',
    },
    siteConditions: {
      ...base,
      landSlope: '',
      surfaceDrainage: '',
      evidenceOfWaterPooling: 'No',
      siteDrainageConcerns: emptyCheckboxField(),
    },
    external: {
      ...base,
      externalDefects: emptyCheckboxField(),
      damageObserved: emptyCheckboxField(),
    },
    roofExterior: {
      ...base,
      defects: emptyCheckboxField(),
      condition: '',
    },
    roofSpace: {
      ...base,
      defects: emptyCheckboxField(),
      framingElements: emptyCheckboxField(),
    },
    kitchen: {
      ...base,
      cabinetDoorsOperating: '',
      cabinetDamage: '',
      cabinetCondition: '',
      sink: '',
      drainage: '',
      leakInsideCabinet: '',
      tapsMixers: '',
      splashback: '',
      benchtopType: '',
      benchtopCondition: '',
      benchtopDamage: '',
      walls: emptyCheckboxField(),
      ceiling: emptyCheckboxField(),
      floorType: '',
      floorCondition: '',
      window: '',
      windowLock: '',
      lights: ELECTRICAL_WORKING,
      switches: LICENSED_ELECTRICIAN_INSPECTION,
      powerPoints: ELECTRICAL_WORKING,
      moistureDamage: '',
      disclaimers: defaultKitchenDisclaimersField(),
    },
    electricalGeneral: {
      ...base,
      disclaimers: defaultElectricalDisclaimersField(),
    },
    laundry: {
      ...base,
      cabinetDamage: '',
      moistureDamage: '',
      laundryTrough: '',
      drainage: '',
      leakage: '',
      tapDripping: '',
      activeLeak: '',
      splashback: 'Good',
      waterPooling: 'No',
      waterPoolingPhotos: [],
      floorWaste: '',
      walls: emptyCheckboxField(),
      ceiling: emptyCheckboxField(),
      floorType: 'Tiles',
      floorCondition: 'Good',
      window: '',
      windowLock: '',
      door: '',
      handle: '',
      lights: ELECTRICAL_WORKING,
      switches: LICENSED_ELECTRICIAN_INSPECTION,
      powerPoints: ELECTRICAL_WORKING,
      exhaustFan: '',
      moistureLevel: '',
      disclaimers: defaultLaundryDisclaimersField(),
    },
    subfloor: {
      ...base,
      elements: emptyCheckboxField(),
    },
    fencing: {
      ...base,
      materials: emptyCheckboxField(),
    },
    outbuildings: {
      ...base,
      types: emptyCheckboxField(),
      condition: '',
    },
    corrosion: {
      ...base,
      items: emptyCheckboxField(),
    },
    minorDefects: {
      ...base,
      checklist: emptyCheckboxField(),
    },
    majorDefects: {
      ...base,
      structuralMovement: emptyCheckboxField(),
      structuralEngineeringRequired: 'No',
      crackingEntries: [],
      deformation: emptyCheckboxField(),
      deformationEngineeringRequired: 'No',
      deformationPhotos: [],
      moistureSources: emptyCheckboxField(),
      moistureSourcePhotos: [],
      conditionsConducive: emptyCheckboxField(),
      finishElementDamageEntries: [],
      areasNotInspected: emptyCheckboxField(),
      safetyHazards: emptyCheckboxField(),
      safetyHazardPhotos: [],
      plumbingDefectPhotos: [],
      rollupDismissed: {
        structuralMovement: [],
        deformation: [],
        moistureSources: [],
        conditionsConducive: [],
        areasNotInspected: [],
        safetyHazards: [],
        crackingEntries: [],
      },
    },
    thermalImaging: { ...base },
    moistureTesting: {
      ...base,
      visualMoistureEvidence: 'No',
      visualLocations: emptyCheckboxField(),
      excessiveMoistureEvidence: 'No',
      excessiveLocations: emptyCheckboxField(),
      moistureMeterPhotos: [],
      thermalImages: [],
    },
    riskAssessment: {
      ...base,
      level: 'Low',
    },
    conclusion: {
      ...base,
      qualityOfWorkmanship: '',
      structuralDamageRating: '',
      conditionsConduciveRating: '',
      majorDefectsRating: '',
      minorDefectsRating: '',
      overallBuildingCondition: '',
      overallComparison: '',
      autoConclusion: '',
    },
    recommendations: {
      ...base,
      autoRecommendations: [],
      manualRecommendations: [],
    },
    inspectorDeclaration: {
      inspectorName: prefill?.inspectorName ?? '',
      licenceNumber: prefill?.inspectorLicence ?? '',
      signatureData: '',
      declarationDate: new Date().toISOString().slice(0, 10),
      clientSignatureData: '',
      reportComplete: false,
      sectionReviewed: false,
    },
  };
}

export function createEmptyBedroomRoom(index: number): BedroomRoomData {
  return {
    ...emptySectionBase(),
    roomType: 'Bedroom',
    accessAvailable: 'Yes',
    noAccessReason: '',
    door: '',
    handle: '',
    window: '',
    windowLock: '',
    wardrobe: '',
    slidingDoor: '',
    mirror: '',
    floorType: '',
    floorCondition: '',
    walls: emptyCheckboxField(),
    ceiling: emptyCheckboxField(),
    lights: ELECTRICAL_WORKING,
    switches: LICENSED_ELECTRICIAN_INSPECTION,
    powerPoints: ELECTRICAL_WORKING,
    smokeAlarm: LICENSED_ELECTRICIAN_INSPECTION,
    damageObserved: emptyCheckboxField(),
  };
}

export function createEmptyBathroomRoom(index: number): BathroomRoomData {
  return {
    ...emptySectionBase(),
    bathroomType: index === 0 ? 'Main' : 'Ensuite',
    fixtures: emptyCheckboxField(),
    basinType: '',
    basinDrainage: '',
    basinLeakInsideCabinet: '',
    basinCondition: '',
    tapsOperating: '',
    tapsDripping: '',
    tapsActiveLeak: '',
    tapsCondition: '',
    showerOperating: 'Yes',
    showerDrainage: 'Not Blocked',
    showerHeadLeaking: '',
    showerEvidenceOfLeakage: '',
    screenCondition: '',
    screenWaterEscaping: '',
    screenDamageCracks: '',
    siliconeCondition: 'Good',
    siliconeFailedMissing: 'No',
    siliconeMouldPresent: 'No',
    waterEscapingObserved: 'No',
    waterEscapingPhotos: [],
    floorTilesBrokenCracked: 'No',
    floorTilesLoose: 'No',
    floorTilesHollowSounding: 'No',
    floorTilesCondition: 'Good',
    wallTilesBrokenCracked: 'No',
    wallTilesLoose: 'No',
    wallTilesHollowSounding: 'No',
    wallTilesCondition: 'Good',
    groutMissing: 'No',
    groutDeteriorated: 'No',
    toiletFlushWorking: 'Yes',
    toiletBlockage: 'No',
    toiletLeakage: 'No',
    toiletSecureStable: 'Yes',
    toiletCracksDamage: 'No',
    toiletSeatCondition: 'Good',
    doorMoistureDamage: 'No',
    doorOperating: 'Yes',
    doorCondition: 'Good',
    doorJambMoistureDamage: 'No',
    doorJambCondition: 'Good',
    windowCondition: 'Good',
    windowOperating: 'Good',
    lightsWorking: 'Yes',
    switchesWorking: LICENSED_ELECTRICIAN_INSPECTION,
    exhaustFanWorking: 'Yes',
    exhaustFanNoise: 'No',
    waterPoolingPresent: 'No',
    waterPoolingCause: emptyCheckboxField(),
    waterPoolingPhotos: [],
    moistureDamage: 'None',
    moistureEvidencePhotos: [],
  };
}

export function createEmptyLivingRoom(index: number): LivingRoomData {
  return {
    ...createEmptyBedroomRoom(index),
    areaName: LIVING_AREA_NAMES[index] ?? `Living Area ${index + 1}`,
    roomType: 'Living Area',
  };
}

export function createEmptyGarageRoom(index: number): GarageRoomData {
  return {
    ...emptySectionBase(),
    defects: emptyCheckboxField(),
    damageObserved: emptyCheckboxField(),
  };
}

export interface GeneratedRoom {
  roomType: RoomEngineType;
  roomIndex: number;
  label: string;
  data: BathroomRoomData | BedroomRoomData | LivingRoomData | GarageRoomData;
}

export function buildRoomsFromCounts(counts: RoomCounts): GeneratedRoom[] {
  const rooms: GeneratedRoom[] = [];

  for (let i = 0; i < counts.bathrooms; i++) {
    rooms.push({
      roomType: 'bathroom',
      roomIndex: i,
      label: `Bathroom ${i + 1}`,
      data: createEmptyBathroomRoom(i),
    });
  }

  for (let i = 0; i < counts.bedrooms; i++) {
    rooms.push({
      roomType: 'bedroom',
      roomIndex: i,
      label: `Bedroom ${i + 1}`,
      data: createEmptyBedroomRoom(i),
    });
  }

  for (let i = 0; i < counts.livingAreas; i++) {
    rooms.push({
      roomType: 'living',
      roomIndex: i,
      label: `Living Area ${i + 1}`,
      data: createEmptyLivingRoom(i),
    });
  }

  for (let i = 0; i < counts.garages; i++) {
    rooms.push({
      roomType: 'garage',
      roomIndex: i,
      label: counts.garages === 1 ? 'Garage' : `Garage ${i + 1}`,
      data: createEmptyGarageRoom(i),
    });
  }

  return rooms;
}

export function mergeSectionRecord<T extends Record<string, unknown>>(
  defaults: T,
  actual: Partial<T> | undefined,
): T {
  if (!actual) return { ...defaults };
  const merged = { ...defaults, ...actual } as T;
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const defVal = defaults[key];
    const actVal = actual[key];
    if (actVal === undefined || actVal === null) continue;
    if (isCheckboxDefault(defVal) || isCheckboxDefault(actVal)) {
      merged[key] = normalizeCheckboxField(actVal as CheckboxFieldState | string[] | null) as T[keyof T];
    } else if (Array.isArray(actVal)) {
      merged[key] = actVal as T[keyof T];
    } else {
      merged[key] = actVal as T[keyof T];
    }
  }
  return merged;
}

function isCheckboxDefault(val: unknown): val is CheckboxFieldState {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val) && 'selected' in val);
}

export function mergeRoomDataForReport(
  roomType: string,
  roomIndex: number,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const defaults =
    roomType === 'BEDROOM'
      ? createEmptyBedroomRoom(roomIndex)
      : roomType === 'BATHROOM'
        ? createEmptyBathroomRoom(roomIndex)
        : roomType === 'LIVING'
          ? createEmptyLivingRoom(roomIndex)
          : createEmptyGarageRoom(roomIndex);
  return roomType === 'BATHROOM'
    ? applyBathroomRoomDefaults(
        mergeSectionRecord(defaults as unknown as Record<string, unknown>, data),
      )
    : applyRoomElectricalDefaults(
        mergeSectionRecord(defaults as unknown as Record<string, unknown>, data),
      );
}

export function getRoomCountsFromForm(form: BuildingInspectionFormData): RoomCounts {
  return {
    bedrooms: form.propertyDescription.bedroomCount,
    bathrooms: form.propertyDescription.bathroomCount,
    livingAreas: form.propertyDescription.livingAreaCount,
    garages: form.propertyDescription.garageCount,
  };
}
