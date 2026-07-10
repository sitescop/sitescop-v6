import {
  Clock,
  MapPin,
  Play,
  CheckCircle2,
  ClipboardCheck,
  User,
  Phone,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TodayJobRow } from '@shared/api-types';
import { Card } from '@/design-system/components/Card';
import { Button } from '@/design-system/components/Button';
import { PriorityBadge, PaymentBadge, StatusBadge, TypeBadge, INSPECTION_TYPE_LABELS } from '@/modules/jobs/job-labels';
import { JobQuickActions } from '@/modules/jobs/components/JobQuickActions';
import { getSitescopApi } from '@/lib/sitescop-api';

interface TodayJobCardProps {
  job: TodayJobRow;
  onRefresh: () => void;
  onDelete?: (job: TodayJobRow) => void;
}

export function TodayJobCard({ job, onRefresh, onDelete }: TodayJobCardProps) {
  const navigate = useNavigate();

  async function handleStart() {
    await getSitescopApi().dashboard.startInspection(job.id);
    onRefresh();
  }

  async function handleComplete() {
    await getSitescopApi().dashboard.completeInspection(job.id);
    onRefresh();
  }

  function openJob() {
    navigate(`/jobs/${job.id}`);
  }

  function openInspection() {
    navigate(`/jobs/${job.id}/inspection`);
  }

  return (
    <Card className="overflow-hidden" onClick={openJob}>
      <div className="border-l-4 border-l-primary p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-text-light">{job.jobNumber}</span>
              <TypeBadge type={job.inspectionType} />
              <StatusBadge status={job.status} />
              <PriorityBadge priority={job.priority} />
              <PaymentBadge
                agreementStatus={job.agreementStatus}
                paymentReceived={job.paymentReceived}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="flex items-center gap-2 text-lg font-bold text-text">
                <User className="h-5 w-5 text-primary" />
                {job.clientName}
              </p>
              <p className="flex items-center gap-2 text-base font-semibold text-primary">
                <Clock className="h-5 w-5" />
                {job.inspectionTime}
              </p>
            </div>

            <p className="text-sm font-medium text-text-light">
              {INSPECTION_TYPE_LABELS[job.inspectionType]} inspection
            </p>

            {job.mobile && (
              <p className="flex items-center gap-2 text-sm text-text">
                <Phone className="h-4 w-4 text-secondary" />
                {job.mobile}
              </p>
            )}

            <p className="flex items-start gap-2 text-sm text-text-light">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              {job.propertyAddress}
            </p>
          </div>

          <div
            className="flex shrink-0 flex-wrap gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button variant="accent" size="sm" onClick={openInspection}>
              <ClipboardCheck className="h-4 w-4" />
              Open Inspection
            </Button>
            <JobQuickActions
              compact
              jobId={job.id}
              jobNumber={job.jobNumber}
              email={job.email}
              mobile={job.mobile}
              propertyAddress={job.propertyAddress}
            />
            {job.status !== 'IN_PROGRESS' && job.status !== 'COMPLETED' && (
              <Button variant="primary" size="sm" onClick={handleStart}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            )}
            {job.status === 'IN_PROGRESS' && (
              <Button variant="primary" size="sm" onClick={handleComplete}>
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            )}
            {onDelete && (
              <Button
                variant="secondary"
                size="sm"
                className="border-danger/30 text-danger hover:bg-danger/10"
                onClick={() => onDelete(job)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
