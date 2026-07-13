import {
  BUILDING_EXTENSION_SECTION_KEYS,
  SHARED_INSPECTION_SECTION_KEYS,
  createEmptyInspectionFormData,
} from '../../room-engine-core/src/index.js';
import {
  createEmptyBathroomRoom,
  createEmptyBedroomRoom,
  createEmptyGarageRoom,
  createEmptyLivingRoom,
} from '../../room-engine-core/src/index.js';

const SKIP_FIELD_KEYS = new Set(['photos', 'comments', 'sectionReviewed', 'licenceNumber', 'clientSignatureData', 'reportComplete', 'noMajorDefectObserved']);

/** Human-readable labels matching the inspection form UI. */
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  propertyType: 'Property Type',
  propertyTypeOther: 'Property Type (Other)',
  positionOnBlock: 'Position On Block',
  orientation: 'Orientation',
  storeys: 'Storeys',
  buildingAgeYears: 'Building Age (Years)',
  bedroomCount: 'Bedrooms',
  bathroomCount: 'Bathrooms',
  livingAreaCount: 'Living Areas',
  garageCount: 'Garage Spaces',
  frontPhotoAngle: 'Property Front Photo Angle',
  frontPhotoAngles: 'Property Front Photo Angles',
  clientType: 'Client Type',
  agencyName: 'Agency Name',
  agentName: 'Agent Name',
  agentPhone: 'Agent Phone',
  agentMobile: 'Agent Mobile',
  agentEmail: 'Agent Email',
  clientName: 'Client Name',
  clientMobile: 'Client Mobile',
  clientEmail: 'Client Email',
  inspectionDate: 'Inspection Date',
  inspectionTime: 'Inspection Time',
  propertyAddress: 'Property Address',
  weatherConditions: 'Weather Conditions',
  occupancyStatus: 'Occupancy Status',
  incompleteConstruction: 'Incomplete Construction',
  subfloorPresent: 'Subfloor Space Present',
  incompleteConstructionPhotos: 'Incomplete Construction Photos',
  gpsLatitude: 'GPS Latitude',
  gpsLongitude: 'GPS Longitude',
  waterSupply: 'Water Supply',
  waterSupplyOther: 'Water Supply (Other)',
  waterSupplyPhotos: 'Water Supply Photos',
  sewer: 'Sewer',
  sewerOther: 'Sewer (Other)',
  sewerPhotos: 'Sewer Photos',
  electricity: 'Electricity',
  electricityOther: 'Electricity (Other)',
  electricityPhotos: 'Electricity Photos',
  gas: 'Gas',
  gasOther: 'Gas (Other)',
  gasPhotos: 'Gas Photos',
  hotWaterPresent: 'Hot Water Present',
  hotWaterLocation: 'Hot Water Location',
  hotWaterType: 'Hot Water Type',
  hotWaterTypeOther: 'Hot Water Type (Other)',
  hotWaterOperating: 'Hot Water Operating',
  hotWaterPhotos: 'Hot Water System Photos',
  hotWaterComments: 'Hot Water System Comments',
  airConPresent: 'Air Conditioning Present',
  airConType: 'Air Conditioning Type',
  airConTypeOther: 'Air Conditioning Type (Other)',
  airConOperating: 'Air Conditioning Operating',
  airConPhotos: 'Air Conditioning Photos',
  airConComments: 'Air Conditioning Comments',
  gasBottlePhotos: 'LPG / Gas Bottle Photos',
  rainwaterTankPresent: 'Rainwater Tank Present',
  rainwaterTankPhotos: 'Rainwater Tank Photos',
  rainwaterTankComments: 'Rainwater Tank Comments',
  accessibilityAreas: 'Accessibility Areas',
  interiorObstructions: 'Interior Obstructions',
  exteriorObstructions: 'Exterior Obstructions',
  roofSpaceObstructions: 'Roof Space Obstructions',
  subfloorObstructions: 'Subfloor Obstructions',
  interiorObstructionPhotos: 'A — Interior Obstruction Photos',
  exteriorObstructionPhotos: 'B — Exterior Obstruction Photos',
  roofSpaceObstructionPhotos: 'C — Roof Space Obstruction Photos',
  subfloorObstructionPhotos: 'D — Subfloor Obstruction Photos',
  inaccessibleAreas: 'Inaccessible Areas',
  inaccessibleCustomLines: 'Inaccessible Area Notes',
  undetectedStructuralRisk: 'Undetected Structural Damage Risk',
  riskExplanation: 'Risk Explanation',
  landSlope: 'Land Slope',
  surfaceDrainage: 'Surface Drainage',
  evidenceOfWaterPooling: 'Evidence Of Water Pooling',
  siteDrainageConcerns: 'Site Drainage Concerns',
  externalDefects: 'External Defects',
  damageObserved: 'Damage Observed',
  autoConclusion: 'Conclusion',
  autoRecommendations: 'Auto Recommendations',
  manualRecommendations: 'Manual Recommendations',
  structuralDamageRating: 'Structural Damage Rating',
  qualityOfWorkmanship: 'Quality of workmanship and materials',
  inspectionType: 'Inspection Type',
  buildingReportType: 'Building Report Type',
  pestReportType: 'Pest Report Type',
  evidenceAnswer: 'Evidence',
  summaryAnswer: 'Evidence',
  answer: 'Evidence',
  summaryDuringInspection: 'Other Conditions Conducive',
  otherEvidenceAnswer: 'Other Evidence',
  locationNarrative: 'Location Details',
  reportStatement: 'Report Statement',
  oneOffComments: 'Additional Comments',
  recommendation: 'Recommendation',
  frequency: 'Frequency',
  species: 'Species',
  comment: 'Comment',
  evidenceLocations: 'Evidence Locations',
  evidenceFound: 'Evidence of Previous Program',
  evidenceItems: 'Evidence Items',
  productDetails: 'Product Details',
  moistureLocations: 'Moisture Locations',
  moistureStains: 'Moisture Stains',
  stainsDisclaimer: 'Stains Disclaimer',
  hazardItems: 'Hazards',
  riskLevel: 'Risk Level',
  recommendationPresets: 'Recommendations',
  conditionsConduciveRating: 'Conducive To Finish Element Damage Rating',
  majorDefectsRating: 'Major Defects Rating',
  minorDefectsRating: 'Minor Defects Rating',
  overallBuildingCondition: 'Overall Building Condition',
  overallComparison: 'Overall Comparison',
  structuralMovement: 'Structural Movement',
  structuralEngineeringRequired: 'Engineering Inspection Required',
  deformationEngineeringRequired: 'Deformation Engineering Required',
  deformationPhotos: 'Deformation Photos',
  moistureSources: 'Source of Moisture',
  moistureSourcePhotos: 'Source of Moisture Photos',
  conditionsConducive: 'Conducive To Finish Element Damage',
  finishElementDamageEntries: 'Finish Element Damage',
  areasNotInspected: 'Areas Not Inspected',
  safetyHazards: 'Major Safety Hazards',
  safetyHazardPhotos: 'Major Safety Hazard Photos',
  plumbingDefectPhotos: 'Plumbing Defect Photos',
  crackingEntries: 'Cracking',
  crackWidth: 'Crack Width',
  monitoringRecommended: 'Monitoring Recommended',
  engineeringRequired: 'Engineering Required',
  visualMoistureEvidence: 'Visual Moisture Evidence',
  visualLocations: 'Visual Locations',
  excessiveMoistureEvidence: 'Excessive Moisture Evidence',
  excessiveLocations: 'Excessive Moisture Locations',
  moistureMeterPhotos: 'Moisture Meter Photos',
  thermalImages: 'Thermal Images',
  waterPoolingPhotos: 'Water Pooling Photo Evidence',
  waterPoolingPresent: 'Water Pooling Present',
  waterPoolingCause: 'Water Pooling Cause',
  waterEscapingPhotos: 'Water Escaping Photos',
  moistureEvidencePhotos: 'Moisture Evidence Photos',
  licenceNumber: 'Licence Number',
  declarationDate: 'Declaration Date',
  signatureData: 'Inspector Signature',
  clientSignatureData: 'Client Signature',
  reportComplete: 'Report Complete',
  accessAvailable: 'Access Available',
  noAccessReason: 'Reason No Access',
  floorType: 'Floor Type',
  floorCondition: 'Floor Condition',
  powerPoints: 'Power Points Working',
  smokeAlarm: 'Smoke Alarm',
  lights: 'Lights Working',
  switches: 'Switches',
  splashback: 'Splashback',
  inspectionNotes: 'Inspection Notes',
  disclaimers: 'Disclaimer Statements',
  toiletSeatCondition: 'Toilet Seat Condition',
  toiletCracksDamage: 'Toilet Cracks Damage',
  bathroomType: 'Bathroom Type',
  floorTilesCondition: 'Floor Tiles',
  wallTilesCondition: 'Wall Tiles',
  wallTilesHollowSounding: 'Wall Tiles Hollow Sounding',
  groutMissing: 'Grout Missing',
  groutDeteriorated: 'Grout Deteriorated',
  showerOperating: 'Shower Operating',
  showerDrainage: 'Shower Drainage',
  doorCondition: 'Door',
  doorJambCondition: 'Door Jamb',
  windowCondition: 'Window',
  windowOperating: 'Window Operating',
  lightsWorking: 'Lights Working',
  switchesWorking: 'Switches',
};

export interface SectionFieldDef {
  key: string;
  label: string;
}

function labelForField(key: string): string {
  if (FIELD_LABEL_OVERRIDES[key]) return FIELD_LABEL_OVERRIDES[key]!;
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function fieldsFromSection(section: Record<string, unknown>): SectionFieldDef[] {
  return Object.keys(section)
    .filter((key) => !SKIP_FIELD_KEYS.has(key))
    .map((key) => ({ key, label: labelForField(key) }));
}

let buildingTemplateCache: ReturnType<typeof createEmptyInspectionFormData> | null = null;

function getBuildingTemplate() {
  if (!buildingTemplateCache) {
    buildingTemplateCache = createEmptyInspectionFormData('COMBINED');
  }
  return buildingTemplateCache;
}

export function getSharedSectionFieldDefs(sectionKey: string): SectionFieldDef[] {
  const template = getBuildingTemplate();
  const section = template.shared[sectionKey as keyof typeof template.shared] as unknown as Record<string, unknown>;
  return fieldsFromSection(section);
}

export function getBuildingSectionFieldDefs(sectionKey: string): SectionFieldDef[] {
  const template = getBuildingTemplate();
  if (!template.building) return [];
  const section = template.building[sectionKey as keyof typeof template.building] as unknown as Record<string, unknown>;
  return fieldsFromSection(section);
}

export function getPestSectionFieldDefs(sectionKey: string): SectionFieldDef[] {
  const template = getBuildingTemplate();
  if (!template.pest) return [];
  const section = template.pest[sectionKey as keyof typeof template.pest] as unknown as Record<string, unknown>;
  return fieldsFromSection(section);
}

export function getRoomFieldDefs(roomType: string, roomIndex = 0): SectionFieldDef[] {
  const defaults =
    roomType === 'BEDROOM'
      ? createEmptyBedroomRoom(roomIndex)
      : roomType === 'BATHROOM'
        ? createEmptyBathroomRoom(roomIndex)
        : roomType === 'LIVING'
          ? createEmptyLivingRoom(roomIndex)
          : createEmptyGarageRoom(roomIndex);
  return fieldsFromSection(defaults as unknown as Record<string, unknown>);
}

export function listSharedSectionKeys(): readonly string[] {
  return SHARED_INSPECTION_SECTION_KEYS;
}

export function listBuildingSectionKeys(): readonly string[] {
  return BUILDING_EXTENSION_SECTION_KEYS;
}
