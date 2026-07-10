import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import type { AgreementStatus } from '@shared/api-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, Input } from '@/design-system/components';
import {
  AGREEMENT_STATUS_LABELS,
  AgreementStatusBadge,
  formatAud,
} from '@/modules/agreements/agreement-labels';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';

const STATUS_TABS: Array<{ id: string; label: string; status: AgreementStatus | '' }> = [
  { id: 'all', label: 'All', status: '' },
  ...(
    Object.entries(AGREEMENT_STATUS_LABELS) as Array<[AgreementStatus, string]>
  ).map(([status, label]) => ({ id: status, label, status })),
];

export function AgreementsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') ?? '') as AgreementStatus | '';
  const search = searchParams.get('search') ?? '';
  const [searchInput, setSearchInput] = useState(search);

  const { data: agreements = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agreements', status, search],
    queryFn: () => getSitescopApi().agreements.list({ status, search }),
    refetchOnMount: 'always',
  });

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    setSearchParams(next);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Client agreements</p>
            <p className="text-sm text-text-light">Send, track, and collect signed inspection agreements</p>
          </div>
        </div>
        <Button onClick={() => navigate('/agreements/new')}>
          <Plus className="h-4 w-4" />
          New agreement
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={(status || 'all') === (tab.status || 'all') ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (tab.status) next.set('status', tab.status);
              else next.delete('status');
              setSearchParams(next);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <form className="mb-6 flex flex-col gap-3 sm:flex-row" onSubmit={applySearch}>
        <Input
          placeholder="Search by agreement #, client, property, job…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load agreements: {error instanceof Error ? error.message : 'Unknown error'}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-text-light">Loading agreements...</p>
      ) : agreements.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">No agreements yet</p>
          <p className="mt-2 text-sm text-text-light">
            Create an agreement from here or from a job in In Progress.
          </p>
          <Button className="mt-6" onClick={() => navigate('/agreements/new')}>
            <Plus className="h-4 w-4" />
            New agreement
          </Button>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <ul className="divide-y divide-border">
            {agreements.map((agreement) => (
              <li
                key={agreement.id}
                className="cursor-pointer px-4 py-4 transition-colors hover:bg-background/80"
                onClick={() => navigate(`/agreements/${agreement.id}`)}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-bold text-text-light">{agreement.agreementNumber}</p>
                      <AgreementStatusBadge status={agreement.status} />
                    </div>
                    <p className="font-semibold text-text">{agreement.clientName}</p>
                    <p className="mt-1 text-sm text-text-light">{agreement.propertyAddress}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {INSPECTION_TYPE_LABELS[agreement.inspectionType]}
                      {agreement.jobNumber ? ` · ${agreement.jobNumber}` : ''}
                      {agreement.signerRole === 'AGENT' && agreement.agentName
                        ? ` · Agent: ${agreement.agentName}`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{formatAud(agreement.totalCents)}</p>
                    <p className="text-xs text-text-muted">inc. GST</p>
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
