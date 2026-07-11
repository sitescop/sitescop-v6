import type { AgreementStatus, InspectionType } from '@shared/api-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { cn } from '@/lib/cn';

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  SIGNED: 'Signed',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLES: Record<AgreementStatus, string> = {
  DRAFT: 'bg-amber-500/15 text-amber-800 ring-1 ring-inset ring-amber-500/35',
  SENT: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25',
  VIEWED: 'bg-accent/10 text-accent ring-1 ring-inset ring-accent/25',
  SIGNED: 'bg-success/10 text-success ring-1 ring-inset ring-success/25',
  CANCELLED: 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/25',
};

export function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLES[status])}>
      {AGREEMENT_STATUS_LABELS[status]}
    </span>
  );
}

export const INSPECTION_TYPE_OPTIONS: Array<{ value: InspectionType; label: string }> = [
  { value: 'BUILDING', label: 'Building' },
  { value: 'PEST', label: 'Pest' },
  { value: 'COMBINED', label: 'Building & Pest' },
];

export function formatAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

export async function buildClientSigningUrl(accessToken: string): Promise<string> {
  const { url } = await getSitescopApi().agreements.resolveSigningUrl(accessToken);
  return url;
}
