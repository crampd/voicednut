import { useRawInitData } from '@tma.js/sdk-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  DashboardApiPayload,
  MiniAppSessionSummary,
} from '@/pages/AdminDashboard/dashboardPayloadTypes';
import { asStringList } from '@/pages/AdminDashboard/dashboardPayloadHelpers';
import {
  validateActionEnvelope,
  validateBootstrapPayload,
} from '@/services/admin-dashboard/dashboardApiContracts';
import { createDashboardApiClient } from '@/services/admin-dashboard/dashboardApiClient';
import { asRecord, toText } from '@/services/admin-dashboard/dashboardPrimitives';
import { isNgrokApiBase } from '@/services/admin-dashboard/dashboardTransport';
import type { MiniAppCommandAccessLevel } from '@/contracts/miniappParityContracts';
import { resolveDashboardFixtureRequest } from '@/pages/AdminDashboard/dashboardFixtureData';
import {
  resolveDashboardAction,
  setDashboardSupportedActions,
  validateDashboardActionPayload,
} from '@/services/admin-dashboard/dashboardActionGuards';

const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '',
).trim().replace(/\/+$/, '');
const API_BASE_IS_NGROK = isNgrokApiBase(API_BASE_URL);
const NGROK_BYPASS_HEADER = 'ngrok-skip-browser-warning';
const SESSION_STORAGE_KEY = 'voxly-miniapp-session';
const SESSION_REFRESH_RETRY_COUNT = 1;
const COMMAND_PAGE_DEV_FIXTURES_ENABLED = import.meta.env.DEV && ['1', 'true', 'yes']
  .includes(String(import.meta.env.VITE_ADMIN_DASHBOARD_DEV_FIXTURES || '').trim().toLowerCase());

export type MiniAppCommandSessionState = {
  loading: boolean;
  error: string;
  errorCode: string;
  bootstrapPayload: DashboardApiPayload | null;
  sessionTelegramId: string;
  sessionRole: string;
  sessionCaps: string[];
  accessLevel: MiniAppCommandAccessLevel;
  activeCallProvider: string;
  hasCapability: (capability: string) => boolean;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  invokeAction: <T>(action: string, payload?: Record<string, unknown>) => Promise<T>;
  reload: () => Promise<void>;
};

function createCommandActionMeta(action: string) {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    action_id: `command-${action}-${randomId}`,
    request_id: `command-request-${randomId}`,
    idempotency_key: `command-idem-${randomId}`,
    requested_at: new Date().toISOString(),
    request_timeout_ms: 20_000,
    source: 'miniapp.command',
    ui_module: 'command-pages',
  };
}

function resolveAccessLevel(role: string, caps: string[]): MiniAppCommandAccessLevel {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole && normalizedRole !== 'viewer') return 'authorized';
  if (caps.includes('users_manage')) return 'admin';
  if (caps.some((capability) => capability !== 'dashboard_view')) return 'authorized';
  return 'guest';
}

export function useMiniAppCommandSession(): MiniAppCommandSessionState {
  const initDataRaw = useRawInitData();
  const initDataRawRef = useRef(initDataRaw || '');
  const tokenRef = useRef<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [bootstrapPayload, setBootstrapPayload] = useState<DashboardApiPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionTelegramId, setSessionTelegramId] = useState<string>('');
  const [sessionRole, setSessionRole] = useState<string>('viewer');
  const [sessionCaps, setSessionCaps] = useState<string[]>([]);
  const [activeCallProvider, setActiveCallProvider] = useState<string>('');

  useEffect(() => {
    initDataRawRef.current = initDataRaw || '';
  }, [initDataRaw]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const dashboardApiClient = useMemo(() => createDashboardApiClient(
    {
      apiBaseUrl: API_BASE_URL,
      apiBaseIsNgrok: API_BASE_IS_NGROK,
      ngrokBypassHeader: NGROK_BYPASS_HEADER,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionRefreshRetryCount: SESSION_REFRESH_RETRY_COUNT,
    },
    {
      getToken: () => tokenRef.current,
      setToken,
      getInitDataRaw: () => initDataRawRef.current,
      setErrorCode,
      setSessionBlocked: () => undefined,
      pushActivity: () => undefined,
    },
  ), []);

  const request = useCallback(async <T,>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> => {
    if (COMMAND_PAGE_DEV_FIXTURES_ENABLED) {
      return resolveDashboardFixtureRequest(path, options) as T;
    }
    return dashboardApiClient.request<T>(path, options);
  }, [dashboardApiClient]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rawPayload = await request<DashboardApiPayload | null>('/miniapp/bootstrap', {
        method: 'GET',
      });
      const validation = validateBootstrapPayload(rawPayload);
      if (!validation.ok) {
        throw new Error(validation.error);
      }
      const payload = validation.payload;
      const dashboardPayload = asRecord(payload.dashboard);
      const sessionPayload = asRecord(payload.session || dashboardPayload.session) as MiniAppSessionSummary;
      const providerPayload = asRecord(payload.provider || dashboardPayload.provider);
      const providersPayload = asRecord(providerPayload.providers);
      const callProviderPayload = asRecord(providersPayload.call);
      const supportedActions = payload.supported_actions ?? dashboardPayload.supported_actions;
      setDashboardSupportedActions(supportedActions);
      setBootstrapPayload(payload);
      setSessionTelegramId(toText(sessionPayload.telegram_id, ''));
      setSessionRole(toText(sessionPayload.role, 'viewer').toLowerCase());
      setSessionCaps(asStringList(sessionPayload.caps));
      setActiveCallProvider(toText(callProviderPayload.provider, '').toLowerCase());
      setError('');
    } catch (nextError) {
      setDashboardSupportedActions(null);
      setBootstrapPayload(null);
      setSessionTelegramId('');
      setSessionRole('viewer');
      setSessionCaps([]);
      setActiveCallProvider('');
      setError(nextError instanceof Error ? nextError.message : 'Unable to load Mini App session.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasCapability = useCallback((capability: string): boolean => {
    const normalizedCapability = capability.trim().toLowerCase();
    if (!normalizedCapability) return false;
    return sessionCaps.some((entry) => entry.trim().toLowerCase() === normalizedCapability);
  }, [sessionCaps]);

  const invokeAction = useCallback(async <T,>(
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> => {
    const actionResolution = resolveDashboardAction(action);
    if (!actionResolution.actionId || !actionResolution.supported) {
      throw new Error(`Unsupported Mini App action: ${action}`);
    }
    const resolvedAction = actionResolution.actionId;
    const guardError = validateDashboardActionPayload(resolvedAction, payload);
    if (guardError) {
      throw new Error(`Invalid payload for ${resolvedAction}: ${guardError}`);
    }
    const actionMeta = createCommandActionMeta(resolvedAction);
    const rawPayload = await request<unknown>('/miniapp/action', {
      method: 'POST',
      headers: {
        'X-Action-Id': actionMeta.action_id,
        'X-Idempotency-Key': actionMeta.idempotency_key,
      },
      body: JSON.stringify({
        action: resolvedAction,
        payload,
        meta: actionMeta,
      }),
    });
    const envelopeCheck = validateActionEnvelope(rawPayload);
    if (!envelopeCheck.ok) {
      throw new Error(envelopeCheck.error);
    }
    return envelopeCheck.payload.data as T;
  }, [request]);

  return {
    loading,
    error,
    errorCode,
    bootstrapPayload,
    sessionTelegramId,
    sessionRole,
    sessionCaps,
    accessLevel: resolveAccessLevel(sessionRole, sessionCaps),
    activeCallProvider,
    hasCapability,
    request,
    invokeAction,
    reload,
  };
}
