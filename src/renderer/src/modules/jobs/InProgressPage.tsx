import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, MapPin, Trash2, ExternalLink } from 'lucide-react';
import { getSitescopApi } from '@/lib/sitescop-api';
import { filterJobsBySearch } from '@/lib/job-search';
import { Button, Card } from '@/design-system/components';
import { formatDisplayDate } from '@/lib/dates';
import { PriorityBadge, PaymentBadge, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { JobQuickActions } from '@/modules/jobs/components/JobQuickActions';
import { JobListSearchBar } from '@/modules/jobs/components/JobListSearchBar';
import { useJobDelete } from '@/modules/jobs/hooks/useJobDelete';

interface CreatedJobNotice {
  createdJobNumber?: string;
  createdClientName?: string;
}

export function InProgressPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const waitingAgreement = searchParams.get('waitingAgreement') === '1';
  const notice = (location.state as CreatedJobNotice | null) ?? {};
  const [search, setSearch] = useState('');
  const { requestDelete, deleteDialog } = useJobDelete();

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs-in-progress'],
    queryFn: () => getSitescopApi().jobs.listInProgress(),
    refetchOnMount: 'always',
  });

  const scopedJobs = useMemo(() => {
    if (!waitingAgreement) return jobs;
    return jobs.filter((job) => job.agreementStatus === 'DRAFT' || job.agreementStatus === 'SENT');
  }, [jobs, waitingAgreement]);

  const filteredJobs = useMemo(() => filterJobsBySearch(scopedJobs, search), [scopedJobs, search]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function openJob(jobId: string) {
    void navigate(`/jobs/${jobId}`);
  }

  return (
    <div>
      {notice.createdJobNumber && (
        <div className="mb-6 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Job <strong>{notice.createdJobNumber}</strong>
          {notice.createdClientName ? ` for ${notice.createdClientName}` : ''} created successfully.
          Click the job below to open it.
        </div>
      )}

      {waitingAgreement && (
        <div className="mb-6 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-text">
          <p className="font-medium text-primary">Jobs waiting on agreement</p>
          <p className="mt-1 text-text-light">
            These jobs still need an agreement sent or signed. Open a job → <strong>Open agreement</strong> /{' '}
            <strong>Create agreement</strong>, then send it to the client.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/jobs/in-progress')}
          >
            Show all in-progress jobs
          </Button>
        </div>
      )}

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load jobs: {error instanceof Error ? error.message : 'Unknown error'}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && scopedJobs.length > 0 && (
        <JobListSearchBar
          value={search}
          onChange={setSearch}
          resultCount={filteredJobs.length}
          totalCount={scopedJobs.length}
        />
      )}

      {isLoading ? (
        <p className="text-text-light">Loading jobs...</p>
      ) : scopedJobs.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">
            {waitingAgreement ? 'No jobs waiting on agreements' : 'No jobs in progress'}
          </p>
          <p className="mt-2 text-sm text-text-light">
            {waitingAgreement
              ? 'All in-progress jobs already have a signed agreement, or there are no open jobs.'
              : (
                <>
                  Use <strong>Create New Job</strong> in the top bar or sidebar to add one.
                </>
              )}
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
                onClick={() => openJob(job.id)}
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
                      <PriorityBadge priority={job.priority} />
                      <span className="text-sm font-semibold text-primary">{job.inspectionTime}</span>
                      <span className="text-sm text-text-light">{formatDisplayDate(job.inspectionDate)}</span>
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-text-light">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      {job.propertyAddress}
                    </p>
                  </div>

                  <div
                    className="flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="accent" size="sm" onClick={() => navigate(`/jobs/${job.id}/inspection`)}>
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                    <JobQuickActions
                      compact
                      jobId={job.id}
                      jobNumber={job.jobNumber}
                      email={job.email}
                      mobile={job.mobile}
                      propertyAddress={job.propertyAddress}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="border-danger/30 text-danger hover:bg-danger/10"
                      onClick={() => requestDelete(job)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deleteDialog}
    </div>
  );
}
