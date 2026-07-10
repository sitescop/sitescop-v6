import type { ReactNode } from 'react';
import { SectionQuickActions } from './SectionQuickActions';

interface NoMajorDefectSectionWrapperProps {
  disabled?: boolean;
  active: boolean;
  onApply: () => void;
  onReportDefects: () => void;
  children: ReactNode;
}

export function NoMajorDefectSectionWrapper({
  disabled = false,
  active,
  onApply,
  onReportDefects,
  children,
}: NoMajorDefectSectionWrapperProps) {
  return (
    <div className="space-y-4">
      <SectionQuickActions disabled={disabled || active} onNoIssues={onApply} />
      {active ? (
        <div className="rounded-lg border border-success/35 bg-success/5 px-4 py-3 text-sm text-text">
          <p className="font-medium text-success">No major defect observed</p>
          <p className="mt-1 text-text-muted">
            Detailed fields are hidden for this area. You can still set the room name above and add photos below.{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              disabled={disabled}
              onClick={onReportDefects}
            >
              Report defects instead
            </button>
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
