import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Copy, FileText, FolderOpen, Mail } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobTypeToFormKind } from '@sitescop/room-engine-core';
import type { InspectionReportRow } from '@shared/api-types';
import { jobRequiresPaymentForReportDelivery, NOT_PAID_REPORT_MESSAGE } from '@shared/job-payment';
import { INSPECTION_TYPE_LABELS } from '@shared/inspection-types';
import { getSitescopApi } from '@/lib/sitescop-api';
import { Button, Card, LoadingOverlay, Modal } from '@/design-system/components';
import { useInspectionEditor } from '@/modules/inspections/hooks/useInspectionEditor';
import { InspectionPhotoCacheProvider } from '@/modules/inspections/hooks/InspectionPhotoCacheContext';
import { InspectionWorkspaceShell } from '@/modules/inspections/workspace/InspectionWorkspaceShell';

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
  const [reportsOpen, setReportsOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

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

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getSitescopApi().jobs.get(jobId),
    enabled: Boolean(jobId),
  });

  const reportDeliveryBlocked =
    job != null &&
    jobRequiresPaymentForReportDelivery(job.agreementStatus, job.paymentReceived);

  const isCompleted = inspection?.status === 'COMPLETED' || Boolean(inspection?.completedAt);
  const formKind = inspection ? jobTypeToFormKind(inspection.jobType) : 'BUILDING';

  const { formData, rooms, saveState, patchSection, patchRoom, updateRoomData, flushPendingSaves, photoCache } =
    useInspectionEditor(inspection ?? undefined, inspection?.id, false);

  const workspaceEditor = useMemo(
    () =>
      formData
        ? {
            formData,
            rooms,
            readOnly: false,
            patchSection,
            patchRoom,
            updateRoomData,
            flushPendingSaves,
          }
        : null,
    [formData, rooms, patchSection, patchRoom, updateRoomData, flushPendingSaves],
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
    mutationFn: async () => {
      await flushPendingSaves();
      return getSitescopApi().reports.generateForJob(jobId);
    },
    onSuccess: () => {
      void refetchReports();
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const reportLabel = (report: InspectionReportRow) =>
    report.reportType === 'BUILDING' ? 'Building report' : 'Pest report';

  async function copyReportPdf(report: InspectionReportRow) {
    if (reportDeliveryBlocked) {
      setCopyFeedback(NOT_PAID_REPORT_MESSAGE);
      return;
    }
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
    if (reportDeliveryBlocked) {
      setCopyFeedback(NOT_PAID_REPORT_MESSAGE);
      return;
    }
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

  const emailJobReportsMutation = useMutation({
    mutationFn: () => getSitescopApi().reports.emailJobToClient(jobId),
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

  if (!inspection || !formData || !workspaceEditor) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text">No inspection found for this job.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(`/jobs/${jobId}`)}>
          Back to job
        </Button>
      </Card>
    );
  }

  const combinedIncomplete = formKind === 'COMBINED' && !formData.pest;

  const formContent = combinedIncomplete ? (
    <Card className="p-6">
      <p className="text-danger">Combined inspection data is incomplete. Contact support.</p>
    </Card>
  ) : (
    <InspectionWorkspaceShell
      editor={workspaceEditor}
      formKind={formKind}
      buildingMode="full"
      defaultSectionId="inspector-hazard"
      workflowStorageKey={inspection.id}
    />
  );

  return (
    <InspectionPhotoCacheProvider cache={photoCache}>
      <div className="space-y-3 pb-6">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border-2 border-[#0B4F8C] bg-[#0B4F8C] px-3 py-2.5 shadow-md">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">
              <span className="rounded-md bg-[#F39C12] px-2 py-0.5 text-white shadow-sm">
                {inspection.inspectionNumber || 'Inspection'}
              </span>
              <span className="text-white/70">·</span>
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-sky-100">
                {inspection.jobNumber}
              </span>
              <span className="text-white/70">·</span>
              <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-white shadow-sm">
                {INSPECTION_TYPE_LABELS[inspection.jobType]}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-sky-50">
              <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-[#0B4F8C]">
                {inspection.clientName}
              </span>
              <span className="rounded-md bg-[#16A34A] px-2 py-0.5 font-bold text-white">
                {inspection.progressPercent}%
              </span>
              <span
                className={
                  isCompleted
                    ? 'rounded-md bg-emerald-400 px-2 py-0.5 font-bold uppercase text-[#08543C]'
                    : 'rounded-md bg-[#F39C12] px-2 py-0.5 font-bold uppercase text-white'
                }
              >
                {inspection.status.replace('_', ' ')}
              </span>
              {isCompleted ? (
                <span className="rounded-md bg-emerald-200 px-2 py-0.5 font-semibold text-emerald-900">
                  Completed
                </span>
              ) : null}
              <span className="min-w-0 truncate rounded-md bg-white/10 px-2 py-0.5 text-sky-50">
                {inspection.propertyAddress}
              </span>
            </p>
          </div>
          {saveLabel(saveState) ? (
            <span
              className={
                saveState === 'error'
                  ? 'rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-danger'
                  : 'rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-sky-50'
              }
            >
              {saveLabel(saveState)}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="border-2 border-white/90 bg-[#F39C12] font-semibold text-white shadow-sm hover:bg-[#E08E0B] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Job details
          </Button>
          {isCompleted ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReportsOpen(true)}
              className="border-2 border-white/90 bg-[#16A34A] font-semibold text-white shadow-sm hover:bg-[#15803D] hover:text-white"
            >
              <FileText className="h-4 w-4" />
              Reports
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={completeMutation.isPending}
              className="border-2 border-white/90 bg-emerald-400 font-semibold text-[#08543C] shadow-sm hover:bg-emerald-300 hover:text-[#08543C]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </Button>
          )}
        </div>

        {formContent}

        <Modal
          open={confirmCompleteOpen}
          onClose={() => setConfirmCompleteOpen(false)}
          size="sm"
          hideHeader
        >
          <div className="-mx-6 -mt-3 overflow-hidden rounded-t-xl">
            <div className="bg-gradient-to-r from-[#0B4F8C] to-[#1668B4] px-6 py-5 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 shadow-md">
                <CheckCircle2 className="h-8 w-8 text-[#08543C]" />
              </div>
              <h2 className="text-lg font-bold text-white">Complete inspection?</h2>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs font-semibold">
                <span className="rounded-md bg-[#F39C12] px-2 py-0.5 text-white shadow-sm">
                  {inspection.inspectionNumber || inspection.jobNumber}
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-[#0B4F8C]">
                  {inspection.clientName}
                </span>
                <span className="rounded-md bg-[#16A34A] px-2 py-0.5 text-white">
                  {inspection.progressPercent}% done
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-4 pt-4 text-center">
            <p className="text-sm text-text">
              This marks the inspection as <span className="font-bold text-emerald-600">Completed</span> and
              unlocks the PDF reports.
            </p>
            <div className="flex justify-center gap-2 pb-1">
              <Button variant="secondary" onClick={() => setConfirmCompleteOpen(false)}>
                Not yet
              </Button>
              <Button
                disabled={completeMutation.isPending}
                onClick={() => {
                  setConfirmCompleteOpen(false);
                  void flushPendingSaves().then(() => completeMutation.mutate());
                }}
                className="bg-[#16A34A] font-semibold text-white shadow-sm hover:bg-[#15803D]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Yes, complete
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={reportsOpen}
          onClose={() => setReportsOpen(false)}
          title="PDF reports"
          description={
            reportDeliveryBlocked
              ? 'Generate and open PDFs to review. Copy and email unlock when the job is marked paid.'
              : 'Generate professional inspection reports from the completed form data.'
          }
          size="lg"
        >
          <div className="space-y-4">
            {generateReportsMutation.isError && (
              <p className="text-sm text-danger">
                {generateReportsMutation.error instanceof Error
                  ? generateReportsMutation.error.message
                  : 'Failed to generate report'}
              </p>
            )}
            {emailFeedback && (
              <p
                className={`text-sm ${emailFeedback.type === 'success' ? 'text-success' : 'text-danger'}`}
              >
                {emailFeedback.text}
              </p>
            )}
            {copyFeedback && (
              <p
                className={`text-sm ${
                  copyFeedback === NOT_PAID_REPORT_MESSAGE ? 'text-danger' : 'text-success'
                }`}
              >
                {copyFeedback}
              </p>
            )}
            {inspection.clientEmail && (
              <p className="text-xs text-text-muted">Client email: {inspection.clientEmail}</p>
            )}

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
                <Button
                  variant="secondary"
                  disabled={copyingAll}
                  title={reportDeliveryBlocked ? NOT_PAID_REPORT_MESSAGE : undefined}
                  onClick={() => void copyAllReportPdfs()}
                >
                  <Copy className="h-4 w-4" />
                  {copyingAll ? 'Copying…' : 'Copy both reports'}
                </Button>
              )}
              {formKind === 'COMBINED' && reports.length >= 2 && (
                <Button
                  title={reportDeliveryBlocked ? NOT_PAID_REPORT_MESSAGE : undefined}
                  disabled={emailJobReportsMutation.isPending}
                  onClick={() => {
                    if (reportDeliveryBlocked) {
                      setEmailFeedback({ type: 'error', text: NOT_PAID_REPORT_MESSAGE });
                      return;
                    }
                    emailJobReportsMutation.mutate();
                  }}
                >
                  <Mail className="h-4 w-4" />
                  {emailJobReportsMutation.isPending
                    ? 'Sending…'
                    : 'Email both reports to client'}
                </Button>
              )}
            </div>

            {reports.length > 0 ? (
              <ul className="space-y-2 border-t border-border pt-4">
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
                        title={reportDeliveryBlocked ? NOT_PAID_REPORT_MESSAGE : undefined}
                        onClick={() => void copyReportPdf(report)}
                      >
                        <Copy className="h-4 w-4" />
                        {copyingReportId === report.id ? 'Copying…' : 'Copy'}
                      </Button>
                      {formKind !== 'COMBINED' && (
                        <Button
                          size="sm"
                          title={reportDeliveryBlocked ? NOT_PAID_REPORT_MESSAGE : undefined}
                          onClick={() => {
                            if (reportDeliveryBlocked) {
                              setEmailFeedback({ type: 'error', text: NOT_PAID_REPORT_MESSAGE });
                              return;
                            }
                            emailReportMutation.mutate(report.id);
                          }}
                          disabled={emailReportMutation.isPending}
                        >
                          <Mail className="h-4 w-4" />
                          Email to client
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No PDFs generated yet.</p>
            )}
          </div>
        </Modal>
      </div>
    </InspectionPhotoCacheProvider>
  );
}

export default InspectionWorkspacePage;
