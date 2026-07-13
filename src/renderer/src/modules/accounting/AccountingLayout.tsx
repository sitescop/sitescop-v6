import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, Calculator, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { Button, Card } from '@/design-system/components';
import { FeatureRestartNotice } from '@/components/FeatureRestartNotice';
import { getSitescopApi, hasAccountingApi } from '@/lib/sitescop-api';
import { formatAud } from '@/modules/agreements/agreement-labels';
import { ACCOUNTING_OVERDUE_DAYS } from '@/modules/accounting/accounting-utils';
import { useAccountingRefresh } from '@/modules/accounting/useAccountingActions';
import { AccountingInsightsPanel } from '@/modules/accounting/AccountingInsightsPanel';

const tabs = [
  { to: '/accounting/awaiting', label: 'Awaiting payment' },
  { to: '/accounting/paid', label: 'Paid' },
  { to: '/accounting/clients', label: 'By client' },
] as const;

export function AccountingLayout() {
  const navigate = useNavigate();
  const refreshAccounting = useAccountingRefresh();
  const apiReady = hasAccountingApi();

  const awaitingQuery = useQuery({
    queryKey: ['accounting-awaiting'],
    queryFn: () => getSitescopApi().accounting.listAwaitingPayment(),
    enabled: apiReady,
  });

  const paidQuery = useQuery({
    queryKey: ['accounting-paid'],
    queryFn: () => getSitescopApi().accounting.listPaid(),
    enabled: apiReady,
  });

  const summaryQuery = useQuery({
    queryKey: ['accounting-summary'],
    queryFn: () => getSitescopApi().accounting.getSummary(),
    enabled: apiReady,
  });

  if (!apiReady) {
    return <FeatureRestartNotice feature="Accounting" />;
  }

  const awaitingTotal = (awaitingQuery.data ?? []).reduce(
    (sum, job) => sum + (job.totalCents ?? 0),
    0,
  );
  const awaitingCount = awaitingQuery.data?.length ?? 0;
  const summary = summaryQuery.data;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Accounting</p>
            <p className="text-sm text-text-light">
              Track payments, invoices, and money by client
              {awaitingCount > 0 ? (
                <>
                  {' '}
                  · <span className="font-semibold text-danger">{awaitingCount} awaiting</span>
                  {awaitingTotal > 0 ? ` (${formatAud(awaitingTotal)})` : ''}
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={refreshAccounting}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/clients')}>
            All clients
          </Button>
        </div>
      </div>

      {summary ? (
        <AccountingInsightsPanel
          summary={summary}
          awaitingJobs={awaitingQuery.data ?? []}
          paidJobs={paidQuery.data ?? []}
        />
      ) : null}

      {summary && summary.overdueJobCount > 0 ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-text">
                {summary.overdueJobCount} job{summary.overdueJobCount === 1 ? '' : 's'} overdue for payment
              </p>
              <p className="text-sm text-text-light">
                Signed {ACCOUNTING_OVERDUE_DAYS}+ days ago and still not marked as paid
                {summary.overdueAmountCents > 0 ? ` · ${formatAud(summary.overdueAmountCents)} outstanding` : ''}.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/accounting/awaiting?filter=overdue')}>
            View overdue
          </Button>
        </Card>
      ) : null}

      <nav
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
        aria-label="Accounting sections"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'rounded-t-md px-4 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'border border-b-0 border-border bg-surface text-primary'
                  : 'text-text-muted hover:bg-background hover:text-text',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
