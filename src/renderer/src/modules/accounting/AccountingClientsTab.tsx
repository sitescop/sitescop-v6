import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Download, Search, Users } from 'lucide-react';
import { getSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, Input } from '@/design-system/components';
import { formatAud } from '@/modules/agreements/agreement-labels';
import { exportAccountingClientsCsv } from '@/modules/accounting/accounting-utils';

export function AccountingClientsTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accounting-by-client'],
    queryFn: () => getSitescopApi().accounting.listByClient(),
    refetchOnMount: 'always',
  });

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => client.clientName.toLowerCase().includes(term));
  }, [clients, search]);

  const totalOwed = clients.reduce((sum, client) => sum + client.amountOwedCents, 0);
  const totalPaid = clients.reduce((sum, client) => sum + client.amountPaidCents, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {!isLoading && clients.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => exportAccountingClientsCsv(clients)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="border-danger/20 bg-danger/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Total awaiting</p>
          <p className="mt-1 text-2xl font-bold text-danger">{formatAud(totalOwed)}</p>
          <p className="mt-1 text-sm text-text-light">Across all clients with unpaid signed jobs</p>
        </Card>
        <Card className="border-success/20 bg-success/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Total received</p>
          <p className="mt-1 text-2xl font-bold text-success">{formatAud(totalPaid)}</p>
          <p className="mt-1 text-sm text-text-light">From jobs marked as paid</p>
        </Card>
      </div>

      {isError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not load client totals: {error instanceof Error ? error.message : 'Unknown error'}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && clients.length > 0 && (
        <form
          className="mb-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="secondary">
            <Search className="h-4 w-4" />
            {filteredClients.length} of {clients.length}
          </Button>
        </form>
      )}

      {isLoading ? (
        <p className="text-text-light">Loading client accounts…</p>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text">No client payment history yet</p>
          <p className="mt-2 text-sm text-text-light">
            Clients appear here once they have signed agreements linked to jobs.
          </p>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-light">No clients match your search.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <ul className="divide-y divide-border">
            {filteredClients.map((client) => (
              <li key={client.clientId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-background/80"
                  onClick={() => navigate(`/clients/${client.clientId}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text">{client.clientName}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {client.unpaidJobCount > 0 ? (
                        <span className="font-medium text-danger">
                          {client.unpaidJobCount} awaiting · {formatAud(client.amountOwedCents)}
                        </span>
                      ) : null}
                      {client.paidJobCount > 0 ? (
                        <span className="font-medium text-success">
                          {client.paidJobCount} paid · {formatAud(client.amountPaidCents)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
