import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { DASHBOARD_STATIC_ROUTE_CONTRACTS } from '@/contracts/miniappParityContracts';
import type { DashboardModule, WorkspaceRoute } from '@/pages/AdminDashboard/dashboardShellConfig';

type UseDashboardModuleRouteGuardsOptions = {
  activeModule: DashboardModule;
  setActiveModule: Dispatch<SetStateAction<DashboardModule>>;
  visibleModules: Array<{ id: DashboardModule }>;
  workspaceRoute: WorkspaceRoute;
  locationPathname: string;
  navigate: NavigateFunction;
  preferredServerModule: DashboardModule | null;
  workspaceRouteFallbackPath: (route: WorkspaceRoute, visibleModuleIds: DashboardModule[]) => string;
  initialServerModuleAppliedRef: MutableRefObject<boolean>;
  routeAccessReady: boolean;
};

export function useDashboardModuleRouteGuards({
  activeModule,
  setActiveModule,
  visibleModules,
  workspaceRoute,
  locationPathname,
  navigate,
  preferredServerModule,
  workspaceRouteFallbackPath: resolveWorkspaceRouteFallbackPath,
  initialServerModuleAppliedRef,
  routeAccessReady,
}: UseDashboardModuleRouteGuardsOptions): void {
  useEffect(() => {
    if (visibleModules.length === 0) return;
    if (!visibleModules.some((module) => module.id === activeModule)) {
      setActiveModule(visibleModules[0].id);
    }
  }, [activeModule, setActiveModule, visibleModules]);

  useEffect(() => {
    if (!workspaceRoute || workspaceRoute === 'settings') return;
    if (visibleModules.length === 0) {
      if (!routeAccessReady) return;
      if (locationPathname !== DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT) {
        navigate(DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT, { replace: true });
      }
      return;
    }
    if (visibleModules.some((module) => module.id === workspaceRoute)) return;
    const visibleModuleIds = visibleModules.map((module) => module.id);
    const fallbackPath = resolveWorkspaceRouteFallbackPath(workspaceRoute, visibleModuleIds);
    if (locationPathname !== fallbackPath) {
      navigate(fallbackPath, { replace: true });
    }
  }, [
    locationPathname,
    navigate,
    resolveWorkspaceRouteFallbackPath,
    routeAccessReady,
    visibleModules,
    workspaceRoute,
  ]);

  useEffect(() => {
    if (initialServerModuleAppliedRef.current) return;
    if (!preferredServerModule) return;
    if (!visibleModules.some((module) => module.id === preferredServerModule)) {
      initialServerModuleAppliedRef.current = true;
      return;
    }
    initialServerModuleAppliedRef.current = true;
    setActiveModule(preferredServerModule);
  }, [preferredServerModule, setActiveModule, visibleModules, initialServerModuleAppliedRef]);
}
