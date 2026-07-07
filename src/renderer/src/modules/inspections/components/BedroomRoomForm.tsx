import type { BedroomRoomData } from '@sitescop/room-engine-core';
import {
  BEDROOM_TYPES,
  ELECTRICAL_POINT_STATUS,
  FIXTURE_CONDITION,
  FLOOR_TYPES,
  LICENSED_ELECTRICIAN_INSPECTION,
  LIGHTS_SWITCHES_STATUS,
  WALL_DEFECTS,
} from '@sitescop/room-engine-core';
import { Select } from '@/design-system/components';
import { CheckboxGroupField, InspectionSubsectionHeading, RatingSelect, SectionComments, YesNoSelect } from './InspectionFields';

interface BedroomRoomFormProps {
  data: BedroomRoomData;
  onChange: (data: BedroomRoomData) => void;
  disabled?: boolean;
}

const conditionOptions = FIXTURE_CONDITION;

export function BedroomRoomForm({ data, onChange, disabled = false }: BedroomRoomFormProps) {
  const set = <K extends keyof BedroomRoomData>(key: K, value: BedroomRoomData[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-4 rounded-sm border border-border bg-background p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Room Type"
          value={data.roomType}
          onChange={(e) => set('roomType', e.target.value)}
          options={BEDROOM_TYPES.map((v) => ({ value: v, label: v }))}
        />
        <YesNoSelect disabled={disabled} label="Access Available" value={data.accessAvailable} onChange={(v) => set('accessAvailable', v)} />
      </div>

      {data.accessAvailable === 'No' && (
        <Select
          label="Reason No Access"
          value={data.noAccessReason}
          onChange={(e) => set('noAccessReason', e.target.value)}
          options={[
            { value: '', label: 'Select...' },
            { value: 'Locked', label: 'Locked' },
            { value: 'Unsafe', label: 'Unsafe' },
            { value: 'Stored Items', label: 'Stored Items' },
            { value: 'Other', label: 'Other' },
          ]}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(['door', 'handle', 'window', 'windowLock', 'wardrobe', 'slidingDoor', 'mirror'] as const).map((field) => (
          <RatingSelect disabled={disabled}
            key={field}
            label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            value={data[field]}
            onChange={(v) => set(field, v)}
            options={conditionOptions}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RatingSelect disabled={disabled} label="Floor Type" value={data.floorType} onChange={(v) => set('floorType', v)} options={FLOOR_TYPES} />
        <RatingSelect disabled={disabled} label="Floor Condition" value={data.floorCondition} onChange={(v) => set('floorCondition', v)} options={['Good', 'Fair', 'Poor', 'Damaged', 'Stained']} />
        <RatingSelect disabled={disabled} label="Lights Working" value={data.lights} onChange={(v) => set('lights', v)} options={LIGHTS_SWITCHES_STATUS} />
        <RatingSelect disabled={disabled} label="Power Points Working" value={data.powerPoints} onChange={(v) => set('powerPoints', v)} options={ELECTRICAL_POINT_STATUS} />
      </div>

      <div className="space-y-2 rounded-sm border border-border bg-background p-4 text-sm text-text-muted">
        <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Switches</InspectionSubsectionHeading>
        <p>{LICENSED_ELECTRICIAN_INSPECTION}</p>
      </div>

      <div className="space-y-2 rounded-sm border border-border bg-background p-4 text-sm text-text-muted">
        <InspectionSubsectionHeading className="mb-2 border-b-0 pb-0">Smoke Alarm</InspectionSubsectionHeading>
        <p>{LICENSED_ELECTRICIAN_INSPECTION}</p>
      </div>

      <CheckboxGroupField disabled={disabled} label="Walls" options={WALL_DEFECTS} value={data.walls} onChange={(v) => set('walls', v)} />
      <CheckboxGroupField disabled={disabled} label="Ceiling" options={WALL_DEFECTS} value={data.ceiling} onChange={(v) => set('ceiling', v)} />
      <CheckboxGroupField disabled={disabled} label="Damage Observed" options={['Cracking', 'Moisture Damage', 'Other']} value={data.damageObserved} onChange={(v) => set('damageObserved', v)} />

      <SectionComments disabled={disabled}
        comments={data.comments}
        photos={data.photos}
        onCommentsChange={(v) => set('comments', v)}
        onPhotosChange={(v) => set('photos', v)}
      />
    </div>
  );
}
