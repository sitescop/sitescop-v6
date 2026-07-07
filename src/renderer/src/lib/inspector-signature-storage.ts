const STORAGE_PREFIX = 'sitescop:inspector-signature:';

export function getSavedInspectorSignature(userId: string | undefined): string {
  if (!userId || typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) ?? '';
  } catch {
    return '';
  }
}

export function saveInspectorSignature(userId: string | undefined, dataUrl: string): void {
  if (!userId || !dataUrl || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, dataUrl);
  } catch {
    // ignore quota errors
  }
}

export function clearSavedInspectorSignature(userId: string | undefined): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}
