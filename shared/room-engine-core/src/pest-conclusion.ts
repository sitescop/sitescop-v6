import type { AccessibilityObstructionsSection, InspectionPhotoRef, ServicesSection } from './types.js';
import type { PestInspectionSections } from './pest-types.js';
import {
  ACTIVE_TERMITES_IMPORTANT_NOTE,
  BATHROOM_MOISTURE_LOCATION_PRESETS,
  D10_EVIDENCE_REPORT_PREFIX,
  D10_STAINS_REPORT_PREFIX,
  D12_UNTREATED_TIMBER_RECOMMENDATION,
  D3_EVIDENCE_REPORT_PREFIX,
  EVIDENCE_FOUND,
  isPestEvidenceFound,
  MANAGEMENT_PROPOSAL_OPTIONS,
  NO_EVIDENCE_FOUND,
  formatPestFutureInspectionFrequency,
  PEST_CONCLUSION_RECOMMENDATIONS,
  PLUMBING_MOISTURE_LOCATION_PRESETS,
  ROOF_MOISTURE_LOCATION_PRESETS,
  SUBFLOOR_VENTILATION_NOT_APPLICABLE,
} from './pest-options.js';
import { normalizeCheckboxField } from './defaults.js';
import { applyD12UntreatedTimberDefaults } from './pest-defaults.js';
import {
  collectAccessibilityRiskReasons,
  DEFAULT_TIMBER_PEST_UNDETECTED_RISK,
  generateUndetectedRiskExplanation,
  resolveUndetectedRiskLevel,
} from './risk-assessment.js';

export interface PestConclusionEnrichmentOptions {
  building?: {
    inspectorDeclaration: {
      inspectorName: string;
      signatureData: string;
      declarationDate: string;
    };
  };
  inspectorName?: string;
}

export interface PestTradeBuildingContext {
  kitchen?: { leakInsideCabinet?: string };
  laundry?: { activeLeak?: string };
  roofExterior?: { condition?: string };
}

export interface PestReportStatement {
  label: string;
  text: string;
}

export function collectPestReportStatements(pest: PestInspectionSections): PestReportStatement[] {
  const items: PestReportStatement[] = [];

  if (pest.undetectedTimberPestRisk.riskExplanation?.trim()) {
    items.push({
      label: 'Undetected Timber Pest Risk',
      text: pest.undetectedTimberPestRisk.riskExplanation.trim(),
    });
  }

  const dSections: [string, string][] = [
    ['D1 Active (Live) Termites', pest.d1ActiveTermites.reportStatement],
    ['D2 Subterranean Termite Management Proposal', pest.d2ManagementProposal.reportStatement],
    ['D3 Termite Workings and/or Damage', pest.d3TermiteWorkings.reportStatement],
    ['D4 Previous Termite Management Program', pest.d4PreviousTreatment.reportStatement],
    ['D10 The Presence of Excessive Moisture', pest.d10ExcessiveMoisture.reportStatement],
  ];

  for (const [label, text] of dSections) {
    if (text?.trim()) {
      items.push({ label, text: text.trim() });
    }
  }

  return items;
}

export function enrichPestConclusion(
  pest: PestInspectionSections,
  options?: PestConclusionEnrichmentOptions,
): PestInspectionSections {
  const declaration = options?.building?.inspectorDeclaration;
  const conclusion = { ...pest.pestConclusion };

  if (!conclusion.inspectorName?.trim()) {
    conclusion.inspectorName =
      options?.inspectorName?.trim() || declaration?.inspectorName?.trim() || conclusion.inspectorName;
  }
  if (!conclusion.signatureData?.trim() && declaration?.signatureData?.trim()) {
    conclusion.signatureData = declaration.signatureData;
  }
  if (!conclusion.declarationDate?.trim() && declaration?.declarationDate?.trim()) {
    conclusion.declarationDate = declaration.declarationDate;
  }

  return { ...pest, pestConclusion: conclusion };
}

export function applyPestTimberRiskAssessment(
  pest: PestInspectionSections,
  accessibility: AccessibilityObstructionsSection,
): PestInspectionSections {
  const reasons = collectAccessibilityRiskReasons(accessibility);
  const riskLevel = resolveUndetectedRiskLevel(
    pest.undetectedTimberPestRisk.riskLevel,
    reasons,
    DEFAULT_TIMBER_PEST_UNDETECTED_RISK,
  );

  return {
    ...pest,
    undetectedTimberPestRisk: {
      ...pest.undetectedTimberPestRisk,
      riskLevel,
      riskExplanation: generateUndetectedRiskExplanation(riskLevel, accessibility, 'timber-pest'),
    },
  };
}

function hasActiveTermites(pest: PestInspectionSections): boolean {
  return isPestEvidenceFound(pest.d1ActiveTermites.evidenceAnswer);
}

function hasTermiteWorkings(pest: PestInspectionSections): boolean {
  return isPestEvidenceFound(pest.d3TermiteWorkings.summaryAnswer);
}

function checkboxItems(state: { selected?: string[]; custom?: string[] } | undefined): string[] {
  return [...(state?.selected ?? []), ...(state?.custom ?? [])].filter(Boolean);
}

function textIncludesAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function presetSet<T extends string>(presets: readonly T[]): Set<string> {
  return new Set(presets);
}

const BATHROOM_MOISTURE = presetSet(BATHROOM_MOISTURE_LOCATION_PRESETS);
const ROOF_MOISTURE = presetSet(ROOF_MOISTURE_LOCATION_PRESETS);
const PLUMBING_MOISTURE = presetSet(PLUMBING_MOISTURE_LOCATION_PRESETS);

const PLUMBING_KEYWORDS = [
  'pipe',
  'downpipe',
  'down pipe',
  'gutter',
  'plumb',
  'leak',
  'overflow',
  'tap',
  'drain',
  'laundry tub',
] as const;

const ROOF_KEYWORDS = ['roof', 'eave', 'ceiling', 'flashing', 'gutter', 'downpipe', 'down pipe'] as const;

const BATHROOM_KEYWORDS = [
  'shower',
  'bath',
  'bathroom',
  'ensuite',
  'wet area',
  'silicone',
  'seal',
  'waterproof',
] as const;

function appendMoistureTradeRecommendations(
  pest: PestInspectionSections,
  recs: string[],
  building?: PestTradeBuildingContext,
): void {
  const d10Active = isPestEvidenceFound(pest.d10ExcessiveMoisture.answer);
  const moistureItems = d10Active
    ? [
        ...checkboxItems(pest.d10ExcessiveMoisture.moistureLocations),
        ...checkboxItems(pest.d10ExcessiveMoisture.moistureStains),
      ]
    : [];

  const narrativeText = [
    pest.d10ExcessiveMoisture.locationNarrative,
    pest.d13ConduciveConditions.locationNarrative,
  ]
    .filter(Boolean)
    .join(' ');

  const combinedText = [...moistureItems, narrativeText].join(' ');

  const bathroomAreas = moistureItems.filter(
    (item) => BATHROOM_MOISTURE.has(item) || textIncludesAny(item, BATHROOM_KEYWORDS),
  );
  const roofAreas = moistureItems.filter(
    (item) => ROOF_MOISTURE.has(item) || textIncludesAny(item, ROOF_KEYWORDS),
  );
  const plumbingAreas = moistureItems.filter(
    (item) => PLUMBING_MOISTURE.has(item) || textIncludesAny(item, PLUMBING_KEYWORDS),
  );

  const d11DownPipes =
    isPestEvidenceFound(pest.d11BarrierBridging.summaryAnswer) &&
    checkboxItems(pest.d11BarrierBridging.evidenceItems).some((item) =>
      textIncludesAny(item, ['down pipe', 'downpipe']),
    );

  const d6RoofTimbers =
    isPestEvidenceFound(pest.d6ChemicalDelignification.summaryAnswer) &&
    checkboxItems(pest.d6ChemicalDelignification.evidenceItems).some((item) =>
      textIncludesAny(item, ['roof']),
    );

  const buildingKitchenLeak = building?.kitchen?.leakInsideCabinet === 'Yes';
  const buildingLaundryLeak = building?.laundry?.activeLeak === 'Yes';
  const buildingPoorRoof = building?.roofExterior?.condition === 'Poor';

  const needsWaterproofing =
    (d10Active || bathroomAreas.length > 0) &&
    (bathroomAreas.length > 0 || textIncludesAny(combinedText, BATHROOM_KEYWORDS));
  const needsPlumber =
    plumbingAreas.length > 0 ||
    d11DownPipes ||
    buildingKitchenLeak ||
    buildingLaundryLeak ||
    (d10Active && textIncludesAny(combinedText, PLUMBING_KEYWORDS));
  const needsRoofer =
    roofAreas.length > 0 ||
    d6RoofTimbers ||
    buildingPoorRoof ||
    (d10Active && textIncludesAny(combinedText, ['roof space', 'eave sheet', 'ceiling sheet', 'flashing']));

  if (needsWaterproofing) {
    const areas = bathroomAreas.length ? bathroomAreas.join(', ') : 'wet areas noted during inspection';
    recs.push(
      `Engage a waterproofing contractor to inspect ${areas} and re-seal junctions, including silicone re-sealing of shower and bath perimeters where moisture evidence was noted.`,
    );
  }

  if (needsPlumber) {
    const parts = [...plumbingAreas];
    if (d11DownPipes) parts.push('downpipes');
    if (buildingKitchenLeak) parts.push('kitchen leak under cabinet');
    if (buildingLaundryLeak) parts.push('laundry leak');
    const areas = parts.length ? parts.join(', ') : 'plumbing and drainage components noted';
    recs.push(
      `Engage a licensed plumber to inspect and rectify defects to ${areas}, including downpipes and internal plumbing where moisture or conducive conditions were identified.`,
    );
  }

  if (needsRoofer) {
    const parts = [...roofAreas];
    if (d6RoofTimbers) parts.push('roof timbers');
    if (buildingPoorRoof) parts.push('roof exterior');
    const areas = parts.length ? parts.join(', ') : 'roof and ceiling areas noted';
    recs.push(
      `Engage a licensed roofer or roof plumber to inspect ${areas} and address roof drainage, flashings or coverings contributing to moisture entry.`,
    );
  }
}

export function generatePestAutoConclusion(pest: PestInspectionSections): string {
  const activeTermites = hasActiveTermites(pest);
  const termiteWorkings = hasTermiteWorkings(pest);
  const parts: string[] = [];

  parts.push(
    `This timber pest inspection was carried out in accordance with Australian Standard AS 4349.3. ${pest.undetectedTimberPestRisk.riskExplanation.trim()}`,
  );

  if (activeTermites) {
    const statement = pest.d1ActiveTermites.reportStatement.trim();
    parts.push(
      statement ||
        'Active (live) termites were identified during this inspection. Immediate engagement of a licensed timber pest management operator is essential to treat the infestation and protect structural timbers.',
    );
    parts.push(ACTIVE_TERMITES_IMPORTANT_NOTE);
  } else if (termiteWorkings) {
    const statement = pest.d3TermiteWorkings.reportStatement.trim();
    parts.push(
      statement ||
        'Evidence of termite workings and/or damage was identified during this inspection. Further assessment and appropriate remedial action by a licensed timber pest management operator is recommended.',
    );
  } else if (pest.pestConclusion.recommendationsInSectionD === PEST_CONCLUSION_RECOMMENDATIONS[1]) {
    parts.push(
      'Based on the readily accessible areas inspected at the time of inspection, no active termites or significant timber pest activity requiring urgent treatment were identified.',
    );
  } else {
    parts.push(
      'No active termites were identified at the time of inspection. Refer to Section D for significant items and recommendations relating to timber pest risk, conducive conditions and management measures.',
    );
  }

  const nextInspection = formatPestFutureInspectionFrequency(pest.d5FutureInspection.frequency);
  if (nextInspection) {
    parts.push(
      `The next inspection to help detect future termite activity is recommended in ${nextInspection} (see Item D5).`,
    );
  }

  return parts.filter(Boolean).join('\n\n');
}

export function generatePestAutoRecommendations(
  pest: PestInspectionSections,
  building?: PestTradeBuildingContext,
): string[] {
  const recs: string[] = [];
  const activeTermites = hasActiveTermites(pest);
  const termiteWorkings = hasTermiteWorkings(pest);

  if (activeTermites) {
    recs.push(
      'Engage a licensed timber pest management operator immediately to treat active termites identified during this inspection.',
    );
    recs.push(
      'Do not disturb active termite workings prior to treatment. Further inspection may be required following treatment to confirm eradication.',
    );
  }

  if (termiteWorkings) {
    recs.push(
      'Engage a licensed timber pest management operator to assess termite workings and/or damage and recommend appropriate remedial action.',
    );
  }

  if (pest.d2ManagementProposal.recommendation === MANAGEMENT_PROPOSAL_OPTIONS[0]) {
    recs.push(pest.d2ManagementProposal.recommendation);
  } else if ((activeTermites || termiteWorkings) && pest.d2ManagementProposal.recommendation !== MANAGEMENT_PROPOSAL_OPTIONS[1]) {
    recs.push(MANAGEMENT_PROPOSAL_OPTIONS[0]);
  }

  if (isPestEvidenceFound(pest.d6ChemicalDelignification.summaryAnswer)) {
    const items = checkboxItems(pest.d6ChemicalDelignification.evidenceItems);
    recs.push(
      items.length
        ? `Engage a licensed timber pest management operator or qualified builder to assess chemical delignification affecting: ${items.join(', ')}.`
        : 'Engage a licensed timber pest management operator or qualified builder to assess chemical delignification of roof timbers.',
    );
  }

  if (isPestEvidenceFound(pest.d7FungalDecay.summaryAnswer)) {
    const items = checkboxItems(pest.d7FungalDecay.evidenceLocations);
    recs.push(
      items.length
        ? `Engage a licensed timber pest management operator or qualified carpenter to assess fungal decay affecting: ${items.join(', ')}.`
        : 'Engage a licensed timber pest management operator or qualified carpenter to assess fungal decay and replace affected timbers as required.',
    );
  }

  if (isPestEvidenceFound(pest.d8WoodBorers.answer)) {
    recs.push('Engage a licensed timber pest management operator to assess evidence of wood borer activity.');
    if (pest.d8WoodBorers.locationNarrative.trim()) {
      recs.push(pest.d8WoodBorers.locationNarrative.trim());
    }
  }

  if (isPestEvidenceFound(pest.d9SubfloorVentilation.answer)) {
    recs.push('Improve subfloor ventilation to reduce conditions conducive to timber pest attack.');
    if (pest.d9SubfloorVentilation.locationNarrative.trim()) {
      recs.push(pest.d9SubfloorVentilation.locationNarrative.trim());
    }
  }

  if (isPestEvidenceFound(pest.d10ExcessiveMoisture.answer)) {
    recs.push(
      'Address sources of excessive moisture identified during inspection to reduce conditions conducive to timber pest attack.',
    );
  }

  appendMoistureTradeRecommendations(pest, recs, building);

  if (isPestEvidenceFound(pest.d11BarrierBridging.summaryAnswer)) {
    const items = checkboxItems(pest.d11BarrierBridging.evidenceItems);
    if (items.length) {
      recs.push(`Remove or adjust termite barrier bridging and/or inspection zone obstructions including: ${items.join(', ')}.`);
    }
  }

  if (isPestEvidenceFound(pest.d12UntreatedTimber?.summaryAnswer)) {
    const recommendation =
      pest.d12UntreatedTimber.recommendation?.trim() || D12_UNTREATED_TIMBER_RECOMMENDATION;
    recs.push(recommendation);
  }

  if (isPestEvidenceFound(pest.d13ConduciveConditions.summaryDuringInspection)) {
    recs.push(...checkboxItems(pest.d13ConduciveConditions.recommendationPresets));
    if (pest.d13ConduciveConditions.locationNarrative.trim()) {
      recs.push(pest.d13ConduciveConditions.locationNarrative.trim());
    }
  }

  if (pest.d14MajorSafetyHazards.summaryAnswer === 'Hazard Found') {
    const hazards = checkboxItems(pest.d14MajorSafetyHazards.hazardItems);
    if (hazards.length) {
      recs.push(`Address major safety hazards identified during inspection: ${hazards.join(', ')}.`);
    }
  }

  const futureFreq = formatPestFutureInspectionFrequency(pest.d5FutureInspection.frequency);
  if (futureFreq) {
    recs.push(
      `Schedule the next timber pest inspection in ${futureFreq} in accordance with Australian Standard AS 3660 and relevant manufacturer guidelines.`,
    );
  }

  return [...new Set(recs.map((item) => item.trim()).filter(Boolean))];
}

export function applyPestConclusionUpdates(
  pest: PestInspectionSections,
  building?: PestTradeBuildingContext,
): PestInspectionSections {
  const futureInspectionFrequency = pest.d5FutureInspection.frequency;

  return {
    ...pest,
    pestConclusion: {
      ...pest.pestConclusion,
      futureInspectionFrequency,
      autoConclusion: generatePestAutoConclusion(pest),
      autoRecommendations: generatePestAutoRecommendations(pest, building),
    },
  };
}

export function generateD1ReportStatement(section: PestInspectionSections['d1ActiveTermites']): string {
  if (!isPestEvidenceFound(section.evidenceAnswer)) return '';
  const species =
    [...section.species.selected, ...section.species.custom].filter((s) => s !== 'Undetermined').join(', ') ||
    'Undetermined';
  const location = section.locationNarrative.trim() || 'the areas noted above';
  return `At time of inspection active termites were located in, but not necessarily limited to: ${location}. The species was ${species} and has the potential to cause extensive damage to timbers in service. Treatment of the active termites is considered essential at the first available opportunity.`;
}

export function generateD2ReportStatement(section: PestInspectionSections['d2ManagementProposal']): string {
  if (section.recommendation !== MANAGEMENT_PROPOSAL_OPTIONS[0]) return '';
  return section.recommendation;
}

export function generateD3ReportStatement(section: PestInspectionSections['d3TermiteWorkings']): string {
  if (!isPestEvidenceFound(section.summaryAnswer) && !isPestEvidenceFound(section.evidenceAnswer)) {
    return '';
  }
  const location = section.locationNarrative.trim() || 'the areas noted above';
  return `${D3_EVIDENCE_REPORT_PREFIX} ${location}`;
}

export function generateD4ReportStatement(section: PestInspectionSections['d4PreviousTreatment']): string {
  if (!isPestEvidenceFound(section.evidenceAnswer)) return '';
  const items = [...section.evidenceFound.selected, ...section.evidenceFound.custom];
  return `Evidence Found: ${items.join('; ') || 'Evidence of previous program noted'}.`;
}

export function generateD10ReportStatement(section: PestInspectionSections['d10ExcessiveMoisture']): string {
  if (!isPestEvidenceFound(section.answer)) return '';
  const locations = [...section.moistureLocations.selected, ...section.moistureLocations.custom];
  const stains = [...section.moistureStains.selected, ...section.moistureStains.custom];
  const parts: string[] = [];
  if (locations.length) {
    parts.push(`${D10_EVIDENCE_REPORT_PREFIX} ${locations.join(', ')}`);
  }
  if (stains.length) {
    parts.push(`${D10_STAINS_REPORT_PREFIX} ${stains.join(', ')}`);
  }
  return parts.join('\n\n');
}

export function applyPestSectionUpdates(
  pest: PestInspectionSections,
  accessibility?: AccessibilityObstructionsSection,
  services?: ServicesSection,
  options?: { subfloorApplicable?: boolean },
): PestInspectionSections {
  let updated: PestInspectionSections = {
    ...pest,
    d1ActiveTermites: {
      ...pest.d1ActiveTermites,
      reportStatement: generateD1ReportStatement(pest.d1ActiveTermites),
    },
    d2ManagementProposal: {
      ...pest.d2ManagementProposal,
      reportStatement: generateD2ReportStatement(pest.d2ManagementProposal),
    },
    d3TermiteWorkings: {
      ...pest.d3TermiteWorkings,
      reportStatement: generateD3ReportStatement(pest.d3TermiteWorkings),
    },
    d4PreviousTreatment: {
      ...pest.d4PreviousTreatment,
      reportStatement: generateD4ReportStatement(pest.d4PreviousTreatment),
    },
    d10ExcessiveMoisture: {
      ...pest.d10ExcessiveMoisture,
      reportStatement: generateD10ReportStatement(pest.d10ExcessiveMoisture),
    },
  };

  if (accessibility) {
    updated = applyPestTimberRiskAssessment(updated, accessibility);
  }
  if (services) {
    updated = syncD11BarrierBridgingFromServices(updated, services);
  }

  updated = syncD9SubfloorVentilationAnswer(updated, options?.subfloorApplicable);
  if (updated.d12UntreatedTimber) {
    updated = {
      ...updated,
      d12UntreatedTimber: applyD12UntreatedTimberDefaults(updated.d12UntreatedTimber),
    };
  }

  return enrichPestConclusion(applyPestConclusionUpdates(updated));
}

function syncD9SubfloorVentilationAnswer(
  pest: PestInspectionSections,
  subfloorApplicable?: boolean,
): PestInspectionSections {
  if (subfloorApplicable === undefined) return pest;

  const current = pest.d9SubfloorVentilation.answer?.trim() ?? '';

  if (!subfloorApplicable) {
    if (current === SUBFLOOR_VENTILATION_NOT_APPLICABLE) return pest;
    return {
      ...pest,
      d9SubfloorVentilation: {
        ...pest.d9SubfloorVentilation,
        answer: SUBFLOOR_VENTILATION_NOT_APPLICABLE,
      },
    };
  }

  if (!current) {
    return {
      ...pest,
      d9SubfloorVentilation: {
        ...pest.d9SubfloorVentilation,
        answer: NO_EVIDENCE_FOUND,
      },
    };
  }

  return pest;
}

function mergePhotoRefs(existing: InspectionPhotoRef[], incoming: InspectionPhotoRef[]): InspectionPhotoRef[] {
  const merged = [...existing];
  const seen = new Set(
    existing.map((photo) => (photo.id ? photo.id : `anon:${(photo.dataUrl ?? '').length}`)),
  );
  for (const photo of incoming) {
    const key = photo.id ? photo.id : `anon:${(photo.dataUrl ?? '').length}`;
    if (seen.has(key)) continue;
    merged.push(photo);
    seen.add(key);
  }
  return merged;
}

function hasLpgGasSelected(services: ServicesSection): boolean {
  const gas = normalizeCheckboxField(services.gas);
  const selectedLpg = [...gas.selected, ...gas.custom].some(
    (item) => item.trim().toLowerCase() === 'lpg',
  );
  return selectedLpg || services.gasOther.toLowerCase().includes('lpg');
}

function syncD11BarrierBridgingFromServices(
  pest: PestInspectionSections,
  services: ServicesSection,
): PestInspectionSections {
  const current = normalizeCheckboxField(pest.d11BarrierBridging.evidenceItems);

  const autoPresetItems: string[] = [];
  if (services.airConPresent === 'Yes') autoPresetItems.push('Air Conditioners');
  if (services.hotWaterPresent === 'Yes' && services.hotWaterLocation !== 'Internal') {
    autoPresetItems.push('Hot water service');
  }
  if (hasLpgGasSelected(services)) {
    autoPresetItems.push('Gas storage cylinders');
  }

  const nextSelected = [
    ...current.selected.filter(
      (item) => !['Air Conditioners', 'Hot water service', 'Gas storage cylinders'].includes(item),
    ),
    ...autoPresetItems,
  ];

  // Keep checkbox values normalized and deduplicated.
  const nextEvidence = normalizeCheckboxField({
    selected: [...new Set(nextSelected)],
    custom: [...new Set(current.custom)],
  });

  const shouldLinkPhotos =
    services.airConPresent === 'Yes' ||
    (services.hotWaterPresent === 'Yes' && services.hotWaterLocation !== 'Internal') ||
    hasLpgGasSelected(services);
  const linkedPhotos = shouldLinkPhotos
    ? mergePhotoRefs(
        pest.d11BarrierBridging.photos,
        [...services.photos, ...(services.waterSupplyPhotos ?? []), ...(services.sewerPhotos ?? []), ...(services.electricityPhotos ?? []), ...(services.gasPhotos ?? []), ...services.hotWaterPhotos, ...(services.airConPhotos ?? []), ...services.gasBottlePhotos],
      )
    : pest.d11BarrierBridging.photos;

  const hasEvidenceItems =
    nextEvidence.selected.length > 0 || nextEvidence.custom.length > 0 || linkedPhotos.length > 0;

  return {
    ...pest,
    d11BarrierBridging: {
      ...pest.d11BarrierBridging,
      evidenceItems: nextEvidence,
      photos: linkedPhotos,
      summaryAnswer: hasEvidenceItems ? EVIDENCE_FOUND : pest.d11BarrierBridging.summaryAnswer,
    },
  };
}
