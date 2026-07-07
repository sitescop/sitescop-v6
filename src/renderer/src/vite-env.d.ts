/// <reference types="vite/client" />

import type { SitescopApi } from '@shared/api-types';

declare global {
  interface Window {
    sitescop: SitescopApi;
  }
}

export {};
