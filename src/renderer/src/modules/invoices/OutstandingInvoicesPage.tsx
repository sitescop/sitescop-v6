import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, MapPin, Receipt } from 'lucide-react';
import { getSitescopApi } from '@/lib/sitescop-api';
import { filterJobsBySearch } from '@/lib/job-search';
import { Button, Card } from '@/design-system/components';
import { formatDisplayDate } from '@/lib/dates';
import { INSPECTION_TYPE_LABELS, PaymentBadge, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { JobListSearchBar } from '@/modules/jobs/components/JobListSearchBar';
import { JobQuickActions } from '@/modules/jobs/components/JobQuickActions';

export function OutstandingInvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs-outstanding-invoices'],
    queryFn: () => getSitescopApi().jobs.listOutstandingInvoices(),
    refetchOnMount: 'always',
  });

  const filteredJobs = useMemo(() => filterJobsBySearch(jobs, search), [jobs, search]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10">
            <Receipt className="h-5 w-5 text-danger" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Awaiting payment</p>
            <p className="text-sm text-text-light">
              Signed jobs not yet marked as paid — open a job to invoice, inspect, or mark as paid
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load jobs: {error instanceof Error ? error.message : 'Unknown error'}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && jobs.length > 0 && (
        <JobListSearchBar
          value={search}
          onChange={setSearch}
          resultCount={filteredJobs.length}
          totalCount={jobs.length}
        />
      )}

      {isLoading ? (
        <p className="text-text-light">Loading awaiting payment jobs…</p>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">No jobs awaiting payment</p>
          <p className="mt-2 text-sm text-text-light">
            Jobs appear here after the client signs the agreement and before you mark them as paid.
          </p>
        </Card>
      ) : filteredJobs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-light">No jobs match your search.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <ul className="divide-y divide-border">
            {filteredJobs.map((job) => (
              <li
                key={job.id}
                className="cursor-pointer px-4 py-4 transition-colors hover:bg-background/80"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-text-light">{job.jobNumber}</p>
                    <p className="font-semibold text-text">{job.clientName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TypeBadge type={job.inspectionType} />
                      <StatusBadge status={job.status} />
                      <PaymentBadge
                        agreementStatus={job.agreementStatus}
                        paymentReceived={job.paymentReceived}
                      />
                      {job.hasInvoice && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                          <Receipt className="h-3 w-3" />
                          Invoice ready
                        </span>
                      )}
                      {job.hasReport && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          <FileText className="h-3 w-3" />
                          Report
                        </span>
                      )}
                      <span className="text-sm text-text-light">
                        {formatDisplayDate(job.inspectionDate)} · {job.inspectionTime}
                      </span>
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
                    <Button variant="primary" size="sm" onClick={() => navigate(`/jobs/${job.id}`)}>
                      Open job
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
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
