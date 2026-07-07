import { useState } from 'react';
import { Map, Phone, Mail } from 'lucide-react';
import { Button } from '@/design-system/components/Button';
import { getSitescopApi } from '@/lib/sitescop-api';

interface JobQuickActionsProps {
  jobId: string;
  jobNumber: string;
  email?: string;
  mobile?: string;
  propertyAddress: string;
  compact?: boolean;
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function JobQuickActions({
  jobId,
  jobNumber,
  email,
  mobile,
  propertyAddress,
  compact = false,
}: JobQuickActionsProps) {
  const size = compact ? 'sm' : 'sm';
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleEmailClient() {
    setEmailMessage(null);
    setEmailError(null);
    try {
      const result = await getSitescopApi().jobs.emailClient(jobId);
      if (result.cancelled) {
        setEmailMessage(null);
        return;
      }
      setEmailMessage(result.message);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Could not open email');
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        onClick={() => getSitescopApi().shell.openExternal(mapsUrl(propertyAddress))}
      >
        <Map className="h-4 w-4" />
        Maps
      </Button>
      {mobile && (
        <Button
          variant="secondary"
          size={size}
          onClick={() => getSitescopApi().shell.openExternal(`tel:${mobile.replace(/\s/g, '')}`)}
        >
          <Phone className="h-4 w-4" />
          Call
        </Button>
      )}
      <Button variant="secondary" size={size} onClick={() => void handleEmailClient()}>
        <Mail className="h-4 w-4" />
        Email{email ? '' : ' client'}
      </Button>
      {emailMessage && (
        <p className="w-full basis-full text-xs text-success">{emailMessage}</p>
      )}
      {emailError && <p className="w-full basis-full text-xs text-danger">{emailError}</p>}
      {!email && !emailError && !emailMessage && (
        <p className="sr-only">Email client for job {jobNumber}</p>
      )}
    </>
  );
}
