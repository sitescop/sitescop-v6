import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  ScrollText,
  User,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClientDetailJob, ClientDetailJobAgreement, ClientDetailJobReport, UpdateClientAgentInput, UpdateClientInput } from '@shared/api-types';
import { getClientsApi, getSitescopApi } from '@/lib/sitescop-api';
import { formatDisplayDate } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { Button, Card, Input } from '@/design-system/components';
import { INSPECTION_TYPE_LABELS, StatusBadge, TypeBadge } from '@/modules/jobs/job-labels';
import { AgreementStatusBadge } from '@/modules/agreements/agreement-labels';

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

function jobHasAgentDetails(job: ClientDetailJob): boolean {
  return Boolean(
    job.realEstate?.trim() ||
      job.agentName?.trim() ||
      job.agentPhone?.trim() ||
      job.agentMobile?.trim() ||
      job.agentEmail?.trim(),
  );
}

function orderingPartyLabel(type: string | null | undefined): string | null {
  if (!type?.trim()) return null;
  if (type === 'Agent') return 'Real estate agent';
  return type;
}

function DetailField({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-text">{children}</dd>
    </div>
  );
}

function ClientPurchaserPanel({
  clientId,
  firstName,
  lastName,
  mobile,
  email,
  primaryPropertyAddress,
  otherAddresses,
  createdAt,
}: {
  clientId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  primaryPropertyAddress: string | null;
  otherAddresses: string[];
  createdAt: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [firstNameInput, setFirstNameInput] = useState(firstName);
  const [lastNameInput, setLastNameInput] = useState(lastName);
  const [mobileInput, setMobileInput] = useState(mobile);
  const [emailInput, setEmailInput] = useState(email);

  const fullName = `${firstName} ${lastName}`.trim();

  useEffect(() => {
    if (!editing) {
      setFirstNameInput(firstName);
      setLastNameInput(lastName);
      setMobileInput(mobile);
      setEmailInput(email);
    }
  }, [firstName, lastName, mobile, email, editing]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateClientInput) => getClientsApi().update(clientId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['client', clientId], updated);
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditing(false);
      setFormError('');
    },
    onError: (error: Error) => {
      setFormError(error.message || 'Could not save client details.');
    },
  });

  function cancelEdit() {
    setEditing(false);
    setFormError('');
    setFirstNameInput(firstName);
    setLastNameInput(lastName);
    setMobileInput(mobile);
    setEmailInput(email);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstNameInput.trim() || !lastNameInput.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    updateMutation.mutate({
      firstName: firstNameInput.trim(),
      lastName: lastNameInput.trim(),
      email: emailInput.trim() || undefined,
      mobile: mobileInput.trim() || undefined,
    });
  }

  return (
    <div className="h-full rounded-xl border-2 border-secondary/35 bg-gradient-to-br from-secondary/20 via-secondary/8 to-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-secondary">
          <User className="h-5 w-5" />
          Purchaser / Client
        </h3>
        {!editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={updateMutation.isPending}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {editing ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                First name
              </label>
              <Input
                value={firstNameInput}
                onChange={(e) => setFirstNameInput(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                Last name
              </label>
              <Input value={lastNameInput} onChange={(e) => setLastNameInput(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Mobile
            </label>
            <Input
              type="tel"
              value={mobileInput}
              onChange={(e) => setMobileInput(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Email
            </label>
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {formError ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      ) : (
        <dl className="space-y-3">
          <DetailField label="Name" icon={User}>
            {fullName}
          </DetailField>
          <DetailField label="Mobile" icon={Phone}>
            {mobile ? (
              <a href={`tel:${mobile}`} className="text-secondary hover:underline">
                {mobile}
              </a>
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Email" icon={Mail}>
            {email ? (
              <a href={`mailto:${email}`} className="break-all text-secondary hover:underline">
                {email}
              </a>
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Property" icon={MapPin}>
            {primaryPropertyAddress ? (
              <a
                href={mapsUrl(primaryPropertyAddress)}
                target="_blank"
                rel="noreferrer"
                className="text-secondary hover:underline"
              >
                {primaryPropertyAddress}
              </a>
            ) : (
              '—'
            )}
          </DetailField>
          {otherAddresses.length > 0 ? (
            <DetailField label="Other properties" icon={MapPin}>
              <ul className="space-y-1 font-normal">
                {otherAddresses.map((address) => (
                  <li key={address}>
                    <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className="text-secondary hover:underline">
                      {address}
                    </a>
                  </li>
                ))}
              </ul>
            </DetailField>
          ) : null}
          <DetailField label="Client since">{formatDisplayDate(createdAt)}</DetailField>
        </dl>
      )}
    </div>
  );
}

function ClientAgentPanel({
  clientId,
  job,
  latestJob,
  agentJobCount,
  jobCount,
}: {
  clientId: string;
  job: ClientDetailJob | undefined;
  latestJob?: ClientDetailJob;
  agentJobCount: number;
  jobCount: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [realEstateInput, setRealEstateInput] = useState(job?.realEstate ?? '');
  const [agentNameInput, setAgentNameInput] = useState(job?.agentName ?? '');
  const [agentPhoneInput, setAgentPhoneInput] = useState(job?.agentPhone ?? '');
  const [agentMobileInput, setAgentMobileInput] = useState(job?.agentMobile ?? '');
  const [agentEmailInput, setAgentEmailInput] = useState(job?.agentEmail ?? '');

  const sourceJob = job ?? latestJob;
  const hasAgentOnFile = Boolean(job && jobHasAgentDetails(job));

  useEffect(() => {
    if (!editing) {
      setRealEstateInput(job?.realEstate ?? '');
      setAgentNameInput(job?.agentName ?? '');
      setAgentPhoneInput(job?.agentPhone ?? '');
      setAgentMobileInput(job?.agentMobile ?? '');
      setAgentEmailInput(job?.agentEmail ?? '');
    }
  }, [job, editing]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateClientAgentInput) => getClientsApi().updateAgent(clientId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['client', clientId], updated);
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      setEditing(false);
      setFormError('');
    },
    onError: (error: Error) => {
      setFormError(error.message || 'Could not save agent details.');
    },
  });

  function cancelEdit() {
    setEditing(false);
    setFormError('');
    setRealEstateInput(job?.realEstate ?? '');
    setAgentNameInput(job?.agentName ?? '');
    setAgentPhoneInput(job?.agentPhone ?? '');
    setAgentMobileInput(job?.agentMobile ?? '');
    setAgentEmailInput(job?.agentEmail ?? '');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      realEstate: realEstateInput.trim() || undefined,
      agentName: agentNameInput.trim() || undefined,
      agentPhone: agentPhoneInput.trim() || undefined,
      agentMobile: agentMobileInput.trim() || undefined,
      agentEmail: agentEmailInput.trim() || undefined,
    });
  }

  if (!hasAgentOnFile && !editing) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col justify-center rounded-xl border-2 border-dashed border-primary/25 bg-gradient-to-br from-primary/8 to-white p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-primary">
            <Building2 className="h-5 w-5" />
            Real estate &amp; agent
          </h3>
          {jobCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Add
            </Button>
          ) : null}
        </div>
        <div className="mt-4 text-center">
          <Building2 className="mx-auto h-8 w-8 text-primary/40" />
          <p className="mt-1 text-sm text-text-muted">No agent on file</p>
          <p className="mt-1 text-xs text-text-light">
            {jobCount > 0
              ? 'Add agency and agent contact details for this client’s jobs.'
              : 'Create a job for this client first, then add agent details here.'}
          </p>
          {latestJob ? (
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => navigate(`/jobs/${latestJob.id}`)}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open job
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const partyLabel = sourceJob ? orderingPartyLabel(sourceJob.orderingPartyType) : null;
  const agentPhone = job?.agentMobile?.trim() || job?.agentPhone?.trim() || '';

  return (
    <div className="h-full rounded-xl border-2 border-primary/35 bg-gradient-to-br from-primary/20 via-primary/8 to-white p-4 shadow-sm md:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-primary">
          <Building2 className="h-5 w-5" />
          Real estate &amp; agent
        </h3>
        {jobCount > 0 ? (
          !editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={updateMutation.isPending}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )
        ) : null}
      </div>

      {editing ? (
        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <p className="text-xs text-text-muted">
            Updates agency and agent on all {jobCount} job{jobCount === 1 ? '' : 's'} for this client.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Agency
            </label>
            <Input
              value={realEstateInput}
              onChange={(e) => setRealEstateInput(e.target.value)}
              placeholder="Place Real Estate"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Agent name
            </label>
            <Input
              value={agentNameInput}
              onChange={(e) => setAgentNameInput(e.target.value)}
              placeholder="Agent name"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                Agent phone
              </label>
              <Input
                type="tel"
                value={agentPhoneInput}
                onChange={(e) => setAgentPhoneInput(e.target.value)}
                placeholder="07 3000 0000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                Agent mobile
              </label>
              <Input
                type="tel"
                value={agentMobileInput}
                onChange={(e) => setAgentMobileInput(e.target.value)}
                placeholder="0412 345 678"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Agent email
            </label>
            <Input
              type="email"
              value={agentEmailInput}
              onChange={(e) => setAgentEmailInput(e.target.value)}
              placeholder="agent@agency.com.au"
            />
          </div>
          {formError ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      ) : (
        <>
          {agentJobCount > 1 && job ? (
            <p className="mb-4 text-xs text-text-muted">From latest job {job.jobNumber}</p>
          ) : (
            <p className="mb-4 text-xs text-text-muted">{partyLabel ?? 'Ordering party'}</p>
          )}
          <dl className="space-y-3">
            {job?.realEstate?.trim() ? (
              <DetailField label="Agency" icon={Building2}>
                {job.realEstate}
              </DetailField>
            ) : null}
            {job?.agentName?.trim() ? (
              <DetailField label="Agent name" icon={User}>
                {job.agentName}
              </DetailField>
            ) : null}
            {agentPhone ? (
              <DetailField label="Phone / mobile" icon={Phone}>
                <a href={`tel:${agentPhone.replace(/\s/g, '')}`} className="text-primary hover:underline">
                  {agentPhone}
                </a>
              </DetailField>
            ) : null}
            {job?.agentEmail?.trim() ? (
              <DetailField label="Email" icon={Mail}>
                <a href={`mailto:${job.agentEmail}`} className="break-all text-primary hover:underline">
                  {job.agentEmail}
                </a>
              </DetailField>
            ) : null}
          </dl>
        </>
      )}
    </div>
  );
}

function JobAgentDetails({ job }: { job: ClientDetailJob }) {
  if (!jobHasAgentDetails(job)) return null;

  const partyLabel = orderingPartyLabel(job.orderingPartyType);
  const agentPhone = job.agentMobile?.trim() || job.agentPhone?.trim() || '';

  return (
    <div className="border-b border-border/70 bg-primary/[0.03] px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
        Real estate &amp; agent
        {partyLabel ? <span className="ml-2 font-medium normal-case text-text-muted">({partyLabel})</span> : null}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {job.realEstate?.trim() ? (
          <div className="flex items-start gap-2 text-sm">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div>
              <dt className="text-xs text-text-muted">Agency</dt>
              <dd className="font-medium text-text">{job.realEstate}</dd>
            </div>
          </div>
        ) : null}
        {job.agentName?.trim() ? (
          <div className="flex items-start gap-2 text-sm">
            <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div>
              <dt className="text-xs text-text-muted">Agent</dt>
              <dd className="font-medium text-text">{job.agentName}</dd>
            </div>
          </div>
        ) : null}
        {agentPhone ? (
          <div className="flex items-start gap-2 text-sm">
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div>
              <dt className="text-xs text-text-muted">Phone / mobile</dt>
              <dd>
                <a href={`tel:${agentPhone.replace(/\s/g, '')}`} className="font-medium text-primary hover:underline">
                  {agentPhone}
                </a>
              </dd>
            </div>
          </div>
        ) : null}
        {job.agentEmail?.trim() ? (
          <div className="flex items-start gap-2 text-sm">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div>
              <dt className="text-xs text-text-muted">Email</dt>
              <dd>
                <a href={`mailto:${job.agentEmail}`} className="font-medium text-primary hover:underline">
                  {job.agentEmail}
                </a>
              </dd>
            </div>
          </div>
        ) : null}
      </dl>
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

  async function openAgreement(agreementId?: string | null) {
    const id = agreementId ?? job.agreementId;
    if (!id) return;
    setDocError(null);
    setCopyMessage(null);
    setOpening(`agreement:${id}`);
    try {
      await getClientsApi().openAgreementPdf(id);
      await refreshClient();
    } catch (error) {
      setDocError(error instanceof Error ? error.message : 'Could not open agreement PDF');
    } finally {
      setOpening(null);
    }
  }

  async function copyAgreement(agreementId?: string | null) {
    const id = agreementId ?? job.agreementId;
    if (!id) return;
    setDocError(null);
    setCopyMessage(null);
    setCopying(`agreement:${id}`);
    try {
      const result = await getClientsApi().copyAgreementPdf(id);
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
  const jobAgreements =
    job.agreements?.length > 0
      ? job.agreements
      : job.agreementId
        ? [
            {
              id: job.agreementId,
              agreementNumber: job.agreementNumber ?? 'Agreement',
              status: (job.agreementStatus as ClientDetailJobAgreement['status']) ?? 'DRAFT',
              inspectionType: job.inspectionType,
              signedAt: null,
            } satisfies ClientDetailJobAgreement,
          ]
        : [];
  const documentCount = job.reports.length + (jobAgreements.length > 0 ? jobAgreements.length + 1 : 0);
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

        {jobAgreements.length > 0 ? (
          jobAgreements.map((agreement) => (
            <DocumentTile
              key={agreement.id}
              title="Agreement PDF"
              subtitle={`${agreement.agreementNumber} · ${agreement.status}`}
              accent="from-violet-100 to-violet-50 border-violet-200 text-violet-800"
              icon={<ScrollText className="h-5 w-5 text-violet-700" />}
              opening={opening === `agreement:${agreement.id}`}
              copying={copying === `agreement:${agreement.id}`}
              onOpen={() => void openAgreement(agreement.id)}
              onCopy={() => void copyAgreement(agreement.id)}
            />
          ))
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

        {jobAgreements.length > 0 ? (
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

  const signedAgreements = client.jobs.filter((j) => j.agreementStatus === 'SIGNED').length;
  const reportCount = client.jobs.reduce((sum, j) => sum + j.reports.length, 0);
  const otherAddresses = client.propertyAddresses.filter((a) => a !== client.primaryPropertyAddress);
  const latestJobWithAgent = client.jobs.find(jobHasAgentDetails);
  const agentJobCount = client.jobs.filter(jobHasAgentDetails).length;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-l-4 border-l-primary p-0 shadow-card">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/5 via-white to-secondary/5 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4" />
            Clients
          </Button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 md:gap-6 md:p-5">
          <ClientPurchaserPanel
            clientId={client.id}
            firstName={client.firstName}
            lastName={client.lastName}
            mobile={client.mobile}
            email={client.email}
            primaryPropertyAddress={client.primaryPropertyAddress}
            otherAddresses={otherAddresses}
            createdAt={client.createdAt}
          />
          <ClientAgentPanel
            clientId={client.id}
            job={latestJobWithAgent}
            latestJob={client.jobs[0]}
            agentJobCount={agentJobCount}
            jobCount={client.jobs.length}
          />
        </div>

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
                      </p>
                      {(job.agreements?.length ? job.agreements : job.agreementId
                        ? [
                            {
                              id: job.agreementId,
                              agreementNumber: job.agreementNumber ?? 'Agreement',
                              status: (job.agreementStatus as ClientDetailJobAgreement['status']) ?? 'DRAFT',
                              inspectionType: job.inspectionType,
                              signedAt: null,
                            } satisfies ClientDetailJobAgreement,
                          ]
                        : []
                      ).map((agreement) => (
                        <p key={agreement.id} className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <Link
                            to={`/agreements/${agreement.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {agreement.agreementNumber}
                          </Link>
                          <AgreementStatusBadge status={agreement.status} />
                          <span className="text-text-muted">
                            {INSPECTION_TYPE_LABELS[agreement.inspectionType]}
                          </span>
                        </p>
                      ))}
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <ExternalLink className="h-4 w-4" />
                      Open job
                    </Button>
                  </div>
                </div>

                {jobHasAgentDetails(job) ? <JobAgentDetails job={job} /> : null}

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
