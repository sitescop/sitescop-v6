import { emptySectionBase, emptyCheckboxField, normalizeCheckboxField } from './defaults.js';
import type { PrefillJobContext } from './types.js';
import type { D13ConduciveConditionsSection, PestInspectionSections } from './pest-types.js';
import {
  CONDUCIVE_RECOMMENDATION_PRESETS,
  EVIDENCE_FOUND,
  formatPestEvidenceAnswer,
  MANAGEMENT_PROPOSAL_OPTIONS,
  MOISTURE_STAINS_DISCLAIMER,
  NO_EVIDENCE_FOUND,
  PEST_CONCLUSION_RECOMMENDATIONS,
} from './pest-options.js';

export function defaultConduciveRecommendationPresets() {
  return {
    selected: [...CONDUCIVE_RECOMMENDATION_PRESETS],
    custom: [],
  };
}

/** Ensure D13 recommendation presets default to all standard items ticked. */
export function applyD13ConduciveDefaults(section: D13ConduciveConditionsSection): D13ConduciveConditionsSection {
  const presets = normalizeCheckboxField(section.recommendationPresets);
  if (presets.selected.length === 0 && presets.custom.length === 0) {
    return {
      ...section,
      recommendationPresets: defaultConduciveRecommendationPresets(),
    };
  }
  return { ...section, recommendationPresets: presets };
}

function migrateEvidenceValue(value: string): string {
  return formatPestEvidenceAnswer(value) || value;
}

/** Normalize legacy bare/sentence answers into professional Evidence Found wording. */
export function migratePestEvidenceAnswers(pest: PestInspectionSections): PestInspectionSections {
  return {
    ...pest,
    d1ActiveTermites: {
      ...pest.d1ActiveTermites,
      evidenceAnswer: migrateEvidenceValue(pest.d1ActiveTermites.evidenceAnswer),
    },
    d3TermiteWorkings: {
      ...pest.d3TermiteWorkings,
      summaryAnswer: migrateEvidenceValue(pest.d3TermiteWorkings.summaryAnswer),
      evidenceAnswer: migrateEvidenceValue(pest.d3TermiteWorkings.evidenceAnswer),
    },
    d4PreviousTreatment: {
      ...pest.d4PreviousTreatment,
      evidenceAnswer: migrateEvidenceValue(pest.d4PreviousTreatment.evidenceAnswer),
    },
    d6ChemicalDelignification: {
      ...pest.d6ChemicalDelignification,
      summaryAnswer: migrateEvidenceValue(pest.d6ChemicalDelignification.summaryAnswer),
    },
    d7FungalDecay: {
      ...pest.d7FungalDecay,
      summaryAnswer: migrateEvidenceValue(pest.d7FungalDecay.summaryAnswer),
    },
    d8WoodBorers: {
      ...pest.d8WoodBorers,
      answer: migrateEvidenceValue(pest.d8WoodBorers.answer),
    },
    d9SubfloorVentilation: {
      ...pest.d9SubfloorVentilation,
      answer: migrateEvidenceValue(pest.d9SubfloorVentilation.answer),
    },
    d10ExcessiveMoisture: {
      ...pest.d10ExcessiveMoisture,
      answer: migrateEvidenceValue(pest.d10ExcessiveMoisture.answer),
    },
    d11BarrierBridging: {
      ...pest.d11BarrierBridging,
      summaryAnswer: migrateEvidenceValue(pest.d11BarrierBridging.summaryAnswer),
    },
    d13ConduciveConditions: {
      ...pest.d13ConduciveConditions,
      summaryDuringInspection: migrateEvidenceValue(pest.d13ConduciveConditions.summaryDuringInspection),
      otherEvidenceAnswer: migrateEvidenceValue(pest.d13ConduciveConditions.otherEvidenceAnswer),
    },
  };
}

export function applyPestSectionDefaults(pest: PestInspectionSections): PestInspectionSections {
  const migrated = migratePestEvidenceAnswers(pest);
  return {
    ...migrated,
    d13ConduciveConditions: applyD13ConduciveDefaults(migrated.d13ConduciveConditions),
  };
}

export function createEmptyPestSections(prefill?: PrefillJobContext): PestInspectionSections {
  const base = emptySectionBase();
  return {
    undetectedTimberPestRisk: {
      ...base,
      riskLevel: 'Low',
      riskExplanation: '',
    },
    d1ActiveTermites: {
      ...base,
      evidenceAnswer: NO_EVIDENCE_FOUND,
      locationNarrative: '',
      species: emptyCheckboxField(),
      reportStatement: '',
      comment: '',
    },
    d2ManagementProposal: {
      ...base,
      recommendation: MANAGEMENT_PROPOSAL_OPTIONS[0],
      reportStatement: '',
    },
    d3TermiteWorkings: {
      ...base,
      summaryAnswer: NO_EVIDENCE_FOUND,
      evidenceLocations: emptyCheckboxField(),
      evidenceAnswer: NO_EVIDENCE_FOUND,
      locationNarrative: '',
      oneOffComments: '',
      reportStatement: '',
    },
    d4PreviousTreatment: {
      ...base,
      evidenceAnswer: NO_EVIDENCE_FOUND,
      evidenceFound: emptyCheckboxField(),
      productDetails: '',
      oneOffComments: '',
      reportStatement: '',
    },
    d5FutureInspection: {
      ...base,
      frequency: '6 Month',
    },
    d6ChemicalDelignification: {
      ...base,
      summaryAnswer: NO_EVIDENCE_FOUND,
      evidenceItems: emptyCheckboxField(),
    },
    d7FungalDecay: {
      ...base,
      summaryAnswer: NO_EVIDENCE_FOUND,
      evidenceLocations: emptyCheckboxField(),
    },
    d8WoodBorers: {
      ...base,
      answer: NO_EVIDENCE_FOUND,
      locationNarrative: '',
    },
    d9SubfloorVentilation: {
      ...base,
      answer: 'Not applicable due to construction design.',
      locationNarrative: '',
    },
    d10ExcessiveMoisture: {
      ...base,
      answer: NO_EVIDENCE_FOUND,
      moistureLocations: emptyCheckboxField(),
      moistureStains: emptyCheckboxField(),
      stainsDisclaimer: MOISTURE_STAINS_DISCLAIMER,
      locationNarrative: '',
      reportStatement: '',
    },
    d11BarrierBridging: {
      ...base,
      summaryAnswer: NO_EVIDENCE_FOUND,
      evidenceItems: emptyCheckboxField(),
    },
    d13ConduciveConditions: {
      ...base,
      summaryDuringInspection: EVIDENCE_FOUND,
      otherEvidenceAnswer: NO_EVIDENCE_FOUND,
      recommendationPresets: defaultConduciveRecommendationPresets(),
      locationNarrative: '',
    },
    d14MajorSafetyHazards: {
      ...base,
      summaryAnswer: NO_EVIDENCE_FOUND,
      hazardItems: emptyCheckboxField(),
    },
    pestConclusion: {
      ...base,
      recommendationsInSectionD: PEST_CONCLUSION_RECOMMENDATIONS[0],
      futureInspectionFrequency: '6 Month',
      futureInspectionOther: '',
      autoConclusion: '',
      autoRecommendations: [],
      inspectorName: prefill?.inspectorName ?? '',
      licenceNumber: prefill?.inspectorLicence ?? '',
      signatureData: '',
      declarationDate: new Date().toISOString().slice(0, 10),
      reportComplete: false,
    },
  };
}
