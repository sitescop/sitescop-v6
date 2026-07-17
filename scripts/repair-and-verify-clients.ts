import { join } from 'node:path';

const userData = join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(process.cwd(), 'node_modules');

const { openDatabase } = await import('../electron/main/database.js');
const { listClients } = await import('../electron/main/clients.service.js');

const store = await openDatabase(join(userData, 'sitescop-v6.db'));
store.persist();

const all = listClients(store.db);
console.log('Total clients after repair:', all.length);
for (const c of all) {
  console.log(
    `${c.firstName} ${c.lastName}`.padEnd(28),
    String(c.email ?? '').padEnd(32),
    `jobs=${c.jobCount}`,
  );
}

const e2e = ['afshinsobbi@gmail.com', 'af_sh63@yahoo.com', 't.ltechno@yahoo.com', 'info@sitescop.com.au'];
console.log('\nE2E emails:');
for (const email of e2e) {
  const hit = all.find((c) => (c.email ?? '').toLowerCase() === email);
  console.log(email, hit ? `OK ${hit.firstName} ${hit.lastName}` : 'MISSING');
}
