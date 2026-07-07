import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, ClipboardCheck, Trash2, FileText } from 'lucide-react';
import { getSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, PageHeader } from '@/design-system/components';
import { formatDisplayDate } from '@/lib/dates';
import { INSPECTION_TYPE_LABELS, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { JobQuickActions } from '@/modules/jobs/components/JobQuickActions';
import { useJobDelete } from '@/modules/jobs/hooks/useJobDelete';

export function JobDetailPage() {
  const { jobId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const justCreated = Boolean((location.state as { created?: boolean } | null)?.created);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getSitescopApi().jobs.get(jobId),
    enabled: Boolean(jobId),
  });

  const isCompleted = job?.status === 'COMPLETED';
  const backPath = isCompleted ? '/jobs/completed' : '/jobs/in-progress';

  const { requestDelete, deleteDialog } = useJobDelete({
    onSuccess: () => navigate(backPath),
  });
  const startMutation = useMutation({
    mutationFn: () => getSitescopApi().jobs.start(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
    },
  });

  const agreementMutation = useMutation({
    mutationFn: () => getSitescopApi().agreements.createFromJob(jobId),
    onSuccess: (agreement) => {
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(`/agreements/${agreement.id}`);
    },
  });

  if (isLoading) {
    return <p className="text-text-light">Loading job...</p>;
  }

  if (error || !job) {
    return (
      <Card className="p-8 text-center">
        <p className="text-danger">Job not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/jobs/in-progress')}>
          Back to In Progress
        </Button>
      </Card>
    );
  }

  const backLabel = isCompleted ? 'Completed' : 'In Progress';

  return (
    <div>
      <PageHeader
        title={job.jobNumber}
        description={`${job.clientName} — ${INSPECTION_TYPE_LABELS[job.inspectionType]} inspection`}
        action={
          <Button variant="secondary" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        }
      />

      {justCreated && (
        <div className="mb-6 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Job created successfully — it now appears in In Progress
          {job.inspectionDate === new Date().toISOString().slice(0, 10) ? ' and on today\'s dashboard' : ''}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={job.inspectionType} />
            <StatusBadge status={job.status} />
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Client</dt>
              <dd className="mt-1 font-medium text-text">{job.clientName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Mobile</dt>
              <dd className="mt-1 text-text">{job.mobile || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Email</dt>
              <dd className="mt-1 text-text">{job.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Scheduled</dt>
              <dd className="mt-1 text-text">
                {formatDisplayDate(job.inspectionDate)} at {job.inspectionTime}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold uppercase text-text-muted">Property</dt>
              <dd className="mt-1 text-text">{job.propertyAddress}</dd>
            </div>
            {job.realEstate && (
              <div>
                <dt className="text-xs font-bold uppercase text-text-muted">Real estate</dt>
                <dd className="mt-1 text-text">{job.realEstate}</dd>
              </div>
            )}
            {job.agentName && (
              <div>
                <dt className="text-xs font-bold uppercase text-text-muted">Agent</dt>
                <dd className="mt-1 text-text">{job.agentName}</dd>
              </div>
            )}
            {job.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-text-muted">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-text">{job.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="space-y-3 p-6">
          <h3 className="font-bold text-text">Actions</h3>
          <div className="flex flex-col gap-2">
            {job.status === 'NEW' && (
              <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                <Play className="h-4 w-4" />
                Start inspection
              </Button>
            )}
            {(job.agreementStatus === 'NONE' || job.agreementStatus === 'DRAFT') && (
              <Button
                variant="secondary"
                onClick={() => agreementMutation.mutate()}
                disabled={agreementMutation.isPending}
              >
                <FileText className="h-4 w-4" />
                {job.agreementStatus === 'DRAFT' ? 'Open agreement' : 'Create agreement'}
              </Button>
            )}
            {job.agreementStatus === 'SENT' && (
              <Button variant="secondary" onClick={() => navigate('/agreements?status=SENT')}>
                <FileText className="h-4 w-4" />
                Agreement sent
              </Button>
            )}
            {job.agreementStatus === 'SIGNED' && (
              <Button variant="secondary" onClick={() => navigate('/agreements?status=SIGNED')}>
                <FileText className="h-4 w-4" />
                Agreement signed
              </Button>
            )}
            <Button
              variant="accent"
              onClick={() => navigate(`/jobs/${jobId}/inspection`)}
            >
              <ClipboardCheck className="h-4 w-4" />
              {isCompleted ? 'View inspection & PDFs' : 'Open inspection workspace'}
            </Button>
            <JobQuickActions
              jobId={jobId}
              jobNumber={job.jobNumber}
              email={job.email}
              mobile={job.mobile}
              propertyAddress={job.propertyAddress}
            />
            <Button
              variant="secondary"
              className="border-danger/30 text-danger hover:bg-danger/10"
              onClick={() => requestDelete(job)}
            >
              <Trash2 className="h-4 w-4" />
              Delete job
            </Button>
          </div>
          <p className="pt-2 text-xs text-text-muted">
            Inspection record: {job.inspectionStatus.replace('_', ' ')}
            {job.hasReport ? ' · PDF report generated' : ''}
          </p>
        </Card>
      </div>

      {deleteDialog}
    </div>
  );
}
