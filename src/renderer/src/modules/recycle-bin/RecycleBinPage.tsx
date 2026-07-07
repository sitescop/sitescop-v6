import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Recycle, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import type { RecycleBinItem, RecycleBinItemType } from '@shared/api-types';
import { getRecycleBinApi, hasRecycleBinApi } from '@/lib/sitescop-api';
import { FeatureRestartNotice } from '@/components/FeatureRestartNotice';
import { Button, Card, Input, Modal } from '@/design-system/components';
import { formatDisplayDate } from '@/lib/dates';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';
import { AgreementStatusBadge } from '@/modules/agreements/agreement-labels';

import { JOB_DELETE_REASON_LABELS } from '@/modules/jobs/components/JobDeleteDialog';

type FilterType = 'all' | RecycleBinItemType;

function itemLabel(item: RecycleBinItem): string {
  return item.type === 'job' ? item.jobNumber : item.agreementNumber;
}

function itemSubtitle(item: RecycleBinItem): string {
  if (item.type === 'job') {
    return `${item.clientName} · ${formatDisplayDate(item.inspectionDate)} · ${INSPECTION_TYPE_LABELS[item.inspectionType]}`;
  }
  return `${item.clientName} · ${INSPECTION_TYPE_LABELS[item.inspectionType]}`;
}

function itemReason(item: RecycleBinItem): string {
  if (item.type === 'job') {
    if (!item.reason) return 'Removed';
    const label = JOB_DELETE_REASON_LABELS[item.reason];
    return item.notes?.trim() ? `${label} — ${item.notes.trim()}` : label;
  }
  return item.reason ?? 'Removed';
}

export function RecycleBinPage() {
  const queryClient = useQueryClient();
  const apiReady = hasRecycleBinApi();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [purgeTarget, setPurgeTarget] = useState<RecycleBinItem | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recycle-bin'],
    queryFn: () => getRecycleBinApi().list(),
    enabled: apiReady,
    refetchOnMount: 'always',
  });

  const restoreMutation = useMutation({
    mutationFn: ({ type, id }: { type: RecycleBinItemType; id: string }) =>
      getRecycleBinApi().restore(type, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-completed'] });
      void queryClient.invalidateQueries({ queryKey: ['agreements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: ({ type, id }: { type: RecycleBinItemType; id: string }) =>
      getRecycleBinApi().purge(type, id),
    onSuccess: () => {
      setPurgeTarget(null);
      setConfirmText('');
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
    },
  });

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (!term) return true;
      const haystack = [
        itemLabel(item),
        item.clientName,
        item.type === 'job' ? item.propertyAddress : item.propertyAddress,
        item.type === 'agreement' ? item.jobNumber ?? '' : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, filter, search]);

  const jobCount = items.filter((item) => item.type === 'job').length;
  const agreementCount = items.filter((item) => item.type === 'agreement').length;

  if (!apiReady) {
    return <FeatureRestartNotice feature="Recycle Bin" />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10">
            <Recycle className="h-5 w-5 text-danger" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Recycle bin</p>
            <p className="text-sm text-text-light">
              Restore removed jobs and agreements, or delete them permanently
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>
          All ({items.length})
        </Button>
        <Button variant={filter === 'job' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('job')}>
          Jobs ({jobCount})
        </Button>
        <Button
          variant={filter === 'agreement' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilter('agreement')}
        >
          Agreements ({agreementCount})
        </Button>
      </div>

      <Input
        className="mb-6 max-w-md"
        placeholder="Search by number, client, or address…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load recycle bin: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {isLoading ? (
        <p className="text-text-light">Loading recycle bin…</p>
      ) : filteredItems.length === 0 ? (
        <Card className="p-10 text-center">
          <Recycle className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="font-medium text-text">Recycle bin is empty</p>
          <p className="mt-1 text-sm text-text-light">
            Removed jobs and agreements appear here until you restore or permanently delete them.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card key={`${item.type}-${item.id}`} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        item.type === 'job' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent'
                      }`}
                    >
                      {item.type === 'job' ? 'Job' : 'Agreement'}
                    </span>
                    {item.type === 'agreement' && <AgreementStatusBadge status={item.status} />}
                    <p className="text-lg font-semibold text-text">{itemLabel(item)}</p>
                  </div>
                  <p className="mt-1 text-sm text-text">{itemSubtitle(item)}</p>
                  <p className="mt-1 text-sm text-text-light">{itemReason(item)}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    Removed {formatDisplayDate(item.deletedAt.slice(0, 10))}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate({ type: item.type, id: item.id })}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-danger hover:bg-danger/10"
                    onClick={() => {
                      setConfirmText('');
                      setPurgeTarget(item);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete forever
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(purgeTarget)}
        onClose={() => {
          if (!purgeMutation.isPending) {
            setPurgeTarget(null);
            setConfirmText('');
          }
        }}
        title="Delete permanently"
        description={
          purgeTarget
            ? `${purgeTarget.type === 'job' ? 'Job' : 'Agreement'} ${itemLabel(purgeTarget)} will be removed forever. This cannot be undone.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPurgeTarget(null);
                setConfirmText('');
              }}
              disabled={purgeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-danger hover:bg-danger/90"
              disabled={confirmText !== 'DELETE' || purgeMutation.isPending || !purgeTarget}
              onClick={() => {
                if (!purgeTarget) return;
                purgeMutation.mutate({ type: purgeTarget.type, id: purgeTarget.id });
              }}
            >
              {purgeMutation.isPending ? 'Deleting…' : 'Delete forever'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-light">
            Type <strong className="text-text">DELETE</strong> to confirm permanent removal.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            autoComplete="off"
          />
          {purgeMutation.error instanceof Error && (
            <p className="text-sm text-danger">{purgeMutation.error.message}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
