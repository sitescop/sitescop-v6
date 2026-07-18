import { lockedInaccessibleAreaMessage } from '@sitescop/room-engine-core';

interface AreaInaccessibleBannerProps {
  area: string;
  reason?: string;
}

/** Shown on workspace sections locked because their Accessibility Area was unticked. */
export function AreaInaccessibleBanner({ area, reason }: AreaInaccessibleBannerProps) {
  return (
    <div className="rounded-lg border-2 border-[#B45309] bg-[#FFFBEB] px-4 py-3 text-sm text-text">
      <p className="font-semibold text-[#92400E]">{lockedInaccessibleAreaMessage(area)}</p>
      <p className="mt-1 text-text-light">
        Detailed fields are hidden for this area. Pick a reason under Accessibility &amp; Risk Assessment.
        You can still add photos and comments below.
      </p>
      {reason?.trim() ? (
        <p className="mt-2 text-sm text-[#92400E]">
          <span className="font-medium">Reason:</span> {reason.trim()}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[#B45309]">No reason selected yet.</p>
      )}
    </div>
  );
}
