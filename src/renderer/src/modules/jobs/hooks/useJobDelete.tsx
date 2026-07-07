import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeleteJobInput } from '@shared/api-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { JobDeleteDialog, type JobDeleteTarget } from '@/modules/jobs/components/JobDeleteDialog';

interface UseJobDeleteOptions {
  onSuccess?: () => void;
}

export function useJobDelete(options?: UseJobDeleteOptions) {
  const queryClient = useQueryClient();
  const [jobToDelete, setJobToDelete] = useState<JobDeleteTarget | null>(null);

  const deleteMutation = useMutation({
    mutationFn: ({ jobId, input }: { jobId: string; input: DeleteJobInput }) =>
      getSitescopApi().jobs.delete(jobId, input),
    onSuccess: () => {
      setJobToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-completed'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      options?.onSuccess?.();
    },
  });

  function requestDelete(job: JobDeleteTarget) {
    deleteMutation.reset();
    setJobToDelete(job);
  }

  function closeDeleteDialog() {
    setJobToDelete(null);
    deleteMutation.reset();
  }

  const deleteError =
    deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : deleteMutation.isError
        ? 'Could not remove job.'
        : null;

  const deleteDialog = (
    <JobDeleteDialog
      job={jobToDelete}
      open={Boolean(jobToDelete)}
      isPending={deleteMutation.isPending}
      error={deleteError}
      onClose={closeDeleteDialog}
      onConfirm={(input) => {
        if (jobToDelete) {
          deleteMutation.mutate({ jobId: jobToDelete.id, input });
        }
      }}
    />
  );

  return { requestDelete, deleteDialog };
}
