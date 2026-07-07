import { emptyCheckboxField, emptySectionBase, normalizeCheckboxField } from './defaults.js';
import type { InspectorHazardAssessmentSection } from './types.js';
import { HAZARD_ASSESSMENT_LEVELS, INSPECTOR_HAZARD_PRESETS } from './options.js';

const ANIMAL_HAZARD_PATTERN = /aggressive dog|dangerous|unrestrained animal/i;
const AGGRESSIVE_CLIENT_PATTERN = /aggressive|hostile client/i;

export function createEmptyInspectorHazardAssessment(): InspectorHazardAssessmentSection {
  const base = emptySectionBase();
  return {
    ...base,
    hazards: emptyCheckboxField(),
    overallLevel: HAZARD_ASSESSMENT_LEVELS[0],
    inspectionOutcome: 'Full inspection conducted',
    clientAdvised: 'No',
    rebookingRequired: 'No',
    autoSummary: '',
  };
}

function hazardItems(section: InspectorHazardAssessmentSection): string[] {
  const field = normalizeCheckboxField(section.hazards);
  return [...field.selected, ...field.custom].filter(Boolean);
}

function hasAnimalHazard(hazards: string[]): boolean {
  return hazards.some((item) => ANIMAL_HAZARD_PATTERN.test(item));
}

function hasAggressiveClient(hazards: string[]): boolean {
  return hazards.some((item) => AGGRESSIVE_CLIENT_PATTERN.test(item));
}

function blocksInspection(hazards: string[]): boolean {
  return hasAnimalHazard(hazards) || hasAggressiveClient(hazards);
}

export function suggestInspectorHazardLevel(hazards: string[]): string {
  if (hazards.length === 0) return 'Low';
  if (hasAnimalHazard(hazards) || hasAggressiveClient(hazards)) return 'High';
  return 'Moderate';
}

export function resolveInspectorHazardLevel(
  storedLevel: string | undefined,
  hazards: string[],
): string {
  if (hazards.length === 0) return 'Low';
  const trimmed = storedLevel?.trim();
  if (trimmed && trimmed !== 'Low') return trimmed;
  return suggestInspectorHazardLevel(hazards);
}

function formatHazardList(hazards: string[]): string {
  return hazards.join('; ');
}

export function isLowInspectorHazardLevel(section: InspectorHazardAssessmentSection): boolean {
  return (section.overallLevel?.trim() || 'Low') === 'Low';
}

export const INSPECTOR_HAZARD_LOW_CONCLUSION_TEXT =
  'Before entering the property, an inspector hazard assessment was carried out at the door on arrival. The risk of danger to the inspector before entering the house is low. The inspection proceeded as scheduled.';

export function generateInspectorHazardSummary(
  section: InspectorHazardAssessmentSection,
): string {
  const hazards = hazardItems(section);
  const level = section.overallLevel.trim() || 'Low';

  if (hazards.length === 0) {
    return `Before entering the property, an inspector hazard assessment was carried out at the door on arrival. No aggressive dog, dangerous or unrestrained animal, or aggressive or hostile client behaviour was identified. Overall inspector hazard level: ${level}. The inspection proceeded as scheduled.`;
  }

  const hazardList = formatHazardList(hazards);
  const intro = `Before entering the property, an inspector hazard assessment was carried out at the door on arrival. The following was identified: ${hazardList}. Overall inspector hazard level: ${level}.`;

  if (hasAnimalHazard(hazards)) {
    return `${intro}\n\nDue to an aggressive dog or dangerous/unrestrained animal present before entry, the inspection could not be safely conducted. The inspector did not enter the property. The client was advised that the animal must be restrained or removed before inspection can proceed, and that a further appointment is required.`;
  }

  if (hasAggressiveClient(hazards)) {
    return `${intro}\n\nDue to aggressive or hostile client behaviour at the door before entry, the inspection could not be safely conducted. The inspector withdrew without entering the property. The client was advised that a further appointment is required once access can be provided safely.`;
  }

  return `${intro}\n\nThe client was advised of the condition identified at the door before entry. The inspection proceeded only where it was safe to do so.`;
}

function deriveInspectionOutcome(hazards: string[]): string {
  if (blocksInspection(hazards)) return 'Inspection not conducted';
  if (hazards.length > 0) return 'Inspection proceeded with caution';
  return 'Full inspection conducted';
}

export function applyInspectorHazardAssessment(
  section: InspectorHazardAssessmentSection,
): InspectorHazardAssessmentSection {
  const hazards = hazardItems(section);
  const overallLevel = resolveInspectorHazardLevel(section.overallLevel, hazards);
  const inspectionOutcome = deriveInspectionOutcome(hazards);
  const blocking = blocksInspection(hazards);

  return {
    ...section,
    overallLevel,
    inspectionOutcome,
    clientAdvised: hazards.length > 0 ? 'Yes' : 'No',
    rebookingRequired: blocking ? 'Yes' : hazards.length > 0 ? 'No' : 'No',
    autoSummary: generateInspectorHazardSummary({
      ...section,
      overallLevel,
    }),
  };
}

export { HAZARD_ASSESSMENT_LEVELS, INSPECTOR_HAZARD_PRESETS };
