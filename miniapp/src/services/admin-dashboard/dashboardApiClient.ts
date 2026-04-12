import {
  parseApiError,
  parseApiErrorCode,
  parseJsonResponse,
} from '@/services/admin-dashboard/dashboardPrimitives';
import {
  buildApiUrl,
  isSessionCacheEntryExpired,
  isSessionBootstrapBlockingCode,
  readSessionCache,
  type SessionCacheEntry,
  writeSessionCache,
} from '@/services/admin-dashboard/dashboardTransport';
import { inferMiniAppErrorCodeFromMessage } from '@/services/admin-dashboard/dashboardSessionErrors';

export type DashboardActivityStatus = 'info' | 'success' | 'error';

export type DashboardApiClientConfig = {
  apiBaseUrl: string;
  apiBaseIsNgrok: boolean;
  ngrokBypassHeader: string;
  sessionStorageKey: string;
  sessionRefreshRetryCount: number;
};

export type DashboardApiClientCallbacks = {
  getToken: () => string | null;
  setToken: (token: string | null) => void;
  getInitDataRaw: () => string;
  setErrorCode: (code: string) => void;
  setSessionBlocked: (value: boolean) => void;
  pushActivity: (status: DashboardActivityStatus, title: string, detail: string) => void;
};

type SessionResponse = {
  success?: boolean;
  token?: string;
  expires_at?: number;
  init_data_refresh_recommended?: boolean;
  session?: {
    init_data_refresh_recommended?: boolean;
  };
  code?: string;
  error?: string;
};

type DashboardApiClient = {
  createSession: (options?: { signal?: AbortSignal }) => Promise<string>;
  refreshSession: (token: string, options?: { signal?: AbortSignal }) => Promise<string>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  clearSession: () => void;
};

export type DashboardApiError = Error & {
  code?: string;
  httpStatus?: number;
  traceHint?: string;
  correlationId?: string;
  requestId?: string;
};

function createDashboardApiError(
  message: string,
  options: {
    code?: string;
    httpStatus?: number;
    traceHint?: string;
    correlationId?: string;
    requestId?: string;
  } = {},
): DashboardApiError {
  const error = new Error(message) as DashboardApiError;
  if (options.code) {
    error.code = options.code;
  }
  if (Number.isFinite(options.httpStatus)) {
    error.httpStatus = options.httpStatus;
  }
  if (options.traceHint) {
    error.traceHint = options.traceHint;
  }
  if (options.correlationId) {
    error.correlationId = options.correlationId;
  }
  if (options.requestId) {
    error.requestId = options.requestId;
  }
  return error;
}

function normalizeResponseHeaderValue(value: string): string {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.slice(-24) : '';
}

function resolveResponseCorrelationId(response: Response): string {
  const directCorrelationId = normalizeResponseHeaderValue(response.headers.get('x-correlation-id') || '');
  if (directCorrelationId) return directCorrelationId;
  return normalizeResponseHeaderValue(response.headers.get('x-trace-id') || '');
}

function resolveResponseRequestId(response: Response): string {
  const headerCandidates = [
    'x-request-id',
    'x-amzn-requestid',
    'cf-ray',
  ];
  for (const header of headerCandidates) {
    const value = normalizeResponseHeaderValue(response.headers.get(header) || '');
    if (value) {
      return value;
    }
  }
  return '';
}

function resolveResponseTraceHint(response: Response): string {
  return resolveResponseCorrelationId(response) || resolveResponseRequestId(response);
}

function createAbortError(message = 'The operation was aborted.'): Error {
  try {
    return new DOMException(message, 'AbortError');
  } catch {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal | null): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw createAbortError();
}

function linkAbortSignal(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) return () => undefined;
  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => undefined;
  }
  const abortFromParent = (): void => {
    controller.abort(signal.reason);
  };
  signal.addEventListener('abort', abortFromParent, { once: true });
  return () => {
    signal.removeEventListener('abort', abortFromParent);
  };
}

async function waitForPromiseWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) {
    return promise;
  }
  return await new Promise<T>((resolve, reject) => {
    const abortReason = signal.reason instanceof Error ? signal.reason : createAbortError();
    const abort = (): void => {
      reject(abortReason);
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error('Mini App session request failed.'));
      },
    );
  });
}

function buildSessionHeaders(initDataRaw: string, config: DashboardApiClientConfig): Headers {
  const sessionHeaders = new Headers({
    Authorization: `tma ${initDataRaw}`,
    'x-telegram-init-data': initDataRaw,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });
  if (config.apiBaseIsNgrok) {
    sessionHeaders.set(config.ngrokBypassHeader, '1');
  }
  return sessionHeaders;
}

function buildRequestHeaders(
  token: string,
  options: RequestInit,
  config: DashboardApiClientConfig,
): Headers {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (config.apiBaseIsNgrok) {
    headers.set(config.ngrokBypassHeader, '1');
  }
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

function resolveApiErrorCode(payload: unknown, fallbackMessage = ''): string {
  const directCode = parseApiErrorCode(payload);
  if (directCode) return directCode;
  return inferMiniAppErrorCodeFromMessage(fallbackMessage);
}

export function createDashboardApiClient(
  config: DashboardApiClientConfig,
  callbacks: DashboardApiClientCallbacks,
): DashboardApiClient {
  let sessionRequest: Promise<string> | null = null;
  let sessionRefreshRequest: Promise<string> | null = null;
  let sessionRequestController: AbortController | null = null;
  let sessionRefreshController: AbortController | null = null;
  let sessionExpiryEpochSeconds: number | null = null;
  let sessionEpoch = 0;

  const clearSession = (): void => {
    sessionEpoch += 1;
    sessionRequestController?.abort(createAbortError('Mini App session was cleared.'));
    sessionRefreshController?.abort(createAbortError('Mini App session was cleared.'));
    writeSessionCache(config.sessionStorageKey, null);
    sessionRequest = null;
    sessionRefreshRequest = null;
    sessionRequestController = null;
    sessionRefreshController = null;
    sessionExpiryEpochSeconds = null;
    callbacks.setToken(null);
  };

  const createSession = async (options: { signal?: AbortSignal } = {}): Promise<string> => {
    const { signal } = options;
    throwIfAborted(signal);
    const requestEpoch = sessionEpoch;
    const cached = readSessionCache(config.sessionStorageKey, {
      allowExpired: true,
      evictExpired: false,
    });
    if (cached?.token) {
      sessionExpiryEpochSeconds = cached.exp;
      callbacks.setToken(cached.token);
      callbacks.setSessionBlocked(false);
      if (!isSessionCacheEntryExpired(cached)) {
        return cached.token;
      }
      callbacks.pushActivity('info', 'Session refresh', 'Cached session token expired, attempting secure refresh.');
      try {
        return await refreshSession(cached.token, { signal });
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        clearSession();
        callbacks.pushActivity(
          'info',
          'Session refresh',
          'Cached session refresh failed, requesting a new Telegram session.',
        );
      }
    }

    if (sessionRequest) {
      return waitForPromiseWithSignal(sessionRequest, signal);
    }

    const initDataRaw = callbacks.getInitDataRaw();
    if (!initDataRaw) {
      callbacks.setSessionBlocked(true);
      callbacks.setErrorCode('miniapp_missing_init_data');
      callbacks.pushActivity(
        'error',
        'Session blocked',
        'Mini App init data is unavailable. Open this page from Telegram.',
      );
      throw createDashboardApiError(
        'Mini App init data is unavailable. Open this page from Telegram.',
        { code: 'miniapp_missing_init_data' },
      );
    }

    const nextSessionRequest = (async (): Promise<string> => {
      const controller = new AbortController();
      sessionRequestController = controller;
      const unlinkAbort = linkAbortSignal(signal, controller);
      try {
        const response = await fetch(buildApiUrl('/miniapp/session', config.apiBaseUrl), {
        method: 'POST',
        headers: buildSessionHeaders(initDataRaw, config),
        body: JSON.stringify({ init_data_raw: initDataRaw }),
          signal: controller.signal,
        });
        throwIfAborted(signal);
        const traceHint = resolveResponseTraceHint(response);
        const correlationId = resolveResponseCorrelationId(response);
        const requestId = resolveResponseRequestId(response);
        const payload = (await parseJsonResponse(response)) as SessionResponse | null;
        if (response.ok && !payload) {
          throw createDashboardApiError(
            'Session endpoint returned an empty/non-JSON response. Verify VITE_API_BASE_URL points to the API origin.',
            {
              httpStatus: response.status,
              traceHint,
              correlationId,
              requestId,
            },
          );
        }

        const message = payload?.error || `Session request failed (${response.status})`;
        const code = resolveApiErrorCode(payload, message);
        if (!response.ok || !payload?.success || !payload?.token) {
          if (isSessionBootstrapBlockingCode(code)) {
            callbacks.setSessionBlocked(true);
          }
          if (code) {
            callbacks.setErrorCode(code);
          }
          throw createDashboardApiError(message, {
            code,
            httpStatus: response.status,
            traceHint,
            correlationId,
            requestId,
          });
        }

        const nextToken = payload.token;
        const expiresAtSeconds = Number(payload.expires_at);
        const cacheEntry: SessionCacheEntry = {
          token: nextToken,
          exp: Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0 ? expiresAtSeconds : null,
        };
        throwIfAborted(signal);
        if (requestEpoch !== sessionEpoch) {
          throw createAbortError('Mini App session bootstrap was superseded.');
        }
        sessionExpiryEpochSeconds = cacheEntry.exp;
        writeSessionCache(config.sessionStorageKey, cacheEntry);
        callbacks.setToken(nextToken);
        callbacks.setErrorCode('');
        callbacks.setSessionBlocked(false);
        const initDataRefreshRecommended = payload.init_data_refresh_recommended === true
          || payload.session?.init_data_refresh_recommended === true;
        if (initDataRefreshRecommended) {
          callbacks.pushActivity(
            'info',
            'Telegram refresh recommended',
            'Session recovered from init-data expiry grace. Reopen this Mini App from Telegram soon to refresh launch credentials.',
          );
        }
        callbacks.pushActivity('success', 'Session established', 'Mini App session token created successfully.');
        return nextToken;
      } finally {
        unlinkAbort();
        if (sessionRequestController === controller) {
          sessionRequestController = null;
        }
      }
    })();
    sessionRequest = nextSessionRequest;

    try {
      return await waitForPromiseWithSignal(nextSessionRequest, signal);
    } finally {
      if (sessionRequest === nextSessionRequest) {
        sessionRequest = null;
      }
    }
  };

  const refreshSession = async (
    token: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<string> => {
    const { signal } = options;
    const authToken = String(token || '').trim();
    if (!authToken) {
      throw new Error('Mini App session token is unavailable for refresh.');
    }
    throwIfAborted(signal);
    const requestEpoch = sessionEpoch;

    if (sessionRefreshRequest) {
      return waitForPromiseWithSignal(sessionRefreshRequest, signal);
    }

    const nextRefreshRequest = (async (): Promise<string> => {
      const controller = new AbortController();
      sessionRefreshController = controller;
      const unlinkAbort = linkAbortSignal(signal, controller);
      try {
        const response = await fetch(buildApiUrl('/miniapp/session/refresh', config.apiBaseUrl), {
          method: 'POST',
          headers: buildRequestHeaders(authToken, {}, config),
          signal: controller.signal,
        });
        throwIfAborted(signal);
        const traceHint = resolveResponseTraceHint(response);
        const correlationId = resolveResponseCorrelationId(response);
        const requestId = resolveResponseRequestId(response);
        const payload = (await parseJsonResponse(response)) as SessionResponse | null;
        if (response.ok && !payload) {
          throw createDashboardApiError(
            'Session refresh endpoint returned an empty/non-JSON response. Verify VITE_API_BASE_URL points to the API origin.',
            {
              httpStatus: response.status,
              traceHint,
              correlationId,
              requestId,
            },
          );
        }

        const message = payload?.error || `Session refresh failed (${response.status})`;
        const code = resolveApiErrorCode(payload, message);
        if (!response.ok || !payload?.success || !payload?.token) {
          if (isSessionBootstrapBlockingCode(code)) {
            callbacks.setSessionBlocked(true);
          }
          if (code) {
            callbacks.setErrorCode(code);
          }
          throw createDashboardApiError(message, {
            code,
            httpStatus: response.status,
            traceHint,
            correlationId,
            requestId,
          });
        }

        const nextToken = payload.token;
        const expiresAtSeconds = Number(payload.expires_at);
        const cacheEntry: SessionCacheEntry = {
          token: nextToken,
          exp: Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0 ? expiresAtSeconds : null,
        };
        throwIfAborted(signal);
        if (requestEpoch !== sessionEpoch) {
          throw createAbortError('Mini App session refresh was superseded.');
        }
        sessionExpiryEpochSeconds = cacheEntry.exp;
        writeSessionCache(config.sessionStorageKey, cacheEntry);
        callbacks.setToken(nextToken);
        callbacks.setErrorCode('');
        callbacks.setSessionBlocked(false);
        callbacks.pushActivity('success', 'Session refreshed', 'Mini App session token was refreshed.');
        return nextToken;
      } finally {
        unlinkAbort();
        if (sessionRefreshController === controller) {
          sessionRefreshController = null;
        }
      }
    })();
    sessionRefreshRequest = nextRefreshRequest;

    try {
      return await waitForPromiseWithSignal(nextRefreshRequest, signal);
    } finally {
      if (sessionRefreshRequest === nextRefreshRequest) {
        sessionRefreshRequest = null;
      }
    }
  };

  const request = async <T,>(
    path: string,
    options: RequestInit = {},
    retryCount = 0,
    preferredToken = '',
  ): Promise<T> => {
    const requestSignal = options.signal ?? undefined;
    let activeToken = String(preferredToken || '').trim();
    if (!activeToken) {
      const tokenFromState = callbacks.getToken();
      const tokenFromStateExpired = isSessionCacheEntryExpired(
        tokenFromState
          ? {
            token: tokenFromState,
            exp: sessionExpiryEpochSeconds,
          }
          : null,
      );
      if (!tokenFromState) {
        activeToken = await createSession({ signal: requestSignal });
      } else if (tokenFromStateExpired) {
        callbacks.pushActivity('info', 'Session refresh', 'Session token expired, refreshing.');
        try {
          activeToken = await refreshSession(tokenFromState, { signal: requestSignal });
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }
          clearSession();
          callbacks.pushActivity('info', 'Session refresh', 'Session refresh failed, requesting a new Telegram session.');
          activeToken = await createSession({ signal: requestSignal });
        }
      } else {
        activeToken = tokenFromState;
      }
    }

    const response = await fetch(buildApiUrl(path, config.apiBaseUrl), {
      ...options,
      headers: buildRequestHeaders(activeToken, options, config),
    });
    const traceHint = resolveResponseTraceHint(response);
    const correlationId = resolveResponseCorrelationId(response);
    const requestId = resolveResponseRequestId(response);

    const payload = await parseJsonResponse(response);
    if (response.ok && !payload) {
      throw createDashboardApiError(
        `API returned an empty/non-JSON response for ${path}. Verify VITE_API_BASE_URL is configured to your backend.`,
        {
          httpStatus: response.status,
          traceHint,
          correlationId,
          requestId,
        },
      );
    }

    if (response.status === 401 && retryCount < config.sessionRefreshRetryCount) {
      callbacks.pushActivity('info', 'Session refresh', 'Received 401, attempting secure session refresh.');
      let refreshedToken = '';
      try {
        refreshedToken = await refreshSession(activeToken, { signal: requestSignal });
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        clearSession();
      }
      return request<T>(path, options, retryCount + 1, refreshedToken);
    }

    if (!response.ok) {
      const message = parseApiError(payload, response.status);
      const code = resolveApiErrorCode(payload, message);
      if (code) {
        callbacks.setErrorCode(code);
      }
      if (isSessionBootstrapBlockingCode(code)) {
        callbacks.setSessionBlocked(true);
      }
      throw createDashboardApiError(message, {
        code,
        httpStatus: response.status,
        traceHint,
        correlationId,
        requestId,
      });
    }

    callbacks.setErrorCode('');
    return (payload ?? {}) as T;
  };

  return {
    createSession,
    refreshSession,
    request,
    clearSession,
  };
}
