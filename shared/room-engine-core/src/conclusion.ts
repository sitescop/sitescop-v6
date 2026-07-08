import type { BuildingInspectionFormData, ConclusionSection, MajorDefectsSection } from './types.js';
import {
  generateMajorDefectAutoRecommendations,
  generateMajorDefectConclusionAddendum,
  suggestConclusionRatingsFromMajorDefects,
} from './major-defects-conclusion.js';

const CONCLUSION_TEMPLATES: Record<string, string> = {
  Average: `In conclusion, following the inspection of the readily accessible areas of the property, the overall condition of the building relative to similar buildings of approximately the same age that have been reasonably maintained was considered to be AVERAGE.

A number of minor defects and maintenance items may be present; however, these are generally consistent with a building of this age and type.`,
  'Above Average': `In conclusion, following the inspection of the readily accessible areas of the property, the overall condition of the building relative to similar buildings of approximately the same age that have been reasonably maintained was considered to be ABOVE AVERAGE.

The building generally appeared to be in sound condition with fewer defects than would normally be expected for a property of similar age.`,
  'Below Average': `In conclusion, following the inspection of the readily accessible areas of the property, the overall condition of the building relative to similar buildings of approximately the same age that have been reasonably maintained was considered to be BELOW AVERAGE.

A number of defects, maintenance concerns and/or conditions requiring further investigation were identified during the inspection.`,
  'Well Above Average': `In conclusion, following the inspection of the readily accessible areas of the property, the overall condition of the building relative to similar buildings of approximately the same age that have been reasonably maintained was considered to be WELL ABOVE AVERAGE.

The building appeared to be in notably good condition for its age and type.`,
  'Well Below Average': `In conclusion, following the inspection of the readily accessible areas of the property, the overall condition of the building relative to similar buildings of approximately the same age that have been reasonably maintained was considered to be WELL BELOW AVERAGE.

Significant defects and conditions requiring urgent attention were identified during the inspection.`,
};

export function generateAutoConclusion(comparison: string): string {
  return CONCLUSION_TEMPLATES[comparison] ?? '';
}

export function generateRiskExplanation(riskLevel: string): string {
  return `Due to the level of accessibility for inspection including the presence of obstructions, the overall degree of risk of Undetected Structural Damage and Conditions Conducive to Structural Damage was considered: ${riskLevel}.`;
}

export function generateAutoRecommendations(form: BuildingInspectionFormData): string[] {
  const recommendations: string[] = [
    ...generateMajorDefectAutoRecommendations(form.majorDefects),
  ];

  if (form.moistureTesting.excessiveMoistureEvidence === 'Yes') {
    recommendations.push('Waterproofing Contractor Recommended');
  }
  if (form.siteConditions.evidenceOfWaterPooling === 'Yes') {
    recommendations.push('Drainage Improvements Recommended');
  }
  if (form.services.hotWaterOperating === 'No') {
    recommendations.push('Licensed Plumber Recommended');
  }
  if (form.kitchen.powerPoints.includes('Damaged') || form.laundry.powerPoints.includes('Damaged')) {
    recommendations.push('Licensed Electrician Recommended');
  }

  return [...new Set(recommendations.map((item) => item.trim()).filter(Boolean))];
}

export function applyConclusionUpdates(
  conclusion: ConclusionSection,
  majorDefects?: MajorDefectsSection,
): ConclusionSection {
  const ratingSuggestions = majorDefects
    ? suggestConclusionRatingsFromMajorDefects(majorDefects, conclusion)
    : {};
  const merged = { ...conclusion, ...ratingSuggestions };
  const base = generateAutoConclusion(merged.overallComparison);
  const addendum = majorDefects ? generateMajorDefectConclusionAddendum(majorDefects) : '';
  const autoConclusion = [base, addendum].filter(Boolean).join('\n\n');
  return { ...merged, autoConclusion };
}

export function calculateFormProgress(form: BuildingInspectionFormData): number {
  const keys = Object.keys(form) as (keyof BuildingInspectionFormData)[];
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

  keys.forEach((key) => walk(form[key]));
  if (total === 0) return 0;
  return Math.min(100, Math.round((filled / total) * 100));
}
