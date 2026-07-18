import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientsApi, getSitescopApi } from '@/lib/sitescop-api';

export function useAccountingRefresh() {
  const queryClient = useQueryClient();

  return function refreshAccounting() {
    void queryClient.invalidateQueries({ queryKey: ['accounting-awaiting'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-paid'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-by-client'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['jobs-outstanding-invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
  };
}

export function useMarkJobPaid(options?: {
  onSuccess?: (job: unknown, jobId: string) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  const refreshAccounting = useAccountingRefresh();

  return useMutation({
    mutationFn: (jobId: string) => getSitescopApi().jobs.markPaid(jobId),
    onSuccess: (job, jobId) => {
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      refreshAccounting();
      options?.onSuccess?.(job, jobId);
    },
    onError: (error: Error) => {
      if (options?.onError) {
        options.onError(error);
        return;
      }
      window.alert(error.message || 'Could not mark job as paid.');
    },
  });
}

export async function openJobInvoice(jobId: string) {
  await getClientsApi().openInvoicePdf(jobId);
}

export function usePushToXero() {
  const queryClient = useQueryClient();
  const refreshAccounting = useAccountingRefresh();

  return useMutation({
    mutationFn: (jobId: string) => getSitescopApi().accounting.pushToXero(jobId),
    onSuccess: (result, jobId) => {
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-awaiting'] });
      void queryClient.invalidateQueries({ queryKey: ['accounting-paid'] });
      refreshAccounting();
      window.alert(result.message);
    },
    onError: (error: Error) => {
      window.alert(error.message || 'Could not send invoice to Xero.');
    },
  });
}
