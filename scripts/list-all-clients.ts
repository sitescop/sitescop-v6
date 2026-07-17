import { join } from 'node:path';

const userData = join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(process.cwd(), 'node_modules');

const { openDatabase } = await import('../electron/main/database.js');
const { listClients } = await import('../electron/main/clients.service.js');

const store = await openDatabase(join(userData, 'sitescop-v6.db'));
const all = listClients(store.db);
console.log('Total clients in Clients list:', all.length);
console.log('---');
for (const c of all) {
  console.log(
    `${c.firstName} ${c.lastName}`.padEnd(28),
    String(c.email ?? '').padEnd(32),
    `jobs=${c.jobCount}`,
  );
}

const e2eEmails = [
  'afshinsobbi@gmail.com',
  'af_sh63@yahoo.com',
  't.ltechno@yahoo.com',
  'info@sitescop.com.au',
];
console.log('\nE2E email clients present?');
for (const email of e2eEmails) {
  const hit = all.find((c) => (c.email ?? '').toLowerCase() === email);
  console.log(email, hit ? `YES → ${hit.firstName} ${hit.lastName} (jobs=${hit.jobCount})` : 'NO');
}
