import { ipcMain, shell, dialog } from 'electron';
import bcrypt from 'bcryptjs';
import type {
  AgreementStatus,
  ChangePasswordInput,
  CompanySettingsInput,
  CreateAgreementInput,
  CreateJobInput,
  DeleteJobInput,
  InspectorProfileInput,
  RecycleBinItemType,
  ReportSettingsInput,
  SessionUser,
  SignAgreementInput,
  UpdateAgreementInput,
  RescheduleJobInput,
  GitHubSettingsInput,
} from '../../shared/api-types.js';
import type {
  InspectionDetail,
  UpdateInspectionRoomInput,
  UpdateInspectionSectionInput,
} from '../../shared/inspection-types.js';
import { captureCurrentPosition } from './geolocation.service.js';
import { getSigningPortalBaseUrl } from './signing-server.js';
import {
  getActiveSigningUrl,
  pushPendingAgreementToGitHub,
  syncSignedAgreementsFromGitHub,
} from './github-agreements.service.js';
import {
  getGitHubSettings,
  getGitHubSettingsPublic,
  getCompanySettings,
  getReportSettings,
  getCompanyLogoDataUrl,
  hasCompanyLogo,
  isGitHubSigningConfigured,
  removeCompanyLogo,
  saveCompanyLogoFromPath,
  saveCompanySettings,
  saveGitHubSettings,
  saveReportSettings,
} from './settings.service.js';
import { testGitHubConnection } from './github.service.js';
import type { LocalDatabase } from './database.js';
import {
  getDashboardSummary,
  getTodayJobs,
  getUserByEmail,
  getUserById,
  toSessionUser,
  updateJobStatus,
} from './database.js';
import {
  createJob,
  getJobDetail,
  listCompletedJobs,
  listInProgressJobs,
  listOutstandingInvoiceJobs,
  softDeleteJob,
  startJob,
} from './jobs.service.js';
import {
  completeInspection,
  getInspectionByJob,
  updateInspectionRoom,
  updateInspectionSection,
} from './inspections.service.js';
import {
  generateReportsForJob,
  getReportsFolder,
  listReportsForJob,
} from './reports.service.js';
import {
  cancelAgreement,
  createAgreement,
  createAgreementFromJob,
  generateAgreementPdfForId,
  getAgreement,
  getPublicAgreement,
  listAgreements,
  markAgreementViewed,
  sendAgreement,
  signAgreement,
  softDeleteAgreement,
  updateAgreement,
} from './agreements.service.js';
import {
  listRecycleBinItems,
  purgeRecycleBinItem,
  restoreRecycleBinItem,
} from './recycle-bin.service.js';
import { composeClientEmail, composeReportEmailToClient } from './email.service.js';
import { listCalendarEvents, listUpcomingJobs, rescheduleJob } from './calendar.service.js';
import { listClients } from './clients.service.js';
import { localDateKey } from './database.js';
import { changeInspectorPassword, updateInspectorProfile } from './user.service.js';

let currentSession: SessionUser | null = null;
let store: LocalDatabase | null = null;

function requireAuth() {
  if (!store || !currentSession) {
    throw new Error('Not authenticated');
  }
  return store;
}

function requireStore() {
  if (!store) throw new Error('Database not ready');
  return store;
}

export function initIpcStore(database: LocalDatabase) {
  store = database;
}

export function registerIpcHandlers() {
  ipcMain.handle('auth:login', async (_event, email: string, password: string, remember: boolean) => {
    if (!store) throw new Error('Database not ready');
    const user = getUserByEmail(store.db, email.trim());
    if (!user) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid email or password.' };
    }

    currentSession = toSessionUser(user);

    void remember;

    return { success: true, user: currentSession };
  });

  ipcMain.handle('auth:logout', async () => {
    currentSession = null;
  });

  ipcMain.handle('auth:getSession', async () => {
    if (!store || !currentSession) return currentSession;
    const fresh = getUserById(store.db, currentSession.id);
    if (!fresh) return currentSession;
    currentSession = toSessionUser(fresh);
    return currentSession;
  });

  ipcMain.handle('dashboard:getSummary', async () => {
    const db = requireAuth();
    return getDashboardSummary(db.db);
  });

  ipcMain.handle('dashboard:getTodayJobs', async () => {
    const db = requireAuth();
    return getTodayJobs(db.db);
  });

  ipcMain.handle('dashboard:startInspection', async (_event, jobId: string) => {
    const db = requireAuth();
    startJob(db.db, jobId);
    db.persist();
  });

  ipcMain.handle('dashboard:completeInspection', async (_event, jobId: string) => {
    const db = requireAuth();
    updateJobStatus(db.db, jobId, 'COMPLETED');
    db.persist();
  });

  ipcMain.handle('jobs:create', async (_event, input: CreateJobInput) => {
    const db = requireAuth();
    const result = createJob(db.db, input);
    db.persist();
    return result;
  });

  ipcMain.handle('jobs:listInProgress', async () => {
    const db = requireAuth();
    return listInProgressJobs(db.db);
  });

  ipcMain.handle('jobs:listCompleted', async () => {
    const db = requireAuth();
    return listCompletedJobs(db.db);
  });

  ipcMain.handle('jobs:listOutstandingInvoices', async () => {
    const db = requireAuth();
    return listOutstandingInvoiceJobs(db.db);
  });

  ipcMain.handle('jobs:get', async (_event, jobId: string) => {
    const db = requireAuth();
    return getJobDetail(db.db, jobId);
  });

  ipcMain.handle('jobs:delete', async (_event, jobId: string, input: DeleteJobInput) => {
    const db = requireAuth();
    if (!input?.reason) {
      throw new Error('A reason is required to remove a job.');
    }
    if (input.reason === 'OTHER' && !input.notes?.trim()) {
      throw new Error('Please enter details when selecting Other as the reason.');
    }
    softDeleteJob(db.db, jobId, input);
    db.persist();
  });

  ipcMain.handle('jobs:start', async (_event, jobId: string) => {
    const db = requireAuth();
    startJob(db.db, jobId);
    db.persist();
  });

  ipcMain.handle('jobs:emailClient', async (_event, jobId: string) => {
    const db = requireAuth();
    if (!currentSession) throw new Error('Not authenticated');
    try {
      return await composeClientEmail(db.db, jobId, currentSession);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open email';
      throw new Error(message);
    }
  });

  ipcMain.handle('inspections:getByJob', async (_event, jobId: string) => {
    const db = requireAuth();
    if (!currentSession) throw new Error('Not authenticated');
    try {
      const result = getInspectionByJob(db.db, jobId, currentSession);
      db.persist();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load inspection';
      throw new Error(message);
    }
  });

  ipcMain.handle(
    'inspections:updateSection',
    async (_event, inspectionId: string, input: UpdateInspectionSectionInput) => {
      const db = requireAuth();
      const inspection = updateInspectionSection(db.db, inspectionId, input);
      db.persist();
      return { inspection };
    },
  );

  ipcMain.handle(
    'inspections:updateRoom',
    async (_event, inspectionId: string, roomId: string, input: UpdateInspectionRoomInput) => {
      const db = requireAuth();
      const inspection = updateInspectionRoom(db.db, inspectionId, roomId, input);
      db.persist();
      return { inspection };
    },
  );

  ipcMain.handle('inspections:complete', async (_event, inspectionId: string) => {
    const db = requireAuth();
    const inspection = completeInspection(db.db, inspectionId);
    db.persist();
    return { inspection };
  });

  ipcMain.handle('reports:listForJob', async (_event, jobId: string) => {
    const db = requireAuth();
    return listReportsForJob(db.db, jobId);
  });

  ipcMain.handle('reports:generateForJob', async (_event, jobId: string) => {
    const db = requireAuth();
    if (!currentSession) throw new Error('Not authenticated');
    try {
      const reports = await generateReportsForJob(db.db, jobId, currentSession);
      db.persist();
      return reports;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate PDF report';
      throw new Error(message);
    }
  });

  ipcMain.handle('reports:openPdf', async (_event, filePath: string) => {
    const result = await shell.openPath(filePath);
    if (result) throw new Error(result);
  });

  ipcMain.handle('reports:openFolder', async (_event, jobId: string) => {
    const folder = getReportsFolder(jobId);
    const result = await shell.openPath(folder);
    if (result) throw new Error(result);
  });

  ipcMain.handle('reports:emailToClient', async (_event, reportId: string) => {
    const db = requireAuth();
    if (!currentSession) throw new Error('Not authenticated');
    try {
      return await composeReportEmailToClient(db.db, reportId, currentSession);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to compose email';
      throw new Error(message);
    }
  });

  ipcMain.handle(
    'agreements:list',
    async (_event, filter?: { status?: AgreementStatus | ''; search?: string }) => {
      const db = requireAuth();
      return listAgreements(db.db, filter);
    },
  );

  ipcMain.handle('agreements:get', async (_event, agreementId: string) => {
    const db = requireAuth();
    return getAgreement(db.db, agreementId);
  });

  ipcMain.handle('agreements:create', async (_event, input: CreateAgreementInput) => {
    const db = requireAuth();
    const agreement = createAgreement(db.db, input);
    db.persist();
    return agreement;
  });

  ipcMain.handle('agreements:createFromJob', async (_event, jobId: string) => {
    const db = requireAuth();
    const agreement = createAgreementFromJob(db.db, jobId);
    db.persist();
    return agreement;
  });

  ipcMain.handle(
    'agreements:update',
    async (_event, agreementId: string, input: UpdateAgreementInput) => {
      const db = requireAuth();
      const agreement = updateAgreement(db.db, agreementId, input);
      db.persist();
      return agreement;
    },
  );

  ipcMain.handle('agreements:send', async (_event, agreementId: string) => {
    const db = requireAuth();
    const before = getAgreement(db.db, agreementId);
    const wasDraft = before?.status === 'DRAFT';
    const result = sendAgreement(db.db, agreementId);
    db.persist();

    if (isGitHubSigningConfigured()) {
      try {
        await pushPendingAgreementToGitHub(db.db, agreementId);
      } catch (error) {
        if (wasDraft) {
          db.db.run(
            `UPDATE agreements SET
               status = 'DRAFT',
               access_token = NULL,
               sent_at = NULL,
               updated_at = datetime('now')
             WHERE id = ?`,
            [agreementId],
          );
        }
        db.persist();
        const message = error instanceof Error ? error.message : 'Upload to GitHub failed';
        throw new Error(message);
      }
    }

    const active = getActiveSigningUrl(result.accessToken);
    return {
      accessToken: result.accessToken,
      signingUrl: active.url,
      signingMode: active.mode,
    };
  });

  ipcMain.handle('agreements:getSigningPortalBase', async () => {
    requireAuth();
    if (isGitHubSigningConfigured()) {
      const settings = getGitHubSettings();
      return { baseUrl: settings.pagesBaseUrl, mode: 'github' as const };
    }
    return { baseUrl: getSigningPortalBaseUrl(), mode: 'local' as const };
  });

  ipcMain.handle('agreements:resolveSigningUrl', async (_event, accessToken: string) => {
    requireAuth();
    return getActiveSigningUrl(accessToken);
  });

  ipcMain.handle('agreements:syncFromGitHub', async () => {
    const db = requireAuth();
    const result = await syncSignedAgreementsFromGitHub(db.db);
    db.persist();
    return result;
  });

  ipcMain.handle('agreements:republishToGitHub', async (_event, agreementId: string) => {
    const db = requireAuth();
    await pushPendingAgreementToGitHub(db.db, agreementId);
  });

  ipcMain.handle('agreements:cancel', async (_event, agreementId: string) => {
    const db = requireAuth();
    cancelAgreement(db.db, agreementId);
    db.persist();
  });

  ipcMain.handle('agreements:delete', async (_event, agreementId: string) => {
    const db = requireAuth();
    softDeleteAgreement(db.db, agreementId);
    db.persist();
  });

  ipcMain.handle('recycleBin:list', async () => {
    const db = requireAuth();
    return listRecycleBinItems(db.db);
  });

  ipcMain.handle('recycleBin:restore', async (_event, type: RecycleBinItemType, id: string) => {
    const db = requireAuth();
    restoreRecycleBinItem(db.db, type, id);
    db.persist();
  });

  ipcMain.handle('recycleBin:purge', async (_event, type: RecycleBinItemType, id: string) => {
    const db = requireAuth();
    purgeRecycleBinItem(db.db, type, id);
    db.persist();
  });

  ipcMain.handle('clients:list', async (_event, search?: string) => {
    const db = requireAuth();
    return listClients(db.db, search);
  });

  ipcMain.handle('agreements:generatePdf', async (_event, agreementId: string) => {
    const db = requireAuth();
    try {
      const filePath = await generateAgreementPdfForId(db.db, agreementId);
      db.persist();
      return filePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate agreement PDF';
      throw new Error(message);
    }
  });

  ipcMain.handle('agreements:openPdf', async (_event, filePath: string) => {
    const result = await shell.openPath(filePath);
    if (result) throw new Error(result);
  });

  ipcMain.handle('agreements:getPublic', async (_event, token: string) => {
    const db = requireStore();
    return getPublicAgreement(db.db, token);
  });

  ipcMain.handle('agreements:markViewed', async (_event, token: string) => {
    const db = requireStore();
    markAgreementViewed(db.db, token);
    db.persist();
  });

  ipcMain.handle('agreements:sign', async (_event, token: string, input: SignAgreementInput) => {
    const db = requireStore();
    if (!input.declarationsAccepted) {
      throw new Error('You must accept the declarations before signing.');
    }
    try {
      const result = await signAgreement(db.db, token, input, currentSession ?? undefined);
      db.persist();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign agreement';
      throw new Error(message);
    }
  });

  ipcMain.handle('calendar:listEvents', async (_event, startDate: string, endDate: string) => {
    const db = requireAuth();
    return listCalendarEvents(db.db, startDate, endDate);
  });

  ipcMain.handle('calendar:listUpcoming', async () => {
    const db = requireAuth();
    return listUpcomingJobs(db.db, localDateKey());
  });

  ipcMain.handle('calendar:reschedule', async (_event, jobId: string, input: RescheduleJobInput) => {
    const db = requireAuth();
    const event = rescheduleJob(db.db, jobId, input);
    db.persist();
    return event;
  });

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('settings:getProfile', async () => {
    const db = requireAuth();
    const user = getUserById(db.db, currentSession!.id);
    if (!user) throw new Error('User not found.');
    return toSessionUser(user);
  });

  ipcMain.handle('settings:saveProfile', async (_event, input: InspectorProfileInput) => {
    const db = requireAuth();
    const updated = updateInspectorProfile(db.db, currentSession!.id, input);
    db.persist();
    currentSession = updated;
    return updated;
  });

  ipcMain.handle('settings:changePassword', async (_event, input: ChangePasswordInput) => {
    const db = requireAuth();
    await changeInspectorPassword(db.db, currentSession!.id, input);
    db.persist();
  });

  ipcMain.handle('settings:getApp', async () => ({
    company: getCompanySettings(),
    report: getReportSettings(),
    hasLogo: hasCompanyLogo(),
    logoPreview: getCompanyLogoDataUrl(),
  }));

  ipcMain.handle('settings:saveCompany', async (_event, input: CompanySettingsInput) => {
    requireAuth();
    return saveCompanySettings(input);
  });

  ipcMain.handle('settings:saveReport', async (_event, input: ReportSettingsInput) => {
    requireAuth();
    return saveReportSettings(input);
  });

  ipcMain.handle('settings:selectLogo', async () => {
    requireAuth();
    const result = await dialog.showOpenDialog({
      title: 'Select company logo',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { saved: false, logoPreview: getCompanyLogoDataUrl() };
    }
    saveCompanyLogoFromPath(result.filePaths[0]);
    return { saved: true, logoPreview: getCompanyLogoDataUrl() };
  });

  ipcMain.handle('settings:removeLogo', async () => {
    requireAuth();
    removeCompanyLogo();
  });

  ipcMain.handle('settings:getGitHub', async () => {
    requireAuth();
    return getGitHubSettingsPublic();
  });

  ipcMain.handle('settings:saveGitHub', async (_event, input: GitHubSettingsInput) => {
    requireAuth();
    return saveGitHubSettings(input);
  });

  ipcMain.handle('settings:testGitHub', async () => {
    requireAuth();
    return testGitHubConnection(getGitHubSettings());
  });

  ipcMain.handle('geo:captureCurrentPosition', async () => captureCurrentPosition());
}
