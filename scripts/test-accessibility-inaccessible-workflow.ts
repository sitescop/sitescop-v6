/**
 * Full workflow + PDF verification for Accessibility ↔ Inaccessible sync.
 * Run: npx tsx scripts/test-accessibility-inaccessible-workflow.ts
 */
import fs from 'node:fs';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import {
  ACCESSIBILITY_AREA_COMMENT_TARGETS,
  ACCESSIBILITY_AREAS,
  applyInaccessibleReasonComment,
  createEmptyInspectionFormData,
  enrichInspectionFormData,
  getMissingAccessibilityAreas,
  isFormSectionInaccessibleFromAccessibility,
  setInaccessibleAreaReason,
  syncInaccessibleAreasFromAccessibility,
  type AccessibilityAreaName,
  type InspectionFormDataV2,
} from '../shared/room-engine-core/src/index.js';
import { renderBuildingReportHtml } from '../shared/report-pdf/src/building-template.js';
import { setLegalBasePath } from '../shared/report-pdf/src/legal-loader.js';
import { DEFAULT_REPORT_SETTINGS, SITESCOP_COMPANY_NAME } from '../shared/company-branding.js';
import type { ReportRenderContext } from '../shared/report-pdf/src/types.js';

const REASON_BY_AREA: Record<AccessibilityAreaName, string> = {
  Interior: 'Locked room(s)',
  Exterior: 'Vegetation restricting access',
  'Roof Space': 'No roof space access hatch',
  Subfloor: 'Low height clearance — inspector unable to enter and inspect',
  Site: 'Vegetation restricting access',
  Outbuilding: 'Locked garage/shed',
  'Roof Exterior': 'Unsafe roof access',
};

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.log(`  FAIL  ${message}`);
  }
}

function baseForm(): InspectionFormDataV2 {
  const form = createEmptyInspectionFormData('BUILDING');
  return {
    ...form,
    shared: {
      ...form.shared,
      jobInformation: {
        ...form.shared.jobInformation,
        clientName: 'Workflow Test',
        propertyAddress: '1 Test St',
        inspectionDate: '2026-07-17',
      },
      propertyDescription: { ...form.shared.propertyDescription, subfloorPresent: 'Yes' },
    },
    building: form.building
      ? {
          ...form.building,
          subfloor: {
            ...form.building.subfloor,
            elements: { selected: ['Ventilation', 'Moisture'], custom: [] },
            comments: '',
          },
        }
      : undefined,
  };
}

function untickArea(form: InspectionFormDataV2, area: AccessibilityAreaName): InspectionFormDataV2 {
  const areas = form.shared.accessibilityObstructions.accessibilityAreas;
  const selected = areas.selected.filter((item) => item !== area);
  // Seed obstruction ticks so we can prove they clear when inaccessible
  let accessibility = {
    ...form.shared.accessibilityObstructions,
    accessibilityAreas: { selected, custom: areas.custom },
    interiorObstructions: { selected: ['Furniture and stored goods will limit access'], custom: [] },
    exteriorObstructions: { selected: ['Foliage'], custom: [] },
    roofSpaceObstructions: { selected: ['Insulation'], custom: [] },
    subfloorObstructions: { selected: ['Debris or rubbish', 'Low ground clearance'], custom: [] },
  };
  accessibility = syncInaccessibleAreasFromAccessibility(accessibility, true);
  accessibility = setInaccessibleAreaReason(
    accessibility,
    area,
    REASON_BY_AREA[area],
    true,
  );
  return enrichInspectionFormData({
    ...form,
    shared: { ...form.shared, accessibilityObstructions: accessibility },
    building: form.building
      ? {
          ...form.building,
          subfloor: {
            ...form.building.subfloor,
            comments: 'Old subfloor note that should be replaced',
          },
        }
      : undefined,
  });
}

function minimalCtx(form: InspectionFormDataV2): ReportRenderContext {
  return {
    reportType: 'BUILDING',
    company: {
      name: SITESCOP_COMPANY_NAME,
      abn: '',
      email: '',
      phone: '',
      website: '',
      address: '',
    },
    settings: { ...DEFAULT_REPORT_SETTINGS },
    job: {
      jobNumber: 'JOB-TEST',
      jobType: 'BUILDING',
      propertyAddress: form.shared.jobInformation.propertyAddress,
      clientName: form.shared.jobInformation.clientName,
    },
    inspection: {
      inspectionNumber: 'INSP-TEST',
      completedAt: null,
      startedAt: null,
    },
    inspector: null,
    agreementNumber: null,
    formData: form,
    rooms: [],
  };
}

console.log('\n=== 1) Sync workflow for every Accessibility Area ===\n');

for (const area of ACCESSIBILITY_AREAS) {
  console.log(`Area: ${area}`);
  const form = untickArea(baseForm(), area);
  const a = form.shared.accessibilityObstructions;
  const missing = getMissingAccessibilityAreas(a.accessibilityAreas, true);

  assert(missing.includes(area), `${area}: appears in missing accessibility list`);
  assert(a.inaccessibleAreas.selected.includes(area), `${area}: locked tick in Inaccessible Areas`);
  assert(
    a.inaccessibleAreaReasons[area] === REASON_BY_AREA[area],
    `${area}: reason stored`,
  );

  // Obstruction groups must clear when area is inaccessible (inaccessible ≠ obstructed)
  if (area === 'Interior') {
    assert(
      a.interiorObstructions.selected.length === 0 && a.interiorObstructions.custom.length === 0,
      `${area}: interior obstructions cleared`,
    );
  }
  if (area === 'Exterior') {
    assert(
      a.exteriorObstructions.selected.length === 0,
      `${area}: exterior obstructions cleared`,
    );
  }
  if (area === 'Roof Space') {
    assert(
      a.roofSpaceObstructions.selected.length === 0,
      `${area}: roof space obstructions cleared`,
    );
  }
  if (area === 'Subfloor') {
    assert(
      a.subfloorObstructions.selected.length === 0,
      `${area}: subfloor obstructions cleared`,
    );
  }

  const expectedComment = applyInaccessibleReasonComment('Old inspector note that must be replaced', area, REASON_BY_AREA[area]);
  assert(
    expectedComment === `${area} inaccessible — ${REASON_BY_AREA[area]}`,
    `${area}: reason takes over comments (replaces prior text)`,
  );
  for (const target of ACCESSIBILITY_AREA_COMMENT_TARGETS[area]) {
    if (target.realm === 'shared') {
      const section = form.shared[target.section as keyof typeof form.shared] as { comments?: string };
      assert(
        section?.comments === expectedComment,
        `${area}: shared.${target.section} comments taken over by reason`,
      );
    }
    if (target.realm === 'building' && form.building) {
      const section = form.building[target.section as keyof typeof form.building] as {
        comments?: string;
      };
      assert(
        section?.comments === expectedComment,
        `${area}: building.${target.section} comments taken over by reason`,
      );
    }
  }

  // Unlock again
  const restoredAreas = {
    selected: [...ACCESSIBILITY_AREAS],
    custom: [] as string[],
  };
  const unlockedAccess = syncInaccessibleAreasFromAccessibility(
    { ...a, accessibilityAreas: restoredAreas },
    true,
  );
  assert(
    !unlockedAccess.inaccessibleAreas.selected.includes(area),
    `${area}: unlocked removes locked inaccessible tick`,
  );
}

console.log('\n=== 2) Subfloor PDF vs workflow (synthetic) ===\n');

{
  const form = untickArea(baseForm(), 'Subfloor');
  assert(
    isFormSectionInaccessibleFromAccessibility(
      'subfloor',
      form.shared.accessibilityObstructions.accessibilityAreas,
      true,
    ),
    'subfloor section flagged inaccessible for PDF',
  );
  assert(
    form.building!.subfloor.comments.includes('Low height clearance'),
    'subfloor comments filled before PDF',
  );
  assert(
    form.building!.subfloor.elements.selected.includes('Ventilation'),
    'raw checklist still has Ventilation in data (hidden only in PDF)',
  );

  setLegalBasePath(join(process.cwd(), 'shared/report-pdf/legal'));
  const html = renderBuildingReportHtml(minimalCtx(form));

  assert(html.includes('Subfloor inaccessible — Low height clearance'), 'PDF HTML has inaccessible comment');

  // Locate the Subfloor Space section heading (not "Subfloor Space Present")
  const subfloorIdx = html.indexOf('report-section-heading">Subfloor Space<');
  const nextSection = html.indexOf('class="report-section"', subfloorIdx + 10);
  const subfloorChunk =
    subfloorIdx >= 0
      ? html.slice(subfloorIdx, nextSection > subfloorIdx ? nextSection : subfloorIdx + 4000)
      : '';
  assert(subfloorChunk.includes('Subfloor inaccessible'), 'PDF Subfloor chunk has reason comment');
  assert(!subfloorChunk.includes('Ventilation'), 'PDF Subfloor chunk hides Ventilation field');
  assert(!/\bMoisture\b/.test(subfloorChunk), 'PDF Subfloor chunk hides Moisture field');
}

console.log('\n=== 3) Emily Roberts live job (workflow + PDF HTML) ===\n');

{
  const userData = 'C:/Users/USER/AppData/Roaming/sitescop-v6';
  const dbPath = join(userData, 'sitescop-v6.db');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const rows = db.exec(`
    SELECT i.id, i.inspection_number, i.form_data, j.job_number, j.property_address,
           TRIM(c.first_name || ' ' || c.last_name) AS client_name
    FROM inspections i
    JOIN jobs j ON j.id = i.job_id
    JOIN clients c ON c.id = j.client_id
    WHERE c.first_name = 'Emily' AND c.last_name = 'Roberts'
    LIMIT 1
  `);

  assert(Boolean(rows[0]?.values?.length), 'Emily Roberts inspection found in DB');
  if (rows[0]?.values?.length) {
    const [inspectionId, inspectionNumber, formJson, jobNumber, propertyAddress, clientName] =
      rows[0].values[0];
    let formData = JSON.parse(String(formJson)) as InspectionFormDataV2;
    formData = enrichInspectionFormData(formData);

    const a = formData.shared.accessibilityObstructions;
    const subfloorAccessible = a.accessibilityAreas.selected.includes('Subfloor');
    const roofSpaceAccessible = a.accessibilityAreas.selected.includes('Roof Space');

    if (!subfloorAccessible) {
      assert(a.inaccessibleAreas.selected.includes('Subfloor'), 'Emily: Subfloor locked inaccessible');
      assert(
        (a.subfloorObstructions?.selected?.length ?? 0) === 0,
        'Emily: subfloor obstructions cleared after enrich (inaccessible, not obstructed)',
      );
      assert(
        Boolean(formData.building?.subfloor?.comments?.startsWith('Subfloor inaccessible')),
        'Emily: Subfloor comments taken over by reason (or fallback)',
      );
    } else {
      assert(
        !a.inaccessibleAreas.selected.includes('Subfloor'),
        'Emily: Subfloor accessible — not listed inaccessible',
      );
    }

    if (!roofSpaceAccessible) {
      assert(
        (a.roofSpaceObstructions?.selected?.length ?? 0) === 0,
        'Emily: roof space obstructions cleared when Roof Space inaccessible',
      );
      assert(
        Boolean(formData.shared.roofSpace?.comments?.startsWith('Roof Space inaccessible')),
        'Emily: Roof Space comments taken over by reason',
      );
    }

    let rooms: ReportRenderContext['rooms'] = [];
    try {
      const stmt = db.prepare(
        `SELECT label, room_type, room_index, data FROM inspection_rooms WHERE inspection_id = $id ORDER BY room_index`,
      );
      stmt.bind({ $id: String(inspectionId) });
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rooms.push({
          label: String(row.label),
          roomType: String(row.room_type),
          roomIndex: Number(row.room_index),
          data: JSON.parse(String(row.data)),
        });
      }
      stmt.free();
    } catch {
      rooms = [];
    }

    setLegalBasePath(join(process.cwd(), 'shared/report-pdf/legal'));
    const html = renderBuildingReportHtml({
      reportType: 'BUILDING',
      company: {
        name: SITESCOP_COMPANY_NAME,
        abn: '',
        email: '',
        phone: '',
        website: '',
        address: '',
      },
      settings: { ...DEFAULT_REPORT_SETTINGS },
      job: {
        jobNumber: String(jobNumber),
        jobType: 'BUILDING',
        propertyAddress: String(propertyAddress),
        clientName: String(clientName),
      },
      inspection: {
        inspectionNumber: String(inspectionNumber),
        completedAt: null,
        startedAt: null,
      },
      inspector: null,
      agreementNumber: null,
      formData,
      rooms,
    });

    const headings = [...html.matchAll(/report-section-heading">([^<]+)</g)].map((m) => m[1]);
    const iSub = headings.indexOf('Subfloor Space');
    const iRoof = headings.indexOf('Roof Space');
    const iKitchen = headings.indexOf('Kitchen');
    assert(iSub >= 0, 'Emily PDF: Subfloor Space section present');
    assert(iRoof >= 0, 'Emily PDF: Roof Space section present');
    assert(iSub < iRoof, 'Emily PDF: Subfloor appears before Roof Space (with exterior)');
    assert(iRoof < iKitchen, 'Emily PDF: Roof Space appears before Internal Areas');

    const subfloorIdx = html.indexOf('report-section-heading">Subfloor Space<');
    const nextSection = html.indexOf('class="report-section"', subfloorIdx + 10);
    const chunk =
      subfloorIdx >= 0
        ? html.slice(subfloorIdx, nextSection > subfloorIdx ? nextSection : subfloorIdx + 5000)
        : '';

    if (!subfloorAccessible) {
      assert(chunk.includes('Subfloor inaccessible'), 'Emily PDF: Subfloor inaccessible comment present');
      assert(!chunk.includes('Ventilation'), 'Emily PDF: Ventilation hidden in Subfloor');
      assert(!/\bMoisture\b/.test(chunk), 'Emily PDF: Moisture checklist hidden');
    } else {
      assert(!chunk.includes('Subfloor inaccessible'), 'Emily PDF: Subfloor not marked inaccessible');
      assert(chunk.includes('field-table') || chunk.includes('Comments'), 'Emily PDF: Subfloor has inspected content');
    }

    const outDir = join(process.cwd(), 'scripts', 'test-output');
    fs.mkdirSync(outDir, { recursive: true });
    const htmlPath = join(outDir, 'emily-roberts-subfloor-check.html');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`  wrote ${htmlPath}`);
    console.log(
      `  Emily accessibility: Subfloor=${subfloorAccessible ? 'accessible' : 'inaccessible'}, Roof Space=${roofSpaceAccessible ? 'accessible' : 'inaccessible'}`,
    );
  }
}

console.log('\n=== 4) Multi-area PDF collapse smoke ===\n');

{
  let form = baseForm();
  for (const area of ['Subfloor', 'Roof Space', 'Exterior'] as AccessibilityAreaName[]) {
    form = untickArea(form, area);
  }
  setLegalBasePath(join(process.cwd(), 'shared/report-pdf/legal'));
  const html = renderBuildingReportHtml(minimalCtx(form));
  assert(html.includes('Subfloor inaccessible'), 'multi: Subfloor comment in PDF');
  assert(html.includes('Roof Space inaccessible'), 'multi: Roof Space comment in PDF');
  assert(html.includes('Exterior inaccessible'), 'multi: Exterior comment in PDF');
}

console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
console.log('\nAll accessibility workflow + PDF checks passed.');
