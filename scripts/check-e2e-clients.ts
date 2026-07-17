import { join } from 'node:path';

const userData = process.env.SITESCOP_VERIFY_USERDATA ?? join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(process.cwd(), 'node_modules');

const { openDatabase } = await import('../electron/main/database.js');
const store = await openDatabase(join(userData, 'sitescop-v6.db'));

console.log('=== E2E jobs → client mapping ===');
const map = store.db.exec(`
  SELECT j.job_number,
         c.id AS client_id,
         c.first_name || ' ' || c.last_name AS client_name,
         COALESCE(c.email, '') AS email,
         COALESCE(c.mobile, '') AS mobile,
         j.property_address
  FROM jobs j
  JOIN clients c ON c.id = j.client_id
  WHERE j.job_number BETWEEN 'JOB-2026-0018' AND 'JOB-2026-0027'
  ORDER BY j.job_number
`);
for (const row of map[0]?.values ?? []) console.log(row.join(' | '));

console.log('\n=== Distinct clients used by E2E jobs ===');
const distinct = store.db.exec(`
  SELECT c.id,
         c.first_name || ' ' || c.last_name AS name,
         COALESCE(c.email, '') AS email,
         COUNT(j.id) AS job_count
  FROM clients c
  JOIN jobs j ON j.client_id = c.id
  WHERE j.job_number BETWEEN 'JOB-2026-0018' AND 'JOB-2026-0027'
    AND IFNULL(j.deleted_at, '') = ''
  GROUP BY c.id
  ORDER BY name
`);
for (const row of distinct[0]?.values ?? []) console.log(row.join(' | '));

console.log('\n=== All clients that use the 4 test emails ===');
const byEmail = store.db.exec(`
  SELECT c.first_name || ' ' || c.last_name AS name,
         COALESCE(c.email, '') AS email,
         COALESCE(c.mobile, '') AS mobile,
         (SELECT COUNT(*) FROM jobs j WHERE j.client_id = c.id AND IFNULL(j.deleted_at,'') = '') AS jobs
  FROM clients c
  WHERE lower(c.email) IN (
    'afshinsobbi@gmail.com',
    'af_sh63@yahoo.com',
    't.ltechno@yahoo.com',
    'info@sitescop.com.au'
  )
  ORDER BY email
`);
for (const row of byEmail[0]?.values ?? []) console.log(row.join(' | '));
