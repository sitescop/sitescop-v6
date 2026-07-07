import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getSitescopApi, waitForSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, Input, SignaturePad, type SignaturePadHandle } from '@/design-system/components';
import { formatAud } from '@/modules/agreements/agreement-labels';
import { INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';
import { formatDisplayDate } from '@/lib/dates';

export function AgreementSignPage() {
  const { token = '' } = useParams();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [agreementNumber, setAgreementNumber] = useState('');

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
    if (agreement?.clientName) {
      setSignatureName(agreement.clientName);
    }
  }, [agreement?.clientName]);

  const signMutation = useMutation({
    mutationFn: () =>
      getSitescopApi().agreements.sign(token, {
        signatureName: signatureName.trim(),
        signatureData: signatureRef.current?.toDataUrl() ?? '',
        declarationsAccepted: true,
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

  const canSubmit = agreement.canSign && accepted && signatureName.trim() && hasSignature;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4">
        <header className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <p className="text-sm text-text-light">{agreement.companyName}</p>
          <h1 className="mt-1 text-2xl font-bold text-text">Client Inspection Agreement</h1>
          <p className="mt-2 text-sm text-text-light">
            {agreement.agreementNumber} · {INSPECTION_TYPE_LABELS[agreement.inspectionType]}
          </p>
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
              <h3 className="text-sm font-medium text-text-light">Property</h3>
              <p>{agreement.propertyAddress}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-light">Total (inc. GST)</h3>
              <p className="text-lg font-semibold">{formatAud(agreement.totalCents)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-light">Agreement date</h3>
              <p>{formatDisplayDate(agreement.agreementDate)}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-6 p-6">
          {agreement.legalSections.sections.map((section) => (
            <div key={section.id}>
              <h2 className="text-lg font-semibold text-primary">{section.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text">{section.content}</p>
            </div>
          ))}
        </Card>

        {agreement.canSign ? (
          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-text">Sign agreement</h2>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Input
              label="Full name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-text">Signature</p>
              <SignaturePad ref={signatureRef} onChange={(isEmpty) => setHasSignature(!isEmpty)} />
            </div>
            <label className="flex items-start gap-2 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I have read and accept the terms, scope, limitations, privacy policy, and client declaration.
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
