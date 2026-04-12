import type { ActionTelemetry } from '@/hooks/admin-dashboard/useDashboardActions';
import {
  DashboardFocusedHeader,
  DashboardMainHeader,
} from '@/components/admin-dashboard/DashboardChrome';
import {
  DashboardStatusRail,
  type DashboardAuthTelemetryState,
  type RefreshFailureDiagnostics,
} from '@/components/admin-dashboard/DashboardStatusRail';
import type { DashboardReliabilityState } from '@/services/admin-dashboard/dashboardReliabilityState';

type DashboardTopShellProps = {
  settingsOpen: boolean;
  showOverviewMode: boolean;
  sessionBlocked: boolean;
  loading: boolean;
  userLabel: string;
  userAvatarUrl: string;
  userAvatarFallback: string;
  sessionRole: string;
  sessionRoleSource: string;
  settingsStatusLabel: string;
  featureFlagsCount: number | string;
  activeModuleLabel: string;
  activeModuleSubtitle: string;
  onOpenSettings: () => void;
  error: string;
  errorCode: string;
  refreshFailureDiagnostics: RefreshFailureDiagnostics | null;
  authTelemetry: DashboardAuthTelemetryState;
  notice: string;
  noticeTone: 'info' | 'success' | 'warning' | 'error';
  busyAction: string;
  isDashboardDegraded: boolean;
  syncHealthState: DashboardReliabilityState;
  syncModeLabel: string;
  syncHealthMessage: string;
  streamModeLabel: string;
  streamLastEventLabel: string;
  lastPollLabel: string;
  lastSuccessfulPollLabel: string;
  nextPollLabel: string;
  pollFreshnessLabel: string;
  pollFailureCount: number;
  streamFailureCount: number;
  bridgeHardFailures: number;
  bridgeSoftFailures: number;
  degradedCauses: string[];
  actionTelemetry: ActionTelemetry;
};

export function DashboardTopShell({
  settingsOpen,
  showOverviewMode,
  sessionBlocked,
  loading,
  userLabel,
  userAvatarUrl,
  userAvatarFallback,
  sessionRole,
  sessionRoleSource,
  settingsStatusLabel,
  featureFlagsCount,
  activeModuleLabel,
  activeModuleSubtitle,
  onOpenSettings,
  error,
  errorCode,
  refreshFailureDiagnostics,
  authTelemetry,
  notice,
  noticeTone,
  busyAction,
  isDashboardDegraded,
  syncHealthState,
  syncModeLabel,
  syncHealthMessage,
  streamModeLabel,
  streamLastEventLabel,
  lastPollLabel,
  lastSuccessfulPollLabel,
  nextPollLabel,
  pollFreshnessLabel,
  pollFailureCount,
  streamFailureCount,
  bridgeHardFailures,
  bridgeSoftFailures,
  degradedCauses,
  actionTelemetry,
}: DashboardTopShellProps): JSX.Element | null {
  if (settingsOpen) {
    return null;
  }

  const showNoticeRail = notice.trim().length > 0 && noticeTone !== 'info';
  const overviewDetail = loading
    ? 'Checking live status.'
    : busyAction.length > 0
      ? `Updating ${busyAction}.`
      : notice.trim().length > 0
        ? notice
        : isDashboardDegraded
          ? 'Attention needed in live operations.'
          : 'Everything looks healthy. Open the area you need.';
  const showStatusRail = !sessionBlocked
    && showOverviewMode
    && (error || busyAction.length > 0 || isDashboardDegraded || showNoticeRail);

  return (
    <>
      <section className="va-top-shell">
        {showOverviewMode ? (
          <DashboardMainHeader
            userLabel={userLabel}
            userAvatarUrl={userAvatarUrl}
            userAvatarFallback={userAvatarFallback}
            sessionRole={sessionRole}
            sessionRoleSource={sessionRoleSource}
            settingsStatusLabel={settingsStatusLabel}
            featureFlagsCount={featureFlagsCount}
            moduleDetail={overviewDetail}
            activeModuleGlyph="⌂"
            loading={loading}
            compact
            onOpenSettings={onOpenSettings}
          />
        ) : (
          <DashboardFocusedHeader
            title={activeModuleLabel}
            subtitle={activeModuleSubtitle}
            userAvatarUrl={userAvatarUrl}
            userAvatarFallback={userAvatarFallback}
            loading={loading}
            onOpenSettings={onOpenSettings}
          />
        )}
      </section>

      {showStatusRail ? (
        <DashboardStatusRail
          loading={loading}
          error={error}
          errorCode={errorCode}
          refreshFailureDiagnostics={refreshFailureDiagnostics}
          authTelemetry={authTelemetry}
          notice={notice}
          noticeTone={noticeTone}
          busyAction={busyAction}
          syncHealthState={syncHealthState}
          syncModeLabel={syncModeLabel}
          syncHealthMessage={syncHealthMessage}
          streamModeLabel={streamModeLabel}
          streamLastEventLabel={streamLastEventLabel}
          lastPollLabel={lastPollLabel}
          lastSuccessfulPollLabel={lastSuccessfulPollLabel}
          nextPollLabel={nextPollLabel}
          pollFreshnessLabel={pollFreshnessLabel}
          pollFailureCount={pollFailureCount}
          streamFailureCount={streamFailureCount}
          bridgeHardFailures={bridgeHardFailures}
          bridgeSoftFailures={bridgeSoftFailures}
          degradedCauses={degradedCauses}
          actionTelemetry={actionTelemetry}
        />
      ) : null}
    </>
  );
}
