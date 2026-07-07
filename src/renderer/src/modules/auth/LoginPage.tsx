import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from './auth-store';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { getSitescopApi } from '@/lib/sitescop-api';

export function LoginPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('inspector@sitescop.com.au');
  const [password, setPassword] = useState('SiteScop2026!');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-text-muted">
          Secure local login — your data stays on this device.
        </p>
      </div>
    </div>
  );
}
