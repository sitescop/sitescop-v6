import type { AccountingJobRow, ClientAccountingRow } from '@shared/api-types';
import { formatAud } from '@/modules/agreements/agreement-labels';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';

export const ACCOUNTING_OVERDUE_DAYS = 7;

export type AccountingJobFilter = 'all' | 'overdue' | 'ready';

export function daysSinceDate(dateKey: string): number {
  const start = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

export function jobReferenceDate(job: AccountingJobRow): string {
  return (job.signedAt ?? job.inspectionDate).slice(0, 10);
}

export function isAccountingJobOverdue(job: AccountingJobRow): boolean {
  if (job.paymentReceived || job.agreementStatus !== 'SIGNED') return false;
  return daysSinceDate(jobReferenceDate(job)) >= ACCOUNTING_OVERDUE_DAYS;
}

export function isAccountingJobReadyToSend(job: AccountingJobRow): boolean {
  return !job.paymentReceived && job.agreementStatus === 'SIGNED' && job.hasReport;
}

export function filterAccountingJobs(
  jobs: AccountingJobRow[],
  filter: AccountingJobFilter,
): AccountingJobRow[] {
  if (filter === 'overdue') return jobs.filter(isAccountingJobOverdue);
  if (filter === 'ready') return jobs.filter(isAccountingJobReadyToSend);
  return jobs;
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatAmount(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

export function exportAccountingJobsCsv(
  jobs: AccountingJobRow[],
  filenamePrefix: 'awaiting-payment' | 'paid-jobs',
): void {
  const headers = [
    'Job Number',
    'Client',
    'Email',
    'Mobile',
    'Property',
    'Inspection Date',
    'Amount AUD',
    'Status',
    'Payment',
    'Signed Date',
    'Paid Date',
    'Days Waiting',
    'Has Report',
    'Has Invoice',
  ];

  const rows = jobs.map((job) => [
    job.jobNumber,
    job.clientName,
    job.email,
    job.mobile,
    job.propertyAddress,
    job.inspectionDate,
    formatAmount(job.totalCents),
    job.status,
    job.paymentReceived ? 'Paid' : 'Awaiting',
    job.signedAt?.slice(0, 10) ?? '',
    job.paidAt?.slice(0, 10) ?? '',
    job.paymentReceived ? '' : String(daysSinceDate(jobReferenceDate(job))),
    job.hasReport ? 'Yes' : 'No',
    job.hasInvoice ? 'Yes' : 'No',
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`sitescop-${filenamePrefix}-${stamp}.csv`, headers, rows);
}

export function exportAccountingClientsCsv(clients: ClientAccountingRow[]): void {
  const headers = [
    'Client',
    'Unpaid Jobs',
    'Paid Jobs',
    'Amount Owed AUD',
    'Amount Paid AUD',
  ];

  const rows = clients.map((client) => [
    client.clientName,
    String(client.unpaidJobCount),
    String(client.paidJobCount),
    formatAmount(client.amountOwedCents),
    formatAmount(client.amountPaidCents),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`sitescop-accounting-by-client-${stamp}.csv`, headers, rows);
}

export function jobFilterLabel(filter: AccountingJobFilter): string {
  switch (filter) {
    case 'overdue':
      return `Overdue (${ACCOUNTING_OVERDUE_DAYS}+ days)`;
    case 'ready':
      return 'Report ready';
    default:
      return 'All';
  }
}

export function formatJobAmount(job: AccountingJobRow): string {
  return job.totalCents != null && job.totalCents > 0 ? formatAud(job.totalCents) : '—';
}
