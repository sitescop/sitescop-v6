import {
  normalizeCheckboxField,
  type BuildingExtensionSections,
  type CheckboxFieldState,
  type InspectionFormDataV2,
  type PestInspectionSections,
  type SharedInspectionSections,
  isSubfloorApplicable,
  resolveSubfloorPresent,
} from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { InspectionRoomType } from '@shared/inspection-types';

export type SectionCompletionStatus = 'not_started' | 'in_progress' | 'completed';

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

const hasCheckboxes = (value: CheckboxFieldState | undefined): boolean => {
  const field = normalizeCheckboxField(value);
  return field.selected.length > 0 || field.custom.length > 0;
};

const hasPhotos = (photos: unknown): boolean => Array.isArray(photos) && photos.length > 0;

function sectionActivity(section: object): boolean {
  const record = section as Record<string, unknown> & { comments?: string; photos?: unknown };
  if (hasText(record.comments) || hasPhotos(record.photos)) return true;
  return Object.values(record).some((value) => {
    if (value && typeof value === 'object' && 'selected' in value) {
      return hasCheckboxes(value as CheckboxFieldState);
    }
    return false;
  });
}

function ratingActivity(section: Record<string, unknown>, keys: string[]): { filled: number; total: number } {
  const total = keys.length;
  const filled = keys.filter((key) => hasText(section[key])).length;
  return { filled, total };
}

function resolveStatus(hasActivity: boolean, requiredComplete: boolean): SectionCompletionStatus {
  if (requiredComplete) return 'completed';
  if (hasActivity) return 'in_progress';
  return 'not_started';
}

function checklistStatus(section: object): SectionCompletionStatus {
  if (sectionActivity(section)) return 'completed';
  return 'not_started';
}

export function getInspectorHazardStatus(section: SharedInspectionSections['inspectorHazardAssessment']): SectionCompletionStatus {
  if (hasText(section.autoSummary) || hasCheckboxes(section.hazards)) return 'completed';
  if (hasText(section.overallLevel)) return 'completed';
  return 'not_started';
}

export function getJobInformationStatus(section: SharedInspectionSections['jobInformation']): SectionCompletionStatus {
  const required = [
    hasText(section.clientName),
    hasText(section.propertyAddress),
    hasText(section.inspectionDate),
    hasText(section.inspectionTime),
    hasText(section.weatherConditions),
    hasText(section.occupancyStatus),
    hasText(section.incompleteConstruction),
  ];
  const filled = required.filter(Boolean).length;
  if (filled === required.length) return 'completed';
  if (filled > 0 || hasText(section.clientMobile) || hasText(section.clientEmail) || hasPhotos(section.photos)) {
    return 'in_progress';
  }
  return 'not_started';
}

export function getServicesStatus(section: SharedInspectionSections['services']): SectionCompletionStatus {
  const activity =
    hasCheckboxes(section.waterSupply) ||
    hasCheckboxes(section.sewer) ||
    hasCheckboxes(section.electricity) ||
    hasCheckboxes(section.gas) ||
    hasText(section.hotWaterPresent) ||
    hasText(section.airConPresent) ||
    sectionActivity(section);
  const complete =
    (hasCheckboxes(section.waterSupply) || hasCheckboxes(section.sewer)) &&
    hasText(section.hotWaterPresent) &&
    (sectionActivity(section) || hasText(section.hotWaterOperating));
  return resolveStatus(activity, complete);
}

export function getPropertyDescriptionStatus(section: SharedInspectionSections['propertyDescription']): SectionCompletionStatus {
  const core =
    hasText(section.propertyType) &&
    hasText(section.storeys) &&
    hasText(section.orientation) &&
    hasText(section.positionOnBlock) &&
    hasText(section.subfloorPresent);
  const materials =
    hasCheckboxes(section.walls) ||
    hasCheckboxes(section.roof) ||
    hasCheckboxes(section.floor) ||
    hasCheckboxes(section.frame);
  const activity = core || materials || hasText(section.buildingAgeYears);
  if (core && materials) return 'completed';
  if (activity) return 'in_progress';
  return 'not_started';
}

export function getAccessibilityStatus(
  section: SharedInspectionSections['accessibilityObstructions'],
  subfloorApplicable = true,
): SectionCompletionStatus {
  const activity =
    sectionActivity(section) ||
    hasCheckboxes(section.accessibilityAreas) ||
    hasCheckboxes(section.interiorObstructions) ||
    hasCheckboxes(section.exteriorObstructions) ||
    hasCheckboxes(section.inaccessibleAreas) ||
    (subfloorApplicable && hasCheckboxes(section.subfloorObstructions)) ||
    hasCheckboxes(section.roofSpaceObstructions);
  const complete = hasText(section.undetectedStructuralRisk) && hasText(section.riskExplanation);
  return resolveStatus(activity, complete);
}

export function getSiteConditionsStatus(section: SharedInspectionSections['siteConditions']): SectionCompletionStatus {
  const ratings = [section.landSlope, section.surfaceDrainage, section.evidenceOfWaterPooling].filter(hasText).length;
  if (ratings === 3 || sectionActivity(section)) return 'completed';
  if (ratings > 0 || hasCheckboxes(section.siteDrainageConcerns)) return 'in_progress';
  return 'not_started';
}

export function getKitchenStatus(section: BuildingExtensionSections['kitchen']): SectionCompletionStatus {
  const keys = [
    'cabinetDoorsOperating',
    'cabinetDamage',
    'cabinetCondition',
    'sink',
    'drainage',
    'floorCondition',
    'lights',
    'powerPoints',
  ];
  const { filled, total } = ratingActivity(section as unknown as Record<string, unknown>, keys);
  if (sectionActivity(section) || filled === total) return 'completed';
  if (filled > 0) return 'in_progress';
  return 'not_started';
}

export function getLaundryStatus(section: BuildingExtensionSections['laundry']): SectionCompletionStatus {
  const keys = ['cabinetDamage', 'drainage', 'floorCondition', 'lights', 'powerPoints'];
  const { filled, total } = ratingActivity(section as unknown as Record<string, unknown>, keys);
  if (sectionActivity(section) || filled === total) return 'completed';
  if (filled > 0) return 'in_progress';
  return 'not_started';
}

export function getConclusionStatus(section: BuildingExtensionSections['conclusion']): SectionCompletionStatus {
  const ratings = [
    section.structuralDamageRating,
    section.overallBuildingCondition,
    section.overallComparison,
  ].filter(hasText).length;
  if (ratings >= 3 && hasText(section.autoConclusion)) return 'completed';
  if (ratings > 0 || hasText(section.autoConclusion)) return 'in_progress';
  return 'not_started';
}

export function getInspectorDeclarationStatus(section: BuildingExtensionSections['inspectorDeclaration']): SectionCompletionStatus {
  if (hasText(section.inspectorName) && hasText(section.licenceNumber) && hasText(section.signatureData)) {
    return 'completed';
  }
  if (hasText(section.inspectorName) || hasText(section.licenceNumber) || hasText(section.declarationDate)) {
    return 'in_progress';
  }
  return 'not_started';
}

export function getPestSectionStatus(
  sectionKey: keyof PestInspectionSections,
  section: PestInspectionSections[keyof PestInspectionSections],
): SectionCompletionStatus {
  if (sectionKey === 'pestConclusion') {
    const conclusion = section as PestInspectionSections['pestConclusion'];
    if (hasText(conclusion.autoConclusion) && hasText(conclusion.inspectorName) && hasText(conclusion.signatureData)) {
      return 'completed';
    }
    if (hasText(conclusion.autoConclusion) || hasText(conclusion.inspectorName)) return 'in_progress';
    return 'not_started';
  }

  if (sectionKey === 'undetectedTimberPestRisk') {
    const risk = section as PestInspectionSections['undetectedTimberPestRisk'];
    if (hasText(risk.riskLevel) && hasText(risk.riskExplanation)) return 'completed';
    if (hasText(risk.riskLevel)) return 'in_progress';
    return 'not_started';
  }

  if (sectionKey === 'd5FutureInspection') {
    const d5 = section as PestInspectionSections['d5FutureInspection'];
    return hasText(d5.frequency) ? 'completed' : 'not_started';
  }

  if (sectionKey === 'd2ManagementProposal') {
    const d2 = section as PestInspectionSections['d2ManagementProposal'];
    return hasText(d2.recommendation) ? 'completed' : 'not_started';
  }

  return checklistStatus(section);
}

export function getRoomSectionStatus(rooms: InspectionRoomDetail[], roomType: InspectionRoomType): SectionCompletionStatus {
  const typed = rooms.filter((room) => room.roomType === roomType);
  if (typed.length === 0) return 'not_started';

  const statuses = typed.map((room) => checklistStatus(room.data as Record<string, unknown>));
  if (statuses.every((status) => status === 'completed')) return 'completed';
  if (statuses.some((status) => status !== 'not_started')) return 'in_progress';
  return 'not_started';
}

export function buildPestSectionStatuses(
  pest: PestInspectionSections,
  subfloorApplicable = true,
): Record<string, SectionCompletionStatus> {
  const statuses: Record<string, SectionCompletionStatus> = {
    'pest-risk': getPestSectionStatus('undetectedTimberPestRisk', pest.undetectedTimberPestRisk),
    'pest-conclusion': getPestSectionStatus('pestConclusion', pest.pestConclusion),
  };

  for (const key of [
    'd1ActiveTermites',
    'd2ManagementProposal',
    'd3TermiteWorkings',
    'd4PreviousTreatment',
    'd5FutureInspection',
    'd6ChemicalDelignification',
    'd7FungalDecay',
    'd8WoodBorers',
    'd9SubfloorVentilation',
    'd10ExcessiveMoisture',
    'd11BarrierBridging',
    'd13ConduciveConditions',
    'd14MajorSafetyHazards',
  ] as const) {
    statuses[`pest-${key}`] =
      key === 'd9SubfloorVentilation' && !subfloorApplicable
        ? 'completed'
        : getPestSectionStatus(key, pest[key]);
  }

  return statuses;
}

export function buildInspectionSectionStatuses(
  formData: InspectionFormDataV2,
  rooms: InspectionRoomDetail[] = [],
): Record<string, SectionCompletionStatus> {
  const shared = formData.shared;
  const building = formData.building;
  const pest = formData.pest;
  const subfloorPresent = resolveSubfloorPresent(
    shared.propertyDescription,
    building?.subfloor,
    shared.accessibilityObstructions,
  );
  const subfloorApplicable = isSubfloorApplicable(subfloorPresent);

  const statuses: Record<string, SectionCompletionStatus> = {
    'inspector-hazard': getInspectorHazardStatus(shared.inspectorHazardAssessment),
    'job-information': getJobInformationStatus(shared.jobInformation),
    services: getServicesStatus(shared.services),
    'property-description': getPropertyDescriptionStatus(shared.propertyDescription),
    accessibility: getAccessibilityStatus(shared.accessibilityObstructions, subfloorApplicable),
    'site-conditions': getSiteConditionsStatus(shared.siteConditions),
    external: checklistStatus(shared.external),
    'roof-exterior': checklistStatus(shared.roofExterior),
    'roof-space': checklistStatus(shared.roofSpace),
    bathrooms: getRoomSectionStatus(rooms, InspectionRoomType.BATHROOM),
    bedrooms: getRoomSectionStatus(rooms, InspectionRoomType.BEDROOM),
    'living-areas': getRoomSectionStatus(rooms, InspectionRoomType.LIVING),
    garage: getRoomSectionStatus(rooms, InspectionRoomType.GARAGE),
  };

  if (building) {
    statuses.kitchen = getKitchenStatus(building.kitchen);
    statuses.laundry = getLaundryStatus(building.laundry);
    statuses.subfloor = subfloorApplicable ? checklistStatus(building.subfloor) : 'completed';
    statuses.fencing = checklistStatus(building.fencing);
    statuses.outbuildings = checklistStatus(building.outbuildings);
    statuses.corrosion = checklistStatus(building.corrosion);
    statuses['minor-defects'] = checklistStatus(building.minorDefects);
    statuses['major-defects'] = checklistStatus(building.majorDefects);
    statuses['thermal-imaging'] = checklistStatus(building.thermalImaging);
    statuses['moisture-testing'] = checklistStatus(building.moistureTesting);
    statuses.conclusion = getConclusionStatus(building.conclusion);
    statuses.recommendations =
      building.recommendations.manualRecommendations.length > 0 ||
      building.recommendations.autoRecommendations.length > 0
        ? 'completed'
        : 'not_started';
    statuses['inspector-declaration'] = getInspectorDeclarationStatus(building.inspectorDeclaration);
  }

  if (pest) {
    statuses['pest-risk'] = getPestSectionStatus('undetectedTimberPestRisk', pest.undetectedTimberPestRisk);
    for (const key of [
      'd1ActiveTermites',
      'd2ManagementProposal',
      'd3TermiteWorkings',
      'd4PreviousTreatment',
      'd5FutureInspection',
      'd6ChemicalDelignification',
      'd7FungalDecay',
      'd8WoodBorers',
      'd9SubfloorVentilation',
      'd10ExcessiveMoisture',
      'd11BarrierBridging',
      'd13ConduciveConditions',
      'd14MajorSafetyHazards',
    ] as const) {
      statuses[`pest-${key}`] =
        key === 'd9SubfloorVentilation' && !subfloorApplicable
          ? 'completed'
          : getPestSectionStatus(key, pest[key]);
    }
    statuses['pest-conclusion'] = getPestSectionStatus('pestConclusion', pest.pestConclusion);
  }

  return statuses;
}
