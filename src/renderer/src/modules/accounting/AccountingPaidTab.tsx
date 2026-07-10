import { useQuery } from '@tanstack/react-query';
import { getSitescopApi } from '@/lib/sitescop-api';
import { AccountingJobList } from '@/modules/accounting/components/AccountingJobList';
import { useAccountingRefresh } from '@/modules/accounting/useAccountingActions';

export function AccountingPaidTab() {
  const refreshAccounting = useAccountingRefresh();

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accounting-paid'],
    queryFn: () => getSitescopApi().accounting.listPaid(),
    refetchOnMount: 'always',
  });

  function refresh() {
    void refetch();
    refreshAccounting();
  }

  return (
    <AccountingJobList
      jobs={jobs}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRefresh={refresh}
      mode="paid"
      emptyTitle="No paid jobs yet"
      emptyDescription="Jobs move here after you mark them as paid from the job or awaiting payment list."
    />
  );
}
