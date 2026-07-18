import { memo, useMemo } from 'react';
import type { BathroomRoomData, BedroomRoomData, GarageRoomData, LivingRoomData } from '@sitescop/room-engine-core';
import { GARAGE_DEFECTS, buildNoMajorDefectPatch, buildMajorDefectPatch, clearDefectQuickPatch, resolveRoomReportLabels } from '@sitescop/room-engine-core';
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
  /** When Interior is unticked in Accessibility Areas. */
  inaccessibleArea?: string | null;
  inaccessibleReason?: string;
}

function roomNoMajorActive(data: Record<string, unknown>): boolean {
  return data.noMajorDefectObserved === true;
}

function roomMajorActive(data: Record<string, unknown>): boolean {
  return data.majorDefectObserved === true;
}

function roomLabelInputs(rooms: InspectionRoomDetail[]) {
  return rooms.map((room) => ({
    roomType: room.roomType,
    roomIndex: room.roomIndex,
    label: room.label,
    data: room.data,
  }));
}

const BedroomCard = memo(function BedroomCard({
  room,
  label,
  disabled,
  onRoomPatch,
  inaccessibleArea,
  inaccessibleReason,
}: {
  room: InspectionRoomDetail;
  label: string;
  disabled: boolean;
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
  inaccessibleArea?: string | null;
  inaccessibleReason?: string;
}) {
  return (
    <div className="inspection-subpanel mb-3 last:mb-0 [content-visibility:auto] [contain-intrinsic-size:1px_960px]">
      <InspectionSubsectionHeading as="h4" className="mb-3">
        {label}
      </InspectionSubsectionHeading>
      <RoomIdentityFields
        roomType={InspectionRoomType.BEDROOM}
        data={room.data}
        disabled={disabled}
        onPatch={(partial) => onRoomPatch(room.id, partial)}
      />
      <NoMajorDefectSectionWrapper
        disabled={disabled}
        inaccessibleArea={inaccessibleArea}
        inaccessibleReason={inaccessibleReason}
        noMajorActive={roomNoMajorActive(room.data)}
        majorActive={roomMajorActive(room.data)}
        onApply={() => onRoomPatch(room.id, buildNoMajorDefectPatch(String(room.data.comments ?? '')))}
        onApplyMajor={() => onRoomPatch(room.id, buildMajorDefectPatch(String(room.data.comments ?? '')))}
        onReportDefects={() => onRoomPatch(room.id, clearDefectQuickPatch())}
      >
        <BedroomRoomForm
          disabled={disabled}
          data={room.data as unknown as BedroomRoomData}
          onPatch={(partial) => onRoomPatch(room.id, partial as Record<string, unknown>)}
        />
      </NoMajorDefectSectionWrapper>
      <SectionComments
        sectionId={`bedroom-${room.id}`}
        disabled={disabled}
        majorActive={roomMajorActive(room.data)}
        comments={String((room.data as { comments?: string }).comments ?? '')}
        photos={(room.data as { photos?: BedroomRoomData['photos'] }).photos ?? []}
        onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
        onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
      />
    </div>
  );
});

const BathroomCard = memo(function BathroomCard({
  room,
  label,
  disabled,
  onRoomPatch,
  inaccessibleArea,
  inaccessibleReason,
}: {
  room: InspectionRoomDetail;
  label: string;
  disabled: boolean;
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
  inaccessibleArea?: string | null;
  inaccessibleReason?: string;
}) {
  return (
    <div className="inspection-subpanel mb-3 last:mb-0 [content-visibility:auto] [contain-intrinsic-size:1px_960px]">
      <InspectionSubsectionHeading as="h4" className="mb-3">
        {label}
      </InspectionSubsectionHeading>
      <RoomIdentityFields
        roomType={InspectionRoomType.BATHROOM}
        data={room.data}
        disabled={disabled}
        onPatch={(partial) => onRoomPatch(room.id, partial)}
      />
      <NoMajorDefectSectionWrapper
        disabled={disabled}
        inaccessibleArea={inaccessibleArea}
        inaccessibleReason={inaccessibleReason}
        noMajorActive={roomNoMajorActive(room.data)}
        majorActive={roomMajorActive(room.data)}
        onApply={() => onRoomPatch(room.id, buildNoMajorDefectPatch(String(room.data.comments ?? '')))}
        onApplyMajor={() => onRoomPatch(room.id, buildMajorDefectPatch(String(room.data.comments ?? '')))}
        onReportDefects={() => onRoomPatch(room.id, clearDefectQuickPatch())}
      >
        <BathroomRoomForm
          disabled={disabled}
          majorActive={roomMajorActive(room.data)}
          data={room.data as unknown as BathroomRoomData}
          onPatch={(partial) => onRoomPatch(room.id, partial as Record<string, unknown>)}
        />
      </NoMajorDefectSectionWrapper>
      <SectionComments
        sectionId={`bathroom-${room.id}`}
        disabled={disabled}
        majorActive={roomMajorActive(room.data)}
        comments={String((room.data as { comments?: string }).comments ?? '')}
        photos={(room.data as { photos?: BathroomRoomData['photos'] }).photos ?? []}
        onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
        onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
      />
    </div>
  );
});

const LivingCard = memo(function LivingCard({
  room,
  label,
  disabled,
  onRoomPatch,
  onRoomDataChange,
  inaccessibleArea,
  inaccessibleReason,
}: {
  room: InspectionRoomDetail;
  label: string;
  disabled: boolean;
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
  onRoomDataChange: (roomId: string, data: Record<string, unknown>) => void;
  inaccessibleArea?: string | null;
  inaccessibleReason?: string;
}) {
  const livingData = room.data as unknown as LivingRoomData;
  return (
    <div className="inspection-subpanel mb-3 last:mb-0 [content-visibility:auto] [contain-intrinsic-size:1px_960px]">
      <InspectionSubsectionHeading as="h4" className="mb-3">
        {label}
      </InspectionSubsectionHeading>
      <RoomIdentityFields
        roomType={InspectionRoomType.LIVING}
        data={room.data}
        disabled={disabled}
        onPatch={(partial) => onRoomPatch(room.id, partial)}
      />
      <NoMajorDefectSectionWrapper
        disabled={disabled}
        inaccessibleArea={inaccessibleArea}
        inaccessibleReason={inaccessibleReason}
        noMajorActive={roomNoMajorActive(room.data)}
        majorActive={roomMajorActive(room.data)}
        onApply={() => onRoomPatch(room.id, buildNoMajorDefectPatch(String(room.data.comments ?? '')))}
        onApplyMajor={() => onRoomPatch(room.id, buildMajorDefectPatch(String(room.data.comments ?? '')))}
        onReportDefects={() => onRoomPatch(room.id, clearDefectQuickPatch())}
      >
        <LivingRoomForm
          disabled={disabled}
          majorActive={roomMajorActive(room.data)}
          data={livingData}
          onPatch={(partial) => onRoomPatch(room.id, partial as Record<string, unknown>)}
        />
      </NoMajorDefectSectionWrapper>
      <SectionComments
        sectionId={`living-${room.id}`}
        disabled={disabled}
        majorActive={roomMajorActive(room.data)}
        comments={livingData.comments ?? ''}
        photos={livingData.photos ?? []}
        onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
        onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
      />
    </div>
  );
});

const GarageCard = memo(function GarageCard({
  room,
  label,
  disabled,
  onRoomPatch,
  inaccessibleArea,
  inaccessibleReason,
}: {
  room: InspectionRoomDetail;
  label: string;
  disabled: boolean;
  onRoomPatch: (roomId: string, partial: Record<string, unknown>) => void;
  inaccessibleArea?: string | null;
  inaccessibleReason?: string;
}) {
  const garageData = room.data as unknown as GarageRoomData;
  return (
    <div className="inspection-subpanel mb-3 space-y-3 last:mb-0 [content-visibility:auto] [contain-intrinsic-size:1px_720px]">
      <InspectionSubsectionHeading as="h4">{label}</InspectionSubsectionHeading>
      <NoMajorDefectSectionWrapper
        disabled={disabled}
        inaccessibleArea={inaccessibleArea}
        inaccessibleReason={inaccessibleReason}
        noMajorActive={roomNoMajorActive(room.data)}
        majorActive={roomMajorActive(room.data)}
        onApply={() =>
          onRoomPatch(room.id, {
            ...buildNoMajorDefectPatch(String(room.data.comments ?? '')),
            defects: { selected: [], custom: [] },
            damageObserved: { selected: [], custom: [] },
          })
        }
        onApplyMajor={() =>
          onRoomPatch(room.id, {
            ...buildMajorDefectPatch(String(room.data.comments ?? '')),
            defects: { selected: [], custom: [] },
            damageObserved: { selected: [], custom: [] },
          })
        }
        onReportDefects={() => onRoomPatch(room.id, clearDefectQuickPatch())}
      >
        <CheckboxGroupField
          disabled={disabled}
          label="Defects"
          options={GARAGE_DEFECTS}
          value={garageData.defects}
          onChange={(defects) => onRoomPatch(room.id, { defects })}
        />
        <CheckboxGroupField
          disabled={disabled}
          label="Damage Observed"
          options={['Cracking', 'Moisture Damage', 'Corrosion']}
          value={garageData.damageObserved}
          onChange={(damageObserved) => onRoomPatch(room.id, { damageObserved })}
        />
      </NoMajorDefectSectionWrapper>
      <SectionComments
        sectionId={`garage-${room.id}`}
        disabled={disabled}
        majorActive={roomMajorActive(room.data)}
        comments={garageData.comments}
        photos={garageData.photos}
        onCommentsChange={(comments) => onRoomPatch(room.id, { comments })}
        onPhotosChange={(photos) => onRoomPatch(room.id, { photos })}
      />
    </div>
  );
});

export function InspectionRoomSections({
  rooms,
  readOnly,
  statuses,
  onRoomDataChange,
  onRoomPatch,
  inaccessibleArea = null,
  inaccessibleReason,
}: InspectionRoomSectionsProps) {
  const disabled = Boolean(readOnly);
  const bathrooms = useMemo(
    () => rooms.filter((r) => r.roomType === InspectionRoomType.BATHROOM),
    [rooms],
  );
  const bedrooms = useMemo(
    () => rooms.filter((r) => r.roomType === InspectionRoomType.BEDROOM),
    [rooms],
  );
  const living = useMemo(
    () => rooms.filter((r) => r.roomType === InspectionRoomType.LIVING),
    [rooms],
  );
  const garages = useMemo(
    () => rooms.filter((r) => r.roomType === InspectionRoomType.GARAGE),
    [rooms],
  );

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
  const garageLabels = useMemo(
    () => resolveRoomReportLabels(roomLabelInputs(garages)),
    [garages],
  );

  if (bathrooms.length + bedrooms.length + living.length + garages.length === 0) {
    return null;
  }

  return (
    <>
      {bathrooms.length > 0 && (
        <InspectionAccordionSection
          id="bathrooms"
          title="Bathrooms"
          status={statuses.bathrooms ?? 'not_started'}
          render={() =>
            bathrooms.map((room, index) => (
              <BathroomCard
                key={room.id}
                room={room}
                label={bathroomLabels[index]}
                disabled={disabled}
                onRoomPatch={onRoomPatch}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
              />
            ))
          }
        />
      )}

      {bedrooms.length > 0 && (
        <InspectionAccordionSection
          id="bedrooms"
          title="Bedrooms"
          status={statuses.bedrooms ?? 'not_started'}
          render={() =>
            bedrooms.map((room, index) => (
              <BedroomCard
                key={room.id}
                room={room}
                label={bedroomLabels[index]}
                disabled={disabled}
                onRoomPatch={onRoomPatch}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
              />
            ))
          }
        />
      )}

      {living.length > 0 && (
        <InspectionAccordionSection
          id="living-areas"
          title="Living Areas"
          status={statuses['living-areas'] ?? 'not_started'}
          render={() =>
            living.map((room, index) => (
              <LivingCard
                key={room.id}
                room={room}
                label={livingLabels[index]}
                disabled={disabled}
                onRoomPatch={onRoomPatch}
                onRoomDataChange={onRoomDataChange}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
              />
            ))
          }
        />
      )}

      {garages.length > 0 && (
        <InspectionAccordionSection
          id="garage"
          title="Garage"
          status={statuses.garage ?? 'not_started'}
          render={() =>
            garages.map((room, index) => (
              <GarageCard
                key={room.id}
                room={room}
                label={garageLabels[index]}
                disabled={disabled}
                onRoomPatch={onRoomPatch}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
              />
            ))
          }
        />
      )}
    </>
  );
}
