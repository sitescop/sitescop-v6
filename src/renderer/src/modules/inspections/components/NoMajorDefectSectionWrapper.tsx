import type { ReactNode } from 'react';
import { SectionQuickActions } from './SectionQuickActions';

interface NoMajorDefectSectionWrapperProps {
  disabled?: boolean;
  /** @deprecated Prefer noMajorActive / majorActive */
  active?: boolean;
  noMajorActive?: boolean;
  majorActive?: boolean;
  onApply: () => void;
  onApplyMajor: () => void;
  onReportDefects: () => void;
  children: ReactNode;
}

export function NoMajorDefectSectionWrapper({
  disabled = false,
  active,
  noMajorActive: noMajorActiveProp,
  majorActive = false,
  onApply,
  onApplyMajor,
  onReportDefects,
  children,
}: NoMajorDefectSectionWrapperProps) {
  const noMajorActive = noMajorActiveProp ?? Boolean(active);
  const collapsed = noMajorActive || majorActive;

  return (
    <div className="space-y-4">
      <SectionQuickActions
        disabled={disabled}
        noMajorActive={noMajorActive}
        majorActive={majorActive}
        onNoIssues={onApply}
        onMajorDefect={onApplyMajor}
      />
      {collapsed ? (
        <div
          className={
            majorActive
              ? 'rounded-lg border-2 border-[#DC2626] bg-[#FEF2F2] px-4 py-3 text-sm text-text'
              : 'rounded-lg border-2 border-[#16A34A] bg-[#F0FDF4] px-4 py-3 text-sm text-text'
          }
        >
          <p className={majorActive ? 'font-semibold text-[#B91C1C]' : 'font-semibold text-[#15803D]'}>
            {majorActive ? 'Major defect observed' : 'No major defect observed'}
          </p>
          <p className="mt-1 text-text-light">
            Detailed fields are hidden for this area. You can still set the room name above and add
            photos and comments below.{' '}
            <button
              type="button"
              className="font-semibold text-secondary underline-offset-2 hover:underline"
              disabled={disabled}
              onClick={onReportDefects}
            >
              {majorActive ? 'Edit detailed fields instead' : 'Report defects instead'}
            </button>
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
