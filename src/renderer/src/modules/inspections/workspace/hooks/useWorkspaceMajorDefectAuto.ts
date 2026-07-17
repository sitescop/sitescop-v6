import { useDeferredValue, useMemo } from 'react';
import type { InspectionFormDataV2 } from '@sitescop/room-engine-core';
import {
  collectMajorDefectAutoSuggestions,
  isSubfloorApplicable,
  resolveRoomReportLabels,
  resolveSubfloorPresent,
} from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { useDebouncedValue } from '@/modules/inspections/hooks/useDebouncedValue';

const MAJOR_DEFECT_DEBOUNCE_MS = 250;

export function useWorkspaceMajorDefectAuto(
  formData: InspectionFormDataV2,
  rooms: InspectionRoomDetail[],
  enabled: boolean,
) {
  const deferredForm = useDeferredValue(formData);
  const deferredRooms = useDeferredValue(rooms);
  const debouncedForm = useDebouncedValue(deferredForm, MAJOR_DEFECT_DEBOUNCE_MS);
  const debouncedRooms = useDebouncedValue(deferredRooms, MAJOR_DEFECT_DEBOUNCE_MS);

  const subfloorApplicable = useMemo(
    () =>
      isSubfloorApplicable(
        resolveSubfloorPresent(
          debouncedForm.shared.propertyDescription,
          debouncedForm.building?.subfloor,
          debouncedForm.shared.accessibilityObstructions,
        ),
      ),
    [debouncedForm],
  );

  return useMemo(() => {
    if (!enabled || !debouncedForm.building) return null;
    const roomInputs = debouncedRooms.map((room) => ({
      roomType: room.roomType,
      roomIndex: room.roomIndex,
      label: room.label,
      data: room.data,
    }));
    const roomLabels = resolveRoomReportLabels(roomInputs);
    return collectMajorDefectAutoSuggestions({
      shared: debouncedForm.shared,
      building: debouncedForm.building,
      rooms: debouncedRooms.map((room, index) => ({
        id: room.id,
        label: roomLabels[index],
        roomType: room.roomType,
        data: room.data,
      })),
      subfloorApplicable,
    });
  }, [debouncedForm, debouncedRooms, enabled, subfloorApplicable]);
}
