import {
  stripLinkedServicePhotosFromAccessibility,
  type SharedInspectionSectionKey,
  type SharedInspectionSections,
} from '../../room-engine-core/src/index.js';

export function sharedSectionDataForReport(
  key: SharedInspectionSectionKey,
  shared: SharedInspectionSections,
): Record<string, unknown> {
  const data = shared[key] as unknown as Record<string, unknown>;
  if (key !== 'accessibilityObstructions') return data;
  return {
    ...data,
    photos: stripLinkedServicePhotosFromAccessibility(
      shared.accessibilityObstructions.photos,
      shared.services,
    ),
  };
}
