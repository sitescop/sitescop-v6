export type RoomEngineType = 'bedroom' | 'bathroom' | 'living' | 'garage';

export const ROOM_ENGINE_VERSION = '5.0.0';

export interface InspectionPhotoRef {
  id: string;
  dataUrl: string;
  caption?: string;
  createdAt: string;
}

export interface CheckboxFieldState {
  selected: string[];
  custom: string[];
}

export interface SectionBase {
  comments: string;
  photos: InspectionPhotoRef[];
}

export interface JobInformationSection extends SectionBase {
  clientType: string;
  agencyName: string;
  agentName: string;
  agentMobile: string;
  agentEmail: string;
  clientName: string;
  clientMobile: string;
  clientEmail: string;
  inspectionDate: string;
  inspectionTime: string;
  propertyAddress: string;
  weatherConditions: string;
  occupancyStatus: string;
  incompleteConstruction: string;
  incompleteConstructionPhotos: InspectionPhotoRef[];
  gpsLatitude: string;
  gpsLongitude: string;
  frontPhotoAngle: 'driveway' | 'street' | '';
  frontPhotoAngles: CheckboxFieldState;
  /** Building inspections only — drives PDF cover title. */
  buildingReportType: string;
  /** Pest inspections only — drives PDF cover title. */
  pestReportType: string;
}

export interface ServicesSection extends SectionBase {
  waterSupply: CheckboxFieldState;
  waterSupplyOther: string;
  sewer: CheckboxFieldState;
  sewerOther: string;
  electricity: CheckboxFieldState;
  electricityOther: string;
  gas: CheckboxFieldState;
  gasOther: string;
  hotWaterPresent: string;
  hotWaterLocation: string;
  hotWaterType: CheckboxFieldState;
  hotWaterTypeOther: string;
  hotWaterOperating: string;
  hotWaterPhotos: InspectionPhotoRef[];
  airConPresent: string;
  airConType: CheckboxFieldState;
  airConTypeOther: string;
  airConOperating: string;
  gasBottlePhotos: InspectionPhotoRef[];
}

export interface PropertyDescriptionSection extends SectionBase {
  propertyType: string;
  propertyTypeOther: string;
  positionOnBlock: string;
  orientation: string;
  storeys: string;
  buildingAgeYears: string;
  bedroomCount: number;
  bathroomCount: number;
  livingAreaCount: number;
  garageCount: number;
  subfloorPresent: string;
  walls: CheckboxFieldState;
  frame: CheckboxFieldState;
  roof: CheckboxFieldState;
  floor: CheckboxFieldState;
  fencing: CheckboxFieldState;
}

export interface AccessibilityObstructionsSection extends SectionBase {
  accessibilityAreas: CheckboxFieldState;
  interiorObstructions: CheckboxFieldState;
  exteriorObstructions: CheckboxFieldState;
  roofSpaceObstructions: CheckboxFieldState;
  subfloorObstructions: CheckboxFieldState;
  inaccessibleAreas: CheckboxFieldState;
  inaccessibleCustomLines: string[];
  undetectedStructuralRisk: string;
  riskExplanation: string;
}

export interface SiteConditionsSection extends SectionBase {
  landSlope: string;
  surfaceDrainage: string;
  evidenceOfWaterPooling: string;
  siteDrainageConcerns: CheckboxFieldState;
}

export interface ExternalSection extends SectionBase {
  externalDefects: CheckboxFieldState;
  damageObserved: CheckboxFieldState;
}

export interface RoofExteriorSection extends SectionBase {
  defects: CheckboxFieldState;
  condition: string;
}

export interface RoofSpaceSection extends SectionBase {
  defects: CheckboxFieldState;
}

export interface KitchenSection extends SectionBase {
  cabinetDoorsOperating: string;
  cabinetDamage: string;
  cabinetCondition: string;
  sink: string;
  drainage: string;
  leakInsideCabinet: string;
  tapsMixers: string;
  splashback: string;
  benchtopType: string;
  benchtopCondition: string;
  benchtopDamage: string;
  walls: CheckboxFieldState;
  ceiling: CheckboxFieldState;
  floorType: string;
  floorCondition: string;
  window: string;
  windowLock: string;
  lights: string;
  switches: string;
  powerPoints: string;
  moistureDamage: string;
  disclaimers: CheckboxFieldState;
}

export interface ElectricalGeneralSection extends SectionBase {
  disclaimers: CheckboxFieldState;
}

export interface LaundrySection extends SectionBase {
  cabinetDamage: string;
  moistureDamage: string;
  laundryTrough: string;
  drainage: string;
  leakage: string;
  tapDripping: string;
  activeLeak: string;
  splashback: string;
  waterPooling: string;
  waterPoolingPhotos: InspectionPhotoRef[];
  floorWaste: string;
  walls: CheckboxFieldState;
  ceiling: CheckboxFieldState;
  floorType: string;
  floorCondition: string;
  window: string;
  windowLock: string;
  door: string;
  handle: string;
  lights: string;
  switches: string;
  powerPoints: string;
  exhaustFan: string;
  moistureLevel: string;
  disclaimers: CheckboxFieldState;
}

export interface SubfloorSection extends SectionBase {
  elements: CheckboxFieldState;
}

export interface FencingSection extends SectionBase {
  materials: CheckboxFieldState;
}

export interface OutbuildingsSection extends SectionBase {
  types: CheckboxFieldState;
  condition: string;
}

export interface CorrosionSection extends SectionBase {
  items: CheckboxFieldState;
}

export interface MinorDefectsSection extends SectionBase {
  checklist: CheckboxFieldState;
}

export interface CrackingEntry {
  id: string;
  location: string;
  crackWidth: string;
  monitoringRecommended: string;
  engineeringRequired: string;
  comments: string;
  photos: InspectionPhotoRef[];
}

export interface FinishElementDamageEntry {
  id: string;
  elements: CheckboxFieldState;
  location: string;
  comments: string;
  photos: InspectionPhotoRef[];
}

export interface MajorDefectRollupDismissed {
  structuralMovement: string[];
  deformation: string[];
  moistureSources: string[];
  conditionsConducive: string[];
  areasNotInspected: string[];
  safetyHazards: string[];
}

export type MajorDefectRollupDismissibleField = keyof MajorDefectRollupDismissed;

export interface MajorDefectsSection extends SectionBase {
  structuralMovement: CheckboxFieldState;
  structuralEngineeringRequired: string;
  crackingEntries: CrackingEntry[];
  deformation: CheckboxFieldState;
  deformationEngineeringRequired: string;
  deformationPhotos: InspectionPhotoRef[];
  moistureSources: CheckboxFieldState;
  moistureSourcePhotos: InspectionPhotoRef[];
  conditionsConducive: CheckboxFieldState;
  finishElementDamageEntries: FinishElementDamageEntry[];
  areasNotInspected: CheckboxFieldState;
  safetyHazards: CheckboxFieldState;
  safetyHazardPhotos: InspectionPhotoRef[];
  plumbingDefectPhotos: InspectionPhotoRef[];
  rollupDismissed: MajorDefectRollupDismissed;
}

export interface ThermalImagingSection extends SectionBase {}

export interface MoistureTestingSection extends SectionBase {
  visualMoistureEvidence: string;
  visualLocations: CheckboxFieldState;
  excessiveMoistureEvidence: string;
  excessiveLocations: CheckboxFieldState;
  moistureMeterPhotos: InspectionPhotoRef[];
  thermalImages: InspectionPhotoRef[];
}

export interface InspectorHazardAssessmentSection extends SectionBase {
  hazards: CheckboxFieldState;
  overallLevel: string;
  inspectionOutcome: string;
  clientAdvised: string;
  rebookingRequired: string;
  autoSummary: string;
}

/** @deprecated Use shared inspectorHazardAssessment. Kept for persisted building forms. */
export interface RiskAssessmentSection extends SectionBase {
  level: string;
}

export interface ConclusionSection extends SectionBase {
  qualityOfWorkmanship: string;
  structuralDamageRating: string;
  conditionsConduciveRating: string;
  majorDefectsRating: string;
  minorDefectsRating: string;
  overallBuildingCondition: string;
  overallComparison: string;
  autoConclusion: string;
}

export interface RecommendationsSection extends SectionBase {
  autoRecommendations: string[];
  manualRecommendations: string[];
}

export interface InspectorDeclarationSection {
  inspectorName: string;
  licenceNumber: string;
  signatureData: string;
  declarationDate: string;
  clientSignatureData: string;
  reportComplete: boolean;
  /** Set when the inspector opens the declaration section in the workflow UI. */
  sectionReviewed: boolean;
}

export interface BuildingInspectionFormData {
  jobInformation: JobInformationSection;
  services: ServicesSection;
  propertyDescription: PropertyDescriptionSection;
  accessibilityObstructions: AccessibilityObstructionsSection;
  siteConditions: SiteConditionsSection;
  external: ExternalSection;
  roofExterior: RoofExteriorSection;
  roofSpace: RoofSpaceSection;
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

export type InspectionSectionKey = keyof BuildingInspectionFormData;

export const INSPECTION_SECTION_KEYS: InspectionSectionKey[] = [
  'jobInformation',
  'services',
  'propertyDescription',
  'accessibilityObstructions',
  'siteConditions',
  'external',
  'roofExterior',
  'roofSpace',
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

export const INSPECTION_SECTION_LABELS: Record<InspectionSectionKey, string> = {
  jobInformation: 'Job Information',
  services: 'Services',
  propertyDescription: 'Property Description',
  accessibilityObstructions: 'Accessibility',
  siteConditions: 'Site Conditions',
  external: 'External',
  roofExterior: 'Roof Exterior',
  roofSpace: 'Roof Space',
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

export interface BathroomRoomData extends SectionBase {
  bathroomType: string;
  fixtures: CheckboxFieldState;
  basinType: string;
  basinDrainage: string;
  basinLeakInsideCabinet: string;
  basinCondition: string;
  tapsOperating: string;
  tapsDripping: string;
  tapsActiveLeak: string;
  tapsCondition: string;
  showerOperating: string;
  showerDrainage: string;
  showerHeadLeaking: string;
  showerEvidenceOfLeakage: string;
  screenCondition: string;
  screenWaterEscaping: string;
  screenDamageCracks: string;
  siliconeCondition: string;
  siliconeFailedMissing: string;
  siliconeMouldPresent: string;
  waterEscapingObserved: string;
  waterEscapingPhotos: InspectionPhotoRef[];
  floorTilesBrokenCracked: string;
  floorTilesLoose: string;
  floorTilesHollowSounding: string;
  floorTilesCondition: string;
  wallTilesBrokenCracked: string;
  wallTilesLoose: string;
  wallTilesHollowSounding: string;
  wallTilesCondition: string;
  groutMissing: string;
  groutDeteriorated: string;
  toiletFlushWorking: string;
  toiletBlockage: string;
  toiletLeakage: string;
  toiletSecureStable: string;
  toiletCracksDamage: string;
  toiletSeatCondition: string;
  doorMoistureDamage: string;
  doorOperating: string;
  doorCondition: string;
  doorJambMoistureDamage: string;
  doorJambCondition: string;
  windowCondition: string;
  windowOperating: string;
  lightsWorking: string;
  switchesWorking: string;
  exhaustFanWorking: string;
  exhaustFanNoise: string;
  waterPoolingPresent: string;
  waterPoolingCause: CheckboxFieldState;
  waterPoolingPhotos: InspectionPhotoRef[];
  moistureDamage: string;
  moistureEvidencePhotos: InspectionPhotoRef[];
}

export interface BedroomRoomData extends SectionBase {
  roomType: string;
  accessAvailable: string;
  noAccessReason: string;
  door: string;
  handle: string;
  window: string;
  windowLock: string;
  wardrobe: string;
  slidingDoor: string;
  mirror: string;
  floorType: string;
  floorCondition: string;
  walls: CheckboxFieldState;
  ceiling: CheckboxFieldState;
  lights: string;
  switches: string;
  powerPoints: string;
  smokeAlarm: string;
  damageObserved: CheckboxFieldState;
}

export interface LivingRoomData extends BedroomRoomData {
  areaName: string;
}

export interface GarageRoomData extends SectionBase {
  defects: CheckboxFieldState;
  damageObserved: CheckboxFieldState;
}

export interface RoomCounts {
  bedrooms: number;
  bathrooms: number;
  livingAreas: number;
  garages: number;
}

export interface PrefillJobContext {
  jobNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  propertyAddress: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  inspectorName: string;
  inspectorLicence: string;
}
