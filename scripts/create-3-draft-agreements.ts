/**
 * Create 3 DRAFT agreements for SiteScop V6 testing (does not wipe existing data).
 * Prefer SiteScop CLOSED:
 *   npx tsx --import ./scripts/register-electron-mock.mjs scripts/create-3-draft-agreements.ts
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
    clientName: 'Test Draft One',
    email: 'afshinsobbi@gmail.com',
    phone: '0411 100 001',
    address: '10 Draft St, Sydney NSW 2000',
    inspectionType: 'BUILDING' as const,
    withAgent: false,
  },
  {
    clientName: 'Test Draft Two',
    email: 'info@sitescop.com.au',
    phone: '0411 100 002',
    address: '22 Sample Ave, Parramatta NSW 2150',
    inspectionType: 'PEST' as const,
    withAgent: false,
  },
  {
    clientName: 'Test Draft Three',
    email: 't.ltechno@yahoo.com',
    phone: '0411 100 003',
    address: '45 Trial Rd, Newcastle NSW 2300',
    inspectionType: 'COMBINED' as const,
    withAgent: true,
  },
];

async function main() {
  const dbPath = join(userData, 'sitescop-v6.db');
  if (!existsSync(dbPath)) throw new Error(`DB not found: ${dbPath}`);

  const { openDatabase } = await import('../electron/main/database.js');
  const { createAgreement } = await import('../electron/main/agreements.service.js');

  const store = await openDatabase(dbPath);

  console.log('=== Creating 3 draft agreements ===');
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
            agencyName: 'Test Agency Realty',
            agentName: 'Test Agent',
            agentEmail: row.email,
          }
        : { signerRole: 'CLIENT' as const }),
    });
    console.log(
      `${created.agreementNumber} | ${created.clientName} | ${row.email} | ${row.inspectionType} | ${created.status} | $${(created.totalCents / 100).toFixed(2)}`,
    );
  }

  store.persist();
  console.log('\nDone. Open SiteScop → Agreements (Draft).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
