import { createContext, useContext, type ReactNode } from 'react';

interface AppSidebarContextValue {
  sidebarOpen: boolean;
  showSidebar: () => void;
  hideSidebar: () => void;
  isInspectionWorkspace: boolean;
}

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export function AppSidebarProvider({
  value,
  children,
}: {
  value: AppSidebarContextValue;
  children: ReactNode;
}) {
  return <AppSidebarContext.Provider value={value}>{children}</AppSidebarContext.Provider>;
}

export function useAppSidebar(): AppSidebarContextValue | null {
  return useContext(AppSidebarContext);
}
