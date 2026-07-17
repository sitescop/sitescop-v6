/**
 * Seed 10 signed + started test jobs for E2E PDF checks.
 * Run with SiteScop CLOSED:
 *   npx tsx --import ./scripts/register-electron-mock.mjs scripts/seed-e2e-test-batch.ts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const userData = process.env.SITESCOP_VERIFY_USERDATA ?? join(process.env.APPDATA ?? '', 'sitescop-v6');
process.env.SITESCOP_VERIFY_USERDATA = userData;
(process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = join(
  process.cwd(),
  'node_modules',
);
mkdirSync(join(userData, 'agreements'), { recursive: true });
mkdirSync(join(userData, 'reports'), { recursive: true });
mkdirSync(join(userData, 'invoices'), { recursive: true });
mkdirSync(join(userData, 'temp'), { recursive: true });

const EMAILS = [
  'afshinsobbi@gmail.com',
  'af_sh63@yahoo.com',
  't.ltechno@yahoo.com',
  'info@sitescop.com.au',
] as const;

const SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC';

const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';

type BatchRow = {
  clientName: string;
  phone: string;
  address: string;
  email: string;
  withAgent: boolean;
  paid: boolean;
  inspectionType: 'BUILDING' | 'PEST' | 'COMBINED';
  bedroomTypes: string[];
  bathroomTypes: string[];
};

const BATCH: BatchRow[] = [
  {
    clientName: 'James Mitchell',
    phone: '0412 300 101',
    address: '14 Harbour View Rd, Manly NSW 2095',
    email: EMAILS[0],
    withAgent: true,
    paid: true,
    inspectionType: 'COMBINED',
    bedroomTypes: ['Master Bedroom', 'Bedroom', 'Guest Bedroom'],
    bathroomTypes: ['Main', 'Ensuite'],
  },
  {
    clientName: 'Sarah Nguyen',
    phone: '0423 811 204',
    address: '88 Queen St, Brisbane QLD 4000',
    email: EMAILS[1],
    withAgent: false,
    paid: false,
    inspectionType: 'BUILDING',
    bedroomTypes: ['Master Bedroom', 'Bedroom'],
    bathroomTypes: ['Main'],
  },
  {
    clientName: 'David Chen',
    phone: '0435 622 318',
    address: '3 Oak Avenue, Glen Waverley VIC 3150',
    email: EMAILS[2],
    withAgent: true,
    paid: true,
    inspectionType: 'COMBINED',
    bedroomTypes: ['Bedroom', 'Bedroom', 'Study'],
    bathroomTypes: ['Main', 'Ensuite'],
  },
  {
    clientName: 'Emily Roberts',
    phone: '0448 190 427',
    address: '221 Coastal Pde, Bondi NSW 2026',
    email: EMAILS[3],
    withAgent: false,
    paid: true,
    inspectionType: 'BUILDING',
    bedroomTypes: ['Master Bedroom', 'Nursery', 'Bedroom'],
    bathroomTypes: ['Master bed', 'Toilet'],
  },
  {
    clientName: 'Michael Patel',
    phone: '0451 773 539',
    address: '56 Riverside Dr, Toowong QLD 4066',
    email: EMAILS[0],
    withAgent: true,
    paid: false,
    inspectionType: 'COMBINED',
    bedroomTypes: ['Master Bedroom', 'Guest Bedroom'],
    bathroomTypes: ['Main', 'Ensuite'],
  },
  {
    clientName: 'Olivia Brown',
    phone: '0462 884 640',
    address: '9 Maple Court, Adelaide SA 5000',
    email: EMAILS[1],
    withAgent: false,
    paid: false,
    inspectionType: 'PEST',
    bedroomTypes: [],
    bathroomTypes: [],
  },
  {
    clientName: 'William Taylor',
    phone: '0473 995 751',
    address: '120 Collins St, Melbourne VIC 3000',
    email: EMAILS[2],
    withAgent: true,
    paid: true,
    inspectionType: 'COMBINED',
    bedroomTypes: ['Master Bedroom', 'Bedroom', 'Bedroom', 'Guest Bedroom'],
    bathroomTypes: ['Main', 'Ensuite', 'Toilet'],
  },
  {
    clientName: 'Chloe Anderson',
    phone: '0484 106 862',
    address: '77 Stirling Hwy, Nedlands WA 6009',
    email: EMAILS[3],
    withAgent: false,
    paid: true,
    inspectionType: 'BUILDING',
    bedroomTypes: ['Bedroom', 'Bedroom'],
    bathroomTypes: ['Main', 'Ensuite'],
  },
  {
    clientName: 'Daniel Wilson',
    phone: '0495 217 973',
    address: '41 Macquarie St, Hobart TAS 7000',
    email: EMAILS[0],
    withAgent: true,
    paid: false,
    inspectionType: 'COMBINED',
    bedroomTypes: ['Master Bedroom', 'Study'],
    bathroomTypes: ['Main'],
  },
  {
    clientName: 'Grace Thompson',
    phone: '0406 328 084',
    address: '18 Flinders Way, Canberra ACT 2600',
    email: EMAILS[1],
    withAgent: false,
    paid: false,
    inspectionType: 'BUILDING',
    bedroomTypes: ['Master Bedroom', 'Bedroom', 'Bedroom'],
    bathroomTypes: ['Main', 'Ensuite'],
  },
];

async function fetchSamplePhotos(): Promise<string[]> {
  const urls = [
    'https://picsum.photos/seed/sitescop1/320/240.jpg',
    'https://picsum.photos/seed/sitescop2/320/240.jpg',
    'https://picsum.photos/seed/sitescop3/320/240.jpg',
  ];
  const out: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') || 'image/jpeg';
      out.push(`data:${mime};base64,${buf.toString('base64')}`);
      console.log(`  photo ok (${Math.round(buf.length / 1024)} KB) ${url}`);
    } catch (err) {
      console.warn(`  photo fallback for ${url}:`, err instanceof Error ? err.message : err);
      out.push(TINY_JPEG);
    }
  }
  return out;
}

function photoRefs(dataUrls: string[], caption: string) {
  return dataUrls.map((dataUrl, i) => ({
    id: randomUUID(),
    dataUrl,
    createdAt: new Date().toISOString(),
    caption: `${caption} ${i + 1}`,
  }));
}

async function main() {
  console.log(`\n=== E2E seed batch ===\nuserData: ${userData}\n`);
  const dbPath = join(userData, 'sitescop-v6.db');
  if (!existsSync(dbPath)) throw new Error(`DB not found: ${dbPath}`);

  const { openDatabase } = await import('../electron/main/database.js');
  const {
    createAgreement,
    sendAgreement,
    signAgreement,
  } = await import('../electron/main/agreements.service.js');
  const { startJob, markJobAsPaid, getJobDetail } = await import('../electron/main/jobs.service.js');
  const {
    getInspectionByJob,
    updateInspectionSection,
    updateInspectionRoom,
    completeInspection,
  } = await import('../electron/main/inspections.service.js');
  const { generateReportsForJob } = await import('../electron/main/reports.service.js');
  const {
    buildNoMajorDefectPatch,
    buildMajorDefectPatch,
  } = await import('../shared/room-engine-core/src/property-profile.js');

  const store = await openDatabase(dbPath);

  const userStmt = store.db.prepare(
    `SELECT id, email, first_name AS firstName, last_name AS lastName, company_name AS companyName FROM users LIMIT 1`,
  );
  if (!userStmt.step()) {
    userStmt.free();
    throw new Error('No logged-in user found in database. Open SiteScop once and sign in first.');
  }
  const userRow = userStmt.getAsObject() as {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
  };
  userStmt.free();
  const sessionUser = {
    id: String(userRow.id),
    email: String(userRow.email),
    firstName: String(userRow.firstName),
    lastName: String(userRow.lastName),
    companyName: String(userRow.companyName),
  };

  console.log(`Inspector: ${sessionUser.firstName} ${sessionUser.lastName}`);
  console.log('Fetching sample photos…');
  const samplePhotos = await fetchSamplePhotos();

  const summary: Array<Record<string, unknown>> = [];

  for (let i = 0; i < BATCH.length; i += 1) {
    const row = BATCH[i]!;
    const tag = `E2E-${String(i + 1).padStart(2, '0')}`;
    console.log(`\n--- ${tag} ${row.clientName} (${row.inspectionType}) ---`);

    const created = createAgreement(store.db, {
      inspectionType: row.inspectionType,
      clientName: row.clientName,
      clientEmail: row.email,
      clientPhone: row.phone,
      propertyAddress: row.address,
      notes: `${tag} automated test batch`,
      ...(row.withAgent
        ? {
            signerRole: 'AGENT' as const,
            agencyName: 'Harbour Realty Group',
            agentName: 'Alex Agent',
            agentEmail: row.email,
          }
        : { signerRole: 'CLIENT' as const }),
    });

    const sent = sendAgreement(store.db, created.id);
    const signed = await signAgreement(store.db, sent.accessToken, {
      signatureName: row.withAgent ? 'Alex Agent' : row.clientName,
      signatureData: SIGNATURE_PNG,
      declarationsAccepted: true,
      ...(row.withAgent
        ? { signingParty: 'AGENT' as const, agentAuthorityAccepted: true }
        : { signingParty: 'CLIENT' as const }),
    });

    const jobId = signed.jobId;
    if (!jobId) throw new Error(`${tag}: missing jobId after sign`);

    startJob(store.db, jobId);
    if (row.paid) {
      await markJobAsPaid(store.db, jobId);
    }

    const job = getJobDetail(store.db, jobId);
    if (!job) throw new Error(`${tag}: job missing`);

    const inspection = getInspectionByJob(store.db, jobId, sessionUser);
    store.persist();

    // Property description / room counts for building forms
    if (row.inspectionType !== 'PEST') {
      updateInspectionSection(store.db, inspection.id, {
        realm: 'shared',
        section: 'propertyDescription',
        data: {
          bedroomCount: Math.max(1, row.bedroomTypes.length),
          bathroomCount: Math.max(1, row.bathroomTypes.length),
          livingAreaCount: 1,
          garageCount: 1,
          propertyType: 'House',
          occupancyStatus: 'Occupied',
          weatherConditions: 'Fine',
        },
      });
    }

    // Refresh rooms after count change
    const refreshed = getInspectionByJob(store.db, jobId, sessionUser);

    // Quick-fill shared / building sections that support Major / No Major
    const noMajor = buildNoMajorDefectPatch();
    const major = buildMajorDefectPatch();
    const sharedSections = ['external', 'roofExterior', 'roofSpace'] as const;
    for (const section of sharedSections) {
      updateInspectionSection(store.db, refreshed.id, {
        realm: 'shared',
        section,
        data: {
          ...noMajor,
          photos: photoRefs([samplePhotos[0]!], `${section}`),
        },
      });
    }

    if (refreshed.formData.building) {
      const buildingSections = ['kitchen', 'laundry', 'fencing', 'outbuildings'] as const;
      for (const section of buildingSections) {
        updateInspectionSection(store.db, refreshed.id, {
          realm: 'building',
          section,
          data: {
            ...(section === 'kitchen' ? major : noMajor),
            photos: photoRefs([samplePhotos[1]!], section),
          },
        });
      }
      if (refreshed.formData.building.subfloor) {
        updateInspectionSection(store.db, refreshed.id, {
          realm: 'building',
          section: 'subfloor',
          data: { ...noMajor, photos: photoRefs([samplePhotos[2]!], 'subfloor') },
        });
      }
    }

    // Rooms: set identity types + mix of Major / No Major + photos
    const bedrooms = refreshed.rooms.filter((r) => r.roomType === 'BEDROOM');
    bedrooms.forEach((room, idx) => {
      const type = row.bedroomTypes[idx] ?? 'Bedroom';
      const patch =
        idx === 0
          ? { ...buildMajorDefectPatch(), roomType: type, photos: photoRefs([samplePhotos[0]!], type) }
          : { ...buildNoMajorDefectPatch(), roomType: type, photos: photoRefs([samplePhotos[1]!], type) };
      updateInspectionRoom(store.db, refreshed.id, room.id, { data: { ...room.data, ...patch } });
    });

    const bathrooms = refreshed.rooms.filter((r) => r.roomType === 'BATHROOM');
    bathrooms.forEach((room, idx) => {
      const type = row.bathroomTypes[idx] ?? 'Main';
      updateInspectionRoom(store.db, refreshed.id, room.id, {
        data: {
          ...room.data,
          ...buildNoMajorDefectPatch(),
          bathroomType: type,
          photos: photoRefs([samplePhotos[2]!], type),
        },
      });
    });

    const living = refreshed.rooms.filter((r) => r.roomType === 'LIVING');
    living.forEach((room) => {
      updateInspectionRoom(store.db, refreshed.id, room.id, {
        data: {
          ...room.data,
          ...buildNoMajorDefectPatch(),
          areaName: 'Living Area',
          photos: photoRefs([samplePhotos[0]!], 'Living'),
        },
      });
    });

    const garages = refreshed.rooms.filter((r) => r.roomType === 'GARAGE');
    garages.forEach((room) => {
      updateInspectionRoom(store.db, refreshed.id, room.id, {
        data: {
          ...room.data,
          ...buildMajorDefectPatch(),
          photos: photoRefs(samplePhotos, 'Garage'),
        },
      });
    });

    // Light pest fill when present
    if (refreshed.formData.pest) {
      updateInspectionSection(store.db, refreshed.id, {
        realm: 'pest',
        section: 'd1ActiveTermites',
        data: {
          ...buildNoMajorDefectPatch(),
          photos: photoRefs([samplePhotos[1]!], 'D1'),
        },
      });
    }

    completeInspection(store.db, refreshed.id);
    store.persist();

    let reports: Array<{ reportType: string; filePath: string }> = [];
    try {
      reports = await generateReportsForJob(store.db, jobId, sessionUser);
      store.persist();
      console.log(`  PDFs: ${reports.map((r) => r.reportType).join(', ')}`);
    } catch (err) {
      console.error(`  PDF FAILED:`, err instanceof Error ? err.message : err);
    }

    summary.push({
      tag,
      clientName: row.clientName,
      email: row.email,
      address: row.address,
      withAgent: row.withAgent,
      paid: row.paid,
      inspectionType: row.inspectionType,
      jobId,
      jobNumber: job.jobNumber,
      agreementId: created.id,
      agreementNumber: created.agreementNumber,
      reports: reports.map((r) => ({ type: r.reportType, path: r.filePath })),
    });
  }

  store.persist();
  const outPath = join(userData, 'e2e-test-batch-summary.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\n=== Done: ${summary.length} jobs ===`);
  console.log(`Summary: ${outPath}`);
  for (const row of summary) {
    console.log(
      `${row.tag} ${row.jobNumber} | ${row.clientName} | agent=${row.withAgent} paid=${row.paid} | ${row.inspectionType} | reports=${(row.reports as unknown[]).length}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
