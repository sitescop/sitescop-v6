import { normalizeCheckboxField } from './defaults.js';
import type { AccessibilityObstructionsSection } from './types.js';

const LOW_RISK = 'Low';

export const DEFAULT_STRUCTURAL_UNDETECTED_RISK = 'Moderate';
export const DEFAULT_TIMBER_PEST_UNDETECTED_RISK = LOW_RISK;

const IGNORED_REASONS = new Set(['Not applicable', 'All areas permitted entry']);

export type UndetectedRiskVariant = 'structural' | 'timber-pest';

export function collectAccessibilityRiskReasons(section: AccessibilityObstructionsSection): string[] {
  const reasons: string[] = [];
  const groups = [
    { label: 'Interior obstruction', state: section.interiorObstructions },
    { label: 'Exterior obstruction', state: section.exteriorObstructions },
    { label: 'Roof space obstruction', state: section.roofSpaceObstructions },
    { label: 'Subfloor obstruction', state: section.subfloorObstructions },
    { label: 'Inaccessible area', state: section.inaccessibleAreas },
  ];

  for (const group of groups) {
    const field = normalizeCheckboxField(group.state);
    for (const item of [...field.selected, ...field.custom]) {
      const text = item.trim();
      if (!text || IGNORED_REASONS.has(text)) continue;
      reasons.push(`${group.label}: ${text}`);
    }
  }

  for (const line of section.inaccessibleCustomLines ?? []) {
    const text = line.trim();
    if (text) reasons.push(text);
  }

  return [...new Set(reasons)];
}

export function suggestUndetectedRiskLevel(reasons: string[]): string {
  if (reasons.length === 0) return LOW_RISK;

  const text = reasons.join(' ').toLowerCase();
  const hasAnimal = /animal|pest activity|dog|cat|snake/.test(text);
  const hasSafety = /unsafe|electrical hazard|foil insulation|health and safety/.test(text);
  const hasMajorAccess = /no roof space|locked|insufficient|subfloor access obstructed|stored goods restricting|furniture restricting|vegetation restricting|moisture\/flooding/.test(
    text,
  );

  if (hasSafety && reasons.length >= 2) return 'Extreme';
  if (hasAnimal && hasMajorAccess) return 'High';
  if (hasAnimal || hasSafety) return 'Moderate To High';
  if (hasMajorAccess || reasons.length >= 4) return 'Moderate To High';
  if (reasons.length >= 2) return 'Moderate';
  return 'Low To Moderate';
}

function isLowRiskLevel(riskLevel: string): boolean {
  return riskLevel === 'Low' || riskLevel === 'Low To Moderate';
}

export function resolveUndetectedRiskLevel(
  storedRiskLevel: string | undefined,
  reasons: string[],
  defaultWhenClear: string = LOW_RISK,
): string {
  const trimmed = storedRiskLevel?.trim();
  if (reasons.length === 0) {
    return trimmed || defaultWhenClear;
  }
  if (trimmed && trimmed !== LOW_RISK) return trimmed;
  return suggestUndetectedRiskLevel(reasons);
}

const TIMBER_PEST_RISK_SUBJECT =
  'undetected timber pest attack and conditions conducive to timber pest attack';

export const TIMBER_PEST_FURTHER_INSPECTION_ADVICE =
  'A further inspection is strongly recommended of areas that were not readily accessible, and of inaccessible or obstructed areas once access has been provided or the obstruction removed. This may require the moving, lifting or removal of obstructions such as floor coverings, furniture, stored items, foliage and insulation. In some instances, it may also require the removal of ceiling and wall linings, and the cutting of traps and access holes. For further advice consult the person who carried out this report.';

function requiresTimberPestFurtherInspectionAdvice(riskLevel: string, reasons: string[]): boolean {
  if (reasons.length > 0) return true;
  return !isLowRiskLevel(riskLevel);
}

function generateTimberPestRiskExplanation(riskLevel: string, reasons: string[]): string {
  const level = riskLevel.trim() || LOW_RISK;

  if (isLowRiskLevel(level) && reasons.length === 0) {
    return `Due to the level of accessibility for inspection, the overall degree of risk of ${TIMBER_PEST_RISK_SUBJECT} was considered: ${level}.`;
  }

  const parts = [
    `Due to the level of accessibility for inspection including the presence of obstructions, the overall degree of risk of ${TIMBER_PEST_RISK_SUBJECT} was considered: ${level}.`,
  ];

  if (requiresTimberPestFurtherInspectionAdvice(level, reasons)) {
    parts.push(TIMBER_PEST_FURTHER_INSPECTION_ADVICE);
  }

  return parts.join('\n\n');
}

export function generateUndetectedRiskExplanation(
  riskLevel: string,
  section: AccessibilityObstructionsSection,
  variant: UndetectedRiskVariant,
): string {
  const reasons = collectAccessibilityRiskReasons(section);
  const level = riskLevel.trim() || LOW_RISK;

  if (variant === 'timber-pest') {
    return generateTimberPestRiskExplanation(level, reasons);
  }

  const subject =
    'Undetected Structural Damage and Conditions Conducive to Structural Damage';

  if (reasons.length === 0) {
    return `Due to the level of accessibility for inspection, the overall degree of risk of ${subject} was considered: ${level}. All readily accessible areas were inspected without significant restriction.`;
  }

  const intro = `Due to the level of accessibility for inspection including the presence of obstructions, the overall degree of risk of ${subject} was considered: ${level}.`;

  if (isLowRiskLevel(level)) {
    return intro;
  }

  return `${intro}\n\nThis assessment takes into account the following accessibility limitations:\n${reasons.map((reason) => `• ${reason}`).join('\n')}`;
}

export function applyAccessibilityRiskAssessment(
  section: AccessibilityObstructionsSection,
): AccessibilityObstructionsSection {
  const reasons = collectAccessibilityRiskReasons(section);
  const riskLevel = resolveUndetectedRiskLevel(
    section.undetectedStructuralRisk,
    reasons,
    DEFAULT_STRUCTURAL_UNDETECTED_RISK,
  );

  return {
    ...section,
    undetectedStructuralRisk: riskLevel,
    riskExplanation: generateUndetectedRiskExplanation(riskLevel, section, 'structural'),
  };
}
