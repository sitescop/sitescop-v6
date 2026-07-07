import { AlertTriangle } from 'lucide-react';
import { Card } from '@/design-system/components';

interface FeatureRestartNoticeProps {
  feature: string;
}

export function FeatureRestartNotice({ feature }: FeatureRestartNoticeProps) {
  return (
    <Card className="mx-auto max-w-xl border-warning/30 bg-warning/5 p-6">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/15">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text">{feature} needs an app restart</h2>
          <p className="mt-2 text-sm text-text-light">
            This part of SiteScop was updated, but your running app is still on an older build.
            Other features may work, but {feature.toLowerCase()} will not load until you restart
            from the latest build.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text">
            <li>Close <strong>every</strong> SiteScop window (including old shortcuts).</li>
            <li>
              Open folder:{' '}
              <code className="rounded bg-background px-1.5 py-0.5 text-xs">
                c:\Users\USER\Desktop\app to develop\sitescop-v6
              </code>
            </li>
            <li>
              Double-click <strong>START-SITESCOP.bat</strong> — do not open SiteScop in Chrome.
            </li>
          </ol>
          <p className="mt-4 text-xs text-text-muted">
            If you installed SiteScop from an older .exe, use START-SITESCOP.bat instead until you
            reinstall the latest installer.
          </p>
        </div>
      </div>
    </Card>
  );
}
