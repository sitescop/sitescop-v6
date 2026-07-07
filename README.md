# SiteScop V6

Local Building & Pest Inspection Platform — single inspector, offline-first.

## IMPORTANT — how to start (Windows)

**Do NOT open Chrome or Edge.** SiteScop will not work in a browser.

### Easiest way

1. Go to the `sitescop-v6` folder
2. **Double-click `START-SITESCOP.bat`**
3. Wait for the window titled **SiteScop V6 — Desktop App**
4. Log in and use the app

The desktop window has a menu bar: **File · View · Help**. Press **F12** there for developer tools.

### Manual way (terminal)

```bash
cd "c:\Users\USER\Desktop\app to develop\sitescop-v6"
npm install
npm run build
npm run dev
```

## Login (first run)

| Email | Password |
|-------|----------|
| `inspector@sitescop.com.au` | `SiteScop2026!` |

Data is stored locally in SQLite on your device.

## Stack

- Electron + React + Vite + Tailwind
- SQLite (sql.js) — local file on your device

## Current build

- Secure login
- Dashboard with 6 summary cards + Today's Jobs
- **New Job** — full form, auto job number, client + inspection records
- **In Progress** — list with open, maps, call, email, delete
- **Job detail** — view job, start inspection
- **Inspection workspace** — V5 Building / Pest / Combined forms, auto-save locally, rooms, signature

## Next phases

- PDF reports (reuse V5 report generator)
- Agreements & e-sign
- Calendar, invoices, completed jobs

See **[docs/INSTALL.md](./docs/INSTALL.md)** — builds `SiteScop V6 Setup.exe` with desktop shortcut.

```bash
npm run build:installer
```

Find the installer in the `release/` folder. Double-click to install.

Tablet/mobile install (Add to Home Screen / app package) is planned for a later phase.
