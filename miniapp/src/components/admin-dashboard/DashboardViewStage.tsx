import { Suspense, type CSSProperties, type TouchEventHandler } from 'react';

import { DashboardHomeBriefing } from '@/components/admin-dashboard/DashboardHomeBriefing';
import { DashboardFocusedModulePane } from '@/components/admin-dashboard/DashboardFocusedModulePane';
import { DashboardOverviewMetrics } from '@/components/admin-dashboard/DashboardOverviewMetrics';
import { DashboardShellOwnershipCard } from '@/components/admin-dashboard/DashboardShellOwnershipCard';
import {
  EmptyModulesCard,
  ModuleSkeletonGrid,
  SessionBlockedCard,
} from '@/components/admin-dashboard/DashboardStateCards';
import {
  DashboardWorkspaceLauncher,
  type DashboardWorkspaceLauncherGroup,
} from '@/components/admin-dashboard/DashboardWorkspaceLauncher';
import type { DashboardModule } from '@/pages/AdminDashboard/dashboardShellConfig';
import type {
  ActivityEntry,
  CallLogRow,
  EmailJob,
  IncidentRow,
} from '@/pages/AdminDashboard/types';
import type { DashboardVm } from '@/pages/AdminDashboard/types';

type DashboardViewStageProps = {
  settingsOpen: boolean;
  sessionBlocked: boolean;
  errorCode: string;
  loading: boolean;
  busy: boolean;
  onRetrySession: () => void;
  onCloseMiniApp?: () => void;
  closeDisabled: boolean;
  showOverviewMode: boolean;
  showFocusedModuleMode: boolean;
  isDashboardDegraded: boolean;
  syncModeLabel: string;
  openIncidentCount: number;
  queueBacklogTotal: number;
  lastSuccessfulPollLabel: string;
  visibleModulesCount: number;
  sessionRole: string;
  activityLog: ActivityEntry[];
  callLogs: CallLogRow[];
  emailJobs: EmailJob[];
  incidentRows: IncidentRow[];
  onRefreshAccess: () => void;
  showModuleSkeleton: boolean;
  groupedVisibleModules: DashboardWorkspaceLauncherGroup[];
  moduleShortcutIndexById: Record<string, number>;
  activeModule: DashboardModule;
  onSelectModule: (moduleId: DashboardModule) => void;
  moduleVm: DashboardVm;
  hasCapability: (capability: string) => boolean;
  moduleErrorBoundariesEnabled: boolean;
  moduleBoundaryKeySuffix: string;
  onReload: () => void;
  pullOffset?: number;
  pullIndicatorVisible?: boolean;
  pullReady?: boolean;
  pullRefreshing?: boolean;
  pullLabel?: string;
  isPulling?: boolean;
  onTouchStart?: TouchEventHandler<HTMLElement>;
  onTouchMove?: TouchEventHandler<HTMLElement>;
  onTouchEnd?: TouchEventHandler<HTMLElement>;
  onTouchCancel?: TouchEventHandler<HTMLElement>;
};

export function DashboardViewStage({
  settingsOpen,
  sessionBlocked,
  errorCode,
  loading,
  busy,
  onRetrySession,
  onCloseMiniApp,
  closeDisabled,
  showOverviewMode,
  showFocusedModuleMode,
  isDashboardDegraded,
  syncModeLabel,
  openIncidentCount,
  queueBacklogTotal,
  lastSuccessfulPollLabel,
  visibleModulesCount,
  sessionRole,
  activityLog,
  callLogs,
  emailJobs,
  incidentRows,
  onRefreshAccess,
  showModuleSkeleton,
  groupedVisibleModules,
  moduleShortcutIndexById,
  activeModule,
  onSelectModule,
  moduleVm,
  hasCapability,
  moduleErrorBoundariesEnabled,
  moduleBoundaryKeySuffix,
  onReload,
  pullOffset = 0,
  pullIndicatorVisible = false,
  pullReady = false,
  pullRefreshing = false,
  pullLabel = 'Pull to refresh',
  isPulling = false,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
}: DashboardViewStageProps): JSX.Element | null {
  if (settingsOpen) {
    return null;
  }

  const pullIndicatorClasses = [
    'va-pull-indicator',
    pullIndicatorVisible ? 'is-visible' : '',
    pullReady ? 'is-ready' : '',
    pullRefreshing ? 'is-refreshing' : '',
  ].filter(Boolean).join(' ');
  const pullContentClasses = `va-view-stage-content${isPulling ? ' is-pulling' : ''}`;
  const pullContentStyle: CSSProperties | undefined = pullOffset > 0
    ? { transform: `translate3d(0, ${Math.round(pullOffset)}px, 0)` }
    : undefined;

  return (
    <section
      id="va-view-stage-root"
      className="va-view-stage va-view-stage-dashboard"
      tabIndex={-1}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className={pullIndicatorClasses}
        role="status"
        aria-live="polite"
        aria-hidden={!pullIndicatorVisible}
      >
        <span className="va-pull-indicator-dot" aria-hidden="true" />
        <span className="va-pull-indicator-text">{pullLabel}</span>
      </div>
      <div className={pullContentClasses} style={pullContentStyle}>
        {sessionBlocked ? (
          <SessionBlockedCard
            errorCode={errorCode}
            onRetrySession={onRetrySession}
            retryDisabled={loading || busy}
            onCloseMiniApp={onCloseMiniApp}
            closeDisabled={closeDisabled}
          />
        ) : null}

        {!sessionBlocked && showOverviewMode ? (
          <>
            <DashboardOverviewMetrics
              isDashboardDegraded={isDashboardDegraded}
              syncModeLabel={syncModeLabel}
              openIncidentCount={openIncidentCount}
              queueBacklogTotal={queueBacklogTotal}
              lastSuccessfulPollLabel={lastSuccessfulPollLabel}
            />
            <DashboardHomeBriefing
              sessionRole={sessionRole}
              visibleModulesCount={visibleModulesCount}
              groupedVisibleModules={groupedVisibleModules}
              activityLog={activityLog}
              callLogs={callLogs}
              emailJobs={emailJobs}
              incidentRows={incidentRows}
              openIncidentCount={openIncidentCount}
              queueBacklogTotal={queueBacklogTotal}
              lastSuccessfulPollLabel={lastSuccessfulPollLabel}
            />
            {visibleModulesCount === 0 ? (
              <EmptyModulesCard
                onRefreshAccess={onRefreshAccess}
                refreshDisabled={loading || busy}
              />
            ) : null}
            {showModuleSkeleton ? (
              <ModuleSkeletonGrid />
            ) : groupedVisibleModules.length > 0 ? (
              <DashboardWorkspaceLauncher
                groupedVisibleModules={groupedVisibleModules}
                moduleShortcutIndexById={moduleShortcutIndexById}
                activeModule={activeModule}
                onSelectModule={onSelectModule}
              />
            ) : null}
            <DashboardShellOwnershipCard
              sessionRole={sessionRole}
              visibleModulesCount={visibleModulesCount}
            />
          </>
        ) : null}

        {!sessionBlocked && showFocusedModuleMode ? (
          <>
            {visibleModulesCount === 0 ? (
              <EmptyModulesCard
                onRefreshAccess={onRefreshAccess}
                refreshDisabled={loading || busy}
              />
            ) : null}
            {showModuleSkeleton ? (
              <ModuleSkeletonGrid />
            ) : (
              <Suspense fallback={<ModuleSkeletonGrid />}>
                <DashboardFocusedModulePane
                  activeModule={activeModule}
                  moduleVm={moduleVm}
                  hasCapability={hasCapability}
                  moduleErrorBoundariesEnabled={moduleErrorBoundariesEnabled}
                  moduleBoundaryKeySuffix={moduleBoundaryKeySuffix}
                  onReload={onReload}
                  reloadDisabled={loading || busy}
                />
              </Suspense>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
