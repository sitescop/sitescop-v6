import { useRef, useState, type FormEvent, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import type { CreateJobInput, InspectionType, JobPriority } from '@shared/api-types';
import { Button, Card, Input, PageHeader, Select, Textarea } from '@/design-system/components';
import { AddressAutocomplete } from '@/modules/jobs/components/AddressAutocomplete';
import { localDateKey } from '@/lib/dates';
import { getSitescopApi } from '@/lib/sitescop-api';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';

const TYPE_OPTIONS = (Object.keys(INSPECTION_TYPE_LABELS) as InspectionType[]).map((value) => ({
  value,
  label: INSPECTION_TYPE_LABELS[value],
}));

const PRIORITY_OPTIONS: Array<{ value: JobPriority; label: string }> = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'LOW', label: 'Low' },
];

export function NewJobPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const submitLock = useRef(false);
  const [formError, setFormError] = useState('');

  const schedulePreset = (location.state as { inspectionDate?: string; inspectionTime?: string } | null) ?? {};

  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientMobile, setClientMobile] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertySuburb, setPropertySuburb] = useState('');
  const [addressError, setAddressError] = useState('');
  const [inspectionType, setInspectionType] = useState<InspectionType>('COMBINED');
  const [inspectionDate, setInspectionDate] = useState(schedulePreset.inspectionDate ?? localDateKey());
  const [inspectionTime, setInspectionTime] = useState(schedulePreset.inspectionTime ?? '09:00');
  const [realEstate, setRealEstate] = useState('');
  const [agentDetailsOpen, setAgentDetailsOpen] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentMobile, setAgentMobile] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [priority, setPriority] = useState<JobPriority>('NORMAL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (schedulePreset.inspectionDate) setInspectionDate(schedulePreset.inspectionDate);
    if (schedulePreset.inspectionTime) setInspectionTime(schedulePreset.inspectionTime);
  }, [schedulePreset.inspectionDate, schedulePreset.inspectionTime]);

  const createMutation = useMutation({
    mutationFn: (input: CreateJobInput) => getSitescopApi().jobs.create(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
      await queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      await queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });

      navigate('/jobs/in-progress', {
        replace: true,
        state: {
          createdJobNumber: result.job.jobNumber,
          createdClientName: result.job.clientName,
        },
      });
    },
    onError: (error: Error) => {
      submitLock.current = false;
      setFormError(error.message || 'Could not create job. Please try again.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current || createMutation.isPending) return;

    setFormError('');

    if (!clientFirstName.trim() || !clientLastName.trim()) {
      setFormError('Client first and last name are required.');
      return;
    }
    if (!propertyAddress.trim()) {
      setFormError('Property address is required.');
      setAddressError('Enter or select a street address.');
      return;
    }
    if (propertyAddress.trim().length < 8 || !/[A-Za-z]/.test(propertyAddress)) {
      setFormError('Enter a full property address (street and suburb), not just a street number.');
      setAddressError('Enter a full street address.');
      return;
    }
    setAddressError('');
    if (!inspectionDate || !inspectionTime) {
      setFormError('Inspection date and time are required.');
      return;
    }

    submitLock.current = true;
    createMutation.mutate({
      clientFirstName: clientFirstName.trim(),
      clientLastName: clientLastName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientMobile: clientMobile.trim() || undefined,
      propertyAddress: propertyAddress.trim(),
      propertySuburb: propertySuburb.trim() || undefined,
      inspectionType,
      inspectionDate,
      inspectionTime,
      realEstate: realEstate.trim() || undefined,
      agentName: agentName.trim() || undefined,
      agentPhone: agentPhone.trim() || undefined,
      agentMobile: agentMobile.trim() || undefined,
      agentEmail: agentEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
    });
  }

  const isSaving = createMutation.isPending || submitLock.current;

  return (
    <div className="pb-28">
      <PageHeader
        title="Create New Job"
        description="Fill in the form, then click Create New Job once at the bottom."
        action={
          <Button variant="secondary" onClick={() => navigate('/jobs/in-progress')}>
            Cancel
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
        <Card className="p-6">
          <h3 className="mb-1 text-lg font-bold text-primary">Purchaser details</h3>
          <p className="mb-4 text-sm text-text-muted">
            Person buying the property — not the real estate agent.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name *"
              value={clientFirstName}
              onChange={(e) => setClientFirstName(e.target.value)}
              required
            />
            <Input
              label="Last name *"
              value={clientLastName}
              onChange={(e) => setClientLastName(e.target.value)}
              required
            />
            <Input
              label="Mobile"
              type="tel"
              value={clientMobile}
              onChange={(e) => setClientMobile(e.target.value)}
              placeholder="0412 345 678"
            />
            <Input
              label="Email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-lg font-bold text-primary">Property details</h3>
          <div className="grid gap-4">
            <AddressAutocomplete
              streetValue={propertyAddress}
              suburbValue={propertySuburb}
              onStreetChange={(value) => {
                setPropertyAddress(value);
                setAddressError('');
              }}
              onSuburbChange={setPropertySuburb}
              error={addressError}
              required
            />
            <Input
              label="Suburb / state / postcode"
              value={propertySuburb}
              onChange={(e) => setPropertySuburb(e.target.value)}
              placeholder="Paddington QLD 4064"
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-lg font-bold text-primary">Inspection</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Inspection type *"
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value as InspectionType)}
              options={TYPE_OPTIONS}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as JobPriority)}
              options={PRIORITY_OPTIONS}
            />
            <Input
              label="Inspection date *"
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              required
            />
            <Input
              label="Inspection time *"
              type="time"
              value={inspectionTime}
              onChange={(e) => setInspectionTime(e.target.value)}
              required
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-1 text-lg font-bold text-primary">Real estate &amp; agent</h3>
          <p className="mb-4 text-sm text-text-muted">
            Agency and agent who booked the inspection (optional).
          </p>
          <div className="mb-4 flex flex-wrap gap-1 border-b border-primary/15" role="tablist" aria-label="Agent details">
            <button
              type="button"
              role="tab"
              aria-selected={agentDetailsOpen}
              className={`rounded-t-md px-4 py-2 text-sm font-semibold transition-colors ${
                agentDetailsOpen
                  ? 'border border-b-0 border-primary/20 bg-surface text-primary'
                  : 'text-text-muted hover:bg-secondary/[0.06]'
              }`}
              onClick={() => setAgentDetailsOpen(true)}
            >
              Add agent details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!agentDetailsOpen}
              className={`rounded-t-md px-4 py-2 text-sm font-semibold transition-colors ${
                !agentDetailsOpen
                  ? 'border border-b-0 border-primary/20 bg-surface text-primary'
                  : 'text-text-muted hover:bg-secondary/[0.06]'
              }`}
              onClick={() => setAgentDetailsOpen(false)}
            >
              Skip
            </button>
          </div>
          {agentDetailsOpen ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Agency"
              value={realEstate}
              onChange={(e) => setRealEstate(e.target.value)}
              placeholder="Place Real Estate"
            />
            <Input
              label="Agent name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent name"
            />
            <Input
              label="Agent phone"
              type="tel"
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              placeholder="07 3000 0000"
            />
            <Input
              label="Agent mobile"
              type="tel"
              value={agentMobile}
              onChange={(e) => setAgentMobile(e.target.value)}
              placeholder="0412 345 678"
            />
            <Input
              label="Agent email"
              type="email"
              className="sm:col-span-2"
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              placeholder="agent@agency.com.au"
            />
          </div>
          ) : (
            <p className="text-sm text-text-muted">
              No agent on this job — click Add agent details to enter agency and agent contact.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Access instructions, client requests, special conditions..."
          />
        </Card>

        {formError && (
          <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}
      </form>

      <div className="fixed bottom-0 left-sidebar right-0 z-20 border-t border-border bg-surface px-8 py-4 shadow-elevated">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-light">
            {isSaving ? 'Saving job to your device...' : 'One click creates the job and opens In Progress.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              disabled={isSaving}
              onClick={() => {
                const form = document.querySelector('form');
                form?.requestSubmit();
              }}
            >
              <Save className="h-5 w-5" />
              {isSaving ? 'Creating...' : 'Create New Job'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={isSaving}
              onClick={() => navigate('/jobs/in-progress')}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
