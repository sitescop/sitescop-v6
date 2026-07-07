import { cn } from '@/lib/cn';

export type CloudSigningUiStatus =
  | 'idle'
  | 'uploading'
  | 'waiting'
  | 'signed'
  | 'upload_failed'
  | 'sync_failed';

const STATUS_COPY: Record<
  CloudSigningUiStatus,
  { label: string; className: string }
> = {
  idle: { label: '', className: '' },
  uploading: {
    label: 'Uploading Agreement…',
    className: 'border-primary/30 bg-primary/5 text-primary',
  },
  waiting: {
    label: 'Waiting for Client Signature…',
    className: 'border-accent/30 bg-accent/5 text-accent',
  },
  signed: {
    label: 'Signed Successfully',
    className: 'border-success/30 bg-success/5 text-success',
  },
  upload_failed: {
    label: 'Upload Failed',
    className: 'border-danger/30 bg-danger/5 text-danger',
  },
  sync_failed: {
    label: 'Sync Failed',
    className: 'border-danger/30 bg-danger/5 text-danger',
  },
};

interface AgreementCloudSigningStatusProps {
  status: CloudSigningUiStatus;
  detail?: string;
}

export function AgreementCloudSigningStatus({ status, detail }: AgreementCloudSigningStatusProps) {
  if (status === 'idle') return null;

  const copy = STATUS_COPY[status];

  return (
    <div
      className={cn(
        'mb-4 rounded-lg border px-4 py-3 text-sm font-medium',
        copy.className,
      )}
    >
      {copy.label}
      {detail && <p className="mt-1 text-xs font-normal opacity-90">{detail}</p>}
    </div>
  );
}

export function resolveCloudSigningStatus(input: {
  githubEnabled: boolean;
  agreementStatus: string;
  isUploading: boolean;
  uploadError: string | null;
  syncFailed: boolean;
}): CloudSigningUiStatus {
  if (!input.githubEnabled) return 'idle';
  if (input.isUploading) return 'uploading';
  if (input.uploadError) return 'upload_failed';
  if (input.agreementStatus === 'SIGNED') return 'signed';
  if (input.syncFailed && (input.agreementStatus === 'SENT' || input.agreementStatus === 'VIEWED')) {
    return 'sync_failed';
  }
  if (input.agreementStatus === 'SENT' || input.agreementStatus === 'VIEWED') return 'waiting';
  return 'idle';
}
