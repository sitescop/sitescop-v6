import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  PenLine,
  Send,
  Trash2,
  CircleDollarSign,
} from 'lucide-react';
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
} from '@/modules/agreements/agreement-labels';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';
import { formatDisplayDate } from '@/lib/dates';

export function AgreementDetailPage() {
  const { agreementId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const contactUpdated = Boolean(
    (location.state as { contactUpdated?: boolean } | null)?.contactUpdated,
  );
  const [signingUrl, setSigningUrl] = useState('');
  const [signingMode, setSigningMode] = useState<'github' | 'local'>('local');
  const [copyMessage, setCopyMessage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [openingOnDevice, setOpeningOnDevice] = useState(false);
  const [signingBusy, setSigningBusy] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseConfirmOpen, setReviseConfirmOpen] = useState(false);

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
      void queryClient.invalidateQueries({ queryKey: ['client'] });
      void queryClient.invalidateQueries({ queryKey: ['job'] });
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
      const result = await getSitescopApi().agreements.republishToGitHub(agreementId);
      invalidate();
      setCopyMessage(
        result?.message ||
          'Cloud signing page updated. Ask the client to hard-refresh the link (Ctrl+F5).',
      );
      setTimeout(() => setCopyMessage(''), 8000);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not update the cloud signing page.');
    } finally {
      setRepublishing(false);
    }
  }

  /** Ensures a signing link exists (sends draft if needed) and returns the active URL. */
  async function ensureSigningLink(): Promise<{ url: string; mode: 'github' | 'local' }> {
    if (agreement?.status === 'SIGNED') {
      throw new Error('This agreement is already signed.');
    }
    if (agreement?.status === 'CANCELLED') {
      throw new Error('This agreement has been cancelled.');
    }

    if (agreement?.status === 'DRAFT' || !agreement?.accessToken) {
      setUploadError(null);
      const result = await getSitescopApi().agreements.send(agreementId);
      setSigningUrl(result.signingUrl);
      setSigningMode(result.signingMode);
      invalidate();
      return { url: result.signingUrl, mode: result.signingMode };
    }

    if (signingUrl) {
      return { url: signingUrl, mode: signingMode };
    }

    const resolved = await getSitescopApi().agreements.resolveSigningUrl(agreement.accessToken);
    setSigningUrl(resolved.url);
    setSigningMode(resolved.mode);
    return { url: resolved.url, mode: resolved.mode };
  }

  function showAlreadySignedMessage() {
    const message = 'This agreement is already signed.';
    setCopyMessage(message);
    setUploadError(null);
    setTimeout(() => setCopyMessage(''), 6000);
  }

  async function confirmCreateRevisedAgreement() {
    if (!agreementId) return;
    setRevising(true);
    try {
      const revised = await getSitescopApi().agreements.createRevised(agreementId);
      setReviseConfirmOpen(false);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['client'] });
      void queryClient.invalidateQueries({ queryKey: ['job'] });
      navigate(`/agreements/${revised.id}/edit`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not create revised agreement.';
      setUploadError(message);
      setCopyMessage(message);
      setTimeout(() => setCopyMessage(''), 6000);
    } finally {
      setRevising(false);
    }
  }

  async function copySigningLink() {
    if (agreement?.status === 'SIGNED') {
      showAlreadySignedMessage();
      return;
    }
    setSigningBusy(true);
    try {
      const { url } = await ensureSigningLink();
      try {
        const result = await getSitescopApi().shell.copyTextToClipboard(url);
        setCopyMessage(result.message || 'Signing link copied to clipboard.');
      } catch {
        await navigator.clipboard.writeText(url);
        setCopyMessage('Signing link copied to clipboard.');
      }
    } catch (e) {
      setCopyMessage(e instanceof Error ? e.message : 'Could not copy signing link.');
    } finally {
      setSigningBusy(false);
      setTimeout(() => setCopyMessage(''), 5000);
    }
  }

  async function sendSigningLinkEmail() {
    if (!agreementId) return;
    if (agreement?.status === 'SIGNED') {
      showAlreadySignedMessage();
      return;
    }
    setSigningBusy(true);
    try {
      await ensureSigningLink();
      const result = await getSitescopApi().agreements.emailSigningLink(agreementId);
      if (result.cancelled) return;
      setCopyMessage(result.message || `Email opened for ${result.clientEmail}.`);
      setTimeout(() => setCopyMessage(''), 6000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not open email.';
      setUploadError(message);
      setCopyMessage(message);
      setTimeout(() => setCopyMessage(''), 6000);
    } finally {
      setSigningBusy(false);
    }
  }

  async function signFromThisDevice() {
    if (!agreementId) return;
    if (agreement?.status === 'SIGNED') {
      showAlreadySignedMessage();
      return;
    }
    setOpeningOnDevice(true);
    setSigningBusy(true);
    try {
      const { url } = await ensureSigningLink();
      await getSitescopApi().shell.openExternal(url);
      setCopyMessage('Signing page opened in your browser.');
      setTimeout(() => setCopyMessage(''), 5000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not open signing page.';
      setUploadError(message);
      setCopyMessage(message);
      setTimeout(() => setCopyMessage(''), 6000);
    } finally {
      setOpeningOnDevice(false);
      setSigningBusy(false);
    }
  }

  useEffect(() => {
    if (!agreement?.accessToken) return;
    if (agreement.status === 'SIGNED' || agreement.status === 'CANCELLED') return;
    if (signingUrl) return;
    let cancelled = false;
    void getSitescopApi()
      .agreements.resolveSigningUrl(agreement.accessToken)
      .then((resolved) => {
        if (cancelled) return;
        setSigningUrl(resolved.url);
        setSigningMode(resolved.mode);
      })
      .catch(() => {
        /* ignore — link resolves when user clicks an action */
      });
    return () => {
      cancelled = true;
    };
  }, [agreement?.accessToken, agreement?.status, signingUrl]);

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
    isUploading: signingBusy,
    uploadError,
    syncFailed,
  });

  const canSend = ['DRAFT', 'SENT', 'VIEWED'].includes(agreement.status) && !agreement.archivedAt;
  const canEdit = agreement.status === 'DRAFT' && !agreement.archivedAt;
  const canEditContact =
    (agreement.status === 'SENT' || agreement.status === 'VIEWED') && !agreement.archivedAt;
  const canRevise = agreement.status === 'SIGNED' && !agreement.archivedAt;
  const canCancel = agreement.status !== 'SIGNED' && agreement.status !== 'CANCELLED' && !agreement.archivedAt;
  const canCreateJob = agreement.status === 'SIGNED' && !agreement.jobId && !agreement.archivedAt;
  const canMarkPaid = Boolean(
    agreement.jobId && linkedJob?.agreementStatus === 'SIGNED' && !linkedJob.paymentReceived,
  );
  const canUseSigningActions = canSend;

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

      {agreement.archivedAt && (
        <Card className="mb-6 border-amber-400/40 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">Archived — Old / History</p>
          <p className="mt-1 text-sm text-amber-900/80">
            This agreement was replaced by a revised draft. It is kept for records on the client Old
            folder. Delete the revised draft to restore it to the active workflow.
          </p>
        </Card>
      )}

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
          {canEditContact && (
            <Button variant="secondary" onClick={() => navigate(`/agreements/${agreement.id}/edit`)}>
              Edit contact
            </Button>
          )}
          {canRevise && (
            <Button
              variant="secondary"
              onClick={() => setReviseConfirmOpen(true)}
              disabled={revising}
            >
              {revising ? 'Creating…' : 'Create revised agreement'}
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
          {!agreement.archivedAt && (
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
          )}
        </div>
      </div>

      {contactUpdated && canUseSigningActions && (
        <Card className="mb-6 border-success/30 bg-success/10 p-4">
          <p className="font-semibold text-success">Contact details saved</p>
          <p className="mt-1 text-sm text-text-light">
            Click <strong>Resend to client</strong> below so the signing email goes to the corrected
            address.
          </p>
        </Card>
      )}

      {canUseSigningActions && (
        <Card className="mb-6 space-y-4 border-primary/20 bg-gradient-to-br from-primary/[0.04] to-surface p-6">
          <div>
            <h3 className="text-lg font-bold text-text">Signing</h3>
            <p className="mt-1 text-sm text-text-light">
              {agreement.status === 'DRAFT'
                ? 'Send the link by email, copy it for SMS, or open it here so the client can sign on this device.'
                : 'Clients can open the link and Sign & submit anytime — even if SiteScop is closed. Open SiteScop later to sync Signed status. Wrong email? Use Edit contact, then Resend.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void sendSigningLinkEmail()}
              disabled={signingBusy}
            >
              <Send className="h-4 w-4" />
              {signingBusy && !openingOnDevice
                ? 'Preparing…'
                : agreement.status === 'DRAFT'
                  ? 'Send to client'
                  : 'Resend to client'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void copySigningLink()}
              disabled={signingBusy}
            >
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button
              variant="accent"
              onClick={() => void signFromThisDevice()}
              disabled={signingBusy}
            >
              <PenLine className="h-4 w-4" />
              {openingOnDevice ? 'Opening…' : 'Sign from this device'}
            </Button>
            {githubEnabled && (agreement.status === 'SENT' || agreement.status === 'VIEWED') && (
              <Button
                variant="secondary"
                onClick={() => void refreshCloudSigningPage()}
                disabled={republishing}
              >
                <ExternalLink className="h-4 w-4" />
                {republishing ? 'Updating cloud page…' : 'Update cloud page'}
              </Button>
            )}
          </div>

          {signingUrl ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-text-muted">
                Active signing link
              </label>
              <input
                readOnly
                value={signingUrl}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                className="w-full break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-text"
                aria-label="Signing link"
              />
              <p className="mt-2 text-xs text-text-muted">
                {signingMode === 'github'
                  ? 'Cloud link — works from anywhere. SiteScop syncs signatures automatically.'
                  : 'Local link — signer must be on the same Wi‑Fi as this PC (or use Sign from this device).'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {agreement.status === 'DRAFT'
                ? 'Click any action above to prepare the signing link.'
                : 'Preparing signing link…'}
            </p>
          )}

          {copyMessage && (
            <p
              className={cn(
                'text-sm',
                copyMessage.includes('Could not') || copyMessage.includes('already signed')
                  ? 'text-danger'
                  : 'text-success',
              )}
            >
              {copyMessage}
            </p>
          )}
        </Card>
      )}

      {agreement.status === 'SIGNED' && !agreement.archivedAt && (
        <Card className="mb-6 space-y-4 border-success/25 bg-success/[0.04] p-6">
          <div>
            <h3 className="text-lg font-bold text-text">Signing</h3>
            <p className="mt-1 text-sm text-text-light">
              This agreement is already signed
              {agreement.signedAt ? ` (${formatDisplayDate(agreement.signedAt)})` : ''}. Send and Sign
              will not open a new signing page.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => showAlreadySignedMessage()} disabled={signingBusy}>
              <Send className="h-4 w-4" />
              Send to client
            </Button>
            <Button variant="secondary" onClick={() => showAlreadySignedMessage()} disabled={signingBusy}>
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button variant="accent" onClick={() => showAlreadySignedMessage()} disabled={signingBusy}>
              <PenLine className="h-4 w-4" />
              Sign from this device
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReviseConfirmOpen(true)}
              disabled={revising}
            >
              {revising ? 'Creating…' : 'Create revised agreement'}
            </Button>
          </div>

          {copyMessage && (
            <p
              className={cn(
                'text-sm font-medium',
                copyMessage.includes('already signed') || copyMessage.includes('Could not')
                  ? 'text-danger'
                  : 'text-success',
              )}
            >
              {copyMessage}
            </p>
          )}
        </Card>
      )}

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
        open={reviseConfirmOpen}
        onClose={() => {
          if (!revising) setReviseConfirmOpen(false);
        }}
        title="Create revised agreement"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setReviseConfirmOpen(false)}
              disabled={revising}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void confirmCreateRevisedAgreement()}
              disabled={revising}
            >
              {revising ? 'Creating…' : 'OK'}
            </Button>
          </>
        }
      >
        <p className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          Create a revised agreement from{' '}
          <span className="font-semibold">{agreement.agreementNumber}</span>? The signed agreement,
          PDF and invoice move to the client Old folder. You can change inspection type and price on
          the new draft.
        </p>
      </Modal>
    </div>
  );
}
