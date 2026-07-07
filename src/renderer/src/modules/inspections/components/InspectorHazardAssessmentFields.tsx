import {
  HAZARD_ASSESSMENT_LEVELS,
  INSPECTOR_HAZARD_PRESETS,
  isLowInspectorHazardLevel,
  type InspectorHazardAssessmentSection,
} from '@sitescop/room-engine-core';
import { Textarea } from '@/design-system/components';
import { CheckboxGroupField, RatingSelect } from './InspectionFields';

interface InspectorHazardAssessmentFieldsProps {
  section: InspectorHazardAssessmentSection;
  disabled?: boolean;
  onChange: (partial: Partial<InspectorHazardAssessmentSection>) => void;
}

export function InspectorHazardAssessmentFields({
  section,
  disabled,
  onChange,
}: InspectorHazardAssessmentFieldsProps) {
  const isLow = isLowInspectorHazardLevel(section);

  return (
    <>
      <p className="text-sm text-text-muted">
        Complete at the door before entering. Default is Low (safe to proceed). Only tick a hazard if you detect an
        aggressive dog, dangerous or unrestrained animal, or aggressive/hostile client behaviour on arrival. You can set
        the level to Moderate or High manually if needed.
      </p>
      <CheckboxGroupField
        disabled={disabled}
        label="Identified at the door before entry"
        options={INSPECTOR_HAZARD_PRESETS}
        value={section.hazards}
        onChange={(hazardsSelected) => onChange({ hazards: hazardsSelected })}
        allowCustom
      />
      <RatingSelect
        label="Overall hazard level"
        value={section.overallLevel}
        onChange={(overallLevel) => onChange({ overallLevel })}
        options={[...HAZARD_ASSESSMENT_LEVELS]}
      />
      {!isLow && (
        <>
          <div className="grid gap-4 md:grid-cols-3 rounded-sm bg-background p-3 text-sm">
            <div>
              <p className="font-medium text-text">Inspection outcome</p>
              <p className="text-text-muted">{section.inspectionOutcome || '—'}</p>
            </div>
            <div>
              <p className="font-medium text-text">Client advised</p>
              <p className="text-text-muted">{section.clientAdvised || '—'}</p>
            </div>
            <div>
              <p className="font-medium text-text">Rebooking required</p>
              <p className="text-text-muted">{section.rebookingRequired || '—'}</p>
            </div>
          </div>
          <Textarea
            label="Assessment summary (auto-generated, editable)"
            value={section.autoSummary}
            onChange={(e) => onChange({ autoSummary: e.target.value })}
            rows={8}
          />
        </>
      )}
    </>
  );
}
