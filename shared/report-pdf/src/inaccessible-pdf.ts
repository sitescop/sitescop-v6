import {
  applyInaccessibleReasonComment,
  isFormSectionInaccessibleFromAccessibility,
  isSubfloorApplicable,
  resolveAccessibilityAreaForFormSectionKey,
  resolveInaccessibleReasonText,
  resolveSubfloorPresent,
} from '../../room-engine-core/src/index.js';
import type { ReportRenderContext } from './types.js';

export function pdfSectionInaccessibleOptions(
  sectionKey: string,
  data: Record<string, unknown>,
  ctx: ReportRenderContext,
): { data: Record<string, unknown>; collapseFields: boolean } {
  const accessibility = ctx.formData.shared.accessibilityObstructions;
  const subfloorApplicable = isSubfloorApplicable(
    resolveSubfloorPresent(
      ctx.formData.shared.propertyDescription,
      ctx.formData.building?.subfloor,
      accessibility,
    ),
  );
  if (
    !isFormSectionInaccessibleFromAccessibility(
      sectionKey,
      accessibility.accessibilityAreas,
      subfloorApplicable,
    )
  ) {
    return { data, collapseFields: false };
  }
  const area = resolveAccessibilityAreaForFormSectionKey(sectionKey);
  if (!area) return { data, collapseFields: false };
  const reason = resolveInaccessibleReasonText(area, accessibility.inaccessibleAreaReasons);
  return {
    data: {
      ...data,
      comments: applyInaccessibleReasonComment(
        typeof data.comments === 'string' ? data.comments : '',
        area,
        reason,
      ),
    },
    collapseFields: true,
  };
}
