import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Receipt,
  ScrollText,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClientDetailJob, ClientDetailJobReport } from '@shared/api-types';
import { getClientsApi, getSitescopApi } from '@/lib/sitescop-api';
import { formatDisplayDate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Button, Card } from '@/design-system/components';
import { INSPECTION_TYPE_LABELS, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function reportAccent(report: ClientDetailJobReport): string {
  return report.reportType === 'BUILDING'
    ? 'from-secondary/20 to-secondary/5 border-secondary/30 text-secondary'
    : 'from-primary/20 to-primary/5 border-primary/30 text-primary';
}

function reportLabel(report: ClientDetailJobReport): string {
  return report.reportType === 'BUILDING' ? 'Building report' : 'Pest report';
}

interface DocumentTileProps {
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
  onOpen: () => void;
  onCopy?: () => void;
  opening?: boolean;
  copying?: boolean;
  disabled?: boolean;
  copyDisabled?: boolean;
}

function DocumentTile({
  title,
  subtitle,
  accent,
  icon,
  onOpen,
  onCopy,
  opening,
  copying,
  disabled,
  copyDisabled,
}: DocumentTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-lg border bg-gradient-to-br p-3 shadow-sm',
        accent,
        disabled && 'opacity-50',
      )}
    >
      <div>
        <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-md bg-white/70 shadow-sm">
          {icon}
        </div>
        <p className="text-xs font-bold">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] font-medium opacity-80">{subtitle}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          className="min-w-0 flex-1 bg-white/80 hover:bg-white"
          variant="secondary"
          size="sm"
          disabled={disabled || opening}
          onClick={onOpen}
        >
          {opening ? 'Opening…' : 'Open'}
        </Button>
        {onCopy && (
          <Button
            className="shrink-0 bg-white/80 hover:bg-white"
            variant="secondary"
            size="sm"
            disabled={disabled || copyDisabled || copying}
            onClick={onCopy}
            title="Copy for email attachment"
          >
            <Copy className="h-3.5 w-3.5" />
            {copying ? '…' : 'Copy'}
          </Button>
        )}
      </div>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  children: React.ReactNode;
}

function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:items-baseline sm:gap-3">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{children}</dd>
    </div>
  );
}

function JobDocuments({
  job,
  clientId,
}: {
  job: ClientDetailJob;
  clientId: string;
}) {
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState<'agreement' | 'invoice' | 'all' | string | null>(null);
  const [copying, setCopying] = useState<'agreement' | 'invoice' | 'all' | 'both-reports' | string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function refreshClient() {
    await queryClient.invalidateQueries({ queryKey: ['client', clientId] });
  }

  async function openReport(report: ClientDetailJobReport) {
    setDocError(null);
    setCopyMessage(null);
    setOpening(report.id);
    try {
      await getSitescopApi().reports.openPdf(report.filePath);
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not open report PDF');
    } finally {
      setOpening(null);
    }
  }

  async function copyReport(report: ClientDetailJobReport) {
    setDocError(null);
    setCopyMessage(null);
    setCopying(report.id);
    try {
      const result = await getSitescopApi().reports.copyPdf(report.filePath);
      setCopyMessage(result.message);
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not copy report PDF');
    } finally {
      setCopying(null);
    }
  }

  async function openAgreement() {
    if (!job.agreementId) return;
    setDocError(null);
    setCopyMessage(null);
    setOpening('agreement');
    try {
      await getClientsApi().openAgreementPdf(job.agreementId);
      await refreshClient();
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not open agreement PDF');
    } finally {
      setOpening(null);
    }
  }

  async function copyAgreement() {
    if (!job.agreementId) return;
    setDocError(null);
    setCopyMessage(null);
    setCopying('agreement');
    try {
      const result = await getClientsApi().copyAgreementPdf(job.agreementId);
      setCopyMessage(result.message);
      await refreshClient();
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not copy agreement PDF');
    } finally {
      setCopying(null);
    }
  }

  async function openInvoice() {
    setDocError(null);
    setCopyMessage(null);
    setOpening('invoice');
    try {
      await getClientsApi().openInvoicePdf(job.id);
      await refreshClient();
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not open invoice PDF');
    } finally {
      setOpening(null);
    }
  }

  async function copyInvoice() {
    setDocError(null);
    setCopyMessage(null);
    setCopying('invoice');
    try {
      const result = await getClientsApi().copyInvoicePdf(job.id);
      setCopyMessage(result.message);
      await refreshClient();
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not copy invoice PDF');
    } finally {
      setCopying(null);
    }
  }

  async function copyBothReports() {
    const paths = job.reports.map((report) => report.filePath);
    if (paths.length < 2) return;
    setDocError(null);
    setCopyMessage(null);
    setCopying('both-reports');
    try {
      const result = await getSitescopApi().reports.copyPdfs(paths);
      setCopyMessage(result.message);
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not copy reports');
    } finally {
      setCopying(null);
    }
  }

  async function copyAllDocuments() {
    setDocError(null);
    setCopyMessage(null);
    setCopying('all');
    try {
      const result = await getClientsApi().copyAllJobDocuments(job.id);
      setCopyMessage(result.message);
      await refreshClient();
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not copy documents');
    } finally {
      setCopying(null);
    }
  }

  const buildingReport = job.reports.find((r) => r.reportType === 'BUILDING');
  const pestReport = job.reports.find((r) => r.reportType === 'PEST');
  const documentCount = job.reports.length + (job.agreementId ? 2 : 0);
  const showCopyBothReports =
    job.inspectionType === 'COMBINED' && Boolean(buildingReport && pestReport);
  const showCopyAll = documentCount >= 2;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Documents</p>
        <div className="flex flex-wrap gap-2">
          {showCopyBothReports && (
            <Button
              variant="secondary"
              size="sm"
              disabled={copying === 'both-reports'}
              onClick={() => void copyBothReports()}
            >
              <Copy className="h-3.5 w-3.5" />
              {copying === 'both-reports' ? 'Copying…' : 'Copy both reports'}
            </Button>
          )}
          {showCopyAll && (
            <Button
              variant="secondary"
              size="sm"
              disabled={copying === 'all'}
              onClick={() => void copyAllDocuments()}
            >
              <Copy className="h-3.5 w-3.5" />
              {copying === 'all' ? 'Copying…' : `Copy all PDFs (${documentCount})`}
            </Button>
          )}
        </div>
      </div>
      {copyMessage && (
        <p className="mt-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          {copyMessage}
        </p>
      )}
      {docError && (
        <p className="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {docError}
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {buildingReport ? (
          <DocumentTile
            title="Building PDF"
            subtitle={buildingReport.fileName}
            accent="from-secondary/20 to-secondary/5 border-secondary/30 text-secondary"
            icon={<FileText className="h-5 w-5 text-secondary" />}
            opening={opening === buildingReport.id}
            copying={copying === buildingReport.id}
            onOpen={() => void openReport(buildingReport)}
            onCopy={() => void copyReport(buildingReport)}
          />
        ) : (
          <DocumentTile
            title="Building PDF"
            subtitle="Not generated yet"
            accent="from-slate-100 to-slate-50 border-slate-200 text-slate-500"
            icon={<FileText className="h-5 w-5 text-slate-400" />}
            disabled
            onOpen={() => undefined}
          />
        )}

        {pestReport ? (
          <DocumentTile
            title="Pest PDF"
            subtitle={pestReport.fileName}
            accent="from-primary/20 to-primary/5 border-primary/30 text-primary"
            icon={<FileCheck2 className="h-5 w-5 text-primary" />}
            opening={opening === pestReport.id}
            copying={copying === pestReport.id}
            onOpen={() => void openReport(pestReport)}
            onCopy={() => void copyReport(pestReport)}
          />
        ) : (
          <DocumentTile
            title="Pest PDF"
            subtitle="Not generated yet"
            accent="from-slate-100 to-slate-50 border-slate-200 text-slate-500"
            icon={<FileCheck2 className="h-5 w-5 text-slate-400" />}
            disabled
            onOpen={() => undefined}
          />
        )}

        {job.agreementId ? (
          <DocumentTile
            title="Agreement PDF"
            subtitle={job.agreementNumber ?? 'Inspection agreement'}
            accent="from-violet-100 to-violet-50 border-violet-200 text-violet-800"
            icon={<ScrollText className="h-5 w-5 text-violet-700" />}
            opening={opening === 'agreement'}
            copying={copying === 'agreement'}
            onOpen={() => void openAgreement()}
            onCopy={() => void copyAgreement()}
          />
        ) : (
          <DocumentTile
            title="Agreement PDF"
            subtitle="No agreement on file"
            accent="from-slate-100 to-slate-50 border-slate-200 text-slate-500"
            icon={<ScrollText className="h-5 w-5 text-slate-400" />}
            disabled
            onOpen={() => undefined}
          />
        )}

        {job.agreementId ? (
          <DocumentTile
            title="Invoice PDF"
            subtitle={job.hasInvoice ? 'Tax invoice ready' : 'Generate from agreement'}
            accent="from-amber-100 to-amber-50 border-amber-200 text-amber-900"
            icon={<Receipt className="h-5 w-5 text-amber-700" />}
            opening={opening === 'invoice'}
            copying={copying === 'invoice'}
            onOpen={() => void openInvoice()}
            onCopy={() => void copyInvoice()}
          />
        ) : (
          <DocumentTile
            title="Invoice PDF"
            subtitle="Requires an agreement"
            accent="from-slate-100 to-slate-50 border-slate-200 text-slate-500"
            icon={<Receipt className="h-5 w-5 text-slate-400" />}
            disabled
            onOpen={() => undefined}
          />
        )}
      </div>

      {job.reports.length > 2 && (
        <ul className="mt-3 space-y-2">
          {job.reports.map((report) => (
            <li
              key={report.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-gradient-to-r px-3 py-2 text-sm',
                reportAccent(report),
              )}
            >
              <span className="font-medium">
                {reportLabel(report)} · {report.fileName}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/70"
                  disabled={opening === report.id}
                  onClick={() => void openReport(report)}
                >
                  {opening === report.id ? 'Opening…' : 'Open'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/70"
                  disabled={copying === report.id}
                  onClick={() => void copyReport(report)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copying === report.id ? '…' : 'Copy'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClientDetailPage() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClientsApi().get(clientId),
    enabled: Boolean(clientId),
  });

  if (isLoading) {
    return <p className="text-sm text-text-light">Loading client…</p>;
  }

  if (error || !client) {
    return (
      <Card className="p-8 text-center">
        <p className="text-danger">Client not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </Card>
    );
  }

  const fullName = `${client.firstName} ${client.lastName}`.trim();
  const signedAgreements = client.jobs.filter((j) => j.agreementStatus === 'SIGNED').length;
  const reportCount = client.jobs.reduce((sum, j) => sum + j.reports.length, 0);
  const otherAddresses = client.propertyAddresses.filter((a) => a !== client.primaryPropertyAddress);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-l-4 border-l-primary p-0 shadow-card">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/5 via-white to-secondary/5 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4" />
            Clients
          </Button>
        </div>

        <dl className="space-y-2.5 px-4 py-3">
          <SummaryRow label="Client name:">{fullName}</SummaryRow>
          <SummaryRow label="Client contact:">
            {client.mobile ? (
              <a href={`tel:${client.mobile}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {client.mobile}
              </a>
            ) : (
              '—'
            )}
          </SummaryRow>
          <SummaryRow label="Email:">
            {client.email ? (
              <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {client.email}
              </a>
            ) : (
              '—'
            )}
          </SummaryRow>
          <SummaryRow label="Address:">
            {client.primaryPropertyAddress ? (
              <a
                href={mapsUrl(client.primaryPropertyAddress)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-1.5 text-primary hover:underline"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{client.primaryPropertyAddress}</span>
              </a>
            ) : (
              '—'
            )}
          </SummaryRow>
          {otherAddresses.length > 0 && (
            <SummaryRow label="Other properties:">
              <ul className="space-y-1">
                {otherAddresses.map((address) => (
                  <li key={address}>
                    <a
                      href={mapsUrl(address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-1.5 text-primary hover:underline"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                      {address}
                    </a>
                  </li>
                ))}
              </ul>
            </SummaryRow>
          )}
          <SummaryRow label="Client since:">{formatDisplayDate(client.createdAt)}</SummaryRow>
        </dl>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 bg-surface-muted/40 px-4 py-2.5 text-xs font-medium text-text-light">
          <span>
            <span className="font-bold text-primary">{client.jobs.length}</span> jobs
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="font-bold text-violet-700">{signedAgreements}</span> signed
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="font-bold text-secondary">{reportCount}</span> reports
          </span>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <p className="text-base font-bold text-text">Jobs &amp; documents</p>
        </div>

        {client.jobs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-text-light">No jobs linked to this client yet.</Card>
        ) : (
          <div className="space-y-3">
            {client.jobs.map((job) => (
              <Card key={job.id} className="overflow-hidden border-border/80 p-0 shadow-sm">
                <div className="border-b border-border/70 bg-slate-50/80 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/jobs/${job.id}`} className="font-bold text-primary hover:underline">
                          {job.jobNumber}
                        </Link>
                        <TypeBadge type={job.inspectionType} />
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="mt-1.5 inline-flex items-start gap-1.5 text-sm text-text">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                        {job.propertyAddress}
                      </p>
                      <p className="mt-0.5 text-xs text-text-light">
                        {formatDisplayDate(job.inspectionDate)} · {INSPECTION_TYPE_LABELS[job.inspectionType]}
                        {job.inspectionNumber ? ` · Insp. ${job.inspectionNumber}` : ''}
                        {job.agreementNumber ? (
                          <>
                            {' · '}
                            {job.agreementId ? (
                              <Link to={`/agreements/${job.agreementId}`} className="text-primary hover:underline">
                                {job.agreementNumber}
                              </Link>
                            ) : (
                              job.agreementNumber
                            )}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <ExternalLink className="h-4 w-4" />
                      Open job
                    </Button>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <JobDocuments job={job} clientId={clientId} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
