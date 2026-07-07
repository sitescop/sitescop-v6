import { Mic, Square } from 'lucide-react';
import { Button } from '@/design-system/components';
import { useDictation } from '@/modules/dictation/useDictation';
import { VoiceLevelMeter } from '@/modules/dictation/VoiceLevelMeter';

export function DictationControls({
  disabled,
  onText,
  hint,
}: {
  disabled?: boolean;
  onText: (text: string) => void;
  hint?: string;
}) {
  const {
    status,
    levels,
    peakLevel,
    liveText,
    error,
    notice,
    toggle,
    recordingSeconds,
    mode,
    isRecording,
    isProcessing,
    isSupported,
  } = useDictation(onText);

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs text-danger">
        Dictation not loaded. Close all SiteScop windows, then run <strong>START-SITESCOP.bat</strong> again.
      </div>
    );
  }

  const busy = isRecording || isProcessing;

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text">Voice dictation</p>
          <p className="text-[11px] text-text-muted">
            {mode === 'online'
              ? 'Online · live captions while you speak'
              : 'Offline Windows speech · speak in full sentences'}
          </p>
        </div>
        <Button
          type="button"
          variant={isRecording ? 'primary' : 'secondary'}
          size="sm"
          disabled={disabled || isProcessing}
          onClick={toggle}
          aria-pressed={isRecording}
        >
          {isRecording ? (
            <>
              <Square className="h-4 w-4" aria-hidden />
              Stop
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" aria-hidden />
              Dictate
            </>
          )}
        </Button>
      </div>

      <VoiceLevelMeter levels={levels} peakLevel={peakLevel} active={busy} />

      {isRecording ? (
        <div className="rounded-lg border border-primary/15 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            Recording {recordingSeconds.toFixed(1)}s
            {mode === 'online' ? ' · online' : ' · offline'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text">
            {liveText ? (
              <>
                <span className="font-semibold text-primary">Hearing: </span>
                {liveText}
              </>
            ) : (
              <>Speak in full sentences (e.g. &quot;minor cracking on the external wall&quot;). Tap Stop when finished.</>
            )}
          </p>
        </div>
      ) : null}

      {isProcessing ? (
        <p className="text-xs font-medium text-primary">Converting your speech to text…</p>
      ) : null}

      {liveText && !isRecording && !isProcessing ? (
        <div className="rounded-lg border border-border bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Transcribed</p>
          <p className="mt-1 text-sm leading-relaxed text-text">{liveText}</p>
        </div>
      ) : null}

      {notice ? <p className="text-xs font-medium text-success">{notice}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {!busy && !error && !notice && !liveText && hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
