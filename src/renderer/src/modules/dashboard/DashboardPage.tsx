import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Recycle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/auth-store';
import { SummaryCard } from './components/SummaryCard';
import { TodayJobCard } from './components/TodayJobCard';
import { Button, Card } from '@/design-system/components';
import { getRecycleBinApi, getSitescopApi, hasRecycleBinApi } from '@/lib/sitescop-api';

function todayLabel() {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => getSitescopApi().dashboard.getSummary(),
  });

  const todayQuery = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: () => getSitescopApi().dashboard.getTodayJobs(),
  });

  const recycleQuery = useQuery({
    queryKey: ['recycle-bin'],
    queryFn: () => getRecycleBinApi().list(),
    enabled: hasRecycleBinApi(),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
  }

  const summary = summaryQuery.data;
  const jobs = todayQuery.data ?? [];
  const recycleCount = recycleQuery.data?.length ?? 0;

  return (
    <div className="space-y-8">
      {recycleCount > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/20 bg-danger/5 p-4">
          <div className="flex items-center gap-3">
            <Recycle className="h-5 w-5 text-danger" />
            <div>
              <p className="font-medium text-text">{recycleCount} item{recycleCount === 1 ? '' : 's'} in Recycle Bin</p>
              <p className="text-sm text-text-light">Restore removed jobs and agreements, or delete them permanently.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/recycle-bin')}>
            Open Recycle Bin
          </Button>
        </Card>
      )}

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-text">
            Welcome back, {user?.firstName}
          </h2>
          <p className="text-text-light">{user?.companyName} — {todayLabel()}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Today's Jobs" value={summary?.todaysJobs ?? 0} accent="green" onClick={() => navigate('/jobs/today')} />
          <SummaryCard label="In Progress" value={summary?.inProgress ?? 0} accent="amber" onClick={() => navigate('/jobs/in-progress')} />
          <SummaryCard label="Waiting Agreements" value={summary?.waitingAgreements ?? 0} accent="blue" onClick={() => navigate('/agreements?status=DRAFT')} />
          <SummaryCard label="Completed This Week" value={summary?.completedThisWeek ?? 0} accent="teal" onClick={() => navigate('/jobs/completed')} />
          <SummaryCard label="Outstanding Invoices" value={summary?.outstandingInvoices ?? 0} accent="red" onClick={() => navigate('/invoices/outstanding')} />
          <SummaryCard label="Upcoming Inspections" value={summary?.upcomingInspections ?? 0} accent="purple" onClick={() => navigate('/calendar?view=upcoming')} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text">Today&apos;s Jobs</h3>
              <p className="text-sm text-text-light">
                {jobs.length === 0
                  ? 'No inspections scheduled for today.'
                  : `${jobs.length} inspection${jobs.length === 1 ? '' : 's'} — sorted by priority, status, and time`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/jobs/today')}>
              View all
            </Button>
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {todayQuery.isLoading ? (
          <p className="text-text-light">Loading today&apos;s jobs...</p>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-lg font-medium text-text">No jobs scheduled for today</p>
            <p className="mt-2 text-sm text-text-light">
              Use <strong>Create New Job</strong> in the top bar or sidebar to schedule an inspection.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <TodayJobCard job={job} onRefresh={refresh} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
