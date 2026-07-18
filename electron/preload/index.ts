import { contextBridge, ipcRenderer } from 'electron';
import type { SitescopApi } from '../../shared/api-types.js';

const BRIDGE_VERSION = 14;

const api: SitescopApi = {
  meta: {
    isDesktop: true,
    version: '6.0.1',
    bridgeVersion: BRIDGE_VERSION,
  },
  app: {
    toggleFullscreen: () => ipcRenderer.invoke('app:toggleFullscreen'),
    exitFullscreen: () => ipcRenderer.invoke('app:exitFullscreen'),
    isFullscreen: () => ipcRenderer.invoke('app:isFullscreen'),
    reload: () => ipcRenderer.invoke('app:reload'),
    quit: () => ipcRenderer.invoke('app:quit'),
    openHelp: () => ipcRenderer.invoke('app:openHelp'),
    openAbout: () => ipcRenderer.invoke('app:openAbout'),
    zoom: (direction) => ipcRenderer.invoke('app:zoom', direction),
    edit: (action) => ipcRenderer.invoke('app:edit', action),
  },
  auth: {
    login: (email, password, remember) =>
      ipcRenderer.invoke('auth:login', email, password, remember),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    requestPasswordReset: (email) => ipcRenderer.invoke('auth:requestPasswordReset', email),
    confirmPasswordReset: (input) => ipcRenderer.invoke('auth:confirmPasswordReset', input),
  },
  dashboard: {
    getSummary: () => ipcRenderer.invoke('dashboard:getSummary'),
    getTodayJobs: () => ipcRenderer.invoke('dashboard:getTodayJobs'),
    startInspection: (jobId) => ipcRenderer.invoke('dashboard:startInspection', jobId),
    completeInspection: (jobId) => ipcRenderer.invoke('dashboard:completeInspection', jobId),
  },
  jobs: {
    create: (input) => ipcRenderer.invoke('jobs:create', input),
    listInProgress: () => ipcRenderer.invoke('jobs:listInProgress'),
    listCompleted: () => ipcRenderer.invoke('jobs:listCompleted'),
    listOutstandingInvoices: () => ipcRenderer.invoke('jobs:listOutstandingInvoices'),
    get: (jobId) => ipcRenderer.invoke('jobs:get', jobId),
    delete: (jobId, input) => ipcRenderer.invoke('jobs:delete', jobId, input),
    start: (jobId) => ipcRenderer.invoke('jobs:start', jobId),
    markPaid: (jobId) => ipcRenderer.invoke('jobs:markPaid', jobId),
    emailClient: (jobId) => ipcRenderer.invoke('jobs:emailClient', jobId),
    emailInvoice: (jobId) => ipcRenderer.invoke('jobs:emailInvoice', jobId),
  },
  inspections: {
    getByJob: (jobId) => ipcRenderer.invoke('inspections:getByJob', jobId),
    updateSection: (inspectionId, input) =>
      ipcRenderer.invoke('inspections:updateSection', inspectionId, input),
    updateRoom: (inspectionId, roomId, input) =>
      ipcRenderer.invoke('inspections:updateRoom', inspectionId, roomId, input),
    complete: (inspectionId) => ipcRenderer.invoke('inspections:complete', inspectionId),
  },
  reports: {
    listForJob: (jobId) => ipcRenderer.invoke('reports:listForJob', jobId),
    generateForJob: (jobId) => ipcRenderer.invoke('reports:generateForJob', jobId),
    openPdf: (filePath) => ipcRenderer.invoke('reports:openPdf', filePath),
    copyPdf: (filePath) => ipcRenderer.invoke('reports:copyPdf', filePath),
    copyPdfs: (filePaths) => ipcRenderer.invoke('reports:copyPdfs', filePaths),
    openFolder: (jobId) => ipcRenderer.invoke('reports:openFolder', jobId),
    emailToClient: (reportId) => ipcRenderer.invoke('reports:emailToClient', reportId),
    emailJobToClient: (jobId) => ipcRenderer.invoke('reports:emailJobToClient', jobId),
  },
  agreements: {
    list: (filter) => ipcRenderer.invoke('agreements:list', filter),
    get: (agreementId) => ipcRenderer.invoke('agreements:get', agreementId),
    create: (input) => ipcRenderer.invoke('agreements:create', input),
    createFromJob: (jobId) => ipcRenderer.invoke('agreements:createFromJob', jobId),
    createRevised: (agreementId) => ipcRenderer.invoke('agreements:createRevised', agreementId),
    createJobFromSigned: (agreementId) =>
      ipcRenderer.invoke('agreements:createJobFromSigned', agreementId),
    update: (agreementId, input) => ipcRenderer.invoke('agreements:update', agreementId, input),
    send: (agreementId) => ipcRenderer.invoke('agreements:send', agreementId),
    getSigningPortalBase: () => ipcRenderer.invoke('agreements:getSigningPortalBase'),
    resolveSigningUrl: (accessToken) => ipcRenderer.invoke('agreements:resolveSigningUrl', accessToken),
    syncFromGitHub: () => ipcRenderer.invoke('agreements:syncFromGitHub'),
    republishToGitHub: (agreementId) => ipcRenderer.invoke('agreements:republishToGitHub', agreementId),
    cancel: (agreementId: string) => ipcRenderer.invoke('agreements:cancel', agreementId),
    delete: (agreementId: string) => ipcRenderer.invoke('agreements:delete', agreementId),
    generatePdf: (agreementId) => ipcRenderer.invoke('agreements:generatePdf', agreementId),
    openPdf: (filePath) => ipcRenderer.invoke('agreements:openPdf', filePath),
    getPublic: (token) => ipcRenderer.invoke('agreements:getPublic', token),
    markViewed: (token) => ipcRenderer.invoke('agreements:markViewed', token),
    sign: (token, input) => ipcRenderer.invoke('agreements:sign', token, input),
    emailSigningLink: (agreementId) => ipcRenderer.invoke('agreements:emailSigningLink', agreementId),
  },
  calendar: {
    listEvents: (startDate, endDate) => ipcRenderer.invoke('calendar:listEvents', startDate, endDate),
    listUpcoming: () => ipcRenderer.invoke('calendar:listUpcoming'),
    reschedule: (jobId, input) => ipcRenderer.invoke('calendar:reschedule', jobId, input),
  },
  accounting: {
    listAwaitingPayment: () => ipcRenderer.invoke('accounting:listAwaitingPayment'),
    listPaid: () => ipcRenderer.invoke('accounting:listPaid'),
    listByClient: () => ipcRenderer.invoke('accounting:listByClient'),
    getSummary: () => ipcRenderer.invoke('accounting:getSummary'),
    pushToXero: (jobId) => ipcRenderer.invoke('accounting:pushToXero', jobId),
    emailPaymentReminder: (jobId) => ipcRenderer.invoke('accounting:emailPaymentReminder', jobId),
    broadcastOffer: (input) => ipcRenderer.invoke('accounting:broadcastOffer', input),
  },
  dataArchive: {
    list: () => ipcRenderer.invoke('dataArchive:list'),
    archiveAll: () => ipcRenderer.invoke('dataArchive:archiveAll'),
    restore: (archiveId) => ipcRenderer.invoke('dataArchive:restore', archiveId),
    openFolder: () => ipcRenderer.invoke('dataArchive:openFolder'),
    requestDeleteUnlock: (loginPassword) =>
      ipcRenderer.invoke('dataArchive:requestDeleteUnlock', loginPassword),
    verifyDeleteUnlock: (code) => ipcRenderer.invoke('dataArchive:verifyDeleteUnlock', code),
    clearDeleteUnlock: () => ipcRenderer.invoke('dataArchive:clearDeleteUnlock'),
  },
  clients: {
    list: (search) => ipcRenderer.invoke('clients:list', search),
    get: (clientId) => ipcRenderer.invoke('clients:get', clientId),
    update: (clientId, input) => ipcRenderer.invoke('clients:update', clientId, input),
    updateAgent: (clientId, input) => ipcRenderer.invoke('clients:updateAgent', clientId, input),
    delete: (clientId) => ipcRenderer.invoke('clients:delete', clientId),
    openAgreementPdf: (agreementId) => ipcRenderer.invoke('clients:openAgreementPdf', agreementId),
    openInvoicePdf: (jobId) => ipcRenderer.invoke('clients:openInvoicePdf', jobId),
    copyAgreementPdf: (agreementId) => ipcRenderer.invoke('clients:copyAgreementPdf', agreementId),
    copyInvoicePdf: (jobId) => ipcRenderer.invoke('clients:copyInvoicePdf', jobId),
    copyAllJobDocuments: (jobId) => ipcRenderer.invoke('clients:copyAllJobDocuments', jobId),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    copyFilesToClipboard: (filePaths) => ipcRenderer.invoke('shell:copyFilesToClipboard', filePaths),
    copyTextToClipboard: (text) => ipcRenderer.invoke('shell:copyTextToClipboard', text),
  },
  geo: {
    captureCurrentPosition: () => ipcRenderer.invoke('geo:captureCurrentPosition'),
  },
  speech: {
    check: () => ipcRenderer.invoke('speech:check'),
    dictate: () => ipcRenderer.invoke('speech:dictate'),
    cancel: () => ipcRenderer.invoke('speech:cancel'),
    transcribeAudio: (base64Wav: string) => ipcRenderer.invoke('speech:transcribeAudio', base64Wav),
    onPhase: (listener: (phase: 'ready') => void) => {
      const wrapper = (_event: Electron.IpcRendererEvent, payload: { phase?: string }) => {
        if (payload?.phase === 'ready') listener('ready');
      };
      ipcRenderer.on('speech:phase', wrapper);
      return () => {
        ipcRenderer.removeListener('speech:phase', wrapper);
      };
    },
  },
  settings: {
    getProfile: () => ipcRenderer.invoke('settings:getProfile'),
    saveProfile: (input) => ipcRenderer.invoke('settings:saveProfile', input),
    changePassword: (input) => ipcRenderer.invoke('settings:changePassword', input),
    getApp: () => ipcRenderer.invoke('settings:getApp'),
    saveCompany: (input) => ipcRenderer.invoke('settings:saveCompany', input),
    saveReport: (input) => ipcRenderer.invoke('settings:saveReport', input),
    saveBilling: (input) => ipcRenderer.invoke('settings:saveBilling', input),
    saveEmail: (input) => ipcRenderer.invoke('settings:saveEmail', input),
    saveReminders: (input) => ipcRenderer.invoke('settings:saveReminders', input),
    runRemindersNow: () => ipcRenderer.invoke('settings:runRemindersNow'),
    testSmtp: (toEmail) => ipcRenderer.invoke('settings:testSmtp', toEmail),
    selectLogo: () => ipcRenderer.invoke('settings:selectLogo'),
    removeLogo: () => ipcRenderer.invoke('settings:removeLogo'),
    getGitHub: () => ipcRenderer.invoke('settings:getGitHub'),
    saveGitHub: (input) => ipcRenderer.invoke('settings:saveGitHub', input),
    testGitHub: () => ipcRenderer.invoke('settings:testGitHub'),
    ensurePublicRelay: () => ipcRenderer.invoke('settings:ensurePublicRelay'),
    getCloudStorage: () => ipcRenderer.invoke('settings:getCloudStorage'),
    saveCloudStorage: (input) => ipcRenderer.invoke('settings:saveCloudStorage', input),
    testCloudStorage: () => ipcRenderer.invoke('settings:testCloudStorage'),
    getXero: () => ipcRenderer.invoke('settings:getXero'),
    saveXero: (input) => ipcRenderer.invoke('settings:saveXero', input),
    connectXero: () => ipcRenderer.invoke('settings:connectXero'),
    disconnectXero: () => ipcRenderer.invoke('settings:disconnectXero'),
  },
  recycleBin: {
    list: () => ipcRenderer.invoke('recycleBin:list'),
    restore: (type, id) => ipcRenderer.invoke('recycleBin:restore', type, id),
    purge: (type, id) => ipcRenderer.invoke('recycleBin:purge', type, id),
  },
};

contextBridge.exposeInMainWorld('sitescop', api);
