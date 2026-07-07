import type { InspectionFormDataV2, InspectionFormRealm } from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { InspectionAccordion } from './InspectionAccordion';
import { BuildingInspectionForm } from './BuildingInspectionForm';
import { PestInspectionForm } from './PestInspectionForm';
import { InspectionFormProvider } from './InspectionFormUi';

interface CombinedInspectionFormProps {
  formData: InspectionFormDataV2;
  onSectionChange: (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => void;
  readOnly?: boolean;
  rooms: InspectionRoomDetail[];
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
  onRoomDataChange: (roomId: string, data: Record<string, unknown>) => void;
}

export function CombinedInspectionForm({
  formData,
  onSectionChange,
  readOnly,
  rooms,
  onRoomPatch,
  onRoomDataChange,
}: CombinedInspectionFormProps) {
  if (!formData.pest) return null;

  return (
    <InspectionFormProvider>
      <InspectionAccordion defaultOpenId="inspector-hazard">
        <BuildingInspectionForm
          formData={formData}
          onSectionChange={onSectionChange}
          readOnly={readOnly}
          embedded
          mode="shared-only"
          rooms={rooms}
          onRoomPatch={onRoomPatch}
          onRoomDataChange={onRoomDataChange}
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
        />
        <PestInspectionForm pest={formData.pest} onSectionChange={onSectionChange} readOnly={readOnly} embedded />
      </InspectionAccordion>
    </InspectionFormProvider>
  );
}
