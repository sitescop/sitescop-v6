import { join } from 'node:path';

const userData = process.env.SITESCOP_VERIFY_USERDATA ?? join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(process.cwd(), 'node_modules');

const { openDatabase } = await import('../electron/main/database.js');
const store = await openDatabase(join(userData, 'sitescop-v6.db'));

const jobs = store.db.exec(`
  SELECT j.job_number,
         j.payment_received,
         j.agreement_status,
         j.status,
         c.first_name || ' ' || c.last_name AS client,
         COALESCE(j.agent_name, '') AS agent
  FROM jobs j
  JOIN clients c ON c.id = j.client_id
  WHERE j.job_number BETWEEN 'JOB-2026-0018' AND 'JOB-2026-0027'
  ORDER BY j.job_number
`);
console.log('Jobs:');
for (const row of jobs[0]?.values ?? []) console.log(row.join(' | '));

const rooms = store.db.exec(`
  SELECT j.job_number,
         r.label,
         r.room_type,
         json_extract(r.data, '$.roomType') AS bedType,
         json_extract(r.data, '$.bathroomType') AS bathType,
         json_extract(r.data, '$.majorDefectObserved') AS major,
         json_extract(r.data, '$.noMajorDefectObserved') AS noMajor
  FROM inspection_rooms r
  JOIN inspections i ON i.id = r.inspection_id
  JOIN jobs j ON j.id = i.job_id
  WHERE j.job_number = 'JOB-2026-0018'
  ORDER BY r.room_type, r.room_index
`);
console.log('\nE2E-01 rooms:');
for (const row of rooms[0]?.values ?? []) console.log(row.map((v) => (v == null ? '' : v)).join(' | '));
