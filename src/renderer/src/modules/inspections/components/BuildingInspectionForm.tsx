import { useMemo, useState } from 'react';
import {
  ACCESSIBILITY_AREAS,
  AC_TYPES,
  CONCLUSION_RATINGS,
  CORROSION_ITEMS,
  DAMAGE_OBSERVED,
  DRAINAGE_RATING,
  ELECTRICITY_OPTIONS,
  ELECTRICAL_POINT_STATUS,
  EXTERIOR_OBSTRUCTIONS,
  EXTERNAL_DEFECTS,
  FENCING_MATERIALS,
  FIXTURE_CONDITION,
  FLOOR_MATERIALS,
  FLOOR_CONDITION,
  FRAME_MATERIALS,
  GAS_OPTIONS,
  GENERAL_ELECTRICAL_DISCLAIMERS,
  HOT_WATER_TYPES,
  INACCESSIBLE_AREA_PRESETS,
  INTERIOR_OBSTRUCTIONS,
  KITCHEN_DISCLAIMERS,
  LAND_SLOPE,
  LAUNDRY_DISCLAIMERS,
  LAUNDRY_FLOOR_TYPES,
  LICENSED_ELECTRICIAN_INSPECTION,
  LIGHTS_SWITCHES_STATUS,
  MINOR_DEFECT_PRESETS,
  MOISTURE_SOURCES,
  ORIENTATIONS,
  OUTBUILDING_TYPES,
  OVERALL_BUILDING_CONDITION,
  OVERALL_COMPARISON,
  POSITION_ON_BLOCK,
  PROPERTY_TYPES,
  RECOMMENDATION_PRESETS,
  RISK_LEVELS,
  ROOF_EXTERIOR_DEFECTS,
  ROOF_MATERIALS,
  ROOF_SPACE_DEFECTS,
  ROOF_SPACE_OBSTRUCTIONS,
  SEWER_OPTIONS,
  SITE_DRAINAGE_CONCERNS,
  SPLASHBACK_CONDITION,
  STOREYS,
  STRUCTURAL_MOVEMENT,
  SUBFLOOR_ELEMENTS,
  SUBFLOOR_OBSTRUCTIONS,
  WALL_DEFECTS,
  WALL_MATERIALS,
  WATER_SUPPLY_OPTIONS,
  DEFORMATION_ITEMS,
  type BuildingExtensionSections,
  type CheckboxFieldState,
  type InspectionFormDataV2,
  type InspectionFormRealm,
  type SharedInspectionSections,
} from '@sitescop/room-engine-core';
import { Input, Select, Textarea } from '@/design-system/components';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { InspectionAccordion, InspectionAccordionSection } from './InspectionAccordion';
import { CheckboxGroupField, InspectionSubsectionHeading, PhotoField, RatingSelect, SectionComments, YesNoSelect } from './InspectionFields';
import { InspectorHazardAssessmentFields } from './InspectorHazardAssessmentFields';
import { InspectorSignatureField } from './InspectorSignatureField';
import { JobInformationSection } from './JobInformationSection';
import { InspectionFormProvider, InspectionSubPanel } from './InspectionFormUi';
import { buildInspectionSectionStatuses } from './section-completion';
import { InspectionRoomSections } from './InspectionRoomSections';

function splitManualRecommendations(items: string[]): CheckboxFieldState {
  const presetSet = new Set<string>(RECOMMENDATION_PRESETS);
  return {
    selected: items.filter((item) => presetSet.has(item)),
    custom: items.filter((item) => !presetSet.has(item)),
  };
}

interface BuildingInspectionFormProps {
  formData: InspectionFormDataV2;
  onSectionChange: (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => void;
  readOnly?: boolean;
  roomSections?: React.ReactNode;
  rooms?: InspectionRoomDetail[];
  onRoomDataChange?: (roomId: string, data: Record<string, unknown>) => void;
  onRoomPatch?: (roomId: string, partial: Record<string, unknown>) => void;
  /** When true, omit outer accordion/provider wrappers (parent supplies them). */
  embedded?: boolean;
  /** full = shared + building; shared-only = Job Info through Roof Space; building-only = Kitchen onward */
  mode?: 'full' | 'shared-only' | 'building-only';
}

export function BuildingInspectionForm({
  formData,
  onSectionChange,
  readOnly,
  roomSections,
  rooms = [],
  onRoomDataChange,
  onRoomPatch,
  embedded = false,
  mode = 'full',
}: BuildingInspectionFormProps) {
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const disabled = Boolean(readOnly);
  const building = formData.building;
  const showShared = mode === 'full' || mode === 'shared-only';
  const showBuilding = (mode === 'full' || mode === 'building-only') && building;

  if (!showShared && !showBuilding) return null;

  const patchShared = (section: keyof SharedInspectionSections, partial: Record<string, unknown>) => {
    if (readOnly) return;
    onSectionChange('shared', section, partial);
  };

  const patchBuilding = (section: keyof BuildingExtensionSections, partial: Record<string, unknown>) => {
    if (readOnly) return;
    onSectionChange('building', section, partial);
  };

  const captureGps = async () => {
    if (readOnly) return;

    const applyCoords = (latitude: number, longitude: number) => {
      patchShared('jobInformation', {
        gpsLatitude: String(latitude),
        gpsLongitude: String(longitude),
      });
      setGpsStatus('GPS captured.');
      setGpsCapturing(false);
    };

    setGpsCapturing(true);
    setGpsStatus('Capturing location…');

    if (window.sitescop?.geo?.captureCurrentPosition) {
      const result = await window.sitescop.geo.captureCurrentPosition();
      if (result.ok) {
        applyCoords(result.latitude, result.longitude);
        return;
      }
      setGpsCapturing(false);
      setGpsStatus(result.message);
      return;
    }

    if (!navigator.geolocation) {
      setGpsCapturing(false);
      setGpsStatus('GPS is not available in this window. Enter coordinates manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => applyCoords(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setGpsCapturing(false);
        const messages: Record<number, string> = {
          1: 'Location permission denied. Allow location access for SiteScop in Windows Settings.',
          2: 'Location unavailable. Turn on Windows Location Services.',
          3: 'GPS timed out. Try again or enter coordinates manually.',
        };
        setGpsStatus(messages[err.code] ?? `Could not capture GPS (${err.message}).`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const j = formData.shared.jobInformation;
  const s = formData.shared.services;
  const p = formData.shared.propertyDescription;
  const a = formData.shared.accessibilityObstructions;
  const manualRecommendations = building
    ? splitManualRecommendations(building.recommendations.manualRecommendations)
    : { selected: [] as string[], custom: [] as string[] };

  const statuses = useMemo(() => buildInspectionSectionStatuses(formData, rooms), [formData, rooms]);

  const roomContent =
    rooms.length > 0 && onRoomDataChange && onRoomPatch ? (
      <InspectionRoomSections
        rooms={rooms}
        readOnly={readOnly}
        statuses={statuses}
        onRoomDataChange={onRoomDataChange}
        onRoomPatch={onRoomPatch}
      />
    ) : (
      roomSections
    );

  const sections = (
    <>
      {showShared && (
        <>
      <InspectionAccordionSection id="inspector-hazard" title="Inspector Hazard Assessment" status={statuses['inspector-hazard']}>
      <InspectorHazardAssessmentFields
        disabled={disabled}
        section={formData.shared.inspectorHazardAssessment}
        onChange={(partial) => patchShared('inspectorHazardAssessment', partial)}
      />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="job-information" title="Job Information" status={statuses['job-information']}>
      <JobInformationSection
        data={j}
        disabled={disabled}
        gpsCapturing={gpsCapturing}
        gpsStatus={gpsStatus}
        onChange={(partial) => patchShared('jobInformation', partial)}
        onCaptureGps={captureGps}
      />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="services" title="Services" status={statuses.services}>
        <CheckboxGroupField disabled={disabled} label="Water Supply" options={WATER_SUPPLY_OPTIONS} value={s.waterSupply} onChange={(v) => patchShared('services', { waterSupply: v })} />
        <Input label="Water Supply Other" value={s.waterSupplyOther} onChange={(e) => patchShared('services', { waterSupplyOther: e.target.value })} />
        <CheckboxGroupField disabled={disabled} label="Sewer" options={SEWER_OPTIONS} value={s.sewer} onChange={(v) => patchShared('services', { sewer: v })} />
        <CheckboxGroupField disabled={disabled} label="Electricity" options={ELECTRICITY_OPTIONS} value={s.electricity} onChange={(v) => patchShared('services', { electricity: v })} />
        <CheckboxGroupField disabled={disabled} label="Gas" options={GAS_OPTIONS} value={s.gas} onChange={(v) => patchShared('services', { gas: v })} />
        <InspectionSubPanel title="Hot Water System">
          <div className="grid gap-4 md:grid-cols-3">
            <YesNoSelect label="Present?" value={s.hotWaterPresent} onChange={(v) => patchShared('services', { hotWaterPresent: v })} />
            <CheckboxGroupField disabled={disabled} label="Type" options={HOT_WATER_TYPES} value={s.hotWaterType} onChange={(v) => patchShared('services', { hotWaterType: v })} />
            <YesNoSelect label="Operating?" value={s.hotWaterOperating} onChange={(v) => patchShared('services', { hotWaterOperating: v })} includeNa />
          </div>
        </InspectionSubPanel>
        <InspectionSubPanel title="Air Conditioning">
          <div className="grid gap-4 md:grid-cols-3">
            <YesNoSelect label="Present?" value={s.airConPresent} onChange={(v) => patchShared('services', { airConPresent: v })} />
            <CheckboxGroupField disabled={disabled} label="Type" options={AC_TYPES} value={s.airConType} onChange={(v) => patchShared('services', { airConType: v })} />
            <YesNoSelect label="Operating?" value={s.airConOperating} onChange={(v) => patchShared('services', { airConOperating: v })} includeNa />
          </div>
        </InspectionSubPanel>
        <SectionComments disabled={disabled} comments={s.comments} photos={s.photos} onCommentsChange={(v) => patchShared('services', { comments: v })} onPhotosChange={(v) => patchShared('services', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="property-description" title="Property Description" status={statuses['property-description']}>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Property Type"
            placeholder="Select property type"
            value={p.propertyType}
            onChange={(e) =>
              patchShared('propertyDescription', {
                propertyType: e.target.value,
                ...(e.target.value !== 'Other' ? { propertyTypeOther: '' } : {}),
              })
            }
            options={PROPERTY_TYPES.map((v) => ({ value: v, label: v }))}
          />
          {p.propertyType === 'Other' && (
            <Input
              label="Property Type (Other)"
              value={p.propertyTypeOther}
              onChange={(e) => patchShared('propertyDescription', { propertyTypeOther: e.target.value })}
            />
          )}
          <Select
            label="Position On Block"
            placeholder="Select position"
            value={p.positionOnBlock}
            onChange={(e) => patchShared('propertyDescription', { positionOnBlock: e.target.value })}
            options={POSITION_ON_BLOCK.map((v) => ({ value: v, label: v }))}
          />
          <Select
            label="Orientation"
            placeholder="Select orientation"
            value={p.orientation}
            onChange={(e) => patchShared('propertyDescription', { orientation: e.target.value })}
            options={ORIENTATIONS.map((v) => ({ value: v, label: v }))}
          />
          <Select
            label="Storeys"
            placeholder="Select storeys"
            value={p.storeys}
            onChange={(e) => patchShared('propertyDescription', { storeys: e.target.value })}
            options={STOREYS.map((v) => ({ value: v, label: v }))}
          />
          <Input label="Building Age (Years)" type="number" min={0} value={p.buildingAgeYears} onChange={(e) => patchShared('propertyDescription', { buildingAgeYears: e.target.value })} />
          <Input label="Bedrooms" type="number" min={0} value={p.bedroomCount} onChange={(e) => patchShared('propertyDescription', { bedroomCount: Number(e.target.value) })} />
          <Input label="Bathrooms" type="number" min={0} value={p.bathroomCount} onChange={(e) => patchShared('propertyDescription', { bathroomCount: Number(e.target.value) })} />
          <Input label="Living Areas" type="number" min={0} value={p.livingAreaCount} onChange={(e) => patchShared('propertyDescription', { livingAreaCount: Number(e.target.value) })} />
          <Input label="Garage Spaces" type="number" min={0} value={p.garageCount} onChange={(e) => patchShared('propertyDescription', { garageCount: Number(e.target.value) })} />
        </div>
        <CheckboxGroupField disabled={disabled} label="Walls" options={WALL_MATERIALS} value={p.walls} onChange={(v) => patchShared('propertyDescription', { walls: v })} />
        <CheckboxGroupField disabled={disabled} label="Frame" options={FRAME_MATERIALS} value={p.frame} onChange={(v) => patchShared('propertyDescription', { frame: v })} />
        <CheckboxGroupField disabled={disabled} label="Roof" options={ROOF_MATERIALS} value={p.roof} onChange={(v) => patchShared('propertyDescription', { roof: v })} />
        <CheckboxGroupField disabled={disabled} label="Floor" options={FLOOR_MATERIALS} value={p.floor} onChange={(v) => patchShared('propertyDescription', { floor: v })} />
        <CheckboxGroupField disabled={disabled} label="Fencing" options={FENCING_MATERIALS} value={p.fencing} onChange={(v) => patchShared('propertyDescription', { fencing: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="accessibility" title="Accessibility & Risk Assessment" status={statuses.accessibility}>
        <p className="text-sm text-text-muted">
          Record obstructions and inaccessible areas first. Undetected Structural Damage Risk defaults to Moderate and increases automatically when limitations are present — for example a dog, locked rooms, stored goods, or unsafe access.
        </p>
        <CheckboxGroupField disabled={disabled} label="Accessibility Areas" options={ACCESSIBILITY_AREAS} value={a.accessibilityAreas} onChange={(v) => patchShared('accessibilityObstructions', { accessibilityAreas: v })} />
        <CheckboxGroupField disabled={disabled} label="A - Building Interior Obstructions" options={INTERIOR_OBSTRUCTIONS} value={a.interiorObstructions} onChange={(v) => patchShared('accessibilityObstructions', { interiorObstructions: v })} />
        <CheckboxGroupField disabled={disabled} label="B - Building Exterior Obstructions" options={EXTERIOR_OBSTRUCTIONS} value={a.exteriorObstructions} onChange={(v) => patchShared('accessibilityObstructions', { exteriorObstructions: v })} />
        <CheckboxGroupField disabled={disabled} label="C - Roof Space Obstructions" options={ROOF_SPACE_OBSTRUCTIONS} value={a.roofSpaceObstructions} onChange={(v) => patchShared('accessibilityObstructions', { roofSpaceObstructions: v })} />
        <CheckboxGroupField disabled={disabled} label="D - Subfloor Space Obstructions" options={SUBFLOOR_OBSTRUCTIONS} value={a.subfloorObstructions} onChange={(v) => patchShared('accessibilityObstructions', { subfloorObstructions: v })} />
        <CheckboxGroupField disabled={disabled} label="Inaccessible Areas" options={INACCESSIBLE_AREA_PRESETS} value={a.inaccessibleAreas} onChange={(v) => patchShared('accessibilityObstructions', { inaccessibleAreas: v })} />
        <div className="grid gap-4 md:grid-cols-1">
          {(a.inaccessibleCustomLines ?? ['', '', '']).slice(0, 3).map((line, index) => (
            <Input
              key={`inaccessible-note-${index}`}
              label={index === 0 ? 'Inaccessible Area Notes' : `Inaccessible Area Note ${index + 1}`}
              value={line}
              onChange={(e) => {
                const lines = [...(a.inaccessibleCustomLines ?? ['', '', ''])];
                while (lines.length < 3) lines.push('');
                lines[index] = e.target.value;
                patchShared('accessibilityObstructions', { inaccessibleCustomLines: lines.slice(0, 3) });
              }}
            />
          ))}
        </div>
        <RatingSelect label="Undetected Structural Damage Risk" value={a.undetectedStructuralRisk} onChange={(v) => patchShared('accessibilityObstructions', { undetectedStructuralRisk: v })} options={RISK_LEVELS} />
        <Textarea label="Risk Explanation (auto-generated, editable)" value={a.riskExplanation} onChange={(e) => patchShared('accessibilityObstructions', { riskExplanation: e.target.value })} rows={5} />
        <SectionComments disabled={disabled} comments={a.comments} photos={a.photos} onCommentsChange={(v) => patchShared('accessibilityObstructions', { comments: v })} onPhotosChange={(v) => patchShared('accessibilityObstructions', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="site-conditions" title="Site Conditions" status={statuses['site-conditions']}>
        <div className="grid gap-4 md:grid-cols-3">
          <RatingSelect label="Land Slope" value={formData.shared.siteConditions.landSlope} onChange={(v) => patchShared('siteConditions', { landSlope: v })} options={LAND_SLOPE} />
          <RatingSelect label="Surface Drainage" value={formData.shared.siteConditions.surfaceDrainage} onChange={(v) => patchShared('siteConditions', { surfaceDrainage: v })} options={DRAINAGE_RATING} />
          <YesNoSelect label="Evidence Of Water Pooling" value={formData.shared.siteConditions.evidenceOfWaterPooling} onChange={(v) => patchShared('siteConditions', { evidenceOfWaterPooling: v })} />
        </div>
        <CheckboxGroupField disabled={disabled} label="Site Drainage Concerns" options={SITE_DRAINAGE_CONCERNS} value={formData.shared.siteConditions.siteDrainageConcerns} onChange={(v) => patchShared('siteConditions', { siteDrainageConcerns: v })} />
        <SectionComments disabled={disabled} comments={formData.shared.siteConditions.comments} photos={formData.shared.siteConditions.photos} onCommentsChange={(v) => patchShared('siteConditions', { comments: v })} onPhotosChange={(v) => patchShared('siteConditions', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="external" title="External" status={statuses.external}>
        <CheckboxGroupField disabled={disabled} label="External Defects" options={EXTERNAL_DEFECTS} value={formData.shared.external.externalDefects} onChange={(v) => patchShared('external', { externalDefects: v })} />
        <CheckboxGroupField disabled={disabled} label="Damage Observed" options={DAMAGE_OBSERVED} value={formData.shared.external.damageObserved} onChange={(v) => patchShared('external', { damageObserved: v })} />
        <SectionComments disabled={disabled} comments={formData.shared.external.comments} photos={formData.shared.external.photos} onCommentsChange={(v) => patchShared('external', { comments: v })} onPhotosChange={(v) => patchShared('external', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="roof-exterior" title="Roof Exterior" status={statuses['roof-exterior']}>
        <CheckboxGroupField disabled={disabled} label="Defects" options={ROOF_EXTERIOR_DEFECTS} value={formData.shared.roofExterior.defects} onChange={(v) => patchShared('roofExterior', { defects: v })} />
        <RatingSelect label="Condition" value={formData.shared.roofExterior.condition} onChange={(v) => patchShared('roofExterior', { condition: v })} options={['Good', 'Fair', 'Poor']} />
        <SectionComments disabled={disabled} comments={formData.shared.roofExterior.comments} photos={formData.shared.roofExterior.photos} onCommentsChange={(v) => patchShared('roofExterior', { comments: v })} onPhotosChange={(v) => patchShared('roofExterior', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="roof-space" title="Roof Space" status={statuses['roof-space']}>
        <CheckboxGroupField disabled={disabled} label="Defects" options={ROOF_SPACE_DEFECTS} value={formData.shared.roofSpace.defects} onChange={(v) => patchShared('roofSpace', { defects: v })} />
        <SectionComments disabled={disabled} comments={formData.shared.roofSpace.comments} photos={formData.shared.roofSpace.photos} onCommentsChange={(v) => patchShared('roofSpace', { comments: v })} onPhotosChange={(v) => patchShared('roofSpace', { photos: v })} />
      </InspectionAccordionSection>
        </>
      )}

      {showBuilding && building && (
        <>
      <InspectionAccordionSection id="kitchen" title="Kitchen" status={statuses.kitchen ?? 'not_started'}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ['cabinetDoorsOperating', 'Cabinet Doors Operating', ['Yes', 'No']],
            ['cabinetDamage', 'Cabinet Damage', ['No', 'Yes']],
            ['cabinetCondition', 'Cabinet Condition', ['Good', 'Fair', 'Poor', 'Damaged']],
            ['sink', 'Sink', ['Good', 'Fair', 'Poor']],
            ['drainage', 'Drainage', ['Not Blocked', 'Partially Blocked', 'Blocked']],
            ['leakInsideCabinet', 'Leak Inside Cabinet', ['No', 'Yes']],
            ['tapsMixers', 'Taps & Mixers', ['Good', 'Fair', 'Poor', 'Leaking']],
            ['splashback', 'Splashback', ['Good', 'Fair', 'Poor', 'Cracked', 'Loose', 'Missing Grout']],
            ['benchtopType', 'Benchtop Type', ['Stone', 'Laminate', 'Timber', 'Concrete', 'Other']],
            ['benchtopCondition', 'Benchtop Condition', ['Good', 'Fair', 'Poor']],
            ['benchtopDamage', 'Benchtop Damage', ['None', 'Cracked', 'Broken', 'Chipped', 'Water Damage']],
            ['floorType', 'Floor Type', ['Tiles', 'Timber', 'Vinyl', 'Laminate', 'Other']],
            ['floorCondition', 'Floor Condition', ['Good', 'Fair', 'Poor', 'Damaged', 'Stained']],
            ['moistureDamage', 'Moisture Damage', ['None', 'Minor', 'Moderate', 'Major']],
            ['lights', 'Lights Working', [...LIGHTS_SWITCHES_STATUS]],
            ['powerPoints', 'Power Points Working', [...ELECTRICAL_POINT_STATUS]],
          ].map(([key, label, options]) => (
            <RatingSelect
              key={key as string}
              label={label as string}
              value={building.kitchen[key as keyof typeof building.kitchen] as string}
              onChange={(v) => patchBuilding('kitchen', { [key as string]: v })}
              options={options as string[]}
            />
          ))}
        </div>
        <div className="inspection-note-panel">
          <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Switches</InspectionSubsectionHeading>
          <p>{LICENSED_ELECTRICIAN_INSPECTION}</p>
        </div>
        <InspectionSubsectionHeading as="h4">Door &amp; Window</InspectionSubsectionHeading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(['door', 'handle', 'window', 'windowLock'] as const).map((field) => (
            <RatingSelect
              key={field}
              disabled={disabled}
              label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
              value={building.kitchen[field]}
              onChange={(v) => patchBuilding('kitchen', { [field]: v })}
              options={[...FIXTURE_CONDITION]}
            />
          ))}
        </div>
        <CheckboxGroupField disabled={disabled} label="Walls" options={WALL_DEFECTS} value={building.kitchen.walls} onChange={(v) => patchBuilding('kitchen', { walls: v })} />
        <CheckboxGroupField disabled={disabled} label="Ceiling" options={WALL_DEFECTS} value={building.kitchen.ceiling} onChange={(v) => patchBuilding('kitchen', { ceiling: v })} />
        <div className="inspection-note-panel">
          <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Kitchen Disclaimer</InspectionSubsectionHeading>
          {KITCHEN_DISCLAIMERS.map((statement) => (
            <p key={statement}>{statement}</p>
          ))}
        </div>
        <SectionComments disabled={disabled} comments={building.kitchen.comments} photos={building.kitchen.photos} onCommentsChange={(v) => patchBuilding('kitchen', { comments: v })} onPhotosChange={(v) => patchBuilding('kitchen', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="laundry" title="Laundry" status={statuses.laundry ?? 'not_started'}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ['cabinetDamage', 'Cabinet Damage', ['No', 'Yes']],
            ['moistureDamage', 'Moisture Damage', ['No', 'Yes']],
            ['laundryTrough', 'Laundry Trough', ['Good', 'Fair', 'Poor']],
            ['drainage', 'Drainage', ['Not Blocked', 'Partially Blocked', 'Blocked']],
            ['leakage', 'Leakage', ['No', 'Yes']],
            ['tapDripping', 'Tap Dripping', ['No', 'Yes']],
            ['activeLeak', 'Active Leak', ['No', 'Yes']],
            ['waterPooling', 'Water Pooling', ['No', 'Yes']],
            ['floorWaste', 'Floor Waste', ['Not Blocked', 'Partially Blocked', 'Blocked']],
            ['moistureLevel', 'Moisture Damage Level', ['None', 'Minor', 'Moderate', 'Major']],
            ['lights', 'Lights Working', [...LIGHTS_SWITCHES_STATUS]],
            ['powerPoints', 'Power Points Working', [...ELECTRICAL_POINT_STATUS]],
            ['exhaustFan', 'Exhaust Fan', ['Working', 'Not Working', 'Undetermined', 'Not Present']],
          ].map(([key, label, options]) => (
            <RatingSelect
              key={key as string}
              label={label as string}
              value={building.laundry[key as keyof typeof building.laundry] as string}
              onChange={(v) => patchBuilding('laundry', { [key as string]: v })}
              options={options as string[]}
            />
          ))}
        </div>
        <InspectionSubsectionHeading as="h4">Splashback &amp; Floor</InspectionSubsectionHeading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RatingSelect
            disabled={disabled}
            label="Splashback"
            value={building.laundry.splashback || 'Good'}
            onChange={(v) => patchBuilding('laundry', { splashback: v })}
            options={[...SPLASHBACK_CONDITION]}
          />
          <RatingSelect
            disabled={disabled}
            label="Floor Type"
            value={building.laundry.floorType || 'Tiles'}
            onChange={(v) => patchBuilding('laundry', { floorType: v })}
            options={[...LAUNDRY_FLOOR_TYPES]}
          />
          <RatingSelect
            disabled={disabled}
            label="Floor Condition"
            value={building.laundry.floorCondition || 'Good'}
            onChange={(v) => patchBuilding('laundry', { floorCondition: v })}
            options={[...FLOOR_CONDITION]}
          />
        </div>
        <div className="inspection-note-panel">
          <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Switches</InspectionSubsectionHeading>
          <p>{LICENSED_ELECTRICIAN_INSPECTION}</p>
        </div>
        <InspectionSubsectionHeading as="h4">Door &amp; Window</InspectionSubsectionHeading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(['door', 'handle', 'window', 'windowLock'] as const).map((field) => (
            <RatingSelect
              key={field}
              disabled={disabled}
              label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
              value={building.laundry[field]}
              onChange={(v) => patchBuilding('laundry', { [field]: v })}
              options={[...FIXTURE_CONDITION]}
            />
          ))}
        </div>
        {building.laundry.waterPooling === 'Yes' && (
          <PhotoField disabled={disabled} label="Water Pooling Evidence" photos={building.laundry.waterPoolingPhotos} onChange={(v) => patchBuilding('laundry', { waterPoolingPhotos: v })} />
        )}
        <CheckboxGroupField disabled={disabled} label="Walls" options={WALL_DEFECTS} value={building.laundry.walls} onChange={(v) => patchBuilding('laundry', { walls: v })} />
        <CheckboxGroupField disabled={disabled} label="Ceiling" options={WALL_DEFECTS} value={building.laundry.ceiling} onChange={(v) => patchBuilding('laundry', { ceiling: v })} />
        <div className="inspection-note-panel">
          <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Laundry Disclaimer</InspectionSubsectionHeading>
          {LAUNDRY_DISCLAIMERS.map((statement) => (
            <p key={statement}>{statement}</p>
          ))}
        </div>
        <SectionComments disabled={disabled} comments={building.laundry.comments} photos={building.laundry.photos} onCommentsChange={(v) => patchBuilding('laundry', { comments: v })} onPhotosChange={(v) => patchBuilding('laundry', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="electrical-general" title="General Electrical Disclaimer" status={statuses['electrical-general'] ?? 'not_started'}>
        <div className="inspection-note-panel">
          {GENERAL_ELECTRICAL_DISCLAIMERS.map((statement) => (
            <p key={statement}>{statement}</p>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          These standard disclaimer statements are included automatically on every building report.
        </p>
        <SectionComments disabled={disabled} comments={building.electricalGeneral.comments} photos={building.electricalGeneral.photos} onCommentsChange={(v) => patchBuilding('electricalGeneral', { comments: v })} onPhotosChange={(v) => patchBuilding('electricalGeneral', { photos: v })} />
      </InspectionAccordionSection>

      {roomContent}

      <InspectionAccordionSection id="subfloor" title="Subfloor" status={statuses.subfloor ?? 'not_started'}>
        <CheckboxGroupField disabled={disabled} label="Elements" options={SUBFLOOR_ELEMENTS} value={building.subfloor.elements} onChange={(v) => patchBuilding('subfloor', { elements: v })} />
        <SectionComments disabled={disabled} comments={building.subfloor.comments} photos={building.subfloor.photos} onCommentsChange={(v) => patchBuilding('subfloor', { comments: v })} onPhotosChange={(v) => patchBuilding('subfloor', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="fencing" title="Fencing" status={statuses.fencing ?? 'not_started'}>
        <CheckboxGroupField disabled={disabled} label="Materials" options={FENCING_MATERIALS} value={building.fencing.materials} onChange={(v) => patchBuilding('fencing', { materials: v })} />
        <SectionComments disabled={disabled} comments={building.fencing.comments} photos={building.fencing.photos} onCommentsChange={(v) => patchBuilding('fencing', { comments: v })} onPhotosChange={(v) => patchBuilding('fencing', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="outbuildings" title="Outbuildings" status={statuses.outbuildings ?? 'not_started'}>
        <CheckboxGroupField disabled={disabled} label="Types" options={OUTBUILDING_TYPES} value={building.outbuildings.types} onChange={(v) => patchBuilding('outbuildings', { types: v })} />
        <RatingSelect label="Condition" value={building.outbuildings.condition} onChange={(v) => patchBuilding('outbuildings', { condition: v })} options={['Good', 'Fair', 'Poor']} />
        <SectionComments disabled={disabled} comments={building.outbuildings.comments} photos={building.outbuildings.photos} onCommentsChange={(v) => patchBuilding('outbuildings', { comments: v })} onPhotosChange={(v) => patchBuilding('outbuildings', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="corrosion" title="Corrosion" status={statuses.corrosion ?? 'not_started'}>
        <CheckboxGroupField disabled={disabled} label="Items" options={CORROSION_ITEMS} value={building.corrosion.items} onChange={(v) => patchBuilding('corrosion', { items: v })} />
        <SectionComments disabled={disabled} comments={building.corrosion.comments} photos={building.corrosion.photos} onCommentsChange={(v) => patchBuilding('corrosion', { comments: v })} onPhotosChange={(v) => patchBuilding('corrosion', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="minor-defects" title="Minor Defects" status={statuses['minor-defects'] ?? 'not_started'}>
        <CheckboxGroupField disabled={disabled} label="Checklist" options={MINOR_DEFECT_PRESETS} value={building.minorDefects.checklist} onChange={(v) => patchBuilding('minorDefects', { checklist: v })} />
        <SectionComments disabled={disabled} comments={building.minorDefects.comments} photos={building.minorDefects.photos} onCommentsChange={(v) => patchBuilding('minorDefects', { comments: v })} onPhotosChange={(v) => patchBuilding('minorDefects', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="major-defects" title="Major Defects" status={statuses['major-defects'] ?? 'not_started'}>
        <CheckboxGroupField disabled={disabled} label="Structural Movement" options={STRUCTURAL_MOVEMENT} value={building.majorDefects.structuralMovement} onChange={(v) => patchBuilding('majorDefects', { structuralMovement: v })} />
        <YesNoSelect label="Engineering Inspection Required" value={building.majorDefects.structuralEngineeringRequired} onChange={(v) => patchBuilding('majorDefects', { structuralEngineeringRequired: v })} />
        <CheckboxGroupField disabled={disabled} label="Deformation / Sagging" options={DEFORMATION_ITEMS} value={building.majorDefects.deformation} onChange={(v) => patchBuilding('majorDefects', { deformation: v })} />
        <CheckboxGroupField disabled={disabled} label="Source of Moisture" options={MOISTURE_SOURCES} value={building.majorDefects.moistureSources} onChange={(v) => patchBuilding('majorDefects', { moistureSources: v })} />
        <SectionComments disabled={disabled} comments={building.majorDefects.comments} photos={building.majorDefects.photos} onCommentsChange={(v) => patchBuilding('majorDefects', { comments: v })} onPhotosChange={(v) => patchBuilding('majorDefects', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="thermal-imaging" title="Thermal Imaging" status={statuses['thermal-imaging'] ?? 'not_started'}>
        <SectionComments disabled={disabled} comments={building.thermalImaging.comments} photos={building.thermalImaging.photos} onCommentsChange={(v) => patchBuilding('thermalImaging', { comments: v })} onPhotosChange={(v) => patchBuilding('thermalImaging', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="moisture-testing" title="Moisture Testing" status={statuses['moisture-testing'] ?? 'not_started'}>
        <YesNoSelect label="Visual Moisture Evidence" value={building.moistureTesting.visualMoistureEvidence} onChange={(v) => patchBuilding('moistureTesting', { visualMoistureEvidence: v })} />
        <CheckboxGroupField disabled={disabled} label="Visual Locations" options={['Bathroom', 'Kitchen', 'Laundry', 'External', 'Roof Space']} value={building.moistureTesting.visualLocations} onChange={(v) => patchBuilding('moistureTesting', { visualLocations: v })} />
        <YesNoSelect label="Excessive Moisture Evidence" value={building.moistureTesting.excessiveMoistureEvidence} onChange={(v) => patchBuilding('moistureTesting', { excessiveMoistureEvidence: v })} />
        <PhotoField disabled={disabled} label="Moisture Meter Photos" photos={building.moistureTesting.moistureMeterPhotos} onChange={(v) => patchBuilding('moistureTesting', { moistureMeterPhotos: v })} />
        <PhotoField disabled={disabled} label="Thermal Images" photos={building.moistureTesting.thermalImages} onChange={(v) => patchBuilding('moistureTesting', { thermalImages: v })} />
        <SectionComments disabled={disabled} comments={building.moistureTesting.comments} photos={building.moistureTesting.photos} onCommentsChange={(v) => patchBuilding('moistureTesting', { comments: v })} onPhotosChange={(v) => patchBuilding('moistureTesting', { photos: v })} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="conclusion" title="Conclusion" status={statuses.conclusion ?? 'not_started'}>
        <div className="grid gap-4 md:grid-cols-2">
          <RatingSelect label="Structural Damage Rating" value={building.conclusion.structuralDamageRating} onChange={(v) => patchBuilding('conclusion', { structuralDamageRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Conditions Conducive Rating" value={building.conclusion.conditionsConduciveRating} onChange={(v) => patchBuilding('conclusion', { conditionsConduciveRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Major Defects Rating" value={building.conclusion.majorDefectsRating} onChange={(v) => patchBuilding('conclusion', { majorDefectsRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Minor Defects Rating" value={building.conclusion.minorDefectsRating} onChange={(v) => patchBuilding('conclusion', { minorDefectsRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Overall Building Condition" value={building.conclusion.overallBuildingCondition} onChange={(v) => patchBuilding('conclusion', { overallBuildingCondition: v })} options={OVERALL_BUILDING_CONDITION} />
          <RatingSelect label="Overall Comparison" value={building.conclusion.overallComparison} onChange={(v) => patchBuilding('conclusion', { overallComparison: v, autoConclusion: '' })} options={OVERALL_COMPARISON} />
        </div>
        <Textarea label="Auto Conclusion Paragraph" value={building.conclusion.autoConclusion} onChange={(e) => patchBuilding('conclusion', { autoConclusion: e.target.value })} rows={6} />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="recommendations" title="Recommendations" status={statuses.recommendations ?? 'not_started'}>
        <div className="inspection-subpanel text-sm">
          <p className="inspection-subsection-heading">Auto Recommendations</p>
          <ul className="list-disc pl-5">
            {building.recommendations.autoRecommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <CheckboxGroupField disabled={disabled}
          label="Manual Recommendations"
          options={RECOMMENDATION_PRESETS}
          value={manualRecommendations}
          onChange={(v) => patchBuilding('recommendations', { manualRecommendations: [...v.selected, ...v.custom] })}
          allowCustom
        />
      </InspectionAccordionSection>

      <InspectionAccordionSection id="inspector-declaration" title="Inspector Declaration" status={statuses['inspector-declaration'] ?? 'not_started'}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Inspector Name" value={building.inspectorDeclaration.inspectorName} onChange={(e) => patchBuilding('inspectorDeclaration', { inspectorName: e.target.value })} />
          <Input label="Licence Number" value={building.inspectorDeclaration.licenceNumber} onChange={(e) => patchBuilding('inspectorDeclaration', { licenceNumber: e.target.value })} />
          <Input label="Declaration Date" type="date" value={building.inspectorDeclaration.declarationDate} onChange={(e) => patchBuilding('inspectorDeclaration', { declarationDate: e.target.value })} />
        </div>
        <InspectorSignatureField
          disabled={disabled}
          label="Inspector Signature"
          value={building.inspectorDeclaration.signatureData}
          onChange={(signatureData) => patchBuilding('inspectorDeclaration', { signatureData })}
        />
        <InspectorSignatureField
          disabled={disabled}
          label="Client Signature (optional)"
          value={building.inspectorDeclaration.clientSignatureData}
          onChange={(clientSignatureData) => patchBuilding('inspectorDeclaration', { clientSignatureData })}
          useSavedDefault={false}
        />
      </InspectionAccordionSection>
        </>
      )}
    </>
  );

  if (embedded) {
    return sections;
  }

  return (
    <InspectionFormProvider>
      <InspectionAccordion defaultOpenId="inspector-hazard">{sections}</InspectionAccordion>
    </InspectionFormProvider>
  );
}
