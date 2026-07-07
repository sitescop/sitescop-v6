import type { RoomEngineType } from './room-engine-core/src/types.js';
import type { InspectionFormDataV2, InspectionFormRealm } from './room-engine-core/src/form-data.js';
import type { InspectionType } from './api-types.js';

export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export const InspectionStatus = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const InspectionRoomType = {
  BEDROOM: 'BEDROOM',
  BATHROOM: 'BATHROOM',
  LIVING: 'LIVING',
  GARAGE: 'GARAGE',
} as const;

export type InspectionRoomType = (typeof InspectionRoomType)[keyof typeof InspectionRoomType];

export const INSPECTION_ROOM_TYPE_LABELS: Record<InspectionRoomType, string> = {
  BEDROOM: 'Bedroom',
  BATHROOM: 'Bathroom',
  LIVING: 'Living Area',
  GARAGE: 'Garage',
};

export const ROOM_ENGINE_TO_INSPECTION_ROOM: Record<RoomEngineType, InspectionRoomType> = {
  bedroom: 'BEDROOM',
  bathroom: 'BATHROOM',
  living: 'LIVING',
  garage: 'GARAGE',
};

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  BUILDING: 'Building',
  PEST: 'Pest',
  COMBINED: 'Building & Pest',
};

export interface InspectionRoomSummary {
  id: string;
  roomType: InspectionRoomType;
  roomIndex: number;
  label: string;
}

export interface InspectionSummary {
  id: string;
  inspectionNumber: string;
  status: InspectionStatus;
  jobId: string;
  jobNumber: string;
  jobType: InspectionType;
  propertyAddress: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  inspectorName: string;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionDetail extends InspectionSummary {
  formData: InspectionFormDataV2;
  rooms: InspectionRoomDetail[];
}

export interface InspectionRoomDetail extends InspectionRoomSummary {
  data: Record<string, unknown>;
}

export interface UpdateInspectionSectionInput {
  realm: InspectionFormRealm;
  section: string;
  data: Record<string, unknown>;
}

export interface UpdateInspectionRoomInput {
  data: Record<string, unknown>;
  label?: string;
}

export type { InspectionFormDataV2, InspectionFormRealm };
