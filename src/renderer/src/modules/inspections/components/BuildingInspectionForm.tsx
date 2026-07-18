import { useDeferredValue, useMemo, useState } from 'react';
import {
  ACCESSIBILITY_AREAS,
  AC_TYPES,
  BUILDING_CONDITIONS_CONDUCIVE,
  BUILDING_MAJOR_SAFETY_HAZARDS,
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
  HOT_WATER_TYPES,
  HOT_WATER_LOCATION_OPTIONS,
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
  QUALITY_OF_WORKMANSHIP_RATINGS,
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
  buildNoMajorDefectPatch,
  buildMajorDefectPatch,
  clearDefectQuickPatch,
  defaultIfEmptyWorkingStatus,
  NO_ISSUES_OBSERVED_COMMENT,
  SUBFLOOR_PRESENT_OPTIONS,
  accessibilityAreasWithoutSubfloor,
  inaccessibleAreasWithoutSubfloor,
  isSubfloorApplicable,
  collectMajorDefectAutoSuggestions,
  hasLinkedServiceObstructionPhotos,
  normalizeCheckboxField,
  resolveRoomReportLabels,
  resolveSubfloorPresent,
  applyRoofFramingFinding,
  clearRoofFramingFinding,
  updateMajorDefectCheckboxField,
  ACCESSIBILITY_AREA_REASON_OPTIONS,
  getMissingAccessibilityAreas,
  lockedInaccessibleAreaMessage,
  resolveAccessibilityAreaForRoute,
  setInaccessibleAreaReason,
  syncInaccessibleAreasFromAccessibility,
  type BuildingExtensionSections,
  type CheckboxFieldState,
  type InspectionFormDataV2,
  type InspectionFormRealm,
  type MajorDefectRollupDismissibleField,
  type SharedInspectionSections,
} from '@sitescop/room-engine-core';
import { Button, Input, Modal, Select, Textarea } from '@/design-system/components';
import { AlertTriangle } from 'lucide-react';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { InspectionAccordion, InspectionAccordionSection } from './InspectionAccordion';
import { CheckboxGroupField, InspectionSubsectionHeading, PhotoField, RatingSelect, SectionComments, YesNoSelect } from './InspectionFields';
import { InspectorHazardAssessmentFields } from './InspectorHazardAssessmentFields';
import { CertificationStatement } from './CertificationStatement';
import { InspectorSignatureField } from './InspectorSignatureField';
import { JobInformationSection } from './JobInformationSection';
import { InspectionFormProvider, InspectionSubPanel } from './InspectionFormUi';
import { buildInspectionSectionStatuses, type SectionCompletionStatus } from './section-completion';
import { buildInspectionRouteIds, type InspectionRouteFormKind } from './inspection-route';
import { InspectionRoomSections } from './InspectionRoomSections';
import { NoMajorDefectSectionWrapper } from './NoMajorDefectSectionWrapper';
import { AreaInaccessibleBanner } from './AreaInaccessibleBanner';
import { SectionQuickActions } from './SectionQuickActions';
import { CrackingRegisterField } from './CrackingRegisterField';
import { FinishElementDamageField } from './FinishElementDamageField';
import { RoofSpaceFramingDiagram } from './RoofSpaceFramingDiagram';
import { useDebouncedValue } from '@/modules/inspections/hooks/useDebouncedValue';

const SUBFLOOR_INACCESSIBLE = new Set([
  'Unsafe subfloor access',
  'Subfloor access obstructed',
  'Low height clearance — inspector unable to enter and inspect',
  'Restricted or undersized access hatch',
  'Low ground clearance',
  'Standing water or flooding',
]);

function stripSubfloorFromAccessibility(
  accessibility: SharedInspectionSections['accessibilityObstructions'],
): Partial<SharedInspectionSections['accessibilityObstructions']> {
  const areas = normalizeCheckboxField(accessibility.accessibilityAreas);
  const inaccessible = normalizeCheckboxField(accessibility.inaccessibleAreas);
  const { Subfloor: _removed, ...restReasons } = accessibility.inaccessibleAreaReasons ?? {};
  return {
    accessibilityAreas: {
      selected: areas.selected.filter((item) => item !== 'Subfloor'),
      custom: areas.custom.filter((item) => item !== 'Subfloor'),
    },
    subfloorObstructions: { selected: [], custom: [] },
    subfloorObstructionPhotos: [],
    inaccessibleAreas: {
      selected: inaccessible.selected.filter(
        (item) => item !== 'Subfloor' && !SUBFLOOR_INACCESSIBLE.has(item),
      ),
      custom: inaccessible.custom.filter(
        (item) => item !== 'Subfloor' && !SUBFLOOR_INACCESSIBLE.has(item),
      ),
    },
    inaccessibleAreaReasons: restReasons,
  };
}

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
  formKind?: InspectionRouteFormKind;
  workflowStorageKey?: string;
  computedStatuses?: Record<string, SectionCompletionStatus>;
  computedMajorDefectAuto?: ReturnType<typeof collectMajorDefectAutoSuggestions> | null;
  /** Workspace v2: render only this route section (no accordion, no other sections). */
  onlySectionId?: string;
}

const DERIVED_UI_DEBOUNCE_MS = 180;

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
  formKind: formKindProp,
  workflowStorageKey,
  computedStatuses,
  computedMajorDefectAuto,
  onlySectionId,
}: BuildingInspectionFormProps) {
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [lockedAreaMessage, setLockedAreaMessage] = useState<string | null>(null);
  const disabled = Boolean(readOnly);
  const building = formData.building;
  const showShared = mode === 'full' || mode === 'shared-only';
  const showBuilding = (mode === 'full' || mode === 'building-only') && building;
  const formKind: InspectionRouteFormKind =
    formKindProp ??
    (formData.pest && formData.building ? 'COMBINED' : formData.pest ? 'PEST' : 'BUILDING');

  const p = formData.shared.propertyDescription;
  const a = formData.shared.accessibilityObstructions;
  const subfloorPresent = resolveSubfloorPresent(p, building?.subfloor, a);
  const subfloorApplicable = isSubfloorApplicable(subfloorPresent);
  const conduciveOptions = useMemo(
    () =>
      subfloorApplicable
        ? [...BUILDING_CONDITIONS_CONDUCIVE]
        : BUILDING_CONDITIONS_CONDUCIVE.filter((item) => item !== 'Subfloor moisture / poor drainage'),
    [subfloorApplicable],
  );

  const showSection = (id: string) => !onlySectionId || onlySectionId === id;
  const needsDerivedUi = !onlySectionId || onlySectionId === 'major-defects';

  const skipDebouncedDerived = Boolean(onlySectionId && computedStatuses);
  const deferredFormData = useDeferredValue(formData);
  const deferredRooms = useDeferredValue(rooms);
  const debouncedFormData = useDebouncedValue(deferredFormData, DERIVED_UI_DEBOUNCE_MS);
  const debouncedRooms = useDebouncedValue(deferredRooms, DERIVED_UI_DEBOUNCE_MS);
  const derivedFormData = skipDebouncedDerived ? formData : debouncedFormData;
  const derivedRooms = skipDebouncedDerived ? rooms : debouncedRooms;

  const derivedStatuses = useMemo(
    () => {
      if (computedStatuses) return {};
      if (!needsDerivedUi) return {};
      return buildInspectionSectionStatuses(derivedFormData, derivedRooms);
    },
    [computedStatuses, derivedFormData, derivedRooms, needsDerivedUi],
  );
  const statuses = computedStatuses ?? derivedStatuses;

  const routeIds = useMemo(
    () =>
      onlySectionId
        ? []
        : buildInspectionRouteIds({
            formKind: 'BUILDING',
            mode,
            subfloorApplicable,
            rooms,
          }),
    [mode, onlySectionId, subfloorApplicable, rooms],
  );

  const derivedMajorDefectAuto = useMemo(() => {
    if (computedMajorDefectAuto !== undefined) return null;
    if (!building || !needsDerivedUi) return null;
    const roomInputs = derivedRooms.map((room) => ({
      roomType: room.roomType,
      roomIndex: room.roomIndex,
      label: room.label,
      data: room.data,
    }));
    const roomLabels = resolveRoomReportLabels(roomInputs);
    return collectMajorDefectAutoSuggestions({
      shared: derivedFormData.shared,
      building: derivedFormData.building!,
      rooms: derivedRooms.map((room, index) => ({
        id: room.id,
        label: roomLabels[index],
        roomType: room.roomType,
        data: room.data,
      })),
      subfloorApplicable,
    });
  }, [building, computedMajorDefectAuto, derivedFormData, derivedRooms, needsDerivedUi, subfloorApplicable]);
  const majorDefectAuto = computedMajorDefectAuto ?? derivedMajorDefectAuto;

  const patchMajorDefectCheckbox = (
    field: MajorDefectRollupDismissibleField,
    value: CheckboxFieldState,
  ) => {
    if (!building || !majorDefectAuto) return;
    patchBuilding('majorDefects', updateMajorDefectCheckboxField(
      building.majorDefects,
      field,
      value,
      majorDefectAuto[field],
    ));
  };

  if (!showShared && !showBuilding) return null;

  const patchShared = (section: keyof SharedInspectionSections, partial: Record<string, unknown>) => {
    if (readOnly) return;
    onSectionChange('shared', section, partial);
  };

  const patchBuilding = (section: keyof BuildingExtensionSections, partial: Record<string, unknown>) => {
    if (readOnly) return;
    onSectionChange('building', section, partial);
  };

  const missingLockedAreas = getMissingAccessibilityAreas(a.accessibilityAreas, subfloorApplicable);
  const inaccessibleReasons = a.inaccessibleAreaReasons ?? {};
  const sectionAccessibilityLock = (routeId: string) => {
    const area = resolveAccessibilityAreaForRoute(routeId);
    if (!area || !missingLockedAreas.includes(area)) {
      return { area: null as string | null, reason: undefined as string | undefined };
    }
    return { area, reason: inaccessibleReasons[area] };
  };

  const patchAccessibilityAreas = (value: CheckboxFieldState) => {
    const synced = syncInaccessibleAreasFromAccessibility(
      { ...a, accessibilityAreas: value },
      subfloorApplicable,
    );
    // Single section patch — enrich applies reason comments across the form in-memory,
    // and the 30s save persists the full enriched form on the server. Do not fan out
    // extra patchSection/patchRoom calls (that was freezing scroll/work).
    patchShared('accessibilityObstructions', {
      accessibilityAreas: synced.accessibilityAreas,
      inaccessibleAreas: synced.inaccessibleAreas,
      inaccessibleAreaReasons: synced.inaccessibleAreaReasons,
      interiorObstructions: synced.interiorObstructions,
      exteriorObstructions: synced.exteriorObstructions,
      roofSpaceObstructions: synced.roofSpaceObstructions,
      subfloorObstructions: synced.subfloorObstructions,
      interiorObstructionPhotos: synced.interiorObstructionPhotos,
      exteriorObstructionPhotos: synced.exteriorObstructionPhotos,
      roofSpaceObstructionPhotos: synced.roofSpaceObstructionPhotos,
      subfloorObstructionPhotos: synced.subfloorObstructionPhotos,
    });
  };

  const patchInaccessibleReason = (area: string, reason: string) => {
    const synced = setInaccessibleAreaReason(a, area, reason, subfloorApplicable);
    patchShared('accessibilityObstructions', {
      inaccessibleAreas: synced.inaccessibleAreas,
      inaccessibleAreaReasons: synced.inaccessibleAreaReasons,
      interiorObstructions: synced.interiorObstructions,
      exteriorObstructions: synced.exteriorObstructions,
      roofSpaceObstructions: synced.roofSpaceObstructions,
      subfloorObstructions: synced.subfloorObstructions,
      interiorObstructionPhotos: synced.interiorObstructionPhotos,
      exteriorObstructionPhotos: synced.exteriorObstructionPhotos,
      roofSpaceObstructionPhotos: synced.roofSpaceObstructionPhotos,
      subfloorObstructionPhotos: synced.subfloorObstructionPhotos,
    });
  };

  const patchInaccessibleAreas = (value: CheckboxFieldState) => {
    const locked = getMissingAccessibilityAreas(a.accessibilityAreas, subfloorApplicable);
    const lockedSet = new Set<string>(locked);
    const next = normalizeCheckboxField(value);
    let selected = [...new Set([...next.selected.filter((item) => !lockedSet.has(item)), ...locked])];
    if (locked.length > 0) {
      selected = selected.filter((item) => item !== 'All areas permitted entry');
    }
    patchShared('accessibilityObstructions', {
      inaccessibleAreas: {
        selected,
        custom: next.custom.filter((item) => !lockedSet.has(item)),
      },
    });
  };

  const onLockedInaccessibleToggle = (option: string) => {
    setLockedAreaMessage(lockedInaccessibleAreaMessage(option));
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
  const accessibilityAreaOptions = subfloorApplicable ? ACCESSIBILITY_AREAS : accessibilityAreasWithoutSubfloor(ACCESSIBILITY_AREAS);
  const inaccessibleAreaOptions = subfloorApplicable
    ? INACCESSIBLE_AREA_PRESETS
    : inaccessibleAreasWithoutSubfloor(INACCESSIBLE_AREA_PRESETS);

  const handleSubfloorPresentChange = (value: string) => {
    patchShared('propertyDescription', { subfloorPresent: value });
    if (value === 'No') {
      const stripped = stripSubfloorFromAccessibility(a);
      const synced = syncInaccessibleAreasFromAccessibility(
        { ...a, ...stripped },
        false,
      );
      patchShared('accessibilityObstructions', {
        ...stripped,
        inaccessibleAreas: synced.inaccessibleAreas,
        inaccessibleAreaReasons: synced.inaccessibleAreaReasons,
        interiorObstructions: synced.interiorObstructions,
        exteriorObstructions: synced.exteriorObstructions,
        roofSpaceObstructions: synced.roofSpaceObstructions,
        subfloorObstructions: synced.subfloorObstructions,
        interiorObstructionPhotos: synced.interiorObstructionPhotos,
        exteriorObstructionPhotos: synced.exteriorObstructionPhotos,
        roofSpaceObstructionPhotos: synced.roofSpaceObstructionPhotos,
        subfloorObstructionPhotos: synced.subfloorObstructionPhotos,
      });
    } else if (value === 'Yes') {
      const areas = normalizeCheckboxField(a.accessibilityAreas);
      if (!areas.selected.includes('Subfloor') && !areas.custom.includes('Subfloor')) {
        patchAccessibilityAreas({
          ...areas,
          selected: [...new Set([...areas.selected, 'Subfloor'])],
        });
      }
    }
  };
  const manualRecommendations = building
    ? splitManualRecommendations(building.recommendations.manualRecommendations)
    : { selected: [] as string[], custom: [] as string[] };

  const roomContent =
    !onlySectionId && rooms.length > 0 && onRoomDataChange && onRoomPatch ? (
      <InspectionRoomSections
        rooms={rooms}
        readOnly={readOnly}
        statuses={statuses}
        onRoomDataChange={onRoomDataChange}
        onRoomPatch={onRoomPatch}
        inaccessibleArea={sectionAccessibilityLock('kitchen').area}
        inaccessibleReason={sectionAccessibilityLock('kitchen').reason}
      />
    ) : !onlySectionId ? (
      roomSections
    ) : null;

  const sections = (
    <>
      {showShared && (
        <>
      {showSection('inspector-hazard') && <InspectionAccordionSection id="inspector-hazard" title="Inspector Hazard Assessment" status={statuses['inspector-hazard']}
        render={() => (
        <>      <InspectorHazardAssessmentFields
        disabled={disabled}
        section={formData.shared.inspectorHazardAssessment}
        onChange={(partial) => patchShared('inspectorHazardAssessment', partial)}
      />
              </>
        )}
            />}

      {showSection('job-information') && <InspectionAccordionSection id="job-information" title="Job Information" status={statuses['job-information']}
        render={() => (
        <>      <JobInformationSection
        data={j}
        disabled={disabled}
        gpsCapturing={gpsCapturing}
        gpsStatus={gpsStatus}
        formKind={formKind}
        onChange={(partial) => patchShared('jobInformation', partial)}
        onCaptureGps={captureGps}
      />
              </>
        )}
            />}

      {showSection('services') && <InspectionAccordionSection id="services" title="Services" status={statuses.services}
        render={() => (
        <>        <CheckboxGroupField disabled={disabled} label="Water Supply" options={WATER_SUPPLY_OPTIONS} value={s.waterSupply} onChange={(v) => patchShared('services', { waterSupply: v })} />
        <Input label="Water Supply Other" value={s.waterSupplyOther} onChange={(e) => patchShared('services', { waterSupplyOther: e.target.value })} />
        <PhotoField
          disabled={disabled}
          label="Water Supply Photos"
          photos={s.waterSupplyPhotos ?? []}
          onChange={(photos) => patchShared('services', { waterSupplyPhotos: photos })}
        />
        <CheckboxGroupField disabled={disabled} label="Sewer" options={SEWER_OPTIONS} value={s.sewer} onChange={(v) => patchShared('services', { sewer: v })} />
        <PhotoField
          disabled={disabled}
          label="Sewer Photos"
          photos={s.sewerPhotos ?? []}
          onChange={(photos) => patchShared('services', { sewerPhotos: photos })}
        />
        <CheckboxGroupField disabled={disabled} label="Electricity" options={ELECTRICITY_OPTIONS} value={s.electricity} onChange={(v) => patchShared('services', { electricity: v })} />
        <PhotoField
          disabled={disabled}
          label="Electricity Photos"
          photos={s.electricityPhotos ?? []}
          onChange={(photos) => patchShared('services', { electricityPhotos: photos })}
        />
        <CheckboxGroupField disabled={disabled} label="Gas" options={GAS_OPTIONS} value={s.gas} onChange={(v) => patchShared('services', { gas: v })} />
        <PhotoField
          disabled={disabled}
          label="Gas Photos"
          photos={s.gasPhotos ?? []}
          onChange={(photos) => patchShared('services', { gasPhotos: photos })}
        />
        <InspectionSubPanel title="Hot Water System" className="!border-[#0B4F8C]/15 !bg-transparent !shadow-none">
          <div className="grid gap-4 md:grid-cols-3">
            <YesNoSelect label="Present?" value={s.hotWaterPresent} onChange={(v) => patchShared('services', { hotWaterPresent: v })} />
            <Select
              label="Hot Water System Location"
              value={s.hotWaterLocation}
              onChange={(e) => patchShared('services', { hotWaterLocation: e.target.value })}
              options={HOT_WATER_LOCATION_OPTIONS.map((v) => ({ value: v, label: v }))}
              placeholder="Select location"
            />
            <YesNoSelect label="Operating?" value={s.hotWaterOperating} onChange={(v) => patchShared('services', { hotWaterOperating: v })} includeNa />
          </div>
          <CheckboxGroupField
            disabled={disabled}
            label="Hot Water System Type"
            options={HOT_WATER_TYPES}
            value={s.hotWaterType}
            onChange={(v) => patchShared('services', { hotWaterType: v })}
            layout="horizontal"
            plainLabel
          />
          {s.hotWaterPresent === 'Yes' ? (
            <div className="space-y-4">
              <PhotoField
                disabled={disabled}
                label="Hot Water System Photos"
                photos={s.hotWaterPhotos}
                onChange={(photos) => patchShared('services', { hotWaterPhotos: photos })}
              />
              <Textarea
                label="Hot Water System Comments"
                commentsField
                dictationSectionId="services-hot-water"
                value={s.hotWaterComments ?? ''}
                disabled={disabled}
                onChange={(e) => patchShared('services', { hotWaterComments: e.target.value })}
                rows={3}
              />
            </div>
          ) : null}
        </InspectionSubPanel>
        <InspectionSubPanel title="Air Conditioning" className="!border-[#0B4F8C]/15 !bg-transparent !shadow-none">
          <div className="grid gap-4 md:grid-cols-2">
            <YesNoSelect label="Present?" value={s.airConPresent} onChange={(v) => patchShared('services', { airConPresent: v })} />
            <YesNoSelect label="Operating?" value={s.airConOperating} onChange={(v) => patchShared('services', { airConOperating: v })} includeNa />
          </div>
          <CheckboxGroupField
            disabled={disabled}
            label="Type"
            options={AC_TYPES}
            value={s.airConType}
            onChange={(v) => patchShared('services', { airConType: v })}
            layout="horizontal"
            plainLabel
          />
          {s.airConPresent === 'Yes' ? (
            <div className="space-y-4">
              <PhotoField
                disabled={disabled}
                label="Air Conditioning Photos"
                photos={s.airConPhotos ?? []}
                onChange={(photos) => patchShared('services', { airConPhotos: photos })}
              />
              <Textarea
                label="Air Conditioning Comments"
                commentsField
                dictationSectionId="services-air-conditioning"
                value={s.airConComments ?? ''}
                disabled={disabled}
                onChange={(e) => patchShared('services', { airConComments: e.target.value })}
                rows={3}
              />
            </div>
          ) : null}
        </InspectionSubPanel>
        {normalizeCheckboxField(s.gas).selected.includes('LPG') || s.gasOther.toLowerCase().includes('lpg') ? (
          <PhotoField
            disabled={disabled}
            label="LPG / Gas Bottle Photos"
            photos={s.gasBottlePhotos}
            onChange={(photos) => patchShared('services', { gasBottlePhotos: photos })}
          />
        ) : null}
        <InspectionSubPanel title="Rainwater Tank">
          <div className="grid gap-4 md:grid-cols-3">
            <YesNoSelect
              label="Present?"
              value={s.rainwaterTankPresent}
              onChange={(v) => patchShared('services', { rainwaterTankPresent: v })}
            />
          </div>
          {s.rainwaterTankPresent === 'Yes' ? (
            <div className="space-y-4">
              <PhotoField
                disabled={disabled}
                label="Rainwater Tank Photos"
                photos={s.rainwaterTankPhotos}
                onChange={(photos) => patchShared('services', { rainwaterTankPhotos: photos })}
              />
              <Textarea
                label="Rainwater Tank Comments"
                commentsField
                dictationSectionId="services-rainwater-tank"
                value={s.rainwaterTankComments ?? ''}
                disabled={disabled}
                onChange={(e) => patchShared('services', { rainwaterTankComments: e.target.value })}
                rows={3}
              />
            </div>
          ) : null}
        </InspectionSubPanel>
        <SectionComments sectionId="services" disabled={disabled} comments={s.comments} photos={s.photos} onCommentsChange={(v) => patchShared('services', { comments: v })} onPhotosChange={(v) => patchShared('services', { photos: v })} />
              </>
        )}
            />}

      {showSection('property-description') && <InspectionAccordionSection id="property-description" title="Property Description" status={statuses['property-description']}
        render={() => (
        <>        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Subfloor Space Present?"
            placeholder="Select..."
            value={p.subfloorPresent}
            onChange={(e) => handleSubfloorPresentChange(e.target.value)}
            options={SUBFLOOR_PRESENT_OPTIONS.map((v) => ({ value: v, label: v }))}
            className="md:col-span-2"
          />
          {!subfloorApplicable ? (
            <p className="md:col-span-2 rounded-lg border border-secondary/25 bg-secondary/[0.06] px-3 py-2 text-sm text-secondary">
              No subfloor space — subfloor inspection sections are hidden for this property. Existing subfloor data is kept if you change this later.
            </p>
          ) : null}
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
              </>
        )}
            />}

      {showSection('accessibility') && <InspectionAccordionSection id="accessibility" title="Accessibility & Risk Assessment" status={statuses.accessibility}
        render={() => (
        <>        <p className="text-sm text-text-muted">
          {formKind === 'PEST'
            ? 'Record obstructions and inaccessible areas. Undetected Timber Pest Risk is assessed in the Timber Pest Risk Assessment section.'
            : 'Record obstructions and inaccessible areas first. Undetected Structural Damage Risk defaults to Moderate and increases automatically when limitations are present — for example a dog, locked rooms, stored goods, or unsafe access.'}
        </p>
        <CheckboxGroupField
          disabled={disabled}
          label="Accessibility Areas"
          options={accessibilityAreaOptions}
          value={a.accessibilityAreas}
          onChange={patchAccessibilityAreas}
        />
        {missingLockedAreas.includes('Interior') ? (
          <p className="rounded-lg border border-[#B45309]/30 bg-[#FFFBEB] px-3 py-2 text-sm text-[#92400E]">
            A — Building Interior Obstructions: not applicable — Interior is inaccessible (not ticked in Accessibility Areas).
          </p>
        ) : (
          <>
            <CheckboxGroupField disabled={disabled} label="A - Building Interior Obstructions" options={INTERIOR_OBSTRUCTIONS} value={a.interiorObstructions} onChange={(v) => patchShared('accessibilityObstructions', { interiorObstructions: v })} />
            <PhotoField
              disabled={disabled}
              label="A — Interior Obstruction Photos"
              photos={a.interiorObstructionPhotos ?? []}
              onChange={(v) => patchShared('accessibilityObstructions', { interiorObstructionPhotos: v })}
            />
          </>
        )}
        {missingLockedAreas.includes('Exterior') ? (
          <p className="rounded-lg border border-[#B45309]/30 bg-[#FFFBEB] px-3 py-2 text-sm text-[#92400E]">
            B — Building Exterior Obstructions: not applicable — Exterior is inaccessible (not ticked in Accessibility Areas).
          </p>
        ) : (
          <>
            <CheckboxGroupField disabled={disabled} label="B - Building Exterior Obstructions" options={EXTERIOR_OBSTRUCTIONS} value={a.exteriorObstructions} onChange={(v) => patchShared('accessibilityObstructions', { exteriorObstructions: v })} />
            <PhotoField
              disabled={disabled}
              label="B — Exterior Obstruction Photos"
              photos={a.exteriorObstructionPhotos ?? []}
              onChange={(v) => patchShared('accessibilityObstructions', { exteriorObstructionPhotos: v })}
            />
          </>
        )}
        {missingLockedAreas.includes('Roof Space') ? (
          <p className="rounded-lg border border-[#B45309]/30 bg-[#FFFBEB] px-3 py-2 text-sm text-[#92400E]">
            C — Roof Space Obstructions: not applicable — Roof Space is inaccessible (not ticked in Accessibility Areas).
          </p>
        ) : (
          <>
            <CheckboxGroupField disabled={disabled} label="C - Roof Space Obstructions" options={ROOF_SPACE_OBSTRUCTIONS} value={a.roofSpaceObstructions} onChange={(v) => patchShared('accessibilityObstructions', { roofSpaceObstructions: v })} />
            <PhotoField
              disabled={disabled}
              label="C — Roof Space Obstruction Photos"
              photos={a.roofSpaceObstructionPhotos ?? []}
              onChange={(v) => patchShared('accessibilityObstructions', { roofSpaceObstructionPhotos: v })}
            />
          </>
        )}
        {subfloorApplicable ? (
          missingLockedAreas.includes('Subfloor') ? (
            <p className="rounded-lg border border-[#B45309]/30 bg-[#FFFBEB] px-3 py-2 text-sm text-[#92400E]">
              D — Subfloor Space Obstructions: not applicable — Subfloor is inaccessible (not ticked in Accessibility Areas).
            </p>
          ) : (
            <>
              <CheckboxGroupField disabled={disabled} label="D - Subfloor Space Obstructions" options={SUBFLOOR_OBSTRUCTIONS} value={a.subfloorObstructions} onChange={(v) => patchShared('accessibilityObstructions', { subfloorObstructions: v })} />
              <PhotoField
                disabled={disabled}
                label="D — Subfloor Obstruction Photos"
                photos={a.subfloorObstructionPhotos ?? []}
                onChange={(v) => patchShared('accessibilityObstructions', { subfloorObstructionPhotos: v })}
              />
            </>
          )
        ) : null}
        <CheckboxGroupField
          disabled={disabled}
          label="Inaccessible Areas"
          options={inaccessibleAreaOptions}
          value={a.inaccessibleAreas}
          onChange={patchInaccessibleAreas}
          lockedOptions={missingLockedAreas}
          onLockedToggleAttempt={onLockedInaccessibleToggle}
        />
        {missingLockedAreas.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-[#B45309]/40 bg-[#FFFBEB] p-3">
            <p className="text-sm font-semibold text-[#92400E]">
              Reasons for areas locked from Accessibility Areas
            </p>
            {missingLockedAreas.map((area) => {
              const reasonOptions = ACCESSIBILITY_AREA_REASON_OPTIONS[area] ?? [];
              return (
                <Select
                  key={area}
                  label={`${area} — inaccessible reason`}
                  placeholder="Select reason"
                  value={inaccessibleReasons[area] ?? ''}
                  onChange={(e) => patchInaccessibleReason(area, e.target.value)}
                  options={reasonOptions.map((v) => ({ value: v, label: v }))}
                />
              );
            })}
          </div>
        ) : null}
        <Input
          label="Inaccessible Area Notes"
          value={(a.inaccessibleCustomLines ?? [''])[0] ?? ''}
          onChange={(e) => patchShared('accessibilityObstructions', { inaccessibleCustomLines: [e.target.value] })}
        />
        {formKind !== 'PEST' && (
          <>
            <RatingSelect label="Undetected Structural Damage Risk" value={a.undetectedStructuralRisk} onChange={(v) => patchShared('accessibilityObstructions', { undetectedStructuralRisk: v })} options={RISK_LEVELS} />
            <Textarea label="Risk Explanation (auto-generated, editable)" value={a.riskExplanation} onChange={(e) => patchShared('accessibilityObstructions', { riskExplanation: e.target.value })} rows={5} />
          </>
        )}
        <SectionComments sectionId="accessibility" disabled={disabled} comments={a.comments} photos={a.photos} onCommentsChange={(v) => patchShared('accessibilityObstructions', { comments: v })} onPhotosChange={(v) => patchShared('accessibilityObstructions', { photos: v })} />
        {hasLinkedServiceObstructionPhotos(s) ? (
          <p className="text-xs text-text-muted">
            Matching service photos are copied into Interior/Exterior obstruction photos (hot water by
            location, air con, LPG bottles, rainwater tank). They stay under Services too and are not
            put in this Accessibility comments photo field.
          </p>
        ) : null}
              </>
        )}
            />}

      {showSection('site-conditions') && <InspectionAccordionSection id="site-conditions" title="Site Conditions" status={statuses['site-conditions']}
        render={() => {
          const siteLock = sectionAccessibilityLock('site-conditions');
          return (
        <>
        {siteLock.area ? (
          <AreaInaccessibleBanner area={siteLock.area} reason={siteLock.reason} />
        ) : (
          <>
            <SectionQuickActions
              disabled={disabled}
              onNoIssues={() =>
                patchShared('siteConditions', {
                  landSlope: 'Generally Level',
                  surfaceDrainage: 'Adequate',
                  evidenceOfWaterPooling: 'No',
                  comments: NO_ISSUES_OBSERVED_COMMENT,
                })
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              <RatingSelect label="Land Slope" value={formData.shared.siteConditions.landSlope} onChange={(v) => patchShared('siteConditions', { landSlope: v })} options={LAND_SLOPE} />
              <RatingSelect label="Surface Drainage" value={formData.shared.siteConditions.surfaceDrainage} onChange={(v) => patchShared('siteConditions', { surfaceDrainage: v })} options={DRAINAGE_RATING} />
              <YesNoSelect label="Evidence Of Water Pooling" value={formData.shared.siteConditions.evidenceOfWaterPooling} onChange={(v) => patchShared('siteConditions', { evidenceOfWaterPooling: v })} />
            </div>
            <CheckboxGroupField disabled={disabled} label="Site Drainage Concerns" options={SITE_DRAINAGE_CONCERNS} value={formData.shared.siteConditions.siteDrainageConcerns} onChange={(v) => patchShared('siteConditions', { siteDrainageConcerns: v })} />
          </>
        )}
        <SectionComments sectionId="site-conditions" disabled={disabled} comments={formData.shared.siteConditions.comments} photos={formData.shared.siteConditions.photos} onCommentsChange={(v) => patchShared('siteConditions', { comments: v })} onPhotosChange={(v) => patchShared('siteConditions', { photos: v })} />
              </>
          );
        }}
            />}

      {showSection('external') && <InspectionAccordionSection id="external" title="External" status={statuses.external}
        render={() => {
          const externalLock = sectionAccessibilityLock('external');
          return (
        <>        <NoMajorDefectSectionWrapper
          disabled={disabled}
          inaccessibleArea={externalLock.area}
          inaccessibleReason={externalLock.reason}
          noMajorActive={Boolean(formData.shared.external.noMajorDefectObserved)}
          majorActive={Boolean(formData.shared.external.majorDefectObserved)}
          onApply={() =>
            patchShared('external', {
              ...buildNoMajorDefectPatch(),
              externalDefects: { selected: [], custom: [] },
              damageObserved: { selected: [], custom: [] },
            })
          }
          onApplyMajor={() =>
            patchShared('external', {
              ...buildMajorDefectPatch(),
              externalDefects: { selected: [], custom: [] },
              damageObserved: { selected: [], custom: [] },
            })
          }
          onReportDefects={() => patchShared('external', clearDefectQuickPatch())}
        >
          <CheckboxGroupField disabled={disabled} label="External Defects" options={EXTERNAL_DEFECTS} value={formData.shared.external.externalDefects} onChange={(v) => patchShared('external', { externalDefects: v })} />
          <CheckboxGroupField disabled={disabled} label="Damage Observed" options={DAMAGE_OBSERVED} value={formData.shared.external.damageObserved} onChange={(v) => patchShared('external', { damageObserved: v })} />
        </NoMajorDefectSectionWrapper>
        <SectionComments sectionId="external" disabled={disabled} majorActive={Boolean(formData.shared.external.majorDefectObserved)} comments={formData.shared.external.comments} photos={formData.shared.external.photos} onCommentsChange={(v) => patchShared('external', { comments: v })} onPhotosChange={(v) => patchShared('external', { photos: v })} />
              </>
          );
        }}
            />}

      {building ? (
        <>
          {subfloorApplicable && showSection('subfloor') ? (
            <InspectionAccordionSection id="subfloor" title="Subfloor" status={statuses.subfloor ?? 'not_started'}
        render={() => (
        <>              <NoMajorDefectSectionWrapper
                disabled={disabled}
                inaccessibleArea={sectionAccessibilityLock('subfloor').area}
                inaccessibleReason={sectionAccessibilityLock('subfloor').reason}
                noMajorActive={Boolean(building.subfloor.noMajorDefectObserved)}
                majorActive={Boolean(building.subfloor.majorDefectObserved)}
                onApply={() =>
                  patchBuilding('subfloor', {
                    ...buildNoMajorDefectPatch(),
                    elements: { selected: [], custom: [] },
                  })
                }
                onApplyMajor={() =>
                  patchBuilding('subfloor', {
                    ...buildMajorDefectPatch(),
                    elements: { selected: [], custom: [] },
                  })
                }
                onReportDefects={() => patchBuilding('subfloor', clearDefectQuickPatch())}
              >
                <CheckboxGroupField disabled={disabled} label="Elements" options={SUBFLOOR_ELEMENTS} value={building.subfloor.elements} onChange={(v) => patchBuilding('subfloor', { elements: v })} />
              </NoMajorDefectSectionWrapper>
              <SectionComments sectionId="subfloor" disabled={disabled} majorActive={Boolean(building.subfloor.majorDefectObserved)} comments={building.subfloor.comments} photos={building.subfloor.photos} onCommentsChange={(v) => patchBuilding('subfloor', { comments: v })} onPhotosChange={(v) => patchBuilding('subfloor', { photos: v })} />
                    </>
        )}
            />
          ) : null}

          {showSection('fencing') && <InspectionAccordionSection id="fencing" title="Fencing" status={statuses.fencing ?? 'not_started'}
        render={() => (
        <>            <NoMajorDefectSectionWrapper
              disabled={disabled}
              inaccessibleArea={sectionAccessibilityLock('fencing').area}
              inaccessibleReason={sectionAccessibilityLock('fencing').reason}
              noMajorActive={Boolean(building.fencing.noMajorDefectObserved)}
              majorActive={Boolean(building.fencing.majorDefectObserved)}
              onApply={() =>
                patchBuilding('fencing', {
                  ...buildNoMajorDefectPatch(),
                  materials: { selected: [], custom: [] },
                })
              }
              onApplyMajor={() =>
                patchBuilding('fencing', {
                  ...buildMajorDefectPatch(),
                  materials: { selected: [], custom: [] },
                })
              }
              onReportDefects={() => patchBuilding('fencing', clearDefectQuickPatch())}
            >
              <CheckboxGroupField disabled={disabled} label="Materials" options={FENCING_MATERIALS} value={building.fencing.materials} onChange={(v) => patchBuilding('fencing', { materials: v })} />
            </NoMajorDefectSectionWrapper>
            <SectionComments sectionId="fencing" disabled={disabled} majorActive={Boolean(building.fencing.majorDefectObserved)} comments={building.fencing.comments} photos={building.fencing.photos} onCommentsChange={(v) => patchBuilding('fencing', { comments: v })} onPhotosChange={(v) => patchBuilding('fencing', { photos: v })} />
                  </>
        )}
            />}

          {showSection('outbuildings') && <InspectionAccordionSection id="outbuildings" title="Outbuildings" status={statuses.outbuildings ?? 'not_started'}
        render={() => (
        <>            <NoMajorDefectSectionWrapper
              disabled={disabled}
              inaccessibleArea={sectionAccessibilityLock('outbuildings').area}
              inaccessibleReason={sectionAccessibilityLock('outbuildings').reason}
              noMajorActive={Boolean(building.outbuildings.noMajorDefectObserved)}
              majorActive={Boolean(building.outbuildings.majorDefectObserved)}
              onApply={() =>
                patchBuilding('outbuildings', {
                  ...buildNoMajorDefectPatch(),
                  types: { selected: [], custom: [] },
                  condition: '',
                })
              }
              onApplyMajor={() =>
                patchBuilding('outbuildings', {
                  ...buildMajorDefectPatch(),
                  types: { selected: [], custom: [] },
                  condition: '',
                })
              }
              onReportDefects={() => patchBuilding('outbuildings', clearDefectQuickPatch())}
            >
              <CheckboxGroupField disabled={disabled} label="Types" options={OUTBUILDING_TYPES} value={building.outbuildings.types} onChange={(v) => patchBuilding('outbuildings', { types: v })} />
              <RatingSelect label="Condition" value={building.outbuildings.condition} onChange={(v) => patchBuilding('outbuildings', { condition: v })} options={['Good', 'Fair', 'Poor']} />
            </NoMajorDefectSectionWrapper>
            <SectionComments sectionId="outbuildings" disabled={disabled} majorActive={Boolean(building.outbuildings.majorDefectObserved)} comments={building.outbuildings.comments} photos={building.outbuildings.photos} onCommentsChange={(v) => patchBuilding('outbuildings', { comments: v })} onPhotosChange={(v) => patchBuilding('outbuildings', { photos: v })} />
                  </>
        )}
            />}
        </>
      ) : null}

      {showSection('roof-exterior') && <InspectionAccordionSection id="roof-exterior" title="Roof Exterior" status={statuses['roof-exterior']}
        render={() => (
        <>        <NoMajorDefectSectionWrapper
          disabled={disabled}
          inaccessibleArea={sectionAccessibilityLock('roof-exterior').area}
          inaccessibleReason={sectionAccessibilityLock('roof-exterior').reason}
          noMajorActive={Boolean(formData.shared.roofExterior.noMajorDefectObserved)}
          majorActive={Boolean(formData.shared.roofExterior.majorDefectObserved)}
          onApply={() =>
            patchShared('roofExterior', {
              ...buildNoMajorDefectPatch(),
              defects: { selected: [], custom: [] },
              condition: '',
            })
          }
          onApplyMajor={() =>
            patchShared('roofExterior', {
              ...buildMajorDefectPatch(),
              defects: { selected: [], custom: [] },
              condition: '',
            })
          }
          onReportDefects={() => patchShared('roofExterior', clearDefectQuickPatch())}
        >
          <CheckboxGroupField disabled={disabled} label="Defects" options={ROOF_EXTERIOR_DEFECTS} value={formData.shared.roofExterior.defects} onChange={(v) => patchShared('roofExterior', { defects: v })} />
          <RatingSelect label="Condition" value={formData.shared.roofExterior.condition} onChange={(v) => patchShared('roofExterior', { condition: v })} options={['Good', 'Fair', 'Poor']} />
        </NoMajorDefectSectionWrapper>
        <SectionComments sectionId="roof-exterior" disabled={disabled} majorActive={Boolean(formData.shared.roofExterior.majorDefectObserved)} comments={formData.shared.roofExterior.comments} photos={formData.shared.roofExterior.photos} onCommentsChange={(v) => patchShared('roofExterior', { comments: v })} onPhotosChange={(v) => patchShared('roofExterior', { photos: v })} />
              </>
        )}
            />}

      {showSection('roof-space') && <InspectionAccordionSection id="roof-space" title="Roof Space" status={statuses['roof-space']}
        render={() => (
        <>        <NoMajorDefectSectionWrapper
          disabled={disabled}
          inaccessibleArea={sectionAccessibilityLock('roof-space').area}
          inaccessibleReason={sectionAccessibilityLock('roof-space').reason}
          noMajorActive={Boolean(formData.shared.roofSpace.noMajorDefectObserved)}
          majorActive={Boolean(formData.shared.roofSpace.majorDefectObserved)}
          onApply={() =>
            patchShared('roofSpace', {
              ...buildNoMajorDefectPatch(),
              defects: { selected: [], custom: [] },
              framingElements: { selected: [], custom: [] },
            })
          }
          onApplyMajor={() =>
            patchShared('roofSpace', {
              ...buildMajorDefectPatch(formData.shared.roofSpace.comments),
              defects: { selected: [], custom: [] },
            })
          }
          onReportDefects={() => patchShared('roofSpace', clearDefectQuickPatch())}
        >
          <CheckboxGroupField disabled={disabled} label="Defects" options={ROOF_SPACE_DEFECTS} value={formData.shared.roofSpace.defects} onChange={(v) => patchShared('roofSpace', { defects: v })} />
        </NoMajorDefectSectionWrapper>
        {!sectionAccessibilityLock('roof-space').area ? (
        <RoofSpaceFramingDiagram
          disabled={disabled}
          value={formData.shared.roofSpace.framingElements ?? { selected: [], custom: [] }}
          onApplyFinding={(element, defects, trades) =>
            patchShared(
              'roofSpace',
              applyRoofFramingFinding(
                formData.shared.roofSpace.framingElements,
                formData.shared.roofSpace.comments,
                element,
                defects,
                trades,
              ),
            )
          }
          onClearFinding={(element) =>
            patchShared(
              'roofSpace',
              clearRoofFramingFinding(
                formData.shared.roofSpace.framingElements,
                formData.shared.roofSpace.comments,
                element,
              ),
            )
          }
        />
        ) : null}
        <SectionComments sectionId="roof-space" disabled={disabled} majorActive={Boolean(formData.shared.roofSpace.majorDefectObserved)} comments={formData.shared.roofSpace.comments} photos={formData.shared.roofSpace.photos} onCommentsChange={(v) => patchShared('roofSpace', { comments: v })} onPhotosChange={(v) => patchShared('roofSpace', { photos: v })} />
              </>
        )}
            />}
        </>
      )}

      {showBuilding && building && (
        <>
      {showSection('kitchen') && <InspectionAccordionSection id="kitchen" title="Kitchen" status={statuses.kitchen ?? 'not_started'}
        render={() => (
        <>        <NoMajorDefectSectionWrapper
          disabled={disabled}
          inaccessibleArea={sectionAccessibilityLock('kitchen').area}
          inaccessibleReason={sectionAccessibilityLock('kitchen').reason}
          noMajorActive={Boolean(building.kitchen.noMajorDefectObserved)}
          majorActive={Boolean(building.kitchen.majorDefectObserved)}
          onApply={() => patchBuilding('kitchen', buildNoMajorDefectPatch(building.kitchen.comments))}
          onApplyMajor={() => patchBuilding('kitchen', buildMajorDefectPatch(building.kitchen.comments))}
          onReportDefects={() => patchBuilding('kitchen', clearDefectQuickPatch())}
        >
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
              value={
                key === 'lights' || key === 'powerPoints'
                  ? defaultIfEmptyWorkingStatus(
                      building.kitchen[key as keyof typeof building.kitchen] as string,
                    )
                  : (building.kitchen[key as keyof typeof building.kitchen] as string)
              }
              onChange={(v) => patchBuilding('kitchen', { [key as string]: v })}
              options={options as string[]}
            />
          ))}
        </div>
        <div className="inspection-note-panel">
          <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Switches</InspectionSubsectionHeading>
          <p>{LICENSED_ELECTRICIAN_INSPECTION}</p>
        </div>
        <InspectionSubsectionHeading as="h4">Window</InspectionSubsectionHeading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(['window', 'windowLock'] as const).map((field) => (
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
        </NoMajorDefectSectionWrapper>
        <SectionComments sectionId="kitchen" disabled={disabled} majorActive={Boolean(building.kitchen.majorDefectObserved)} comments={building.kitchen.comments} photos={building.kitchen.photos} onCommentsChange={(v) => patchBuilding('kitchen', { comments: v })} onPhotosChange={(v) => patchBuilding('kitchen', { photos: v })} />
              </>
        )}
            />}

      {showSection('laundry') && <InspectionAccordionSection id="laundry" title="Laundry" status={statuses.laundry ?? 'not_started'}
        render={() => (
        <>        <NoMajorDefectSectionWrapper
          disabled={disabled}
          inaccessibleArea={sectionAccessibilityLock('laundry').area}
          inaccessibleReason={sectionAccessibilityLock('laundry').reason}
          noMajorActive={Boolean(building.laundry.noMajorDefectObserved)}
          majorActive={Boolean(building.laundry.majorDefectObserved)}
          onApply={() => patchBuilding('laundry', buildNoMajorDefectPatch(building.laundry.comments))}
          onApplyMajor={() => patchBuilding('laundry', buildMajorDefectPatch(building.laundry.comments))}
          onReportDefects={() => patchBuilding('laundry', clearDefectQuickPatch())}
        >
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
              value={
                key === 'lights' || key === 'powerPoints'
                  ? defaultIfEmptyWorkingStatus(
                      building.laundry[key as keyof typeof building.laundry] as string,
                    )
                  : (building.laundry[key as keyof typeof building.laundry] as string)
              }
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
        </NoMajorDefectSectionWrapper>
        <SectionComments sectionId="laundry" disabled={disabled} majorActive={Boolean(building.laundry.majorDefectObserved)} comments={building.laundry.comments} photos={building.laundry.photos} onCommentsChange={(v) => patchBuilding('laundry', { comments: v })} onPhotosChange={(v) => patchBuilding('laundry', { photos: v })} />
              </>
        )}
            />}

      {roomContent}

      {showSection('corrosion') && <InspectionAccordionSection id="corrosion" title="Corrosion" status={statuses.corrosion ?? 'not_started'}
        render={() => (
        <>        <SectionQuickActions
          disabled={disabled}
          onNoIssues={() => patchBuilding('corrosion', { comments: NO_ISSUES_OBSERVED_COMMENT })}
        />
        <CheckboxGroupField disabled={disabled} label="Items" options={CORROSION_ITEMS} value={building.corrosion.items} onChange={(v) => patchBuilding('corrosion', { items: v })} />
        <SectionComments sectionId="corrosion" disabled={disabled} comments={building.corrosion.comments} photos={building.corrosion.photos} onCommentsChange={(v) => patchBuilding('corrosion', { comments: v })} onPhotosChange={(v) => patchBuilding('corrosion', { photos: v })} />
              </>
        )}
            />}

      {showSection('minor-defects') && <InspectionAccordionSection id="minor-defects" title="Minor Defects" status={statuses['minor-defects'] ?? 'not_started'}
        render={() => (
        <>        <CheckboxGroupField disabled={disabled} label="Checklist" options={MINOR_DEFECT_PRESETS} value={building.minorDefects.checklist} onChange={(v) => patchBuilding('minorDefects', { checklist: v })} />
        <SectionComments sectionId="minor-defects" disabled={disabled} comments={building.minorDefects.comments} photos={building.minorDefects.photos} onCommentsChange={(v) => patchBuilding('minorDefects', { comments: v })} onPhotosChange={(v) => patchBuilding('minorDefects', { photos: v })} />
              </>
        )}
            />}

      {showSection('major-defects') && <InspectionAccordionSection id="major-defects" title="Major Defects" status={statuses['major-defects'] ?? 'not_started'}
        render={() => (
        <>        <p className="mb-4 text-sm text-muted">
          Items below auto-populate from cracking, moisture, access limits, site drainage, and safety findings elsewhere in the building workflow. You can still add or edit entries manually.
        </p>
        <CheckboxGroupField disabled={disabled} label="Structural Movement" options={STRUCTURAL_MOVEMENT} value={building.majorDefects.structuralMovement} onChange={(v) => patchMajorDefectCheckbox('structuralMovement', v)} />
        <YesNoSelect label="Engineering Inspection Required" value={building.majorDefects.structuralEngineeringRequired} onChange={(v) => patchBuilding('majorDefects', { structuralEngineeringRequired: v })} />
        <CrackingRegisterField
          disabled={disabled}
          entries={building.majorDefects.crackingEntries}
          onChange={(crackingEntries) => patchBuilding('majorDefects', { crackingEntries })}
          onClearAll={() =>
            patchBuilding('majorDefects', {
              crackingEntries: [],
              rollupDismissed: {
                ...building.majorDefects.rollupDismissed,
                crackingEntries: ['*'],
              },
            })
          }
        />
        <CheckboxGroupField disabled={disabled} label="Deformation / Sagging" options={DEFORMATION_ITEMS} value={building.majorDefects.deformation} onChange={(v) => patchMajorDefectCheckbox('deformation', v)} />
        <YesNoSelect label="Deformation Engineering Required" value={building.majorDefects.deformationEngineeringRequired} onChange={(v) => patchBuilding('majorDefects', { deformationEngineeringRequired: v })} />
        <PhotoField
          disabled={disabled}
          label="Deformation Photos"
          photos={building.majorDefects.deformationPhotos ?? []}
          onChange={(deformationPhotos) => patchBuilding('majorDefects', { deformationPhotos })}
        />
        <CheckboxGroupField disabled={disabled} label="Source of Moisture" options={MOISTURE_SOURCES} value={building.majorDefects.moistureSources} onChange={(v) => patchMajorDefectCheckbox('moistureSources', v)} />
        <PhotoField
          disabled={disabled}
          label="Source of Moisture Photos"
          photos={building.majorDefects.moistureSourcePhotos ?? []}
          onChange={(moistureSourcePhotos) => patchBuilding('majorDefects', { moistureSourcePhotos })}
        />
        <CheckboxGroupField disabled={disabled} label="Conducive To Finish Element Damage" options={conduciveOptions} value={building.majorDefects.conditionsConducive} onChange={(v) => patchMajorDefectCheckbox('conditionsConducive', v)} />
        <FinishElementDamageField
          disabled={disabled}
          entries={building.majorDefects.finishElementDamageEntries ?? []}
          onChange={(finishElementDamageEntries) => patchBuilding('majorDefects', { finishElementDamageEntries })}
        />
        <CheckboxGroupField disabled={disabled} label="Major Safety Hazards" options={BUILDING_MAJOR_SAFETY_HAZARDS} value={building.majorDefects.safetyHazards} onChange={(v) => patchMajorDefectCheckbox('safetyHazards', v)} />
        <PhotoField
          disabled={disabled}
          label="Major Safety Hazard Photos"
          photos={building.majorDefects.safetyHazardPhotos ?? []}
          onChange={(safetyHazardPhotos) => patchBuilding('majorDefects', { safetyHazardPhotos })}
        />
        <SectionComments sectionId="major-defects" disabled={disabled} comments={building.majorDefects.comments} photos={building.majorDefects.photos} onCommentsChange={(v) => patchBuilding('majorDefects', { comments: v })} onPhotosChange={(v) => patchBuilding('majorDefects', { photos: v })} />
              </>
        )}
            />}

      {showSection('moisture-testing') && <InspectionAccordionSection id="moisture-testing" title="Moisture & Thermal Testing" status={statuses['moisture-testing'] ?? 'not_started'}
        render={() => (
        <>        <SectionQuickActions
          disabled={disabled}
          label="No moisture issues observed"
          onNoIssues={() =>
            patchBuilding('moistureTesting', {
              visualMoistureEvidence: 'No',
              excessiveMoistureEvidence: 'No',
              comments: NO_ISSUES_OBSERVED_COMMENT,
            })
          }
        />
        <YesNoSelect label="Visual Moisture Evidence" value={building.moistureTesting.visualMoistureEvidence} onChange={(v) => patchBuilding('moistureTesting', { visualMoistureEvidence: v })} />
        <CheckboxGroupField disabled={disabled} label="Visual Locations" options={['Bathroom', 'Kitchen', 'Laundry', 'External', 'Roof Space']} value={building.moistureTesting.visualLocations} onChange={(v) => patchBuilding('moistureTesting', { visualLocations: v })} />
        <YesNoSelect label="Excessive Moisture Evidence" value={building.moistureTesting.excessiveMoistureEvidence} onChange={(v) => patchBuilding('moistureTesting', { excessiveMoistureEvidence: v })} />
        <PhotoField disabled={disabled} label="Moisture Meter Photos" photos={building.moistureTesting.moistureMeterPhotos} onChange={(v) => patchBuilding('moistureTesting', { moistureMeterPhotos: v })} />
        <PhotoField disabled={disabled} label="Thermal Images" photos={building.moistureTesting.thermalImages} onChange={(v) => patchBuilding('moistureTesting', { thermalImages: v })} />
        <SectionComments sectionId="moisture-testing" disabled={disabled} comments={building.moistureTesting.comments} photos={building.moistureTesting.photos} onCommentsChange={(v) => patchBuilding('moistureTesting', { comments: v })} onPhotosChange={(v) => patchBuilding('moistureTesting', { photos: v })} />
              </>
        )}
            />}

      {showSection('conclusion') && <InspectionAccordionSection id="conclusion" title="Conclusion" status={statuses.conclusion ?? 'not_started'}
        render={() => (
        <>        <RatingSelect label="Quality of workmanship and materials" value={building.conclusion.qualityOfWorkmanship} onChange={(v) => patchBuilding('conclusion', { qualityOfWorkmanship: v })} options={QUALITY_OF_WORKMANSHIP_RATINGS} />
        <div className="grid gap-4 md:grid-cols-2">
          <RatingSelect label="Structural Damage Rating" value={building.conclusion.structuralDamageRating} onChange={(v) => patchBuilding('conclusion', { structuralDamageRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Conducive To Finish Element Damage Rating" value={building.conclusion.conditionsConduciveRating} onChange={(v) => patchBuilding('conclusion', { conditionsConduciveRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Major Defects Rating" value={building.conclusion.majorDefectsRating} onChange={(v) => patchBuilding('conclusion', { majorDefectsRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Minor Defects Rating" value={building.conclusion.minorDefectsRating} onChange={(v) => patchBuilding('conclusion', { minorDefectsRating: v })} options={CONCLUSION_RATINGS} />
          <RatingSelect label="Overall Building Condition" value={building.conclusion.overallBuildingCondition} onChange={(v) => patchBuilding('conclusion', { overallBuildingCondition: v })} options={OVERALL_BUILDING_CONDITION} />
          <RatingSelect label="Overall Comparison" value={building.conclusion.overallComparison} onChange={(v) => patchBuilding('conclusion', { overallComparison: v, autoConclusion: '' })} options={OVERALL_COMPARISON} />
        </div>
        <Textarea label="Auto Conclusion Paragraph" value={building.conclusion.autoConclusion} onChange={(e) => patchBuilding('conclusion', { autoConclusion: e.target.value })} rows={6} />
              </>
        )}
            />}

      {showSection('recommendations') && <InspectionAccordionSection id="recommendations" title="Recommendations" status={statuses.recommendations ?? 'not_started'}
        render={() => (
        <>        <div className="inspection-subpanel text-sm">
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
              </>
        )}
            />}

      {showSection('inspector-declaration') && (
        <InspectionAccordionSection
          id="inspector-declaration"
          title="Certification"
          status={statuses['inspector-declaration'] ?? 'not_started'}
          onOpen={() => {
            if (!building.inspectorDeclaration.sectionReviewed) {
              patchBuilding('inspectorDeclaration', { sectionReviewed: true });
            }
          }}
          render={() => (
            <>
              <CertificationStatement />
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Inspector Name" value={building.inspectorDeclaration.inspectorName} onChange={(e) => patchBuilding('inspectorDeclaration', { inspectorName: e.target.value })} />
                <Input label="Declaration Date" type="date" value={building.inspectorDeclaration.declarationDate} onChange={(e) => patchBuilding('inspectorDeclaration', { declarationDate: e.target.value })} />
              </div>
              <InspectorSignatureField
                disabled={disabled}
                label="Inspector Signature"
                value={building.inspectorDeclaration.signatureData}
                onChange={(signatureData) => patchBuilding('inspectorDeclaration', { signatureData })}
              />
            </>
          )}
        />
      )}
        </>
      )}
    </>
  );

  const lockedMessageModal = (
    <Modal
      open={Boolean(lockedAreaMessage)}
      onClose={() => setLockedAreaMessage(null)}
      size="sm"
      hideHeader
    >
      <div className="-mx-6 -mt-3 overflow-hidden rounded-t-xl">
        <div className="bg-gradient-to-r from-[#B45309] to-[#D97706] px-6 py-5 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF3C7] shadow-md">
            <AlertTriangle className="h-8 w-8 text-[#B45309]" aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-white">Area locked</h2>
          <p className="mt-1 text-sm font-medium text-[#FEF3C7]">Inaccessible from Accessibility Areas</p>
        </div>
        <div className="space-y-4 bg-[#FFFBEB] px-6 py-5">
          <p className="text-center text-base font-semibold leading-snug text-[#92400E]">
            {lockedAreaMessage}
          </p>
          <p className="text-center text-sm text-[#A16207]">
            Tick this area again under <span className="font-semibold">Accessibility Areas</span> to unlock
            it, then you can clear it from Inaccessible Areas.
          </p>
          <div className="flex justify-center">
            <Button type="button" onClick={() => setLockedAreaMessage(null)}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );

  if (onlySectionId) {
    return (
      <InspectionFormProvider>
        <div className="inspection-workspace-single-section space-y-3">{sections}</div>
        {lockedMessageModal}
      </InspectionFormProvider>
    );
  }

  if (embedded) {
    return (
      <>
        {sections}
        {lockedMessageModal}
      </>
    );
  }

  return (
    <InspectionFormProvider>
      <InspectionAccordion
        defaultOpenId="inspector-hazard"
        routeIds={routeIds}
        workflowStorageKey={workflowStorageKey}
      >
        {sections}
      </InspectionAccordion>
      {lockedMessageModal}
    </InspectionFormProvider>
  );
}
