export type DashboardReliabilityState = 'healthy' | 'degraded' | 'stale' | 'blocked' | 'offline';

export type DashboardReliabilityCopy = {
  label: string;
  message: string;
};

const DASHBOARD_RELIABILITY_COPY: Record<DashboardReliabilityState, DashboardReliabilityCopy> = {
  healthy: {
    label: 'Healthy',
    message: 'Sync pipeline is healthy and data is current.',
  },
  degraded: {
    label: 'Degraded',
    message: 'Sync is running with failures. Some module data may be incomplete.',
  },
  stale: {
    label: 'Stale',
    message: 'Latest successful poll is too old. Data may be out of date.',
  },
  blocked: {
    label: 'Blocked',
    message: 'Session is blocked by auth policy. Re-authenticate from Telegram to continue.',
  },
  offline: {
    label: 'Offline',
    message: 'Network is offline. Live updates are unavailable until connection returns.',
  },
};

export type ResolveDashboardReliabilityStateOptions = {
  sessionBlocked: boolean;
  pollFailureCount: number;
  pollDegradedFailures: number;
  bridgeHardFailures: number;
  bridgeSoftFailures: number;
  error: string;
  hasBootstrapData: boolean;
  lastSuccessfulPollAt: number | null;
  pollingPaused: boolean;
  staleAfterMs?: number;
  isOffline?: boolean;
};

export type DashboardReliabilityStateResult = {
  state: DashboardReliabilityState;
  isDegraded: boolean;
  causes: string[];
  pollFreshnessSeconds: number;
};

export function getDashboardReliabilityCopy(state: DashboardReliabilityState): DashboardReliabilityCopy {
  return DASHBOARD_RELIABILITY_COPY[state];
}

export function resolveDashboardReliabilityState({
  sessionBlocked,
  pollFailureCount,
  pollDegradedFailures,
  bridgeHardFailures,
  bridgeSoftFailures,
  error,
  hasBootstrapData,
  lastSuccessfulPollAt,
  pollingPaused,
  staleAfterMs = 90000,
  isOffline,
}: ResolveDashboardReliabilityStateOptions): DashboardReliabilityStateResult {
  const pollFreshnessSeconds = lastSuccessfulPollAt
    ? Math.max(0, Math.floor((Date.now() - lastSuccessfulPollAt) / 1000))
    : -1;

  const staleByAge = !pollingPaused
    && lastSuccessfulPollAt !== null
    && Number.isFinite(lastSuccessfulPollAt)
    && (Date.now() - lastSuccessfulPollAt) > Math.max(30000, staleAfterMs);

  const offline = typeof isOffline === 'boolean'
    ? isOffline
    : (typeof navigator !== 'undefined' ? navigator.onLine === false : false);

  let state: DashboardReliabilityState = 'healthy';
  if (sessionBlocked) {
    state = 'blocked';
  } else if (offline) {
    state = 'offline';
  } else if (staleByAge) {
    state = 'stale';
  } else if (
    pollFailureCount >= pollDegradedFailures
    || bridgeHardFailures > 0
    || (Boolean(error) && !hasBootstrapData)
  ) {
    state = 'degraded';
  }

  const causes = [
    sessionBlocked ? 'Session auth blocked' : '',
    offline ? 'Network offline' : '',
    staleByAge ? `Poll data stale ${pollFreshnessSeconds}s` : '',
    pollFailureCount >= pollDegradedFailures ? `Poll failures ${pollFailureCount}` : '',
    bridgeHardFailures > 0 ? `Bridge hard failures ${bridgeHardFailures}` : '',
    bridgeSoftFailures > 0 ? `Bridge soft failures ${bridgeSoftFailures}` : '',
    (Boolean(error) && !hasBootstrapData) ? 'Bootstrap data unavailable' : '',
  ].filter(Boolean);

  return {
    state,
    isDegraded: state !== 'healthy',
    causes,
    pollFreshnessSeconds,
  };
}
