import {
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Clock,
  CloudSun,
  FileText,
  HardHat,
  Home,
  Mail,
  MapPin,
  Navigation,
  Phone,
  User,
} from 'lucide-react';
import {
  CLIENT_TYPES,
  buildingReportTypeSelectOptions,
  DEFAULT_BUILDING_REPORT_TYPE,
  DEFAULT_INCOMPLETE_CONSTRUCTION,
  DEFAULT_OCCUPANCY_STATUS,
  DEFAULT_WEATHER_CONDITIONS,
  INCOMPLETE_CONSTRUCTION_OPTIONS,
  OCCUPANCY_STATUS_OPTIONS,
  WEATHER_CONDITIONS_OPTIONS,
  type JobInformationSection as JobInformationData,
} from '@sitescop/room-engine-core';
import type { InspectionRouteFormKind } from './inspection-route';
import { Button, Input, Select, Textarea } from '@/design-system/components';
import { cn } from '@/lib/cn';
import { PhotoField } from './InspectionFields';
import {
  INSPECTION_INPUT_CLASS,
  InspectionField,
  InspectionFieldLabel,
} from './InspectionFormUi';

const PEST_INSPECTION_TYPE = 'Timber and Pest Inspection report';

interface JobInformationSectionProps {
  data: JobInformationData;
  disabled: boolean;
  gpsCapturing: boolean;
  gpsStatus: string;
  formKind: InspectionRouteFormKind;
  onChange: (partial: Partial<JobInformationData>) => void;
  onCaptureGps: () => void;
}

export function JobInformationSection({
  data: j,
  disabled,
  gpsCapturing,
  gpsStatus,
  formKind,
  onChange,
  onCaptureGps,
}: JobInformationSectionProps) {
  const incompleteConstruction =
    j.incompleteConstruction?.trim() || DEFAULT_INCOMPLETE_CONSTRUCTION;
  const showIncompleteConstructionDetails = incompleteConstruction !== DEFAULT_INCOMPLETE_CONSTRUCTION;
  const buildingReportType = j.buildingReportType?.trim() || DEFAULT_BUILDING_REPORT_TYPE;
  const showBuildingInspectionType = formKind === 'BUILDING' || formKind === 'COMBINED';
  const showPestInspectionType = formKind === 'PEST' || formKind === 'COMBINED';

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {showBuildingInspectionType ? (
          <InspectionField
            id="job-building-report-type"
            label={formKind === 'COMBINED' ? 'Inspection Type (building PDF)' : 'Inspection Type'}
            icon={FileText}
            className={formKind === 'COMBINED' ? 'md:col-span-2' : undefined}
          >
            <Select
              id="job-building-report-type"
              value={buildingReportType}
              disabled={disabled}
              onChange={(e) => onChange({ buildingReportType: e.target.value })}
              options={buildingReportTypeSelectOptions(j.buildingReportType)}
              className={INSPECTION_INPUT_CLASS}
            />
          </InspectionField>
        ) : null}

        {showPestInspectionType ? (
          <InspectionField
            id="job-pest-inspection-type"
            label={formKind === 'COMBINED' ? 'Inspection Type (pest PDF)' : 'Inspection Type'}
            icon={FileText}
            className={formKind === 'COMBINED' ? 'md:col-span-2' : undefined}
          >
            <Input
              id="job-pest-inspection-type"
              value={PEST_INSPECTION_TYPE}
              readOnly
              disabled
              className={cn(INSPECTION_INPUT_CLASS, 'bg-surface-muted text-text-muted')}
            />
          </InspectionField>
        ) : null}

        <InspectionField id="job-client-type" label="Client Type" icon={Briefcase}>
          <Select
            id="job-client-type"
            value={j.clientType}
            onChange={(e) => onChange({ clientType: e.target.value })}
            options={CLIENT_TYPES.map((v) => ({ value: v, label: v }))}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>

        {j.clientType === 'Agent' && (
          <>
            <InspectionField id="job-agency-name" label="Agency Name" icon={Building2}>
              <Input
                id="job-agency-name"
                value={j.agencyName}
                onChange={(e) => onChange({ agencyName: e.target.value })}
                className={INSPECTION_INPUT_CLASS}
              />
            </InspectionField>
            <InspectionField id="job-agent-name" label="Agent Name" icon={User}>
              <Input
                id="job-agent-name"
                value={j.agentName}
                onChange={(e) => onChange({ agentName: e.target.value })}
                className={INSPECTION_INPUT_CLASS}
              />
            </InspectionField>
            <InspectionField id="job-agent-mobile" label="Agent Mobile" icon={Phone}>
              <Input
                id="job-agent-mobile"
                value={j.agentMobile}
                onChange={(e) => onChange({ agentMobile: e.target.value })}
                className={INSPECTION_INPUT_CLASS}
              />
            </InspectionField>
            <InspectionField id="job-agent-email" label="Agent Email" icon={Mail} className="md:col-span-2">
              <Input
                id="job-agent-email"
                type="email"
                value={j.agentEmail}
                onChange={(e) => onChange({ agentEmail: e.target.value })}
                className={INSPECTION_INPUT_CLASS}
              />
            </InspectionField>
          </>
        )}

        <InspectionField id="job-client-name" label="Client Name" icon={User}>
          <Input
            id="job-client-name"
            value={j.clientName}
            onChange={(e) => onChange({ clientName: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-client-mobile" label="Client Mobile" icon={Phone}>
          <Input
            id="job-client-mobile"
            value={j.clientMobile}
            onChange={(e) => onChange({ clientMobile: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-client-email" label="Client Email" icon={Mail} className="md:col-span-2">
          <Input
            id="job-client-email"
            type="email"
            value={j.clientEmail}
            onChange={(e) => onChange({ clientEmail: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-inspection-date" label="Inspection Date" icon={CalendarDays}>
          <Input
            id="job-inspection-date"
            type="date"
            value={j.inspectionDate}
            onChange={(e) => onChange({ inspectionDate: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-inspection-time" label="Inspection Time" icon={Clock}>
          <Input
            id="job-inspection-time"
            type="time"
            value={j.inspectionTime}
            onChange={(e) => onChange({ inspectionTime: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-property-address" label="Property Address" icon={MapPin} className="md:col-span-2">
          <Input
            id="job-property-address"
            value={j.propertyAddress}
            onChange={(e) => onChange({ propertyAddress: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-weather" label="Weather Conditions" icon={CloudSun} className="md:col-span-2">
          <Select
            id="job-weather"
            value={j.weatherConditions || DEFAULT_WEATHER_CONDITIONS}
            onChange={(e) => onChange({ weatherConditions: e.target.value })}
            options={WEATHER_CONDITIONS_OPTIONS.map((v) => ({ value: v, label: v }))}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-occupancy" label="Occupancy Status" icon={Home} className="md:col-span-2">
          <Select
            id="job-occupancy"
            value={j.occupancyStatus || DEFAULT_OCCUPANCY_STATUS}
            onChange={(e) => onChange({ occupancyStatus: e.target.value })}
            options={OCCUPANCY_STATUS_OPTIONS.map((v) => ({ value: v, label: v }))}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-incomplete-construction" label="Incomplete Construction" icon={HardHat} className="md:col-span-2">
          <Select
            id="job-incomplete-construction"
            value={incompleteConstruction}
            onChange={(e) => onChange({ incompleteConstruction: e.target.value })}
            options={INCOMPLETE_CONSTRUCTION_OPTIONS.map((v) => ({ value: v, label: v }))}
            className={INSPECTION_INPUT_CLASS}
          />
          {showIncompleteConstructionDetails ? (
            <div className="inspection-section-comments mt-4 space-y-4">
              <Textarea
                commentsField
                label="Comments"
                value={j.comments ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ comments: e.target.value })}
                rows={3}
                placeholder="Provide details about the incomplete construction observed…"
              />
              <PhotoField
                disabled={disabled}
                label="Photos"
                photos={j.incompleteConstructionPhotos ?? []}
                onChange={(photos) => onChange({ incompleteConstructionPhotos: photos })}
              />
            </div>
          ) : null}
        </InspectionField>
        <InspectionField id="job-gps-latitude" label="GPS Latitude" icon={MapPin}>
          <Input
            id="job-gps-latitude"
            value={j.gpsLatitude}
            onChange={(e) => onChange({ gpsLatitude: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <InspectionField id="job-gps-longitude" label="GPS Longitude" icon={MapPin}>
          <Input
            id="job-gps-longitude"
            value={j.gpsLongitude}
            onChange={(e) => onChange({ gpsLongitude: e.target.value })}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={disabled || gpsCapturing} onClick={onCaptureGps}>
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          {gpsCapturing ? 'Capturing…' : 'Capture GPS'}
        </Button>
        {gpsStatus ? (
          <p
            className={cn('text-xs font-medium', gpsStatus === 'GPS captured.' ? 'text-success' : 'text-warning')}
            role="status"
          >
            {gpsStatus}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:gap-4">
        <InspectionField id="job-front-photo-angle" label="Property Front Photo Angle" icon={Camera}>
          <Select
            id="job-front-photo-angle"
            value={j.frontPhotoAngle}
            onChange={(e) => onChange({ frontPhotoAngle: e.target.value as JobInformationData['frontPhotoAngle'] })}
            options={[
              { value: 'driveway', label: 'Taken from driveway' },
              { value: 'street', label: 'Taken from the street' },
            ]}
            className={INSPECTION_INPUT_CLASS}
          />
        </InspectionField>
        <div>
          <InspectionFieldLabel icon={Camera}>Property Front Photo</InspectionFieldLabel>
          <PhotoField disabled={disabled} label="" photos={j.photos} onChange={(photos) => onChange({ photos })} />
        </div>
      </div>
    </>
  );
}
