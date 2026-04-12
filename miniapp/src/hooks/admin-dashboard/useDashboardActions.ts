import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { asRecord } from '@/services/admin-dashboard/dashboardPrimitives';
import { validateActionEnvelope } from '@/services/admin-dashboard/dashboardApiContracts';
import {
  getDashboardActionPolicy,
  resolveDashboardAction,
  validateDashboardActionPayload,
} from '@/services/admin-dashboard/dashboardActionGuards';

export type ActionRequestMeta = {
  action_id: string;
  request_id: string;
  idempotency_key: string;
  requested_at: string;
  request_timeout_ms: number;
  source: string;
  ui_module: string;
};

export type ActionTelemetry = {
  traceHint: string;
  action: string;
  status: 'idle' | 'running' | 'success' | 'error';
  at: string;
  latencyMs: number;
  error: string;
};

type ActivityStatus = 'info' | 'success' | 'error';
const RETRY_ACTION_META_TTL_MS = 2 * 60 * 1000;

type DashboardActionError = Error & {
  code?: string;
  traceHint?: string;
  correlationId?: string;
  requestId?: string;
};

export type RunActionOptions = {
  confirmText?: string;
  successMessage?: string;
  optimisticUpdate?: () => void | (() => void);
  onSuccess?: () => void | Promise<void>;
};

export type DashboardActionConfirmDialog = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'warning' | 'danger';
  requireMatchText?: string;
  requireMatchPlaceholder?: string;
  requireMatchValidationMessage?: string;
  requireMatchHint?: string;
};

type UseDashboardActionsOptions = {
  createActionMeta: (action: string) => ActionRequestMeta;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  loadBootstrap: () => Promise<void> | void;
  pushActivity: (status: ActivityStatus, title: string, detail: string) => void;
  triggerHaptic: (
    mode: 'selection' | 'impact' | 'success' | 'warning' | 'error',
    impactStyle?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
  ) => void;
  setBusyAction: (value: string) => void;
  setNotice: (value: string) => void;
  setError: (value: string) => void;
  setActionLatencyMsSamples: Dispatch<SetStateAction<number[]>>;
  actionLatencySampleLimit: number;
  confirmAction?: (dialog: DashboardActionConfirmDialog) => Promise<boolean>;
  hasCapability?: (capability: string) => boolean;
};

type UseDashboardActionsResult = {
  invokeAction: (
    action: string,
    payload: Record<string, unknown>,
    metaOverride?: Partial<ActionRequestMeta>,
  ) => Promise<unknown>;
  runAction: (
    action: string,
    payload: Record<string, unknown>,
    options?: RunActionOptions,
  ) => Promise<void>;
  actionTelemetry: ActionTelemetry;
};

function toHint(value: unknown): string {
  const normalized = typeof value === 'string'
    ? value.trim()
    : (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
      ? String(value).trim()
      : '';
  if (!normalized) return 'n/a';
  if (normalized.length <= 8) return normalized;
  return normalized.slice(-8);
}

function readErrorMetadata(
  err: unknown,
): { code: string; traceHint: string; correlationId: string; requestId: string } {
  const source = err as DashboardActionError | null;
  const code = typeof source?.code === 'string' ? source.code.trim() : '';
  const traceHint = typeof source?.traceHint === 'string' ? source.traceHint.trim() : '';
  const correlationId = typeof source?.correlationId === 'string' ? source.correlationId.trim() : '';
  const requestId = typeof source?.requestId === 'string' ? source.requestId.trim() : '';
  return {
    code,
    traceHint,
    correlationId,
    requestId,
  };
}

function isUnsupportedMiniAppActionError(code: string, detail: string): boolean {
  if (code !== 'miniapp_action_invalid') return false;
  return /unsupported miniapp action/i.test(detail);
}

function toStablePayloadKey(value: unknown): string {
  const seen = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((entry) => normalize(entry));
    }
    if (input && typeof input === 'object') {
      if (seen.has(input)) {
        return '[circular]';
      }
      seen.add(input);
      const source = input as Record<string, unknown>;
      const ordered: Record<string, unknown> = {};
      for (const key of Object.keys(source).sort()) {
        ordered[key] = normalize(source[key]);
      }
      return ordered;
    }
    return input;
  };

  try {
    return JSON.stringify(normalize(value));
  } catch {
    return String(value);
  }
}

export function useDashboardActions({
  createActionMeta,
  request,
  loadBootstrap,
  pushActivity,
  triggerHaptic,
  setBusyAction,
  setNotice,
  setError,
  setActionLatencyMsSamples,
  actionLatencySampleLimit,
  confirmAction,
  hasCapability,
}: UseDashboardActionsOptions): UseDashboardActionsResult {
  const inFlightRunActionKeysRef = useRef<Set<string>>(new Set());
  const retryActionMetaCacheRef = useRef<Map<string, { meta: ActionRequestMeta; expiresAt: number }>>(new Map());
  const [actionTelemetry, setActionTelemetry] = useState<ActionTelemetry>({
    traceHint: '',
    action: '',
    status: 'idle',
    at: '',
    latencyMs: 0,
    error: '',
  });

  const refreshDashboardActionContract = useCallback(async (action: string) => {
    const initialResolution = resolveDashboardAction(action);
    if (!initialResolution.actionId || initialResolution.supported) {
      return initialResolution;
    }
    await Promise.resolve(loadBootstrap());
    return resolveDashboardAction(action);
  }, [loadBootstrap]);

  const invokeAction = useCallback(async (
    action: string,
    payload: Record<string, unknown>,
    metaOverride?: Partial<ActionRequestMeta>,
  ): Promise<unknown> => {
    let actionResolution = resolveDashboardAction(action);
    let resolvedAction = actionResolution.actionId;
    if (!resolvedAction) {
      throw new Error('Missing miniapp action id');
    }
    if (!actionResolution.supported) {
      actionResolution = await refreshDashboardActionContract(action);
      resolvedAction = actionResolution.actionId;
    }
    if (!actionResolution.supported) {
      throw new Error(`Blocked action: "${resolvedAction}" is unavailable in this Mini App build.`);
    }
    const actionPolicy = getDashboardActionPolicy(resolvedAction);
    if (actionPolicy.capability && hasCapability && !hasCapability(actionPolicy.capability)) {
      throw new Error(`Missing capability "${actionPolicy.capability}" for ${resolvedAction}`);
    }
    const actionMeta: ActionRequestMeta = {
      ...createActionMeta(resolvedAction),
      ...metaOverride,
    };
    const guardError = validateDashboardActionPayload(resolvedAction, payload);
    if (guardError) {
      throw new Error(`Invalid payload for ${resolvedAction}: ${guardError}`);
    }

    const startedAt = Date.now();
    const traceHint = actionMeta.action_id.slice(-8);
    setActionTelemetry({
      traceHint,
      action: resolvedAction,
      status: 'running',
      at: new Date(startedAt).toISOString(),
      latencyMs: 0,
      error: '',
    });

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), actionMeta.request_timeout_ms);
    try {
      const rawResult = await request<{ success?: boolean; data?: unknown; error?: string } | null>('/miniapp/action', {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'X-Action-Id': actionMeta.action_id,
          'X-Idempotency-Key': actionMeta.idempotency_key,
        },
        body: JSON.stringify({ action: resolvedAction, payload, meta: actionMeta }),
      });
      const envelopeCheck = validateActionEnvelope(rawResult);
      if (!envelopeCheck.ok) {
        throw new Error(envelopeCheck.error);
      }
      const result = asRecord(envelopeCheck.payload);
      const latencyMs = Math.max(0, Date.now() - startedAt);
      setActionTelemetry({
        traceHint,
        action: resolvedAction,
        status: 'success',
        at: new Date().toISOString(),
        latencyMs,
        error: '',
      });
      return result.data;
    } catch (err) {
      const isAbortError = err instanceof DOMException && err.name === 'AbortError';
      const detail = isAbortError
        ? `Action timed out after ${actionMeta.request_timeout_ms}ms`
        : err instanceof Error
          ? err.message
          : String(err);
      const errorMetadata = readErrorMetadata(err);
      const latencyMs = Math.max(0, Date.now() - startedAt);
      setActionTelemetry({
        traceHint,
        action: resolvedAction,
        status: 'error',
        at: new Date().toISOString(),
        latencyMs,
        error: detail,
      });
      if (isAbortError) {
        throw new Error(detail);
      }
      const wrappedError = new Error(detail) as DashboardActionError;
      if (errorMetadata.code) wrappedError.code = errorMetadata.code;
      if (errorMetadata.traceHint) wrappedError.traceHint = errorMetadata.traceHint;
      if (errorMetadata.correlationId) wrappedError.correlationId = errorMetadata.correlationId;
      if (errorMetadata.requestId) wrappedError.requestId = errorMetadata.requestId;
      throw wrappedError;
    } finally {
      clearTimeout(timeout);
    }
  }, [createActionMeta, hasCapability, refreshDashboardActionContract, request]);

  const runAction = useCallback(async (
    action: string,
    payload: Record<string, unknown>,
    options: RunActionOptions = {},
  ): Promise<void> => {
    let actionResolution = resolveDashboardAction(action);
    let resolvedAction = actionResolution.actionId;
    if (!resolvedAction) {
      const missingActionDetail = 'Blocked action: missing action id.';
      setError(missingActionDetail);
      triggerHaptic('warning');
      pushActivity('error', 'Action blocked', missingActionDetail);
      return;
    }
    if (!actionResolution.supported) {
      pushActivity('info', 'Action contract refresh', `Refreshing dashboard contract for ${resolvedAction}`);
      try {
        actionResolution = await refreshDashboardActionContract(action);
        if (actionResolution.actionId) {
          resolvedAction = actionResolution.actionId;
        }
      } catch (refreshErr) {
        const refreshDetail = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        pushActivity('error', 'Contract refresh failed', `${refreshDetail} (${resolvedAction})`);
      }
    }
    if (!actionResolution.supported) {
      const unsupportedActionDetail = `Blocked action: "${resolvedAction}" is unavailable in this Mini App build after refreshing the dashboard contract.`;
      setError(unsupportedActionDetail);
      triggerHaptic('warning');
      pushActivity('error', 'Action blocked', unsupportedActionDetail);
      return;
    }
    const actionPolicy = getDashboardActionPolicy(resolvedAction);
    if (actionPolicy.capability && hasCapability && !hasCapability(actionPolicy.capability)) {
      const deniedDetail = `Blocked ${resolvedAction}: missing capability ${actionPolicy.capability}`;
      setError(deniedDetail);
      triggerHaptic('warning');
      pushActivity('error', 'Action blocked', deniedDetail);
      return;
    }
    const dedupeKey = `${resolvedAction}:${toStablePayloadKey(payload)}`;
    if (inFlightRunActionKeysRef.current.has(dedupeKey)) {
      const duplicateDetail = `Duplicate submit ignored: ${resolvedAction}`;
      setNotice(duplicateDetail);
      triggerHaptic('warning');
      pushActivity('info', 'Duplicate action ignored', duplicateDetail);
      return;
    }
    inFlightRunActionKeysRef.current.add(dedupeKey);

    try {
      const now = Date.now();
      for (const [cacheKey, entry] of retryActionMetaCacheRef.current.entries()) {
        if (entry.expiresAt <= now) {
          retryActionMetaCacheRef.current.delete(cacheKey);
        }
      }
      const cachedActionMeta = retryActionMetaCacheRef.current.get(dedupeKey);
      const actionMeta = cachedActionMeta && cachedActionMeta.expiresAt > now
        ? {
          ...cachedActionMeta.meta,
          requested_at: new Date().toISOString(),
        }
        : createActionMeta(resolvedAction);
      retryActionMetaCacheRef.current.set(dedupeKey, {
        meta: actionMeta,
        expiresAt: now + RETRY_ACTION_META_TTL_MS,
      });
      const traceHint = toHint(actionMeta.action_id);
      const idempotencyHint = toHint(actionMeta.idempotency_key);
      const actionAuditHint = `trace:${traceHint} idem:${idempotencyHint}`;
      const requiresPolicyConfirmation = actionPolicy.risk === 'danger';
      const shouldConfirm = typeof window !== 'undefined' && (Boolean(options.confirmText) || requiresPolicyConfirmation);
      const requiresTypedConfirmation = Boolean(actionPolicy.confirmIrreversible);
      const typedConfirmationValue = 'CONFIRM';
      if (shouldConfirm) {
        if (requiresTypedConfirmation && !confirmAction) {
          const fallbackError = `Blocked ${resolvedAction}: typed confirmation dialog is required for irreversible actions.`;
          setError(fallbackError);
          triggerHaptic('warning');
          pushActivity('error', 'Action blocked', `${fallbackError} (${actionAuditHint})`);
          return;
        }
        const baseConfirmMessage = options.confirmText
          || `Execute ${resolvedAction}?`;
        const consequenceLine = actionPolicy.confirmConsequence
          || (actionPolicy.risk === 'danger'
            ? 'This action impacts live operations.'
            : '');
        const irreversibleLine = actionPolicy.confirmIrreversible
          ? 'This action may be irreversible.'
          : '';
        const confirmMessage = [
          baseConfirmMessage,
          consequenceLine,
          irreversibleLine,
        ].filter(Boolean).join('\n\n');
        const allowed = confirmAction
          ? await confirmAction({
            title: actionPolicy.confirmTitle || 'Confirm action',
            message: confirmMessage,
            confirmLabel: actionPolicy.confirmLabel || (actionPolicy.risk === 'danger' ? 'Proceed' : 'Confirm'),
            cancelLabel: 'Cancel',
            tone: actionPolicy.confirmTone
              || (actionPolicy.risk === 'danger' ? 'danger' : 'warning'),
            requireMatchText: requiresTypedConfirmation ? typedConfirmationValue : undefined,
            requireMatchPlaceholder: requiresTypedConfirmation ? `Type ${typedConfirmationValue}` : undefined,
            requireMatchValidationMessage: requiresTypedConfirmation
              ? `Type ${typedConfirmationValue} exactly to continue.`
              : undefined,
            requireMatchHint: requiresTypedConfirmation
              ? `Type ${typedConfirmationValue} to acknowledge this irreversible action.`
              : undefined,
          })
          : window.confirm(confirmMessage);
        if (!allowed) {
          triggerHaptic('warning');
          pushActivity('info', 'Action cancelled', `Cancelled: ${resolvedAction} (${actionAuditHint})`);
          return;
        }
      }

      setBusyAction(resolvedAction);
      setNotice('');
      setError('');
      pushActivity('info', 'Action started', `Executing: ${resolvedAction} (${actionAuditHint})`);
      const startedAt = Date.now();
      let rollbackOptimisticUpdate: (() => void) | null = null;
      if (options.optimisticUpdate) {
        const rollback = options.optimisticUpdate();
        if (typeof rollback === 'function') {
          rollbackOptimisticUpdate = rollback;
        }
      }
      try {
        await invokeAction(resolvedAction, payload, actionMeta);
        retryActionMetaCacheRef.current.delete(dedupeKey);
        const successMessage = options.successMessage || `Action completed: ${resolvedAction}`;
        setNotice(`${successMessage} [${traceHint}|${idempotencyHint}]`);
        triggerHaptic('success');
        pushActivity('success', 'Action completed', `${successMessage} (${actionAuditHint})`);
        await Promise.resolve(loadBootstrap());
        if (options.onSuccess) {
          await Promise.resolve(options.onSuccess());
        }
      } catch (err) {
        if (rollbackOptimisticUpdate) {
          rollbackOptimisticUpdate();
        }
        const errorMetadata = readErrorMetadata(err);
        const detail = err instanceof Error ? err.message : String(err);
        if (isUnsupportedMiniAppActionError(errorMetadata.code, detail)) {
          const refreshDetail = `Action unavailable: ${resolvedAction}. Refreshing dashboard contract.`;
          setError(refreshDetail);
          triggerHaptic('warning');
          pushActivity('error', `Action unavailable: ${resolvedAction}`, `${detail} (${actionAuditHint})`);
          try {
            await Promise.resolve(loadBootstrap());
            setNotice(`Dashboard contract refreshed after unsupported action: ${resolvedAction}`);
          } catch (refreshErr) {
            const refreshErrorDetail = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
            pushActivity(
              'error',
              'Contract refresh failed',
              `${refreshErrorDetail} (${actionAuditHint})`,
            );
          }
          return;
        }
        setError(detail);
        triggerHaptic('error');
        pushActivity('error', `Action failed: ${resolvedAction}`, `${detail} (${actionAuditHint})`);
      } finally {
        const latencyMs = Math.max(0, Date.now() - startedAt);
        setActionLatencyMsSamples((prev) => [...prev, latencyMs].slice(-actionLatencySampleLimit));
        setBusyAction('');
      }
    } finally {
      inFlightRunActionKeysRef.current.delete(dedupeKey);
    }
  }, [
    actionLatencySampleLimit,
    createActionMeta,
    invokeAction,
    loadBootstrap,
    pushActivity,
    setActionLatencyMsSamples,
    setBusyAction,
    setError,
    setNotice,
    triggerHaptic,
    confirmAction,
    hasCapability,
    refreshDashboardActionContract,
  ]);

  return {
    invokeAction,
    runAction,
    actionTelemetry,
  };
}
