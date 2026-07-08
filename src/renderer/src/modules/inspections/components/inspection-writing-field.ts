/** Labels that should not offer writing assist (usually read-only generated text). */
const WRITING_LABEL_EXCLUSIONS = ['report statement'];

/**
 * True when an inspection form label is a free-text narrative field that should
 * offer spell check and grammar assist (location, details, comments, etc.).
 */
export function isInspectionWritingLabel(label: string | undefined): boolean {
  if (!label?.trim()) return false;
  const normalized = label.trim().toLowerCase();
  if (WRITING_LABEL_EXCLUSIONS.some((part) => normalized.includes(part))) return false;

  return (
    normalized.includes('comment') ||
    normalized.includes('location') ||
    normalized.includes('details') ||
    normalized.includes('narrative') ||
    normalized.includes('conclusion') ||
    normalized.includes('assessment') ||
    normalized.includes('explanation') ||
    normalized.includes('product used') ||
    normalized.includes('summary') ||
    normalized.includes('notes')
  );
}

export function isInspectionCommentLabel(label: string | undefined): boolean {
  if (!label?.trim()) return false;
  const normalized = label.trim().toLowerCase();
  return normalized === 'comments' || normalized === 'comment' || normalized.includes('comment');
}
