import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/design-system/layouts/AppShell';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { NewJobPage } from '@/modules/jobs/NewJobPage';
import { InProgressPage } from '@/modules/jobs/InProgressPage';
import { CompletedJobsPage } from '@/modules/jobs/CompletedJobsPage';
import { TodayJobsPage } from '@/modules/jobs/TodayJobsPage';
import { JobDetailPage } from '@/modules/jobs/JobDetailPage';
import { AgreementsPage } from '@/modules/agreements/AgreementsPage';
import { AgreementFormPage } from '@/modules/agreements/AgreementFormPage';
import { AgreementDetailPage } from '@/modules/agreements/AgreementDetailPage';
import { AgreementSignPage } from '@/modules/agreements/AgreementSignPage';
import { CalendarPage } from '@/modules/calendar/CalendarPage';
import { RecycleBinPage } from '@/modules/recycle-bin/RecycleBinPage';
import { ClientsPage } from '@/modules/clients/ClientsPage';
import { ClientDetailPage } from '@/modules/clients/ClientDetailPage';
import { OutstandingInvoicesPage } from '@/modules/invoices/OutstandingInvoicesPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingOverlay } from '@/design-system/components';

const InspectionWorkspacePage = lazy(
  () => import('@/modules/inspections/pages/InspectionWorkspacePage'),
);

function InspectionRoute() {
  return (
    <ErrorBoundary title="Inspection workspace failed to load">
      <Suspense fallback={<LoadingOverlay message="Loading inspection forms..." fullScreen={false} />}>
        <InspectionWorkspacePage />
      </Suspense>
    </ErrorBoundary>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="jobs/new" element={<NewJobPage />} />
        <Route path="jobs/today" element={<TodayJobsPage />} />
        <Route path="jobs/in-progress" element={<InProgressPage />} />
        <Route path="jobs/completed" element={<CompletedJobsPage />} />
        <Route path="jobs/:jobId/inspection" element={<InspectionRoute />} />
        <Route path="jobs/:jobId" element={<JobDetailPage />} />
        <Route path="agreements" element={<AgreementsPage />} />
        <Route path="agreements/new" element={<AgreementFormPage />} />
        <Route path="agreements/sign/:token" element={<AgreementSignPage />} />
        <Route path="agreements/:agreementId/edit" element={<AgreementFormPage />} />
        <Route path="agreements/:agreementId" element={<AgreementDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="recycle-bin" element={<RecycleBinPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId" element={<ClientDetailPage />} />
        <Route path="invoices/outstanding" element={<OutstandingInvoicesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
