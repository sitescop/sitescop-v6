import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import type { InspectionType } from '@shared/api-types';
import { getSettingsApi, getSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, Input, Select, Textarea } from '@/design-system/components';
import { INSPECTION_TYPE_OPTIONS } from '@/modules/agreements/agreement-labels';

function priceFromBilling(
  inspectionType: InspectionType,
  billing?: { buildingPriceCents: number; pestPriceCents: number; combinedPriceCents: number },
): string {
  if (!billing) {
    if (inspectionType === 'PEST') return '350';
    if (inspectionType === 'COMBINED') return '850';
    return '550';
  }
  const cents =
    inspectionType === 'PEST'
      ? billing.pestPriceCents
      : inspectionType === 'COMBINED'
        ? billing.combinedPriceCents
        : billing.buildingPriceCents;
  return String(cents / 100);
}

function agentFieldsFromJob(job: {
  realEstate?: string;
  agentName?: string;
  agentEmail?: string;
}) {
  const agentName = job.agentName?.trim() || '';
  if (!agentName) {
    return { agencyName: '', agentName: '', agentEmail: '', agentSigning: false };
  }
  return {
    agencyName: job.realEstate?.trim() || '',
    agentName,
    agentEmail: job.agentEmail?.trim() || '',
    agentSigning: true,
  };
}

export function AgreementFormPage() {
  const { agreementId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') ?? undefined;
  const isEdit = Boolean(agreementId);
  const navigate = useNavigate();

  const [inspectionType, setInspectionType] = useState<InspectionType>('BUILDING');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [price, setPrice] = useState('550');
  const [notes, setNotes] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentSigning, setAgentSigning] = useState(false);
  const [agentFromJob, setAgentFromJob] = useState(false);
  const [formError, setFormError] = useState('');

  const billingQuery = useQuery({
    queryKey: ['settings-app'],
    queryFn: () => getSettingsApi().getApp(),
  });

  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getSitescopApi().jobs.get(jobId!),
    enabled: Boolean(jobId) && !isEdit,
  });

  const agreementQuery = useQuery({
    queryKey: ['agreement', agreementId],
    queryFn: () => getSitescopApi().agreements.get(agreementId),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!jobQuery.data || isEdit) return;
    const job = jobQuery.data;
    setInspectionType(job.inspectionType);
    setClientName(job.clientName);
    setClientEmail(job.email || '');
    setClientPhone(job.mobile || '');
    setPropertyAddress(job.propertyAddress);
    setPrice(priceFromBilling(job.inspectionType, billingQuery.data?.billing));
    setNotes(job.notes || '');

    const agent = agentFieldsFromJob(job);
    setAgencyName(agent.agencyName);
    setAgentName(agent.agentName);
    setAgentEmail(agent.agentEmail);
    setAgentSigning(agent.agentSigning);
    setAgentFromJob(agent.agentSigning);
  }, [jobQuery.data, isEdit, billingQuery.data?.billing]);

  useEffect(() => {
    if (!agreementQuery.data || !isEdit) return;
    const agreement = agreementQuery.data;
    setInspectionType(agreement.inspectionType);
    setClientName(agreement.clientName);
    setClientEmail(agreement.clientEmail);
    setClientPhone(agreement.clientPhone || '');
    setPropertyAddress(agreement.propertyAddress);
    setPrice(String(agreement.priceCents / 100));
    setNotes(agreement.notes || '');
    setAgencyName(agreement.agencyName || '');
    setAgentName(agreement.agentName || '');
    setAgentEmail(agreement.agentEmail || '');
    setAgentSigning(Boolean(agreement.agentName?.trim()));
    setAgentFromJob(Boolean(agreement.jobId) && Boolean(agreement.agentName?.trim()));
  }, [agreementQuery.data, isEdit]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceCents = Math.round(Number.parseFloat(price) * 100);
      if (!clientName.trim()) throw new Error('Client name is required.');
      if (!clientEmail.trim()) throw new Error('Client email is required.');
      if (!propertyAddress.trim()) throw new Error('Property address is required.');
      if (!Number.isFinite(priceCents) || priceCents <= 0) throw new Error('Enter a valid price.');

      const trimmedAgentName = agentName.trim();
      const agentPayload =
        agentSigning && trimmedAgentName
          ? {
              signerRole: 'CLIENT' as const,
              agencyName: agencyName.trim() || undefined,
              agentName: trimmedAgentName,
              agentEmail: agentEmail.trim() || undefined,
            }
          : {
              signerRole: 'CLIENT' as const,
              agencyName: undefined,
              agentName: undefined,
              agentEmail: undefined,
            };

      const payload = {
        inspectionType,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim() || undefined,
        propertyAddress: propertyAddress.trim(),
        priceCents,
        notes: notes.trim() || undefined,
        jobId,
        ...agentPayload,
      };

      if (isEdit) {
        return getSitescopApi().agreements.update(agreementId, payload);
      }

      if (jobId) {
        const agreement = await getSitescopApi().agreements.createFromJob(jobId);
        if (agreement.status !== 'DRAFT') {
          return agreement;
        }
        const { jobId: _linkedJob, ...updates } = payload;
        return getSitescopApi().agreements.update(agreement.id, updates);
      }

      return getSitescopApi().agreements.create(payload);
    },
    onSuccess: (agreement) => {
      navigate(`/agreements/${agreement.id}`);
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save agreement.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    saveMutation.mutate();
  }

  return (
    <div>
      <Button variant="secondary" className="mb-6" onClick={() => navigate('/agreements')}>
        <ArrowLeft className="h-4 w-4" />
        Agreements
      </Button>

      <Card className="mx-auto max-w-2xl p-6">
        <h2 className="text-xl font-bold text-text">
          {isEdit ? 'Edit agreement' : jobId ? 'New agreement for job' : 'New agreement'}
        </h2>
        <p className="mt-1 text-sm text-text-light">
          Client details and pricing — legal terms are added automatically.
        </p>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Select
              label="Inspection type"
              value={inspectionType}
              onChange={(e) => {
                const next = e.target.value as InspectionType;
                setInspectionType(next);
                if (!isEdit) setPrice(priceFromBilling(next, billingQuery.data?.billing));
              }}
              options={INSPECTION_TYPE_OPTIONS}
            />
            <Input label="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            <Input
              label="Client email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
            />
            <Input label="Client mobile" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            <Input
              label="Property address"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              required
            />
            <Input
              label="Price (ex GST, AUD)"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-text">Real estate &amp; agent</h3>
                <p className="mt-1 text-sm text-text-light">
                  {agentFromJob
                    ? 'Synced from the linked job. The agent can sign on behalf of the client when sent.'
                    : 'Optional — when an agent is listed, they sign the agreement on behalf of the client.'}
                </p>
              </div>
            </div>

            <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={agentSigning}
                onChange={(e) => setAgentSigning(e.target.checked)}
              />
              <span className="text-sm text-text">
                <span className="font-semibold">Real estate agent on file</span>
                <span className="mt-0.5 block text-text-light">
                  Agent details are included on the signing link. The person opening the link chooses
                  whether the client or agent signs.
                </span>
              </span>
            </label>

            {agentSigning ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Agency"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Agency name"
                  disabled={agentFromJob}
                />
                <Input
                  label="Agent name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Agent full name"
                  required={agentSigning}
                  disabled={agentFromJob}
                />
                <Input
                  className="sm:col-span-2"
                  label="Agent email"
                  type="email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder="agent@agency.com.au"
                  disabled={agentFromJob}
                />
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No agent on this agreement — only the client can sign via the link.
              </p>
            )}
          </div>

          {formError && (
            <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create agreement'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/agreements')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
