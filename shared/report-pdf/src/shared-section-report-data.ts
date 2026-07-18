import {
  getMissingAccessibilityAreas,
  isSubfloorApplicable,
  resolveInaccessibleReasonText,
  resolveSubfloorPresent,
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

  const accessibility = shared.accessibilityObstructions;
  const subfloorApplicable = isSubfloorApplicable(
    resolveSubfloorPresent(shared.propertyDescription, undefined, accessibility),
  );
  const missing = getMissingAccessibilityAreas(
    accessibility.accessibilityAreas,
    subfloorApplicable,
  );
  const reasons: Record<string, string> = {};
  for (const area of missing) {
    reasons[area] = resolveInaccessibleReasonText(area, accessibility.inaccessibleAreaReasons);
  }

  return {
    ...data,
    // Area names only — never reason preset strings.
    inaccessibleAreas: {
      selected: [...missing],
      custom: accessibility.inaccessibleAreas?.custom ?? [],
    },
    inaccessibleAreaReasons: reasons,
    photos: stripLinkedServicePhotosFromAccessibility(
      accessibility.photos,
      shared.services,
    ),
  };
}
