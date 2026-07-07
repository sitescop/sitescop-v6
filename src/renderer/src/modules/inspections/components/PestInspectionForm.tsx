import { useMemo } from 'react';
import type { InspectionFormRealm, PestInspectionSections } from '@sitescop/room-engine-core';
import {
  ACTIVE_TERMITES_IMPORTANT_NOTE,
  BARRIER_BRIDGING_ITEMS,
  CHEMICAL_DELIGNIFICATION_EVIDENCE,
  CONDUCIVE_INSPECTION_ANSWERS,
  CONDUCIVE_RECOMMENDATION_PRESETS,
  EVIDENCE_FOUND_OPTIONS,
  EXCESSIVE_MOISTURE_ANSWERS,
  FUNGAL_DECAY_LOCATIONS,
  FUTURE_INSPECTION_FREQUENCIES,
  MAJOR_HAZARD_ANSWERS,
  MAJOR_SAFETY_HAZARD_ITEMS,
  MANAGEMENT_PROPOSAL_OPTIONS,
  MOISTURE_LOCATION_PRESETS,
  MOISTURE_STAIN_PRESETS,
  MOISTURE_STAINS_DISCLAIMER,
  PEST_INSPECTION_SECTION_LABELS,
  PREVIOUS_TREATMENT_EVIDENCE,
  SUBFLOOR_VENTILATION_ANSWERS,
  TERMITE_EVIDENCE_ANSWERS,
  TERMITE_SPECIES_PRESETS,
  TERMITE_WORKING_LOCATIONS,
  TIMBER_PEST_RISK_LEVELS,
  WOOD_BORER_ANSWERS,
} from '@sitescop/room-engine-core';
import { Input, Select, Textarea } from '@/design-system/components';
import {
  CheckboxGroupField,
  PhotoField,
  RatingSelect,
  SectionComments,
  YesNoSelect,
} from './InspectionFields';
import { InspectorSignatureField } from './InspectorSignatureField';
import { InspectionAccordion, InspectionAccordionSection } from './InspectionAccordion';
import { buildInspectionRouteIds } from './inspection-route';
import { InspectionFormProvider } from './InspectionFormUi';
import { buildPestSectionStatuses } from './section-completion';

interface PestInspectionFormProps {
  pest: PestInspectionSections;
  onSectionChange: (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => void;
  readOnly?: boolean;
  embedded?: boolean;
  subfloorApplicable?: boolean;
}

export function PestInspectionForm({
  pest,
  onSectionChange,
  readOnly,
  embedded = false,
  subfloorApplicable = true,
}: PestInspectionFormProps) {
  const disabled = Boolean(readOnly);
  const patch = (section: keyof PestInspectionSections, partial: Record<string, unknown>) => {
    if (readOnly) return;
    onSectionChange('pest', section, partial);
  };

  const statuses = useMemo(() => buildPestSectionStatuses(pest, subfloorApplicable), [pest, subfloorApplicable]);

  const routeIds = useMemo(
    () =>
      buildInspectionRouteIds({
        formKind: 'PEST',
        mode: 'pest-only',
        subfloorApplicable,
      }),
    [subfloorApplicable],
  );

  const d1HasEvidence = pest.d1ActiveTermites.evidenceAnswer === 'The following evidence was found';
  const d3HasEvidence = pest.d3TermiteWorkings.summaryAnswer === 'Evidence Found';
  const d4HasEvidence = pest.d4PreviousTreatment.evidenceAnswer === 'Yes';
  const d7HasEvidence = pest.d7FungalDecay.summaryAnswer === 'Evidence Found';
  const d10HasEvidence = pest.d10ExcessiveMoisture.answer === 'The following evidence was found:';
  const d8HasEvidence = pest.d8WoodBorers.answer === 'The following evidence was found:';
  const d9HasEvidence = pest.d9SubfloorVentilation.answer === 'The following evidence was found.';
  const d13HasEvidence = pest.d13ConduciveConditions.summaryDuringInspection === 'Yes';

  const sections = (
    <>
      <InspectionAccordionSection id="pest-risk" title="Timber Pest Risk Assessment" status={statuses['pest-risk']}>
        <p className="text-sm text-text-muted">
          Risk level defaults to Low and updates from accessibility obstructions recorded above. The assessment text below is generated automatically and can be edited.
        </p>
        <RatingSelect
          label="Undetected Timber Pest Risk Level"
          value={pest.undetectedTimberPestRisk.riskLevel}
          onChange={(v) => patch('undetectedTimberPestRisk', { riskLevel: v })}
          options={[...TIMBER_PEST_RISK_LEVELS]}
        />
        <Textarea
          label="Risk Assessment"
          value={pest.undetectedTimberPestRisk.riskExplanation}
          onChange={(e) => patch('undetectedTimberPestRisk', { riskExplanation: e.target.value })}
          rows={10}
        />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d1ActiveTermites" title={PEST_INSPECTION_SECTION_LABELS.d1ActiveTermites} status={statuses['pest-d1ActiveTermites']}>
        <Select
          label="Was evidence of live termites found?"
          value={pest.d1ActiveTermites.evidenceAnswer}
          onChange={(e) => patch('d1ActiveTermites', { evidenceAnswer: e.target.value })}
          options={TERMITE_EVIDENCE_ANSWERS.map((v) => ({ value: v, label: v }))}
        />
        {d1HasEvidence && (
          <>
            <Textarea
              label="Location narrative"
              value={pest.d1ActiveTermites.locationNarrative}
              onChange={(e) => patch('d1ActiveTermites', { locationNarrative: e.target.value })}
              rows={3}
            />
            <CheckboxGroupField
              disabled={disabled}
              label="Species"
              options={TERMITE_SPECIES_PRESETS}
              value={pest.d1ActiveTermites.species}
              onChange={(v) => patch('d1ActiveTermites', { species: v })}
            />
            {pest.d1ActiveTermites.reportStatement && (
              <Textarea label="Report statement (auto)" value={pest.d1ActiveTermites.reportStatement} readOnly rows={4} />
            )}
            <p className="text-sm text-text-muted">{ACTIVE_TERMITES_IMPORTANT_NOTE}</p>
            <Textarea label="Comment" value={pest.d1ActiveTermites.comment} onChange={(e) => patch('d1ActiveTermites', { comment: e.target.value })} rows={2} />
          </>
        )}
        <PhotoField
          disabled={disabled}
          label="Active Termites Photos"
          photos={pest.d1ActiveTermites.photos}
          onChange={(photos) => patch('d1ActiveTermites', { photos })}
        />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d2ManagementProposal" title={PEST_INSPECTION_SECTION_LABELS.d2ManagementProposal} status={statuses['pest-d2ManagementProposal']}>
        <Select
          label="Is a Subterranean Termite Management Proposal recommended?"
          value={pest.d2ManagementProposal.recommendation}
          onChange={(e) => patch('d2ManagementProposal', { recommendation: e.target.value })}
          options={MANAGEMENT_PROPOSAL_OPTIONS.map((v) => ({ value: v, label: v }))}
        />
        {pest.d2ManagementProposal.reportStatement && (
          <Textarea label="Report statement (auto)" value={pest.d2ManagementProposal.reportStatement} readOnly rows={3} />
        )}
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d3TermiteWorkings" title={PEST_INSPECTION_SECTION_LABELS.d3TermiteWorkings} status={statuses['pest-d3TermiteWorkings']}>
        <RatingSelect label="Summary" value={pest.d3TermiteWorkings.summaryAnswer} onChange={(v) => patch('d3TermiteWorkings', { summaryAnswer: v })} options={[...EVIDENCE_FOUND_OPTIONS]} />
        {d3HasEvidence && (
          <>
            <CheckboxGroupField disabled={disabled} label="Evidence Locations" options={TERMITE_WORKING_LOCATIONS} value={pest.d3TermiteWorkings.evidenceLocations} onChange={(v) => patch('d3TermiteWorkings', { evidenceLocations: v })} />
            <YesNoSelect label="Was evidence of termite workings or damage found?" value={pest.d3TermiteWorkings.evidenceAnswer} onChange={(v) => patch('d3TermiteWorkings', { evidenceAnswer: v })} />
            <Textarea label="Location narrative" value={pest.d3TermiteWorkings.locationNarrative} onChange={(e) => patch('d3TermiteWorkings', { locationNarrative: e.target.value })} rows={3} />
            <Textarea label="One-off additional comments (not saved for future reports)" value={pest.d3TermiteWorkings.oneOffComments} onChange={(e) => patch('d3TermiteWorkings', { oneOffComments: e.target.value })} rows={2} />
            {pest.d3TermiteWorkings.reportStatement && <Textarea label="Report statement (auto)" value={pest.d3TermiteWorkings.reportStatement} readOnly rows={3} />}
            <Textarea label="Comments" value={pest.d3TermiteWorkings.comments} onChange={(e) => patch('d3TermiteWorkings', { comments: e.target.value })} rows={3} />
          </>
        )}
        <PhotoField disabled={disabled} label="Termite Workings/Damage Photos" photos={pest.d3TermiteWorkings.photos} onChange={(photos) => patch('d3TermiteWorkings', { photos })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d4PreviousTreatment" title={PEST_INSPECTION_SECTION_LABELS.d4PreviousTreatment} status={statuses['pest-d4PreviousTreatment']}>
        <YesNoSelect label="Was evidence of a possible previous termite management program found?" value={pest.d4PreviousTreatment.evidenceAnswer} onChange={(v) => patch('d4PreviousTreatment', { evidenceAnswer: v })} />
        {d4HasEvidence && (
          <>
            <CheckboxGroupField disabled={disabled} label="Evidence of previous program" options={PREVIOUS_TREATMENT_EVIDENCE} value={pest.d4PreviousTreatment.evidenceFound} onChange={(v) => patch('d4PreviousTreatment', { evidenceFound: v })} />
            <Textarea label="Product used, installed to, and date installed" value={pest.d4PreviousTreatment.productDetails} onChange={(e) => patch('d4PreviousTreatment', { productDetails: e.target.value })} rows={2} />
            <Textarea label="One-off additional comments" value={pest.d4PreviousTreatment.oneOffComments} onChange={(e) => patch('d4PreviousTreatment', { oneOffComments: e.target.value })} rows={2} />
            {pest.d4PreviousTreatment.reportStatement && <Textarea label="Report statement (auto)" value={pest.d4PreviousTreatment.reportStatement} readOnly rows={2} />}
            <PhotoField disabled={disabled} label="Previous Treatment Photo" photos={pest.d4PreviousTreatment.photos} onChange={(photos) => patch('d4PreviousTreatment', { photos })} />
          </>
        )}
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d5FutureInspection" title={PEST_INSPECTION_SECTION_LABELS.d5FutureInspection} status={statuses['pest-d5FutureInspection']}>
        <Select label="Frequency" value={pest.d5FutureInspection.frequency} onChange={(e) => patch('d5FutureInspection', { frequency: e.target.value })} options={FUTURE_INSPECTION_FREQUENCIES.map((v) => ({ value: v, label: v }))} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d6ChemicalDelignification" title={PEST_INSPECTION_SECTION_LABELS.d6ChemicalDelignification} status={statuses['pest-d6ChemicalDelignification']}>
        <RatingSelect label="Summary" value={pest.d6ChemicalDelignification.summaryAnswer} onChange={(v) => patch('d6ChemicalDelignification', { summaryAnswer: v })} options={[...EVIDENCE_FOUND_OPTIONS]} />
        <CheckboxGroupField disabled={disabled} label="Evidence items" options={CHEMICAL_DELIGNIFICATION_EVIDENCE} value={pest.d6ChemicalDelignification.evidenceItems} onChange={(v) => patch('d6ChemicalDelignification', { evidenceItems: v })} />
        <PhotoField disabled={disabled} label="Photos" photos={pest.d6ChemicalDelignification.photos} onChange={(photos) => patch('d6ChemicalDelignification', { photos })} />
        <SectionComments sectionId="pest-d6ChemicalDelignification" disabled={disabled} comments={pest.d6ChemicalDelignification.comments} photos={[]} onCommentsChange={(v) => patch('d6ChemicalDelignification', { comments: v })} onPhotosChange={() => undefined} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d7FungalDecay" title={PEST_INSPECTION_SECTION_LABELS.d7FungalDecay} status={statuses['pest-d7FungalDecay']}>
        <RatingSelect label="Summary" value={pest.d7FungalDecay.summaryAnswer} onChange={(v) => patch('d7FungalDecay', { summaryAnswer: v })} options={[...EVIDENCE_FOUND_OPTIONS]} />
        {d7HasEvidence && (
          <>
            <CheckboxGroupField disabled={disabled} label="Evidence Locations" options={FUNGAL_DECAY_LOCATIONS} value={pest.d7FungalDecay.evidenceLocations} onChange={(v) => patch('d7FungalDecay', { evidenceLocations: v })} />
            <PhotoField disabled={disabled} label="Photos" photos={pest.d7FungalDecay.photos} onChange={(photos) => patch('d7FungalDecay', { photos })} />
            <SectionComments sectionId="pest-d7FungalDecay" disabled={disabled} comments={pest.d7FungalDecay.comments} photos={[]} onCommentsChange={(v) => patch('d7FungalDecay', { comments: v })} onPhotosChange={() => undefined} />
          </>
        )}
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d8WoodBorers" title={PEST_INSPECTION_SECTION_LABELS.d8WoodBorers} status={statuses['pest-d8WoodBorers']}>
        <Select label="Was there evidence of Wood Borers found?" value={pest.d8WoodBorers.answer} onChange={(e) => patch('d8WoodBorers', { answer: e.target.value })} options={WOOD_BORER_ANSWERS.map((v) => ({ value: v, label: v }))} />
        {d8HasEvidence && (
          <Textarea label="Details" value={pest.d8WoodBorers.locationNarrative} onChange={(e) => patch('d8WoodBorers', { locationNarrative: e.target.value })} rows={2} />
        )}
        <PhotoField disabled={disabled} label="Wood Borers Photos" photos={pest.d8WoodBorers.photos} onChange={(photos) => patch('d8WoodBorers', { photos })} />
      </InspectionAccordionSection>

      {subfloorApplicable ? (
      <InspectionAccordionSection id="pest-d9SubfloorVentilation" title={PEST_INSPECTION_SECTION_LABELS.d9SubfloorVentilation} status={statuses['pest-d9SubfloorVentilation']}>
        <Select label="Was evidence of a lack of adequate ventilation found?" value={pest.d9SubfloorVentilation.answer} onChange={(e) => patch('d9SubfloorVentilation', { answer: e.target.value })} options={SUBFLOOR_VENTILATION_ANSWERS.map((v) => ({ value: v, label: v }))} />
        {d9HasEvidence && (
          <Textarea label="Details" value={pest.d9SubfloorVentilation.locationNarrative} onChange={(e) => patch('d9SubfloorVentilation', { locationNarrative: e.target.value })} rows={2} />
        )}
        <PhotoField disabled={disabled} label="Subfloor Ventilation Photos" photos={pest.d9SubfloorVentilation.photos} onChange={(photos) => patch('d9SubfloorVentilation', { photos })} />
      </InspectionAccordionSection>
      ) : null}

      <InspectionAccordionSection id="pest-d10ExcessiveMoisture" title={PEST_INSPECTION_SECTION_LABELS.d10ExcessiveMoisture} status={statuses['pest-d10ExcessiveMoisture']}>
        <Select label="Was evidence of excessive moisture found?" value={pest.d10ExcessiveMoisture.answer} onChange={(e) => patch('d10ExcessiveMoisture', { answer: e.target.value })} options={EXCESSIVE_MOISTURE_ANSWERS.map((v) => ({ value: v, label: v }))} />
        {d10HasEvidence && (
          <>
            <CheckboxGroupField disabled={disabled} label="Moisture locations" options={MOISTURE_LOCATION_PRESETS} value={pest.d10ExcessiveMoisture.moistureLocations} onChange={(v) => patch('d10ExcessiveMoisture', { moistureLocations: v })} />
            <CheckboxGroupField disabled={disabled} label="Moisture Stains" options={MOISTURE_STAIN_PRESETS} value={pest.d10ExcessiveMoisture.moistureStains} onChange={(v) => patch('d10ExcessiveMoisture', { moistureStains: v })} />
            <p className="text-sm text-text-muted">{MOISTURE_STAINS_DISCLAIMER}</p>
            {pest.d10ExcessiveMoisture.reportStatement && <Textarea label="Report statement (auto)" value={pest.d10ExcessiveMoisture.reportStatement} readOnly rows={4} />}
            <PhotoField disabled={disabled} label="Photos" photos={pest.d10ExcessiveMoisture.photos} onChange={(photos) => patch('d10ExcessiveMoisture', { photos })} />
            <Textarea label="Comments" value={pest.d10ExcessiveMoisture.comments} onChange={(e) => patch('d10ExcessiveMoisture', { comments: e.target.value })} rows={3} />
          </>
        )}
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d11BarrierBridging" title={PEST_INSPECTION_SECTION_LABELS.d11BarrierBridging} status={statuses['pest-d11BarrierBridging']}>
        <RatingSelect label="Summary" value={pest.d11BarrierBridging.summaryAnswer} onChange={(v) => patch('d11BarrierBridging', { summaryAnswer: v })} options={[...EVIDENCE_FOUND_OPTIONS]} />
        <CheckboxGroupField disabled={disabled} label="Evidence items" options={BARRIER_BRIDGING_ITEMS} value={pest.d11BarrierBridging.evidenceItems} onChange={(v) => patch('d11BarrierBridging', { evidenceItems: v })} allowCustom={false} />
        <PhotoField disabled={disabled} label="Photos" photos={pest.d11BarrierBridging.photos} onChange={(photos) => patch('d11BarrierBridging', { photos })} />
        <Textarea label="Comments" value={pest.d11BarrierBridging.comments} onChange={(e) => patch('d11BarrierBridging', { comments: e.target.value })} rows={3} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d13ConduciveConditions" title={PEST_INSPECTION_SECTION_LABELS.d13ConduciveConditions} status={statuses['pest-d13ConduciveConditions']}>
        <Select
          label="During the inspection did you find any evidence of Conducive conditions?"
          value={pest.d13ConduciveConditions.summaryDuringInspection}
          onChange={(e) => patch('d13ConduciveConditions', { summaryDuringInspection: e.target.value })}
          options={CONDUCIVE_INSPECTION_ANSWERS.map((v) => ({ value: v, label: v }))}
          disabled={disabled}
        />
        {d13HasEvidence && (
          <>
            <CheckboxGroupField disabled={disabled} label="Additional recommendation comments" options={CONDUCIVE_RECOMMENDATION_PRESETS} value={pest.d13ConduciveConditions.recommendationPresets} onChange={(v) => patch('d13ConduciveConditions', { recommendationPresets: v })} />
            <Textarea label="Additional comments" value={pest.d13ConduciveConditions.locationNarrative} onChange={(e) => patch('d13ConduciveConditions', { locationNarrative: e.target.value })} rows={3} />
          </>
        )}
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-d14MajorSafetyHazards" title={PEST_INSPECTION_SECTION_LABELS.d14MajorSafetyHazards} status={statuses['pest-d14MajorSafetyHazards']}>
        <RatingSelect label="Summary" value={pest.d14MajorSafetyHazards.summaryAnswer} onChange={(v) => patch('d14MajorSafetyHazards', { summaryAnswer: v })} options={[...MAJOR_HAZARD_ANSWERS]} />
        <CheckboxGroupField disabled={disabled} label="Hazards" options={MAJOR_SAFETY_HAZARD_ITEMS} value={pest.d14MajorSafetyHazards.hazardItems} onChange={(v) => patch('d14MajorSafetyHazards', { hazardItems: v })} />
        <PhotoField disabled={disabled} label="Photos" photos={pest.d14MajorSafetyHazards.photos} onChange={(photos) => patch('d14MajorSafetyHazards', { photos })} />
        <SectionComments sectionId="pest-d14MajorSafetyHazards" disabled={disabled} comments={pest.d14MajorSafetyHazards.comments} photos={[]} onCommentsChange={(v) => patch('d14MajorSafetyHazards', { comments: v })} onPhotosChange={() => undefined} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="pest-conclusion" title={PEST_INSPECTION_SECTION_LABELS.pestConclusion} status={statuses['pest-conclusion']}>
        <Textarea
          label="Conclusion"
          value={pest.pestConclusion.autoConclusion}
          onChange={(e) => patch('pestConclusion', { autoConclusion: e.target.value })}
          rows={8}
        />
        <div className="inspection-subpanel text-sm">
          <p className="inspection-subsection-heading">Recommendations</p>
          {pest.pestConclusion.autoRecommendations.length ? (
            <ul className="list-disc pl-5">
              {pest.pestConclusion.autoRecommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted">Recommendations will be generated from Section D findings.</p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Inspector Name" value={pest.pestConclusion.inspectorName} onChange={(e) => patch('pestConclusion', { inspectorName: e.target.value })} />
          <Input label="Licence Number" value={pest.pestConclusion.licenceNumber} onChange={(e) => patch('pestConclusion', { licenceNumber: e.target.value })} />
          <Input label="Declaration Date" type="date" value={pest.pestConclusion.declarationDate} onChange={(e) => patch('pestConclusion', { declarationDate: e.target.value })} />
        </div>
        <InspectorSignatureField
          disabled={disabled}
          label="Inspector Signature"
          value={pest.pestConclusion.signatureData ?? ''}
          onChange={(signatureData) => patch('pestConclusion', { signatureData })}
        />
      </InspectionAccordionSection>
    </>
  );

  if (embedded) {
    return sections;
  }

  return (
    <InspectionFormProvider>
      <InspectionAccordion defaultOpenId="pest-risk" routeIds={routeIds}>
        {sections}
      </InspectionAccordion>
    </InspectionFormProvider>
  );
}
