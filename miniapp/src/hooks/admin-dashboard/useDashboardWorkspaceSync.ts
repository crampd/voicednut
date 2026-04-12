import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { DashboardModule, WorkspaceRoute } from '@/pages/AdminDashboard/dashboardShellConfig';

type UseDashboardWorkspaceRouteSyncOptions = {
  workspaceRoute: WorkspaceRoute;
  activeModule: DashboardModule;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setActiveModule: Dispatch<SetStateAction<DashboardModule>>;
  initialServerModuleAppliedRef: MutableRefObject<boolean>;
};

export function useDashboardWorkspaceRouteSync({
  workspaceRoute,
  activeModule,
  setSettingsOpen,
  setActiveModule,
  initialServerModuleAppliedRef,
}: UseDashboardWorkspaceRouteSyncOptions): void {
  useEffect(() => {
    if (workspaceRoute === 'settings') {
      setSettingsOpen((prev) => (prev ? prev : true));
      return;
    }
    setSettingsOpen((prev) => (prev ? false : prev));
    if (!workspaceRoute || workspaceRoute === activeModule) return;
    initialServerModuleAppliedRef.current = true;
    setActiveModule(workspaceRoute);
  }, [
    activeModule,
    initialServerModuleAppliedRef,
    setActiveModule,
    setSettingsOpen,
    workspaceRoute,
  ]);
}
