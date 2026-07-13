import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Cloud,
  DollarSign,
  ImageIcon,
  Link2,
  Lock,
  Mail,
  Megaphone,
  Mic,
  Recycle,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import type {
  BillingSettingsInput,
  ChangePasswordInput,
  CompanySettingsInput,
  EmailMailClient,
  EmailSettingsInput,
  GitHubSettingsInput,
  GitHubTestConnectionResult,
  InspectorProfileInput,
  InspectionType,
  ReportSettingsInput,
  ReminderSettingsInput,
  SmtpEncryption,
  SmtpTestResult,
  XeroSettingsInput,
} from '@shared/api-types';
import { audStringToExCents, gstPricePairFromExCents } from '@shared/gst-pricing';
import { getSettingsApi, getSitescopApi, getSmtpSettingsApi, hasDataArchiveApi, hasSmtpApi } from '@/lib/sitescop-api';
import { useAuthStore } from '@/modules/auth/auth-store';
import { VoiceDictationSettingsCard } from '@/modules/settings/VoiceDictationSettingsCard';
import { GstPriceFieldPair } from '@/modules/billing/GstPriceFieldPair';
import { Button, Card, Input, Modal, Select, Textarea } from '@/design-system/components';

type SettingsTab =
  | 'inspector'
  | 'voice'
  | 'company'
  | 'billing'
  | 'email'
  | 'marketing'
  | 'reminders'
  | 'reports'
  | 'security'
  | 'github'
  | 'xero';

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: 'inspector', label: 'Inspector', icon: User },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'company', label: 'Company & Logo', icon: Building2 },
  { id: 'billing', label: 'Billing & Invoices', icon: DollarSign },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'reports', label: 'Reports & PDF', icon: ImageIcon },
  { id: 'security', label: 'Login & Password', icon: Lock },
  { id: 'github', label: 'GitHub Signing', icon: Cloud },
  { id: 'xero', label: 'Xero & MYOB', icon: Link2 },
];

const MAIL_CLIENT_OPTIONS: Array<{ value: EmailMailClient; label: string }> = [
  { value: 'zoho', label: 'Zoho Mail (browser)' },
  { value: 'outlook', label: 'Outlook / Windows mail (mailto)' },
  { value: 'system', label: 'System default mail app' },
];

const SMTP_ENCRYPTION_OPTIONS: Array<{ value: SmtpEncryption; label: string }> = [
  { value: 'ssl', label: 'SSL (port 465)' },
  { value: 'tls', label: 'STARTTLS (port 587)' },
  { value: 'none', label: 'None' },
];

const DEFAULT_EMAIL_FORM: EmailSettingsInput = {
  mailClient: 'zoho',
  fromEmail: '',
  includePdfAttachTip: true,
  signingSubject: '',
  signingBody: '',
  reportSubject: '',
  reportBody: '',
  generalSubject: '',
  generalBody: '',
  invoiceSubject: '',
  invoiceBody: '',
  smtpEnabled: false,
  smtpHost: 'smtp.zoho.com.au',
  smtpPort: 465,
  smtpEncryption: 'ssl',
  smtpUsername: '',
  smtpPassword: '',
  senderName: '',
  senderEmail: '',
  replyToEmail: '',
};

const DEFAULT_REMINDERS_FORM: ReminderSettingsInput = {
  inspectionReminderEnabled: false,
  inspectionReminderDaysBefore: 1,
  overduePaymentReminderEnabled: false,
  overduePaymentAfterDays: 7,
  overduePaymentRepeatDays: 7,
  whatsappHelperEnabled: false,
  whatsappReminderTemplate:
    'Hi {{firstName}}, reminder: your SiteScop inspection at {{propertyAddress}} is scheduled for {{inspectionDate}} at {{inspectionTime}}.',
};

function priceInputToCents(value: string, fallback: number): number {
  return audStringToExCents(value) ?? fallback;
}

function defaultPriceInputs(billing: BillingSettingsInput): {
  ex: Record<InspectionType, string>;
  inc: Record<InspectionType, string>;
} {
  const building = gstPricePairFromExCents(billing.buildingPriceCents);
  const pest = gstPricePairFromExCents(billing.pestPriceCents);
  const combined = gstPricePairFromExCents(billing.combinedPriceCents);
  return {
    ex: { BUILDING: building.ex, PEST: pest.ex, COMBINED: combined.ex },
    inc: { BUILDING: building.inc, PEST: pest.inc, COMBINED: combined.inc },
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

  const xeroQuery = useQuery({
    queryKey: ['settings-xero'],
    queryFn: () => getSettingsApi().getXero(),
  });

  const archivesQuery = useQuery({
    queryKey: ['data-archives'],
    queryFn: () => getSitescopApi().dataArchive.list(),
    enabled: tab === 'security',
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
    invoiceThankYouMessage: '',
  });

  const [email, setEmail] = useState<EmailSettingsInput>(DEFAULT_EMAIL_FORM);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpTestResult, setSmtpTestResult] = useState<SmtpTestResult | null>(null);
  const [reminders, setReminders] = useState<ReminderSettingsInput>(DEFAULT_REMINDERS_FORM);
  const [offerSubject, setOfferSubject] = useState('Special offer from SiteScop');
  const [offerBody, setOfferBody] = useState(
    'Hello {{firstName}},\n\nWe have a special inspection offer available this month. Reply to this email or call us to book.\n\nKind regards,\nSiteScop',
  );
  const [offerFeedback, setOfferFeedback] = useState('');
  const [deleteStep, setDeleteStep] = useState<'closed' | 'password' | 'code' | 'window'>('closed');
  const [deleteLoginPassword, setDeleteLoginPassword] = useState('');
  const [deleteEmailCode, setDeleteEmailCode] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLocalMsg, setDeleteLocalMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const [priceInputs, setPriceInputs] = useState<Record<InspectionType, string>>({
    BUILDING: '550',
    PEST: '350',
    COMBINED: '850',
  });
  const [priceIncInputs, setPriceIncInputs] = useState<Record<InspectionType, string>>({
    BUILDING: '605',
    PEST: '385',
    COMBINED: '935',
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
  const [ensureRelayMessage, setEnsureRelayMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [xeroForm, setXeroForm] = useState<XeroSettingsInput>({
    enabled: false,
    clientId: '',
    salesAccountCode: '200',
  });
  const [xeroClientSecret, setXeroClientSecret] = useState('');
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
      if (appQuery.data.email) {
      const { hasSmtpPassword: storedHasPassword, ...emailRest } = appQuery.data.email;
      setHasSmtpPassword(Boolean(storedHasPassword));
      setEmail({
        ...DEFAULT_EMAIL_FORM,
        ...emailRest,
        smtpPassword: '',
      });
      setSmtpTestEmail((current) => current || emailRest.senderEmail || emailRest.fromEmail || '');
    }
    if (appQuery.data.reminders) {
      setReminders({ ...DEFAULT_REMINDERS_FORM, ...appQuery.data.reminders });
    }
    const prices = defaultPriceInputs(appQuery.data.billing);
    setPriceInputs(prices.ex);
    setPriceIncInputs(prices.inc);
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

  useEffect(() => {
    if (!xeroQuery.data) return;
    setXeroForm({
      enabled: xeroQuery.data.enabled,
      clientId: xeroQuery.data.clientId,
      salesAccountCode: xeroQuery.data.salesAccountCode,
    });
  }, [xeroQuery.data]);

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
        invoiceThankYouMessage: billing.invoiceThankYouMessage,
      }),
    onSuccess: (saved) => {
      clearStatus();
      setBilling(saved);
      const prices = defaultPriceInputs(saved);
      setPriceInputs(prices.ex);
      setPriceIncInputs(prices.inc);
      setMessage('Billing and invoice settings saved. New agreements and invoices will use these details.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save billing settings'),
  });

  const saveEmailMutation = useMutation({
    mutationFn: () => getSettingsApi().saveEmail(email),
    onSuccess: (saved) => {
      clearStatus();
      setHasSmtpPassword(saved.hasSmtpPassword);
      const { hasSmtpPassword: _stored, ...emailRest } = saved;
      setEmail({
        ...DEFAULT_EMAIL_FORM,
        ...emailRest,
        smtpPassword: '',
      });
      setMessage(
        saved.smtpEnabled
          ? 'Email settings saved. SMTP send is enabled for agreements, invoices, reports, and password reset.'
          : 'Email settings saved. Compose actions will use these templates and mail app.',
      );
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save email settings'),
  });

  const testSmtpMutation = useMutation({
    mutationFn: async () => {
      // Persist form values first — SMTP test reads saved settings, not the open form.
      const saved = await getSettingsApi().saveEmail(email);
      setHasSmtpPassword(saved.hasSmtpPassword);
      const { hasSmtpPassword: _stored, ...emailRest } = saved;
      setEmail({
        ...DEFAULT_EMAIL_FORM,
        ...emailRest,
        smtpPassword: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
      return getSmtpSettingsApi().testSmtp(smtpTestEmail);
    },
    onSuccess: (result) => {
      clearStatus();
      setSmtpTestResult(result);
      if (result.ok) {
        setMessage(`Settings saved. ${result.message}`);
      } else {
        setError(`Settings were saved, but the test failed: ${result.message}`);
      }
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'SMTP test failed';
      setSmtpTestResult({ ok: false, code: 'send_failed', message });
      setError(message);
    },
  });

  const saveRemindersMutation = useMutation({
    mutationFn: () => getSettingsApi().saveReminders(reminders),
    onSuccess: (saved) => {
      clearStatus();
      setReminders(saved);
      setMessage('Automatic reminder settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings-app'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save reminder settings'),
  });

  const broadcastOfferMutation = useMutation({
    mutationFn: () =>
      getSitescopApi().accounting.broadcastOffer({
        subject: offerSubject,
        body: offerBody,
      }),
    onSuccess: (result) => {
      if (result.cancelled) {
        setOfferFeedback('');
        return;
      }
      setOfferFeedback(result.message);
      setError('');
    },
    onError: (err) => {
      setOfferFeedback('');
      setError(err instanceof Error ? err.message : 'Could not send offers');
    },
  });

  const runRemindersMutation = useMutation({
    mutationFn: () => getSettingsApi().runRemindersNow(),
    onSuccess: (result) => {
      clearStatus();
      if (result.errors.length > 0) setError(result.errors.slice(0, 2).join(' · '));
      setMessage(result.message);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not run reminders'),
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

  const archiveAllMutation = useMutation({
    mutationFn: () => getSitescopApi().dataArchive.archiveAll(),
    onSuccess: (result) => {
      clearStatus();
      setMessage(result.message);
      setDeleteLocalMsg({ tone: 'ok', text: result.message });
      setDeleteStep('closed');
      setDeleteLoginPassword('');
      setDeleteEmailCode('');
      setDeleteConfirmText('');
      void queryClient.invalidateQueries({ queryKey: ['data-archives'] });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-completed'] });
      void queryClient.invalidateQueries({ queryKey: ['agreements'] });
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-awaiting'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-paid'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
    },
    onError: (e) => {
      const text = e instanceof Error ? e.message : 'Could not archive data';
      setError(text);
      setDeleteLocalMsg({ tone: 'err', text });
    },
  });

  const requestDeleteUnlockMutation = useMutation({
    mutationFn: () => getSitescopApi().dataArchive.requestDeleteUnlock(deleteLoginPassword),
    onSuccess: (result) => {
      if (!result.ok) {
        setDeleteLocalMsg({ tone: 'err', text: result.message });
        return;
      }
      setDeleteLocalMsg({ tone: 'ok', text: result.message });
      setDeleteStep('code');
      setDeleteEmailCode('');
    },
    onError: (e) => {
      setDeleteLocalMsg({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Could not send delete code',
      });
    },
  });

  const verifyDeleteUnlockMutation = useMutation({
    mutationFn: () => getSitescopApi().dataArchive.verifyDeleteUnlock(deleteEmailCode),
    onSuccess: (result) => {
      if (!result.ok) {
        setDeleteLocalMsg({ tone: 'err', text: result.message });
        return;
      }
      setDeleteLocalMsg({ tone: 'ok', text: result.message });
      setDeleteStep('window');
      setDeleteConfirmText('');
    },
    onError: (e) => {
      setDeleteLocalMsg({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Could not verify delete code',
      });
    },
  });

  const closeDeleteFlow = () => {
    void getSitescopApi().dataArchive.clearDeleteUnlock?.();
    setDeleteStep('closed');
    setDeleteLoginPassword('');
    setDeleteEmailCode('');
    setDeleteConfirmText('');
  };

  const restoreArchiveMutation = useMutation({
    mutationFn: (archiveId: string) => getSitescopApi().dataArchive.restore(archiveId),
    onSuccess: (result) => {
      clearStatus();
      setMessage(result.message);
      void queryClient.invalidateQueries({ queryKey: ['data-archives'] });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-completed'] });
      void queryClient.invalidateQueries({ queryKey: ['agreements'] });
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-awaiting'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-paid'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not restore archive'),
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

  const ensureRelayMutation = useMutation({
    mutationFn: () => getSettingsApi().ensurePublicRelay(),
    onSuccess: (result) => {
      setEnsureRelayMessage({ ok: result.ok, text: result.message });
      void queryClient.invalidateQueries({ queryKey: ['settings-github'] });
    },
    onError: (e) => {
      setEnsureRelayMessage({
        ok: false,
        text: e instanceof Error ? e.message : 'Could not start internet relay',
      });
    },
  });

  const saveXeroMutation = useMutation({
    mutationFn: () =>
      getSettingsApi().saveXero({
        ...xeroForm,
        clientSecret: xeroClientSecret.trim() || undefined,
      }),
    onSuccess: () => {
      setXeroClientSecret('');
      clearStatus();
      setMessage('Xero settings saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings-xero'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save Xero settings'),
  });

  const connectXeroMutation = useMutation({
    mutationFn: async () => {
      const settingsApi = getSettingsApi();
      await settingsApi.saveXero({
        ...xeroForm,
        clientSecret: xeroClientSecret.trim() || undefined,
      });
      return settingsApi.connectXero();
    },
    onSuccess: (result) => {
      setXeroClientSecret('');
      clearStatus();
      setMessage(`Connected to Xero — ${result.tenantName}`);
      void queryClient.invalidateQueries({ queryKey: ['settings-xero'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not connect to Xero'),
  });

  const disconnectXeroMutation = useMutation({
    mutationFn: () => getSettingsApi().disconnectXero(),
    onSuccess: () => {
      clearStatus();
      setMessage('Disconnected from Xero.');
      void queryClient.invalidateQueries({ queryKey: ['settings-xero'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not disconnect from Xero'),
  });

  return (
    <>
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
              Default prices for new agreements. Enter either ex GST or inc GST — the other is calculated at 10%.
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-text">Building inspection</p>
              <GstPriceFieldPair
                exValue={priceInputs.BUILDING}
                incValue={priceIncInputs.BUILDING}
                onExChange={(ex, inc) => {
                  setPriceInputs((current) => ({ ...current, BUILDING: ex }));
                  setPriceIncInputs((current) => ({ ...current, BUILDING: inc }));
                }}
                onIncChange={(ex, inc) => {
                  setPriceInputs((current) => ({ ...current, BUILDING: ex }));
                  setPriceIncInputs((current) => ({ ...current, BUILDING: inc }));
                }}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-text">Pest inspection</p>
              <GstPriceFieldPair
                exValue={priceInputs.PEST}
                incValue={priceIncInputs.PEST}
                onExChange={(ex, inc) => {
                  setPriceInputs((current) => ({ ...current, PEST: ex }));
                  setPriceIncInputs((current) => ({ ...current, PEST: inc }));
                }}
                onIncChange={(ex, inc) => {
                  setPriceInputs((current) => ({ ...current, PEST: ex }));
                  setPriceIncInputs((current) => ({ ...current, PEST: inc }));
                }}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-text">Combined inspection</p>
              <GstPriceFieldPair
                exValue={priceInputs.COMBINED}
                incValue={priceIncInputs.COMBINED}
                onExChange={(ex, inc) => {
                  setPriceInputs((current) => ({ ...current, COMBINED: ex }));
                  setPriceIncInputs((current) => ({ ...current, COMBINED: inc }));
                }}
                onIncChange={(ex, inc) => {
                  setPriceInputs((current) => ({ ...current, COMBINED: ex }));
                  setPriceIncInputs((current) => ({ ...current, COMBINED: inc }));
                }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <h3 className="font-bold text-amber-950">Invoice payment details</h3>
            <p className="mt-1 text-sm text-amber-900/80">
              Shown on tax invoice PDFs for bank transfer and payment instructions.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-1">
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
                value={billing.bankAccountNumber}
                onChange={(e) => setBilling((c) => ({ ...c, bankAccountNumber: e.target.value }))}
                placeholder="12345678"
              />
              <Textarea
                label="Payment terms"
                rows={2}
                value={billing.invoicePaymentTerms}
                onChange={(e) => setBilling((c) => ({ ...c, invoicePaymentTerms: e.target.value }))}
                placeholder="Payment is due within 7 days of the invoice date."
              />
              <Textarea
                label="Payment notes & requirements"
                rows={3}
                value={billing.invoicePaymentNotes}
                onChange={(e) => setBilling((c) => ({ ...c, invoicePaymentNotes: e.target.value }))}
                placeholder="Please use the invoice number as your payment reference."
              />
              <Textarea
                label="Thank-you message (invoice closing)"
                rows={2}
                value={billing.invoiceThankYouMessage}
                onChange={(e) =>
                  setBilling((c) => ({ ...c, invoiceThankYouMessage: e.target.value }))
                }
                placeholder="Thank you for choosing SiteScop. We appreciate your business."
              />
            </div>
          </div>

          <Button onClick={() => saveBillingMutation.mutate()} disabled={saveBillingMutation.isPending}>
            {saveBillingMutation.isPending ? 'Saving…' : 'Save billing & invoice settings'}
          </Button>
        </Card>
      )}

      {tab === 'email' && (
        <Card className="space-y-5 p-6">
          <div>
            <h3 className="font-bold text-text">Email settings</h3>
            <p className="mt-1 text-sm text-text-light">
              Templates for agreements, invoices, reports, and general messages. Enable SMTP below to
              send from SiteScop; otherwise the chosen mail app opens for you to send.
            </p>
          </div>

          {!hasSmtpApi() ? (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
              SMTP is not loaded in this window (old app session). Close every SiteScop window and the
              black launcher window, then double-click START-SITESCOP.bat again. After restart, Save
              and test email will work.
            </div>
          ) : null}

          <div className="space-y-4 rounded-xl border border-border p-4">
            <div>
              <h4 className="font-semibold text-text">SMTP send (recommended)</h4>
              <p className="mt-1 text-sm text-text-light">
                Send emails directly from SiteScop using Zoho, Gmail, or another provider. Required
                for Forgot password. Use an app password, not your normal login password.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={email.smtpEnabled}
                onChange={(e) => setEmail((c) => ({ ...c, smtpEnabled: e.target.checked }))}
              />
              <span className="text-sm text-text">
                <span className="font-semibold">Enable SMTP sending</span>
                <span className="mt-0.5 block text-text-light">
                  When on, Email / Send actions send immediately with PDF attachments. When off,
                  SiteScop opens your mail app to compose.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="SMTP host"
                value={email.smtpHost}
                onChange={(e) => setEmail((c) => ({ ...c, smtpHost: e.target.value }))}
                placeholder="smtp.zoho.com.au"
              />
              <Input
                label="Port"
                type="number"
                value={String(email.smtpPort)}
                onChange={(e) =>
                  setEmail((c) => ({ ...c, smtpPort: Number(e.target.value) || c.smtpPort }))
                }
              />
              <Select
                label="Encryption"
                value={email.smtpEncryption}
                onChange={(e) => {
                  const next = e.target.value as SmtpEncryption;
                  setEmail((c) => ({
                    ...c,
                    smtpEncryption: next,
                    smtpPort: next === 'ssl' ? 465 : next === 'tls' ? 587 : c.smtpPort,
                  }));
                }}
                options={SMTP_ENCRYPTION_OPTIONS}
              />
              <Input
                label="SMTP username"
                value={email.smtpUsername}
                onChange={(e) => setEmail((c) => ({ ...c, smtpUsername: e.target.value }))}
                placeholder="you@sitescop.com.au"
              />
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-text">SMTP password</label>
                <div className="flex gap-2">
                  <input
                    type={showSmtpPassword ? 'text' : 'password'}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                    value={email.smtpPassword ?? ''}
                    onChange={(e) => setEmail((c) => ({ ...c, smtpPassword: e.target.value }))}
                    placeholder={
                      hasSmtpPassword ? 'Leave blank to keep saved password' : 'App password'
                    }
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowSmtpPassword((v) => !v)}
                  >
                    {showSmtpPassword ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {hasSmtpPassword && !(email.smtpPassword ?? '').trim() ? (
                  <p className="mt-1 text-xs text-text-light">A password is already saved.</p>
                ) : null}
              </div>
              <Input
                label="Sender name"
                value={email.senderName}
                onChange={(e) => setEmail((c) => ({ ...c, senderName: e.target.value }))}
              />
              <Input
                label="Sender email"
                type="email"
                value={email.senderEmail}
                onChange={(e) => setEmail((c) => ({ ...c, senderEmail: e.target.value }))}
                placeholder="info@sitescop.com.au"
              />
              <Input
                label="Reply-to (optional)"
                type="email"
                value={email.replyToEmail}
                onChange={(e) => setEmail((c) => ({ ...c, replyToEmail: e.target.value }))}
                className="sm:col-span-2"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  clearStatus();
                  saveEmailMutation.mutate();
                }}
                disabled={saveEmailMutation.isPending}
              >
                {saveEmailMutation.isPending ? 'Saving…' : 'Save SMTP & email settings'}
              </Button>
            </div>

            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                label="Test email address"
                type="email"
                value={smtpTestEmail}
                onChange={(e) => setSmtpTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={testSmtpMutation.isPending || saveEmailMutation.isPending}
                onClick={() => {
                  clearStatus();
                  setSmtpTestResult(null);
                  testSmtpMutation.mutate();
                }}
              >
                {testSmtpMutation.isPending ? 'Saving & testing…' : 'Save & send test email'}
              </Button>
            </div>
            <p className="text-xs text-text-light">
              Test always saves first, then sends a short email so you know the settings stuck.
            </p>
            {smtpTestResult ? (
              <p className={`text-sm ${smtpTestResult.ok ? 'text-success' : 'text-danger'}`}>
                {smtpTestResult.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Mail app (when SMTP is off)"
              value={email.mailClient}
              onChange={(e) =>
                setEmail((c) => ({ ...c, mailClient: e.target.value as EmailMailClient }))
              }
              options={MAIL_CLIENT_OPTIONS}
            />
            <Input
              label="From / reply email (compose mode)"
              type="email"
              value={email.fromEmail}
              onChange={(e) => setEmail((c) => ({ ...c, fromEmail: e.target.value }))}
              placeholder="info@sitescop.com.au"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={email.includePdfAttachTip}
              onChange={(e) =>
                setEmail((c) => ({ ...c, includePdfAttachTip: e.target.checked }))
              }
            />
            <span className="text-sm text-text">
              <span className="font-semibold">Include PDF attach tip</span>
              <span className="mt-0.5 block text-text-light">
                Only for compose mode (SMTP off). Adds the file path at the bottom of report/invoice
                emails so you can paste it into Attach.
              </span>
            </span>
          </label>

          <p className="rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs text-text-light">
            Placeholders you can use: {'{{firstName}}'}, {'{{clientName}}'}, {'{{propertyAddress}}'},{' '}
            {'{{jobNumber}}'}, {'{{agreementNumber}}'}, {'{{signingUrl}}'}, {'{{inspectionNumber}}'},{' '}
            {'{{reportLabel}}'}, {'{{invoiceNumber}}'}, {'{{companyName}}'}, {'{{companyPhone}}'},{' '}
            {'{{fromEmail}}'}
          </p>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <h4 className="font-semibold text-text">Agreement signing email</h4>
            <Input
              label="Subject"
              value={email.signingSubject}
              onChange={(e) => setEmail((c) => ({ ...c, signingSubject: e.target.value }))}
            />
            <Textarea
              label="Body"
              rows={8}
              value={email.signingBody}
              onChange={(e) => setEmail((c) => ({ ...c, signingBody: e.target.value }))}
            />
          </div>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <h4 className="font-semibold text-text">Report ready email</h4>
            <Input
              label="Subject"
              value={email.reportSubject}
              onChange={(e) => setEmail((c) => ({ ...c, reportSubject: e.target.value }))}
            />
            <Textarea
              label="Body"
              rows={8}
              value={email.reportBody}
              onChange={(e) => setEmail((c) => ({ ...c, reportBody: e.target.value }))}
            />
          </div>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <h4 className="font-semibold text-text">Invoice email</h4>
            <Input
              label="Subject"
              value={email.invoiceSubject}
              onChange={(e) => setEmail((c) => ({ ...c, invoiceSubject: e.target.value }))}
            />
            <Textarea
              label="Body"
              rows={8}
              value={email.invoiceBody}
              onChange={(e) => setEmail((c) => ({ ...c, invoiceBody: e.target.value }))}
            />
          </div>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <h4 className="font-semibold text-text">General client email</h4>
            <Input
              label="Subject"
              value={email.generalSubject}
              onChange={(e) => setEmail((c) => ({ ...c, generalSubject: e.target.value }))}
            />
            <Textarea
              label="Body"
              rows={6}
              value={email.generalBody}
              onChange={(e) => setEmail((c) => ({ ...c, generalBody: e.target.value }))}
            />
          </div>

          <Button onClick={() => saveEmailMutation.mutate()} disabled={saveEmailMutation.isPending}>
            {saveEmailMutation.isPending ? 'Saving…' : 'Save email settings'}
          </Button>
        </Card>
      )}

      {tab === 'marketing' && (
        <Card className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15">
              <Megaphone className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-text">Client offers &amp; advertising</h3>
              <p className="mt-1 text-sm text-text-light">
                One click sends your offer to every client with an email on file (SMTP required in
                Email). Use {'{{firstName}}'} in the message.
              </p>
            </div>
          </div>
          <Input
            label="Subject"
            value={offerSubject}
            onChange={(e) => setOfferSubject(e.target.value)}
          />
          <Textarea
            label="Message"
            rows={6}
            value={offerBody}
            onChange={(e) => setOfferBody(e.target.value)}
          />
          <Button
            onClick={() => {
              setOfferFeedback('');
              setError('');
              broadcastOfferMutation.mutate();
            }}
            disabled={broadcastOfferMutation.isPending}
          >
            <Megaphone className="h-4 w-4" />
            {broadcastOfferMutation.isPending ? 'Sending…' : 'Send offer to all clients'}
          </Button>
          {offerFeedback ? (
            <p
              className={`text-sm ${
                offerFeedback.toLowerCase().includes('fail') ||
                offerFeedback.toLowerCase().includes('could not')
                  ? 'text-danger'
                  : 'text-success'
              }`}
            >
              {offerFeedback}
            </p>
          ) : null}
        </Card>
      )}

      {tab === 'reminders' && (
        <Card className="space-y-4 p-6">
          <div>
            <h3 className="font-bold text-text">Automatic reminders</h3>
            <p className="mt-1 text-sm text-text-light">
              Sends by SMTP while SiteScop is open, and catches up when you start the app if the PC
              was off. Turn SMTP on under Email first.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={reminders.inspectionReminderEnabled}
              onChange={(e) =>
                setReminders((c) => ({ ...c, inspectionReminderEnabled: e.target.checked }))
              }
            />
            <span className="text-sm text-text">
              <span className="font-semibold">Inspection reminder email</span>
              <span className="mt-0.5 block text-text-light">
                Auto email with address, date, and time before the inspection.
              </span>
            </span>
          </label>
          <Input
            label="Days before inspection"
            type="number"
            value={String(reminders.inspectionReminderDaysBefore)}
            onChange={(e) =>
              setReminders((c) => ({
                ...c,
                inspectionReminderDaysBefore: Number(e.target.value) || 0,
              }))
            }
            placeholder="1 = day before"
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={reminders.overduePaymentReminderEnabled}
              onChange={(e) =>
                setReminders((c) => ({ ...c, overduePaymentReminderEnabled: e.target.checked }))
              }
            />
            <span className="text-sm text-text">
              <span className="font-semibold">Overdue payment reminder email</span>
              <span className="mt-0.5 block text-text-light">
                Auto email with invoice attached for unpaid signed jobs.
              </span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First overdue after (days)"
              type="number"
              value={String(reminders.overduePaymentAfterDays)}
              onChange={(e) =>
                setReminders((c) => ({
                  ...c,
                  overduePaymentAfterDays: Number(e.target.value) || 1,
                }))
              }
            />
            <Input
              label="Repeat overdue every (days)"
              type="number"
              value={String(reminders.overduePaymentRepeatDays)}
              onChange={(e) =>
                setReminders((c) => ({
                  ...c,
                  overduePaymentRepeatDays: Number(e.target.value) || 1,
                }))
              }
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={reminders.whatsappHelperEnabled}
              onChange={(e) =>
                setReminders((c) => ({ ...c, whatsappHelperEnabled: e.target.checked }))
              }
            />
            <span className="text-sm text-text">
              <span className="font-semibold">WhatsApp helper (template only)</span>
              <span className="mt-0.5 block text-text-light">
                Silent auto-WhatsApp needs WhatsApp Business API. This stores a template — email is
                the automatic channel.
              </span>
            </span>
          </label>
          {reminders.whatsappHelperEnabled ? (
            <Textarea
              label="WhatsApp message template"
              rows={4}
              value={reminders.whatsappReminderTemplate}
              onChange={(e) =>
                setReminders((c) => ({ ...c, whatsappReminderTemplate: e.target.value }))
              }
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                clearStatus();
                saveRemindersMutation.mutate();
              }}
              disabled={saveRemindersMutation.isPending}
            >
              {saveRemindersMutation.isPending ? 'Saving…' : 'Save reminder settings'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={runRemindersMutation.isPending}
              onClick={() => {
                clearStatus();
                runRemindersMutation.mutate();
              }}
            >
              {runRemindersMutation.isPending ? 'Checking…' : 'Run reminders now'}
            </Button>
          </div>
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
          <Input label="Current password" type="password" revealable value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, currentPassword: e.target.value }))} />
          <Input label="New password" type="password" revealable value={passwordForm.newPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, newPassword: e.target.value }))} />
          <Input label="Confirm new password" type="password" revealable value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, confirmPassword: e.target.value }))} />
          <Button onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? 'Updating…' : 'Change password'}
          </Button>

          <div className="mt-8 space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="font-bold text-text">Clear test data</h3>
              <p className="mt-1 text-sm text-text-light">
                Empties the Recycle Bin permanently, then archives all clients, jobs, and agreements
                (restore from the list below). Requires your login password, then a one-time email
                code, then confirm in the delete window.
              </p>
            </div>
            {!hasDataArchiveApi() ? (
              <p className="text-sm text-danger">
                Archive tools need a full restart. Close all SiteScop windows, then run START-SITESCOP.bat.
              </p>
            ) : (
              <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={archiveAllMutation.isPending}
                onClick={() => {
                  setDeleteLocalMsg(null);
                  setDeleteLoginPassword('');
                  setDeleteEmailCode('');
                  setDeleteConfirmText('');
                  setDeleteStep('password');
                }}
              >
                Clear / delete test data…
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void getSitescopApi().dataArchive.openFolder();
                }}
              >
                Open archives folder
              </Button>
            </div>
            {deleteLocalMsg && deleteStep === 'closed' ? (
              <p
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  deleteLocalMsg.tone === 'ok'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-danger/40 bg-danger/10 text-danger'
                }`}
              >
                {deleteLocalMsg.text}
              </p>
            ) : null}

            {archivesQuery.isLoading ? (
              <p className="text-sm text-text-light">Loading archives…</p>
            ) : (archivesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-light">No archives yet.</p>
            ) : (
              <ul className="space-y-2">
                {(archivesQuery.data ?? []).map((archive) => (
                  <li
                    key={archive.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">{archive.label}</p>
                      <p className="text-xs text-text-light">
                        {archive.clientCount ?? 0} client(s) · {archive.jobCount} job(s) ·{' '}
                        {archive.agreementCount} agreement(s)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={restoreArchiveMutation.isPending}
                      onClick={() => {
                        clearStatus();
                        restoreArchiveMutation.mutate(archive.id);
                      }}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
              </>
            )}
          </div>
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
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
            <div>
              <h4 className="font-semibold text-text">Internet signing (clients off your Wi‑Fi)</h4>
              <p className="mt-1 text-sm text-text-light">
                Clients can <strong>Sign &amp; submit on GitHub</strong> even when SiteScop is closed.
                When you open SiteScop later, it syncs and shows the agreement as Signed. Keep your
                GitHub PAT saved — it is used for the hosted submit path on your signing repo.
              </p>
            </div>
            <Input
              label="Public Relay URL (optional override)"
              value={githubForm.publicRelayUrl ?? ''}
              onChange={(e) => setGithubForm((c) => ({ ...c, publicRelayUrl: e.target.value }))}
              placeholder="Leave blank for auto tunnel, or paste https://….trycloudflare.com"
            />
            {githubQuery.data?.publicRelayStatus?.activeUrl ? (
              <p className="text-sm text-success">
                Active relay: <span className="break-all font-mono text-xs">{githubQuery.data.publicRelayStatus.activeUrl}</span>
                {' '}({githubQuery.data.publicRelayStatus.mode})
              </p>
            ) : (
              <p className="text-sm text-warning">
                No internet relay active yet — remote Sign &amp; submit will fail until the tunnel starts.
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={ensureRelayMutation.isPending}
              onClick={() => ensureRelayMutation.mutate()}
            >
              {ensureRelayMutation.isPending ? 'Starting internet relay…' : 'Start / refresh internet relay'}
            </Button>
            {ensureRelayMessage ? (
              <p className={`text-sm ${ensureRelayMessage.ok ? 'text-success' : 'text-danger'}`}>
                {ensureRelayMessage.text}
              </p>
            ) : null}
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

      {tab === 'xero' && (
        <Card className="space-y-5 p-6">
          <div>
            <h3 className="font-bold text-text">Xero accounting sync</h3>
            <p className="mt-1 text-sm text-text-light">
              Send signed job invoices from Accounting to your Xero organisation.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={xeroForm.enabled}
              onChange={(e) => setXeroForm((current) => ({ ...current, enabled: e.target.checked }))}
            />
            Enable Xero sync
          </label>

          <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-text-light">
            <p className="font-medium text-text">Setup steps</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Create a Xero app at developer.xero.com</li>
              <li>Add redirect URI: <code className="rounded bg-surface px-1">{xeroQuery.data?.redirectUri ?? 'http://localhost:53682/xero/callback'}</code></li>
              <li>Paste Client ID and Secret below, save, then connect</li>
              <li>Use <strong>Send to Xero</strong> on Accounting jobs</li>
            </ol>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Xero Client ID"
              value={xeroForm.clientId}
              onChange={(e) => setXeroForm((current) => ({ ...current, clientId: e.target.value }))}
            />
            <Input
              label="Sales account code"
              value={xeroForm.salesAccountCode}
              onChange={(e) => setXeroForm((current) => ({ ...current, salesAccountCode: e.target.value }))}
              placeholder="200"
            />
          </div>
          <Input
            label="Xero Client Secret"
            type="password"
            value={xeroClientSecret}
            onChange={(e) => setXeroClientSecret(e.target.value)}
            placeholder={xeroQuery.data?.hasClientSecret ? 'Saved securely — enter only to replace' : 'From your Xero app'}
          />

          {xeroQuery.data?.connected ? (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
              <p className="font-semibold text-success">Connected to {xeroQuery.data.tenantName}</p>
              <p className="mt-1 text-text-light">Invoices can be sent from Accounting → Awaiting payment or Paid.</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveXeroMutation.mutate()} disabled={saveXeroMutation.isPending}>
              {saveXeroMutation.isPending ? 'Saving…' : 'Save Xero settings'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => connectXeroMutation.mutate()}
              disabled={connectXeroMutation.isPending || !xeroForm.enabled}
            >
              {connectXeroMutation.isPending ? 'Connecting…' : 'Connect to Xero'}
            </Button>
            {xeroQuery.data?.connected ? (
              <Button
                variant="secondary"
                onClick={() => disconnectXeroMutation.mutate()}
                disabled={disconnectXeroMutation.isPending}
              >
                {disconnectXeroMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : null}
          </div>

          <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-4">
            <h4 className="font-semibold text-text">MYOB</h4>
            <p className="mt-1 text-sm text-text-light">
              MYOB sync is planned for a future update. For now, use <strong>Export CSV</strong> on the Accounting
              screens and import into MYOB, or continue using SiteScop invoices.
            </p>
          </div>
        </Card>
      )}
    </div>

      <Modal
        open={deleteStep !== 'closed'}
        onClose={closeDeleteFlow}
        title={
          deleteStep === 'password'
            ? 'Confirm login password'
            : deleteStep === 'code'
              ? 'Enter delete code'
              : 'Delete window'
        }
        description={
          deleteStep === 'password'
            ? 'Enter your SiteScop login password. We will email a one-time delete code to your account email.'
            : deleteStep === 'code'
              ? 'Paste the delete password/code from your email to open the delete window.'
              : 'Type DELETE to confirm, then archive. Or Exit without deleting.'
        }
        footer={
          deleteStep === 'window' ? (
            <>
              <Button variant="secondary" onClick={closeDeleteFlow}>
                Exit
              </Button>
              <Button
                variant="danger"
                disabled={
                  archiveAllMutation.isPending || deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                }
                onClick={() => {
                  clearStatus();
                  setDeleteLocalMsg(null);
                  archiveAllMutation.mutate();
                }}
              >
                {archiveAllMutation.isPending ? 'Archiving…' : 'Archive all clients, jobs & agreements'}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={closeDeleteFlow}>
              Exit
            </Button>
          )
        }
      >
        {deleteLocalMsg && deleteStep !== 'closed' ? (
          <p
            className={`mb-4 rounded-lg border px-3 py-2 text-sm font-medium ${
              deleteLocalMsg.tone === 'ok'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {deleteLocalMsg.text}
          </p>
        ) : null}

        {deleteStep === 'password' ? (
          <div className="space-y-4">
            <Input
              label="Login password"
              type="password"
              revealable
              value={deleteLoginPassword}
              onChange={(e) => setDeleteLoginPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button
              disabled={!deleteLoginPassword.trim() || requestDeleteUnlockMutation.isPending}
              onClick={() => {
                setDeleteLocalMsg(null);
                requestDeleteUnlockMutation.mutate();
              }}
            >
              {requestDeleteUnlockMutation.isPending
                ? 'Sending email…'
                : 'Send delete code to my email'}
            </Button>
          </div>
        ) : null}

        {deleteStep === 'code' ? (
          <div className="space-y-4">
            <Input
              label="Delete code from email"
              value={deleteEmailCode}
              onChange={(e) => setDeleteEmailCode(e.target.value)}
              placeholder="8-character code"
              autoComplete="one-time-code"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!deleteEmailCode.trim() || verifyDeleteUnlockMutation.isPending}
                onClick={() => {
                  setDeleteLocalMsg(null);
                  verifyDeleteUnlockMutation.mutate();
                }}
              >
                {verifyDeleteUnlockMutation.isPending ? 'Checking…' : 'Open delete window'}
              </Button>
              <Button
                variant="secondary"
                disabled={requestDeleteUnlockMutation.isPending || !deleteLoginPassword.trim()}
                onClick={() => {
                  setDeleteLocalMsg(null);
                  requestDeleteUnlockMutation.mutate();
                }}
              >
                Resend code
              </Button>
            </div>
          </div>
        ) : null}

        {deleteStep === 'window' ? (
          <div className="space-y-4">
            <p className="text-sm text-text-light">
              This empties the Recycle Bin permanently, then archives all current clients, jobs, and
              agreements. Restore from Settings brings the archived set back.
            </p>
            <Input
              label='Type DELETE to confirm'
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
