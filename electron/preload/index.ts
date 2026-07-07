import { contextBridge, ipcRenderer } from 'electron';
import type { SitescopApi } from '../../shared/api-types.js';

const BRIDGE_VERSION = 3;

const api: SitescopApi = {
  meta: {
    isDesktop: true,
    version: '6.0.1',
    bridgeVersion: BRIDGE_VERSION,
  },
  auth: {
    login: (email, password, remember) =>
      ipcRenderer.invoke('auth:login', email, password, remember),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
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
    emailClient: (jobId) => ipcRenderer.invoke('jobs:emailClient', jobId),
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
    openFolder: (jobId) => ipcRenderer.invoke('reports:openFolder', jobId),
    emailToClient: (reportId) => ipcRenderer.invoke('reports:emailToClient', reportId),
  },
  agreements: {
    list: (filter) => ipcRenderer.invoke('agreements:list', filter),
    get: (agreementId) => ipcRenderer.invoke('agreements:get', agreementId),
    create: (input) => ipcRenderer.invoke('agreements:create', input),
    createFromJob: (jobId) => ipcRenderer.invoke('agreements:createFromJob', jobId),
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
  },
  calendar: {
    listEvents: (startDate, endDate) => ipcRenderer.invoke('calendar:listEvents', startDate, endDate),
    listUpcoming: () => ipcRenderer.invoke('calendar:listUpcoming'),
    reschedule: (jobId, input) => ipcRenderer.invoke('calendar:reschedule', jobId, input),
  },
  clients: {
    list: (search) => ipcRenderer.invoke('clients:list', search),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
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
    selectLogo: () => ipcRenderer.invoke('settings:selectLogo'),
    removeLogo: () => ipcRenderer.invoke('settings:removeLogo'),
    getGitHub: () => ipcRenderer.invoke('settings:getGitHub'),
    saveGitHub: (input) => ipcRenderer.invoke('settings:saveGitHub', input),
    testGitHub: () => ipcRenderer.invoke('settings:testGitHub'),
  },
  recycleBin: {
    list: () => ipcRenderer.invoke('recycleBin:list'),
    restore: (type, id) => ipcRenderer.invoke('recycleBin:restore', type, id),
    purge: (type, id) => ipcRenderer.invoke('recycleBin:purge', type, id),
  },
};

contextBridge.exposeInMainWorld('sitescop', api);
