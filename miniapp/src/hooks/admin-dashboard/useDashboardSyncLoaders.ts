import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ActivityStatus } from '@/hooks/admin-dashboard/useDashboardActivityFeed';
import {
  asRecord,
} from '@/services/admin-dashboard/dashboardPrimitives';
import { setDashboardSupportedActions } from '@/services/admin-dashboard/dashboardActionGuards';
import {
  isSessionBootstrapBlockingCode,
} from '@/services/admin-dashboard/dashboardTransport';
import {
  validateBootstrapPayload,
  validatePollPayload,
  validateStreamPayload,
} from '@/services/admin-dashboard/dashboardApiContracts';
import {
  getDashboardErrorCode,
  isAbortError,
} from '@/pages/AdminDashboard/dashboardPayloadHelpers';
import type {
  CallScriptsPayload,
  DashboardApiPayload,
  MiniAppAuditPayload,
  MiniAppIncidentsPayload,
  MiniAppUsersPayload,
} from '@/pages/AdminDashboard/dashboardPayloadTypes';

type PushActivity = (status: ActivityStatus, title: string, detail: string) => void;

export type DashboardSyncFailureDiagnostics = {
  failureClass: string;
  endpoint: string;
  code: string;
  correlationId: string;
  traceHint: string;
  retries: number;
};

export type DashboardAuthTelemetry = {
  expiryEvents: number;
  recoveryEvents: number;
  authDegraded: boolean;
  lastExpiryAt: number | null;
  lastRecoveryAt: number | null;
  lastExpiryCode: string;
  lastFailureClass: string;
  lastRecoverySource: string;
};

export const DEFAULT_DASHBOARD_AUTH_TELEMETRY: DashboardAuthTelemetry = {
  expiryEvents: 0,
  recoveryEvents: 0,
  authDegraded: false,
  lastExpiryAt: null,
  lastRecoveryAt: null,
  lastExpiryCode: 'n/a',
  lastFailureClass: 'none',
  lastRecoverySource: 'none',
};

type RetryAnnotatedError = Error & {
  dashboardRetriesUsed?: number;
};

const MAX_READ_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;
const RETRY_JITTER_RATIO = 0.35;
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type UseDashboardSyncLoadersOptions = {
  request: <T,>(path: string, options?: RequestInit) => Promise<T>;
  pushActivity: PushActivity;
  stateEpochRef: MutableRefObject<number>;
  bootstrapRequestSeqRef: MutableRefObject<number>;
  pollRequestSeqRef: MutableRefObject<number>;
  bootstrapAbortRef: MutableRefObject<AbortController | null>;
  pollAbortRef: MutableRefObject<AbortController | null>;
  pollFailureNotedRef: MutableRefObject<boolean>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setPollFailureCount: Dispatch<SetStateAction<number>>;
  setRefreshFailureDiagnostics: Dispatch<SetStateAction<DashboardSyncFailureDiagnostics | null>>;
  setAuthTelemetry: Dispatch<SetStateAction<DashboardAuthTelemetry>>;
  setBootstrap: Dispatch<SetStateAction<DashboardApiPayload | null>>;
  setPollPayload: Dispatch<SetStateAction<DashboardApiPayload | null>>;
  setLastPollAt: Dispatch<SetStateAction<number | null>>;
  setLastSuccessfulPollAt: Dispatch<SetStateAction<number | null>>;
  setUsersSnapshot: Dispatch<SetStateAction<MiniAppUsersPayload | null>>;
  setAuditSnapshot: Dispatch<SetStateAction<MiniAppAuditPayload | null>>;
  setIncidentsSnapshot: Dispatch<SetStateAction<MiniAppIncidentsPayload | null>>;
  setCallScriptsSnapshot: Dispatch<SetStateAction<CallScriptsPayload | null>>;
  setRuntimeCanaryInput: Dispatch<SetStateAction<string>>;
};

type UseDashboardSyncLoadersResult = {
  loadBootstrap: () => Promise<void>;
  loadPoll: () => Promise<boolean>;
  applyStreamPayload: (raw: unknown) => boolean;
};

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function mergeDashboardPayload(
  previous: DashboardApiPayload | null,
  next: DashboardApiPayload,
): DashboardApiPayload {
  const prevPayload = asRecord(previous) as DashboardApiPayload;
  const prevDashboard = asRecord(prevPayload.dashboard);
  const nextDashboard = asRecord(next.dashboard);
  return {
    ...prevPayload,
    ...next,
    dashboard: Object.keys(nextDashboard).length > 0
      ? {
        ...prevDashboard,
        ...nextDashboard,
      }
      : prevPayload.dashboard,
  };
}

function getRetryableHttpStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const status = Number((error as { httpStatus?: unknown }).httpStatus);
  return Number.isFinite(status) ? status : null;
}

function primitiveString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

function trimmedPrimitiveString(value: unknown): string {
  return primitiveString(value).trim();
}

function extractSupportedActions(payload: DashboardApiPayload): unknown {
  const dashboardPayload = asRecord(payload.dashboard);
  return payload.supported_actions ?? dashboardPayload.supported_actions;
}

function hasSupportedActions(payload: DashboardApiPayload): boolean {
  const dashboardPayload = asRecord(payload.dashboard);
  return Object.prototype.hasOwnProperty.call(payload, 'supported_actions')
    || Object.prototype.hasOwnProperty.call(dashboardPayload, 'supported_actions');
}

function isNetworkLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const detail = error.message.toLowerCase();
  if (!detail) return false;
  return detail.includes('failed to fetch')
    || detail.includes('networkerror')
    || detail.includes('network error')
    || detail.includes('timeout')
    || detail.includes('temporarily unavailable');
}

function shouldRetryReadFailure(error: unknown): boolean {
  if (isAbortError(error)) return false;
  const errorCode = getDashboardErrorCode(error);
  if (isSessionBootstrapBlockingCode(errorCode)) return false;
  const httpStatus = getRetryableHttpStatus(error);
  if (httpStatus !== null) {
    return RETRYABLE_HTTP_STATUSES.has(httpStatus);
  }
  return isNetworkLikeError(error);
}

function withRetryMetadata(error: unknown, retriesUsed: number): Error {
  const fallbackMessage = typeof error === 'string' && error.trim().length > 0
    ? error
    : 'Request failed';
  const normalized = (error instanceof Error ? error : new Error(fallbackMessage)) as RetryAnnotatedError;
  normalized.dashboardRetriesUsed = retriesUsed;
  return normalized;
}

function retriesUsedFromError(error: unknown): number {
  if (!(error instanceof Error)) return 0;
  const retriesUsed = Number((error as RetryAnnotatedError).dashboardRetriesUsed);
  return Number.isFinite(retriesUsed) && retriesUsed > 0 ? retriesUsed : 0;
}

function withRetryDetail(detail: string, retriesUsed: number): string {
  if (retriesUsed <= 0) return detail;
  const label = retriesUsed === 1 ? 'retry' : 'retries';
  return `${detail} (${retriesUsed} ${label} used)`;
}

function classifyRefreshFailureCode(code: string): string {
  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) return 'sync-runtime';
  if (normalizedCode === 'miniapp_init_data_expired') return 'session-init-data';
  if (normalizedCode === 'miniapp_token_expired') return 'session-token';
  if (normalizedCode.startsWith('miniapp_')) return 'session-auth';
  if (normalizedCode.startsWith('http_')) return 'http';
  return 'sync-runtime';
}

function isSessionFailureClass(failureClass: string): boolean {
  const normalized = failureClass.trim().toLowerCase();
  return normalized.startsWith('session-');
}

function resolveErrorTraceHint(error: unknown, endpoint: string, requestSeq: number): string {
  if (error instanceof Error) {
    const traceHint = trimmedPrimitiveString((error as { traceHint?: unknown }).traceHint);
    if (traceHint) {
      return traceHint;
    }
    const requestId = trimmedPrimitiveString((error as { requestId?: unknown }).requestId);
    if (requestId) {
      return requestId.slice(-16);
    }
    const correlationId = trimmedPrimitiveString((error as { correlationId?: unknown }).correlationId);
    if (correlationId) {
      return correlationId.slice(-16);
    }
  }
  const endpointLabel = endpoint.replace('/miniapp/', '').replace(/\//g, '-');
  return `${endpointLabel}:${requestSeq}`;
}

function resolveErrorCorrelationId(error: unknown): string {
  if (!(error instanceof Error)) return 'n/a';
  const correlationId = trimmedPrimitiveString((error as { correlationId?: unknown }).correlationId);
  if (correlationId) return correlationId.slice(-24);
  const requestId = trimmedPrimitiveString((error as { requestId?: unknown }).requestId);
  if (requestId) return requestId.slice(-24);
  const traceHint = trimmedPrimitiveString((error as { traceHint?: unknown }).traceHint);
  if (traceHint) return traceHint.slice(-24);
  return 'n/a';
}

function buildRefreshFailureDiagnostics(options: {
  endpoint: string;
  requestSeq: number;
  errorCode: string;
  retriesUsed: number;
  error: unknown;
}): DashboardSyncFailureDiagnostics {
  const normalizedCode = options.errorCode.trim().toLowerCase();
  return {
    failureClass: classifyRefreshFailureCode(normalizedCode),
    endpoint: options.endpoint,
    code: normalizedCode || 'unknown',
    correlationId: resolveErrorCorrelationId(options.error),
    traceHint: resolveErrorTraceHint(options.error, options.endpoint, options.requestSeq),
    retries: Math.max(0, options.retriesUsed),
  };
}

async function waitForRetryDelay(signal: AbortSignal, delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = (): void => {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function requestWithBoundedReadRetry<T>(
  execute: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let retriesUsed = 0;
  for (;;) {
    try {
      return await execute();
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (!shouldRetryReadFailure(error) || retriesUsed >= MAX_READ_RETRIES) {
        throw withRetryMetadata(error, retriesUsed);
      }
      retriesUsed += 1;
      const backoffMs = RETRY_BASE_DELAY_MS * (2 ** (retriesUsed - 1));
      const jitterMs = Math.floor(Math.random() * Math.max(1, Math.round(backoffMs * RETRY_JITTER_RATIO)));
      await waitForRetryDelay(signal, backoffMs + jitterMs);
    }
  }
}

export function useDashboardSyncLoaders({
  request,
  pushActivity,
  stateEpochRef,
  bootstrapRequestSeqRef,
  pollRequestSeqRef,
  bootstrapAbortRef,
  pollAbortRef,
  pollFailureNotedRef,
  setLoading,
  setError,
  setPollFailureCount,
  setRefreshFailureDiagnostics,
  setAuthTelemetry,
  setBootstrap,
  setPollPayload,
  setLastPollAt,
  setLastSuccessfulPollAt,
  setUsersSnapshot,
  setAuditSnapshot,
  setIncidentsSnapshot,
  setCallScriptsSnapshot,
  setRuntimeCanaryInput,
}: UseDashboardSyncLoadersOptions): UseDashboardSyncLoadersResult {
  const markAuthExpiry = useCallback((errorCode: string, failureClass: string): void => {
    const normalizedCode = errorCode.trim().toLowerCase() || 'unknown';
    const normalizedFailureClass = failureClass.trim().toLowerCase() || classifyRefreshFailureCode(normalizedCode);
    setAuthTelemetry((prev) => ({
      ...prev,
      authDegraded: true,
      expiryEvents: prev.expiryEvents + 1,
      lastExpiryAt: Date.now(),
      lastExpiryCode: normalizedCode,
      lastFailureClass: normalizedFailureClass,
    }));
  }, [setAuthTelemetry]);

  const markAuthRecovery = useCallback((source: string): void => {
    setAuthTelemetry((prev) => {
      if (!prev.authDegraded) return prev;
      return {
        ...prev,
        authDegraded: false,
        recoveryEvents: prev.recoveryEvents + 1,
        lastRecoveryAt: Date.now(),
        lastFailureClass: 'none',
        lastRecoverySource: source,
      };
    });
  }, [setAuthTelemetry]);

  const loadBootstrap = useCallback(async (): Promise<void> => {
    const requestSeq = bootstrapRequestSeqRef.current + 1;
    bootstrapRequestSeqRef.current = requestSeq;
    const requestEpoch = stateEpochRef.current + 1;
    stateEpochRef.current = requestEpoch;
    if (bootstrapAbortRef.current) {
      bootstrapAbortRef.current.abort();
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
    }
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;
    setLoading(true);
    setError('');
    // Reset any prior server allow-list so a fresh bootstrap owns the action contract.
    setDashboardSupportedActions(null);
    try {
      const rawPayload = asRecord(
        await requestWithBoundedReadRetry(
          () => request<DashboardApiPayload | null>('/miniapp/bootstrap', {
            signal: controller.signal,
          }),
          controller.signal,
        ),
      );
      const bootstrapValidation = validateBootstrapPayload(rawPayload);
      if (!bootstrapValidation.ok) {
        throw new Error(bootstrapValidation.error);
      }
      if (
        bootstrapRequestSeqRef.current !== requestSeq
        || stateEpochRef.current !== requestEpoch
      ) {
        return;
      }
      const payload = bootstrapValidation.payload as DashboardApiPayload;
      if (hasSupportedActions(payload)) {
        setDashboardSupportedActions(extractSupportedActions(payload));
      }
      const now = Date.now();
      setBootstrap(payload);
      setPollPayload(payload);
      setLastPollAt(now);
      setLastSuccessfulPollAt(now);
      setPollFailureCount(0);
      setRefreshFailureDiagnostics(null);
      markAuthRecovery('bootstrap');
      setUsersSnapshot(payload.dashboard?.users || payload.users || null);
      setAuditSnapshot(payload.dashboard?.audit || payload.audit || null);
      setIncidentsSnapshot(payload.dashboard?.incidents || payload.incidents || null);
      setCallScriptsSnapshot(payload.dashboard?.call_scripts || payload.call_scripts || null);
      const runtimePayload = asRecord(payload.dashboard?.voice_runtime || payload.voice_runtime || {});
      const runtime = asRecord(runtimePayload.runtime);
      const overrideCanary = Number(runtime.canary_percent_override);
      if (Number.isFinite(overrideCanary)) {
        setRuntimeCanaryInput(String(Math.max(0, Math.min(100, Math.round(overrideCanary)))));
      }
      pushActivity('success', 'Dashboard synced', 'Bootstrap data loaded.');
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      if (
        bootstrapRequestSeqRef.current !== requestSeq
        || stateEpochRef.current !== requestEpoch
      ) {
        return;
      }
      setPollFailureCount((prev) => prev + 1);
      const errorCodeFromError = getDashboardErrorCode(err);
      const blockedBySession = isSessionBootstrapBlockingCode(errorCodeFromError);
      const retriesUsed = retriesUsedFromError(err);
      const detail = err instanceof Error ? err.message : (trimmedPrimitiveString(err) || 'Request failed');
      const detailWithRetry = withRetryDetail(detail, retriesUsed);
      if (blockedBySession) {
        setRefreshFailureDiagnostics(null);
        setError('');
        markAuthExpiry(errorCodeFromError, classifyRefreshFailureCode(errorCodeFromError));
        return;
      }
      const diagnostics = buildRefreshFailureDiagnostics({
        endpoint: '/miniapp/bootstrap',
        requestSeq,
        errorCode: errorCodeFromError,
        retriesUsed,
        error: err,
      });
      setRefreshFailureDiagnostics(diagnostics);
      if (isSessionFailureClass(diagnostics.failureClass)) {
        markAuthExpiry(errorCodeFromError, diagnostics.failureClass);
      }
      setError(detailWithRetry);
      pushActivity('error', 'Bootstrap failed', detailWithRetry);
    } finally {
      if (bootstrapAbortRef.current === controller) {
        bootstrapAbortRef.current = null;
      }
      if (
        bootstrapRequestSeqRef.current === requestSeq
        && stateEpochRef.current === requestEpoch
      ) {
        setLoading(false);
      }
    }
  }, [
    bootstrapAbortRef,
    bootstrapRequestSeqRef,
    pollAbortRef,
    pushActivity,
    request,
    setAuditSnapshot,
    setBootstrap,
    setCallScriptsSnapshot,
    setError,
    setIncidentsSnapshot,
    setLastPollAt,
    setLastSuccessfulPollAt,
    setLoading,
    setPollFailureCount,
    setPollPayload,
    setRefreshFailureDiagnostics,
    markAuthExpiry,
    markAuthRecovery,
    setRuntimeCanaryInput,
    setUsersSnapshot,
    stateEpochRef,
  ]);

  const loadPoll = useCallback(async (): Promise<boolean> => {
    const requestSeq = pollRequestSeqRef.current + 1;
    pollRequestSeqRef.current = requestSeq;
    const requestEpoch = stateEpochRef.current;
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
    }
    const controller = new AbortController();
    pollAbortRef.current = controller;
    const startedAt = Date.now();
    setLastPollAt(startedAt);
    try {
      const rawPayload = asRecord(
        await requestWithBoundedReadRetry(
          () => request<DashboardApiPayload | null>('/miniapp/jobs/poll', {
            signal: controller.signal,
          }),
          controller.signal,
        ),
      );
      const pollValidation = validatePollPayload(rawPayload);
      if (!pollValidation.ok) {
        throw new Error(pollValidation.error);
      }
      if (
        pollRequestSeqRef.current !== requestSeq
        || stateEpochRef.current !== requestEpoch
      ) {
        return false;
      }
      const payload = pollValidation.payload as DashboardApiPayload;
      if (hasSupportedActions(payload)) {
        setDashboardSupportedActions(extractSupportedActions(payload));
      }
      setError('');
      setPollPayload(payload);
      setPollFailureCount(0);
      setRefreshFailureDiagnostics(null);
      markAuthRecovery('poll');
      setLastSuccessfulPollAt(Date.now());
      if (payload.users) {
        setUsersSnapshot(payload.users);
      }
      if (payload.audit) {
        setAuditSnapshot(payload.audit);
      }
      if (payload.incidents) {
        setIncidentsSnapshot(payload.incidents);
      }
      if (pollFailureNotedRef.current) {
        pushActivity('success', 'Live sync recovered', 'Polling resumed successfully.');
      }
      pollFailureNotedRef.current = false;
      return true;
    } catch (err) {
      if (isAbortError(err)) {
        return false;
      }
      if (
        pollRequestSeqRef.current !== requestSeq
        || stateEpochRef.current !== requestEpoch
      ) {
        return false;
      }
      setPollFailureCount((prev) => prev + 1);
      const errorCodeFromError = getDashboardErrorCode(err);
      const blockedBySession = isSessionBootstrapBlockingCode(errorCodeFromError);
      const retriesUsed = retriesUsedFromError(err);
      const detail = err instanceof Error ? err.message : (trimmedPrimitiveString(err) || 'Request failed');
      const detailWithRetry = withRetryDetail(detail, retriesUsed);
      if (blockedBySession) {
        setRefreshFailureDiagnostics(null);
        setError('');
        markAuthExpiry(errorCodeFromError, classifyRefreshFailureCode(errorCodeFromError));
        pollFailureNotedRef.current = false;
        return false;
      }
      const diagnostics = buildRefreshFailureDiagnostics({
        endpoint: '/miniapp/jobs/poll',
        requestSeq,
        errorCode: errorCodeFromError,
        retriesUsed,
        error: err,
      });
      setRefreshFailureDiagnostics(diagnostics);
      if (isSessionFailureClass(diagnostics.failureClass)) {
        markAuthExpiry(errorCodeFromError, diagnostics.failureClass);
      }
      setError(detailWithRetry);
      if (!pollFailureNotedRef.current) {
        pushActivity('error', 'Live sync degraded', detailWithRetry);
      }
      pollFailureNotedRef.current = true;
      return false;
    } finally {
      if (pollAbortRef.current === controller) {
        pollAbortRef.current = null;
      }
    }
  }, [
    pollAbortRef,
    pollFailureNotedRef,
    pollRequestSeqRef,
    pushActivity,
    request,
    setAuditSnapshot,
    setError,
    setIncidentsSnapshot,
    setLastPollAt,
    setLastSuccessfulPollAt,
    setPollFailureCount,
    setPollPayload,
    setRefreshFailureDiagnostics,
    markAuthExpiry,
    markAuthRecovery,
    setUsersSnapshot,
    stateEpochRef,
  ]);

  const applyStreamPayload = useCallback((raw: unknown): boolean => {
    const envelope = asRecord(raw);
    const candidate = asRecord(envelope.payload ?? envelope.data ?? raw);
    const streamValidation = validateStreamPayload(candidate);
    if (!streamValidation.ok) {
      return false;
    }
    const nextPayload = streamValidation.payload as DashboardApiPayload;
    if (hasSupportedActions(nextPayload)) {
      setDashboardSupportedActions(extractSupportedActions(nextPayload));
    }
    setPollPayload((prev) => mergeDashboardPayload(prev, nextPayload));
    setLastSuccessfulPollAt(Date.now());
    setPollFailureCount(0);
    setRefreshFailureDiagnostics(null);
    markAuthRecovery('stream');
    setError('');

    const dashboardFromPayload = nextPayload.dashboard;
    const usersFromPayload = nextPayload.users || dashboardFromPayload?.users;
    const auditFromPayload = nextPayload.audit || dashboardFromPayload?.audit;
    const incidentsFromPayload = nextPayload.incidents || dashboardFromPayload?.incidents;
    if (usersFromPayload) setUsersSnapshot(usersFromPayload);
    if (auditFromPayload) setAuditSnapshot(auditFromPayload);
    if (incidentsFromPayload) setIncidentsSnapshot(incidentsFromPayload);
    return true;
  }, [
    setAuditSnapshot,
    setError,
    setIncidentsSnapshot,
    setLastSuccessfulPollAt,
    setPollFailureCount,
    setPollPayload,
    setRefreshFailureDiagnostics,
    markAuthRecovery,
    setUsersSnapshot,
  ]);

  return {
    loadBootstrap,
    loadPoll,
    applyStreamPayload,
  };
}
