/**
 * D11 must not pull Water Supply (or sewer/electricity) photos from Services.
 * Run: npx tsx scripts/test-d11-no-water-supply-photos.ts
 */
import {
  createEmptyInspectionFormData,
  enrichInspectionFormData,
  type InspectionFormDataV2,
} from '../shared/room-engine-core/src/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${message}`);
  }
}

function withServicePhotos(form: InspectionFormDataV2): InspectionFormDataV2 {
  return {
    ...form,
    shared: {
      ...form.shared,
      services: {
        ...form.shared.services,
        airConPresent: 'Yes',
        hotWaterPresent: 'Yes',
        hotWaterLocation: 'External',
        waterSupplyPhotos: [
          { id: 'water-1', dataUrl: 'data:image/jpeg;base64,WATER', caption: 'Water meter' },
        ],
        sewerPhotos: [{ id: 'sewer-1', dataUrl: 'data:image/jpeg;base64,SEWER', caption: 'Sewer' }],
        electricityPhotos: [
          { id: 'elec-1', dataUrl: 'data:image/jpeg;base64,ELEC', caption: 'Meter box' },
        ],
        airConPhotos: [{ id: 'ac-1', dataUrl: 'data:image/jpeg;base64,AC', caption: 'AC unit' }],
        hotWaterPhotos: [{ id: 'hw-1', dataUrl: 'data:image/jpeg;base64,HW', caption: 'HWS' }],
      },
    },
    pest: form.pest
      ? {
          ...form.pest,
          d11BarrierBridging: {
            ...form.pest.d11BarrierBridging,
            // Simulate old bug: water photo already copied into D11
            photos: [
              { id: 'water-1', dataUrl: 'data:image/jpeg;base64,WATER', caption: 'Water meter' },
              { id: 'manual-d11', dataUrl: 'data:image/jpeg;base64,MANUAL', caption: 'Manual D11' },
            ],
          },
        }
      : undefined,
  };
}

console.log('\n=== D11 must not include Water Supply photos ===\n');

const form = enrichInspectionFormData(withServicePhotos(createEmptyInspectionFormData('COMBINED')));
const d11Photos = form.pest!.d11BarrierBridging.photos;
const ids = d11Photos.map((p) => p.id);

assert(!ids.includes('water-1'), 'Water Supply photo removed from D11');
assert(!ids.includes('sewer-1'), 'Sewer photo not linked into D11');
assert(!ids.includes('elec-1'), 'Electricity photo not linked into D11');
assert(ids.includes('ac-1'), 'Air-con photo still linked (bridging item)');
assert(ids.includes('hw-1'), 'Hot water photo still linked (bridging item)');
assert(ids.includes('manual-d11'), 'Manual D11 photo kept');
assert(
  form.pest!.d11BarrierBridging.evidenceItems.selected.includes('Air Conditioners'),
  'Air Conditioners evidence auto-ticked',
);
assert(
  form.pest!.d11BarrierBridging.evidenceItems.selected.includes('Hot water service'),
  'Hot water service evidence auto-ticked',
);

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
if (failed) process.exit(1);
console.log('D11 water-supply photo check passed.');
