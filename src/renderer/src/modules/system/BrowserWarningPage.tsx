import { Monitor, XCircle } from 'lucide-react';

export function BrowserWarningPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-primary-dark p-6">
      <div className="max-w-lg rounded-xl border border-white/10 bg-surface p-8 shadow-elevated">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
          <XCircle className="h-9 w-9 text-danger" />
        </div>

        <h1 className="text-center text-2xl font-bold text-text">Wrong window — use the desktop app</h1>

        <p className="mt-4 text-center text-sm leading-relaxed text-text-light">
          You opened SiteScop in <strong>Chrome or Edge</strong>. That will not work. SiteScop V6 must
          run as a <strong>desktop program</strong> (Electron), not in a browser tab.
        </p>

        <div className="mt-6 space-y-4 rounded-lg bg-background p-5 text-sm text-text">
          <p className="font-semibold text-primary">How to start SiteScop correctly:</p>
          <ol className="list-decimal space-y-2 pl-5 text-text-light">
            <li>Close this Chrome/Edge tab completely.</li>
            <li>
              Open folder:{' '}
              <code className="rounded bg-surface px-1.5 py-0.5 text-xs">sitescop-v6</code>
            </li>
            <li>
              Double-click{' '}
              <strong className="text-text">START-SITESCOP.bat</strong>
            </li>
            <li>
              Wait for the window titled{' '}
              <strong className="text-text">SiteScop V6 — Desktop App</strong>
            </li>
          </ol>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-text-light">
            The correct window has a menu bar (File, View, Help) at the top. Press{' '}
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
              F12
            </kbd>{' '}
            there for developer tools — not in Chrome.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Login: inspector@sitescop.com.au / SiteScop2026!
        </p>
      </div>
    </div>
  );
}
