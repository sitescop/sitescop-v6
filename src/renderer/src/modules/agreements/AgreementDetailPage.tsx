import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, ExternalLink, Send, Trash2, CircleDollarSign } from 'lucide-react';
import { getSettingsApi, getSitescopApi } from '@/lib/sitescop-api';
import { cn } from '@/lib/cn';
import { Button, Card, Modal } from '@/design-system/components';
import {
  AgreementCloudSigningStatus,
  resolveCloudSigningStatus,
} from '@/modules/agreements/AgreementCloudSigningStatus';
import {
  AgreementStatusBadge,
  formatAud,
  buildClientSigningUrl,
} from '@/modules/agreements/agreement-labels';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';
import { formatDisplayDate } from '@/lib/dates';

export function AgreementDetailPage() {
  const { agreementId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [signingUrl, setSigningUrl] = useState('');
  const [signingMode, setSigningMode] = useState<'github' | 'local'>('local');
  const [copyMessage, setCopyMessage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const [republishing, setRepublishing] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['settings-github'],
    queryFn: () => getSettingsApi().getGitHub(),
  });

  const githubEnabled = Boolean(settingsQuery.data?.enabled);

  const { data: agreement, isLoading, error } = useQuery({
    queryKey: ['agreement', agreementId],
    queryFn: () => getSitescopApi().agreements.get(agreementId),
    enabled: Boolean(agreementId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (githubEnabled && (status === 'SENT' || status === 'VIEWED')) {
        return 15_000;
      }
      return false;
    },
  });

  const linkedJobId = agreement?.jobId;
  const { data: linkedJob } = useQuery({
    queryKey: ['job', linkedJobId],
    queryFn: () => getSitescopApi().jobs.get(linkedJobId!),
    enabled: Boolean(linkedJobId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['agreement', agreementId] });
    void queryClient.invalidateQueries({ queryKey: ['agreements'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-awaiting'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-paid'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-by-client'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['jobs-outstanding-invoices'] });
  }

  useEffect(() => {
    if (!githubEnabled || !agreement) return;

    if (agreement.status === 'SIGNED') {
      setUploadError(null);
      setSyncFailed(false);
      return;
    }

    if (agreement.status !== 'SENT' && agreement.status !== 'VIEWED') return;

    let cancelled = false;

    const sync = () => {
      void getSitescopApi()
        .agreements.syncFromGitHub()
        .then((result) => {
          if (cancelled) return;
          if (result.failed) {
            setSyncFailed(true);
          } else {
            setSyncFailed(false);
          }
          if (result.imported > 0 || result.viewed > 0) {
            invalidate();
          }
        })
        .catch(() => {
          if (!cancelled) setSyncFailed(true);
        });
    };

    sync();
    const interval = window.setInterval(sync, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [githubEnabled, agreement?.status, agreementId]);

  const sendMutation = useMutation({
    mutationFn: () => getSitescopApi().agreements.send(agreementId),
    onMutate: () => {
      setUploadError(null);
      setSyncFailed(false);
    },
    onSuccess: (result) => {
      setSigningUrl(result.signingUrl);
      setSigningMode(result.signingMode);
      setShowLinkModal(true);
      invalidate();
    },
    onError: (e) => {
      setUploadError(e instanceof Error ? e.message : 'Could not send agreement');
      invalidate();
    },
  });

  const paidCreateJobMutation = useMutation({
    mutationFn: () => getSitescopApi().agreements.createJobFromSigned(agreementId),
    onSuccess: (result) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['job', result.job.id] });
      navigate('/jobs/in-progress', {
        state: {
          createdJobNumber: result.job.jobNumber,
          createdClientName: result.job.clientName,
        },
      });
    },
    onError: (e) => {
      setCopyMessage(e instanceof Error ? e.message : 'Could not create job from agreement.');
      setTimeout(() => setCopyMessage(''), 6000);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (linkedJobId: string) => getSitescopApi().jobs.markPaid(linkedJobId),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(['job', updatedJob.id], updatedJob);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['job', updatedJob.id] });
    },
    onError: (e) => {
      setCopyMessage(e instanceof Error ? e.message : 'Could not mark job as paid.');
      setTimeout(() => setCopyMessage(''), 6000);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => getSitescopApi().agreements.cancel(agreementId),
    onSuccess: () => {
      invalidate();
      navigate('/agreements');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => getSitescopApi().agreements.delete(agreementId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      invalidate();
      navigate('/agreements');
    },
  });

  const pdfMutation = useMutation({
    mutationFn: async () => {
      const path = await getSitescopApi().agreements.generatePdf(agreementId);
      await getSitescopApi().agreements.openPdf(path);
      invalidate();
    },
  });

  const copyPdfMutation = useMutation({
    mutationFn: async () => {
      const path =
        agreement?.pdfPath ?? (await getSitescopApi().agreements.generatePdf(agreementId));
      const result = await getSitescopApi().reports.copyPdf(path);
      invalidate();
      return result;
    },
    onSuccess: (result) => {
      setCopyMessage(result.message);
      setTimeout(() => setCopyMessage(''), 5000);
    },
  });

  async function refreshCloudSigningPage() {
    if (!githubEnabled || !agreementId) return;
    setRepublishing(true);
    setUploadError(null);
    try {
      await getSitescopApi().agreements.republishToGitHub(agreementId);
      invalidate();
      setCopyMessage('Cloud signing page updated. Ask the client to hard-refresh the link (Ctrl+F5).');
      setTimeout(() => setCopyMessage(''), 6000);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not update the cloud signing page.');
    } finally {
      setRepublishing(false);
    }
  }

  async function copySigningLink() {
    let url = signingUrl;
    if (!url && agreement?.accessToken) {
      url = await buildClientSigningUrl(agreement.accessToken);
      setSigningUrl(url);
    }
    if (!url) {
      setCopyMessage('No signing link available yet. Try Resend / get link first.');
      setTimeout(() => setCopyMessage(''), 4000);
      return;
    }

    try {
      const result = await getSitescopApi().shell.copyTextToClipboard(url);
      setCopyMessage(result.message || 'Signing link copied to clipboard.');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopyMessage('Signing link copied to clipboard.');
      } catch {
        setCopyMessage('Could not copy automatically — select the link below and press Ctrl+C.');
      }
    }
    setTimeout(() => setCopyMessage(''), 5000);
  }

  async function sendSigningLinkEmail() {
    if (!agreementId) return;
    try {
      const result = await getSitescopApi().agreements.emailSigningLink(agreementId);
      if (result.cancelled) return;
      setCopyMessage(result.message || `Email opened for ${result.clientEmail}.`);
      setTimeout(() => setCopyMessage(''), 6000);
    } catch (e) {
      setCopyMessage(e instanceof Error ? e.message : 'Could not open email.');
      setTimeout(() => setCopyMessage(''), 6000);
    }
  }

  async function showCopyLinkModal() {
    if (!agreement?.accessToken) return;
    const resolved = await getSitescopApi().agreements.resolveSigningUrl(agreement.accessToken);
    setSigningUrl(resolved.url);
    setSigningMode(resolved.mode);
    setShowLinkModal(true);
  }

  if (isLoading) return <p className="text-text-light">Loading agreement...</p>;

  if (error || !agreement) {
    return (
      <Card className="p-8 text-center">
        <p className="text-danger">Agreement not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/agreements')}>
          Back to Agreements
        </Button>
      </Card>
    );
  }

  const cloudStatus = resolveCloudSigningStatus({
    githubEnabled,
    agreementStatus: agreement.status,
    isUploading: sendMutation.isPending,
    uploadError,
    syncFailed,
  });

  const canSend = ['DRAFT', 'SENT', 'VIEWED'].includes(agreement.status);
  const canEdit = agreement.status === 'DRAFT';
  const canCancel = agreement.status !== 'SIGNED' && agreement.status !== 'CANCELLED';
  const canCreateJob = agreement.status === 'SIGNED' && !agreement.jobId;
  const canMarkPaid = Boolean(
    agreement.jobId && linkedJob?.agreementStatus === 'SIGNED' && !linkedJob.paymentReceived,
  );

  return (
    <div>
      <Button variant="secondary" className="mb-6" onClick={() => navigate('/agreements')}>
        <ArrowLeft className="h-4 w-4" />
        Agreements
      </Button>

      <AgreementCloudSigningStatus
        status={cloudStatus}
        detail={
          cloudStatus === 'upload_failed'
            ? uploadError ?? undefined
            : cloudStatus === 'sync_failed'
              ? 'Could not download signatures from GitHub. Check Settings and your connection.'
              : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-text">{agreement.agreementNumber}</h2>
            <AgreementStatusBadge status={agreement.status} />
          </div>
          <p className="mt-1 text-text-light">
            {agreement.clientName} — {INSPECTION_TYPE_LABELS[agreement.inspectionType]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" onClick={() => navigate(`/agreements/${agreement.id}/edit`)}>
              Edit
            </Button>
          )}
          {canSend && (
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              <Send className="h-4 w-4" />
              {sendMutation.isPending
                ? githubEnabled
                  ? 'Uploading…'
                  : 'Sending…'
                : agreement.status === 'DRAFT'
                  ? 'Send to client'
                  : 'Resend / get link'}
            </Button>
          )}
          {githubEnabled && (agreement.status === 'SENT' || agreement.status === 'VIEWED') && (
            <Button variant="secondary" onClick={() => void refreshCloudSigningPage()} disabled={republishing}>
              <ExternalLink className="h-4 w-4" />
              {republishing ? 'Updating cloud page…' : 'Update cloud page'}
            </Button>
          )}
          {agreement.accessToken && (
            <Button variant="secondary" onClick={() => void showCopyLinkModal()}>
              <Send className="h-4 w-4" />
              Send link
            </Button>
          )}
          <Button variant="secondary" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>
            <Download className="h-4 w-4" />
            {pdfMutation.isPending ? 'Generating…' : 'Open PDF'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => copyPdfMutation.mutate()}
            disabled={copyPdfMutation.isPending}
          >
            <Copy className="h-4 w-4" />
            {copyPdfMutation.isPending ? 'Copying…' : 'Copy PDF'}
          </Button>
          {canCreateJob && (
            <Button
              variant="accent"
              onClick={() => {
                if (
                  window.confirm(
                    `Create an unpaid job for ${agreement.clientName} from ${agreement.agreementNumber}?`,
                  )
                ) {
                  paidCreateJobMutation.mutate();
                }
              }}
              disabled={paidCreateJobMutation.isPending}
            >
              <CircleDollarSign className="h-4 w-4" />
              {paidCreateJobMutation.isPending ? 'Creating job…' : 'Create job'}
            </Button>
          )}
          {canMarkPaid && agreement.jobId && (
            <Button
              variant="accent"
              onClick={() => {
                if (
                  window.confirm(
                    `Mark ${linkedJob?.jobNumber ?? 'this job'} as paid? The client can then receive inspection reports.`,
                  )
                ) {
                  markPaidMutation.mutate(agreement.jobId!);
                }
              }}
              disabled={markPaidMutation.isPending}
            >
              <CircleDollarSign className="h-4 w-4" />
              {markPaidMutation.isPending ? 'Updating…' : 'Mark as paid'}
            </Button>
          )}
          {agreement.jobId && (
            <Button variant="accent" onClick={() => navigate(`/jobs/${agreement.jobId}`)}>
              <ExternalLink className="h-4 w-4" />
              View job
            </Button>
          )}
          {canCancel && (
            <Button
              variant="secondary"
              className="border-danger/30 text-danger hover:bg-danger/10"
              onClick={() => {
                if (window.confirm(`Cancel agreement ${agreement.agreementNumber}?`)) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button
            variant="secondary"
            className="border-danger/30 text-danger hover:bg-danger/10"
            onClick={() => {
              const message =
                agreement.status === 'SIGNED'
                  ? `Move signed agreement ${agreement.agreementNumber} to the recycle bin? You can restore it later.`
                  : `Move agreement ${agreement.agreementNumber} to the recycle bin?`;
              if (window.confirm(message)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? 'Moving…' : 'Move to recycle bin'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Client</dt>
              <dd className="mt-1 font-medium text-text">{agreement.clientName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Email</dt>
              <dd className="mt-1 text-text">{agreement.clientEmail}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Mobile</dt>
              <dd className="mt-1 text-text">{agreement.clientPhone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-text-muted">Agreement date</dt>
              <dd className="mt-1 text-text">{formatDisplayDate(agreement.agreementDate)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold uppercase text-text-muted">Property</dt>
              <dd className="mt-1 text-text">{agreement.propertyAddress}</dd>
            </div>
            {(agreement.agentName || agreement.signerRole === 'AGENT') && (
              <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <dt className="text-xs font-bold uppercase text-primary">Agent on signing link</dt>
                <dd className="mt-1 font-medium text-text">{agreement.agentName || 'Agent on linked job'}</dd>
                {agreement.agencyName ? (
                  <dd className="text-sm text-text-light">{agreement.agencyName}</dd>
                ) : null}
                {agreement.agentEmail ? (
                  <dd className="mt-1 text-sm text-text">{agreement.agentEmail}</dd>
                ) : null}
                <p className="mt-2 text-xs text-text-muted">
                  The signing link lets the client or agent choose who signs. Send the link to whoever
                  will sign first.
                </p>
              </div>
            )}
            {agreement.jobNumber && (
              <div>
                <dt className="text-xs font-bold uppercase text-text-muted">Linked job</dt>
                <dd className="mt-1 font-mono text-text">{agreement.jobNumber}</dd>
              </div>
            )}
            {agreement.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-text-muted">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-text">{agreement.notes}</dd>
              </div>
            )}
          </dl>

          <div className="border-t border-border pt-4">
            <h3 className="font-bold text-text">Legal terms included</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-text-light">
              {agreement.legalSections.sections.map((section) => (
                <li key={section.id}>{section.title}</li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <h3 className="font-bold text-text">Pricing</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-light">Ex GST</dt>
              <dd>{formatAud(agreement.priceCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-light">GST</dt>
              <dd>{formatAud(agreement.gstCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="text-primary">{formatAud(agreement.totalCents)}</dd>
            </div>
          </dl>
          {agreement.signedAt && (
            <p className="pt-2 text-xs text-success">
              Signed {formatDisplayDate(agreement.signedAt.slice(0, 10))}
              {agreement.signatureName
                ? agreement.signerRole === 'AGENT' && agreement.signedOnBehalfOf
                  ? ` by ${agreement.signatureName} on behalf of ${agreement.signedOnBehalfOf}`
                  : ` by ${agreement.signatureName}`
                : ''}
            </p>
          )}
        </Card>
      </div>

      <Modal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title={agreement.signerRole === 'AGENT' && agreement.agentName ? 'Signing link' : 'Client signing link'}
        description={
          agreement.signerRole === 'AGENT' && agreement.agentName
            ? 'Send this link to the agent to sign on behalf of the client. You can also copy it and email the client if they will sign themselves.'
            : 'Send this link to your client by email or SMS.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLinkModal(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => void copySigningLink()}>
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button onClick={() => void sendSigningLinkEmail()}>
              <Send className="h-4 w-4" />
              Send link
            </Button>
          </>
        }
      >
        <input
          readOnly
          value={signingUrl}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          className="w-full break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-text"
          aria-label="Client signing link"
        />
        {copyMessage && (
          <p
            className={cn(
              'mt-3 text-sm',
              copyMessage.includes('Could not') ? 'text-danger' : 'text-success',
            )}
          >
            {copyMessage}
          </p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          {signingMode === 'github' ? (
            <>
              GitHub Cloud Signing link — works from anywhere on any device. SiteScop syncs the
              signature from GitHub automatically every 60 seconds.
            </>
          ) : (
            <>
              Local signing link — client must be on the same Wi‑Fi as this PC. Enable GitHub Cloud
              Signing in Settings for links that work anywhere.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}
