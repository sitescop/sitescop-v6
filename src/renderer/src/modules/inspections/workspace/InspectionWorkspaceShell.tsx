import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { InspectionRouteFormKind } from '@/modules/inspections/components/inspection-route';
import { buildInspectionRouteIds, getAdjacentRouteSection } from '@/modules/inspections/components/inspection-route';
import { isSubfloorApplicable, resolveSubfloorPresent } from '@sitescop/room-engine-core';
import { WorkspaceEditorProvider } from './WorkspaceEditorContext';
import { SectionNavigator } from './SectionNavigator';
import { ActiveSectionPanel } from './ActiveSectionPanel';
import { useWorkspaceStatuses } from './hooks/useWorkspaceStatuses';
import { useWorkspaceMajorDefectAuto } from './hooks/useWorkspaceMajorDefectAuto';
import type { WorkspaceEditorValue } from './WorkspaceEditorContext';

interface InspectionWorkspaceShellProps {
  editor: WorkspaceEditorValue;
  formKind: InspectionRouteFormKind;
  buildingMode?: 'full' | 'shared-only' | 'building-only';
  defaultSectionId?: string;
  workflowStorageKey?: string;
}

const WORKFLOW_PREFIX = 'sitescop-workspace-active:';

function loadActiveSection(storageKey: string | undefined, fallback: string): string {
  if (!storageKey) return fallback;
  try {
    return (
      sessionStorage.getItem(`${WORKFLOW_PREFIX}${storageKey}`) ??
      sessionStorage.getItem(`sitescop-workspace-v2-active:${storageKey}`) ??
      fallback
    );
  } catch {
    return fallback;
  }
}

function saveActiveSection(storageKey: string | undefined, sectionId: string): void {
  if (!storageKey) return;
  try {
    sessionStorage.setItem(`${WORKFLOW_PREFIX}${storageKey}`, sectionId);
  } catch {
    // ignore
  }
}

export function InspectionWorkspaceShell({
  editor,
  formKind,
  buildingMode = 'full',
  defaultSectionId = 'inspector-hazard',
  workflowStorageKey,
}: InspectionWorkspaceShellProps) {
  const subfloorApplicable = useMemo(
    () =>
      isSubfloorApplicable(
        resolveSubfloorPresent(
          editor.formData.shared.propertyDescription,
          editor.formData.building?.subfloor,
          editor.formData.shared.accessibilityObstructions,
        ),
      ),
    [editor.formData],
  );

  const routeIds = useMemo(
    () =>
      buildInspectionRouteIds({
        formKind,
        mode: buildingMode,
        subfloorApplicable,
        rooms: editor.rooms,
        includePest: formKind === 'PEST' || formKind === 'COMBINED',
      }),
    [formKind, buildingMode, subfloorApplicable, editor.rooms],
  );

  const initialSection = loadActiveSection(workflowStorageKey, defaultSectionId);
  const [activeId, setActiveId] = useState(
    () => routeIds.find((id) => id === initialSection) ?? routeIds[0] ?? defaultSectionId,
  );

  useEffect(() => {
    if (!routeIds.includes(activeId)) {
      setActiveId(routeIds[0] ?? defaultSectionId);
    }
  }, [activeId, defaultSectionId, routeIds]);

  const statuses = useWorkspaceStatuses(editor.formData, editor.rooms, subfloorApplicable);
  const majorDefectAuto = useWorkspaceMajorDefectAuto(
    editor.formData,
    editor.rooms,
    activeId === 'major-defects',
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (id === activeId) return;
      void editor.flushPendingSaves();
      setActiveId(id);
      saveActiveSection(workflowStorageKey, id);
    },
    [activeId, editor, workflowStorageKey],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const previousId = getAdjacentRouteSection(routeIds, activeId, 'previous');
      const nextId = getAdjacentRouteSection(routeIds, activeId, 'next');
      if (event.key === 'ArrowLeft' && previousId) {
        event.preventDefault();
        handleSelect(previousId);
      } else if (event.key === 'ArrowRight' && nextId) {
        event.preventDefault();
        handleSelect(nextId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId, handleSelect, routeIds]);

  return (
    <div className="flex h-[min(78vh,920px)] min-h-[480px] overflow-hidden rounded-xl border border-border bg-white shadow-card">
      <div className="w-full max-w-[280px] shrink-0">
        <SectionNavigator
          routeIds={routeIds}
          activeId={activeId}
          statuses={statuses}
          onSelect={handleSelect}
        />
      </div>
      <div className="w-1.5 shrink-0 bg-gradient-to-b from-secondary via-primary to-accent" aria-hidden />
      <WorkspaceEditorProvider value={editor}>
        <ActiveSectionPanel
          routeId={activeId}
          formKind={formKind}
          subfloorApplicable={subfloorApplicable}
          buildingMode={buildingMode}
          computedStatuses={statuses}
          computedMajorDefectAuto={activeId === 'major-defects' ? majorDefectAuto : undefined}
        />
      </WorkspaceEditorProvider>
    </div>
  );
}
