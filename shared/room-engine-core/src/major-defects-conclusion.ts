import { normalizeCheckboxField } from './defaults.js';
import {
  applyDerivedMajorDefectFields,
  generateDeformationTradeRecommendations,
  generateFinishElementConduciveRecommendations,
  generateMoistureTradeRecommendations,
  normalizeFinishElementDamageEntry,
} from './major-defects-rules.js';
import type { CheckboxFieldState, ConclusionSection, MajorDefectsSection } from './types.js';

function checkboxItems(field: CheckboxFieldState | undefined): string[] {
  const normalized = normalizeCheckboxField(field);
  return [...normalized.selected, ...normalized.custom].filter(Boolean);
}

function includesItem(field: CheckboxFieldState | undefined, item: string): boolean {
  const target = item.trim().toLowerCase();
  return checkboxItems(field).some((entry) => entry.trim().toLowerCase() === target);
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function generateMajorDefectAutoRecommendations(majorDefects: MajorDefectsSection): string[] {
  const derived = applyDerivedMajorDefectFields(majorDefects);
  const recs: string[] = [];
  const structural = checkboxItems(derived.structuralMovement);
  const deformation = checkboxItems(derived.deformation);
  const safety = checkboxItems(derived.safetyHazards);
  const notInspected = checkboxItems(derived.areasNotInspected);
  const cracking = derived.crackingEntries ?? [];

  if (
    structural.length > 0 ||
    derived.structuralEngineeringRequired === 'Yes' ||
    derived.deformationEngineeringRequired === 'Yes' ||
    cracking.some((entry) => entry.engineeringRequired === 'Yes')
  ) {
    recs.push('Structural Engineer Recommended');
  }

  if (cracking.some((entry) => entry.monitoringRecommended === 'Yes')) {
    recs.push('Monitor identified cracking and seek further advice if movement or widening progresses.');
  }

  recs.push(...generateMoistureTradeRecommendations(derived));
  recs.push(...generateDeformationTradeRecommendations(derived));
  recs.push(...generateFinishElementConduciveRecommendations(derived));

  if (includesItem(derived.safetyHazards, 'Electrical Hazard')) {
    recs.push('Licensed Electrician Recommended');
  }
  if (safety.some((item) => /asbestos/i.test(item))) {
    recs.push('Engage a licensed asbestos assessor or removalist if asbestos-containing materials are suspected.');
  }
  if (safety.length > 0) {
    recs.push(`Address major safety hazards identified during inspection: ${safety.join(', ')}.`);
  }

  if (notInspected.length > 0) {
    recs.push(
      'Further inspection is recommended when inaccessible or obstructed areas can be made safely available.',
    );
  }

  if (structural.length > 0) {
    recs.push(`Investigate structural movement noted to: ${structural.join(', ')}.`);
  }
  if (deformation.length > 0) {
    recs.push(`Investigate deformation or sagging noted to: ${deformation.join(', ')}.`);
  }

  return unique(recs);
}

export function generateMajorDefectConclusionAddendum(majorDefects: MajorDefectsSection): string {
  const parts: string[] = [];
  const structural = checkboxItems(majorDefects.structuralMovement);
  const deformation = checkboxItems(majorDefects.deformation);
  const moisture = checkboxItems(majorDefects.moistureSources);
  const conducive = checkboxItems(majorDefects.conditionsConducive);
  const safety = checkboxItems(majorDefects.safetyHazards);
  const notInspected = checkboxItems(majorDefects.areasNotInspected);
  const cracking = majorDefects.crackingEntries ?? [];

  if (structural.length) {
    parts.push(`Structural movement was noted affecting: ${structural.join(', ')}.`);
  }
  if (deformation.length) {
    parts.push(`Deformation or sagging was observed to: ${deformation.join(', ')}.`);
  }
  if (cracking.length) {
    const locations = cracking.map((entry) => entry.location).filter(Boolean);
    if (locations.length) {
      parts.push(`Cracking was recorded in the cracking register for: ${locations.join(', ')}.`);
    }
  }
  if (moisture.length) {
    parts.push(`Sources of moisture were identified including: ${moisture.join(', ')}.`);
  }
  if (conducive.length) {
    parts.push(
      `Conditions conducive to finish element damage were noted including: ${conducive.join(', ')}.`,
    );
  }
  const finishDamage = (majorDefects.finishElementDamageEntries ?? []).map(normalizeFinishElementDamageEntry);
  if (finishDamage.length) {
    const items = finishDamage
      .map((entry) => {
        const elements = [...entry.elements.selected, ...entry.elements.custom].filter(Boolean).join(', ');
        return [elements, entry.location].filter(Boolean).join(' — ');
      })
      .filter(Boolean);
    if (items.length) {
      parts.push(`Finish element damage was recorded including: ${items.join('; ')}.`);
    }
  }
  if (safety.length) {
    parts.push(`Major safety hazards were identified including: ${safety.join(', ')}.`);
  }
  if (notInspected.length) {
    parts.push(`The following areas were not fully inspected: ${notInspected.join('; ')}.`);
  }

  if (!parts.length) return '';
  return `Major defects and significant items identified during this inspection include the following. ${parts.join(' ')} Refer to the Major Defects section and recommendations for further action.`;
}

export function suggestConclusionRatingsFromMajorDefects(
  majorDefects: MajorDefectsSection,
  conclusion: ConclusionSection,
): Partial<ConclusionSection> {
  const structural = checkboxItems(majorDefects.structuralMovement);
  const deformation = checkboxItems(majorDefects.deformation);
  const moisture = checkboxItems(majorDefects.moistureSources);
  const conducive = checkboxItems(majorDefects.conditionsConducive);
  const safety = checkboxItems(majorDefects.safetyHazards);
  const cracking = majorDefects.crackingEntries ?? [];

  const hasStructuralIssue =
    structural.length > 0 ||
    deformation.length > 0 ||
    cracking.length > 0 ||
    majorDefects.structuralEngineeringRequired === 'Yes' ||
    majorDefects.deformationEngineeringRequired === 'Yes';
  const hasMajorDefectSignal =
    hasStructuralIssue || moisture.length > 0 || safety.length > 0 || conducive.length > 0;

  const updates: Partial<ConclusionSection> = {};
  if (!conclusion.structuralDamageRating.trim() && hasStructuralIssue) {
    updates.structuralDamageRating = 'High';
  }
  if (!conclusion.conditionsConduciveRating.trim() && conducive.length > 0) {
    updates.conditionsConduciveRating = 'Above Average';
  }
  if (!conclusion.majorDefectsRating.trim() && hasMajorDefectSignal) {
    updates.majorDefectsRating = 'High';
  }
  if (!conclusion.overallBuildingCondition.trim() && hasMajorDefectSignal) {
    updates.overallBuildingCondition = 'Below Average';
  }
  if (!conclusion.overallComparison.trim() && hasMajorDefectSignal) {
    updates.overallComparison = 'Below Average';
  }

  return updates;
}
