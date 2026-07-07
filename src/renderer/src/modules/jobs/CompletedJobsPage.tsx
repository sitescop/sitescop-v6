import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, FileText, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import { getSitescopApi } from '@/lib/sitescop-api';
import { filterJobsBySearch } from '@/lib/job-search';
import { Button, Card } from '@/design-system/components';
import { formatDisplayDate } from '@/lib/dates';
import { INSPECTION_TYPE_LABELS, TypeBadge } from '@/modules/jobs/job-labels';
import { JobQuickActions } from '@/modules/jobs/components/JobQuickActions';
import { JobListSearchBar } from '@/modules/jobs/components/JobListSearchBar';
import { useJobDelete } from '@/modules/jobs/hooks/useJobDelete';

export function CompletedJobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { requestDelete, deleteDialog } = useJobDelete();

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs-completed'],
    queryFn: () => getSitescopApi().jobs.listCompleted(),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const filteredJobs = useMemo(() => filterJobsBySearch(jobs, search), [jobs, search]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function refresh() {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Finished inspections</p>
            <p className="text-sm text-text-light">
              {jobs.length === 0
                ? 'No completed jobs yet.'
                : `${jobs.length} completed job${jobs.length === 1 ? '' : 's'} — newest first`}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load completed jobs: {error instanceof Error ? error.message : 'Unknown error'}
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
        <p className="text-text-light">Loading completed jobs...</p>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">No completed jobs yet</p>
          <p className="mt-2 text-sm text-text-light">
            Complete an inspection from the workspace — it will appear here with PDF reports.
          </p>
          <p className="mt-4 text-xs text-text-muted">
            If you already completed jobs, close every SiteScop window and run START-SITESCOP.bat again.
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
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                        Completed
                      </span>
                      {job.hasReport && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          <FileText className="h-3 w-3" />
                          PDF
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
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => navigate(`/jobs/${job.id}/inspection`)}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      View inspection
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
