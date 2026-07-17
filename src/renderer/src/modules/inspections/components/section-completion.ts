import {
  NO_EVIDENCE_FOUND,
  NO_MAJOR_DEFECT_OBSERVED_COMMENT,
  isNoMajorDefectObserved,
  isMajorDefectObserved,
  normalizeCheckboxField,
  isPestEvidenceFound,
  isPestNoEvidenceFound,
  isPestPresenceUndetermined,
  PRESENCE_UNDETERMINED,
  SUBFLOOR_VENTILATION_NOT_APPLICABLE,
  type BuildingExtensionSections,
  type CheckboxFieldState,
  type GarageRoomData,
  type InspectionFormDataV2,
  type MoistureTestingSection,
  type PestInspectionSections,
  type SharedInspectionSections,
  type ThermalImagingSection,
  isSubfloorApplicable,
  resolveSubfloorPresent,
} from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { InspectionRoomType } from '@shared/inspection-types';

export type SectionCompletionStatus = 'not_started' | 'in_progress' | 'completed';

/** Accordion colour from saved form content (with open section shown as in-progress unless already complete). */
export function resolveWorkflowSectionStatus(
  sectionId: string,
  openId: string | null,
  visitedIds: ReadonlySet<string>,
  completedIds: ReadonlySet<string>,
): SectionCompletionStatus {
  if (openId === sectionId) return 'in_progress';
  if (completedIds.has(sectionId)) return 'completed';
  if (visitedIds.has(sectionId)) return 'in_progress';
  return 'not_started';
}

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
  if (isNoMajorDefectObserved(section as { noMajorDefectObserved?: boolean; comments?: string })) {
    return 'completed';
  }
  if (isMajorDefectObserved(section as { majorDefectObserved?: boolean; comments?: string })) {
    return 'completed';
  }
  if (sectionActivity(section)) return 'completed';
  return 'not_started';
}

function evidenceSummaryStatus(
  summaryAnswer: string | undefined,
  section: object,
  evidenceFound: boolean,
): SectionCompletionStatus {
  if (!hasText(summaryAnswer)) return 'not_started';
  if (!evidenceFound) return 'completed';
  if (sectionActivity(section)) return 'completed';
  return 'in_progress';
}

function yesNoEvidenceStatus(
  evidenceAnswer: string | undefined,
  section: object,
): SectionCompletionStatus {
  if (!hasText(evidenceAnswer)) return 'not_started';
  if (!isPestEvidenceFound(evidenceAnswer)) return 'completed';
  if (sectionActivity(section)) return 'completed';
  return 'in_progress';
}

function narrativeAnswerStatus(
  answer: string | undefined,
  section: object,
  noEvidenceAnswers: readonly string[],
): SectionCompletionStatus {
  const resolved = typeof answer === 'string' ? answer.trim() : '';
  if (!resolved) return 'not_started';
  if (
    noEvidenceAnswers.includes(resolved) ||
    isPestNoEvidenceFound(resolved) ||
    isPestPresenceUndetermined(resolved)
  ) {
    return 'completed';
  }
  if (sectionActivity(section)) return 'completed';
  return 'in_progress';
}

function hasNoIssuesComment(comments: string | undefined): boolean {
  const text = comments?.trim() ?? '';
  return text.length > 0 && text.includes(NO_MAJOR_DEFECT_OBSERVED_COMMENT);
}

function getGarageRoomStatus(data: Record<string, unknown>): SectionCompletionStatus {
  const garage = data as unknown as GarageRoomData;
  if (isNoMajorDefectObserved(garage)) return 'completed';
  if (isMajorDefectObserved(garage)) return 'completed';
  if (hasCheckboxes(garage.defects) || hasCheckboxes(garage.damageObserved)) return 'completed';
  if (sectionActivity(garage)) return 'completed';
  return 'not_started';
}

function moistureThermalActivity(moisture: MoistureTestingSection): boolean {
  if (sectionActivity(moisture)) return true;
  if (hasPhotos(moisture.moistureMeterPhotos) || hasPhotos(moisture.thermalImages)) return true;
  return hasCheckboxes(moisture.visualLocations) || hasCheckboxes(moisture.excessiveLocations);
}

export function getMoistureThermalStatus(
  moisture: MoistureTestingSection,
  thermal: ThermalImagingSection,
): SectionCompletionStatus {
  if (moisture.visualMoistureEvidence === 'Yes' || moisture.excessiveMoistureEvidence === 'Yes') {
    return 'completed';
  }
  if (hasNoIssuesComment(moisture.comments) || isNoMajorDefectObserved(moisture) || isMajorDefectObserved(moisture)) return 'completed';
  if (moistureThermalActivity(moisture) || sectionActivity(thermal)) return 'completed';
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
    hasText(section.rainwaterTankPresent) ||
    sectionActivity(section);
  const complete =
    (hasCheckboxes(section.waterSupply) || hasCheckboxes(section.sewer)) &&
    hasText(section.hotWaterPresent) &&
    (sectionActivity(section) || hasText(section.hotWaterOperating));
  return resolveStatus(activity, complete);
}

export function getPropertyDescriptionStatus(
  section: SharedInspectionSections['propertyDescription'],
  resolvedSubfloorPresent?: string,
): SectionCompletionStatus {
  const subfloorAnswer = hasText(section.subfloorPresent)
    ? section.subfloorPresent
    : resolvedSubfloorPresent?.trim() ?? '';

  const hasPropertyType =
    hasText(section.propertyType) &&
    (section.propertyType !== 'Other' || hasText(section.propertyTypeOther));

  const core =
    hasPropertyType &&
    hasText(section.storeys) &&
    hasText(section.orientation) &&
    hasText(section.positionOnBlock) &&
    hasText(subfloorAnswer);

  const materials =
    hasCheckboxes(section.walls) ||
    hasCheckboxes(section.roof) ||
    hasCheckboxes(section.floor) ||
    hasCheckboxes(section.frame) ||
    hasCheckboxes(section.fencing);

  if (core && (materials || sectionActivity(section))) {
    return 'completed';
  }

  const activity =
    hasPropertyType ||
    hasText(subfloorAnswer) ||
    materials ||
    hasText(section.buildingAgeYears) ||
    hasText(section.storeys) ||
    hasText(section.orientation) ||
    hasText(section.positionOnBlock) ||
    section.bedroomCount > 0 ||
    section.bathroomCount > 0 ||
    section.livingAreaCount > 0 ||
    section.garageCount > 0 ||
    sectionActivity(section);

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
  if (isNoMajorDefectObserved(section) || isMajorDefectObserved(section)) return 'completed';
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
  if (isNoMajorDefectObserved(section) || isMajorDefectObserved(section)) return 'completed';
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
  if (section.sectionReviewed) return 'completed';
  if (hasText(section.inspectorName) && hasText(section.signatureData)) {
    return 'completed';
  }
  if (hasText(section.inspectorName) || hasText(section.declarationDate)) {
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
    if (hasText(risk.riskLevel)) return 'completed';
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

  if (sectionKey === 'd1ActiveTermites') {
    const d1 = section as PestInspectionSections['d1ActiveTermites'];
    if (!hasText(d1.evidenceAnswer)) return 'not_started';
    if (isPestNoEvidenceFound(d1.evidenceAnswer) || isPestPresenceUndetermined(d1.evidenceAnswer)) {
      return 'completed';
    }
    if (sectionActivity(d1)) return 'completed';
    return 'in_progress';
  }

  if (sectionKey === 'd3TermiteWorkings') {
    const d3 = section as PestInspectionSections['d3TermiteWorkings'];
    return evidenceSummaryStatus(d3.summaryAnswer, d3, isPestEvidenceFound(d3.summaryAnswer));
  }

  if (sectionKey === 'd4PreviousTreatment') {
    const d4 = section as PestInspectionSections['d4PreviousTreatment'];
    return yesNoEvidenceStatus(d4.evidenceAnswer, d4);
  }

  if (sectionKey === 'd6ChemicalDelignification') {
    const d6 = section as PestInspectionSections['d6ChemicalDelignification'];
    return evidenceSummaryStatus(d6.summaryAnswer, d6, isPestEvidenceFound(d6.summaryAnswer));
  }

  if (sectionKey === 'd7FungalDecay') {
    const d7 = section as PestInspectionSections['d7FungalDecay'];
    return evidenceSummaryStatus(d7.summaryAnswer, d7, isPestEvidenceFound(d7.summaryAnswer));
  }

  if (sectionKey === 'd8WoodBorers') {
    const d8 = section as PestInspectionSections['d8WoodBorers'];
    return narrativeAnswerStatus(d8.answer, d8, [
      NO_EVIDENCE_FOUND,
      'No evidence was found.',
      PRESENCE_UNDETERMINED,
    ]);
  }

  if (sectionKey === 'd9SubfloorVentilation') {
    const d9 = section as PestInspectionSections['d9SubfloorVentilation'];
    return narrativeAnswerStatus(d9.answer, d9, [
      SUBFLOOR_VENTILATION_NOT_APPLICABLE,
      NO_EVIDENCE_FOUND,
      'No evidence was found.',
      'Undetermined due to access restrictions.',
    ]);
  }

  if (sectionKey === 'd10ExcessiveMoisture') {
    const d10 = section as PestInspectionSections['d10ExcessiveMoisture'];
    return narrativeAnswerStatus(d10.answer, d10, [
      NO_EVIDENCE_FOUND,
      'No evidence was found.',
      PRESENCE_UNDETERMINED,
    ]);
  }

  if (sectionKey === 'd11BarrierBridging') {
    const d11 = section as PestInspectionSections['d11BarrierBridging'];
    return evidenceSummaryStatus(d11.summaryAnswer, d11, isPestEvidenceFound(d11.summaryAnswer));
  }

  if (sectionKey === 'd12UntreatedTimber') {
    const d12 = section as PestInspectionSections['d12UntreatedTimber'];
    return evidenceSummaryStatus(d12.summaryAnswer, d12, isPestEvidenceFound(d12.summaryAnswer));
  }

  if (sectionKey === 'd13ConduciveConditions') {
    const d13 = section as PestInspectionSections['d13ConduciveConditions'];
    if (hasText(d13.summaryDuringInspection) && hasText(d13.otherEvidenceAnswer)) {
      if (isPestNoEvidenceFound(d13.otherEvidenceAnswer) || sectionActivity(d13)) return 'completed';
      return 'in_progress';
    }
    if (sectionActivity(d13)) return 'in_progress';
    return 'not_started';
  }

  if (sectionKey === 'd14MajorSafetyHazards') {
    const d14 = section as PestInspectionSections['d14MajorSafetyHazards'];
    return evidenceSummaryStatus(
      d14.summaryAnswer,
      d14,
      d14.summaryAnswer === 'Hazard Found' || isPestEvidenceFound(d14.summaryAnswer),
    );
  }

  return checklistStatus(section);
}

export function getSingleRoomStatus(
  room: InspectionRoomDetail,
  roomType: InspectionRoomType = room.roomType,
): SectionCompletionStatus {
  const data = room.data as {
    noMajorDefectObserved?: boolean;
    majorDefectObserved?: boolean;
    comments?: string;
  };
  if (isNoMajorDefectObserved(data) || isMajorDefectObserved(data)) return 'completed';
  return roomType === InspectionRoomType.GARAGE
    ? getGarageRoomStatus(room.data as Record<string, unknown>)
    : checklistStatus(room.data as Record<string, unknown>);
}

export function getRoomSectionStatus(rooms: InspectionRoomDetail[], roomType: InspectionRoomType): SectionCompletionStatus {
  const typed = rooms.filter((room) => room.roomType === roomType);
  if (typed.length === 0) return 'not_started';

  const statuses = typed.map((room) => getSingleRoomStatus(room, roomType));
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
    'd12UntreatedTimber',
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
    'property-description': getPropertyDescriptionStatus(shared.propertyDescription, subfloorPresent),
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
    statuses['moisture-testing'] = getMoistureThermalStatus(
      building.moistureTesting,
      building.thermalImaging,
    );
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
      'd12UntreatedTimber',
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
