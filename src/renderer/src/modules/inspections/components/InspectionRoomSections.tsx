import { useMemo } from 'react';
import type { BathroomRoomData, BedroomRoomData, GarageRoomData, LivingRoomData } from '@sitescop/room-engine-core';
import { GARAGE_DEFECTS, buildNoMajorDefectPatch, resolveRoomReportLabels } from '@sitescop/room-engine-core';
import { InspectionRoomType } from '@shared/inspection-types';
import type { InspectionRoomDetail } from '@shared/inspection-types';
import { BathroomRoomForm } from './BathroomRoomForm';
import { BedroomRoomForm } from './BedroomRoomForm';
import { LivingRoomForm } from './LivingRoomForm';
import { RoomIdentityFields } from './RoomIdentityFields';
import { InspectionAccordionSection } from './InspectionAccordion';
import { CheckboxGroupField, InspectionSubsectionHeading, SectionComments } from './InspectionFields';
import { NoMajorDefectSectionWrapper } from './NoMajorDefectSectionWrapper';
import type { SectionCompletionStatus } from './section-completion';

interface InspectionRoomSectionsProps {
  rooms: InspectionRoomDetail[];
  readOnly?: boolean;
  statuses: Record<string, SectionCompletionStatus>;
  onRoomDataChange: (roomId: string, data: Record<string, unknown>) => void;
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
}

function roomNoMajorDefectActive(data: Record<string, unknown>): boolean {
  return data.noMajorDefectObserved === true;
}

function roomLabelInputs(rooms: InspectionRoomDetail[]) {
  return rooms.map((room) => ({
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    label: room.label,
    data: room.data,
  }));
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

  const bathroomLabels = useMemo(
    () => resolveRoomReportLabels(roomLabelInputs(bathrooms)),
    [bathrooms],
  );
  const bedroomLabels = useMemo(
    () => resolveRoomReportLabels(roomLabelInputs(bedrooms)),
    [bedrooms],
  );
  const livingLabels = useMemo(
    () => resolveRoomReportLabels(roomLabelInputs(living)),
    [living],
  );

  if (bathrooms.length + bedrooms.length + living.length + garages.length === 0) {
    return null;
  }

  return (
    <>
      {bathrooms.length > 0 && (
        <InspectionAccordionSection id="bathrooms" title="Bathrooms" status={statuses.bathrooms ?? 'not_started'}>
          {bathrooms.map((room, index) => (
            <div key={room.id} className="inspection-subpanel mb-3 last:mb-0">
              <InspectionSubsectionHeading as="h4" className="mb-3">
                {bathroomLabels[index]}
              </InspectionSubsectionHeading>
              <RoomIdentityFields
                roomType={InspectionRoomType.BATHROOM}
                data={room.data}
                disabled={disabled}
                onPatch={(partial) => onRoomPatch(room.id, partial)}
              />
              <NoMajorDefectSectionWrapper
                disabled={disabled}
                active={roomNoMajorDefectActive(room.data)}
                onApply={() => onRoomPatch(room.id, buildNoMajorDefectPatch())}
                onReportDefects={() => onRoomPatch(room.id, { noMajorDefectObserved: false, comments: '' })}
              >
                <BathroomRoomForm
                  disabled={disabled}
                  data={room.data as unknown as BathroomRoomData}
                  onPatch={(partial) => onRoomPatch(room.id, partial as Record<string, unknown>)}
                />
              </NoMajorDefectSectionWrapper>
              <SectionComments
                sectionId={`bathroom-${room.id}`}
                disabled={disabled}
                comments={String((room.data as { comments?: string }).comments ?? '')}
                photos={(room.data as { photos?: BathroomRoomData['photos'] }).photos ?? []}
                onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
                onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
              />
            </div>
          ))}
        </InspectionAccordionSection>
      )}

      {bedrooms.length > 0 && (
        <InspectionAccordionSection id="bedrooms" title="Bedrooms" status={statuses.bedrooms ?? 'not_started'}>
          {bedrooms.map((room, index) => (
            <div key={room.id} className="inspection-subpanel mb-3 last:mb-0">
              <InspectionSubsectionHeading as="h4" className="mb-3">
                {bedroomLabels[index]}
              </InspectionSubsectionHeading>
              <RoomIdentityFields
                roomType={InspectionRoomType.BEDROOM}
                data={room.data}
                disabled={disabled}
                onPatch={(partial) => onRoomPatch(room.id, partial)}
              />
              <NoMajorDefectSectionWrapper
                disabled={disabled}
                active={roomNoMajorDefectActive(room.data)}
                onApply={() => onRoomPatch(room.id, buildNoMajorDefectPatch())}
                onReportDefects={() => onRoomPatch(room.id, { noMajorDefectObserved: false, comments: '' })}
              >
                <BedroomRoomForm
                  disabled={disabled}
                  data={room.data as unknown as BedroomRoomData}
                  onChange={(roomData) => onRoomDataChange(room.id, roomData as unknown as Record<string, unknown>)}
                />
              </NoMajorDefectSectionWrapper>
              <SectionComments
                sectionId={`bedroom-${room.id}`}
                disabled={disabled}
                comments={String((room.data as { comments?: string }).comments ?? '')}
                photos={(room.data as { photos?: BedroomRoomData['photos'] }).photos ?? []}
                onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
                onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
              />
            </div>
          ))}
        </InspectionAccordionSection>
      )}

      {living.length > 0 && (
        <InspectionAccordionSection id="living-areas" title="Living Areas" status={statuses['living-areas'] ?? 'not_started'}>
          {living.map((room, index) => {
            const livingData = room.data as unknown as LivingRoomData;
            return (
              <div key={room.id} className="inspection-subpanel mb-3 last:mb-0">
                <InspectionSubsectionHeading as="h4" className="mb-3">
                  {livingLabels[index]}
                </InspectionSubsectionHeading>
                <RoomIdentityFields
                  roomType={InspectionRoomType.LIVING}
                  data={room.data}
                  disabled={disabled}
                  onPatch={(partial) => onRoomPatch(room.id, partial)}
                />
                <NoMajorDefectSectionWrapper
                  disabled={disabled}
                  active={roomNoMajorDefectActive(room.data)}
                  onApply={() => onRoomPatch(room.id, buildNoMajorDefectPatch())}
                  onReportDefects={() => onRoomPatch(room.id, { noMajorDefectObserved: false, comments: '' })}
                >
                  <LivingRoomForm
                    disabled={disabled}
                    data={livingData}
                    onChange={(roomData) => onRoomDataChange(room.id, roomData as unknown as Record<string, unknown>)}
                  />
                </NoMajorDefectSectionWrapper>
                <SectionComments
                  sectionId={`living-${room.id}`}
                  disabled={disabled}
                  comments={livingData.comments ?? ''}
                  photos={livingData.photos ?? []}
                  onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
                  onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
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
                <NoMajorDefectSectionWrapper
                  disabled={disabled}
                  active={roomNoMajorDefectActive(room.data)}
                  onApply={() =>
                    onRoomPatch(room.id, {
                      ...buildNoMajorDefectPatch(),
                      defects: { selected: [], custom: [] },
                      damageObserved: { selected: [], custom: [] },
                    })
                  }
                  onReportDefects={() => onRoomPatch(room.id, { noMajorDefectObserved: false, comments: '' })}
                >
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
                </NoMajorDefectSectionWrapper>
                <SectionComments sectionId="garage" disabled={disabled}
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
