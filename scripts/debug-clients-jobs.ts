import { join } from 'node:path';

const userData = join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(process.cwd(), 'node_modules');

const { openDatabase } = await import('../electron/main/database.js');
const store = await openDatabase(join(userData, 'sitescop-v6.db'));

console.log('Client count (all rows):');
const raw = store.db.exec(`SELECT id, first_name, last_name, email, IFNULL(deleted_at,'') AS deleted FROM clients`);
for (const row of raw[0]?.values ?? []) console.log(row.join(' | '));

console.log('\nE2E jobs:');
const jobs = store.db.exec(`
  SELECT j.job_number, j.client_id, IFNULL(j.deleted_at,'') AS jdel,
         COALESCE(c.first_name||' '||c.last_name,'(missing client)') AS client,
         COALESCE(c.email,'') AS email
  FROM jobs j
  LEFT JOIN clients c ON c.id = j.client_id
  WHERE j.job_number BETWEEN 'JOB-2026-0018' AND 'JOB-2026-0027'
  ORDER BY j.job_number
`);
for (const row of jobs[0]?.values ?? []) console.log(row.join(' | '));

console.log('\nTotal jobs (not deleted):');
const tj = store.db.exec(`SELECT COUNT(*) FROM jobs WHERE IFNULL(deleted_at,'')=''`);
console.log(tj[0]?.values?.[0]?.[0]);

console.log('\nTotal clients (not deleted):');
const tc = store.db.exec(`SELECT COUNT(*) FROM clients WHERE IFNULL(deleted_at,'')=''`);
console.log(tc[0]?.values?.[0]?.[0]);
