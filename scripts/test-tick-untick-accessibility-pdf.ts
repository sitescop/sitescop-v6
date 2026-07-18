/**
 * Complete tick ↔ untick Accessibility Areas test (form + PDF).
 * Focus: Subfloor vs Roof Space behave the same.
 *
 * Run: npx tsx scripts/test-tick-untick-accessibility-pdf.ts
 */
import fs from 'node:fs';
import { join } from 'node:path';
import {
  ACCESSIBILITY_AREAS,
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

const REASONS: Partial<Record<AccessibilityAreaName, string>> = {
  Subfloor: 'Low height clearance — inspector unable to enter and inspect',
  'Roof Space': 'No roof space access hatch',
  'Roof Exterior': 'Unsafe roof access',
  Exterior: 'Vegetation restricting access',
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
  const accessibility = syncInaccessibleAreasFromAccessibility(
    {
      ...form.shared.accessibilityObstructions,
      accessibilityAreas: { selected: [...ACCESSIBILITY_AREAS], custom: [] },
      subfloorObstructions: { selected: ['Debris or rubbish'], custom: [] },
      roofSpaceObstructions: { selected: ['Insulation'], custom: [] },
    },
    true,
  );
  return enrichInspectionFormData({
    ...form,
    shared: {
      ...form.shared,
      jobInformation: {
        ...form.shared.jobInformation,
        clientName: 'Tick Untick Test',
        propertyAddress: '9 Compare St',
        inspectionDate: '2026-07-18',
      },
      propertyDescription: { ...form.shared.propertyDescription, subfloorPresent: 'Yes' },
      accessibilityObstructions: accessibility,
      roofSpace: {
        ...form.shared.roofSpace,
        defects: { selected: ['Roof Framing'], custom: [] },
        comments: 'Roof space inspected note',
      },
    },
    building: form.building
      ? {
          ...form.building,
          subfloor: {
            ...form.building.subfloor,
            elements: { selected: ['Ventilation', 'Moisture'], custom: [] },
            comments: 'Subfloor inspected note',
          },
        }
      : undefined,
  });
}

function setAccessibilitySelected(
  form: InspectionFormDataV2,
  selected: string[],
): InspectionFormDataV2 {
  let accessibility = syncInaccessibleAreasFromAccessibility(
    {
      ...form.shared.accessibilityObstructions,
      accessibilityAreas: { selected, custom: [] },
    },
    true,
  );
  const missing = getMissingAccessibilityAreas(accessibility.accessibilityAreas, true);
  for (const area of missing) {
    const reason = REASONS[area as AccessibilityAreaName];
    if (reason) {
      accessibility = setInaccessibleAreaReason(accessibility, area, reason, true);
    }
  }
  return enrichInspectionFormData({
    ...form,
    shared: { ...form.shared, accessibilityObstructions: accessibility },
  });
}

function untick(form: InspectionFormDataV2, area: AccessibilityAreaName): InspectionFormDataV2 {
  const selected = form.shared.accessibilityObstructions.accessibilityAreas.selected.filter(
    (item) => item !== area,
  );
  return setAccessibilitySelected(form, selected);
}

function tick(form: InspectionFormDataV2, area: AccessibilityAreaName): InspectionFormDataV2 {
  const selected = [
    ...new Set([...form.shared.accessibilityObstructions.accessibilityAreas.selected, area]),
  ];
  return setAccessibilitySelected(form, selected);
}

function pdfCtx(form: InspectionFormDataV2): ReportRenderContext {
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
      jobNumber: 'JOB-TICK-UNTICK',
      jobType: 'BUILDING',
      propertyAddress: form.shared.jobInformation.propertyAddress,
      clientName: form.shared.jobInformation.clientName,
    },
    inspection: {
      inspectionNumber: 'INSP-TICK-UNTICK',
      completedAt: null,
      startedAt: null,
    },
    inspector: null,
    agreementNumber: null,
    formData: form,
    rooms: [],
  };
}

function sectionChunk(html: string, title: string): string {
  const needle = `report-section-heading">${title}<`;
  const idx = html.indexOf(needle);
  if (idx < 0) return '';
  const next = html.indexOf('class="report-section"', idx + 10);
  return html.slice(idx, next > idx ? next : idx + 5000);
}

function headingIndex(html: string, title: string): number {
  const headings = [...html.matchAll(/report-section-heading">([^<]+)</g)].map((m) => m[1]);
  return headings.indexOf(title);
}

function inaccessibleAreasCell(html: string): string {
  const m = html.match(/Inaccessible Areas<\/th><td>([^<]*)<\/td>/);
  return m?.[1] ?? '';
}

setLegalBasePath(join(process.cwd(), 'shared/report-pdf/legal'));
const outDir = join(process.cwd(), 'scripts', 'test-output');
fs.mkdirSync(outDir, { recursive: true });

console.log('\n========== COMPLETE TICK / UNTICK TEST ==========\n');

// ---------------------------------------------------------------------------
console.log('STEP A — Start: ALL areas ticked (accessible)\n');
// ---------------------------------------------------------------------------
let form = baseForm();
{
  const a = form.shared.accessibilityObstructions;
  assert(a.accessibilityAreas.selected.includes('Subfloor'), 'A: Subfloor ticked accessible');
  assert(a.accessibilityAreas.selected.includes('Roof Space'), 'A: Roof Space ticked accessible');
  assert(a.inaccessibleAreas.selected.length === 0, 'A: Inaccessible Areas empty');
  assert(
    !isFormSectionInaccessibleFromAccessibility('subfloor', a.accessibilityAreas, true),
    'A: subfloor section NOT inaccessible',
  );
  assert(
    !isFormSectionInaccessibleFromAccessibility('roofSpace', a.accessibilityAreas, true),
    'A: roofSpace section NOT inaccessible',
  );

  const html = renderBuildingReportHtml(pdfCtx(form));
  fs.writeFileSync(join(outDir, 'tick-untick-A-all-accessible.html'), html, 'utf8');

  const iSub = headingIndex(html, 'Subfloor Space');
  const iRoof = headingIndex(html, 'Roof Space');
  const iKitchen = headingIndex(html, 'Kitchen');
  assert(iSub >= 0, 'A PDF: Subfloor Space heading exists');
  assert(iRoof >= 0, 'A PDF: Roof Space heading exists');
  assert(iSub < iRoof, 'A PDF: Subfloor BEFORE Roof Space');
  assert(iRoof < iKitchen, 'A PDF: Roof Space BEFORE Kitchen');

  const subChunk = sectionChunk(html, 'Subfloor Space');
  const roofChunk = sectionChunk(html, 'Roof Space');
  assert(!subChunk.includes('Subfloor inaccessible'), 'A PDF: Subfloor not inaccessible');
  assert(!roofChunk.includes('Roof Space inaccessible'), 'A PDF: Roof Space not inaccessible');
  assert(subChunk.includes('Ventilation'), 'A PDF: Subfloor shows Ventilation (inspected)');
  assert(subChunk.includes('Moisture'), 'A PDF: Subfloor shows Moisture (inspected)');
  assert(roofChunk.includes('Roof Framing') || roofChunk.includes('Defects'), 'A PDF: Roof Space shows defects');
  assert(
    inaccessibleAreasCell(html) === '—' || inaccessibleAreasCell(html) === '',
    `A PDF: Inaccessible Areas blank (got "${inaccessibleAreasCell(html)}")`,
  );
}

// ---------------------------------------------------------------------------
console.log('\nSTEP B — UNTICK Subfloor only\n');
// ---------------------------------------------------------------------------
form = untick(form, 'Subfloor');
{
  const a = form.shared.accessibilityObstructions;
  assert(!a.accessibilityAreas.selected.includes('Subfloor'), 'B: Subfloor unticked');
  assert(a.accessibilityAreas.selected.includes('Roof Space'), 'B: Roof Space still ticked');
  assert(a.inaccessibleAreas.selected.includes('Subfloor'), 'B: Subfloor locked in Inaccessible');
  assert(!a.inaccessibleAreas.selected.includes('Roof Space'), 'B: Roof Space not inaccessible');
  assert(a.subfloorObstructions.selected.length === 0, 'B: subfloor obstructions cleared');
  assert(
    form.building!.subfloor.comments.startsWith('Subfloor inaccessible —'),
    'B: Subfloor comments replaced by inaccessible reason',
  );
  assert(
    isFormSectionInaccessibleFromAccessibility('subfloor', a.accessibilityAreas, true),
    'B: subfloor flagged inaccessible',
  );
  assert(
    !isFormSectionInaccessibleFromAccessibility('roofSpace', a.accessibilityAreas, true),
    'B: roofSpace still accessible',
  );

  const html = renderBuildingReportHtml(pdfCtx(form));
  fs.writeFileSync(join(outDir, 'tick-untick-B-subfloor-unticked.html'), html, 'utf8');

  const iSub = headingIndex(html, 'Subfloor Space');
  const iRoof = headingIndex(html, 'Roof Space');
  assert(iSub >= 0 && iRoof >= 0 && iSub < iRoof, 'B PDF: Subfloor still before Roof Space');

  const subChunk = sectionChunk(html, 'Subfloor Space');
  const roofChunk = sectionChunk(html, 'Roof Space');
  assert(subChunk.includes('Subfloor inaccessible'), 'B PDF: Subfloor inaccessible comment');
  assert(subChunk.includes('Low height clearance'), 'B PDF: Subfloor reason text');
  assert(!subChunk.includes('Ventilation'), 'B PDF: Subfloor hides Ventilation');
  assert(!/\bMoisture\b/.test(subChunk), 'B PDF: Subfloor hides Moisture');
  assert(!roofChunk.includes('Roof Space inaccessible'), 'B PDF: Roof Space still inspected');
  assert(
    inaccessibleAreasCell(html).includes('Subfloor'),
    `B PDF: Inaccessible Areas lists Subfloor (got "${inaccessibleAreasCell(html)}")`,
  );
  assert(
    !inaccessibleAreasCell(html).includes('Roof Space'),
    'B PDF: Inaccessible Areas does not list Roof Space',
  );
}

// ---------------------------------------------------------------------------
console.log('\nSTEP C — UNTICK Roof Space too (both inaccessible)\n');
// ---------------------------------------------------------------------------
form = untick(form, 'Roof Space');
{
  const a = form.shared.accessibilityObstructions;
  assert(!a.accessibilityAreas.selected.includes('Subfloor'), 'C: Subfloor still unticked');
  assert(!a.accessibilityAreas.selected.includes('Roof Space'), 'C: Roof Space unticked');
  assert(a.inaccessibleAreas.selected.includes('Subfloor'), 'C: Subfloor inaccessible');
  assert(a.inaccessibleAreas.selected.includes('Roof Space'), 'C: Roof Space inaccessible');
  assert(a.roofSpaceObstructions.selected.length === 0, 'C: roof space obstructions cleared');
  assert(
    form.shared.roofSpace.comments.startsWith('Roof Space inaccessible —'),
    'C: Roof Space comments replaced by reason',
  );

  const html = renderBuildingReportHtml(pdfCtx(form));
  fs.writeFileSync(join(outDir, 'tick-untick-C-both-unticked.html'), html, 'utf8');

  const subChunk = sectionChunk(html, 'Subfloor Space');
  const roofChunk = sectionChunk(html, 'Roof Space');
  assert(subChunk.includes('Subfloor inaccessible'), 'C PDF: Subfloor inaccessible');
  assert(roofChunk.includes('Roof Space inaccessible'), 'C PDF: Roof Space inaccessible');
  assert(roofChunk.includes('No roof space access hatch'), 'C PDF: Roof Space reason');
  assert(!subChunk.includes('Ventilation'), 'C PDF: Subfloor fields collapsed');
  const cell = inaccessibleAreasCell(html);
  assert(cell.includes('Subfloor') && cell.includes('Roof Space'), `C PDF: both listed (${cell})`);

  const iSub = headingIndex(html, 'Subfloor Space');
  const iRoof = headingIndex(html, 'Roof Space');
  assert(iSub < iRoof, 'C PDF: order Subfloor then Roof Space');
}

// ---------------------------------------------------------------------------
console.log('\nSTEP D — RETICK Subfloor only (Roof Space still inaccessible)\n');
// ---------------------------------------------------------------------------
form = tick(form, 'Subfloor');
{
  const a = form.shared.accessibilityObstructions;
  assert(a.accessibilityAreas.selected.includes('Subfloor'), 'D: Subfloor reticked');
  assert(!a.accessibilityAreas.selected.includes('Roof Space'), 'D: Roof Space still unticked');
  assert(!a.inaccessibleAreas.selected.includes('Subfloor'), 'D: Subfloor removed from inaccessible');
  assert(a.inaccessibleAreas.selected.includes('Roof Space'), 'D: Roof Space still inaccessible');
  assert(
    !isFormSectionInaccessibleFromAccessibility('subfloor', a.accessibilityAreas, true),
    'D: subfloor NOT inaccessible',
  );
  assert(
    isFormSectionInaccessibleFromAccessibility('roofSpace', a.accessibilityAreas, true),
    'D: roofSpace still inaccessible',
  );

  const html = renderBuildingReportHtml(pdfCtx(form));
  fs.writeFileSync(join(outDir, 'tick-untick-D-subfloor-reticked.html'), html, 'utf8');

  const subChunk = sectionChunk(html, 'Subfloor Space');
  const roofChunk = sectionChunk(html, 'Roof Space');
  assert(!subChunk.includes('Subfloor inaccessible'), 'D PDF: Subfloor no longer inaccessible');
  assert(subChunk.includes('Ventilation'), 'D PDF: Subfloor shows Ventilation again');
  assert(roofChunk.includes('Roof Space inaccessible'), 'D PDF: Roof Space still inaccessible');
  const cell = inaccessibleAreasCell(html);
  assert(!cell.includes('Subfloor'), `D PDF: Subfloor not in Inaccessible Areas (${cell})`);
  assert(cell.includes('Roof Space'), `D PDF: Roof Space still in Inaccessible Areas (${cell})`);
}

// ---------------------------------------------------------------------------
console.log('\nSTEP E — RETICK Roof Space (all accessible again)\n');
// ---------------------------------------------------------------------------
form = tick(form, 'Roof Space');
{
  const a = form.shared.accessibilityObstructions;
  assert(a.accessibilityAreas.selected.includes('Subfloor'), 'E: Subfloor accessible');
  assert(a.accessibilityAreas.selected.includes('Roof Space'), 'E: Roof Space accessible');
  assert(
    !a.inaccessibleAreas.selected.includes('Subfloor') &&
      !a.inaccessibleAreas.selected.includes('Roof Space'),
    'E: neither locked inaccessible',
  );

  const html = renderBuildingReportHtml(pdfCtx(form));
  fs.writeFileSync(join(outDir, 'tick-untick-E-all-reticked.html'), html, 'utf8');

  const subChunk = sectionChunk(html, 'Subfloor Space');
  const roofChunk = sectionChunk(html, 'Roof Space');
  assert(!subChunk.includes('Subfloor inaccessible'), 'E PDF: Subfloor inspected');
  assert(!roofChunk.includes('Roof Space inaccessible'), 'E PDF: Roof Space inspected');
  assert(subChunk.includes('Ventilation'), 'E PDF: Subfloor fields visible');
  assert(headingIndex(html, 'Subfloor Space') < headingIndex(html, 'Roof Space'), 'E PDF: order preserved');
}

// ---------------------------------------------------------------------------
console.log('\nSTEP F — Round-trip twice more (untick both → tick both)\n');
// ---------------------------------------------------------------------------
{
  let round = form;
  for (let i = 1; i <= 2; i += 1) {
    round = untick(untick(round, 'Subfloor'), 'Roof Space');
    let html = renderBuildingReportHtml(pdfCtx(round));
    assert(
      sectionChunk(html, 'Subfloor Space').includes('Subfloor inaccessible'),
      `F${i} untick PDF: Subfloor inaccessible`,
    );
    assert(
      sectionChunk(html, 'Roof Space').includes('Roof Space inaccessible'),
      `F${i} untick PDF: Roof Space inaccessible`,
    );

    round = tick(tick(round, 'Subfloor'), 'Roof Space');
    html = renderBuildingReportHtml(pdfCtx(round));
    assert(
      !sectionChunk(html, 'Subfloor Space').includes('Subfloor inaccessible'),
      `F${i} retick PDF: Subfloor accessible`,
    );
    assert(
      !sectionChunk(html, 'Roof Space').includes('Roof Space inaccessible'),
      `F${i} retick PDF: Roof Space accessible`,
    );
  }
  fs.writeFileSync(
    join(outDir, 'tick-untick-F-final.html'),
    renderBuildingReportHtml(pdfCtx(round)),
    'utf8',
  );
}

// ---------------------------------------------------------------------------
console.log('\nSTEP G — Roof Exterior same pattern as Roof Space / Subfloor\n');
// ---------------------------------------------------------------------------
{
  let g = untick(baseForm(), 'Roof Exterior');
  assert(
    g.shared.accessibilityObstructions.inaccessibleAreas.selected.includes('Roof Exterior'),
    'G: Roof Exterior locked inaccessible',
  );
  let html = renderBuildingReportHtml(pdfCtx(g));
  assert(
    sectionChunk(html, 'Roof Exterior').includes('Roof Exterior inaccessible'),
    'G PDF untick: Roof Exterior inaccessible',
  );

  g = tick(g, 'Roof Exterior');
  html = renderBuildingReportHtml(pdfCtx(g));
  assert(
    !sectionChunk(html, 'Roof Exterior').includes('Roof Exterior inaccessible'),
    'G PDF retick: Roof Exterior accessible again',
  );
}

console.log('\n========== SUMMARY ==========');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`HTML snapshots: ${outDir}`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
console.log('\nComplete tick/untick test PASSED.');
