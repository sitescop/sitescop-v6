import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/auth-store';
import { LoginPage } from '@/modules/auth/LoginPage';
import { AppRouter } from '@/app/AppRouter';
import { BrowserWarningPage } from '@/modules/system/BrowserWarningPage';
import { AgreementSignPage } from '@/modules/agreements/AgreementSignPage';
import { isBrowserOnly, waitForSitescopApi } from '@/lib/sitescop-api';

function isAgreementSignRoute(): boolean {
  return window.location.hash.includes('/agreements/sign/');
}

export function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const browserOnly = isBrowserOnly();

  useEffect(() => {
    if (browserOnly) return;

    let cancelled = false;

    async function boot() {
      const api = await waitForSitescopApi();
      if (cancelled) return;

      if (!api) {
        setStartupError(
          'Desktop bridge not loaded. Close ALL SiteScop windows, then double-click START-SITESCOP.bat.',
        );
        setLoading(false);
        return;
      }

      if (!api.jobs?.create) {
        setStartupError(
          'Job features missing. In the sitescop-v6 folder run: npm run build — then START-SITESCOP.bat again.',
        );
        setLoading(false);
        return;
      }

      if (!api.inspections?.getByJob) {
        setStartupError(
          'Inspection features missing. Close ALL SiteScop windows, then double-click START-SITESCOP.bat again.',
        );
        setLoading(false);
        return;
      }

      if (!api.agreements?.create) {
        setStartupError(
          'Agreement features missing. Close ALL SiteScop windows, then double-click START-SITESCOP.bat again.',
        );
        setLoading(false);
        return;
      }

      setBridgeReady(true);

      try {
        const session = await api.auth.getSession();
        if (!cancelled) setUser(session);
      } catch {
        if (!cancelled) {
          setStartupError('Could not connect to local database. Restart SiteScop.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [browserOnly, setUser, setLoading]);

  if (browserOnly) {
    return <BrowserWarningPage />;
  }

  if (startupError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md rounded-lg border border-danger/30 bg-surface p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-danger">SiteScop V6</h1>
          <p className="mt-4 text-sm text-text">{startupError}</p>
          <p className="mt-4 text-xs text-text-muted">
            Use START-SITESCOP.bat — not Chrome or Edge.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !bridgeReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">SiteScop V6 — Desktop App</p>
          <p className="mt-2 text-text-light">Starting local database...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (bridgeReady && isAgreementSignRoute()) {
      return (
        <HashRouter>
          <Routes>
            <Route path="/agreements/sign/:token" element={<AgreementSignPage />} />
          </Routes>
        </HashRouter>
      );
    }
    return <LoginPage />;
  }

  return (
    <HashRouter>
      <AppRouter />
    </HashRouter>
  );
}

export default App;
