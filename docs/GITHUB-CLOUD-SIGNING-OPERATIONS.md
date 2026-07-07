# GitHub Cloud Signing — Operations Guide

**SiteScop V6 · Phase complete · July 2026**

This guide is the day-to-day reference for inspectors using GitHub Cloud Signing. It assumes the V6 frozen architecture: GitHub Pages for the client portal, desktop PAT custody, and a local signing relay on the inspector PC.

---

## What was delivered

| Component | Location | Status |
|-----------|----------|--------|
| Desktop app (Electron) | `sitescop-v6` | Production build verified |
| GitHub cloud repo | [sitescop/sitescop-cloud-signing](https://github.com/sitescop/sitescop-cloud-signing) | Live on GitHub Pages |
| Client signing portal | `docs/sign/` in cloud repo | Accordion UI, progress steps, mobile-friendly |
| Settings + Test Connection | SiteScop → Settings → GitHub Cloud Signing | Repo, branch, write test, Pages check |
| Security documentation | Cloud repo + this folder | PAT never in browser |
| Windows installer | `release/SiteScop V6 Setup 6.0.0.exe` | Built and ready to install |

**End-to-end validation:** Client loads agreement from Pages → signs on same Wi‑Fi → desktop records VIEWED/SIGNED → JSON mirrored to GitHub. Confirmed working.

---

## Quick reference — Settings values

Open **Settings → GitHub Cloud Signing**:

| Field | Value |
|-------|-------|
| Enable | ✓ On |
| Owner | `sitescop` |
| Repository | `sitescop-cloud-signing` |
| Branch | `main` |
| Pages URL | `https://sitescop.github.io/sitescop-cloud-signing/sign/` |
| Public Relay URL | *(leave empty — reserved for future hosted API)* |
| PAT | Fine-grained token, **Contents read/write** on this repo only |

After changing settings: **Test Connection** → **Save Settings**.

The PAT is stored encrypted on your PC. It never appears in the GitHub repo or the client browser.

---

## Daily workflow (inspector)

1. **Open SiteScop** on your PC (dev: `START-SITESCOP.bat` or `npm run dev`; production: installed app from Desktop/Start Menu).
2. **Create or open an agreement** → review details and legal sections.
3. **Send** → copy the signing link (format: `https://sitescop.github.io/sitescop-cloud-signing/sign/?token=…`).
4. **Send the link to the client** (SMS, email, etc.).
5. **Keep SiteScop open** while the client signs — the desktop runs the signing relay on port `38765`.
6. **Same Wi‑Fi required** — client phone/tablet must be on the same network as your PC (not mobile data alone).
7. **Status updates** — agreement moves to VIEWED then SIGNED (GitHub sync polls every ~60 seconds).
8. **Generate signed PDF** from the agreement detail page when status is SIGNED.

---

## Client experience

The client opens your link on their phone or tablet:

1. Agreement hero card with property and client details
2. Progress bar: Read Agreement → Terms → Privacy → Signature
3. Accordion legal sections (tap section body to expand/collapse)
4. Draw signature, accept declarations, **Sign and submit**
5. Success screen when the desktop relay accepts the signature

No login required for the client. The URL token is the capability to sign that one agreement.

---

## Health checks

Replace `<LAN-IP>` with your PC’s local IP (`ipconfig` on Windows, or shown in SiteScop when sending).

| Check | URL | Expected |
|-------|-----|----------|
| Signing portal | `https://sitescop.github.io/sitescop-cloud-signing/sign/` | SiteScop signing page loads |
| Desktop relay | `http://<LAN-IP>:38765/health` | `{"ok":true,...}` |
| Pending agreement | `https://raw.githubusercontent.com/sitescop/sitescop-cloud-signing/main/agreements/pending/<token>.json` | JSON with `publicView` and `submitEndpoints.lan` |

In SiteScop: **Settings → GitHub Cloud Signing → Test Connection** validates repo access, branch, write to `agreements/pending/`, and Pages URL reachability in one step.

---

## Troubleshooting

### Client sees “Missing config.js” or blank page

- Wait 1–2 minutes after a GitHub push — Pages deploy is not instant.
- Confirm [config.js](https://github.com/sitescop/sitescop-cloud-signing/blob/main/docs/sign/config.js) exists on `main` (owner/repo/branch only, no secrets).

### Signing fails / network error

- SiteScop must be **running** on the inspector PC.
- Client must be on **same Wi‑Fi** as the PC.
- Test `http://<LAN-IP>:38765/health` from the client’s browser.
- If your PC IP changed, **re-send** the agreement so pending JSON gets the new `submitEndpoints.lan` address.

### Status stuck at SENT

- Wait up to 60 seconds for GitHub sync.
- Open agreement detail — pending agreements auto-republish to GitHub when opened.
- Check GitHub repo for `agreements/viewed/` and `agreements/signed/` after client action.

### Test Connection fails

| Message | Action |
|---------|--------|
| 401 / Bad credentials | Regenerate PAT; ensure Contents read/write on `sitescop-cloud-signing` |
| 404 repo | Check owner and repository name spelling |
| Branch error | Confirm default branch is `main` |
| Pages URL unreachable | Enable Pages: repo Settings → Pages → branch `main`, folder `/docs` |
| Write test failed | PAT needs write access to `agreements/pending/` |

### Empty Privacy Policy on old agreements

Re-open the agreement in SiteScop (SENT/VIEWED) to trigger republish, or create a new test send. Building privacy HTML was fixed in V6; legacy pending JSON may need one republish.

---

## Security (accepted for this phase)

- Pending agreement JSON is **public** on GitHub (by design for Pages + raw URL reads).
- Signing URL token is a **capability link** — treat links like passwords until signed or revoked.
- PAT stays **desktop-only**, encrypted in local settings.
- LAN relay accepts POSTs from devices on your local network.

Full detail: [SECURITY-LIMITATIONS.md](https://github.com/sitescop/sitescop-cloud-signing/blob/main/docs/SECURITY-LIMITATIONS.md)

Future hosted API (no same-Wi‑Fi requirement): [GITHUB-CLOUD-SIGNING-FUTURE-IMPROVEMENTS.md](./GITHUB-CLOUD-SIGNING-FUTURE-IMPROVEMENTS.md)

---

## Production install

For daily use, install the Windows app instead of running `npm run dev`:

```bash
cd sitescop-v6
npm run build:installer
```

Installer output:

```
sitescop-v6/release/SiteScop V6 Setup 6.0.0.exe
```

Double-click to install → Desktop and Start Menu shortcuts → log in → configure GitHub Cloud Signing once in Settings.

See also: [INSTALL.md](./INSTALL.md)

---

## Repository map

| Repo | Purpose |
|------|---------|
| **sitescop-v6** (local) | Desktop app, legal HTML templates, portal source copy in `docs/sign/` |
| **sitescop-cloud-signing** (GitHub) | Deployed portal, agreement JSON storage, Pages hosting |

Portal changes: edit in either repo’s `docs/sign/`, then commit and push **cloud repo** so GitHub Pages updates. Keep both copies in sync when making UI changes.

---

## Phase sign-off checklist

Use this to confirm production readiness:

- [x] GitHub Pages live at signing URL
- [x] `config.js` public only (no PAT in repo or browser)
- [x] SiteScop Settings: Test Connection passes
- [x] Send agreement → pending JSON on GitHub
- [x] Client signs on same Wi‑Fi → success screen
- [x] Desktop VIEWED / SIGNED status + signed JSON on GitHub
- [x] Privacy policy renders for building agreements
- [x] Windows installer builds successfully
- [ ] Install production `.exe` on inspector PC *(your step)*
- [ ] Store PAT securely; rotate if ever exposed

**Phase status: Complete for V6 GitHub Cloud Signing (same-Wi‑Fi architecture).**

Deferred by design: public relay URL, Cloudflare Tunnel, hosted signing API — see Future Improvements doc.

---

## Related documents

| Document | Where |
|----------|-------|
| E2E test checklist | [sitescop-cloud-signing/docs/E2E-TEST.md](https://github.com/sitescop/sitescop-cloud-signing/blob/main/docs/E2E-TEST.md) |
| Security limitations | [sitescop-cloud-signing/docs/SECURITY-LIMITATIONS.md](https://github.com/sitescop/sitescop-cloud-signing/blob/main/docs/SECURITY-LIMITATIONS.md) |
| Future hosted API | [GITHUB-CLOUD-SIGNING-FUTURE-IMPROVEMENTS.md](./GITHUB-CLOUD-SIGNING-FUTURE-IMPROVEMENTS.md) |
| Windows install | [INSTALL.md](./INSTALL.md) |
