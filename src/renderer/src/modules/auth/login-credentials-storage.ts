const STORAGE_KEY = 'sitescop:login-credentials';

interface SavedLoginCredentials {
  email: string;
  password: string;
}

export function getInitialLoginFormState(): {
  email: string;
  password: string;
  remember: boolean;
} {
  const saved = loadSavedLoginCredentials();
  if (saved) {
    return { email: saved.email, password: saved.password, remember: true };
  }
  return { email: '', password: '', remember: false };
}

export function loadSavedLoginCredentials(): SavedLoginCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLoginCredentials>;
    if (typeof parsed.email !== 'string' || typeof parsed.password !== 'string') {
      return null;
    }
    if (!parsed.email.trim() || !parsed.password) {
      return null;
    }
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export function saveLoginCredentials(credentials: SavedLoginCredentials): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    );
  } catch {
    // ignore quota errors
  }
}

export function clearLoginCredentials(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
