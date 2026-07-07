import { cn } from '@/lib/cn';
import { VOICE_BAR_COUNT } from '@/modules/dictation/useDictation';

export function VoiceLevelMeter({
  levels,
  peakLevel,
  active,
}: {
  levels: number[];
  peakLevel: number;
  active: boolean;
}) {
  if (!active) return null;

  const voiceActive = peakLevel > 8;

  return (
    <div
      className="rounded-lg border border-primary/20 bg-white px-3 py-3"
      role="meter"
      aria-label="Voice level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={peakLevel}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">Voice level</span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              voiceActive ? 'bg-success shadow-[0_0_0_3px_rgba(22,163,74,0.28)]' : 'bg-text-muted/45',
            )}
            aria-hidden
          />
          {voiceActive ? 'Speaking' : 'Ready'}
        </span>
      </div>

      <div className="flex h-12 items-end justify-center gap-[3px] rounded-md bg-primary/[0.05] px-2 py-2">
        {Array.from({ length: VOICE_BAR_COUNT }, (_, index) => {
          const level = levels[index] ?? 0;
          return (
            <div
              key={index}
              className={cn(
                'w-[5px] rounded-full transition-[height] duration-75',
                voiceActive ? 'bg-primary' : 'bg-primary/30',
              )}
              style={{ height: `${Math.max(8, Math.round((level / 100) * 40))}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}
