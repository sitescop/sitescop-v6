import { Suspense, memo, useEffect, useState, startTransition } from 'react';
import type { InspectionRouteFormKind } from '@/modules/inspections/components/inspection-route';
import { InspectionFormProvider } from '@/modules/inspections/components/InspectionFormUi';
import { BuildingInspectionForm } from '@/modules/inspections/components/BuildingInspectionForm';
import { PestInspectionForm } from '@/modules/inspections/components/PestInspectionForm';
import type { SectionCompletionStatus } from '@/modules/inspections/components/section-completion';
import type { collectMajorDefectAutoSuggestions } from '@sitescop/room-engine-core';
import { WorkspaceSectionFilterContext } from './WorkspaceSectionFilterContext';
import { useWorkspaceEditor } from './WorkspaceEditorContext';
import { isRoomRouteId, RoomSectionHost } from './RoomSectionHost';
import { sectionLabel } from './section-labels';
import { BathroomRoomForm } from '@/modules/inspections/components/BathroomRoomForm';
import { BedroomRoomForm } from '@/modules/inspections/components/BedroomRoomForm';
import { LivingRoomForm } from '@/modules/inspections/components/LivingRoomForm';
import { RoomIdentityFields } from '@/modules/inspections/components/RoomIdentityFields';
import { NoMajorDefectSectionWrapper } from '@/modules/inspections/components/NoMajorDefectSectionWrapper';
import { SectionComments, CheckboxGroupField } from '@/modules/inspections/components/InspectionFields';
import { buildNoMajorDefectPatch, buildMajorDefectPatch, clearDefectQuickPatch, GARAGE_DEFECTS, resolveAccessibilityAreaForRoute, isRouteInaccessibleFromAccessibility } from '@sitescop/room-engine-core';
import type { BathroomRoomData, BedroomRoomData, GarageRoomData, LivingRoomData } from '@sitescop/room-engine-core';
import { InspectionRoomType } from '@shared/inspection-types';

function roomNoMajorActive(data: Record<string, unknown>): boolean {
  return data.noMajorDefectObserved === true;
}

function roomMajorActive(data: Record<string, unknown>): boolean {
  return data.majorDefectObserved === true;
}

interface ActiveSectionPanelProps {
  routeId: string;
  formKind: InspectionRouteFormKind;
  subfloorApplicable: boolean;
  buildingMode?: 'full' | 'shared-only' | 'building-only';
  computedStatuses?: Record<string, SectionCompletionStatus>;
  computedMajorDefectAuto?: ReturnType<typeof collectMajorDefectAutoSuggestions> | null;
}

const RoomPanel = memo(function RoomPanel({
  routeId,
  subfloorApplicable,
}: {
  routeId: string;
  subfloorApplicable: boolean;
}) {
  const { rooms, readOnly, patchRoom, updateRoomData, formData } = useWorkspaceEditor();
  const disabled = readOnly;
  const accessibility = formData.shared.accessibilityObstructions;
  const interiorLocked = isRouteInaccessibleFromAccessibility(
    routeId,
    accessibility.accessibilityAreas,
    subfloorApplicable,
  );
  const inaccessibleArea = interiorLocked ? resolveAccessibilityAreaForRoute(routeId) : null;
  const inaccessibleReason = inaccessibleArea
    ? accessibility.inaccessibleAreaReasons?.[inaccessibleArea]
    : undefined;

  if (!isRoomRouteId(routeId)) return null;

  return (
    <RoomSectionHost routeId={routeId} rooms={rooms}>
      {(room) => {
        if (routeId === 'bathrooms') {
          return (
            <div className="inspection-subpanel space-y-3">
              <RoomIdentityFields
                roomType={InspectionRoomType.BATHROOM}
                data={room.data}
                disabled={disabled}
                onPatch={(partial) => patchRoom(room.id, partial)}
              />
              <NoMajorDefectSectionWrapper
                disabled={disabled}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
                noMajorActive={roomNoMajorActive(room.data)}
                majorActive={roomMajorActive(room.data)}
                onApply={() => patchRoom(room.id, buildNoMajorDefectPatch(String(room.data.comments ?? '')))}
                onApplyMajor={() => patchRoom(room.id, buildMajorDefectPatch(String(room.data.comments ?? '')))}
                onReportDefects={() => patchRoom(room.id, clearDefectQuickPatch())}
              >
                <BathroomRoomForm
                  disabled={disabled}
                  majorActive={roomMajorActive(room.data)}
                  data={room.data as unknown as BathroomRoomData}
                  onPatch={(partial) => patchRoom(room.id, partial as Record<string, unknown>)}
                />
              </NoMajorDefectSectionWrapper>
              <SectionComments
                sectionId={`bathroom-${room.id}`}
                disabled={disabled}
                majorActive={roomMajorActive(room.data)}
                comments={String((room.data as { comments?: string }).comments ?? '')}
                photos={(room.data as { photos?: BathroomRoomData['photos'] }).photos ?? []}
                onCommentsChange={(comments) => patchRoom(room.id, { comments })}
                onPhotosChange={(photos) => patchRoom(room.id, { photos })}
              />
            </div>
          );
        }

        if (routeId === 'bedrooms') {
          return (
            <div className="inspection-subpanel space-y-3">
              <RoomIdentityFields
                roomType={InspectionRoomType.BEDROOM}
                data={room.data}
                disabled={disabled}
                onPatch={(partial) => patchRoom(room.id, partial)}
              />
              <NoMajorDefectSectionWrapper
                disabled={disabled}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
                noMajorActive={roomNoMajorActive(room.data)}
                majorActive={roomMajorActive(room.data)}
                onApply={() => patchRoom(room.id, buildNoMajorDefectPatch(String(room.data.comments ?? '')))}
                onApplyMajor={() => patchRoom(room.id, buildMajorDefectPatch(String(room.data.comments ?? '')))}
                onReportDefects={() => patchRoom(room.id, clearDefectQuickPatch())}
              >
                <BedroomRoomForm
                  disabled={disabled}
                  data={room.data as unknown as BedroomRoomData}
                  onPatch={(partial) => patchRoom(room.id, partial as Record<string, unknown>)}
                />
              </NoMajorDefectSectionWrapper>
              <SectionComments
                sectionId={`bedroom-${room.id}`}
                disabled={disabled}
                majorActive={roomMajorActive(room.data)}
                comments={String((room.data as { comments?: string }).comments ?? '')}
                photos={(room.data as { photos?: BedroomRoomData['photos'] }).photos ?? []}
                onCommentsChange={(comments) => patchRoom(room.id, { comments })}
                onPhotosChange={(photos) => patchRoom(room.id, { photos })}
              />
            </div>
          );
        }

        if (routeId === 'living-areas') {
          const livingData = room.data as unknown as LivingRoomData;
          return (
            <div className="inspection-subpanel space-y-3">
              <RoomIdentityFields
                roomType={InspectionRoomType.LIVING}
                data={room.data}
                disabled={disabled}
                onPatch={(partial) => patchRoom(room.id, partial)}
              />
              <NoMajorDefectSectionWrapper
                disabled={disabled}
                inaccessibleArea={inaccessibleArea}
                inaccessibleReason={inaccessibleReason}
                noMajorActive={roomNoMajorActive(room.data)}
                majorActive={roomMajorActive(room.data)}
                onApply={() => patchRoom(room.id, buildNoMajorDefectPatch(String(room.data.comments ?? '')))}
                onApplyMajor={() => patchRoom(room.id, buildMajorDefectPatch(String(room.data.comments ?? '')))}
                onReportDefects={() => patchRoom(room.id, clearDefectQuickPatch())}
              >
                <LivingRoomForm
                  disabled={disabled}
                  majorActive={roomMajorActive(room.data)}
                  data={livingData}
                  onPatch={(partial) => patchRoom(room.id, partial as Record<string, unknown>)}
                />
              </NoMajorDefectSectionWrapper>
              <SectionComments
                sectionId={`living-${room.id}`}
                disabled={disabled}
                majorActive={roomMajorActive(room.data)}
                comments={livingData.comments ?? ''}
                photos={livingData.photos ?? []}
                onCommentsChange={(comments) => patchRoom(room.id, { comments })}
                onPhotosChange={(photos) => patchRoom(room.id, { photos })}
              />
            </div>
          );
        }

        const garageData = room.data as unknown as GarageRoomData;
        return (
          <div className="inspection-subpanel space-y-3">
            <NoMajorDefectSectionWrapper
              disabled={disabled}
              inaccessibleArea={inaccessibleArea}
              inaccessibleReason={inaccessibleReason}
              noMajorActive={roomNoMajorActive(room.data)}
              majorActive={roomMajorActive(room.data)}
              onApply={() =>
                patchRoom(room.id, {
                  ...buildNoMajorDefectPatch(String(room.data.comments ?? '')),
                  defects: { selected: [], custom: [] },
                  damageObserved: { selected: [], custom: [] },
                })
              }
              onApplyMajor={() =>
                patchRoom(room.id, {
                  ...buildMajorDefectPatch(String(room.data.comments ?? '')),
                  defects: { selected: [], custom: [] },
                  damageObserved: { selected: [], custom: [] },
                })
              }
              onReportDefects={() => patchRoom(room.id, clearDefectQuickPatch())}
            >
              <CheckboxGroupField
                disabled={disabled}
                label="Defects"
                options={GARAGE_DEFECTS}
                value={garageData.defects}
                onChange={(defects) => patchRoom(room.id, { defects })}
              />
              <CheckboxGroupField
                disabled={disabled}
                label="Damage Observed"
                options={['Cracking', 'Moisture Damage', 'Corrosion']}
                value={garageData.damageObserved}
                onChange={(damageObserved) => patchRoom(room.id, { damageObserved })}
              />
            </NoMajorDefectSectionWrapper>
            <SectionComments
              sectionId={`garage-${room.id}`}
              disabled={disabled}
              majorActive={roomMajorActive(room.data)}
              comments={garageData.comments}
              photos={garageData.photos}
              onCommentsChange={(comments) => patchRoom(room.id, { comments })}
              onPhotosChange={(photos) => patchRoom(room.id, { photos })}
            />
          </div>
        );
      }}
    </RoomSectionHost>
  );
});

export function ActiveSectionPanel({
  routeId,
  formKind,
  subfloorApplicable,
  buildingMode = 'full',
  computedStatuses,
  computedMajorDefectAuto,
}: ActiveSectionPanelProps) {
  const { formData, rooms, readOnly, patchSection, patchRoom } = useWorkspaceEditor();
  const [mountedId, setMountedId] = useState(routeId);

  useEffect(() => {
    startTransition(() => {
      const frame = requestAnimationFrame(() => setMountedId(routeId));
      return () => cancelAnimationFrame(frame);
    });
  }, [routeId]);

  const isPestSection = routeId.startsWith('pest-');

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-secondary/[0.03] p-4 md:p-6">
      <header className="mb-4 border-b border-border pb-3">
        <h2 className="text-lg font-bold text-primary md:text-xl">{sectionLabel(routeId)}</h2>
      </header>
      <Suspense fallback={<p className="text-sm text-text-muted">Loading section…</p>}>
        <WorkspaceSectionFilterContext.Provider value={mountedId}>
          <InspectionFormProvider>
            <div
              key={mountedId}
              className="inspection-workspace-panel [content-visibility:auto] [contain-intrinsic-size:1px_1200px]"
            >
              {isRoomRouteId(mountedId) ? (
                <RoomPanel routeId={mountedId} subfloorApplicable={subfloorApplicable} />
              ) : isPestSection && formData.pest ? (
                <PestInspectionForm
                  pest={formData.pest}
                  onSectionChange={patchSection}
                  readOnly={readOnly}
                  embedded
                  onlySectionId={mountedId}
                  subfloorApplicable={subfloorApplicable}
                  accessibilityAreas={formData.shared.accessibilityObstructions.accessibilityAreas}
                  inaccessibleAreaReasons={formData.shared.accessibilityObstructions.inaccessibleAreaReasons}
                />
              ) : (
                <BuildingInspectionForm
                  formData={formData}
                  onSectionChange={patchSection}
                  readOnly={readOnly}
                  embedded
                  onlySectionId={mountedId}
                  mode={buildingMode}
                  formKind={formKind}
                  rooms={rooms}
                  onRoomPatch={patchRoom}
                  computedStatuses={computedStatuses}
                  computedMajorDefectAuto={computedMajorDefectAuto}
                />
              )}
            </div>
          </InspectionFormProvider>
        </WorkspaceSectionFilterContext.Provider>
      </Suspense>
    </div>
  );
}
