import { PEST_INSPECTION_SECTION_LABELS } from '@sitescop/room-engine-core';

const BUILDING_LABELS: Record<string, string> = {
  'inspector-hazard': 'Inspector Hazard Assessment',
  'job-information': 'Job Information',
  services: 'Services',
  'property-description': 'Property Description',
  accessibility: 'Accessibility & Risk Assessment',
  'site-conditions': 'Site Conditions',
  external: 'External',
  subfloor: 'Subfloor',
  fencing: 'Fencing',
  outbuildings: 'Outbuildings',
  'roof-exterior': 'Roof Exterior',
  'roof-space': 'Roof Space',
  garage: 'Garage',
  bathrooms: 'Bathrooms',
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  bedrooms: 'Bedrooms',
  'living-areas': 'Living Areas',
  corrosion: 'Corrosion',
  'minor-defects': 'Minor Defects',
  'major-defects': 'Major Defects',
  'moisture-testing': 'Moisture & Thermal Testing',
  conclusion: 'Conclusion',
  recommendations: 'Recommendations',
  'inspector-declaration': 'Certification',
  'pest-risk': 'Timber Pest Risk Assessment',
  'pest-conclusion': 'Pest Conclusion & Certification',
};

const PEST_ROUTE_LABELS = Object.fromEntries(
  Object.entries(PEST_INSPECTION_SECTION_LABELS).map(([key, label]) => [`pest-${key}`, label]),
);

export function sectionLabel(routeId: string): string {
  return BUILDING_LABELS[routeId] ?? PEST_ROUTE_LABELS[routeId] ?? routeId;
}
