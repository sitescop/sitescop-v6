# SiteScop V6 — Install on your device

When V6 is complete, you install it like normal software — **not** from GitHub in a browser.

---

## Windows PC (desktop / laptop) — recommended now

This is the **main V6 app** (Electron). One-time install, then open from Desktop or Start Menu.

### Build the installer (developer / you)

```bash
cd sitescop-v6
npm install
npm run build:installer
```

Output folder:

```
sitescop-v6/release/
  SiteScop V6 Setup 6.0.0.exe   ← give this file to install
```

### Install on your PC (click install)

1. Double-click **`SiteScop V6 Setup 6.0.0.exe`**
2. Click **Next** → choose folder (or keep default)
3. Click **Install**
4. Finish — **SiteScop V6** icon appears on **Desktop** and **Start Menu**
5. Open the app → log in → your data stays on this PC

### Uninstall

Windows **Settings → Apps → SiteScop V6 → Uninstall**

---

## Tablet & mobile — planned (same app experience)

V6 is being built so the **same screens** work on tablet and phone. Install method depends on device:

| Device | Install method (when we ship it) |
|--------|----------------------------------|
| **Android tablet / phone** | Install `.apk` or **Add to Home screen** (PWA) — tap **Install app** in Chrome |
| **iPad / iPhone** | **Add to Home Screen** from Safari, or App Store build (later) |
| **Windows tablet** | Same as PC — **SiteScop V6 Setup.exe** |

We will add an **“Install app”** prompt inside the app when the browser/device supports it (PWA), plus native Android packaging if you want a Play Store–style install.

---

## GitHub Cloud Signing (client agreements)

The **desktop app** is installed locally. **Clients** sign agreements in their browser via GitHub Pages — that is separate from this installer.

| What | Where |
|------|-------|
| Inspector app | This installer (`SiteScop V6 Setup 6.0.0.exe`) |
| Client signing page | [sitescop.github.io/sitescop-cloud-signing/sign/](https://sitescop.github.io/sitescop-cloud-signing/sign/) |
| One-time setup | SiteScop → **Settings → GitHub Cloud Signing** (PAT, Test Connection, Save) |

Full operator guide: [GITHUB-CLOUD-SIGNING-OPERATIONS.md](./GITHUB-CLOUD-SIGNING-OPERATIONS.md)

---

## Important

| | |
|---|---|
| **Desktop app** | Installs on your PC — not opened from GitHub in a browser |
| **Internet** | Core inspections work offline; GitHub signing needs internet + same Wi‑Fi for client |
| **One inspector** | Single login on each installed device |
| **Updates** | New version = run new installer (auto-update can be added later) |

---

## Recorded for V6 delivery

- [x] Windows desktop installer (NSIS `.exe`, desktop shortcut)
- [x] GitHub Cloud Signing (portal live, desktop integration, E2E validated)
- [ ] Android install (APK / PWA “Install app”)
- [ ] iOS Add to Home Screen / App Store (later phase)
- [ ] In-app **Install** button when running as PWA in browser
