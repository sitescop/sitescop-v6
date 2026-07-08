import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { extname, join } from 'node:path';
import { app, safeStorage } from 'electron';
import {
  DEFAULT_REPORT_SETTINGS,
  SITESCOP_COMPANY_ABN,
  SITESCOP_COMPANY_EMAIL,
  SITESCOP_COMPANY_NAME,
  SITESCOP_COMPANY_PHONE,
  SITESCOP_COMPANY_WEBSITE,
  SITESCOP_PDF_FOOTER_TEXT,
} from '../../shared/company-branding.js';
import type {
  CompanySettings,
  CompanySettingsInput,
  GitHubSettingsInput,
  GitHubSettingsPublic,
  BillingSettings,
  BillingSettingsInput,
  InspectionType,
  ReportSettings,
  ReportSettingsInput,
} from '../../shared/api-types.js';

export interface GitHubSettings {
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  personalAccessToken: string;
  pagesBaseUrl: string;
  publicRelayUrl: string;
}

interface StoredSettingsFile {
  github?: {
    enabled?: boolean;
    owner?: string;
    repo?: string;
    branch?: string;
    pagesBaseUrl?: string;
    publicRelayUrl?: string;
    personalAccessToken?: string;
    encryptedPersonalAccessToken?: string;
  };
  company?: Partial<CompanySettings>;
  report?: Partial<ReportSettings>;
  billing?: Partial<BillingSettings>;
  branding?: {
    logoFileName?: string;
  };
}

const DEFAULT_GITHUB: GitHubSettings = {
  enabled: false,
  owner: '',
  repo: '',
  branch: 'main',
  personalAccessToken: '',
  pagesBaseUrl: '',
  publicRelayUrl: '',
};

const DEFAULT_COMPANY: CompanySettings = {
  name: SITESCOP_COMPANY_NAME,
  abn: SITESCOP_COMPANY_ABN,
  phone: SITESCOP_COMPANY_PHONE,
  email: SITESCOP_COMPANY_EMAIL,
  website: SITESCOP_COMPANY_WEBSITE,
  address: '',
};

export const DEFAULT_BILLING: BillingSettings = {
  buildingPriceCents: 55000,
  pestPriceCents: 35000,
  combinedPriceCents: 85000,
  bankAccountName: '',
  bankBsb: '',
  bankAccountNumber: '',
  invoicePaymentTerms: 'Payment is due within 7 days of the invoice date.',
  invoicePaymentNotes: 'Please use the invoice number as your payment reference.',
};

function normalizePriceCents(value: unknown, fallback: number): number {
  const cents = Number(value);
  if (!Number.isFinite(cents) || cents <= 0) return fallback;
  return Math.round(cents);
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function brandingDir(): string {
  return join(app.getPath('userData'), 'branding');
}

function filePathToDataUrl(path: string): string {
  const ext = extname(path).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';
  const base64 = readFileSync(path).toString('base64');
  return `data:${mime};base64,${base64}`;
}

function getBundledLogoPath(): string | null {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'sitescop-logo.jpg')]
    : [join(app.getAppPath(), 'build/sitescop-logo.jpg')];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

let bundledLogoDataUrlCache: string | null | undefined;

function getBundledSiteScopLogoDataUrl(): string | null {
  if (bundledLogoDataUrlCache !== undefined) return bundledLogoDataUrlCache;
  const path = getBundledLogoPath();
  bundledLogoDataUrlCache = path ? filePathToDataUrl(path) : null;
  return bundledLogoDataUrlCache;
}

function getResolvedLogoDataUrl(): string | null {
  return getCompanyLogoDataUrl() ?? getBundledSiteScopLogoDataUrl();
}

export function getReportLogoPreviewDataUrl(): string | null {
  return getResolvedLogoDataUrl();
}

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptSecret(value: string): string {
  if (!value) return '';
  if (canEncrypt()) {
    return safeStorage.encryptString(value).toString('base64');
  }
  return value;
}

function decryptSecret(value: string): string {
  if (!value) return '';
  if (!canEncrypt()) return value;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

function loadRaw(): StoredSettingsFile {
  const path = settingsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as StoredSettingsFile;
  } catch {
    return {};
  }
}

function saveRaw(raw: StoredSettingsFile): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(raw, null, 2), 'utf8');
}

function readTokenFromStored(github: StoredSettingsFile['github']): string {
  if (!github) return '';
  if (github.encryptedPersonalAccessToken) {
    return decryptSecret(github.encryptedPersonalAccessToken);
  }
  return github.personalAccessToken?.trim() ?? '';
}

function migratePlaintextTokenIfNeeded(raw: StoredSettingsFile): void {
  const github = raw.github;
  if (!github?.personalAccessToken || github.encryptedPersonalAccessToken) return;
  const next = loadRaw();
  next.github = {
    ...next.github,
    enabled: github.enabled ?? false,
    owner: github.owner?.trim() ?? '',
    repo: github.repo?.trim() ?? '',
    branch: github.branch?.trim() || 'main',
    pagesBaseUrl: github.pagesBaseUrl?.trim().replace(/\/$/, '') ?? '',
    encryptedPersonalAccessToken: encryptSecret(github.personalAccessToken.trim()),
    publicRelayUrl: github.publicRelayUrl?.trim().replace(/\/$/, '') ?? '',
  };
  delete next.github?.personalAccessToken;
  saveRaw(next);
}

export function getCompanySettings(): CompanySettings {
  const raw = loadRaw().company ?? {};
  return {
    name: raw.name?.trim() || DEFAULT_COMPANY.name,
    abn: raw.abn?.trim() || DEFAULT_COMPANY.abn,
    phone: raw.phone?.trim() || DEFAULT_COMPANY.phone,
    email: raw.email?.trim() || DEFAULT_COMPANY.email,
    website: raw.website?.trim() || DEFAULT_COMPANY.website,
    address: raw.address?.trim() || DEFAULT_COMPANY.address,
  };
}

export function saveCompanySettings(input: CompanySettingsInput): CompanySettings {
  const next: CompanySettings = {
    name: input.name.trim() || DEFAULT_COMPANY.name,
    abn: input.abn.trim() || DEFAULT_COMPANY.abn,
    phone: input.phone.trim() || DEFAULT_COMPANY.phone,
    email: input.email.trim() || DEFAULT_COMPANY.email,
    website: input.website.trim() || DEFAULT_COMPANY.website,
    address: input.address?.trim() || '',
  };
  const raw = loadRaw();
  raw.company = next;
  saveRaw(raw);
  return next;
}

export function getReportSettings(): ReportSettings {
  const raw = loadRaw().report ?? {};
  return {
    primaryColor: raw.primaryColor?.trim() || DEFAULT_REPORT_SETTINGS.primaryColor,
    secondaryColor: raw.secondaryColor?.trim() || DEFAULT_REPORT_SETTINGS.secondaryColor,
    pdfFooterText: raw.pdfFooterText?.trim() || DEFAULT_REPORT_SETTINGS.pdfFooterText,
    pdfIncludeLogo: raw.pdfIncludeLogo ?? DEFAULT_REPORT_SETTINGS.pdfIncludeLogo,
    reportHeader: raw.reportHeader?.trim() || null,
    reportFooter: raw.reportFooter?.trim() || null,
  };
}

export function saveReportSettings(input: ReportSettingsInput): ReportSettings {
  const next: ReportSettings = {
    primaryColor: input.primaryColor.trim() || DEFAULT_REPORT_SETTINGS.primaryColor,
    secondaryColor: input.secondaryColor.trim() || DEFAULT_REPORT_SETTINGS.secondaryColor,
    pdfFooterText: input.pdfFooterText.trim() || SITESCOP_PDF_FOOTER_TEXT,
    pdfIncludeLogo: Boolean(input.pdfIncludeLogo),
    reportHeader: input.reportHeader?.trim() || null,
    reportFooter: input.reportFooter?.trim() || null,
  };
  const raw = loadRaw();
  raw.report = next;
  saveRaw(raw);
  return next;
}

export function getBillingSettings(): BillingSettings {
  const raw = loadRaw().billing ?? {};
  return {
    buildingPriceCents: normalizePriceCents(raw.buildingPriceCents, DEFAULT_BILLING.buildingPriceCents),
    pestPriceCents: normalizePriceCents(raw.pestPriceCents, DEFAULT_BILLING.pestPriceCents),
    combinedPriceCents: normalizePriceCents(raw.combinedPriceCents, DEFAULT_BILLING.combinedPriceCents),
    bankAccountName: raw.bankAccountName?.trim() ?? DEFAULT_BILLING.bankAccountName,
    bankBsb: raw.bankBsb?.trim() ?? DEFAULT_BILLING.bankBsb,
    bankAccountNumber: raw.bankAccountNumber?.trim() ?? DEFAULT_BILLING.bankAccountNumber,
    invoicePaymentTerms: raw.invoicePaymentTerms?.trim() || DEFAULT_BILLING.invoicePaymentTerms,
    invoicePaymentNotes: raw.invoicePaymentNotes?.trim() || DEFAULT_BILLING.invoicePaymentNotes,
  };
}

export function saveBillingSettings(input: BillingSettingsInput): BillingSettings {
  const next: BillingSettings = {
    buildingPriceCents: normalizePriceCents(input.buildingPriceCents, DEFAULT_BILLING.buildingPriceCents),
    pestPriceCents: normalizePriceCents(input.pestPriceCents, DEFAULT_BILLING.pestPriceCents),
    combinedPriceCents: normalizePriceCents(input.combinedPriceCents, DEFAULT_BILLING.combinedPriceCents),
    bankAccountName: input.bankAccountName.trim(),
    bankBsb: input.bankBsb.trim(),
    bankAccountNumber: input.bankAccountNumber.trim(),
    invoicePaymentTerms: input.invoicePaymentTerms.trim() || DEFAULT_BILLING.invoicePaymentTerms,
    invoicePaymentNotes: input.invoicePaymentNotes.trim() || DEFAULT_BILLING.invoicePaymentNotes,
  };
  const raw = loadRaw();
  raw.billing = next;
  saveRaw(raw);
  return next;
}

export function getDefaultInspectionPriceCents(inspectionType: InspectionType): number {
  const billing = getBillingSettings();
  if (inspectionType === 'PEST') return billing.pestPriceCents;
  if (inspectionType === 'COMBINED') return billing.combinedPriceCents;
  return billing.buildingPriceCents;
}

export function getLogoFilePath(): string | null {
  const fileName = loadRaw().branding?.logoFileName?.trim();
  if (!fileName) return null;
  const fullPath = join(brandingDir(), fileName);
  return existsSync(fullPath) ? fullPath : null;
}

export function hasCompanyLogo(): boolean {
  return Boolean(getLogoFilePath() || getBundledLogoPath());
}

export function saveCompanyLogoFromPath(sourcePath: string): string {
  mkdirSync(brandingDir(), { recursive: true });
  const ext = extname(sourcePath).toLowerCase() || '.png';
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
  if (!allowed.has(ext)) {
    throw new Error('Logo must be PNG, JPG, WEBP, or GIF.');
  }
  const fileName = `logo${ext}`;
  const target = join(brandingDir(), fileName);
  copyFileSync(sourcePath, target);
  const raw = loadRaw();
  raw.branding = { logoFileName: fileName };
  saveRaw(raw);
  return target;
}

export function removeCompanyLogo(): void {
  const path = getLogoFilePath();
  if (path && existsSync(path)) {
    unlinkSync(path);
  }
  const raw = loadRaw();
  if (raw.branding) {
    delete raw.branding.logoFileName;
  }
  saveRaw(raw);
}

export function getCompanyLogoDataUrl(): string | null {
  const path = getLogoFilePath();
  if (!path) return null;
  return filePathToDataUrl(path);
}

export interface ResolvedCompanyBranding {
  name: string;
  abn: string;
  phone: string;
  email: string;
  website: string;
  address: string | null;
  logoUrl: string | null;
}

export function getResolvedCompanyBranding(): ResolvedCompanyBranding {
  const company = getCompanySettings();
  return {
    name: company.name,
    abn: company.abn,
    phone: company.phone,
    email: company.email,
    website: company.website,
    address: company.address || null,
    logoUrl: getResolvedLogoDataUrl(),
  };
}

export function getResolvedReportSettings(): ReportSettings {
  const report = getReportSettings();
  const includeLogo = report.pdfIncludeLogo !== false && hasCompanyLogo();
  return {
    ...report,
    pdfIncludeLogo: includeLogo,
  };
}

export function getGitHubSettings(): GitHubSettings {
  const raw = loadRaw();
  migratePlaintextTokenIfNeeded(raw);
  const fresh = loadRaw().github ?? {};

  return {
    ...DEFAULT_GITHUB,
    enabled: fresh.enabled ?? false,
    owner: fresh.owner?.trim() ?? '',
    repo: fresh.repo?.trim() ?? '',
    branch: fresh.branch?.trim() || 'main',
    pagesBaseUrl: fresh.pagesBaseUrl?.trim().replace(/\/$/, '') ?? '',
    personalAccessToken: readTokenFromStored(fresh),
    publicRelayUrl: fresh.publicRelayUrl?.trim().replace(/\/$/, '') ?? '',
  };
}

export function getGitHubSettingsPublic(): GitHubSettingsPublic {
  const settings = getGitHubSettings();
  return {
    enabled: settings.enabled,
    owner: settings.owner,
    repo: settings.repo,
    branch: settings.branch,
    pagesBaseUrl: settings.pagesBaseUrl,
    publicRelayUrl: settings.publicRelayUrl,
    hasPersonalAccessToken: Boolean(settings.personalAccessToken),
  };
}

export function isGitHubSigningConfigured(): boolean {
  const settings = getGitHubSettings();
  return Boolean(
    settings.enabled &&
      settings.owner.trim() &&
      settings.repo.trim() &&
      settings.pagesBaseUrl.trim() &&
      settings.personalAccessToken.trim(),
  );
}

export function saveGitHubSettings(input: GitHubSettingsInput): GitHubSettingsPublic {
  const current = getGitHubSettings();
  const next: GitHubSettings = {
    enabled: input.enabled,
    owner: input.owner.trim(),
    repo: input.repo.trim(),
    branch: input.branch.trim() || 'main',
    pagesBaseUrl: input.pagesBaseUrl.trim().replace(/\/$/, ''),
    personalAccessToken: input.personalAccessToken?.trim() || current.personalAccessToken,
    publicRelayUrl: input.publicRelayUrl?.trim().replace(/\/$/, '') ?? current.publicRelayUrl,
  };

  const raw = loadRaw();
  raw.github = {
    enabled: next.enabled,
    owner: next.owner,
    repo: next.repo,
    branch: next.branch,
    pagesBaseUrl: next.pagesBaseUrl,
    encryptedPersonalAccessToken: encryptSecret(next.personalAccessToken),
    publicRelayUrl: next.publicRelayUrl,
  };
  saveRaw(raw);
  return getGitHubSettingsPublic();
}
