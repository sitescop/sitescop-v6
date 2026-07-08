import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Cloud,
  DollarSign,
  ImageIcon,
  Lock,
  Mic,
  Recycle,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import type {
  BillingSettingsInput,
  ChangePasswordInput,
  CompanySettingsInput,
  GitHubSettingsInput,
  GitHubTestConnectionResult,
  InspectorProfileInput,
  InspectionType,
  ReportSettingsInput,
} from '@shared/api-types';
import { getSettingsApi } from '@/lib/sitescop-api';
import { useAuthStore } from '@/modules/auth/auth-store';
import { VoiceDictationSettingsCard } from '@/modules/settings/VoiceDictationSettingsCard';
import { Button, Card, Input, Textarea } from '@/design-system/components';

type SettingsTab = 'inspector' | 'voice' | 'company' | 'billing' | 'reports' | 'security' | 'github';

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: 'inspector', label: 'Inspector', icon: User },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'company', label: 'Company & Logo', icon: Building2 },
  { id: 'billing', label: 'Billing & Invoices', icon: DollarSign },
  { id: 'reports', label: 'Reports & PDF', icon: ImageIcon },
  { id: 'security', label: 'Login & Password', icon: Lock },
  { id: 'github', label: 'GitHub Signing', icon: Cloud },
];

function centsToPriceInput(cents: number): string {
  return String(cents / 100);
}

function priceInputToCents(value: string, fallback: number): number {
  const parsed = Math.round(Number.parseFloat(value) * 100);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function defaultPriceInputs(billing: BillingSettingsInput): Record<InspectionType, string> {
  return {
    BUILDING: centsToPriceInput(billing.buildingPriceCents),
    PEST: centsToPriceInput(billing.pestPriceCents),
    COMBINED: centsToPriceInput(billing.combinedPriceCents),
  };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [tab, setTab] = useState<SettingsTab>('inspector');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const profileQuery = useQuery({
    queryKey: ['settings-profile'],
    queryFn: () => getSettingsApi().getProfile(),
  });

  const appQuery = useQuery({
    queryKey: ['settings-app'],
    queryFn: () => getSettingsApi().getApp(),
  });

  const githubQuery = useQuery({
    queryKey: ['settings-github'],
    queryFn: () => getSettingsApi().getGitHub(),
  });

  const [profile, setProfile] = useState<InspectorProfileInput>({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    mobile: '',
  });

  const [company, setCompany] = useState<CompanySettingsInput>({
    name: '',
    abn: '',
    phone: '',
    email: '',
    website: '',
    address: '',
  });

  const [report, setReport] = useState<ReportSettingsInput>({
    primaryColor: '#1B4332',
    secondaryColor: '#D4A017',
    pdfFooterText: '',
    pdfIncludeLogo: true,
    reportHeader: '',
    reportFooter: '',
  });

  const [billing, setBilling] = useState<BillingSettingsInput>({
    buildingPriceCents: 55000,
    pestPriceCents: 35000,
    combinedPriceCents: 85000,
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
    invoicePaymentTerms: '',
    invoicePaymentNotes: '',
  });

  const [priceInputs, setPriceInputs] = useState<Record<InspectionType, string>>({
    BUILDING: '550',
    PEST: '350',
    COMBINED: '850',
  });

  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [githubForm, setGithubForm] = useState<GitHubSettingsInput>({
    enabled: false,
    owner: '',
    repo: '',
    branch: 'main',
    pagesBaseUrl: '',
    publicRelayUrl: '',
  });
  const [personalAccessToken, setPersonalAccessToken] = useState('');
  const [testResult, setTestResult] = useState<GitHubTestConnectionResult | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfile({
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      email: profileQuery.data.email,
      companyName: profileQuery.data.companyName,
      mobile: profileQuery.data.mobile ?? '',
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (!appQuery.data) return;
    setCompany(appQuery.data.company);
    setReport({
      ...appQuery.data.report,
      reportHeader: appQuery.data.report.reportHeader ?? '',
      reportFooter: appQuery.data.report.reportFooter ?? '',
    });
    setBilling(appQuery.data.billing);
    setPriceInputs(defaultPriceInputs(appQuery.data.billing));
    setLogoPreview(appQuery.data.logoPreview);
  }, [appQuery.data]);

  useEffect(() => {
    if (!githubQuery.data) return;
    setGithubForm({
      enabled: githubQuery.data.enabled,
      owner: githubQuery.data.owner,
      repo: githubQuery.data.repo,
      branch: githubQuery.data.branch,
      pagesBaseUrl: githubQuery.data.pagesBaseUrl,
      publicRelayUrl: githubQuery.data.publicRelayUrl,
    });
  }, [githubQuery.data]);

  function clearStatus() {
    setMessage('');
    setError('');
  }

  const saveProfileMutation = useMutation({
    mutationFn: () => getSettingsApi().saveProfile(profile),
    onSuccess: (user) => {
      setUser(user);
      clearStatus();
      setMessage('Inspector profile saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings-profile'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save profile'),
  });

  const saveCompanyMutation = useMutation({
    mutationFn: () => getSettingsApi().saveCompany(company),
    onSuccess: () => {
      clearStatus();
      setMessage('Company details saved. Client signing pages and PDFs will use these details.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save company settings'),
  });

  const saveReportMutation = useMutation({
    mutationFn: () =>
      getSettingsApi().saveReport({
        ...report,
        reportHeader: report.reportHeader?.trim() || null,
        reportFooter: report.reportFooter?.trim() || null,
      }),
    onSuccess: () => {
      clearStatus();
      setMessage('Report and PDF settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save report settings'),
  });

  const saveBillingMutation = useMutation({
    mutationFn: () =>
      getSettingsApi().saveBilling({
        buildingPriceCents: priceInputToCents(priceInputs.BUILDING, billing.buildingPriceCents),
        pestPriceCents: priceInputToCents(priceInputs.PEST, billing.pestPriceCents),
        combinedPriceCents: priceInputToCents(priceInputs.COMBINED, billing.combinedPriceCents),
        bankAccountName: billing.bankAccountName,
        bankBsb: billing.bankBsb,
        bankAccountNumber: billing.bankAccountNumber,
        invoicePaymentTerms: billing.invoicePaymentTerms,
        invoicePaymentNotes: billing.invoicePaymentNotes,
      }),
    onSuccess: (saved) => {
      clearStatus();
      setBilling(saved);
      setPriceInputs(defaultPriceInputs(saved));
      setMessage('Billing and invoice settings saved. New agreements and invoices will use these details.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save billing settings'),
  });

  const passwordMutation = useMutation({
    mutationFn: () => getSettingsApi().changePassword(passwordForm),
    onSuccess: () => {
      clearStatus();
      setMessage('Password updated successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not change password'),
  });

  const logoSelectMutation = useMutation({
    mutationFn: () => getSettingsApi().selectLogo(),
    onSuccess: (result) => {
      clearStatus();
      setLogoPreview(result.logoPreview);
      setMessage(result.saved ? 'Logo uploaded.' : 'Logo upload cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not upload logo'),
  });

  const logoRemoveMutation = useMutation({
    mutationFn: () => getSettingsApi().removeLogo(),
    onSuccess: () => {
      clearStatus();
      setLogoPreview(null);
      setMessage('Logo removed.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not remove logo'),
  });

  const saveGithubMutation = useMutation({
    mutationFn: () =>
      getSettingsApi().saveGitHub({
        ...githubForm,
        personalAccessToken: personalAccessToken.trim() || undefined,
      }),
    onSuccess: () => {
      setPersonalAccessToken('');
      clearStatus();
      setTestResult(null);
      setMessage('GitHub settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings-github'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save GitHub settings'),
  });

  const testGithubMutation = useMutation({
    mutationFn: async () => {
      const settingsApi = getSettingsApi();
      await settingsApi.saveGitHub({
        ...githubForm,
        personalAccessToken: personalAccessToken.trim() || undefined,
      });
      return settingsApi.testGitHub();
    },
    onSuccess: (result) => {
      setPersonalAccessToken('');
      clearStatus();
      void queryClient.invalidateQueries({ queryKey: ['settings-github'] });
      setTestResult(result);
    },
    onError: (e) => {
      setTestResult(null);
      setMessage('');
      setError(e instanceof Error ? e.message : 'Connection failed');
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">Settings</h2>
            <p className="text-sm text-text-light">
              Inspector profile, voice dictation, company details, billing, reports, login, and GitHub signing
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate('/recycle-bin')}>
          <Recycle className="h-4 w-4" />
          Recycle Bin
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setTab(item.id);
              clearStatus();
            }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </div>

      {message && <p className="mb-4 text-sm text-success">{message}</p>}
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {tab === 'inspector' && (
        <Card className="space-y-4 p-6">
          <div>
            <h3 className="font-bold text-text">Inspector profile</h3>
            <p className="mt-1 text-sm text-text-light">
              Your name and contact details appear on reports and emails.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" value={profile.firstName} onChange={(e) => setProfile((c) => ({ ...c, firstName: e.target.value }))} />
            <Input label="Last name" value={profile.lastName} onChange={(e) => setProfile((c) => ({ ...c, lastName: e.target.value }))} />
            <Input label="Login email" type="email" value={profile.email} onChange={(e) => setProfile((c) => ({ ...c, email: e.target.value }))} />
            <Input label="Mobile" value={profile.mobile ?? ''} onChange={(e) => setProfile((c) => ({ ...c, mobile: e.target.value }))} placeholder="0401 427 366" />
            <Input label="Display company name" className="sm:col-span-2" value={profile.companyName} onChange={(e) => setProfile((c) => ({ ...c, companyName: e.target.value }))} />
          </div>
          <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
            {saveProfileMutation.isPending ? 'Saving…' : 'Save inspector profile'}
          </Button>
        </Card>
      )}

      {tab === 'voice' && <VoiceDictationSettingsCard />}

      {tab === 'company' && (
        <Card className="space-y-5 p-6">
          <div>
            <h3 className="font-bold text-text">Company details</h3>
            <p className="mt-1 text-sm text-text-light">
              Used on client signing pages, agreements, and PDF reports. Defaults include your phone{' '}
              <strong>0401 427 366</strong> and website <strong>www.sitescop.com.au</strong>.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company name" value={company.name} onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} />
            <Input label="ABN" value={company.abn} onChange={(e) => setCompany((c) => ({ ...c, abn: e.target.value }))} />
            <Input label="Phone" value={company.phone} onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} />
            <Input label="Email" value={company.email} onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} />
            <Input label="Website" value={company.website} onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))} />
            <Input label="Business address" value={company.address} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} />
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="font-semibold text-text">Company logo</h4>
            <p className="mt-1 text-sm text-text-light">
              Shown on PDF reports when &quot;Include logo on PDFs&quot; is enabled. The SiteScop logo is used by default until you upload your own.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
                {logoPreview ? (
                  <img src={logoPreview} alt="Company logo" className="max-h-20 max-w-36 object-contain" />
                ) : (
                  <span className="text-xs text-text-muted">No logo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => logoSelectMutation.mutate()} disabled={logoSelectMutation.isPending}>
                  {logoSelectMutation.isPending ? 'Uploading…' : 'Upload logo'}
                </Button>
                {logoPreview && (
                  <Button variant="secondary" onClick={() => logoRemoveMutation.mutate()} disabled={logoRemoveMutation.isPending}>
                    Remove logo
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Button onClick={() => saveCompanyMutation.mutate()} disabled={saveCompanyMutation.isPending}>
            {saveCompanyMutation.isPending ? 'Saving…' : 'Save company details'}
          </Button>
        </Card>
      )}

      {tab === 'billing' && (
        <Card className="space-y-6 p-6">
          <div>
            <h3 className="font-bold text-text">Inspection prices</h3>
            <p className="mt-1 text-sm text-text-light">
              Default prices for new agreements (ex GST). GST is calculated automatically at 10%.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Building inspection (AUD ex GST)"
              type="number"
              min="0"
              step="0.01"
              value={priceInputs.BUILDING}
              onChange={(e) => setPriceInputs((c) => ({ ...c, BUILDING: e.target.value }))}
              placeholder="550"
            />
            <Input
              label="Pest inspection (AUD ex GST)"
              type="number"
              min="0"
              step="0.01"
              value={priceInputs.PEST}
              onChange={(e) => setPriceInputs((c) => ({ ...c, PEST: e.target.value }))}
              placeholder="350"
            />
            <Input
              label="Combined inspection (AUD ex GST)"
              type="number"
              min="0"
              step="0.01"
              value={priceInputs.COMBINED}
              onChange={(e) => setPriceInputs((c) => ({ ...c, COMBINED: e.target.value }))}
              placeholder="850"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <h3 className="font-bold text-amber-950">Invoice payment details</h3>
            <p className="mt-1 text-sm text-amber-900/80">
              Shown on tax invoice PDFs for bank transfer and payment instructions.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Account name"
                value={billing.bankAccountName}
                onChange={(e) => setBilling((c) => ({ ...c, bankAccountName: e.target.value }))}
                placeholder="SiteScop Pty Ltd"
              />
              <Input
                label="BSB"
                value={billing.bankBsb}
                onChange={(e) => setBilling((c) => ({ ...c, bankBsb: e.target.value }))}
                placeholder="000-000"
              />
              <Input
                label="Account number"
                className="sm:col-span-2"
                value={billing.bankAccountNumber}
                onChange={(e) => setBilling((c) => ({ ...c, bankAccountNumber: e.target.value }))}
                placeholder="12345678"
              />
              <Textarea
                label="Payment terms"
                className="sm:col-span-2"
                rows={2}
                value={billing.invoicePaymentTerms}
                onChange={(e) => setBilling((c) => ({ ...c, invoicePaymentTerms: e.target.value }))}
                placeholder="Payment is due within 7 days of the invoice date."
              />
              <Textarea
                label="Payment notes & requirements"
                className="sm:col-span-2"
                rows={3}
                value={billing.invoicePaymentNotes}
                onChange={(e) => setBilling((c) => ({ ...c, invoicePaymentNotes: e.target.value }))}
                placeholder="Please use the invoice number as your payment reference."
              />
            </div>
          </div>

          <Button onClick={() => saveBillingMutation.mutate()} disabled={saveBillingMutation.isPending}>
            {saveBillingMutation.isPending ? 'Saving…' : 'Save billing & invoice settings'}
          </Button>
        </Card>
      )}

      {tab === 'reports' && (
        <Card className="space-y-4 p-6">
          <div>
            <h3 className="font-bold text-text">Reports & PDF branding</h3>
            <p className="mt-1 text-sm text-text-light">Colours and footer text for inspection PDF reports.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Primary colour" value={report.primaryColor} onChange={(e) => setReport((c) => ({ ...c, primaryColor: e.target.value }))} placeholder="#1B4332" />
            <Input label="Accent colour" value={report.secondaryColor} onChange={(e) => setReport((c) => ({ ...c, secondaryColor: e.target.value }))} placeholder="#D4A017" />
            <Input label="PDF footer text" className="sm:col-span-2" value={report.pdfFooterText} onChange={(e) => setReport((c) => ({ ...c, pdfFooterText: e.target.value }))} />
            <Input label="Report header (optional)" className="sm:col-span-2" value={report.reportHeader ?? ''} onChange={(e) => setReport((c) => ({ ...c, reportHeader: e.target.value }))} />
            <Input label="Report footer note (optional)" className="sm:col-span-2" value={report.reportFooter ?? ''} onChange={(e) => setReport((c) => ({ ...c, reportFooter: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input type="checkbox" checked={report.pdfIncludeLogo} onChange={(e) => setReport((c) => ({ ...c, pdfIncludeLogo: e.target.checked }))} />
            Include company logo on PDF reports
          </label>
          <Button onClick={() => saveReportMutation.mutate()} disabled={saveReportMutation.isPending}>
            {saveReportMutation.isPending ? 'Saving…' : 'Save report settings'}
          </Button>
        </Card>
      )}

      {tab === 'security' && (
        <Card className="space-y-4 p-6">
          <div>
            <h3 className="font-bold text-text">Login & password</h3>
            <p className="mt-1 text-sm text-text-light">
              Change your SiteScop login password. Your email is changed under Inspector profile.
            </p>
          </div>
          <Input label="Current password" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, currentPassword: e.target.value }))} />
          <Input label="New password" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, newPassword: e.target.value }))} />
          <Input label="Confirm new password" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, confirmPassword: e.target.value }))} />
          <Button onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? 'Updating…' : 'Change password'}
          </Button>
        </Card>
      )}

      {tab === 'github' && (
        <Card className="space-y-5 p-6">
          <div>
            <h3 className="font-bold text-text">GitHub Cloud Signing</h3>
            <p className="mt-1 text-sm text-text-light">
              Upload agreements to GitHub and send clients a public signing link.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input type="checkbox" checked={githubForm.enabled} onChange={(e) => setGithubForm((c) => ({ ...c, enabled: e.target.checked }))} />
            Enable GitHub Cloud Signing
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="GitHub Owner" value={githubForm.owner} onChange={(e) => setGithubForm((c) => ({ ...c, owner: e.target.value }))} />
            <Input label="Repository Name" value={githubForm.repo} onChange={(e) => setGithubForm((c) => ({ ...c, repo: e.target.value }))} />
            <Input label="Branch" value={githubForm.branch} onChange={(e) => setGithubForm((c) => ({ ...c, branch: e.target.value }))} />
            <Input label="GitHub Pages URL" value={githubForm.pagesBaseUrl} onChange={(e) => setGithubForm((c) => ({ ...c, pagesBaseUrl: e.target.value }))} />
          </div>
          <Input
            label="Personal Access Token (desktop only)"
            type="password"
            value={personalAccessToken}
            onChange={(e) => setPersonalAccessToken(e.target.value)}
            placeholder={githubQuery.data?.hasPersonalAccessToken ? 'Saved securely — enter only to replace' : 'ghp_...'}
          />
          {testResult && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
              <p className="font-semibold text-success">Connection successful</p>
              <p className="mt-1 text-text-light">Repository: {testResult.repository} ({testResult.defaultBranch})</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveGithubMutation.mutate()} disabled={saveGithubMutation.isPending}>
              {saveGithubMutation.isPending ? 'Saving…' : 'Save GitHub settings'}
            </Button>
            <Button variant="secondary" onClick={() => testGithubMutation.mutate()} disabled={testGithubMutation.isPending}>
              {testGithubMutation.isPending ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
