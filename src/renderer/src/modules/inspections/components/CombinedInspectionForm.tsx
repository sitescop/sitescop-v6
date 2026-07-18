import { useDeferredValue, useMemo } from 'react';
import type { InspectionFormDataV2, InspectionFormRealm } from '@sitescop/room-engine-core';
import { collectMajorDefectAutoSuggestions, isSubfloorApplicable, resolveRoomReportLabels, resolveSubfloorPresent } from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { InspectionAccordion } from './InspectionAccordion';
import { buildInspectionRouteIds } from './inspection-route';
import { BuildingInspectionForm } from './BuildingInspectionForm';
import { PestInspectionForm } from './PestInspectionForm';
import { InspectionFormProvider } from './InspectionFormUi';
import { buildInspectionSectionStatuses } from './section-completion';
import { useDebouncedValue } from '@/modules/inspections/hooks/useDebouncedValue';

interface CombinedInspectionFormProps {
  formData: InspectionFormDataV2;
  onSectionChange: (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => void;
  readOnly?: boolean;
  rooms: InspectionRoomDetail[];
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
  onRoomDataChange: (roomId: string, data: Record<string, unknown>) => void;
  workflowStorageKey?: string;
}

const DERIVED_UI_DEBOUNCE_MS = 180;

export function CombinedInspectionForm({
  formData,
  onSectionChange,
  readOnly,
  rooms,
  onRoomPatch,
  onRoomDataChange,
  workflowStorageKey,
}: CombinedInspectionFormProps) {
  const subfloorApplicable = isSubfloorApplicable(
    resolveSubfloorPresent(
      formData.shared.propertyDescription,
      formData.building?.subfloor,
      formData.shared.accessibilityObstructions,
    ),
  );

  const routeIds = useMemo(
    () =>
      buildInspectionRouteIds({
        formKind: 'COMBINED',
        subfloorApplicable,
        rooms,
      }),
    [subfloorApplicable, rooms],
  );
  const deferredFormData = useDeferredValue(formData);
  const deferredRooms = useDeferredValue(rooms);
  const debouncedFormData = useDebouncedValue(deferredFormData, DERIVED_UI_DEBOUNCE_MS);
  const debouncedRooms = useDebouncedValue(deferredRooms, DERIVED_UI_DEBOUNCE_MS);
  const buildingStatuses = useMemo(
    () => buildInspectionSectionStatuses(debouncedFormData, debouncedRooms),
    [debouncedFormData, debouncedRooms],
  );
  const majorDefectAuto = useMemo(() => {
    if (!debouncedFormData.building) return null;
    const roomInputs = debouncedRooms.map((room) => ({
      roomType: room.roomType,
      roomIndex: room.roomIndex,
      label: room.label,
      data: room.data,
    }));
    const roomLabels = resolveRoomReportLabels(roomInputs);
    return collectMajorDefectAutoSuggestions({
      shared: debouncedFormData.shared,
      building: debouncedFormData.building,
      rooms: debouncedRooms.map((room, index) => ({
        id: room.id,
        label: roomLabels[index],
        roomType: room.roomType,
        data: room.data,
      })),
      subfloorApplicable,
    });
  }, [debouncedFormData, debouncedRooms, subfloorApplicable]);

  if (!formData.pest) return null;

  return (
    <InspectionFormProvider>
      <InspectionAccordion
        defaultOpenId="inspector-hazard"
        routeIds={routeIds}
        workflowStorageKey={workflowStorageKey}
      >
        <BuildingInspectionForm
          formData={formData}
          onSectionChange={onSectionChange}
          readOnly={readOnly}
          embedded
          mode="shared-only"
          formKind="COMBINED"
          rooms={rooms}
          onRoomPatch={onRoomPatch}
          onRoomDataChange={onRoomDataChange}
          computedStatuses={buildingStatuses}
          computedMajorDefectAuto={majorDefectAuto}
        />
        <BuildingInspectionForm
          formData={formData}
          onSectionChange={onSectionChange}
          readOnly={readOnly}
          embedded
          mode="building-only"
          rooms={rooms}
          onRoomPatch={onRoomPatch}
          onRoomDataChange={onRoomDataChange}
          computedStatuses={buildingStatuses}
          computedMajorDefectAuto={majorDefectAuto}
        />
        <PestInspectionForm
          pest={formData.pest}
          onSectionChange={onSectionChange}
          readOnly={readOnly}
          embedded
          subfloorApplicable={subfloorApplicable}
          accessibilityAreas={formData.shared.accessibilityObstructions.accessibilityAreas}
          inaccessibleAreaReasons={formData.shared.accessibilityObstructions.inaccessibleAreaReasons}
        />
      </InspectionAccordion>
    </InspectionFormProvider>
  );
}
