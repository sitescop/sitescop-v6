import { useEffect, useState } from 'react';
import type { DeleteJobInput, JobDeleteReason } from '@shared/api-types';
import { Button, Input, Modal, Select } from '@/design-system/components';

export type JobDeleteTarget = {
  id: string;
  jobNumber: string;
  clientName: string;
};

export const JOB_DELETE_REASON_LABELS: Record<JobDeleteReason, string> = {
  CLIENT_CANCEL: 'Client cancelled',
  INSPECTOR_CANCEL: 'Inspector cancelled',
  DUPLICATED: 'Duplicated',
  OTHER: 'Other',
};

const REASON_OPTIONS = (Object.keys(JOB_DELETE_REASON_LABELS) as JobDeleteReason[]).map((value) => ({
  value,
  label: JOB_DELETE_REASON_LABELS[value],
}));

interface JobDeleteDialogProps {
  job: JobDeleteTarget | null;
  open: boolean;
  isPending?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (input: DeleteJobInput) => void;
}

export function JobDeleteDialog({ job, open, isPending, error, onClose, onConfirm }: JobDeleteDialogProps) {
  const [reason, setReason] = useState<JobDeleteReason>('CLIENT_CANCEL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setReason('CLIENT_CANCEL');
      setNotes('');
    }
  }, [open, job?.id]);

  const needsNotes = reason === 'OTHER';
  const canConfirm = Boolean(job) && (!needsNotes || notes.trim().length > 0);

  function handleConfirm() {
    if (!job || !canConfirm) return;
    onConfirm({
      reason,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to recycle bin"
      description={
        job
          ? `${job.jobNumber} · ${job.clientName} — the job will be hidden from your lists until you restore it from Recycle Bin.`
          : 'Select a reason for removing this job from your lists.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-danger hover:bg-danger/90"
            disabled={!canConfirm || isPending}
            onClick={handleConfirm}
          >
            {isPending ? 'Moving…' : 'Move to recycle bin'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Reason for removal"
          value={reason}
          onChange={(e) => setReason(e.target.value as JobDeleteReason)}
          options={REASON_OPTIONS}
        />
        {needsNotes && (
          <Input
            label="Please describe"
            placeholder="Enter the reason…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-text-muted">
          The job is removed from In Progress and Completed lists. The reason is saved for your records.
        </p>
      </div>
    </Modal>
  );
}
