import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign, Download, FileText, MapPin, Receipt, AlertTriangle, CloudUpload } from 'lucide-react';
import type { AccountingJobRow } from '@shared/api-types';
import { filterJobsBySearch } from '@/lib/job-search';
import { Button, Card, ConfirmActionModal } from '@/design-system/components';
import { formatDisplayDate } from '@/lib/dates';
import { formatAud } from '@/modules/agreements/agreement-labels';
import { INSPECTION_TYPE_LABELS, PaymentBadge, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { JobListSearchBar } from '@/modules/jobs/components/JobListSearchBar';
import { JobQuickActions } from '@/modules/jobs/components/JobQuickActions';
import { openJobInvoice, useMarkJobPaid, usePushToXero } from '@/modules/accounting/useAccountingActions';
import {
  type AccountingJobFilter,
  daysSinceDate,
  exportAccountingJobsCsv,
  filterAccountingJobs,
  isAccountingJobOverdue,
  isAccountingJobReadyToSend,
  jobFilterLabel,
  jobReferenceDate,
} from '@/modules/accounting/accounting-utils';
import { cn } from '@/lib/cn';
import { getSettingsApi } from '@/lib/sitescop-api';

interface AccountingJobListProps {
  jobs: AccountingJobRow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRefresh: () => void;
  mode: 'awaiting' | 'paid';
  emptyTitle: string;
  emptyDescription: string;
  jobFilter?: AccountingJobFilter;
  onJobFilterChange?: (filter: AccountingJobFilter) => void;
}

const FILTER_OPTIONS: AccountingJobFilter[] = ['all', 'overdue', 'ready'];

export function AccountingJobList({
  jobs,
  isLoading,
  isError,
  error,
  onRefresh,
  mode,
  emptyTitle,
  emptyDescription,
  jobFilter = 'all',
  onJobFilterChange,
}: AccountingJobListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null);
  const [jobToMarkPaid, setJobToMarkPaid] = useState<AccountingJobRow | null>(null);
  const [paidSuccessJob, setPaidSuccessJob] = useState<AccountingJobRow | null>(null);
  const [paidError, setPaidError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const markPaidMutation = useMarkJobPaid({
    onSuccess: (_job, jobId) => {
      const matched = jobs.find((job) => job.id === jobId) ?? jobToMarkPaid;
      setJobToMarkPaid(null);
      if (matched) setPaidSuccessJob(matched);
    },
    onError: (error) => {
      setJobToMarkPaid(null);
      setPaidError(error.message || 'Could not mark job as paid.');
    },
  });
  const pushXeroMutation = usePushToXero();

  const xeroQuery = useQuery({
    queryKey: ['settings-xero'],
    queryFn: () => getSettingsApi().getXero(),
  });
  const xeroConnected = Boolean(xeroQuery.data?.connected && xeroQuery.data?.enabled);

  const filteredJobs = useMemo(() => {
    const byFilter = mode === 'awaiting' ? filterAccountingJobs(jobs, jobFilter) : jobs;
    return filterJobsBySearch(byFilter, search);
  }, [jobs, search, jobFilter, mode]);

  async function handleOpenInvoice(jobId: string) {
    setOpeningInvoiceId(jobId);
    try {
      await openJobInvoice(jobId);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Could not open invoice.');
    } finally {
      setOpeningInvoiceId(null);
    }
  }

  function handleExport() {
    const exportJobs = mode === 'awaiting' ? filterAccountingJobs(jobs, jobFilter) : jobs;
    exportAccountingJobsCsv(exportJobs, mode === 'awaiting' ? 'awaiting-payment' : 'paid-jobs');
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {mode === 'awaiting' && onJobFilterChange ? (
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  jobFilter === option
                    ? 'bg-primary text-white'
                    : 'bg-surface-muted text-text-muted hover:bg-primary/10 hover:text-primary',
                )}
                onClick={() => onJobFilterChange(option)}
              >
                {jobFilterLabel(option)}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
        {!isLoading && jobs.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load jobs: {error instanceof Error ? error.message : 'Unknown error'}
          <Button variant="secondary" size="sm" className="ml-3" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && jobs.length > 0 && (
        <JobListSearchBar
          value={search}
          onChange={setSearch}
          resultCount={filteredJobs.length}
          totalCount={mode === 'awaiting' ? filterAccountingJobs(jobs, jobFilter).length : jobs.length}
        />
      )}

      {isLoading ? (
        <p className="text-text-light">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">{emptyTitle}</p>
          <p className="mt-2 text-sm text-text-light">{emptyDescription}</p>
        </Card>
      ) : filteredJobs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-light">No jobs match your search or filter.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <ul className="divide-y divide-border">
            {filteredJobs.map((job) => {
              const overdue = mode === 'awaiting' && isAccountingJobOverdue(job);
              const ready = mode === 'awaiting' && isAccountingJobReadyToSend(job);
              const daysWaiting = mode === 'awaiting' ? daysSinceDate(jobReferenceDate(job)) : 0;

              return (
                <li
                  key={job.id}
                  className="cursor-pointer px-4 py-4 transition-colors hover:bg-background/80"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs font-bold text-text-light">{job.jobNumber}</p>
                        {job.totalCents != null && job.totalCents > 0 ? (
                          <span className="text-sm font-bold text-primary">{formatAud(job.totalCents)}</span>
                        ) : null}
                      </div>
                      <p className="font-semibold text-text">{job.clientName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <TypeBadge type={job.inspectionType} />
                        <StatusBadge status={job.status} />
                        <PaymentBadge
                          agreementStatus={job.agreementStatus}
                          paymentReceived={job.paymentReceived}
                        />
                        {overdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3 w-3" />
                            Overdue · {daysWaiting}d
                          </span>
                        ) : null}
                        {ready ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            <FileText className="h-3 w-3" />
                            Ready to send
                          </span>
                        ) : null}
                        {job.hasInvoice && mode === 'awaiting' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                            <Receipt className="h-3 w-3" />
                            Invoice ready
                          </span>
                        )}
                        {job.hasReport && !ready ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            <FileText className="h-3 w-3" />
                            Report
                          </span>
                        ) : null}
                        {job.xeroInvoiceId ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                            <CloudUpload className="h-3 w-3" />
                            In Xero
                          </span>
                        ) : null}
                        <span className="text-sm text-text-light">
                          {formatDisplayDate(job.inspectionDate)} · {job.inspectionTime}
                        </span>
                        {mode === 'paid' && job.paidAt ? (
                          <span className="text-sm text-success">Paid {formatDisplayDate(job.paidAt)}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {INSPECTION_TYPE_LABELS[job.inspectionType]}
                      </p>
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-text-light">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        {job.propertyAddress}
                      </p>
                    </div>

                    <div
                      className="flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {mode === 'awaiting' && !job.paymentReceived && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={markPaidMutation.isPending}
                          onClick={() => setJobToMarkPaid(job)}
                        >
                          <CircleDollarSign className="h-3.5 w-3.5" />
                          {markPaidMutation.isPending && markPaidMutation.variables === job.id
                            ? 'Updating…'
                            : 'Mark as paid'}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={openingInvoiceId === job.id}
                        onClick={() => void handleOpenInvoice(job.id)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {openingInvoiceId === job.id ? 'Opening…' : 'Invoice'}
                      </Button>
                      {xeroConnected && job.agreementStatus === 'SIGNED' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={pushXeroMutation.isPending}
                          onClick={() => pushXeroMutation.mutate(job.id)}
                        >
                          <CloudUpload className="h-3.5 w-3.5" />
                          {pushXeroMutation.isPending && pushXeroMutation.variables === job.id
                            ? 'Sending…'
                            : job.xeroInvoiceId
                              ? 'Update Xero'
                              : 'Send to Xero'}
                        </Button>
                      ) : null}
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/jobs/${job.id}`)}>
                        Open job
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/clients/${job.clientId}`)}
                      >
                        Client
                      </Button>
                      <JobQuickActions
                        compact
                        jobId={job.id}
                        jobNumber={job.jobNumber}
                        email={job.email}
                        mobile={job.mobile}
                        propertyAddress={job.propertyAddress}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(jobToMarkPaid)}
        onClose={() => setJobToMarkPaid(null)}
        tone="payment"
        title="Mark as paid?"
        eyebrow="Payment confirmation"
        message={
          jobToMarkPaid ? (
            <>
              Mark <span className="font-bold">{jobToMarkPaid.jobNumber}</span> for{' '}
              <span className="font-bold">{jobToMarkPaid.clientName}</span> as paid?
            </>
          ) : (
            'Mark this job as paid?'
          )
        }
        hint="Once paid, the client can receive inspection reports by copy and email."
        confirmLabel="Yes, mark as paid"
        cancelLabel="Not yet"
        isPending={markPaidMutation.isPending}
        pendingLabel="Updating…"
        onConfirm={() => {
          if (jobToMarkPaid) markPaidMutation.mutate(jobToMarkPaid.id);
        }}
      />

      <ConfirmActionModal
        open={Boolean(paidSuccessJob)}
        onClose={() => setPaidSuccessJob(null)}
        tone="success"
        title="Marked as paid"
        eyebrow="Payment recorded"
        message={
          paidSuccessJob ? (
            <>
              <span className="font-bold">{paidSuccessJob.jobNumber}</span> is now paid and moved to Paid.
            </>
          ) : (
            'Job marked as paid.'
          )
        }
      />

      <ConfirmActionModal
        open={Boolean(paidError)}
        onClose={() => setPaidError(null)}
        tone="danger"
        title="Could not mark as paid"
        eyebrow="Something went wrong"
        message={paidError ?? 'Could not mark job as paid.'}
      />

      <ConfirmActionModal
        open={Boolean(invoiceError)}
        onClose={() => setInvoiceError(null)}
        tone="danger"
        title="Could not open invoice"
        eyebrow="Something went wrong"
        message={invoiceError ?? 'Could not open invoice.'}
      />
    </div>
  );
}
