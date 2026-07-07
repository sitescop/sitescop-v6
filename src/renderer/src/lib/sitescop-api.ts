import type { SitescopApi } from '@shared/api-types';

export const CURRENT_BRIDGE_VERSION = 2;

/** True when running inside the Electron desktop window (not Chrome/Edge). */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.sitescop?.meta?.isDesktop) return true;
  return /Electron/i.test(navigator.userAgent);
}

/** True when someone opened localhost in a normal browser tab. */
export function isBrowserOnly(): boolean {
  return !isDesktopApp();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireDesktopBridge(): SitescopApi {
  if (isBrowserOnly()) {
    throw new Error(
      'You opened SiteScop in Chrome or Edge. Close this browser tab. Double-click START-SITESCOP.bat instead.',
    );
  }

  const api = window.sitescop;
  if (!api?.meta?.isDesktop) {
    throw new Error(
      'SiteScop desktop bridge not loaded. Close ALL SiteScop windows, then double-click START-SITESCOP.bat.',
    );
  }

  return api;
}

function hasAuthBridge(api: SitescopApi | undefined): api is SitescopApi {
  return Boolean(api?.meta?.isDesktop && typeof api.auth?.login === 'function');
}

/** Wait for the preload bridge (up to ~5 seconds). */
export async function waitForSitescopApi(maxMs = 5000): Promise<SitescopApi | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (hasAuthBridge(window.sitescop)) {
      return window.sitescop;
    }
    await sleep(100);
  }
  return hasAuthBridge(window.sitescop) ? window.sitescop : null;
}

/** Core desktop API — does not require optional modules like Recycle Bin. */
export function getSitescopApi(): SitescopApi {
  return requireDesktopBridge();
}

export function getSettingsApi(): SitescopApi['settings'] {
  const api = requireDesktopBridge();
  if (!api.settings?.getProfile) {
    throw new Error(
      'Settings not loaded. Close ALL SiteScop windows, then double-click START-SITESCOP.bat.',
    );
  }
  return api.settings;
}

export function getRecycleBinApi(): SitescopApi['recycleBin'] {
  const api = requireDesktopBridge();
  if (!api.recycleBin?.list) {
    throw new Error(
      'Recycle Bin not loaded. Close ALL SiteScop windows, then double-click START-SITESCOP.bat.',
    );
  }
  return api.recycleBin;
}

export function hasRecycleBinApi(): boolean {
  return Boolean(window.sitescop?.recycleBin?.list);
}

export function hasClientsApi(): boolean {
  return Boolean(window.sitescop?.clients?.list);
}

export function getClientsApi(): SitescopApi['clients'] {
  const api = requireDesktopBridge();
  if (!api.clients?.list) {
    throw new Error(
      'Clients not loaded. Close ALL SiteScop windows, then double-click START-SITESCOP.bat.',
    );
  }
  return api.clients;
}

export function isBridgeUpToDate(): boolean {
  const version = window.sitescop?.meta?.bridgeVersion ?? 1;
  return version >= CURRENT_BRIDGE_VERSION && hasRecycleBinApi() && hasClientsApi();
}

export function getStaleBridgeFeatures(): string[] {
  const missing: string[] = [];
  if (!hasRecycleBinApi()) missing.push('Recycle Bin');
  if (!hasClientsApi()) missing.push('Clients');
  if (!window.sitescop?.settings?.getProfile) missing.push('Settings');
  return missing;
}
