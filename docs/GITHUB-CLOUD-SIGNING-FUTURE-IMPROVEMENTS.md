# GitHub Cloud Signing — Future Improvements

This document describes how SiteScop could migrate from the **V6 frozen architecture** (GitHub Pages + desktop relay) to a **production-grade hosted signing backend** in a later version — **without changing the inspector desktop UI or day-to-day workflow**.

## Current workflow (frozen in V6)

```
Inspector (SiteScop desktop)
  → uploads pending JSON to GitHub (PAT on desktop)
  → sends client a GitHub Pages link

Client browser
  → reads pending JSON from raw.githubusercontent.com (public)
  → POSTs signature to desktop LAN relay (:38765)

SiteScop desktop
  → stores signature locally
  → mirrors signed/viewed JSON to GitHub (PAT)
  → polls GitHub every 60s for sync
```

The inspector experience: **Create agreement → Send → Copy link → Client signs → Status updates → PDF**. That sequence should remain identical after migration.

## Target workflow (future version)

```
Inspector (SiteScop desktop)          Hosted Signing API (new)
  → POST /agreements (authenticated)  → stores pending record + issues token
  → receives signing URL              → serves signing page OR same Pages URL
                                      → accepts signature POST (authenticated server-side)
  → GET /agreements/:id/sync          → returns signed payload
  → or webhook push                   → notifies desktop immediately
```

The **client** still opens a URL and signs in the browser. The **inspector** still uses Agreement detail, Send, and status badges. Only the **transport and secret custody** move to a server.

## Design principles for migration

1. **Preserve IPC and UI contracts** — Keep `agreements:send`, `resolveSigningUrl`, `syncFromGitHub` (or rename internally) returning the same shapes to the renderer.
2. **Adapter pattern** — Introduce `SigningBackend` interface in the Electron main process:

   ```typescript
   interface SigningBackend {
     isConfigured(): boolean;
     uploadPending(agreementId: string): Promise<void>;
     resolveSigningUrl(token: string): string;
     syncInbound(): Promise<SyncResult>;
   }
   ```

   V6: `GitHubPagesDesktopRelayBackend`  
   Future: `SiteScopHostedApiBackend`

3. **Settings abstraction** — Replace GitHub-specific fields with a backend selector:

   - `signingBackend: 'github-v6' | 'sitescop-cloud'`
   - Backend-specific config blocks remain in settings JSON

4. **No renderer changes** — `AgreementDetailPage`, `AgreementCloudSigningStatus`, and Settings tabs call the same API; main process routes to the active backend.

## Hosted API — suggested capabilities

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/agreements/pending` | Desktop uploads agreement snapshot; returns `token` + public `signingUrl` |
| `GET /v1/sign/:token` | Client loads agreement (replaces raw GitHub read) |
| `POST /v1/sign/:token` | Client submits signature (replaces desktop relay) |
| `POST /v1/sign/:token/viewed` | Mark viewed |
| `GET /v1/agreements/sync?since=` | Desktop pulls signed/viewed events |
| `POST /v1/agreements/:id/revoke` | Invalidate token |

**Authentication:**

- Desktop: OAuth device flow, API key per organisation, or mTLS — stored encrypted like today's PAT.
- Client: Short-lived signing token in URL (same as today); optional SMS/email OTP for high assurance.

**Storage:** PostgreSQL or equivalent; PDF/signature blobs in object storage. GitHub repo optional as archive/export only.

## GitHub Pages — options after migration

**Option A — Retire Pages for signing**  
Hosted API serves the signing SPA (same `app.js` assets, different config pointing to API base URL). GitHub repo becomes unnecessary for runtime.

**Option B — Keep Pages as CDN shell**  
Pages loads static UI; `config.js` points to `apiBaseUrl: 'https://signing.sitescop.com.au'` instead of GitHub raw URLs. No PAT, no desktop relay.

**Option C — Hybrid transition**  
Feature flag per organisation: existing customers stay on GitHub V6 backend until migrated.

## Security improvements a hosted backend enables

| Limitation (V6) | Hosted API remedy |
|-----------------|-------------------|
| Public pending JSON in GitHub repo | Server-side auth; pending data not world-readable |
| Same Wi‑Fi required | HTTPS API reachable from mobile data |
| LAN relay CORS `*` | Server validates token + rate limits + optional OTP |
| 60s poll latency | Webhooks or WebSocket push to desktop |
| PAT on desktop for GitHub writes | API keys scoped to org; server holds GitHub/export credentials if needed |

## Desktop sync evolution

**V6:** Timer polling GitHub `agreements/signed/`.

**Future:**

1. **Push:** Webhook from API → desktop (requires reachable endpoint or persistent connection via Firebase/Ably).
2. **Pull:** Desktop polls API every N seconds (drop-in replacement for GitHub poll).
3. **Hybrid:** Pull on app focus + push for instant update.

Minimal change path: replace `syncSignedAgreementsFromGitHub()` body with `syncSignedAgreementsFromApi()` using the same return type `GitHubSyncResult` / renamed `SigningSyncResult`.

## Migration checklist (future project)

1. Implement `SigningBackend` interface; wire V6 GitHub implementation behind it (no behaviour change).
2. Build hosted API with parity endpoints and signing SPA config.
3. Add Settings backend selector defaulting to `github-v6`.
4. Dual-run testing: same agreement flow against both backends.
5. Document customer migration: export pending tokens, cutover window, revoke GitHub PAT if retiring repo model.
6. Deprecate desktop LAN relay when all clients use hosted API (relay remains for offline/local-only mode).

## Explicit non-goals for V6

The following are **out of scope** for the current frozen release:

- Cloudflare Tunnel or other reverse-proxy setup
- New infrastructure provisioning
- Replacing GitHub Pages before workflow validation
- UI redesign of Agreements or Settings

These items belong to the post-validation production backend phase described above.

## Related documents

- [Security limitations](../sitescop-cloud-signing/docs/SECURITY-LIMITATIONS.md) (cloud signing repo)
- [E2E test checklist](../sitescop-cloud-signing/docs/E2E-TEST.md)
