export type JobStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type InspectionType = 'BUILDING' | 'PEST' | 'COMBINED';
export type InspectionRecordStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  mobile: string | null;
}

export interface InspectorProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  mobile?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CompanySettings {
  name: string;
  abn: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

export type CompanySettingsInput = CompanySettings;

export interface ReportSettings {
  primaryColor: string;
  secondaryColor: string;
  pdfFooterText: string;
  pdfIncludeLogo: boolean;
  reportHeader: string | null;
  reportFooter: string | null;
}

export type ReportSettingsInput = ReportSettings;

export interface BillingSettings {
  buildingPriceCents: number;
  pestPriceCents: number;
  combinedPriceCents: number;
  bankAccountName: string;
  bankBsb: string;
  bankAccountNumber: string;
  invoicePaymentTerms: string;
  invoicePaymentNotes: string;
  /** Closing thank-you line on tax invoice PDFs. */
  invoiceThankYouMessage: string;
}

export type BillingSettingsInput = BillingSettings;

export type EmailMailClient = 'zoho' | 'outlook' | 'system';
export type SmtpEncryption = 'ssl' | 'tls' | 'none';

export interface EmailSettings {
  mailClient: EmailMailClient;
  fromEmail: string;
  includePdfAttachTip: boolean;
  signingSubject: string;
  signingBody: string;
  reportSubject: string;
  reportBody: string;
  generalSubject: string;
  generalBody: string;
  invoiceSubject: string;
  invoiceBody: string;
  /** When true, SiteScop sends mail via SMTP instead of opening a mail client. */
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: SmtpEncryption;
  smtpUsername: string;
  /** True when an encrypted SMTP password is stored (never returns the password). */
  hasSmtpPassword: boolean;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
}

export type EmailSettingsInput = Omit<EmailSettings, 'hasSmtpPassword'> & {
  /** Leave empty to keep the currently stored encrypted password. */
  smtpPassword?: string;
};

export interface SmtpTestResult {
  ok: boolean;
  code: 'success' | 'auth_failed' | 'connect_failed' | 'invalid_config' | 'send_failed';
  message: string;
}

export interface PasswordResetRequestResult {
  ok: boolean;
  message: string;
}

export interface PasswordResetConfirmInput {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AppSettingsOverview {
  company: CompanySettings;
  report: ReportSettings;
  billing: BillingSettings;
  email: EmailSettings;
  hasLogo: boolean;
  logoPreview: string | null;
}

export interface CopyPdfResult {
  count: number;
  message: string;
}

export interface LoginResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
}

export interface DashboardSummary {
  todaysJobs: number;
  inProgress: number;
  waitingAgreements: number;
  completedThisWeek: number;
  outstandingInvoices: number;
  upcomingInspections: number;
}

export type JobDeleteReason = 'CLIENT_CANCEL' | 'INSPECTOR_CANCEL' | 'DUPLICATED' | 'OTHER';

export interface DeleteJobInput {
  reason: JobDeleteReason;
  notes?: string;
}

export type RecycleBinItemType = 'job' | 'agreement';

export interface RecycleBinJobItem {
  type: 'job';
  id: string;
  deletedAt: string;
  reason: JobDeleteReason | null;
  notes: string | null;
  jobNumber: string;
  clientName: string;
  inspectionDate: string;
  inspectionType: InspectionType;
  status: JobStatus;
  propertyAddress: string;
}

export interface RecycleBinAgreementItem {
  type: 'agreement';
  id: string;
  deletedAt: string;
  reason: string | null;
  agreementNumber: string;
  clientName: string;
  propertyAddress: string;
  status: AgreementStatus;
  inspectionType: InspectionType;
  jobNumber: string | null;
}

export type RecycleBinItem = RecycleBinJobItem | RecycleBinAgreementItem;

export type AgreementStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'SIGNED' | 'CANCELLED';

export interface AgreementLegalSection {
  id: string;
  title: string;
  content: string;
  /** Sanitized HTML for client signing (callouts, headings, lists). */
  contentHtml?: string;
}

export interface AgreementLegalContent {
  sections: AgreementLegalSection[];
}

export type AgreementSignerRole = 'CLIENT' | 'AGENT';

export interface AgreementRow {
  id: string;
  agreementNumber: string;
  jobId: string | null;
  jobNumber: string | null;
  status: AgreementStatus;
  inspectionType: InspectionType;
  signerRole: AgreementSignerRole;
  agencyName: string | null;
  agentName: string | null;
  agentEmail: string | null;
  signedOnBehalfOf: string | null;
  agentAuthorityAccepted: boolean;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  propertyAddress: string;
  priceCents: number;
  gstCents: number;
  totalCents: number;
  agreementDate: string;
  notes: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface AgreementDetail extends AgreementRow {
  legalSections: AgreementLegalContent;
  accessToken: string | null;
  signatureName: string | null;
  signatureData: string | null;
  pdfPath: string | null;
  updatedAt: string;
  archivedAt: string | null;
  supersededById: string | null;
  revisesId: string | null;
  archivedInvoicePath: string | null;
}

export interface PublicAgreementView {
  id: string;
  agreementNumber: string;
  status: AgreementStatus;
  inspectionType: InspectionType;
  companyName: string;
  companyPhone: string;
  companyWebsite: string;
  companyEmail: string;
  companyAbn: string;
  companyLogoUrl: string | null;
  signerRole: AgreementSignerRole;
  agencyName: string | null;
  agentName: string | null;
  agentEmail: string | null;
  clientName: string;
  clientEmail: string;
  propertyAddress: string;
  priceCents: number;
  gstCents: number;
  totalCents: number;
  agreementDate: string;
  legalSections: AgreementLegalContent;
  canSign: boolean;
  /** True when a linked agent is on file — the signing page lets the visitor choose client or agent. */
  agentSigningAvailable: boolean;
  /** Agent Authority section (inserted when the visitor chooses agent signing). */
  agentAuthoritySection: AgreementLegalSection | null;
}

export interface CreateAgreementInput {
  jobId?: string;
  inspectionType: InspectionType;
  signerRole?: AgreementSignerRole;
  agencyName?: string;
  agentName?: string;
  agentEmail?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  propertyAddress: string;
  priceCents?: number;
  agreementDate?: string;
  notes?: string;
}

export type UpdateAgreementInput = Partial<Omit<CreateAgreementInput, 'jobId'>>;

export interface SignAgreementInput {
  signatureName: string;
  signatureData: string;
  declarationsAccepted: boolean;
  /** Who is signing — chosen on the client signing page when an agent is on file. */
  signingParty?: AgreementSignerRole;
  /** Required when signingParty is AGENT — agent confirms authority to bind the client. */
  agentAuthorityAccepted?: boolean;
}

export interface SendAgreementResult {
  signingUrl: string;
  accessToken: string;
  signingMode: 'github' | 'local';
}

export interface GitHubSettingsPublic {
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  pagesBaseUrl: string;
  publicRelayUrl: string;
  hasPersonalAccessToken: boolean;
}

export interface GitHubSettingsInput {
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  pagesBaseUrl: string;
  publicRelayUrl?: string;
  personalAccessToken?: string;
}

export interface GitHubTestConnectionResult {
  ok: true;
  defaultBranch: string;
  repository: string;
  pagesUrl: string;
  pagesReachable: boolean;
  writeAccessVerified: boolean;
}

export interface GitHubSyncResult {
  imported: number;
  viewed: number;
  errors: string[];
  failed: boolean;
}

export interface XeroSettingsPublic {
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
  salesAccountCode: string;
  connected: boolean;
  tenantName: string;
  redirectUri: string;
}

export interface XeroSettingsInput {
  enabled: boolean;
  clientId: string;
  clientSecret?: string;
  salesAccountCode: string;
}

export interface PushToXeroResult {
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  message: string;
}

export interface CalendarEvent {
  id: string;
  jobNumber: string;
  clientName: string;
  propertyAddress: string;
  inspectionType: InspectionType;
  inspectionDate: string;
  inspectionTime: string;
  status: JobStatus;
  priority: JobPriority;
}

export interface RescheduleJobInput {
  inspectionDate: string;
  inspectionTime: string;
}

export interface JobRow {
  id: string;
  jobNumber: string;
  clientName: string;
  mobile: string;
  email: string;
  inspectionType: InspectionType;
  inspectionDate: string;
  inspectionTime: string;
  propertyAddress: string;
  status: JobStatus;
  priority: JobPriority;
  agreementStatus: 'NONE' | 'DRAFT' | 'SENT' | 'SIGNED';
  hasInvoice: boolean;
  hasReport: boolean;
  paymentReceived: boolean;
  paidAt?: string;
  realEstate?: string;
  orderingPartyType?: string;
  agentName?: string;
  agentPhone?: string;
  agentMobile?: string;
  agentEmail?: string;
  notes?: string;
  xeroInvoiceId?: string | null;
}

export type TodayJobRow = JobRow;

export interface CreateJobInput {
  clientFirstName: string;
  clientLastName: string;
  clientEmail?: string;
  clientMobile?: string;
  propertyAddress: string;
  propertySuburb?: string;
  inspectionType: InspectionType;
  inspectionDate: string;
  inspectionTime: string;
  realEstate?: string;
  orderingPartyType?: string;
  agentName?: string;
  agentPhone?: string;
  agentMobile?: string;
  agentEmail?: string;
  notes?: string;
  priority?: JobPriority;
}

export interface CreateJobResult {
  job: JobRow;
  inspectionId: string;
}

export interface JobDetail extends JobRow {
  inspectionId: string;
  inspectionStatus: InspectionRecordStatus;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportType = 'BUILDING' | 'PEST';

export interface InspectionReportRow {
  id: string;
  jobId: string;
  inspectionId: string;
  reportType: ReportType;
  fileName: string;
  filePath: string;
  generatedAt: string;
}

export interface ComposeEmailResult {
  clientEmail: string;
  method: 'zoho' | 'outlook' | 'system' | 'smtp';
  message: string;
  cancelled?: boolean;
}

export interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  createdAt: string;
  jobCount: number;
  lastJobDate: string | null;
}

export interface ClientDetailJobReport {
  id: string;
  jobId: string;
  inspectionId: string;
  reportType: ReportType;
  fileName: string;
  filePath: string;
  generatedAt: string;
}

export interface ClientDetailJobAgreement {
  id: string;
  agreementNumber: string;
  status: AgreementStatus;
  inspectionType: InspectionType;
  signedAt: string | null;
}

/** Previous agreement archived when a revised draft was created — client Old / History only. */
export interface ClientArchivedAgreement {
  id: string;
  agreementNumber: string;
  status: AgreementStatus;
  inspectionType: InspectionType;
  signedAt: string | null;
  archivedAt: string;
  supersededById: string | null;
  supersededByAgreementNumber: string | null;
  pdfPath: string | null;
  invoicePath: string | null;
  jobId: string | null;
  jobNumber: string | null;
  propertyAddress: string;
}

export interface ClientDetailJob {
  id: string;
  jobNumber: string;
  inspectionType: InspectionType;
  propertyAddress: string;
  status: JobStatus;
  inspectionDate: string;
  inspectionNumber: string | null;
  agreementId: string | null;
  agreementNumber: string | null;
  agreementStatus: string | null;
  agreementPdfPath: string | null;
  agreements: ClientDetailJobAgreement[];
  invoicePdfPath: string | null;
  hasInvoice: boolean;
  orderingPartyType: string | null;
  realEstate: string | null;
  agentName: string | null;
  agentPhone: string | null;
  agentMobile: string | null;
  agentEmail: string | null;
  reports: ClientDetailJobReport[];
}

export interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  createdAt: string;
  primaryPropertyAddress: string | null;
  propertyAddresses: string[];
  jobs: ClientDetailJob[];
  archivedAgreements: ClientArchivedAgreement[];
}

export interface UpdateClientInput {
  firstName: string;
  lastName: string;
  email?: string;
  mobile?: string;
}

export interface UpdateClientAgentInput {
  realEstate?: string;
  agentName?: string;
  agentPhone?: string;
  agentMobile?: string;
  agentEmail?: string;
}

export interface AccountingJobRow extends JobRow {
  clientId: string;
  totalCents: number | null;
  signedAt: string | null;
}

export interface AccountingSummary {
  revenueThisWeekCents: number;
  revenueThisMonthCents: number;
  overdueJobCount: number;
  overdueAmountCents: number;
  readyToSendCount: number;
}

export interface ClientAccountingRow {
  clientId: string;
  clientName: string;
  unpaidJobCount: number;
  paidJobCount: number;
  amountOwedCents: number;
  amountPaidCents: number;
}

export type {
  InspectionDetail,
  UpdateInspectionRoomInput,
  UpdateInspectionSectionInput,
} from './inspection-types.js';

export type GeoCaptureResult =
  | { ok: true; latitude: number; longitude: number; accuracy?: number }
  | { ok: false; message: string };

export type SpeechDictateResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

export interface SpeechCheckResult {
  available: boolean;
  message: string;
}

export interface SitescopApi {
  meta: {
    isDesktop: true;
    version: string;
    /** Increment when preload adds new IPC modules — renderer uses this to detect stale installs. */
    bridgeVersion?: number;
  };
  auth: {
    login: (email: string, password: string, remember: boolean) => Promise<LoginResult>;
    logout: () => Promise<void>;
    getSession: () => Promise<SessionUser | null>;
    requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
    confirmPasswordReset: (input: PasswordResetConfirmInput) => Promise<PasswordResetRequestResult>;
  };
  dashboard: {
    getSummary: () => Promise<DashboardSummary>;
    getTodayJobs: () => Promise<TodayJobRow[]>;
    startInspection: (jobId: string) => Promise<void>;
    completeInspection: (jobId: string) => Promise<void>;
  };
  jobs: {
    create: (input: CreateJobInput) => Promise<CreateJobResult>;
    listInProgress: () => Promise<JobRow[]>;
    listCompleted: () => Promise<JobRow[]>;
    listOutstandingInvoices: () => Promise<JobRow[]>;
    get: (jobId: string) => Promise<JobDetail | null>;
    delete: (jobId: string, input: DeleteJobInput) => Promise<void>;
    start: (jobId: string) => Promise<void>;
    markPaid: (jobId: string) => Promise<JobDetail>;
    emailClient: (jobId: string) => Promise<ComposeEmailResult>;
    emailInvoice: (jobId: string) => Promise<ComposeEmailResult>;
  };
  inspections: {
    getByJob: (jobId: string) => Promise<import('./inspection-types.js').InspectionDetail | null>;
    updateSection: (
      inspectionId: string,
      input: import('./inspection-types.js').UpdateInspectionSectionInput,
    ) => Promise<{ inspection: import('./inspection-types.js').InspectionDetail }>;
    updateRoom: (
      inspectionId: string,
      roomId: string,
      input: import('./inspection-types.js').UpdateInspectionRoomInput,
    ) => Promise<{ inspection: import('./inspection-types.js').InspectionDetail }>;
    complete: (
      inspectionId: string,
    ) => Promise<{ inspection: import('./inspection-types.js').InspectionDetail }>;
  };
  reports: {
    listForJob: (jobId: string) => Promise<InspectionReportRow[]>;
    generateForJob: (jobId: string) => Promise<InspectionReportRow[]>;
    openPdf: (filePath: string) => Promise<void>;
    copyPdf: (filePath: string) => Promise<CopyPdfResult>;
    copyPdfs: (filePaths: string[]) => Promise<CopyPdfResult>;
    openFolder: (jobId: string) => Promise<void>;
    emailToClient: (reportId: string) => Promise<ComposeEmailResult>;
    emailJobToClient: (jobId: string) => Promise<ComposeEmailResult>;
  };
  agreements: {
    list: (filter?: { status?: AgreementStatus | ''; search?: string }) => Promise<AgreementRow[]>;
    get: (agreementId: string) => Promise<AgreementDetail | null>;
    create: (input: CreateAgreementInput) => Promise<AgreementDetail>;
    createFromJob: (jobId: string) => Promise<AgreementDetail>;
    createRevised: (agreementId: string) => Promise<AgreementDetail>;
    createJobFromSigned: (agreementId: string) => Promise<CreateJobResult & { agreement: AgreementDetail }>;
    update: (agreementId: string, input: UpdateAgreementInput) => Promise<AgreementDetail>;
    send: (agreementId: string) => Promise<SendAgreementResult>;
    getSigningPortalBase: () => Promise<{ baseUrl: string; mode: 'github' | 'local' }>;
    resolveSigningUrl: (accessToken: string) => Promise<{ url: string; mode: 'github' | 'local' }>;
    syncFromGitHub: () => Promise<GitHubSyncResult>;
    republishToGitHub: (agreementId: string) => Promise<void>;
    cancel: (agreementId: string) => Promise<void>;
    delete: (agreementId: string) => Promise<void>;
    generatePdf: (agreementId: string) => Promise<string>;
    openPdf: (filePath: string) => Promise<void>;
    getPublic: (token: string) => Promise<PublicAgreementView | null>;
    markViewed: (token: string) => Promise<void>;
    sign: (token: string, input: SignAgreementInput) => Promise<{ agreementNumber: string; jobId: string | null }>;
    emailSigningLink: (agreementId: string) => Promise<ComposeEmailResult>;
  };
  calendar: {
    listEvents: (startDate: string, endDate: string) => Promise<CalendarEvent[]>;
    listUpcoming: () => Promise<CalendarEvent[]>;
    reschedule: (jobId: string, input: RescheduleJobInput) => Promise<CalendarEvent>;
  };
  accounting: {
    listAwaitingPayment: () => Promise<AccountingJobRow[]>;
    listPaid: () => Promise<AccountingJobRow[]>;
    listByClient: () => Promise<ClientAccountingRow[]>;
    getSummary: () => Promise<AccountingSummary>;
    pushToXero: (jobId: string) => Promise<PushToXeroResult>;
  };
  clients: {
    list: (search?: string) => Promise<ClientRow[]>;
    get: (clientId: string) => Promise<ClientDetail>;
    update: (clientId: string, input: UpdateClientInput) => Promise<ClientDetail>;
    updateAgent: (clientId: string, input: UpdateClientAgentInput) => Promise<ClientDetail>;
    openAgreementPdf: (agreementId: string) => Promise<void>;
    openInvoicePdf: (jobId: string) => Promise<void>;
    copyAgreementPdf: (agreementId: string) => Promise<CopyPdfResult>;
    copyInvoicePdf: (jobId: string) => Promise<CopyPdfResult>;
    copyAllJobDocuments: (jobId: string) => Promise<CopyPdfResult>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
    copyFilesToClipboard: (filePaths: string[]) => Promise<CopyPdfResult>;
    copyTextToClipboard: (text: string) => Promise<{ message: string }>;
  };
  geo: {
    captureCurrentPosition: () => Promise<GeoCaptureResult>;
  };
  speech: {
    check: () => Promise<SpeechCheckResult>;
    dictate: () => Promise<SpeechDictateResult>;
    cancel: () => Promise<void>;
    transcribeAudio: (base64Wav: string) => Promise<SpeechDictateResult>;
    onPhase?: (listener: (phase: 'ready') => void) => () => void;
  };
  settings: {
    getProfile: () => Promise<SessionUser>;
    saveProfile: (input: InspectorProfileInput) => Promise<SessionUser>;
    changePassword: (input: ChangePasswordInput) => Promise<void>;
    getApp: () => Promise<AppSettingsOverview>;
    saveCompany: (input: CompanySettingsInput) => Promise<CompanySettings>;
    saveReport: (input: ReportSettingsInput) => Promise<ReportSettings>;
    saveBilling: (input: BillingSettingsInput) => Promise<BillingSettings>;
    saveEmail: (input: EmailSettingsInput) => Promise<EmailSettings>;
    testSmtp: (toEmail: string) => Promise<SmtpTestResult>;
    selectLogo: () => Promise<{ saved: boolean; logoPreview: string | null }>;
    removeLogo: () => Promise<void>;
    getGitHub: () => Promise<GitHubSettingsPublic>;
    saveGitHub: (input: GitHubSettingsInput) => Promise<GitHubSettingsPublic>;
    testGitHub: () => Promise<GitHubTestConnectionResult>;
    getXero: () => Promise<XeroSettingsPublic>;
    saveXero: (input: XeroSettingsInput) => Promise<XeroSettingsPublic>;
    connectXero: () => Promise<{ tenantName: string }>;
    disconnectXero: () => Promise<XeroSettingsPublic>;
  };
  recycleBin: {
    list: () => Promise<RecycleBinItem[]>;
    restore: (type: RecycleBinItemType, id: string) => Promise<void>;
    purge: (type: RecycleBinItemType, id: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    sitescop: SitescopApi;
  }
}

export {};
