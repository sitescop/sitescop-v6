import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Mail, Phone, Search, Users } from 'lucide-react';
import { getClientsApi, hasClientsApi } from '@/lib/sitescop-api';
import { FeatureRestartNotice } from '@/components/FeatureRestartNotice';
import { Button, Card, Input } from '@/design-system/components';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ClientsPage() {
  const apiReady = hasClientsApi();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => getClientsApi().list(search || undefined),
    enabled: apiReady,
    refetchOnMount: 'always',
  });

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  if (!apiReady) {
    return <FeatureRestartNotice feature="Clients" />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Clients</p>
            <p className="text-sm text-text-light">
              People linked to your inspection jobs and agreements
            </p>
          </div>
        </div>
      </div>

      <form className="mb-6 flex flex-col gap-3 sm:flex-row" onSubmit={applySearch}>
        <Input
          placeholder="Search by name, email, or phone…"
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
          Could not load clients: {error instanceof Error ? error.message : 'Unknown error'}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-light">Loading clients…</p>
      ) : clients.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium text-text">No clients yet</p>
          <p className="mt-2 text-sm text-text-light">
            Clients are added automatically when you create a new job or agreement.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/clients/${client.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/clients/${client.id}`);
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text">
                    {client.firstName} {client.lastName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-light">
                    {client.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {client.email}
                      </span>
                    )}
                    {client.mobile && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {client.mobile}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right text-sm">
                  <div>
                    <p className="font-medium text-text">
                      {client.jobCount} job{client.jobCount === 1 ? '' : 's'}
                    </p>
                    <p className="text-text-light">Last inspection: {formatDate(client.lastJobDate)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-text-muted" aria-hidden />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
