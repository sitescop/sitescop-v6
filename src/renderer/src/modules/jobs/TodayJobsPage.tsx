import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Button, Card } from '@/design-system/components';
import { getSitescopApi } from '@/lib/sitescop-api';
import { TodayJobCard } from '@/modules/dashboard/components/TodayJobCard';
import { useJobDelete } from '@/modules/jobs/hooks/useJobDelete';

function todayLabel() {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function TodayJobsPage() {
  const queryClient = useQueryClient();
  const { requestDelete, deleteDialog } = useJobDelete();

  const todayQuery = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: () => getSitescopApi().dashboard.getTodayJobs(),
    refetchOnMount: 'always',
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }

  const jobs = todayQuery.data ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">{todayLabel()}</p>
            <p className="text-sm text-text-light">
              {jobs.length === 0
                ? 'No inspections scheduled for today.'
                : `${jobs.length} job${jobs.length === 1 ? '' : 's'} to do today — sorted by priority, status, and time`}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {todayQuery.isLoading ? (
        <p className="text-text-light">Loading today&apos;s jobs...</p>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">No jobs for today</p>
          <p className="mt-2 text-sm text-text-light">
            Jobs scheduled for another day appear under In Progress or on the dashboard.
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <TodayJobCard job={job} onRefresh={refresh} onDelete={requestDelete} />
            </li>
          ))}
        </ul>
      )}

      {deleteDialog}
    </div>
  );
}
