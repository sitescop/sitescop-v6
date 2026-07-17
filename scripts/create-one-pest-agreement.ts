import { join } from 'node:path';

const userData = join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(
  process.cwd(),
  'node_modules',
);

const { openDatabase } = await import('../electron/main/database.js');
const { createAgreement } = await import('../electron/main/agreements.service.js');

const store = await openDatabase(join(userData, 'sitescop-v6.db'));
const created = createAgreement(store.db, {
  inspectionType: 'PEST',
  clientName: 'SiteScop Test Client',
  clientEmail: 'sitescop@gmail.com',
  clientPhone: '0411 222 333',
  propertyAddress: '55 Test Lane, Parramatta NSW 2150',
  signerRole: 'CLIENT',
});
store.persist();

console.log(
  `${created.agreementNumber} | ${created.clientName} | ${created.clientEmail} | ${created.inspectionType} | ${created.status} | $${(created.totalCents / 100).toFixed(2)}`,
);
