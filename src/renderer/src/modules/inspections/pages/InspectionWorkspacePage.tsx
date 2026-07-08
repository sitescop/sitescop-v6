import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Copy, FileText, FolderOpen, Mail } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobTypeToFormKind, isSubfloorApplicable, resolveSubfloorPresent } from '@sitescop/room-engine-core';
import type { InspectionReportRow } from '@shared/api-types';
import { INSPECTION_TYPE_LABELS } from '@shared/inspection-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, LoadingOverlay, PageHeader } from '@/design-system/components';
import { BuildingInspectionForm } from '@/modules/inspections/components/BuildingInspectionForm';
import { CombinedInspectionForm } from '@/modules/inspections/components/CombinedInspectionForm';
import { InspectionAccordion } from '@/modules/inspections/components/InspectionAccordion';
import { buildInspectionRouteIds } from '@/modules/inspections/components/inspection-route';
import { InspectionFormProvider } from '@/modules/inspections/components/InspectionFormUi';
import { PestInspectionForm } from '@/modules/inspections/components/PestInspectionForm';
import { useInspectionEditor } from '@/modules/inspections/hooks/useInspectionEditor';

function saveLabel(state: 'idle' | 'saving' | 'saved' | 'error') {
  if (state === 'saving') return 'Saving...';
  if (state === 'saved') return 'Saved';
  if (state === 'error') return 'Save failed';
  return '';
}

export function InspectionWorkspacePage() {
  const { jobId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [emailFeedback, setEmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyingReportId, setCopyingReportId] = useState<string | null>(null);
  const [copyingAll, setCopyingAll] = useState(false);

  const {
    data: inspection,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inspection-by-job', jobId],
    queryFn: () => getSitescopApi().inspections.getByJob(jobId),
    enabled: Boolean(jobId),
    retry: 1,
  });

  const isCompleted = inspection?.status === 'COMPLETED' || Boolean(inspection?.completedAt);
  const formKind = inspection ? jobTypeToFormKind(inspection.jobType) : 'BUILDING';

  const { formData, rooms, saveState, patchSection, patchRoom, updateRoomData } = useInspectionEditor(
    inspection ?? undefined,
    inspection?.id,
    false,
  );

  const subfloorApplicable = useMemo(() => {
    if (!formData) return true;
    return isSubfloorApplicable(
      resolveSubfloorPresent(
        formData.shared.propertyDescription,
        formData.building?.subfloor,
        formData.shared.accessibilityObstructions,
      ),
    );
  }, [formData]);

  const pestRouteIds = useMemo(
    () =>
      buildInspectionRouteIds({
        formKind: 'PEST',
        subfloorApplicable,
        rooms,
      }),
    [subfloorApplicable, rooms],
  );

  const completeMutation = useMutation({
    mutationFn: () => getSitescopApi().inspections.complete(inspection!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspection-by-job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-in-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs-completed'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-today'] });
    },
  });

  const {
    data: reports = [],
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['reports-for-job', jobId],
    queryFn: () => getSitescopApi().reports.listForJob(jobId),
    enabled: Boolean(jobId) && Boolean(inspection?.status === 'COMPLETED' || inspection?.completedAt),
  });

  const generateReportsMutation = useMutation({
    mutationFn: () => getSitescopApi().reports.generateForJob(jobId),
    onSuccess: () => {
      void refetchReports();
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const reportLabel = (report: InspectionReportRow) =>
    report.reportType === 'BUILDING' ? 'Building report' : 'Pest report';

  async function copyReportPdf(report: InspectionReportRow) {
    setCopyFeedback(null);
    setCopyingReportId(report.id);
    try {
      const result = await getSitescopApi().reports.copyPdf(report.filePath);
      setCopyFeedback(result.message);
    } catch (error) {
      setCopyFeedback(error instanceof Error ? error.message : 'Could not copy PDF');
    } finally {
      setCopyingReportId(null);
    }
  }

  async function copyAllReportPdfs() {
    if (reports.length < 2) return;
    setCopyFeedback(null);
    setCopyingAll(true);
    try {
      const result = await getSitescopApi().reports.copyPdfs(reports.map((report) => report.filePath));
      setCopyFeedback(result.message);
    } catch (error) {
      setCopyFeedback(error instanceof Error ? error.message : 'Could not copy PDFs');
    } finally {
      setCopyingAll(false);
    }
  }

  const emailReportMutation = useMutation({
    mutationFn: (reportId: string) => getSitescopApi().reports.emailToClient(reportId),
    onSuccess: (result) => {
      if (result.cancelled) {
        setEmailFeedback(null);
        return;
      }
      setEmailFeedback({ type: 'success', text: result.message });
    },
    onError: (error) => {
      setEmailFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not open email',
      });
    },
  });

  if (isLoading) {
    return <LoadingOverlay message="Loading inspection workspace..." fullScreen={false} />;
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Could not load inspection.';
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-semibold text-danger">Inspection failed to load</p>
        <p className="mt-2 text-sm text-text-light">{message}</p>
        <p className="mt-4 text-xs text-text-muted">
          Close ALL SiteScop windows and run START-SITESCOP.bat again if this mentions missing features.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate(`/jobs/${jobId}`)}>
            Back to job
          </Button>
          <Button onClick={() => void refetch()}>Retry</Button>
        </div>
      </Card>
    );
  }

  if (!inspection || !formData) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text">No inspection found for this job.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(`/jobs/${jobId}`)}>
          Back to job
        </Button>
      </Card>
    );
  }

  const formContent =
    formKind === 'COMBINED' ? (
      formData.pest ? (
        <CombinedInspectionForm
          formData={formData}
          onSectionChange={patchSection}
          readOnly={false}
          rooms={rooms}
          onRoomPatch={patchRoom}
          onRoomDataChange={updateRoomData}
        />
      ) : (
        <p className="text-danger">Combined inspection data is incomplete. Contact support.</p>
      )
    ) : formKind === 'PEST' && formData.pest ? (
      <InspectionFormProvider>
        <InspectionAccordion defaultOpenId="inspector-hazard" routeIds={pestRouteIds}>
          <BuildingInspectionForm
            formData={formData}
            onSectionChange={patchSection}
            readOnly={false}
            embedded
            mode="shared-only"
            formKind="PEST"
          />
          <PestInspectionForm
            pest={formData.pest}
            onSectionChange={patchSection}
            readOnly={false}
            embedded
            subfloorApplicable={subfloorApplicable}
          />
        </InspectionAccordion>
      </InspectionFormProvider>
    ) : (
      <BuildingInspectionForm
        formData={formData}
        onSectionChange={patchSection}
        readOnly={false}
        rooms={rooms}
        onRoomDataChange={updateRoomData}
        onRoomPatch={patchRoom}
      />
    );

  return (
    <div className="pb-28">
      <PageHeader
        title={inspection.inspectionNumber || 'Inspection'}
        description={`${inspection.jobNumber} · ${INSPECTION_TYPE_LABELS[inspection.jobType]} · ${inspection.propertyAddress}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {saveLabel(saveState) && (
              <span
                className={
                  saveState === 'error' ? 'text-sm text-danger' : 'text-sm text-text-light'
                }
              >
                {saveLabel(saveState)}
              </span>
            )}
            <Button variant="secondary" onClick={() => navigate(`/jobs/${jobId}`)}>
              <ArrowLeft className="h-4 w-4" />
              Job details
            </Button>
            {!isCompleted && (
              <Button
                onClick={() => {
                  if (window.confirm('Mark this inspection as completed?')) {
                    completeMutation.mutate();
                  }
                }}
                disabled={completeMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete inspection
              </Button>
            )}
          </div>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-text">{inspection.clientName}</p>
          <p className="text-xs text-text-light">
            Progress {inspection.progressPercent}% · Status {inspection.status.replace('_', ' ')}
          </p>
        </div>
        {isCompleted && (
          <p className="text-sm font-medium text-success">
            Inspection completed — you can still edit and regenerate PDFs
          </p>
        )}
      </Card>

      {isCompleted && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text">PDF reports</p>
              <p className="mt-1 text-xs text-text-light">
                Generate professional inspection reports from the completed form data.
              </p>
              {generateReportsMutation.isError && (
                <p className="mt-2 text-sm text-danger">
                  {generateReportsMutation.error instanceof Error
                    ? generateReportsMutation.error.message
                    : 'Failed to generate report'}
                </p>
              )}
              {emailFeedback && (
                <p
                  className={`mt-2 text-sm ${emailFeedback.type === 'success' ? 'text-success' : 'text-danger'}`}
                >
                  {emailFeedback.text}
                </p>
              )}
              {copyFeedback && <p className="mt-2 text-sm text-success">{copyFeedback}</p>}
              {inspection.clientEmail && (
                <p className="mt-1 text-xs text-text-muted">
                  Client email: {inspection.clientEmail}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => generateReportsMutation.mutate()}
                disabled={generateReportsMutation.isPending}
              >
                <FileText className="h-4 w-4" />
                {generateReportsMutation.isPending
                  ? 'Generating…'
                  : reports.length
                    ? 'Regenerate PDFs'
                    : 'Generate PDFs'}
              </Button>
              {reports.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => void getSitescopApi().reports.openFolder(jobId)}
                >
                  <FolderOpen className="h-4 w-4" />
                  Open folder
                </Button>
              )}
              {formKind === 'COMBINED' && reports.length >= 2 && (
                <Button variant="secondary" disabled={copyingAll} onClick={() => void copyAllReportPdfs()}>
                  <Copy className="h-4 w-4" />
                  {copyingAll ? 'Copying…' : 'Copy both reports'}
                </Button>
              )}
            </div>
          </div>
          {reports.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-text">
                    {reportLabel(report)} · {report.fileName}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void getSitescopApi().reports.openPdf(report.filePath)}
                    >
                      Open PDF
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={copyingReportId === report.id}
                      onClick={() => void copyReportPdf(report)}
                    >
                      <Copy className="h-4 w-4" />
                      {copyingReportId === report.id ? 'Copying…' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => emailReportMutation.mutate(report.id)}
                      disabled={emailReportMutation.isPending}
                    >
                      <Mail className="h-4 w-4" />
                      Email to client
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {formContent}
    </div>
  );
}

export default InspectionWorkspacePage;
