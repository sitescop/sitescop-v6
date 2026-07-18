import {
  BUILDING_EXTENSION_SECTION_LABELS,
  SHARED_INSPECTION_SECTION_LABELS,
} from '../../room-engine-core/src/index.js';

/** Professional PDF section titles for building reports (form labels unchanged). */
export const BUILDING_PDF_SECTION_TITLES: Record<string, string> = {
  jobInformation: 'Job Information',
  services: 'Services & Utilities',
  propertyDescription: 'Property Description',
  accessibilityObstructions: 'Accessibility & Obstructions',
  siteConditions: 'Site Conditions',
  external: 'External Building Elements',
  roofExterior: 'Roof Exterior',
  roofSpace: 'Roof Space',
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  subfloor: 'Subfloor Space',
  fencing: 'Fencing',
  outbuildings: 'Outbuildings & Ancillary Structures',
  corrosion: 'Corrosion',
  minorDefects: 'Minor Defects',
  majorDefects: 'Major Defects',
  moistureTesting: 'Moisture & Thermal Testing',
  conclusion: 'Conclusion',
  recommendations: 'Recommendations',
  inspectorDeclaration: 'Certification',
};

export function buildingPdfSectionTitle(key: string): string {
  return BUILDING_PDF_SECTION_TITLES[key] ?? BUILDING_EXTENSION_SECTION_LABELS[key as keyof typeof BUILDING_EXTENSION_SECTION_LABELS] ?? SHARED_INSPECTION_SECTION_LABELS[key as keyof typeof SHARED_INSPECTION_SECTION_LABELS] ?? key;
}

export const BUILDING_PDF_PART_TITLES: Record<string, string> = {
  jobInformation: '1. Property & Engagement Information',
  inspectionSummary: '2. Results of Inspection (Summary)',
  accessibilityObstructions: '3. Site & Access Assessment',
  external: '4. Exterior, Subfloor & Roof Inspection',
  kitchen: '5. Internal Areas',
  minorDefects: '6. Defects & Specialist Testing',
  conclusion: '7. Summary & Certification',
};

import { renderPdfPartHeading } from './report-design.js';

export function buildingPdfPartTitleForKey(key: string): string | null {
  return BUILDING_PDF_PART_TITLES[key] ?? null;
}

export { renderPdfPartHeading };
