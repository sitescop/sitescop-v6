import type { BathroomRoomData, BedroomRoomData, GarageRoomData, LivingRoomData } from '@sitescop/room-engine-core';
import { GARAGE_DEFECTS } from '@sitescop/room-engine-core';
import { InspectionRoomType } from '@shared/inspection-types';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { BathroomRoomForm } from './BathroomRoomForm';
import { BedroomRoomForm } from './BedroomRoomForm';
import { LivingRoomForm } from './LivingRoomForm';
import { InspectionAccordionSection } from './InspectionAccordion';
import { CheckboxGroupField, InspectionSubsectionHeading, SectionComments } from './InspectionFields';
import type { SectionCompletionStatus } from './section-completion';

interface InspectionRoomSectionsProps {
  rooms: InspectionRoomDetail[];
  readOnly?: boolean;
  statuses: Record<string, SectionCompletionStatus>;
  onRoomDataChange: (roomId: string, data: Record<string, unknown>) => void;
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
}

export function InspectionRoomSections({
  rooms,
  readOnly,
  statuses,
  onRoomDataChange,
  onRoomPatch,
}: InspectionRoomSectionsProps) {
  const disabled = Boolean(readOnly);
  const bathrooms = rooms.filter((r) => r.roomType === InspectionRoomType.BATHROOM);
  const bedrooms = rooms.filter((r) => r.roomType === InspectionRoomType.BEDROOM);
  const living = rooms.filter((r) => r.roomType === InspectionRoomType.LIVING);
  const garages = rooms.filter((r) => r.roomType === InspectionRoomType.GARAGE);

  if (bathrooms.length + bedrooms.length + living.length + garages.length === 0) {
    return null;
  }

  return (
    <>
      {bathrooms.length > 0 && (
        <InspectionAccordionSection id="bathrooms" title="Bathrooms" status={statuses.bathrooms ?? 'not_started'}>
          {bathrooms.map((room) => (
            <div key={room.id} className="inspection-subpanel mb-3 last:mb-0">
              <InspectionSubsectionHeading as="h4" className="mb-3">{room.label}</InspectionSubsectionHeading>
              <BathroomRoomForm
                disabled={disabled}
                data={room.data as unknown as BathroomRoomData}
                onPatch={(partial) => onRoomPatch(room.id, partial as Record<string, unknown>)}
              />
            </div>
          ))}
        </InspectionAccordionSection>
      )}

      {bedrooms.length > 0 && (
        <InspectionAccordionSection id="bedrooms" title="Bedrooms" status={statuses.bedrooms ?? 'not_started'}>
          {bedrooms.map((room) => (
            <div key={room.id} className="inspection-subpanel mb-3 last:mb-0">
              <InspectionSubsectionHeading as="h4" className="mb-3">{room.label}</InspectionSubsectionHeading>
              <BedroomRoomForm
                disabled={disabled}
                data={room.data as unknown as BedroomRoomData}
                onChange={(roomData) => onRoomDataChange(room.id, roomData as unknown as Record<string, unknown>)}
              />
            </div>
          ))}
        </InspectionAccordionSection>
      )}

      {living.length > 0 && (
        <InspectionAccordionSection id="living-areas" title="Living Areas" status={statuses['living-areas'] ?? 'not_started'}>
          {living.map((room) => {
            const livingData = room.data as unknown as LivingRoomData;
            return (
              <div key={room.id} className="inspection-subpanel mb-3 last:mb-0">
                <InspectionSubsectionHeading as="h4" className="mb-3">{livingData.areaName || room.label}</InspectionSubsectionHeading>
                <LivingRoomForm
                  disabled={disabled}
                  data={livingData}
                  onChange={(roomData) => onRoomDataChange(room.id, roomData as unknown as Record<string, unknown>)}
                />
              </div>
            );
          })}
        </InspectionAccordionSection>
      )}

      {garages.length > 0 && (
        <InspectionAccordionSection id="garage" title="Garage" status={statuses.garage ?? 'not_started'}>
          {garages.map((room) => {
            const garageData = room.data as unknown as GarageRoomData;
            return (
              <div key={room.id} className="inspection-subpanel mb-3 space-y-3 last:mb-0">
                <InspectionSubsectionHeading as="h4">{room.label}</InspectionSubsectionHeading>
                <CheckboxGroupField disabled={disabled}
                  label="Defects"
                  options={GARAGE_DEFECTS}
                  value={garageData.defects}
                  onChange={(defects) => onRoomPatch(room.id, { defects })}
                />
                <CheckboxGroupField disabled={disabled}
                  label="Damage Observed"
                  options={['Cracking', 'Moisture Damage', 'Corrosion']}
                  value={garageData.damageObserved}
                  onChange={(damageObserved) => onRoomPatch(room.id, { damageObserved })}
                />
                <SectionComments disabled={disabled}
                  comments={garageData.comments}
                  photos={garageData.photos}
                  onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
                  onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
                />
              </div>
            );
          })}
        </InspectionAccordionSection>
      )}
    </>
  );
}
