import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from './auth-store';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { getSitescopApi } from '@/lib/sitescop-api';

type LoginView = 'login' | 'forgot' | 'reset';

export function LoginPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('inspector@sitescop.com.au');
  const [password, setPassword] = useState('SiteScop2026!');
  const [remember, setRemember] = useState(true);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const result = await getSitescopApi().auth.login(email, password, remember);
      if (!result.success || !result.user) {
        setError(result.error ?? 'Login failed.');
        return;
      }
      setUser(result.user);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const result = await getSitescopApi().auth.requestPasswordReset(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setInfo(result.message);
      setView('reset');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const result = await getSitescopApi().auth.confirmPasswordReset({
        email,
        token: resetToken,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPassword('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setInfo(result.message);
      setView('login');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sidebar via-primary-dark to-secondary p-6">
      <div className="w-full max-w-md rounded-lg bg-surface p-8 shadow-elevated">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text">SiteScop V6</h1>
          <p className="mt-1 text-sm text-text-light">Local Building &amp; Pest Inspection Platform</p>
        </div>

        {view === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label className="flex items-center gap-2 text-sm text-text-light">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              Remember me
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}
            {info && <p className="text-sm text-success">{info}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>

            <button
              type="button"
              className="mt-1 w-full rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
              onClick={() => {
                setError('');
                setInfo('');
                setView('forgot');
              }}
            >
              Forgot email or password?
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <p className="text-sm text-text-light">
              Enter your account email. If SMTP is configured in Settings → Email, we will send a
              reset code.
            </p>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            {info && <p className="text-sm text-success">{info}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset code'}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-primary hover:underline"
              onClick={() => {
                setError('');
                setInfo('');
                setView('login');
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <p className="text-sm text-text-light">
              Paste the reset code from your email, then choose a new password.
            </p>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Reset code"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            {info && <p className="text-sm text-success">{info}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-primary hover:underline"
              onClick={() => {
                setError('');
                setInfo('');
                setView('forgot');
              }}
            >
              Resend code
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-text-muted">
          Secure local login — your data stays on this device.
        </p>
      </div>
    </div>
  );
}
