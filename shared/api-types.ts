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
}

export type BillingSettingsInput = BillingSettings;

export interface AppSettingsOverview {
  company: CompanySettings;
  report: ReportSettings;
  billing: BillingSettings;
  hasLogo: boolean;
  logoPreview: string | null;
}

export interface CopyPdfResult {
  count: number;
  message: string;
}
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
}

export interface AgreementLegalContent {
  sections: AgreementLegalSection[];
}

export interface AgreementRow {
  id: string;
  agreementNumber: string;
  jobId: string | null;
  jobNumber: string | null;
  status: AgreementStatus;
  inspectionType: InspectionType;
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
  clientName: string;
  clientEmail: string;
  propertyAddress: string;
  priceCents: number;
  gstCents: number;
  totalCents: number;
  agreementDate: string;
  legalSections: AgreementLegalContent;
  canSign: boolean;
}

export interface CreateAgreementInput {
  jobId?: string;
  inspectionType: InspectionType;
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
  realEstate?: string;
  agentName?: string;
  notes?: string;
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
  agentName?: string;
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
  method: 'zoho';
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
  invoicePdfPath: string | null;
  hasInvoice: boolean;
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
    emailClient: (jobId: string) => Promise<ComposeEmailResult>;
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
  };
  agreements: {
    list: (filter?: { status?: AgreementStatus | ''; search?: string }) => Promise<AgreementRow[]>;
    get: (agreementId: string) => Promise<AgreementDetail | null>;
    create: (input: CreateAgreementInput) => Promise<AgreementDetail>;
    createFromJob: (jobId: string) => Promise<AgreementDetail>;
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
  };
  calendar: {
    listEvents: (startDate: string, endDate: string) => Promise<CalendarEvent[]>;
    listUpcoming: () => Promise<CalendarEvent[]>;
    reschedule: (jobId: string, input: RescheduleJobInput) => Promise<CalendarEvent>;
  };
  clients: {
    list: (search?: string) => Promise<ClientRow[]>;
    get: (clientId: string) => Promise<ClientDetail>;
    openAgreementPdf: (agreementId: string) => Promise<void>;
    openInvoicePdf: (jobId: string) => Promise<void>;
    copyAgreementPdf: (agreementId: string) => Promise<CopyPdfResult>;
    copyInvoicePdf: (jobId: string) => Promise<CopyPdfResult>;
    copyAllJobDocuments: (jobId: string) => Promise<CopyPdfResult>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
    copyFilesToClipboard: (filePaths: string[]) => Promise<CopyPdfResult>;
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
    selectLogo: () => Promise<{ saved: boolean; logoPreview: string | null }>;
    removeLogo: () => Promise<void>;
    getGitHub: () => Promise<GitHubSettingsPublic>;
    saveGitHub: (input: GitHubSettingsInput) => Promise<GitHubSettingsPublic>;
    testGitHub: () => Promise<GitHubTestConnectionResult>;
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
