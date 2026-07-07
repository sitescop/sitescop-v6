import type { InspectionFormDataV2 } from '../../room-engine-core/src/form-data.js';

export interface ReportCompanyInfo {
  name: string;
  abn?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

export interface ReportSettingsInfo {
  primaryColor: string;
  secondaryColor: string;
  pdfFooterText?: string | null;
  pdfIncludeLogo: boolean;
  reportHeader?: string | null;
  reportFooter?: string | null;
}

export interface ReportInspectionInfo {
  inspectionNumber: string;
  completedAt?: Date | null;
  startedAt?: Date | null;
}

export interface ReportJobInfo {
  jobNumber: string;
  jobType: string;
  propertyAddress: string;
  clientName: string;
}

export interface ReportInspectorInfo {
  name: string;
  email?: string | null;
}

export interface ReportRoomInfo {
  roomIndex: number;
  label: string;
  roomType: string;
  data: Record<string, unknown>;
}

export interface ReportRenderContext {
  company: ReportCompanyInfo;
  settings: ReportSettingsInfo;
  inspection: ReportInspectionInfo;
  job: ReportJobInfo;
  inspector: ReportInspectorInfo | null;
  formData: InspectionFormDataV2;
  rooms: ReportRoomInfo[];
}

export type LegalReportKind = 'building' | 'pest';
