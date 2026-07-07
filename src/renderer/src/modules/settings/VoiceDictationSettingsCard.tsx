import { useState } from 'react';
import { Mic } from 'lucide-react';
import { DictationControls } from '@/modules/dictation/DictationControls';
import { isDesktopApp } from '@/lib/sitescop-api';
import { Card } from '@/design-system/components';

export function VoiceDictationSettingsCard() {
  const [lastText, setLastText] = useState<string | null>(null);

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h3 className="flex items-center gap-2 font-bold text-text">
          <Mic className="h-5 w-5 text-primary" aria-hidden />
          Voice dictation
        </h3>
        <p className="mt-1 text-sm text-text-light">
          Tap <strong>Dictate</strong>, speak while the voice bar moves, then tap <strong>Stop</strong>. Works{' '}
          <strong>offline</strong> — no internet required. Edit the text after if needed.
        </p>
      </div>

      {!isDesktopApp() ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Open SiteScop with <strong>START-SITESCOP.bat</strong> (not in a browser tab).
        </p>
      ) : (
        <>
          <DictationControls onText={setLastText} hint="Test dictation here before using it on inspections." />

          {lastText ? (
            <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-success">Last dictation</p>
              <p className="mt-2 text-sm leading-relaxed text-text">{lastText}</p>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
