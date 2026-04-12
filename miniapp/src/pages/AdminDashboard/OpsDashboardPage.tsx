import { useMemo, useState } from 'react';

import { buildModuleRequestState } from './moduleRequestState';
import type {
  ActivityEntry,
  CallLogRow,
  DashboardVm,
  DlqCallRow,
  DlqEmailRow,
  EmailJob,
} from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectOpsPageVm } from './vmSelectors';
import { DashboardWorkflowContractCard } from '@/components/admin-dashboard/DashboardWorkflowContractCard';
import {
  UiBadge,
  UiButton,
  UiCard,
  UiInput,
  UiStatePanel,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';

type OpsDashboardPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

function buildAsciiSparkline(values: number[]): string {
  if (!Array.isArray(values) || values.length === 0) return '';
  const levels = '._-:=+*#%@';
  return values
    .map((value) => {
      const normalized = Math.max(0, Math.min(100, Number(value) || 0));
      const index = Math.round((normalized / 100) * (levels.length - 1));
      return levels[index] || levels[0];
    })
    .join('');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function OpsDashboardPage({ visible, vm }: OpsDashboardPageProps) {
  if (!visible) return null;

  const {
    isFeatureEnabled,
    isDashboardDegraded,
    syncModeLabel,
    streamModeLabel,
    streamLastEventLabel,
    streamFailureCount,
    pollFailureCount,
    bridgeHardFailures,
    bridgeSoftFailures,
    sloErrorBudgetPercent,
    sloP95ActionLatencyMs,
    pollFreshnessLabel,
    degradedCauses,
    lastPollLabel,
    lastSuccessfulPollLabel,
    nextPollLabel,
    callCompleted,
    callTotal,
    callFailed,
    callFailureRate,
    callSuccessRate,
    queueBacklogTotal,
    opsQaSummary,
    providerReadinessTotals,
    providerReadinessPercent,
    textBar,
    runtimeEffectiveMode,
    runtimeModeOverride,
    runtimeCanaryEffective,
    runtimeCanaryOverrideLabel,
    runtimeIsCircuitOpen,
    runtimeForcedLegacyUntil,
    runtimeActiveTotal,
    runtimeActiveLegacy,
    runtimeActiveVoiceAgent,
    busyAction,
    enableRuntimeMaintenance,
    disableRuntimeMaintenance,
    refreshRuntimeStatus,
    runtimeCanaryInput,
    setRuntimeCanaryInput,
    applyRuntimeCanary,
    clearRuntimeCanary,
    activityLog,
    formatTime,
    renderProviderSection,
    smsTotalRecipients,
    smsSuccess,
    smsFailed,
    smsProcessedPercent,
    emailTotalRecipients,
    emailSent,
    emailFailed,
    emailDelivered,
    emailBounced,
    emailComplained,
    emailSuppressed,
    emailProcessedPercent,
    emailDeliveredPercent,
    callLogs,
    callLogsTotal,
    toText,
    toInt,
    emailJobs,
    dlqPayload,
    callDlq,
    emailDlq,
    runAction,
    invokeAction,
    hasMeaningfulData,
    loading,
  } = selectOpsPageVm(vm);
  const runtimeControlsEnabled = isFeatureEnabled('runtime_controls', true);
  const providerCardsEnabled = isFeatureEnabled('provider_cards', true);
  const [callExplorerQuery, setCallExplorerQuery] = useState<string>('');
  const [callExplorerCallSid, setCallExplorerCallSid] = useState<string>('');
  const [callExplorerRows, setCallExplorerRows] = useState<CallLogRow[]>([]);
  const [callExplorerDetails, setCallExplorerDetails] = useState<Record<string, unknown> | null>(null);
  const [callExplorerEvents, setCallExplorerEvents] = useState<Array<Record<string, unknown>>>([]);
  const [callExplorerValidationError, setCallExplorerValidationError] = useState<string>('');
  const {
    investigationBusy,
    investigationError,
    runInvestigationAction,
  } = useInvestigationAction(invokeAction);
  const requestState = buildModuleRequestState({
    busyAction,
    secondaryBusyAction: investigationBusy,
  });
  const controlsBusy = requestState.isBusy;
  const activeActionLabel = requestState.activeActionLabel;
  const callExplorerError = callExplorerValidationError || investigationError;
  const callExplorerRecentStates = useMemo(() => {
    if (!Array.isArray(callExplorerEvents)) return [];
    return callExplorerEvents.slice(0, 12);
  }, [callExplorerEvents]);
  const isInitialSyncing = loading && !hasMeaningfulData;
  const opsPulseTone: 'info' | 'success' | 'warning' | 'error' = callExplorerError
    ? 'error'
    : controlsBusy || isInitialSyncing
      ? 'info'
      : isDashboardDegraded
        ? 'warning'
        : 'success';
  const opsPulseStatus = callExplorerError
    ? 'Needs attention'
    : controlsBusy || isInitialSyncing
      ? 'Working'
      : isDashboardDegraded
        ? 'Degraded'
        : 'Healthy';
  const opsPulseDescription = callExplorerError
    ? callExplorerError
    : controlsBusy
      ? activeActionLabel ? `${activeActionLabel} is in progress.` : 'Operational controls are running.'
      : isInitialSyncing
        ? 'Collecting runtime telemetry, provider readiness, and recovery metrics.'
        : isDashboardDegraded
          ? degradedCauses[0] || 'Operational telemetry is reporting degraded conditions.'
          : 'Runtime controls, provider readiness, and recovery workflows are available in one place.';

  const loadCallExplorerRows = async (): Promise<void> => {
    setCallExplorerValidationError('');
    const query = callExplorerQuery.trim();
    const action = query.length >= 2
      ? DASHBOARD_ACTION_CONTRACTS.CALLS_SEARCH
      : DASHBOARD_ACTION_CONTRACTS.CALLS_LIST;
    const payload = query.length >= 2
      ? { query, limit: 12 }
      : { limit: 20, offset: 0 };
    await runInvestigationAction(action, payload, (data) => {
      const rows = Array.isArray(data.results)
        ? data.results as CallLogRow[]
        : Array.isArray(data.rows)
          ? data.rows as CallLogRow[]
          : [];
      setCallExplorerRows(rows);
      if (rows.length > 0) {
        const firstSid = toText(rows[0]?.call_sid, '');
        if (firstSid) setCallExplorerCallSid(firstSid);
      }
    });
  };

  const loadCallExplorerDetails = async (): Promise<void> => {
    const callSid = callExplorerCallSid.trim();
    if (!callSid) {
      setCallExplorerValidationError('Provide a call SID before loading details.');
      return;
    }
    setCallExplorerValidationError('');
    await runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.CALLS_GET, { call_sid: callSid }, (data) => {
      const payload = asRecord(data);
      const callDetails = payload.call && typeof payload.call === 'object' && !Array.isArray(payload.call)
        ? payload.call as Record<string, unknown>
        : payload;
      setCallExplorerDetails(callDetails);
    });
  };

  const loadCallExplorerEvents = async (): Promise<void> => {
    const callSid = callExplorerCallSid.trim();
    if (!callSid) {
      setCallExplorerValidationError('Provide a call SID before loading events.');
      return;
    }
    setCallExplorerValidationError('');
    await runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS, { call_sid: callSid }, (data) => {
      const payload = asRecord(data);
      const states = Array.isArray(payload.recent_states)
        ? payload.recent_states as Array<Record<string, unknown>>
        : [];
      setCallExplorerEvents(states);
    });
  };

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Operations</p>
        <h2 className="va-page-title">Control Plane Dashboard</h2>
        <p className="va-muted">
          Reliability, runtime controls, and recovery signals for calls, SMS, and email.
        </p>
        <div className="va-page-intro-meta">
          <UiBadge variant={opsPulseTone}>{opsPulseStatus}</UiBadge>
          <UiBadge variant="meta">Runtime control</UiBadge>
          <UiBadge variant="info">{queueBacklogTotal} backlog</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Use this surface to confirm live sync posture, review queue pressure, and steer runtime
          recovery before operators move into channel-specific workflows.
        </p>
      </section>

      <UiWorkspacePulse
        title="Operations workspace"
        description={opsPulseDescription}
        status={opsPulseStatus}
        tone={opsPulseTone}
        items={[
          { label: 'Sync mode', value: syncModeLabel },
          { label: 'Providers ready', value: `${providerReadinessTotals.ready}/${providerReadinessTotals.total}` },
          { label: 'Queue backlog', value: queueBacklogTotal },
          { label: 'Error budget', value: `${sloErrorBudgetPercent}%` },
        ]}
      />

      {isInitialSyncing ? (
        <div className="va-status-state-stack">
          <UiSurfaceState
            eyebrow="Telemetry sync"
            status="Loading"
            statusVariant="info"
            title="Refreshing operational telemetry"
            description="Collecting the latest poll and stream metrics, runtime state, and job summaries."
            tone="info"
            compact
          />
        </div>
      ) : null}

      <DashboardWorkflowContractCard moduleId="ops" />

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Reliability & Runtime</h3>
          <p className="va-muted">Live sync posture, SLO telemetry, and runtime control operations.</p>
        </header>
      <section className="va-grid">
        <div className={`va-card va-health ${isDashboardDegraded ? 'is-degraded' : 'is-healthy'}`}>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Live Sync Health</h3>
              <p className="va-muted">Track polling cadence, stream reliability, and active degradation causes.</p>
            </div>
            <UiBadge variant={isDashboardDegraded ? 'warning' : 'success'}>
              {isDashboardDegraded ? 'Degraded' : 'Healthy'}
            </UiBadge>
          </div>
          <p>
            Mode: <strong>{syncModeLabel}</strong>
          </p>
          <p>
            Poll failures: <strong>{pollFailureCount}</strong> | Bridge 5xx: <strong>{bridgeHardFailures}</strong>
            {' '}| Bridge 4xx/5xx: <strong>{bridgeSoftFailures}</strong>
          </p>
          <p>
            Data feed: <strong>{streamModeLabel}</strong> | Stream failures: <strong>{streamFailureCount}</strong>
          </p>
          <p>Last poll attempt: <strong>{lastPollLabel}</strong></p>
          <p>Last successful poll: <strong>{lastSuccessfulPollLabel}</strong></p>
          <p>Last stream event: <strong>{streamLastEventLabel}</strong></p>
          <p>Next poll scheduled: <strong>{nextPollLabel}</strong></p>
          <details className="va-drilldown">
            <summary>Degraded causes drill-down</summary>
            {degradedCauses.length === 0 ? (
              <p className="va-muted">No active degradation causes detected.</p>
            ) : (
              <ul className="va-list">
                {degradedCauses.map((cause) => (
                  <li key={`degraded-cause-${cause}`}>{cause}</li>
                ))}
              </ul>
            )}
          </details>
        </div>

        <div className="va-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>SLO Widgets</h3>
              <p className="va-muted">Watch remaining budget, action latency, and freshness without leaving ops.</p>
            </div>
            <UiBadge variant="info">{sloErrorBudgetPercent}% budget</UiBadge>
          </div>
          <p>
            Error budget remaining: <strong>{sloErrorBudgetPercent}%</strong>
          </p>
          <pre>{textBar(sloErrorBudgetPercent)}</pre>
          <p>
            p95 action latency: <strong>{sloP95ActionLatencyMs}ms</strong>
          </p>
          <p>
            Poll freshness: <strong>{pollFreshnessLabel}</strong>
          </p>
        </div>

        <div className="va-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Ops Snapshot</h3>
              <p className="va-muted">A fast read on calls, backlog, and provider readiness for the current window.</p>
            </div>
            <UiBadge variant={callFailureRate > 0 ? 'warning' : 'success'}>
              {Math.max(0, Math.min(100, Math.round(callSuccessRate)))}% success
            </UiBadge>
          </div>
          <p>
            Calls: <strong>{callCompleted}</strong> completed / <strong>{callTotal}</strong> total
          </p>
          <p>
            Call failures: <strong>{callFailed}</strong> ({callFailureRate}%)
          </p>
          <p>
            Success rate: <strong>{Math.max(0, Math.min(100, Math.round(callSuccessRate)))}%</strong>
          </p>
          <p>
            Queue backlog: <strong>{queueBacklogTotal}</strong>
          </p>
          <p>
            Provider readiness: <strong>{providerReadinessTotals.ready}/{providerReadinessTotals.total}</strong>
          </p>
          <pre>{textBar(providerReadinessPercent)}</pre>
        </div>

        {opsQaSummary ? (
          <div className="va-card">
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Post-Call QA</h3>
                <p className="va-muted">Track evaluation quality, score posture, and recurring findings after live calls.</p>
              </div>
              <UiBadge variant={opsQaSummary.passRate >= 80 ? 'success' : opsQaSummary.passRate >= 60 ? 'info' : 'warning'}>
                {opsQaSummary.passRate}% pass
              </UiBadge>
            </div>
            <p>
              Window: <strong>{opsQaSummary.windowHours}h</strong>
              {' '}| Evaluations: <strong>{opsQaSummary.total}</strong>
            </p>
            <p>
              Pass rate: <strong>{opsQaSummary.passRate}%</strong>
              {' '}({opsQaSummary.passed}/{opsQaSummary.total})
            </p>
            <p>
              Avg score: <strong>{opsQaSummary.avgScore ?? 'n/a'}</strong>
              {' '}| Scored: <strong>{opsQaSummary.scored}</strong>
            </p>
            <p>
              Insufficient transcript: <strong>{opsQaSummary.insufficientTranscript}</strong>
              {' '}| Skipped: <strong>{opsQaSummary.skipped}</strong>
            </p>
            <pre>{textBar(opsQaSummary.passRate)}</pre>
            {opsQaSummary.trendSeries.length > 0 ? (
              <>
                <p>
                  Trend bucket: <strong>{opsQaSummary.trendBucket}</strong>
                  {' '}| Points: <strong>{opsQaSummary.trendSeries.length}</strong>
                </p>
                <pre>{buildAsciiSparkline(opsQaSummary.trendSeries.map((point) => point.passRate))}</pre>
              </>
            ) : null}
            <details className="va-drilldown">
              <summary>QA trend ({opsQaSummary.trendSeries.length})</summary>
              {opsQaSummary.trendSeries.length === 0 ? (
                <p className="va-muted">No trend points available in this window.</p>
              ) : (
                <ul className="va-list">
                  {opsQaSummary.trendSeries.map((point) => (
                    <li key={`qa-trend-${point.bucket}`}>
                      <strong>{point.bucket}</strong>
                      <span>{point.passed}/{point.total} passed ({point.passRate}%)</span>
                      <span>Avg score: {point.avgScore ?? 'n/a'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
            <details className="va-drilldown">
              <summary>Top findings ({opsQaSummary.topFindings.length})</summary>
              {opsQaSummary.topFindings.length === 0 ? (
                <p className="va-muted">No recurring findings in this window.</p>
              ) : (
                <ul className="va-list">
                  {opsQaSummary.topFindings.map((finding) => (
                    <li key={`qa-finding-${finding.finding}`}>
                      <strong>{finding.finding}</strong>
                      <span>{finding.count} calls</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
            <details className="va-drilldown">
              <summary>Profile breakdown ({opsQaSummary.profileBreakdown.length})</summary>
              {opsQaSummary.profileBreakdown.length === 0 ? (
                <p className="va-muted">No profile-specific QA data yet.</p>
              ) : (
                <ul className="va-list">
                  {opsQaSummary.profileBreakdown.map((profile) => {
                    const threshold =
                      opsQaSummary.profileThresholds[profile.profile]
                      ?? opsQaSummary.profileThresholds.default
                      ?? 70;
                    const belowThreshold =
                      profile.avgScore !== null && profile.avgScore < threshold;
                    const thresholdStatus = profile.avgScore === null
                      ? 'info'
                      : belowThreshold
                        ? 'error'
                        : 'success';
                    const thresholdLabel = profile.avgScore === null
                      ? 'No score'
                      : belowThreshold
                        ? 'Below threshold'
                        : 'Within threshold';

                    return (
                      <li key={`qa-profile-${profile.profile}`}>
                        <strong>{profile.profile}</strong>
                        <span>{profile.passed}/{profile.total} passed ({profile.passRate}%)</span>
                        <span>Avg score: {profile.avgScore ?? 'n/a'}</span>
                        <span>Threshold: {threshold}</span>
                        <span className={`va-pill va-pill-${thresholdStatus}`}>{thresholdLabel}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          </div>
        ) : (
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Post-Call QA</h3>
                <p className="va-muted">Quality trends appear here once post-call reviews are being captured.</p>
              </div>
              <UiBadge variant="info">Unavailable</UiBadge>
            </div>
            <UiStatePanel
              title="QA summary unavailable"
              description="Enable and collect post-call QA evaluations to unlock quality trends."
              tone="info"
              compact
            />
          </UiCard>
        )}

        {runtimeControlsEnabled ? (
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Voice Runtime Control</h3>
                <p className="va-muted">Manage maintenance posture, canary rollout, and live runtime balance in one place.</p>
              </div>
              <UiBadge variant={runtimeIsCircuitOpen ? 'warning' : 'success'}>
                {runtimeEffectiveMode}
              </UiBadge>
            </div>
            <p>
              Effective mode: <strong>{runtimeEffectiveMode}</strong>
              {' '}| Override: <strong>{runtimeModeOverride}</strong>
            </p>
            <p>
              Canary effective: <strong>{runtimeCanaryEffective}%</strong>
              {' '}| Override: <strong>{runtimeCanaryOverrideLabel}</strong>
            </p>
            <p>
              Circuit: <strong>{runtimeIsCircuitOpen ? 'Open' : 'Closed'}</strong>
              {' '}| Forced legacy until: <strong>{runtimeForcedLegacyUntil}</strong>
            </p>
            <p>
              Active calls: <strong>{runtimeActiveTotal}</strong>
              {' '}| Legacy: <strong>{runtimeActiveLegacy}</strong>
              {' '}| Voice Agent: <strong>{runtimeActiveVoiceAgent}</strong>
            </p>
            <div className="va-inline-tools">
              <UiButton
                variant="secondary"
                disabled={busyAction.length > 0}
                onClick={() => { void enableRuntimeMaintenance(); }}
              >
                Enable Maintenance
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={busyAction.length > 0}
                onClick={() => { void disableRuntimeMaintenance(); }}
              >
                Disable Maintenance
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={busyAction.length > 0}
                onClick={() => { void refreshRuntimeStatus(); }}
              >
                Refresh Runtime
              </UiButton>
            </div>
            <div className="va-inline-tools">
              <UiInput
                inputMode="numeric"
                min={0}
                max={100}
                placeholder="Canary % (0-100)"
                value={runtimeCanaryInput}
                onChange={(event) => setRuntimeCanaryInput(event.target.value)}
              />
              <UiButton
                variant="secondary"
                disabled={busyAction.length > 0}
                onClick={() => { void applyRuntimeCanary(); }}
              >
                Apply Canary
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={busyAction.length > 0}
                onClick={() => { void clearRuntimeCanary(); }}
              >
                Clear Canary
              </UiButton>
            </div>
          </UiCard>
        ) : (
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Voice Runtime Control</h3>
                <p className="va-muted">Runtime controls stay hidden until maintenance and canary tools are enabled.</p>
              </div>
              <UiBadge variant="warning">Disabled</UiBadge>
            </div>
            <UiStatePanel
              title="Runtime controls disabled"
              description="Enable the runtime_controls feature flag to manage maintenance and canary rollout."
              tone="warning"
              compact
            />
          </UiCard>
        )}

        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Activity Timeline</h3>
              <p className="va-muted">Recent actions, recoveries, and runtime transitions in chronological order.</p>
            </div>
            <UiBadge variant={activityLog.length > 0 ? 'meta' : 'info'}>
              {activityLog.length > 0 ? `${activityLog.length} events` : 'Idle'}
            </UiBadge>
          </div>
          {activityLog.length === 0 ? (
            <UiStatePanel
              title="No activity yet"
              description="Recent action attempts and system transitions will appear here."
              tone="info"
              compact
            />
          ) : (
            <ul className="va-list va-list-activity">
              {activityLog.map((entry: ActivityEntry) => (
                <li key={entry.id}>
                  <span className={`va-pill va-pill-${entry.status}`}>{entry.status}</span>
                  <strong>{entry.title}</strong>
                  <span>{entry.detail}</span>
                  <span>{formatTime(entry.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </UiCard>
      </section>
      </section>

      {providerCardsEnabled ? (
        <section className="va-section-block">
          <header className="va-section-header">
            <h3 className="va-section-title">Provider Readiness</h3>
            <p className="va-muted">Channel-level provider status and preflight control actions.</p>
          </header>
          <section className="va-grid">
            {renderProviderSection('call')}
            {renderProviderSection('sms')}
            {renderProviderSection('email')}
          </section>
        </section>
      ) : null}

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Messaging Throughput</h3>
          <p className="va-muted">Bulk SMS and email execution trends across the latest 24-hour window.</p>
        </header>
        <section className="va-grid">
        <div className="va-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>SMS Bulk Status (24h)</h3>
              <p className="va-muted">Latest recipient throughput and failure posture for the SMS lane.</p>
            </div>
            <UiBadge variant={smsFailed > 0 ? 'warning' : 'success'}>
              {smsProcessedPercent}% processed
            </UiBadge>
          </div>
          <p>Total recipients: <strong>{smsTotalRecipients}</strong></p>
          <p>Successful: <strong>{smsSuccess}</strong> | Failed: <strong>{smsFailed}</strong></p>
          <pre>{textBar(smsProcessedPercent)}</pre>
        </div>

        <div className="va-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Email Bulk Status (24h)</h3>
              <p className="va-muted">Monitor processed volume, delivery quality, and suppression pressure.</p>
            </div>
            <UiBadge variant={emailFailed > 0 || emailBounced > 0 ? 'warning' : 'success'}>
              {emailDeliveredPercent}% delivered
            </UiBadge>
          </div>
          <p>Total recipients: <strong>{emailTotalRecipients}</strong></p>
          <p>Sent: <strong>{emailSent}</strong> | Failed: <strong>{emailFailed}</strong></p>
          <p>Delivered: <strong>{emailDelivered}</strong></p>
          <p>
            Bounced: <strong>{emailBounced}</strong> | Complaints: <strong>{emailComplained}</strong>
            {' '}| Suppressed: <strong>{emailSuppressed}</strong>
          </p>
          <pre>{textBar(emailProcessedPercent)}</pre>
          <pre>{textBar(emailDeliveredPercent)}</pre>
        </div>
      </section>
      </section>

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Logs & Recovery</h3>
          <p className="va-muted">Recent operational history and dead-letter replay workflows.</p>
        </header>
        <section className="va-grid">
        <div className="va-card">
          <h3>Call Log Explorer</h3>
          <p className="va-muted">
            Search calls, inspect call detail payloads, and review recent state transitions.
          </p>
          <div className="va-inline-tools">
            <UiInput
              value={callExplorerQuery}
              placeholder="Search by SID, phone, or status"
              onChange={(event) => setCallExplorerQuery(event.target.value)}
            />
            <UiButton
              type="button"
              variant="secondary"
              disabled={controlsBusy}
              onClick={() => { void loadCallExplorerRows(); }}
            >
              {callExplorerQuery.trim().length >= 2 ? 'Search' : 'Load Recent'}
            </UiButton>
          </div>
          <div className="va-inline-tools">
            <UiInput
              value={callExplorerCallSid}
              placeholder="Call SID"
              onChange={(event) => setCallExplorerCallSid(event.target.value)}
            />
            <UiButton
              type="button"
              variant="secondary"
              disabled={controlsBusy || !callExplorerCallSid.trim()}
              onClick={() => { void loadCallExplorerDetails(); }}
            >
              Details
            </UiButton>
            <UiButton
              type="button"
              variant="secondary"
              disabled={controlsBusy || !callExplorerCallSid.trim()}
              onClick={() => { void loadCallExplorerEvents(); }}
            >
              Events
            </UiButton>
          </div>
          {controlsBusy || callExplorerError ? (
            <div className="va-status-state-stack">
              {controlsBusy ? (
                <UiSurfaceState
                  eyebrow="Explorer state"
                  status="In progress"
                  statusVariant="info"
                  title="Call explorer request is running"
                  description={`Running ${activeActionLabel || 'request'}...`}
                  tone="info"
                  compact
                  cardTone="subcard"
                />
              ) : null}
              {callExplorerError ? (
                <UiSurfaceState
                  eyebrow="Explorer state"
                  status="Needs attention"
                  statusVariant="error"
                  title="Call explorer needs attention"
                  description={callExplorerError}
                  tone="error"
                  compact
                  cardTone="subcard"
                />
              ) : null}
            </div>
          ) : null}
          <div className="va-inline-tools">
            <UiCard tone="subcard">
              <h4>Search Results</h4>
              {callExplorerRows.length === 0 ? (
                <p className="va-muted">No rows loaded yet.</p>
              ) : (
                <ul className="va-list">
                  {callExplorerRows.slice(0, 10).map((row, index) => {
                    const callSid = toText(row.call_sid, `call-${index + 1}`);
                    return (
                      <li key={`call-explorer-row-${callSid}-${index}`}>
                        <button
                          type="button"
                          className="va-chip"
                          onClick={() => setCallExplorerCallSid(callSid)}
                        >
                          {callSid}
                        </button>
                        <span>{toText(row.phone_number, 'n/a')}</span>
                        <span>{toText(row.status_normalized, toText(row.status, 'unknown'))}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </UiCard>
            <UiCard tone="subcard">
              <h4>Call Details</h4>
              {callExplorerDetails ? (
                <ul className="va-list">
                  <li><strong>SID:</strong> {toText(callExplorerDetails.call_sid, callExplorerCallSid || 'n/a')}</li>
                  <li><strong>Status:</strong> {toText(callExplorerDetails.status, 'unknown')}</li>
                  <li><strong>Phone:</strong> {toText(callExplorerDetails.phone_number, 'n/a')}</li>
                  <li><strong>Duration:</strong> {toInt(callExplorerDetails.duration)}s</li>
                  <li><strong>Started:</strong> {formatTime(callExplorerDetails.created_at)}</li>
                  <li><strong>Summary:</strong> {toText(callExplorerDetails.call_summary, 'n/a')}</li>
                </ul>
              ) : (
                <p className="va-muted">Load a call SID to view details.</p>
              )}
            </UiCard>
            <UiCard tone="subcard">
              <h4>Recent Events</h4>
              {callExplorerRecentStates.length === 0 ? (
                <p className="va-muted">No events loaded.</p>
              ) : (
                <ul className="va-list">
                  {callExplorerRecentStates.map((state, index) => (
                    <li key={`call-explorer-state-${index}`}>
                      <span>{toText(state.state, 'event')}</span>
                      <span>{formatTime(state.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </UiCard>
          </div>
        </div>

        <div className="va-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Recent Call Logs</h3>
              <p className="va-muted">Latest persisted calls with runtime, transcript, and outcome context in one feed.</p>
            </div>
            <UiBadge variant={callLogs.length > 0 ? 'success' : 'info'}>
              {callLogs.length > 0 ? `${callLogs.length} visible` : 'Feed idle'}
            </UiBadge>
          </div>
          <p>
            Showing <strong>{callLogs.length}</strong> of <strong>{callLogsTotal}</strong> recent calls.
          </p>
          {callLogs.length === 0 ? <p className="va-muted">No recent calls available.</p> : null}
          <ul className="va-list">
            {callLogs.slice(0, 10).map((row: CallLogRow, index: number) => {
              const callSid = toText(row.call_sid, `call-${index + 1}`);
              return (
                <li key={`call-log-${callSid}-${index}`}>
                  <strong>{callSid}</strong>
                  <span>
                    {toText(row.direction, 'unknown')} | {toText(row.status_normalized, toText(row.status, 'unknown'))}
                  </span>
                  <span>
                    Runtime: {toText(row.voice_runtime, 'unknown')}
                    {' '}| Duration: {toInt(row.duration)}s
                    {' '}| Transcripts: {toInt(row.transcript_count)}
                  </span>
                  <span>
                    Number: {toText(row.phone_number, 'n/a')}
                    {' '}| Ended: {toText(row.ended_reason, 'n/a')}
                  </span>
                  <span>{formatTime(row.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="va-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Email Jobs</h3>
              <p className="va-muted">Track the latest bulk-email jobs, send progress, and delivery posture.</p>
            </div>
            <UiBadge variant={emailJobs.length > 0 ? 'meta' : 'info'}>
              {emailJobs.length > 0 ? `${emailJobs.length} jobs` : 'No jobs'}
            </UiBadge>
          </div>
          {emailJobs.length === 0 ? <p className="va-muted">No recent jobs.</p> : null}
          <ul className="va-list">
            {emailJobs.slice(0, 8).map((job: EmailJob, index: number) => {
              const jobId = toText(job.job_id, `job-${index + 1}`);
              const jobStatus = toText(job.status);
              const jobKey = `email-job-${jobId}-${index}`;
              return (
                <li key={jobKey}>
                  <strong>{jobId}</strong>
                  <span>{jobStatus}</span>
                  <span>{toInt(job.sent)}/{toInt(job.total)} sent</span>
                  <span>
                    Failed: {toInt(job.failed)} | Delivered: {toInt(job.delivered)} | Bounced: {toInt(job.bounced)}
                  </span>
                  <span>{formatTime(job.updated_at || job.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>DLQ: Call Jobs</h3>
              <p className="va-muted">Review failed call work items and replay them from the recovery queue.</p>
            </div>
            <UiBadge variant={callDlq.length > 0 ? 'warning' : 'success'}>
              {toInt(dlqPayload.call_open, callDlq.length)} open
            </UiBadge>
          </div>
          {callDlq.length === 0 ? <p className="va-muted">No open call DLQ entries.</p> : null}
          <ul className="va-list">
            {callDlq.map((row: DlqCallRow) => {
              const rowId = toInt(row.id);
              const handleReplay = (): void => {
                void runAction(
                  DASHBOARD_ACTION_CONTRACTS.DLQ_CALL_REPLAY,
                  { id: rowId },
                  {
                    confirmText: `Replay call DLQ #${rowId}?`,
                    successMessage: `Replay requested for call DLQ #${rowId}.`,
                  },
                );
              };
              return (
                <li key={`call-dlq-${rowId}`}>
                  <span>#{rowId} {toText(row.job_type, 'job')}</span>
                  <span>Replays: {toInt(row.replay_count)}</span>
                  <UiButton
                    variant="secondary"
                    disabled={busyAction.length > 0 || rowId <= 0}
                    onClick={handleReplay}
                  >
                    Replay
                  </UiButton>
                </li>
              );
            })}
          </ul>
        </UiCard>

        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>DLQ: Email</h3>
              <p className="va-muted">Inspect blocked email work items and trigger replay when the cause is cleared.</p>
            </div>
            <UiBadge variant={emailDlq.length > 0 ? 'warning' : 'success'}>
              {toInt(dlqPayload.email_open, emailDlq.length)} open
            </UiBadge>
          </div>
          {emailDlq.length === 0 ? <p className="va-muted">No open email DLQ entries.</p> : null}
          <ul className="va-list">
            {emailDlq.map((row: DlqEmailRow) => {
              const rowId = toInt(row.id);
              const handleReplay = (): void => {
                void runAction(
                  DASHBOARD_ACTION_CONTRACTS.DLQ_EMAIL_REPLAY,
                  { id: rowId },
                  {
                    confirmText: `Replay email DLQ #${rowId}?`,
                    successMessage: `Replay requested for email DLQ #${rowId}.`,
                  },
                );
              };
              return (
                <li key={`email-dlq-${rowId}`}>
                  <span>#{rowId} msg:{toText(row.message_id)}</span>
                  <span>Reason: {toText(row.reason)}</span>
                  <UiButton
                    variant="secondary"
                    disabled={busyAction.length > 0 || rowId <= 0}
                    onClick={handleReplay}
                  >
                    Replay
                  </UiButton>
                </li>
              );
            })}
          </ul>
        </UiCard>
      </section>
      </section>

      {!hasMeaningfulData ? (
        <div className="va-status-state-stack">
          <UiSurfaceState
            eyebrow="Workspace state"
            status="Awaiting traffic"
            statusVariant="info"
            title="No recent operational activity"
            description="The feed is connected. Metrics and events will populate as live traffic and background jobs are processed."
            tone="info"
            compact
            cardTone="empty"
          />
        </div>
      ) : null}
    </>
  );
}
