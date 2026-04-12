export interface SessionCacheEntry {
  token: string;
  exp: number | null;
}

const SESSION_EXPIRY_SKEW_SECONDS = 20;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type ReadSessionCacheOptions = {
  allowExpired?: boolean;
  evictExpired?: boolean;
};

export type DashboardRealtimeTransportContract = {
  enabled: boolean;
  endpoints: string[];
  source: string;
  authMode: 'none' | 'query_token';
  authQueryParam: string;
};

function parseApiBaseHost(apiBaseUrl: string): string {
  if (!apiBaseUrl) return '';
  try {
    return new URL(apiBaseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isNgrokApiBase(apiBaseUrl: string): boolean {
  const host = parseApiBaseHost(apiBaseUrl);
  if (!host) return false;
  return host.includes('ngrok')
    || host.endsWith('.ngrok-free.app')
    || host.endsWith('.ngrok-free.dev')
    || host.endsWith('.ngrok.io');
}

export function isSessionBootstrapBlockingCode(code: string): boolean {
  return [
    'miniapp_invalid_signature',
    'miniapp_missing_init_data',
    'miniapp_auth_date_future',
    'miniapp_replay_detected',
    'miniapp_admin_required',
    'miniapp_auth_required',
    'miniapp_auth_invalid',
    'miniapp_invalid_token',
    'miniapp_malformed_token',
    'miniapp_invalid_token_signature',
    'miniapp_invalid_token_payload',
    'miniapp_token_not_active',
    'miniapp_token_missing_exp',
    'miniapp_token_expired',
    'miniapp_token_revoked',
  ].includes(String(code || '').trim());
}

export function isSessionCacheEntryExpired(
  entry: SessionCacheEntry | null,
  skewSeconds = SESSION_EXPIRY_SKEW_SECONDS,
): boolean {
  if (!entry || !entry.token) return true;
  if (!Number.isFinite(entry.exp) || entry.exp === null) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return entry.exp <= (nowSeconds + Math.max(0, skewSeconds));
}

function getLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseSessionCacheEntry(raw: string | null): SessionCacheEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionCacheEntry>;
    if (!parsed || !parsed.token) return null;
    const exp = Number(parsed.exp);
    return {
      token: String(parsed.token),
      exp: Number.isFinite(exp) ? exp : null,
    };
  } catch {
    return null;
  }
}

function removeSessionCacheEntry(storageKey: string, storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup errors and continue.
  }
}

function writeSessionCacheEntry(
  storageKey: string,
  entry: SessionCacheEntry,
  storage: StorageLike | null,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

export function readSessionCache(
  storageKey: string,
  options: ReadSessionCacheOptions = {},
): SessionCacheEntry | null {
  const allowExpired = options.allowExpired === true;
  const evictExpired = options.evictExpired !== false;
  const localStorage = getLocalStorage();
  const sessionStorage = getSessionStorage();
  const storages: Array<{ storage: StorageLike | null; legacy: boolean }> = [
    { storage: localStorage, legacy: false },
    { storage: sessionStorage, legacy: true },
  ];

  for (const { storage, legacy } of storages) {
    if (!storage) continue;
    let raw: string | null = null;
    try {
      raw = storage.getItem(storageKey);
    } catch {
      continue;
    }
    if (!raw) continue;
    const entry = parseSessionCacheEntry(raw);
    if (!entry) {
      removeSessionCacheEntry(storageKey, storage);
      continue;
    }
    if (legacy && localStorage) {
      writeSessionCacheEntry(storageKey, entry, localStorage);
      removeSessionCacheEntry(storageKey, sessionStorage);
    }
    if (isSessionCacheEntryExpired(entry)) {
      if (evictExpired) {
        removeSessionCacheEntry(storageKey, localStorage);
        removeSessionCacheEntry(storageKey, sessionStorage);
      }
      return allowExpired ? entry : null;
    }
    return entry;
  }

  return null;
}

export function writeSessionCache(storageKey: string, entry: SessionCacheEntry | null): void {
  if (!entry) {
    removeSessionCacheEntry(storageKey, getLocalStorage());
    removeSessionCacheEntry(storageKey, getSessionStorage());
    return;
  }
  const localStorage = getLocalStorage();
  const didPersistDurably = writeSessionCacheEntry(storageKey, entry, localStorage);
  if (!didPersistDurably) {
    writeSessionCacheEntry(storageKey, entry, getSessionStorage());
    return;
  }
  removeSessionCacheEntry(storageKey, getSessionStorage());
}

export function buildApiUrl(path: string, apiBaseUrl: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function buildEventStreamUrl(
  path: string,
  apiBaseUrl: string,
  options: {
    authMode?: 'none' | 'query_token';
    authQueryParam?: string;
    token?: string | null;
  } = {},
): string {
  const base = buildApiUrl(path, apiBaseUrl);
  const params = new URLSearchParams();
  params.set('transport', 'sse');
  if (isNgrokApiBase(apiBaseUrl)) {
    params.set('ngrok-skip-browser-warning', '1');
  }
  if (
    options.authMode === 'query_token'
    && options.authQueryParam
    && options.token
  ) {
    params.set(options.authQueryParam, options.token);
  }
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readTextCandidate(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const next = value.trim();
      if (next) return next;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
  }
  return '';
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }
  return null;
}

function normalizeStreamPath(value: unknown): string {
  let raw = '';
  if (typeof value === 'string') {
    raw = value.trim();
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    raw = String(value).trim();
  }
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  return `/${raw}`;
}

function parseRealtimeEndpoints(payload: Record<string, unknown>): string[] {
  const endpoints: string[] = [];
  const candidates = [
    payload.endpoints,
    payload.paths,
    payload.sse_endpoints,
  ];
  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;
    candidate.forEach((entry) => {
      const next = normalizeStreamPath(entry);
      if (next) endpoints.push(next);
    });
  });
  [payload.path, payload.endpoint, payload.sse_path].forEach((candidate) => {
    const next = normalizeStreamPath(candidate);
    if (next) endpoints.push(next);
  });
  return Array.from(new Set(endpoints));
}

function parseRealtimeAuthMode(payload: Record<string, unknown>): 'none' | 'query_token' {
  const auth = asRecord(payload.auth);
  const direct = readTextCandidate(payload.auth_mode, auth.mode).toLowerCase();
  if (direct === 'query_token') {
    return 'query_token';
  }
  return 'none';
}

function parseRealtimeAuthQueryParam(payload: Record<string, unknown>): string {
  const auth = asRecord(payload.auth);
  return readTextCandidate(
    payload.auth_query_param
      || payload.token_query_param
      || payload.query_token_param
      || auth.query_param
      || auth.token_param
      || '',
  );
}

function resolveRealtimeCandidate(payload: unknown): {
  realtime: Record<string, unknown>;
  source: string;
} {
  const root = asRecord(payload);
  const dashboard = asRecord(root.dashboard);
  const candidates: Array<{ source: string; value: unknown }> = [
    { source: 'payload.transport.realtime', value: asRecord(root.transport).realtime },
    { source: 'payload.dashboard.transport.realtime', value: asRecord(dashboard.transport).realtime },
    { source: 'payload.realtime', value: root.realtime },
    { source: 'payload.dashboard.realtime', value: dashboard.realtime },
  ];
  for (const candidate of candidates) {
    const realtime = asRecord(candidate.value);
    if (Object.keys(realtime).length > 0) {
      return { realtime, source: candidate.source };
    }
  }
  return { realtime: {}, source: 'none' };
}

export function resolveRealtimeTransportContract(
  ...payloads: Array<unknown>
): DashboardRealtimeTransportContract {
  for (const payload of payloads) {
    const { realtime, source } = resolveRealtimeCandidate(payload);
    if (Object.keys(realtime).length === 0) {
      continue;
    }
    const endpoints = parseRealtimeEndpoints(realtime);
    const authMode = parseRealtimeAuthMode(realtime);
    const authQueryParam = parseRealtimeAuthQueryParam(realtime);
    const explicitEnabled = toBoolean(realtime.enabled);
    const contractIsUsable = endpoints.length > 0
      && authMode === 'query_token'
      && Boolean(authQueryParam);
    const enabled = explicitEnabled === null
      ? contractIsUsable
      : explicitEnabled && contractIsUsable;
    return {
      enabled,
      endpoints,
      source,
      authMode,
      authQueryParam,
    };
  }
  return {
    enabled: false,
    endpoints: [],
    source: 'none',
    authMode: 'none',
    authQueryParam: '',
  };
}
