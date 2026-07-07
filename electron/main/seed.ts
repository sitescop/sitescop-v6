import bcrypt from 'bcryptjs';
import type { Database as SqlDatabase } from 'sql.js';
import { localDateKey } from './database.js';

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(8, '0')}`;
}

export async function seedDatabase(db: SqlDatabase) {
  const passwordHash = await bcrypt.hash('SiteScop2026!', 12);
  const userId = id('usr', 1);
  const today = localDateKey();

  db.run('BEGIN TRANSACTION');

  db.run(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, company_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, 'inspector@sitescop.com.au', passwordHash, 'James', 'Mitchell', 'SiteScop Inspections'],
  );

  const clients = [
    { id: id('cli', 1), first: 'Sarah', last: 'Chen', email: 'sarah.chen@email.com', mobile: '0412 345 678' },
    { id: id('cli', 2), first: 'Michael', last: 'Thompson', email: 'm.thompson@email.com', mobile: '0423 456 789' },
    { id: id('cli', 3), first: 'Emma', last: 'Wilson', email: 'emma.w@email.com', mobile: '0434 567 890' },
    { id: id('cli', 4), first: 'David', last: 'Nguyen', email: 'd.nguyen@email.com', mobile: '0445 678 901' },
    { id: id('cli', 5), first: 'Lisa', last: 'Patel', email: 'lisa.patel@email.com', mobile: '0456 789 012' },
  ];

  for (const c of clients) {
    db.run(`INSERT INTO clients (id, first_name, last_name, email, mobile) VALUES (?, ?, ?, ?, ?)`, [
      c.id,
      c.first,
      c.last,
      c.email,
      c.mobile,
    ]);
  }

  const year = new Date().getFullYear();
  const todaysJobs = [
    {
      id: id('job', 1),
      num: `JOB-${year}-0001`,
      client: clients[0],
      type: 'COMBINED',
      time: '08:30',
      address: '14 Banksia Avenue, Paddington QLD 4064',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      agreement: 'SIGNED',
    },
    {
      id: id('job', 2),
      num: `JOB-${year}-0002`,
      client: clients[1],
      type: 'BUILDING',
      time: '10:00',
      address: '88 River Terrace, South Brisbane QLD 4101',
      status: 'NEW',
      priority: 'NORMAL',
      agreement: 'SIGNED',
    },
    {
      id: id('job', 3),
      num: `JOB-${year}-0003`,
      client: clients[2],
      type: 'PEST',
      time: '11:30',
      address: '3/27 Stanley Street, East Brisbane QLD 4169',
      status: 'NEW',
      priority: 'URGENT',
      agreement: 'SENT',
    },
    {
      id: id('job', 4),
      num: `JOB-${year}-0004`,
      client: clients[3],
      type: 'COMBINED',
      time: '13:30',
      address: '156 Wynnum Road, Norman Park QLD 4170',
      status: 'NEW',
      priority: 'NORMAL',
      agreement: 'SIGNED',
    },
    {
      id: id('job', 5),
      num: `JOB-${year}-0005`,
      client: clients[4],
      type: 'BUILDING',
      time: '15:00',
      address: '42 Hawthorne Road, Hawthorne QLD 4171',
      status: 'NEW',
      priority: 'LOW',
      agreement: 'DRAFT',
    },
  ];

  for (const j of todaysJobs) {
    db.run(
      `INSERT INTO jobs (
         id, job_number, client_id, inspection_type, inspection_date, inspection_time,
         property_address, status, priority, agreement_status, has_invoice, has_report
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        j.id,
        j.num,
        j.client.id,
        j.type,
        today,
        j.time,
        j.address,
        j.status,
        j.priority,
        j.agreement,
        j.agreement === 'SIGNED' ? 1 : 0,
        0,
      ],
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  db.run(
    `INSERT INTO jobs (
       id, job_number, client_id, inspection_type, inspection_date, inspection_time,
       property_address, status, priority, agreement_status, has_invoice
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id('job', 6),
      `JOB-${year}-0006`,
      clients[0].id,
      'PEST',
      localDateKey(tomorrow),
      '09:00',
      '7 Park Road, Milton QLD 4064',
      'NEW',
      'NORMAL',
      'SIGNED',
      0,
    ],
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  db.run(
    `INSERT INTO jobs (
       id, job_number, client_id, inspection_type, inspection_date, inspection_time,
       property_address, status, priority, agreement_status, has_invoice, has_report
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id('job', 7),
      `JOB-${year}-0007`,
      clients[2].id,
      'COMBINED',
      localDateKey(yesterday),
      '14:00',
      '22 Vulture Street, West End QLD 4101',
      'COMPLETED',
      'NORMAL',
      'SIGNED',
      1,
      1,
    ],
  );

  db.run('COMMIT');
}
