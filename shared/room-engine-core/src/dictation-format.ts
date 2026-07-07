import type { CommentSuggestionSectionId } from './comment-suggestions.js';
import { NO_ISSUES_OBSERVED_COMMENT } from './property-profile.js';

const SECTION_SUBJECT: Partial<Record<CommentSuggestionSectionId, string>> = {
  services: 'the services',
  accessibility: 'access to areas of the property',
  'site-conditions': 'site conditions',
  external: 'the external building components',
  subfloor: 'the subfloor',
  fencing: 'the fencing',
  outbuildings: 'the outbuildings',
  'roof-exterior': 'the roof exterior',
  'roof-space': 'the roof space',
  kitchen: 'the kitchen',
  laundry: 'the laundry',
  bathrooms: 'the bathroom',
  bedrooms: 'the bedroom',
  'living-areas': 'the living area',
  garage: 'the garage',
  corrosion: 'metal components',
  'minor-defects': 'minor defects',
  'major-defects': 'major defects',
  'thermal-imaging': 'thermal imaging findings',
  'moisture-testing': 'moisture testing results',
  'pest-d6ChemicalDelignification': 'chemical delignification',
  'pest-d7FungalDecay': 'fungal decay',
  'pest-d14MajorSafetyHazards': 'major safety hazards',
};

const NO_ISSUES_PATTERN =
  /\b(no issues?|no problems?|nothing wrong|looks? fine|all good|no damage|no defects?|no concerns?)\b/i;

const DAMAGE_PATTERN =
  /\b(damage|damaged|broken|crack(?:ed|ing)?|lean(?:ing)?|rust(?:y|ed)?|rot(?:ted|ting)?|leak(?:ing)?|moisture|defect(?:ive)?|hole|missing|deteriorat|corrod|split|warp(?:ed)?|hole|stain(?:ed)?)\b/i;

const MAINTENANCE_PATTERN =
  /\b(maintenance|repair|monitor|recommend|should be|needs? (?:to be )?(?:repaired|fixed|replaced|maintained))\b/i;

function cleanTranscript(spoken: string): string {
  return spoken
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1');
}

function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function toReportPhrasing(text: string): string {
  return text
    .replace(/\bthere(?:'s| is| are)\s+/gi, '')
    .replace(/\bgot\b/gi, 'has')
    .replace(/\bkind of\b/gi, '')
    .replace(/\ba bit\b/gi, 'minor')
    .replace(/\breally\b/gi, '')
    .replace(/\bfence\b/gi, 'fencing')
    .replace(/\bsub floor\b/gi, 'subfloor')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSectionSubject(sectionId?: string): string {
  if (!sectionId) return 'the area inspected';
  return SECTION_SUBJECT[sectionId as CommentSuggestionSectionId] ?? 'the area inspected';
}

function alreadyFormal(text: string): boolean {
  return /\b(observed|noted|evidence|recommended|appears|identified|inspected|evident)\b/i.test(text);
}

/** Turn spoken words into a professional inspection comment for the active section. */
export function formatDictatedSectionComment(sectionId: string | undefined, spoken: string): string {
  const cleaned = toReportPhrasing(cleanTranscript(spoken));
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  const subject = getSectionSubject(sectionId);

  if (NO_ISSUES_PATTERN.test(lower)) {
    return NO_ISSUES_OBSERVED_COMMENT;
  }

  if (alreadyFormal(cleaned)) {
    return ensurePeriod(capitalizeFirst(cleaned));
  }

  if (DAMAGE_PATTERN.test(lower)) {
    const detail = capitalizeFirst(cleaned);
    if (/^damage\b/i.test(detail)) {
      return ensurePeriod(detail);
    }
    return ensurePeriod(`Damage was observed to ${subject}. ${detail}`);
  }

  if (MAINTENANCE_PATTERN.test(lower)) {
    return ensurePeriod(`Maintenance is recommended in relation to ${subject}. ${capitalizeFirst(cleaned)}`);
  }

  return ensurePeriod(`${capitalizeFirst(cleaned)} was noted in relation to ${subject}`);
}
