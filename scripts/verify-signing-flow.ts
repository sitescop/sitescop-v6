/**
 * Phase 2 automated verification — run: npx tsx scripts/verify-signing-flow.ts
 * Uses an isolated temp database; does not touch production userData.
 */
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

const verifyUserData = mkdtempSync(join(tmpdir(), 'sitescop-verify-app-'));
process.env.SITESCOP_VERIFY_USERDATA = verifyUserData;
mkdirSync(join(verifyUserData, 'agreements'), { recursive: true });
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(
  process.cwd(),
  'node_modules',
);

const { openDatabase } = await import('../electron/main/database.js');
const { seedDatabase } = await import('../electron/main/seed.js');
const {
  createAgreement,
  getAgreement,
  getPublicAgreement,
  sendAgreement,
  signAgreement,
} = await import('../electron/main/agreements.service.js');
const {
  getActiveSigningUrl,
  syncSignedAgreementsFromGitHub,
} = await import('../electron/main/github-agreements.service.js');
const { isGitHubSigningConfigured } = await import('../electron/main/settings.service.js');
const { startSigningServer, stopSigningServer } = await import('../electron/main/signing-server.js');

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'sitescop-verify-'));
  const dbPath = join(dir, 'test.db');
  let passed = 0;
  let failed = 0;

  function ok(label: string) {
    passed += 1;
    console.log(`  OK  ${label}`);
  }

  function fail(label: string, error: unknown) {
    failed += 1;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(` FAIL ${label}: ${msg}`);
  }

  console.log('\n=== Phase 2: Agreement & signing flow verification ===\n');

  try {
    const store = await openDatabase(dbPath);
    await seedDatabase(store.db);
    store.persist();

    // Create agreement
    let agreementId: string;
    try {
      const created = createAgreement(store.db, {
        inspectionType: 'BUILDING',
        clientName: 'Verify Test Client',
        clientEmail: 'verify@test.com',
        propertyAddress: '1 Test Street, Brisbane QLD',
        priceCents: 55000,
      });
      agreementId = created.id;
      if (created.status !== 'DRAFT') throw new Error(`Expected DRAFT, got ${created.status}`);
      ok('Create agreement');
    } catch (e) {
      fail('Create agreement', e);
      throw e;
    }

    // Send agreement (local mode — GitHub disabled in temp env)
    let accessToken: string;
    try {
      if (isGitHubSigningConfigured()) {
        console.log('  WARN GitHub is configured on this machine — local-only URL test may use GitHub mode');
      }
      const sent = sendAgreement(store.db, agreementId);
      store.persist();
      accessToken = sent.accessToken;
      const active = getActiveSigningUrl(sent.accessToken);
      if (!sent.accessToken) throw new Error('Missing access token');
      if (!active.url) throw new Error('Missing signing URL');
      ok(`Send agreement (mode=${active.mode}, url starts with ${active.url.slice(0, 30)}…)`);
    } catch (e) {
      fail('Send agreement', e);
      throw e;
    }

    // Public view
    try {
      const pub = getPublicAgreement(store.db, accessToken);
      if (!pub) throw new Error('getPublicAgreement returned null');
      if (!pub.canSign) throw new Error('Expected canSign=true for SENT agreement');
      ok('Public agreement view');
    } catch (e) {
      fail('Public agreement view', e);
    }

    // Local signing server
    try {
      await startSigningServer(() => store);
      const health = await fetch('http://127.0.0.1:38765/health');
      if (!health.ok) throw new Error(`Health check ${health.status}`);
      const api = await fetch(`http://127.0.0.1:38765/api/sign/${accessToken}`);
      if (!api.ok) throw new Error(`API sign GET ${api.status}`);
      ok('Local signing server health + GET /api/sign/:token');
      stopSigningServer();
    } catch (e) {
      fail('Local signing server', e);
      stopSigningServer();
    }

    // Sign locally (simulates client submit via IPC)
    try {
      await signAgreement(store.db, accessToken, {
        signatureName: 'Verify Test Client',
        signatureData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        declarationsAccepted: true,
      });
      store.persist();
      const signed = getAgreement(store.db, agreementId);
      if (signed?.status !== 'SIGNED') throw new Error(`Expected SIGNED, got ${signed?.status}`);
      if (!signed.pdfPath || !existsSync(signed.pdfPath)) throw new Error('PDF not generated');
      ok('Sign agreement + PDF generation');
    } catch (e) {
      fail('Sign agreement + PDF generation', e);
    }

    // GitHub sync (no config — should no-op safely)
    try {
      const sync = await syncSignedAgreementsFromGitHub(store.db);
      if (sync.failed && sync.errors.length) {
        throw new Error(sync.errors.join('; '));
      }
      ok('GitHub sync no-op when disabled');
    } catch (e) {
      fail('GitHub sync no-op when disabled', e);
    }
  } finally {
    try {
      stopSigningServer();
    } catch {
      // ignore
    }
    rmSync(dir, { recursive: true, force: true });
    rmSync(verifyUserData, { recursive: true, force: true });
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
