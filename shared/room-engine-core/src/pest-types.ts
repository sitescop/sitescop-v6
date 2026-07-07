import type { CheckboxFieldState, SectionBase } from './types.js';

export interface UndetectedTimberPestRiskSection extends SectionBase {
  riskLevel: string;
  riskExplanation: string;
}

export interface D1ActiveTermitesSection extends SectionBase {
  evidenceAnswer: string;
  locationNarrative: string;
  species: CheckboxFieldState;
  reportStatement: string;
  comment: string;
}

export interface D2ManagementProposalSection extends SectionBase {
  recommendation: string;
  reportStatement: string;
}

export interface D3TermiteWorkingsSection extends SectionBase {
  summaryAnswer: string;
  evidenceLocations: CheckboxFieldState;
  evidenceAnswer: string;
  locationNarrative: string;
  oneOffComments: string;
  reportStatement: string;
}

export interface D4PreviousTreatmentSection extends SectionBase {
  evidenceAnswer: string;
  evidenceFound: CheckboxFieldState;
  productDetails: string;
  oneOffComments: string;
  reportStatement: string;
}

export interface D5FutureInspectionSection extends SectionBase {
  frequency: string;
}

export interface D6ChemicalDelignificationSection extends SectionBase {
  summaryAnswer: string;
  evidenceItems: CheckboxFieldState;
}

export interface D7FungalDecaySection extends SectionBase {
  summaryAnswer: string;
  evidenceLocations: CheckboxFieldState;
}

export interface D8WoodBorersSection extends SectionBase {
  answer: string;
  locationNarrative: string;
}

export interface D9SubfloorVentilationSection extends SectionBase {
  answer: string;
  locationNarrative: string;
}

export interface D10ExcessiveMoistureSection extends SectionBase {
  answer: string;
  moistureLocations: CheckboxFieldState;
  moistureStains: CheckboxFieldState;
  stainsDisclaimer: string;
  locationNarrative: string;
  reportStatement: string;
}

export interface D11BarrierBridgingSection extends SectionBase {
  summaryAnswer: string;
  evidenceItems: CheckboxFieldState;
}

export interface D13ConduciveConditionsSection extends SectionBase {
  summaryDuringInspection: string;
  otherEvidenceAnswer: string;
  recommendationPresets: CheckboxFieldState;
  locationNarrative: string;
}

export interface D14MajorSafetyHazardsSection extends SectionBase {
  summaryAnswer: string;
  hazardItems: CheckboxFieldState;
}

export interface PestConclusionSection extends SectionBase {
  recommendationsInSectionD: string;
  futureInspectionFrequency: string;
  futureInspectionOther: string;
  autoConclusion: string;
  autoRecommendations: string[];
  inspectorName: string;
  licenceNumber: string;
  signatureData: string;
  declarationDate: string;
  reportComplete: boolean;
}

export interface PestInspectionSections {
  undetectedTimberPestRisk: UndetectedTimberPestRiskSection;
  d1ActiveTermites: D1ActiveTermitesSection;
  d2ManagementProposal: D2ManagementProposalSection;
  d3TermiteWorkings: D3TermiteWorkingsSection;
  d4PreviousTreatment: D4PreviousTreatmentSection;
  d5FutureInspection: D5FutureInspectionSection;
  d6ChemicalDelignification: D6ChemicalDelignificationSection;
  d7FungalDecay: D7FungalDecaySection;
  d8WoodBorers: D8WoodBorersSection;
  d9SubfloorVentilation: D9SubfloorVentilationSection;
  d10ExcessiveMoisture: D10ExcessiveMoistureSection;
  d11BarrierBridging: D11BarrierBridgingSection;
  d13ConduciveConditions: D13ConduciveConditionsSection;
  d14MajorSafetyHazards: D14MajorSafetyHazardsSection;
  pestConclusion: PestConclusionSection;
}

export type PestInspectionSectionKey = keyof PestInspectionSections;

export const PEST_INSPECTION_SECTION_KEYS: PestInspectionSectionKey[] = [
  'undetectedTimberPestRisk',
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
  'pestConclusion',
];

export const PEST_INSPECTION_SECTION_LABELS: Record<PestInspectionSectionKey, string> = {
  undetectedTimberPestRisk: 'Risk Assessment',
  d1ActiveTermites: 'D1 Active (Live) Termites',
  d2ManagementProposal: 'D2 Subterranean Termite Management Proposal',
  d3TermiteWorkings: 'D3 Termite Workings and/or Damage',
  d4PreviousTreatment: 'D4 Previous Termite Management Program',
  d5FutureInspection: 'D5 Frequency of Future Inspections',
  d6ChemicalDelignification: 'D6 Chemical Delignification',
  d7FungalDecay: 'D7 Fungal Decay',
  d8WoodBorers: 'D8 Wood Borers',
  d9SubfloorVentilation: 'D9 Lack of Adequate Subfloor Ventilation',
  d10ExcessiveMoisture: 'D10 The Presence of Excessive Moisture',
  d11BarrierBridging: 'D11 Bridging of Termite Barriers',
  d13ConduciveConditions: 'D13 Other Conditions Conducive',
  d14MajorSafetyHazards: 'D14 Major Safety Hazards',
  pestConclusion: 'Section E — Conclusion & Inspector Declaration',
};
