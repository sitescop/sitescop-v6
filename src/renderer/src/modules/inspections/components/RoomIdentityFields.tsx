import { BATHROOM_TYPES, BEDROOM_TYPES, LIVING_AREA_NAMES } from '@sitescop/room-engine-core';
import { InspectionRoomType } from '@shared/inspection-types';
import { Select } from '@/design-system/components';

interface RoomIdentityFieldsProps {
  roomType: InspectionRoomType;
  data: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (partial: Record<string, unknown>) => void;
}

export function RoomIdentityFields({
  roomType,
  data,
  disabled = false,
  onPatch,
}: RoomIdentityFieldsProps) {
  if (roomType === InspectionRoomType.BEDROOM) {
    return (
      <div className="mb-3 max-w-md">
        <Select
          label="Room Type"
          value={String(data.roomType ?? 'Bedroom')}
          disabled={disabled}
          onChange={(e) => onPatch({ roomType: e.target.value })}
          options={BEDROOM_TYPES.map((value) => ({ value, label: value }))}
        />
      </div>
    );
  }

  if (roomType === InspectionRoomType.BATHROOM) {
    return (
      <div className="mb-3 max-w-md">
        <Select
          label="Bathroom Type"
          value={String(data.bathroomType ?? 'Main')}
          disabled={disabled}
          onChange={(e) => onPatch({ bathroomType: e.target.value })}
          options={BATHROOM_TYPES.map((value) => ({ value, label: value }))}
        />
      </div>
    );
  }

  if (roomType === InspectionRoomType.LIVING) {
    return (
      <div className="mb-3 max-w-md">
        <Select
          label="Living Area"
          value={String(data.areaName ?? 'Front Living')}
          disabled={disabled}
          onChange={(e) => onPatch({ areaName: e.target.value })}
          options={LIVING_AREA_NAMES.map((value) => ({ value, label: value }))}
        />
      </div>
    );
  }

  return null;
}
