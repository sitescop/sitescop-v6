import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import type { AccountingJobRow, AccountingSummary } from '@shared/api-types';
import { exCentsFromIncCents } from '@shared/gst-pricing';
import { Button, Card } from '@/design-system/components';
import { formatAud } from '@/modules/agreements/agreement-labels';
import { cn } from '@/lib/cn';
import { getSitescopApi } from '@/lib/sitescop-api';
import {
  ACCOUNTING_OVERDUE_DAYS,
  daysSinceDate,
  isAccountingJobOverdue,
  isAccountingJobReadyToSend,
  jobReferenceDate,
} from '@/modules/accounting/accounting-utils';

export type AccountingInsightKey = 'week' | 'month' | 'overdue' | 'ready';

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekStartKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

function monthStartKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function moneyParts(totalCents: number | null | undefined) {
  if (totalCents == null || totalCents <= 0) {
    return { ex: null as number | null, gst: null as number | null, total: null as number | null };
  }
  const ex = exCentsFromIncCents(totalCents);
  return { ex, gst: totalCents - ex, total: totalCents };
}

function formatMoney(cents: number | null): string {
  return cents == null ? '—' : formatAud(cents);
}

function paidInRange(jobs: AccountingJobRow[], startKey: string, endKey: string): AccountingJobRow[] {
  return jobs.filter((job) => {
    if (!job.paymentReceived || !job.paidAt) return false;
    const paid = job.paidAt.slice(0, 10);
    return paid >= startKey && paid <= endKey;
  });
}

function buildWeekBars(paidJobs: AccountingJobRow[]): Array<{ label: string; cents: number }> {
  const bars: Array<{ label: string; cents: number }> = [];
  const today = new Date();
  for (let i = 7; i >= 0; i -= 1) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const cents = paidInRange(paidJobs, startKey, endKey).reduce(
      (sum, job) => sum + (job.totalCents ?? 0),
      0,
    );
    bars.push({
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      cents,
    });
  }
  return bars;
}

interface AccountingInsightsPanelProps {
  summary: AccountingSummary;
  awaitingJobs: AccountingJobRow[];
  paidJobs: AccountingJobRow[];
}

export function AccountingInsightsPanel({
  summary,
  awaitingJobs,
  paidJobs,
}: AccountingInsightsPanelProps) {
  const navigate = useNavigate();
  const [active, setActive] = useState<AccountingInsightKey | null>('week');
  const [feedback, setFeedback] = useState<string | null>(null);

  const today = localDateKey();
  const weekJobs = useMemo(
    () => paidInRange(paidJobs, weekStartKey(), today),
    [paidJobs, today],
  );
  const monthJobs = useMemo(
    () => paidInRange(paidJobs, monthStartKey(), today),
    [paidJobs, today],
  );
  const overdueJobs = useMemo(() => awaitingJobs.filter(isAccountingJobOverdue), [awaitingJobs]);
  const readyJobs = useMemo(() => awaitingJobs.filter(isAccountingJobReadyToSend), [awaitingJobs]);
  const chartBars = useMemo(() => buildWeekBars(paidJobs), [paidJobs]);
  const maxBar = Math.max(1, ...chartBars.map((bar) => bar.cents));

  const reminderMutation = useMutation({
    mutationFn: (jobId: string) => getSitescopApi().accounting.emailPaymentReminder(jobId),
    onSuccess: (result) => {
      if (result.cancelled) {
        setFeedback(null);
        return;
      }
      setFeedback(result.message);
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : 'Could not send reminder');
    },
  });

  const activeJobs =
    active === 'week'
      ? weekJobs
      : active === 'month'
        ? monthJobs
        : active === 'overdue'
          ? overdueJobs
          : active === 'ready'
            ? readyJobs
            : [];

  const activeTitle =
    active === 'week'
      ? 'Revenue this week'
      : active === 'month'
        ? 'Revenue this month'
        : active === 'overdue'
          ? 'Overdue jobs'
          : active === 'ready'
            ? 'Report ready (unpaid)'
            : '';

  const showPaymentActions = active === 'overdue' || active === 'ready';

  const cards: Array<{
    key: AccountingInsightKey;
    label: string;
    value: string;
    detail?: string;
    tone: 'success' | 'danger' | 'primary';
  }> = [
    {
      key: 'week',
      label: 'Revenue this week',
      value: formatAud(summary.revenueThisWeekCents),
      tone: 'success',
    },
    {
      key: 'month',
      label: 'Revenue this month',
      value: formatAud(summary.revenueThisMonthCents),
      tone: 'success',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: String(summary.overdueJobCount),
      detail: `${summary.overdueAmountCents > 0 ? formatAud(summary.overdueAmountCents) : 'No amount'} · ${ACCOUNTING_OVERDUE_DAYS}+ days`,
      tone: 'danger',
    },
    {
      key: 'ready',
      label: 'Report ready',
      value: String(summary.readyToSendCount),
      detail: 'Unpaid jobs with reports',
      tone: 'primary',
    },
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const isActive = active === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setActive(isActive ? null : card.key)}
              className={cn(
                'rounded-lg border p-4 text-left transition',
                isActive
                  ? 'border-primary ring-2 ring-primary/30 bg-surface shadow-sm'
                  : 'border-border bg-surface hover:border-primary/40',
                card.tone === 'danger' && !isActive && 'border-danger/20 bg-danger/5',
                card.tone === 'primary' && !isActive && 'border-primary/20 bg-primary/5',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{card.label}</p>
              <p
                className={cn(
                  'mt-1 text-2xl font-bold',
                  card.tone === 'success' && 'text-success',
                  card.tone === 'danger' && 'text-danger',
                  card.tone === 'primary' && 'text-primary',
                )}
              >
                {card.value}
              </p>
              {card.detail ? <p className="mt-1 text-sm text-text-light">{card.detail}</p> : null}
              <p className="mt-2 text-xs font-medium text-primary">
                {isActive ? 'Hide list' : 'Click to open list'}
              </p>
            </button>
          );
        })}
      </div>

      {active ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold text-text">{activeTitle}</p>
              <p className="text-sm text-text-light">
                {activeJobs.length} job{activeJobs.length === 1 ? '' : 's'} · Excel-style breakdown
              </p>
            </div>
            {(active === 'overdue' || active === 'ready') && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/accounting/awaiting')}>
                Open awaiting tab
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-background text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Job</th>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 font-semibold">Contact</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  {showPaymentActions ? (
                    <th className="px-3 py-2 font-semibold">Days overdue</th>
                  ) : (
                    <th className="px-3 py-2 font-semibold">Paid</th>
                  )}
                  <th className="px-3 py-2 font-semibold text-right">Subtotal (ex GST)</th>
                  <th className="px-3 py-2 font-semibold text-right">GST</th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                  {showPaymentActions ? <th className="px-3 py-2 font-semibold">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {activeJobs.length === 0 ? (
                  <tr>
                    <td colSpan={showPaymentActions ? 10 : 9} className="px-3 py-8 text-center text-text-light">
                      No jobs in this list.
                    </td>
                  </tr>
                ) : (
                  activeJobs.map((job, index) => {
                    const parts = moneyParts(job.totalCents);
                    const refDate = jobReferenceDate(job);
                    const overdueDays = daysSinceDate(refDate);
                    return (
                      <tr key={job.id} className="border-t border-border/80 hover:bg-primary/[0.03]">
                        <td className="px-3 py-2 text-text-muted">{index + 1}</td>
                        <td className="px-3 py-2 font-medium text-text">{job.jobNumber}</td>
                        <td className="px-3 py-2 text-text">{job.clientName}</td>
                        <td className="px-3 py-2 text-text-light">
                          <div>{job.email || '—'}</div>
                          <div>{job.mobile || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-text-light">
                          {showPaymentActions ? refDate : (job.paidAt?.slice(0, 10) ?? '—')}
                        </td>
                        <td className="px-3 py-2 text-text-light">
                          {showPaymentActions ? `${Math.max(0, overdueDays)} days` : (job.paidAt?.slice(0, 10) ?? '—')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(parts.ex)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(parts.gst)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatMoney(parts.total)}
                        </td>
                        {showPaymentActions ? (
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={reminderMutation.isPending}
                              onClick={() => {
                                setFeedback(null);
                                reminderMutation.mutate(job.id);
                              }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Reminder + invoice
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {activeJobs.length > 0 ? (
                <tfoot className="border-t border-border bg-background/80">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 font-semibold text-text">
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatMoney(
                        activeJobs.reduce((sum, job) => sum + (moneyParts(job.totalCents).ex ?? 0), 0),
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatMoney(
                        activeJobs.reduce((sum, job) => sum + (moneyParts(job.totalCents).gst ?? 0), 0),
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatMoney(
                        activeJobs.reduce((sum, job) => sum + (job.totalCents ?? 0), 0),
                      )}
                    </td>
                    {showPaymentActions ? <td /> : null}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <p className="font-semibold text-text">Revenue trend (last 8 weeks)</p>
        <p className="mt-1 text-sm text-text-light">Paid invoice totals by week</p>
        <div className="mt-4 flex h-40 items-end gap-2">
          {chartBars.map((bar) => (
            <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-primary to-emerald-400"
                style={{ height: `${Math.max(8, (bar.cents / maxBar) * 140)}px` }}
                title={formatAud(bar.cents)}
              />
              <span className="text-[10px] font-medium text-text-muted">{bar.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {feedback ? (
        <p className={`text-sm ${feedback.toLowerCase().includes('fail') || feedback.toLowerCase().includes('could not') ? 'text-danger' : 'text-success'}`}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

