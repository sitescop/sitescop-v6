import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getSitescopApi } from '@/lib/sitescop-api';
import { AccountingJobList } from '@/modules/accounting/components/AccountingJobList';
import { type AccountingJobFilter } from '@/modules/accounting/accounting-utils';
import { useAccountingRefresh } from '@/modules/accounting/useAccountingActions';

function parseFilter(value: string | null): AccountingJobFilter {
  if (value === 'overdue' || value === 'ready') return value;
  return 'all';
}

export function AccountingAwaitingTab() {
  const refreshAccounting = useAccountingRefresh();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobFilter, setJobFilter] = useState<AccountingJobFilter>(() =>
    parseFilter(searchParams.get('filter')),
  );

  useEffect(() => {
    setJobFilter(parseFilter(searchParams.get('filter')));
  }, [searchParams]);

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accounting-awaiting'],
    queryFn: () => getSitescopApi().accounting.listAwaitingPayment(),
    refetchOnMount: 'always',
  });

  function refresh() {
    void refetch();
    refreshAccounting();
  }

  function handleFilterChange(filter: AccountingJobFilter) {
    setJobFilter(filter);
    if (filter === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter });
    }
  }

  return (
    <AccountingJobList
      jobs={jobs}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRefresh={refresh}
      mode="awaiting"
      jobFilter={jobFilter}
      onJobFilterChange={handleFilterChange}
      emptyTitle="No jobs awaiting payment"
      emptyDescription="Jobs appear here after the client signs the agreement and before you mark them as paid."
    />
  );
}
