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
  'moisture-testing': [
    'Elevated moisture readings were recorded and the source should be investigated.',
    'Moisture levels should be re-tested after remedial works are completed.',
    'Thermal imaging identified temperature anomalies warranting further investigation.',
    'Anomalies may indicate concealed moisture; confirm with appropriate testing where required.',
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

/** Quick comments shown when "Major defect observed" is active for a section. */
const MAJOR_SECTION_COMMENT_SUGGESTIONS: Partial<
  Record<CommentSuggestionSectionId, readonly string[]>
> = {
  external: [
    'A major defect was observed to the external fabric. Further investigation by an appropriate licensed professional is recommended.',
    'Significant external deterioration or movement was noted; assessment and remedial works by a qualified building practitioner are recommended.',
    'The defect may affect structural performance or weatherproofing and should be addressed as a priority.',
  ],
  subfloor: [
    'A major defect was observed in the subfloor. Further investigation by an appropriate licensed professional is recommended.',
    'Significant subfloor deterioration or moisture-related damage was noted; assessment and remedial action are recommended.',
    'The condition may affect structural support and should be assessed by a qualified building practitioner.',
  ],
  fencing: [
    'A major defect was observed to fencing. Repair or replacement by an appropriate contractor is recommended.',
    'Significant fencing failure was noted and may present a safety or boundary risk; prompt remediation is recommended.',
  ],
  outbuildings: [
    'A major defect was observed to the outbuilding. Further assessment and remedial works are recommended.',
    'Significant outbuilding deterioration was noted; a qualified building practitioner should assess structural and weatherproofing condition.',
  ],
  'roof-exterior': [
    'A major defect was observed to the roof exterior. Assessment by a licensed roof plumber or builder is recommended.',
    'Significant roof covering, flashing or drainage failure was noted and may allow moisture ingress; prompt remediation is recommended.',
  ],
  'roof-space': [
    'A major defect was observed in the roof space. Further investigation by an appropriate licensed professional is recommended.',
    'Significant framing, moisture or structural concern was noted in the roof space; assessment by a qualified building practitioner is recommended.',
  ],
  kitchen: [
    'A major defect was observed in the kitchen. Further investigation by an appropriate licensed trade is recommended.',
    'Significant kitchen damage or moisture-related failure was noted; assessment and remedial works are recommended as a priority.',
  ],
  laundry: [
    'A major defect was observed in the laundry. Further investigation by an appropriate licensed trade is recommended.',
    'Significant moisture or structural concern was noted in the laundry wet area; prompt assessment and remediation are recommended.',
  ],
  bathrooms: [
    'A major defect was observed in the bathroom. Waterproofing assessment and remediation by an appropriate licensed professional are recommended.',
    'Significant wet-area failure or moisture damage was noted; further investigation and remedial works are recommended as a priority.',
  ],
  bedrooms: [
    'A major defect was observed in the bedroom. Further investigation by an appropriate licensed professional is recommended.',
    'Significant structural or moisture-related concern was noted; assessment by a qualified building practitioner is recommended.',
  ],
  'living-areas': [
    'A major defect was observed in the living area. Further investigation by an appropriate licensed professional is recommended.',
    'Significant structural movement, cracking or moisture-related damage was noted; assessment by a qualified building practitioner is recommended.',
  ],
  garage: [
    'A major defect was observed in the garage. Further investigation by an appropriate licensed professional is recommended.',
    'Significant structural, moisture or safety-related concern was noted; assessment and remedial works are recommended.',
  ],
  corrosion: [
    'Significant corrosion was observed and may compromise structural or safety performance. Assessment and remediation by an appropriate professional are recommended.',
  ],
  'moisture-testing': [
    'Elevated moisture consistent with a major defect concern was recorded. The source should be investigated by an appropriate licensed professional without delay.',
    'Moisture evidence indicates a significant defect risk; further investigation and remedial action are recommended.',
  ],
};

function resolveSuggestionSectionId(sectionId: string): CommentSuggestionSectionId | null {
  if (sectionId === 'thermal-imaging') return 'moisture-testing';
  if (sectionId.startsWith('bathroom-')) return 'bathrooms';
  if (sectionId.startsWith('bedroom-')) return 'bedrooms';
  if (sectionId.startsWith('living-')) return 'living-areas';
  if (sectionId.startsWith('garage-')) return 'garage';
  if (sectionId in SECTION_COMMENT_SUGGESTIONS) {
    return sectionId as CommentSuggestionSectionId;
  }
  return null;
}

export function getCommentSuggestions(
  sectionId: string,
  options?: { major?: boolean },
): readonly string[] {
  const resolvedId = resolveSuggestionSectionId(sectionId);
  if (!resolvedId) return [];
  if (options?.major) {
    return (
      MAJOR_SECTION_COMMENT_SUGGESTIONS[resolvedId] ??
      SECTION_COMMENT_SUGGESTIONS[resolvedId] ??
      []
    );
  }
  return SECTION_COMMENT_SUGGESTIONS[resolvedId] ?? [];
}

export function appendInspectionComment(current: string, snippet: string): string {
  const trimmed = current.trim();
  const addition = snippet.trim();
  if (!addition) return current;
  if (!trimmed) return addition;
  if (trimmed.includes(addition)) return current;
  return `${trimmed}\n\n${addition}`;
}
