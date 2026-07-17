import { createContext, useContext, type ReactNode } from 'react';
import type { InspectionFormDataV2, InspectionFormRealm } from '@sitescop/room-engine-core';
import type { InspectionRoomDetail } from '@shared/inspection-types';

export interface WorkspaceEditorValue {
  formData: InspectionFormDataV2;
  rooms: InspectionRoomDetail[];
  readOnly: boolean;
  patchSection: (realm: InspectionFormRealm, section: string, partial: Record<string, unknown>) => void;
  patchRoom: (roomId: string, partial: Record<string, unknown>) => void;
  updateRoomData: (roomId: string, data: Record<string, unknown>) => void;
  /** Flush debounced section/room saves (await before PDF generate or leaving a section). */
  flushPendingSaves: () => Promise<void>;
}

const WorkspaceEditorContext = createContext<WorkspaceEditorValue | null>(null);

export function WorkspaceEditorProvider({
  value,
  children,
}: {
  value: WorkspaceEditorValue;
  children: ReactNode;
}) {
  return <WorkspaceEditorContext.Provider value={value}>{children}</WorkspaceEditorContext.Provider>;
}

export function useWorkspaceEditor(): WorkspaceEditorValue {
  const ctx = useContext(WorkspaceEditorContext);
  if (!ctx) throw new Error('useWorkspaceEditor must be used within WorkspaceEditorProvider');
  return ctx;
}
