import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import type { AgreementSignerRole } from '@shared/api-types';
import { getSitescopApi, waitForSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, Input, SignaturePad, type SignaturePadHandle } from '@/design-system/components';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';
import { formatDisplayDate } from '@/lib/dates';
import { cn } from '@/lib/cn';

function LegalTermsAccordion({
  sections,
  agentSigning,
  onAllReviewedChange,
}: {
  sections: Array<{ id: string; title: string; content: string; contentHtml?: string }>;
  agentSigning: boolean;
  onAllReviewedChange: (allReviewed: boolean) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Record<string, boolean>>({});

  const allReviewed = sections.length > 0 && sections.every((section) => reviewedIds[section.id]);

  useEffect(() => {
    onAllReviewedChange(allReviewed);
  }, [allReviewed, onAllReviewedChange]);

  function toggleSection(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setReviewedIds((prev) => ({ ...prev, [id]: true }));
      return;
    }
    if (expandedId) {
      setReviewedIds((prev) => ({ ...prev, [expandedId]: true }));
    }
    setExpandedId(id);
  }

  return (
    <Card className="w-full space-y-3 p-4 md:p-6">
      <p className="mb-3 rounded-lg border-2 border-red-500 bg-gradient-to-br from-red-50 to-red-100 px-5 py-4 text-center text-base font-extrabold leading-snug text-red-700 shadow-[0_4px_14px_rgba(220,38,38,0.18)] lg:text-lg">
        {agentSigning
          ? 'Please read each section. Your signature unlocks after you open the Agent Authority Declaration.'
          : 'Please read each section. Your signature unlocks after you open the Client Declaration.'}
      </p>
      <div>
        <h2 className="text-lg font-semibold text-text">Terms &amp; conditions</h2>
        <p className="mt-1 text-sm text-text-muted">
          Open each section below to read it. Headings turn green with a tick once you have opened and closed them.
        </p>
      </div>
      <div className="space-y-2">
        {sections.map((section) => {
          const isOpen = expandedId === section.id;
          const isReviewed = Boolean(reviewedIds[section.id]);

          return (
            <div
              key={section.id}
              className={cn(
                'overflow-hidden rounded-lg border-2 transition-colors',
                isReviewed
                  ? 'border-success/45 bg-success/10'
                  : 'border-amber-300 bg-amber-50',
              )}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-4 py-3 text-left',
                  isReviewed ? 'text-success' : 'text-amber-900',
                )}
                aria-expanded={isOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isReviewed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white"
                      aria-hidden
                    >
                      !
                    </span>
                  )}
                  <span className="font-semibold">{section.title}</span>
                </span>
                <ChevronDown
                  className={cn('h-5 w-5 shrink-0 transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen ? (
                <div className="legal-content mx-auto w-[90%] max-h-[min(40vh,280px)] overflow-y-auto overflow-x-hidden border-t border-black/10 bg-white py-4 sm:max-h-[min(52vh,380px)] sm:py-5 lg:min-h-[400px] lg:max-h-[450px] lg:py-6 [&_.legal-callout-note]:my-3 [&_.legal-callout-note]:rounded-lg [&_.legal-callout-note]:border-l-4 [&_.legal-callout-note]:border-primary [&_.legal-callout-note]:bg-sky-50 [&_.legal-callout-note]:px-4 [&_.legal-callout-note]:py-3 [&_.legal-callout-warning]:my-3 [&_.legal-callout-warning]:rounded-lg [&_.legal-callout-warning]:border-l-4 [&_.legal-callout-warning]:border-red-600 [&_.legal-callout-warning]:bg-red-50 [&_.legal-callout-warning]:px-4 [&_.legal-callout-warning]:py-3 [&_.legal-callout-warning]:text-red-900 [&_.legal-subhead]:mb-2 [&_.legal-subhead]:mt-4 [&_.legal-subhead]:font-bold [&_.legal-subhead]:text-primary [&_li]:mb-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                  {section.contentHtml ? (
                    <div
                      className="w-full text-base leading-[1.65] text-[#152033] sm:text-[17px] sm:leading-[1.75] lg:text-lg lg:leading-[1.8]"
                      dangerouslySetInnerHTML={{ __html: section.contentHtml }}
                    />
                  ) : (
                    <p className="w-full whitespace-pre-wrap text-base leading-[1.65] text-[#152033] sm:text-[17px] sm:leading-[1.75] lg:text-lg lg:leading-[1.8]">
                      {section.content}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function AgreementSignPage() {
  const { token = '' } = useParams();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [allTermsReviewed, setAllTermsReviewed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [agreementNumber, setAgreementNumber] = useState('');
  const [signingParty, setSigningParty] = useState<AgreementSignerRole | null>(null);

  useEffect(() => {
    void waitForSitescopApi().then((api) => setBridgeReady(Boolean(api)));
  }, []);

  const { data: agreement, isLoading, error: loadError } = useQuery({
    queryKey: ['public-agreement', token],
    queryFn: () => getSitescopApi().agreements.getPublic(token),
    enabled: bridgeReady && Boolean(token),
  });

  useEffect(() => {
    if (token && bridgeReady) {
      void getSitescopApi().agreements.markViewed(token);
    }
  }, [token, bridgeReady]);

  useEffect(() => {
    if (!agreement || signingParty === null) return;
    if (signingParty === 'AGENT' && agreement.agentName) {
      setSignatureName(agreement.agentName);
      return;
    }
    if (agreement.clientName) {
      setSignatureName(agreement.clientName);
    }
    setAccepted(false);
    setAllTermsReviewed(false);
    setHasSignature(false);
    signatureRef.current?.clear();
  }, [agreement?.agentName, agreement?.clientName, signingParty]);

  const agentSigningAvailable = Boolean(agreement?.agentSigningAvailable && agreement?.agentName?.trim());
  const partyChosen = signingParty !== null || !agentSigningAvailable;
  const agentSigning = signingParty === 'AGENT';

  const displaySections = useMemo(() => {
    if (!agreement) return [];
    const base = agreement.legalSections.sections.filter((section) => section.id !== 'agent-authority');
    if (signingParty !== 'AGENT' || !agreement.agentAuthoritySection) {
      return base;
    }
    const withoutClient = base.filter(
      (section) =>
        section.id !== 'client-declaration' &&
        !section.title.toLowerCase().includes('client declaration'),
    );
    return [...withoutClient, agreement.agentAuthoritySection];
  }, [agreement, signingParty]);

  const signMutation = useMutation({
    mutationFn: () =>
      getSitescopApi().agreements.sign(token, {
        signatureName: signatureName.trim(),
        signatureData: signatureRef.current?.toDataUrl() ?? '',
        declarationsAccepted: true,
        signingParty: signingParty ?? 'CLIENT',
        agentAuthorityAccepted: agentSigning ? true : undefined,
      }),
    onSuccess: (result) => {
      setAgreementNumber(result.agreementNumber);
      setSubmitted(true);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Signing failed'),
  });

  if (!bridgeReady || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-text-light">Loading agreement...</p>
      </div>
    );
  }

  if (loadError || !agreement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md p-8 text-center">
          <p className="text-danger">This agreement link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-2xl text-success">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-text">Agreement signed</h1>
          <p className="mt-2 text-text-light">
            Thank you. Agreement <strong>{agreementNumber}</strong> has been submitted successfully.
          </p>
        </Card>
      </div>
    );
  }

  const canSubmit =
    partyChosen && agreement.canSign && accepted && allTermsReviewed && signatureName.trim() && hasSignature;

  if (agreement.canSign && agentSigningAvailable && signingParty === null) {
    return (
      <div className="min-h-screen bg-background py-6 sm:py-8">
        <div className="mx-auto w-[90%] space-y-6 lg:w-[75%]">
          <header className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-4">
              {agreement.companyLogoUrl ? (
                <img
                  src={agreement.companyLogoUrl}
                  alt={agreement.companyName}
                  className="h-[72px] w-[72px] shrink-0 rounded-lg border border-border bg-white object-contain p-1.5"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-lg font-extrabold text-primary">
                  SS
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-primary">{agreement.companyName}</p>
                <h1 className="text-xl font-bold text-text">Who is signing?</h1>
                <p className="mt-1 text-sm text-text-light">
                  {agreement.agreementNumber} · {INSPECTION_TYPE_LABELS[agreement.inspectionType]}
                </p>
              </div>
            </div>
          </header>

          <Card className="space-y-4 p-6">
            <p className="text-sm text-text-light">
              Select whether you are the purchaser/client or the real estate agent signing on the
              client&apos;s behalf.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                className="rounded-xl border-2 border-border bg-surface p-5 text-left transition hover:border-primary/40 hover:shadow-card"
                onClick={() => setSigningParty('CLIENT')}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-primary">I am the client</p>
                <p className="mt-2 text-lg font-semibold text-text">{agreement.clientName}</p>
                <p className="mt-1 text-sm text-text-muted">Purchaser / client signs directly</p>
              </button>
              <button
                type="button"
                className="rounded-xl border-2 border-primary/25 bg-primary/5 p-5 text-left transition hover:border-primary/40 hover:shadow-card"
                onClick={() => setSigningParty('AGENT')}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-primary">I am the agent</p>
                <p className="mt-2 text-lg font-semibold text-text">{agreement.agentName}</p>
                <p className="mt-1 text-sm text-text-muted">
                  Sign on behalf of {agreement.clientName}
                  {agreement.agencyName ? ` · ${agreement.agencyName}` : ''}
                </p>
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8">
      <div className="mx-auto w-[90%] space-y-6 lg:w-[75%]">
        <header className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center gap-4 border-b border-border pb-4">
            {agreement.companyLogoUrl ? (
              <img
                src={agreement.companyLogoUrl}
                alt={agreement.companyName}
                className="h-[72px] w-[72px] shrink-0 rounded-lg border border-border bg-white object-contain p-1.5"
              />
            ) : (
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-lg font-extrabold text-primary">
                SS
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">{agreement.companyName}</p>
              <h1 className="mt-0.5 text-xl font-bold text-text lg:text-2xl">Inspection Agreement</h1>
              <p className="mt-1 text-sm text-text-light">
                {agreement.agreementNumber} · {INSPECTION_TYPE_LABELS[agreement.inspectionType]}
              </p>
            </div>
          </div>
          {(agreement.companyPhone || agreement.companyWebsite || agreement.companyEmail) && (
            <p className="mt-3 text-sm text-text-light">
              {agreement.companyPhone && (
                <a className="text-primary hover:underline" href={`tel:${agreement.companyPhone.replace(/\s/g, '')}`}>
                  {agreement.companyPhone}
                </a>
              )}
              {agreement.companyPhone && agreement.companyWebsite && ' · '}
              {agreement.companyWebsite && (
                <a
                  className="text-primary hover:underline"
                  href={
                    agreement.companyWebsite.startsWith('http')
                      ? agreement.companyWebsite
                      : `https://${agreement.companyWebsite}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {agreement.companyWebsite}
                </a>
              )}
            </p>
          )}
        </header>

        <Card className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-text-light">Client</h3>
              <p>{agreement.clientName}</p>
              <p className="text-sm text-text-light">{agreement.clientEmail}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-light">Date</h3>
              <p>{formatDisplayDate(agreement.agreementDate)}</p>
            </div>
            {agreement.agentName ? (
              <div>
                <h3 className="text-sm font-medium text-text-light">Agent</h3>
                <p>{agreement.agentName}</p>
                {agreement.agencyName ? (
                  <p className="text-sm text-text-light">{agreement.agencyName}</p>
                ) : null}
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <h3 className="text-sm font-medium text-text-light">Address</h3>
              <p>{agreement.propertyAddress}</p>
            </div>
            {agentSigning ? (
              <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-primary">Signing as agent</h3>
                <p className="mt-2 text-sm text-text-muted">
                  On behalf of client: <strong>{agreement.clientName}</strong>
                </p>
              </div>
            ) : partyChosen ? (
              <div className="sm:col-span-2 rounded-lg border border-secondary/20 bg-secondary/5 p-4">
                <h3 className="text-sm font-semibold text-secondary">Signing as client</h3>
                <p className="mt-1 font-medium text-text">{agreement.clientName}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <LegalTermsAccordion
          sections={displaySections}
          agentSigning={agentSigning}
          onAllReviewedChange={setAllTermsReviewed}
        />

        {agreement.canSign ? (
          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-text">
              {agentSigning ? 'Sign on behalf of client' : 'Sign agreement'}
            </h2>
            {error && <p className="text-sm text-danger">{error}</p>}
            {!allTermsReviewed ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Please open and read every terms section above before signing.
              </p>
            ) : null}
            <Input
              label={agentSigning ? 'Agent full name' : 'Full name'}
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-text">Signature</p>
              <SignaturePad ref={signatureRef} onChange={(isEmpty) => setHasSignature(!isEmpty)} />
            </div>
            <label
              className={cn(
                'flex items-start gap-2 text-sm text-text',
                !allTermsReviewed && 'opacity-60',
              )}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={accepted}
                disabled={!allTermsReviewed}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                {agentSigning
                  ? `I confirm I have express authority to sign on behalf of ${agreement.clientName}, and I have read and accept the terms, scope, limitations, privacy policy, client declaration, and agent authority declaration.`
                  : 'I have read and accept the terms, scope, limitations, privacy policy, and client declaration.'}
              </span>
            </label>
            <Button
              onClick={() => signMutation.mutate()}
              disabled={!canSubmit || signMutation.isPending}
            >
              {signMutation.isPending ? 'Submitting…' : 'Sign and submit'}
            </Button>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-text-light">
              This agreement is already {agreement.status.toLowerCase()} and cannot be signed again.
            </p>
          </Card>
        )}

        <footer className="rounded-xl border border-border bg-surface p-5 text-center text-sm text-text-light shadow-card">
          <p className="font-semibold text-primary">Questions about this agreement?</p>
          <p className="mt-2">
            {agreement.companyPhone && (
              <a className="text-primary hover:underline" href={`tel:${agreement.companyPhone.replace(/\s/g, '')}`}>
                {agreement.companyPhone}
              </a>
            )}
            {agreement.companyPhone && agreement.companyEmail && ' · '}
            {agreement.companyEmail && (
              <a className="text-primary hover:underline" href={`mailto:${agreement.companyEmail}`}>
                {agreement.companyEmail}
              </a>
            )}
            {agreement.companyWebsite && (
              <>
                {(agreement.companyPhone || agreement.companyEmail) && ' · '}
                <a
                  className="text-primary hover:underline"
                  href={
                    agreement.companyWebsite.startsWith('http')
                      ? agreement.companyWebsite
                      : `https://${agreement.companyWebsite}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {agreement.companyWebsite}
                </a>
              </>
            )}
          </p>
          {agreement.companyAbn && <p className="mt-1">ABN {agreement.companyAbn}</p>}
        </footer>
      </div>
    </div>
  );
}
