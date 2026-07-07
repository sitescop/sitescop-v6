import { emptySectionBase, emptyCheckboxField, normalizeCheckboxField } from './defaults.js';
import type { PrefillJobContext } from './types.js';
import type { D13ConduciveConditionsSection, PestInspectionSections } from './pest-types.js';
import { CONDUCIVE_RECOMMENDATION_PRESETS, MANAGEMENT_PROPOSAL_OPTIONS, MOISTURE_STAINS_DISCLAIMER, PEST_CONCLUSION_RECOMMENDATIONS } from './pest-options.js';

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

export function applyPestSectionDefaults(pest: PestInspectionSections): PestInspectionSections {
  return {
    ...pest,
    d13ConduciveConditions: applyD13ConduciveDefaults(pest.d13ConduciveConditions),
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
      evidenceAnswer: 'No',
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
      summaryAnswer: 'No Evidence Found',
      evidenceLocations: emptyCheckboxField(),
      evidenceAnswer: 'No',
      locationNarrative: '',
      oneOffComments: '',
      reportStatement: '',
    },
    d4PreviousTreatment: {
      ...base,
      evidenceAnswer: 'No',
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
      summaryAnswer: 'No Evidence Found',
      evidenceItems: emptyCheckboxField(),
    },
    d7FungalDecay: {
      ...base,
      summaryAnswer: 'No Evidence Found',
      evidenceLocations: emptyCheckboxField(),
    },
    d8WoodBorers: {
      ...base,
      answer: 'No evidence was found.',
      locationNarrative: '',
    },
    d9SubfloorVentilation: {
      ...base,
      answer: 'Not applicable due to construction design.',
      locationNarrative: '',
    },
    d10ExcessiveMoisture: {
      ...base,
      answer: 'No evidence was found.',
      moistureLocations: emptyCheckboxField(),
      moistureStains: emptyCheckboxField(),
      stainsDisclaimer: MOISTURE_STAINS_DISCLAIMER,
      locationNarrative: '',
      reportStatement: '',
    },
    d11BarrierBridging: {
      ...base,
      summaryAnswer: 'No Evidence Found',
      evidenceItems: emptyCheckboxField(),
    },
    d13ConduciveConditions: {
      ...base,
      summaryDuringInspection: 'Yes',
      otherEvidenceAnswer: 'No',
      recommendationPresets: defaultConduciveRecommendationPresets(),
      locationNarrative: '',
    },
    d14MajorSafetyHazards: {
      ...base,
      summaryAnswer: 'No Evidence Found',
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
