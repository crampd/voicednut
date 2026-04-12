import { lazy, type JSX, type LazyExoticComponent } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModuleErrorFallbackCard } from '@/components/admin-dashboard/DashboardStateCards';
import { MODULE_DEFINITIONS, type DashboardModule } from '@/pages/AdminDashboard/dashboardShellConfig';
import type { DashboardVm } from '@/pages/AdminDashboard/types';

type ModulePageProps = {
  visible: boolean;
  vm: DashboardVm;
};

type ModuleMetadata = {
  label: string;
  capability: string;
};

const MODULE_METADATA = MODULE_DEFINITIONS.reduce((acc, module) => {
  acc[module.id] = {
    label: module.label,
    capability: module.capability,
  };
  return acc;
}, {} as Record<DashboardModule, ModuleMetadata>);

const OpsDashboardPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/OpsDashboardPage');
  return { default: mod.OpsDashboardPage };
});
const SmsSenderPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/SmsSenderPage');
  return { default: mod.SmsSenderPage };
});
const MailerPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/MailerPage');
  return { default: mod.MailerPage };
});
const ProviderControlPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/ProviderControlPage');
  return { default: mod.ProviderControlPage };
});
const ScriptStudioPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/ScriptStudioPage');
  return { default: mod.ScriptStudioPage };
});
const CallLogExplorerPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/CallLogExplorerPage');
  return { default: mod.CallLogExplorerPage };
});
const CallerFlagsModerationPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/CallerFlagsModerationPage');
  return { default: mod.CallerFlagsModerationPage };
});
const ScriptsParityExpansionPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/ScriptsParityExpansionPage');
  return { default: mod.ScriptsParityExpansionPage };
});
const MessagingInvestigationPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/MessagingInvestigationPage');
  return { default: mod.MessagingInvestigationPage };
});
const PersonaManagerPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/PersonaManagerPage');
  return { default: mod.PersonaManagerPage };
});
const UsersRolePage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/UsersRolePage');
  return { default: mod.UsersRolePage };
});
const AuditIncidentsPage = lazy(async () => {
  const mod = await import('@/pages/AdminDashboard/AuditIncidentsPage');
  return { default: mod.AuditIncidentsPage };
});

const MODULE_COMPONENTS: Record<DashboardModule, LazyExoticComponent<(props: ModulePageProps) => JSX.Element | null>> = {
  ops: OpsDashboardPage,
  sms: SmsSenderPage,
  mailer: MailerPage,
  provider: ProviderControlPage,
  content: ScriptStudioPage,
  calllog: CallLogExplorerPage,
  callerflags: CallerFlagsModerationPage,
  scriptsparity: ScriptsParityExpansionPage,
  messaging: MessagingInvestigationPage,
  persona: PersonaManagerPage,
  users: UsersRolePage,
  audit: AuditIncidentsPage,
};

interface DashboardFocusedModulePaneProps {
  activeModule: DashboardModule;
  moduleVm: DashboardVm;
  hasCapability: (capability: string) => boolean;
  moduleErrorBoundariesEnabled: boolean;
  moduleBoundaryKeySuffix: string;
  onReload: () => void;
  reloadDisabled: boolean;
}

export function DashboardFocusedModulePane({
  activeModule,
  moduleVm,
  hasCapability,
  moduleErrorBoundariesEnabled,
  moduleBoundaryKeySuffix,
  onReload,
  reloadDisabled,
}: DashboardFocusedModulePaneProps): JSX.Element | null {
  const moduleMeta = MODULE_METADATA[activeModule];
  if (!moduleMeta || !hasCapability(moduleMeta.capability)) {
    return null;
  }

  const ModulePage = MODULE_COMPONENTS[activeModule];
  const pane = <ModulePage visible vm={moduleVm} />;
  if (!moduleErrorBoundariesEnabled) {
    return pane;
  }

  return (
    <ErrorBoundary
      key={`${activeModule}-${moduleBoundaryKeySuffix}`}
      fallback={(
        <ModuleErrorFallbackCard
          moduleLabel={moduleMeta.label}
          onReload={onReload}
          reloadDisabled={reloadDisabled}
        />
      )}
    >
      {pane}
    </ErrorBoundary>
  );
}
