import { useDeferredValue, useMemo } from 'react';
import type { InspectionFormDataV2 } from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import {
  buildInspectionSectionStatuses,
  buildPestSectionStatuses,
  type SectionCompletionStatus,
} from '@/modules/inspections/components/section-completion';
import { useDebouncedValue } from '@/modules/inspections/hooks/useDebouncedValue';

const STATUS_DEBOUNCE_MS = 250;

export function useWorkspaceStatuses(
  formData: InspectionFormDataV2,
  rooms: InspectionRoomDetail[],
  subfloorApplicable: boolean,
): Record<string, SectionCompletionStatus> {
  const deferredForm = useDeferredValue(formData);
  const deferredRooms = useDeferredValue(rooms);
  const debouncedForm = useDebouncedValue(deferredForm, STATUS_DEBOUNCE_MS);
  const debouncedRooms = useDebouncedValue(deferredRooms, STATUS_DEBOUNCE_MS);

  return useMemo(() => {
    const buildingStatuses = buildInspectionSectionStatuses(debouncedForm, debouncedRooms);
    if (!debouncedForm.pest) return buildingStatuses;
    const pestStatuses = buildPestSectionStatuses(debouncedForm.pest, subfloorApplicable);
    return { ...buildingStatuses, ...pestStatuses };
  }, [debouncedForm, debouncedRooms, subfloorApplicable]);
}
