/** One-click comment snippets for inspection sections (Phase 3). */

export type CommentSuggestionSectionId =
  | 'services'
  | 'accessibility'
  | 'site-conditions'
  | 'external'
  | 'subfloor'
  | 'fencing'
  | 'outbuildings'
  | 'roof-exterior'
  | 'roof-space'
  | 'kitchen'
  | 'laundry'
  | 'bathrooms'
  | 'bedrooms'
  | 'living-areas'
  | 'garage'
  | 'corrosion'
  | 'minor-defects'
  | 'major-defects'
  | 'thermal-imaging'
  | 'moisture-testing'
  | 'pest-d6ChemicalDelignification'
  | 'pest-d7FungalDecay'
  | 'pest-d14MajorSafetyHazards';

const SECTION_COMMENT_SUGGESTIONS: Record<CommentSuggestionSectionId, readonly string[]> = {
  services: [
    'Services were visually identified only. Specialist testing was not undertaken.',
    'Further investigation by the relevant licensed trade is recommended where concerns exist.',
  ],
  accessibility: [
    'Access to some areas was restricted by stored goods, furniture or locked rooms at the time of inspection.',
    'A further inspection is recommended when obstructed areas are cleared and safe access is available.',
    'Inspection was limited to readily accessible areas only.',
  ],
  'site-conditions': [
    'Surface drainage should be maintained to direct water away from the building footings.',
    'Evidence of water pooling was observed. Improved drainage and monitoring are recommended.',
    'Site grading appears inadequate in areas and may contribute to moisture ingress.',
  ],
  external: [
    'Minor cracking was observed to external masonry and should be monitored.',
    'Moisture-related deterioration was noted and should be investigated by an appropriate licensed trade.',
    'Routine external maintenance is recommended to preserve weatherproofing and finishes.',
    'Deformation or movement was observed and should be monitored over time.',
  ],
  subfloor: [
    'Subfloor ventilation appears limited. Improved cross-ventilation is recommended.',
    'Moisture evidence was observed in the subfloor. Further investigation is recommended.',
    'Timber elements in the subfloor should be maintained free of excessive moisture and pest activity.',
  ],
  fencing: [
    'Fencing was in fair condition with periodic maintenance recommended.',
    'Timber fencing showed weathering and requires ongoing maintenance and treatment.',
    'Fence posts and fixings should be monitored for movement or corrosion.',
  ],
  outbuildings: [
    'Outbuilding/shed was inspected externally only where readily accessible.',
    'Minor defects were noted to outbuildings and routine maintenance is recommended.',
    'Outbuilding condition is consistent with age and exposure; monitor weatherproofing.',
  ],
  'roof-exterior': [
    'Roof coverings appeared in serviceable condition where viewed from ground level.',
    'Gutter and downpipe maintenance is recommended to ensure adequate stormwater discharge.',
    'Flashings and sealants should be maintained to reduce moisture ingress risk.',
  ],
  'roof-space': [
    'Roof framing appeared generally serviceable where visible and accessible.',
    'Evidence of past or minor moisture was noted in the roof space. Monitor roof drainage and ventilation.',
    'Insulation coverage was incomplete in areas viewed; consider improving coverage where appropriate.',
  ],
  kitchen: [
    'Minor wear was observed to kitchen finishes consistent with age and normal use.',
    'A licensed plumber should investigate any suspected active leaks or drainage issues.',
    'Cabinet and benchtop finishes should be maintained to reduce moisture damage risk.',
  ],
  laundry: [
    'Moisture-related damage was noted in the laundry wet area. Re-sealing and plumber assessment are recommended.',
    'Drainage to floor waste should be maintained to reduce moisture and ponding risk.',
    'Ventilation to the laundry should be maintained to manage condensation.',
  ],
  bathrooms: [
    'Grout and silicone seals in wet areas should be maintained to reduce moisture ingress.',
    'Evidence of moisture damage was noted and waterproofing assessment is recommended.',
    'Floor waste drainage should be kept clear to reduce ponding in wet areas.',
    'A licensed plumber should investigate any active leaks or persistent dampness.',
  ],
  bedrooms: [
    'Minor wall or ceiling cracking was observed and should be monitored.',
    'Window and door operation should be maintained for ventilation and safety.',
    'Finishes are generally consistent with age and normal occupancy.',
  ],
  'living-areas': [
    'Minor settlement cracking was observed and should be monitored.',
    'Floor and wall finishes show wear consistent with age and use.',
    'Further investigation is recommended if cracking progresses or widens.',
  ],
  garage: [
    'Garage slab and walls should be monitored for moisture or cracking.',
    'Door operation and weather seals should be maintained.',
    'Adequate ventilation should be maintained to reduce condensation risk.',
  ],
  corrosion: [
    'Surface corrosion was observed to metal elements and treatment or replacement should be considered.',
    'Corrosion is minor at present but should be monitored and maintained.',
  ],
  'minor-defects': [
    'Minor maintenance items were noted and should be addressed in routine upkeep.',
    'Defects are considered minor and typical of properties of similar age.',
  ],
  'major-defects': [
    'A significant defect was observed requiring further investigation by an appropriate licensed professional.',
    'Urgent assessment by a qualified building practitioner is recommended.',
  ],
  'thermal-imaging': [
    'Thermal imaging identified temperature anomalies warranting further investigation.',
    'Anomalies may indicate concealed moisture; confirm with appropriate testing where required.',
  ],
  'moisture-testing': [
    'Elevated moisture readings were recorded and the source should be investigated.',
    'Moisture levels should be re-tested after remedial works are completed.',
  ],
  'pest-d6ChemicalDelignification': [
    'Evidence consistent with chemical delignification was observed. Further assessment is recommended.',
  ],
  'pest-d7FungalDecay': [
    'Fungal decay was observed to timber elements. Remediation by a licensed pest manager is recommended.',
    'Affected timbers should be assessed for structural significance and repaired as required.',
  ],
  'pest-d14MajorSafetyHazards': [
    'A major safety hazard was identified and should be made safe without delay.',
    'Appropriate licensed trades should attend to hazardous conditions as a priority.',
  ],
};

export function getCommentSuggestions(sectionId: string): readonly string[] {
  return SECTION_COMMENT_SUGGESTIONS[sectionId as CommentSuggestionSectionId] ?? [];
}

export function appendInspectionComment(current: string, snippet: string): string {
  const trimmed = current.trim();
  const addition = snippet.trim();
  if (!addition) return current;
  if (!trimmed) return addition;
  if (trimmed.includes(addition)) return current;
  return `${trimmed}\n\n${addition}`;
}
