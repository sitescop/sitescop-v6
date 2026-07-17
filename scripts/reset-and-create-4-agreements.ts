/**
 * Wipe all jobs/agreements/clients (test data) and create 4 DRAFT agreements
 * with the 4 real emails, ready to send from the SiteScop UI.
 * Run with SiteScop CLOSED:
 *   npx tsx --import ./scripts/register-electron-mock.mjs scripts/reset-and-create-4-agreements.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const userData = join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(
  process.cwd(),
  'node_modules',
);

const BATCH = [
  {
    clientName: 'James Mitchell',
    email: 'afshinsobbi@gmail.com',
    phone: '0412 300 101',
    address: '14 Harbour View Rd, Manly NSW 2095',
    inspectionType: 'COMBINED' as const,
    withAgent: true,
  },
  {
    clientName: 'Sarah Nguyen',
    email: 'af_sh63@yahoo.com',
    phone: '0423 811 204',
    address: '88 Queen St, Brisbane QLD 4000',
    inspectionType: 'BUILDING' as const,
    withAgent: false,
  },
  {
    clientName: 'David Chen',
    email: 't.ltechno@yahoo.com',
    phone: '0435 622 318',
    address: '3 Oak Avenue, Glen Waverley VIC 3150',
    inspectionType: 'COMBINED' as const,
    withAgent: true,
  },
  {
    clientName: 'Emily Roberts',
    email: 'info@sitescop.com.au',
    phone: '0448 190 427',
    address: '221 Coastal Pde, Bondi NSW 2026',
    inspectionType: 'BUILDING' as const,
    withAgent: false,
  },
];

async function main() {
  const dbPath = join(userData, 'sitescop-v6.db');
  if (!existsSync(dbPath)) throw new Error(`DB not found: ${dbPath}`);

  const { openDatabase } = await import('../electron/main/database.js');
  const { createAgreement } = await import('../electron/main/agreements.service.js');

  const store = await openDatabase(dbPath);

  console.log('=== Before wipe ===');
  for (const table of ['jobs', 'inspections', 'inspection_rooms', 'inspection_reports', 'agreements', 'clients']) {
    const n = store.db.exec(`SELECT COUNT(*) FROM ${table}`)[0]?.values?.[0]?.[0];
    console.log(`${table}: ${n}`);
  }

  store.db.run('BEGIN TRANSACTION');
  try {
    store.db.run('DELETE FROM inspection_rooms');
    store.db.run('DELETE FROM inspection_reports');
    store.db.run('DELETE FROM inspections');
    store.db.run('DELETE FROM agreements');
    store.db.run('DELETE FROM jobs');
    store.db.run('DELETE FROM clients');
    store.db.run('COMMIT');
  } catch (error) {
    store.db.run('ROLLBACK');
    throw error;
  }

  console.log('\nAll jobs, inspections, reports, agreements and clients removed.');

  console.log('\n=== Creating 4 draft agreements ===');
  for (const row of BATCH) {
    const created = createAgreement(store.db, {
      inspectionType: row.inspectionType,
      clientName: row.clientName,
      clientEmail: row.email,
      clientPhone: row.phone,
      propertyAddress: row.address,
      ...(row.withAgent
        ? {
            signerRole: 'AGENT' as const,
            agencyName: 'Harbour Realty Group',
            agentName: 'Alex Agent',
            agentEmail: row.email,
          }
        : { signerRole: 'CLIENT' as const }),
    });
    console.log(
      `${created.agreementNumber} | ${row.clientName} | ${row.email} | ${row.inspectionType} | agent=${row.withAgent} | $${(created.totalCents / 100).toFixed(2)}`,
    );
  }

  store.persist();
  console.log('\nDone. Open SiteScop -> Agreements and use "Send to client" on each.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
