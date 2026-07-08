import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  FileText,
  Calendar,
  Users,
  Settings,
  LogOut,
  Plus,
  Recycle,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/auth-store';
import { cn } from '@/lib/cn';
import { getStaleBridgeFeatures, isBridgeUpToDate } from '@/lib/sitescop-api';
import { Button } from '@/design-system/components/Button';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/jobs/new', label: 'Create New Job', icon: Plus, accent: true },
  { to: '/jobs/in-progress', label: 'In Progress', icon: ClipboardList },
  { to: '/jobs/completed', label: 'Completed', icon: CheckCircle2 },
  { to: '/agreements', label: 'Agreements', icon: FileText },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/recycle-bin', label: 'Recycle Bin', icon: Recycle },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Your inspection command centre' },
  '/jobs/new': { title: 'Create New Job', subtitle: 'Add a new inspection to your schedule' },
  '/jobs/today': { title: "Today's Jobs", subtitle: 'Inspections scheduled for today only' },
  '/jobs/in-progress': { title: 'In Progress', subtitle: 'Active and new inspections' },
  '/jobs/completed': { title: 'Completed Jobs', subtitle: 'Finished inspections and PDF reports' },
  '/agreements': { title: 'Agreements', subtitle: 'Send and track client inspection agreements' },
  '/agreements/new': { title: 'New Agreement', subtitle: 'Create a client inspection agreement' },
  '/calendar': { title: 'Calendar', subtitle: 'Monthly schedule and rescheduling' },
  '/recycle-bin': { title: 'Recycle Bin', subtitle: 'Restore or permanently delete removed jobs and agreements' },
  '/clients': { title: 'Clients', subtitle: 'Client contacts from your jobs and agreements' },
  '/invoices/outstanding': { title: 'Outstanding Invoices', subtitle: 'Jobs flagged for invoicing' },
  '/settings': { title: 'Settings', subtitle: 'Inspector, voice dictation, company, reports, login, and GitHub signing' },
  '/jobs/:jobId/inspection': { title: 'Inspection workspace', subtitle: 'Building & pest inspection form' },
};

function resolveHeader(pathname: string) {
  if (pathname.includes('/inspection')) {
    return PAGE_TITLES['/jobs/:jobId/inspection'];
  }
  if (pathname.startsWith('/clients/') && pathname !== '/clients') {
    return { title: 'Client details', subtitle: 'Contact, jobs, agreements, and PDF reports' };
  }
  if (pathname.startsWith('/agreements/') && pathname !== '/agreements/new') {
    if (pathname.includes('/edit')) {
      return { title: 'Edit Agreement', subtitle: 'Update agreement details' };
    }
    if (pathname.includes('/sign/')) {
      return { title: 'Sign Agreement', subtitle: 'Client electronic signature' };
    }
    return { title: 'Agreement details', subtitle: 'Review, send, and download' };
  }
  if (pathname.startsWith('/jobs/') && pathname !== '/jobs/new' && pathname !== '/jobs/in-progress' && pathname !== '/jobs/today' && pathname !== '/jobs/completed') {
    return { title: 'Job details', subtitle: 'Inspection overview' };
  }
  return PAGE_TITLES[pathname] ?? { title: 'SiteScop V6', subtitle: 'Building & Pest Inspections' };
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const header = resolveHeader(pathname);
  const staleFeatures = getStaleBridgeFeatures();
  const showUpgradeBanner = !isBridgeUpToDate() && staleFeatures.length > 0;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-sidebar flex-col bg-sidebar text-white">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-lg font-bold tracking-tight">SiteScop</p>
          <p className="text-xs text-white/60">V6 · Local Edition</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-medium transition-colors',
                    'accent' in item && item.accent
                      ? isActive
                        ? 'bg-accent text-white'
                        : 'text-white/70 hover:bg-sidebar-hover hover:text-white [&_svg]:text-accent'
                      : isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-white/70 hover:bg-sidebar-hover hover:text-white',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="truncate text-xs text-white/60">{user?.companyName}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-white/70 hover:bg-sidebar-hover hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="ml-sidebar flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-topbar items-center justify-between border-b border-border bg-surface px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-text">{header.title}</h1>
            <p className="text-sm text-text-light">{header.subtitle}</p>
          </div>
          {!pathname.includes('/jobs/new') && !pathname.includes('/inspection') && (
            <Button size="lg" onClick={() => navigate('/jobs/new')}>
              <Plus className="h-5 w-5" />
              Create New Job
            </Button>
          )}
        </header>

        <main className="flex-1 p-8">
          {showUpgradeBanner && (
            <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">
              <strong>App update needed:</strong> {staleFeatures.join(', ')}{' '}
              {staleFeatures.length === 1 ? 'is' : 'are'} not available in this running copy. Close all
              SiteScop windows, then double-click{' '}
              <strong>START-SITESCOP.bat</strong> in the sitescop-v6 folder.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
