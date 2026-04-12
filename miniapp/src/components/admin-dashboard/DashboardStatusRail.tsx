import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActionTelemetry } from '@/hooks/admin-dashboard/useDashboardActions';
import type { DashboardAuthTelemetry } from '@/hooks/admin-dashboard/useDashboardSyncLoaders';
import {
  UiButton,
  UiDisclosure,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import type { DashboardReliabilityState } from '@/services/admin-dashboard/dashboardReliabilityState';
import { describeDashboardRefreshFailure } from '@/services/admin-dashboard/dashboardSessionErrors';

export type RefreshFailureDiagnostics = {
  failureClass: string;
  endpoint: string;
  code: string;
  correlationId: string;
  traceHint: string;
  retries: number;
};

export type DashboardAuthTelemetryState = DashboardAuthTelemetry;

type DashboardStatusRailProps = {
  loading: boolean;
  error: string;
  errorCode: string;
  refreshFailureDiagnostics: RefreshFailureDiagnostics | null;
  authTelemetry: DashboardAuthTelemetryState;
  notice: string;
  noticeTone: 'info' | 'success' | 'warning' | 'error';
  busyAction: string;
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

type FailureGroup = {
  key: string;
  label: string;
  count: number;
};

type DiagnosticsCopyStatus = 'idle' | 'copied' | 'error';

function classifyErrorCodeFailureGroup(code: string): string {
  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) return 'runtime';
  if (normalizedCode.startsWith('miniapp_')) return 'session-auth';
  if (normalizedCode.startsWith('http_')) return 'http';
  return 'runtime';
}

function buildFailureGroups(options: {
  pollFailureCount: number;
  streamFailureCount: number;
  bridgeHardFailures: number;
  bridgeSoftFailures: number;
  refreshFailureClass: string;
  actionTelemetry: ActionTelemetry;
  errorCode: string;
  error: string;
}): FailureGroup[] {
  const groups = new Map<string, number>();
  const addGroup = (key: string, count: number): void => {
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    if (safeCount <= 0) return;
    groups.set(key, (groups.get(key) || 0) + safeCount);
  };
  const refreshFailureClass = options.refreshFailureClass.trim().toLowerCase();
  if (refreshFailureClass && refreshFailureClass !== 'n/a') {
    addGroup(refreshFailureClass, 1);
  }
  addGroup('poll-sync', options.pollFailureCount);
  addGroup('stream-sync', options.streamFailureCount);
  addGroup('bridge-hard', options.bridgeHardFailures);
  addGroup('bridge-soft', options.bridgeSoftFailures);
  if (options.actionTelemetry.status === 'error') {
    addGroup('action', 1);
  }
  if (options.error.trim()) {
    addGroup(classifyErrorCodeFailureGroup(options.errorCode), 1);
  }

  const groupLabels: Record<string, string> = {
    action: 'Action',
    'bridge-hard': 'Bridge hard',
    'bridge-soft': 'Bridge soft',
    http: 'HTTP',
    'poll-sync': 'Poll',
    runtime: 'Runtime',
    'session-auth': 'Session auth',
    'session-init-data': 'Init data',
    'session-token': 'Session token',
    'stream-sync': 'Stream',
    'sync-runtime': 'Sync runtime',
  };

  return Array.from(groups.entries())
    .map(([key, count]) => ({
      key,
      label: groupLabels[key] || key,
      count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label);
    });
}

function statusLabel(status: ActionTelemetry['status']): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'success':
      return 'Healthy';
    case 'error':
      return 'Errored';
    default:
      return 'Idle';
  }
}

function noticeToneToStateTone(
  tone: DashboardStatusRailProps['noticeTone'],
): 'info' | 'success' | 'warning' | 'error' {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

function noticeTitle(tone: DashboardStatusRailProps['noticeTone']): string {
  switch (tone) {
    case 'success':
      return 'Action completed';
    case 'warning':
      return 'Attention needed';
    case 'error':
      return 'Action failed';
    default:
      return 'Dashboard notice';
  }
}

function resolveStatusSummaryTone(options: {
  error: string;
  noticeTone: DashboardStatusRailProps['noticeTone'];
  syncHealthState: DashboardReliabilityState;
  pollFailureCount: number;
  streamFailureCount: number;
  bridgeHardFailures: number;
  bridgeSoftFailures: number;
  authDegraded: boolean;
  busyAction: string;
  actionTelemetry: ActionTelemetry;
}): 'info' | 'success' | 'warning' | 'error' {
  if (
    options.error
    || options.noticeTone === 'error'
    || options.syncHealthState === 'blocked'
    || options.syncHealthState === 'offline'
    || options.bridgeHardFailures > 0
    || options.actionTelemetry.status === 'error'
  ) {
    return 'error';
  }
  if (
    options.noticeTone === 'warning'
    || options.syncHealthState !== 'healthy'
    || options.pollFailureCount > 0
    || options.streamFailureCount > 0
    || options.bridgeSoftFailures > 0
    || options.authDegraded
  ) {
    return 'warning';
  }
  if (
    options.busyAction
    || options.actionTelemetry.status === 'running'
    || options.noticeTone === 'info'
  ) {
    return 'info';
  }
  return 'success';
}

function resolveStatusSummaryLabel(
  tone: ReturnType<typeof resolveStatusSummaryTone>,
): string {
  switch (tone) {
    case 'error':
      return 'Needs attention';
    case 'warning':
      return 'Watching';
    case 'info':
      return 'Updating';
    default:
      return 'Healthy';
  }
}

function resolveStatusSummaryDescription(options: {
  error: string;
  refreshFailureDescription: string;
  actionTelemetry: ActionTelemetry;
  busyAction: string;
  notice: string;
  syncHealthMessage: string;
}): string {
  if (options.error) {
    return options.refreshFailureDescription;
  }
  if (options.actionTelemetry.status === 'error' && options.actionTelemetry.error) {
    return options.actionTelemetry.error;
  }
  if (options.busyAction) {
    return `Working on ${options.busyAction}.`;
  }
  if (options.notice) {
    return options.notice;
  }
  return options.syncHealthMessage;
}

function formatTelemetryTimestamp(value: number | null): string {
  if (!Number.isFinite(value) || value === null) return 'n/a';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'n/a';
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to legacy copy path.
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

export function DashboardStatusRail({
  loading,
  error,
  errorCode,
  refreshFailureDiagnostics,
  authTelemetry,
  notice,
  noticeTone,
  busyAction,
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
}: DashboardStatusRailProps) {
  const [copyStatus, setCopyStatus] = useState<DiagnosticsCopyStatus>('idle');
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasActionTelemetry = actionTelemetry.action.length > 0;
  const isBusy = busyAction.length > 0;
  const refreshFailure = describeDashboardRefreshFailure(errorCode, error);
  const shouldShowOpsDiagnostics = syncHealthState !== 'healthy'
    || pollFailureCount > 0
    || streamFailureCount > 0
    || bridgeSoftFailures > 0
    || authTelemetry.authDegraded
    || authTelemetry.expiryEvents > 0
    || authTelemetry.recoveryEvents > 0
    || actionTelemetry.status === 'error'
    || error.length > 0;
  const diagCorrelationId = refreshFailureDiagnostics?.correlationId || 'n/a';
  const diagTraceHint = refreshFailureDiagnostics?.traceHint || actionTelemetry.traceHint || 'n/a';
  const diagFailureClass = refreshFailureDiagnostics?.failureClass || 'n/a';
  const diagEndpoint = refreshFailureDiagnostics?.endpoint || 'n/a';
  const diagCode = refreshFailureDiagnostics?.code || 'n/a';
  const diagRetries = refreshFailureDiagnostics?.retries ?? 0;
  const failureGroups = buildFailureGroups({
    pollFailureCount,
    streamFailureCount,
    bridgeHardFailures,
    bridgeSoftFailures,
    refreshFailureClass: diagFailureClass,
    actionTelemetry,
    errorCode,
    error,
  });
  const failureGroupSummary = failureGroups.length > 0
    ? failureGroups.slice(0, 5).map((group) => `${group.label} (${group.count})`).join(', ')
    : 'None';
  const degradedCauseSummary = degradedCauses.length > 0
    ? degradedCauses.slice(0, 3).join('; ')
    : 'None';
  const authHealthLabel = authTelemetry.authDegraded
    ? 'Degraded'
    : authTelemetry.expiryEvents > 0
      ? 'Recovered'
      : 'Stable';
  const lastAuthExpiryLabel = formatTelemetryTimestamp(authTelemetry.lastExpiryAt);
  const lastAuthRecoveryLabel = formatTelemetryTimestamp(authTelemetry.lastRecoveryAt);
  const statusSummaryTone = resolveStatusSummaryTone({
    error,
    noticeTone,
    syncHealthState,
    pollFailureCount,
    streamFailureCount,
    bridgeHardFailures,
    bridgeSoftFailures,
    authDegraded: authTelemetry.authDegraded,
    busyAction,
    actionTelemetry,
  });
  const statusSummaryLabel = resolveStatusSummaryLabel(statusSummaryTone);
  const statusSummaryDescription = resolveStatusSummaryDescription({
    error,
    refreshFailureDescription: refreshFailure.description,
    actionTelemetry,
    busyAction,
    notice,
    syncHealthMessage,
  });
  const activeWorkLabel = isBusy
    ? busyAction
    : hasActionTelemetry
      ? `${actionTelemetry.action} · ${statusLabel(actionTelemetry.status)}`
      : 'Monitoring';
  const issueGroupCount = failureGroups.reduce((sum, group) => sum + group.count, 0);
  const diagnosticsSubtitle = issueGroupCount > 0
    ? `${issueGroupCount} recent issue signals tracked.`
    : 'View sync, auth, trace, and recovery detail.';
  const diagnosticsSummary = useMemo(() => [
    `sync_mode=${syncModeLabel}`,
    `sync_health=${syncHealthState}`,
    `sync_message=${JSON.stringify(syncHealthMessage)}`,
    `stream_mode=${streamModeLabel}`,
    `stream_last_event=${JSON.stringify(streamLastEventLabel)}`,
    `poll_failure_count=${pollFailureCount}`,
    `stream_failure_count=${streamFailureCount}`,
    `bridge_hard_failures=${bridgeHardFailures}`,
    `bridge_soft_failures=${bridgeSoftFailures}`,
    `poll_freshness=${JSON.stringify(pollFreshnessLabel)}`,
    `last_poll=${JSON.stringify(lastPollLabel)}`,
    `last_successful_poll=${JSON.stringify(lastSuccessfulPollLabel)}`,
    `next_poll=${JSON.stringify(nextPollLabel)}`,
    `degraded_causes=${JSON.stringify(degradedCauseSummary)}`,
    `failure_class=${diagFailureClass}`,
    `failure_groups=${JSON.stringify(failureGroupSummary)}`,
    `endpoint=${diagEndpoint}`,
    `code=${diagCode}`,
    `error_code=${errorCode || 'n/a'}`,
    `correlation_id=${diagCorrelationId}`,
    `trace_hint=${diagTraceHint}`,
    `retries=${diagRetries}`,
    `auth_health=${authHealthLabel}`,
    `auth_expiries=${authTelemetry.expiryEvents}`,
    `auth_recoveries=${authTelemetry.recoveryEvents}`,
    `last_auth_expiry=${JSON.stringify(lastAuthExpiryLabel)}`,
    `last_auth_recovery=${JSON.stringify(lastAuthRecoveryLabel)}`,
    `last_expiry_code=${authTelemetry.lastExpiryCode}`,
    `last_failure_class=${authTelemetry.lastFailureClass}`,
    `last_recovery_source=${authTelemetry.lastRecoverySource}`,
    `action_name=${actionTelemetry.action || 'n/a'}`,
    `action_status=${actionTelemetry.status}`,
    `action_latency_ms=${actionTelemetry.latencyMs}`,
    `action_error=${JSON.stringify(actionTelemetry.error || 'n/a')}`,
    `notice_tone=${noticeTone}`,
    `notice=${JSON.stringify(notice || 'n/a')}`,
    `dashboard_error=${JSON.stringify(error || 'n/a')}`,
  ].join('\n'), [
    syncModeLabel,
    syncHealthState,
    syncHealthMessage,
    streamModeLabel,
    streamLastEventLabel,
    pollFailureCount,
    streamFailureCount,
    bridgeHardFailures,
    bridgeSoftFailures,
    pollFreshnessLabel,
    lastPollLabel,
    lastSuccessfulPollLabel,
    nextPollLabel,
    degradedCauseSummary,
    diagFailureClass,
    failureGroupSummary,
    diagEndpoint,
    diagCode,
    errorCode,
    diagCorrelationId,
    diagTraceHint,
    diagRetries,
    authHealthLabel,
    authTelemetry.expiryEvents,
    authTelemetry.recoveryEvents,
    lastAuthExpiryLabel,
    lastAuthRecoveryLabel,
    authTelemetry.lastExpiryCode,
    authTelemetry.lastFailureClass,
    authTelemetry.lastRecoverySource,
    actionTelemetry.action,
    actionTelemetry.status,
    actionTelemetry.latencyMs,
    actionTelemetry.error,
    noticeTone,
    notice,
    error,
  ]);

  const scheduleCopyStatusReset = useCallback(() => {
    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = setTimeout(() => {
      setCopyStatus('idle');
      copyResetTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleCopyDiagnostics = useCallback(async () => {
    const generatedAt = new Date().toISOString();
    const copied = await copyTextToClipboard(
      `voicednut_dashboard_diagnostics\ngenerated_at=${generatedAt}\n${diagnosticsSummary}`,
    );
    setCopyStatus(copied ? 'copied' : 'error');
    scheduleCopyStatusReset();
  }, [diagnosticsSummary, scheduleCopyStatusReset]);

  useEffect(() => () => {
    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current);
    }
  }, []);

  const copyButtonLabel = copyStatus === 'copied'
    ? 'Copied'
    : copyStatus === 'error'
      ? 'Copy failed'
      : 'Copy diagnostics';

  return (
    <section
      className={`va-status-rail ${isBusy ? 'is-busy' : ''}`}
      aria-label="Dashboard sync and action status"
    >
      <UiWorkspacePulse
        title="Console health"
        description={statusSummaryDescription}
        status={statusSummaryLabel}
        tone={statusSummaryTone}
        items={[
          { label: 'Sync mode', value: syncModeLabel },
          { label: 'Auth', value: authHealthLabel },
          { label: 'Last good sync', value: lastSuccessfulPollLabel },
          { label: 'Active work', value: activeWorkLabel },
        ]}
      />
      {shouldShowOpsDiagnostics ? (
        <UiDisclosure
          title="Advanced diagnostics"
          subtitle={diagnosticsSubtitle}
          tone={statusSummaryTone === 'success' ? 'neutral' : statusSummaryTone}
          className="va-status-disclosure"
        >
          <div className="va-status-diagnostics" role="note" aria-label="Operator diagnostics">
            <div className="va-status-diagnostics-head">
              <p className="va-status-diagnostics-title">Operator diagnostics</p>
              <UiButton
                variant="chip"
                className={`va-status-diagnostics-copy ${copyStatus === 'copied' ? 'is-copied' : ''} ${copyStatus === 'error' ? 'is-error' : ''}`}
                onClick={() => {
                  void handleCopyDiagnostics();
                }}
                aria-label="Copy operator diagnostics"
              >
                {copyButtonLabel}
              </UiButton>
            </div>
            {copyStatus !== 'idle' ? (
              <p
                className={`va-status-diagnostics-copy-feedback ${copyStatus === 'error' ? 'is-error' : ''}`}
                role={copyStatus === 'error' ? 'alert' : 'status'}
                aria-live={copyStatus === 'error' ? 'assertive' : 'polite'}
              >
                {copyStatus === 'copied'
                  ? 'Diagnostics bundle copied to clipboard.'
                  : 'Clipboard unavailable. Copy failed.'}
              </p>
            ) : null}
            <div className="va-status-diagnostics-grid">
              <p className="va-status-diagnostics-item">
                <span>Sync mode</span>
                <strong>{syncModeLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Stream mode</span>
                <strong>{streamModeLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Last stream event</span>
                <strong>{streamLastEventLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Next poll</span>
                <strong>{nextPollLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Last poll</span>
                <strong>{lastPollLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Last successful poll</span>
                <strong>{lastSuccessfulPollLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Poll freshness</span>
                <strong>{pollFreshnessLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Degraded causes</span>
                <strong>{degradedCauseSummary}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Failure class</span>
                <strong>{diagFailureClass}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Auth health</span>
                <strong>{authHealthLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Auth expiries</span>
                <strong>{authTelemetry.expiryEvents}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Auth recoveries</span>
                <strong>{authTelemetry.recoveryEvents}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Failure groups</span>
                <strong>{failureGroupSummary}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Endpoint</span>
                <strong>{diagEndpoint}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Code</span>
                <strong>{diagCode}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Correlation ID</span>
                <strong>{diagCorrelationId}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Trace hint</span>
                <strong>{diagTraceHint}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Retries</span>
                <strong>{diagRetries}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Last auth expiry</span>
                <strong>{lastAuthExpiryLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Last auth recovery</span>
                <strong>{lastAuthRecoveryLabel}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Last expiry code</span>
                <strong>{authTelemetry.lastExpiryCode}</strong>
              </p>
              <p className="va-status-diagnostics-item">
                <span>Recovery source</span>
                <strong>{authTelemetry.lastRecoverySource}</strong>
              </p>
            </div>
          </div>
        </UiDisclosure>
      ) : null}
      {loading || error || notice ? (
        <div className="va-status-state-stack">
          {loading ? (
            <UiSurfaceState
              compact
              cardTone="status"
              eyebrow="Dashboard sync"
              status="Loading"
              statusVariant="info"
              title="Preparing dashboard"
              description="Loading latest telemetry, permissions, and module status."
            />
          ) : null}
          {error ? (
            <UiSurfaceState
              tone="error"
              cardTone="status"
              compact
              eyebrow="Dashboard sync"
              status="Refresh failed"
              statusVariant="error"
              title={refreshFailure.title}
              description={refreshFailure.description}
            />
          ) : null}
          {actionTelemetry.status === 'error' && actionTelemetry.error ? (
            <UiSurfaceState
              tone="error"
              cardTone="status"
              compact
              eyebrow="Last action"
              status={actionTelemetry.action || 'Action error'}
              statusVariant="error"
              title="Latest action needs attention"
              description={actionTelemetry.error}
            />
          ) : null}
          {notice ? (
            <UiSurfaceState
              compact
              cardTone="status"
              tone={noticeToneToStateTone(noticeTone)}
              eyebrow="Dashboard notice"
              status={noticeTitle(noticeTone)}
              statusVariant={noticeToneToStateTone(noticeTone)}
              title={noticeTitle(noticeTone)}
              description={notice}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
