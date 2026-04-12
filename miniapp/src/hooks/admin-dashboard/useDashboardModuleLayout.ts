import { useCallback, useMemo } from 'react';

import { asRecord } from '@/services/admin-dashboard/dashboardPrimitives';
import { isDashboardActionSupported } from '@/services/admin-dashboard/dashboardActionGuards';
import {
  parseModuleId,
  parseModuleLayoutConfig,
  parseServerModuleDefinitions,
} from '@/services/admin-dashboard/dashboardLayout';

export type DashboardModuleDefinition<T extends string> = {
  id: T;
  label: string;
  capability: string;
  actionContracts?: string[];
};

type UseDashboardModuleLayoutOptions<T extends string> = {
  sessionCaps: string[];
  dashboardLayoutPayload: unknown;
  moduleDefinitionsPayload: unknown;
  moduleDefinitions: DashboardModuleDefinition<T>[];
  moduleDefaultOrder: Record<T, number>;
  moduleIdSet: Set<T>;
};

type UseDashboardModuleLayoutResult<T extends string> = {
  hasCapability: (capability: string) => boolean;
  visibleModules: Array<DashboardModuleDefinition<T> & { label: string }>;
  preferredServerModule: T | null;
};

export function useDashboardModuleLayout<T extends string>({
  sessionCaps,
  dashboardLayoutPayload,
  moduleDefinitionsPayload,
  moduleDefinitions,
  moduleDefaultOrder,
  moduleIdSet,
}: UseDashboardModuleLayoutOptions<T>): UseDashboardModuleLayoutResult<T> {
  const hasCapability = useCallback((capability: string): boolean => (
    sessionCaps.includes(capability)
  ), [sessionCaps]);

  const moduleLayoutConfig = useMemo(
    () => parseModuleLayoutConfig(dashboardLayoutPayload, moduleIdSet),
    [dashboardLayoutPayload, moduleIdSet],
  );

  const serverModuleDefinitions = useMemo(
    () => parseServerModuleDefinitions(moduleDefinitionsPayload, moduleIdSet),
    [moduleDefinitionsPayload, moduleIdSet],
  );

  const visibleModules = useMemo(() => {
    const roleAllowedModules = moduleDefinitions.filter((module) => {
      const serverModule = serverModuleDefinitions[module.id];
      const effectiveCapability = serverModule?.capability || module.capability;
      if (!hasCapability(effectiveCapability)) return false;
      const effectiveActionContracts = serverModule?.actionContracts?.length
        ? serverModule.actionContracts
        : module.actionContracts;
      if (!Array.isArray(effectiveActionContracts) || effectiveActionContracts.length === 0) return true;
      return effectiveActionContracts.some((action) => isDashboardActionSupported(action));
    });

    return roleAllowedModules
      .filter((module) => {
        if (moduleLayoutConfig[module.id]?.enabled === false) return false;
        if (serverModuleDefinitions[module.id]?.enabled === false) return false;
        return true;
      })
      .map((module) => {
        const serverModule = serverModuleDefinitions[module.id];
        return {
          ...module,
          capability: serverModule?.capability || module.capability,
          actionContracts: serverModule?.actionContracts?.length
            ? serverModule.actionContracts
            : module.actionContracts,
          label: moduleLayoutConfig[module.id]?.label
            || serverModule?.label
            || module.label,
        };
      })
      .sort((a, b) => {
        const orderA = moduleLayoutConfig[a.id]?.order;
        const orderB = moduleLayoutConfig[b.id]?.order;
        const serverOrderA = serverModuleDefinitions[a.id]?.order;
        const serverOrderB = serverModuleDefinitions[b.id]?.order;
        const safeA = Number.isFinite(orderA)
          ? Number(orderA)
          : Number.isFinite(serverOrderA)
            ? Number(serverOrderA)
            : moduleDefaultOrder[a.id];
        const safeB = Number.isFinite(orderB)
          ? Number(orderB)
          : Number.isFinite(serverOrderB)
            ? Number(serverOrderB)
            : moduleDefaultOrder[b.id];
        return safeA - safeB;
      });
  }, [hasCapability, moduleDefaultOrder, moduleDefinitions, moduleLayoutConfig, serverModuleDefinitions]);

  const preferredServerModule = useMemo(() => parseModuleId(
    asRecord(dashboardLayoutPayload).active_module || asRecord(dashboardLayoutPayload).default_module,
    moduleIdSet,
  ), [dashboardLayoutPayload, moduleIdSet]);

  return {
    hasCapability,
    visibleModules,
    preferredServerModule,
  };
}
