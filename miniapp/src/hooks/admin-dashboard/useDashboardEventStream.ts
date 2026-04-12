import { useEffect, useRef, useState } from 'react';

export type StreamConnectionMode = 'disabled' | 'connecting' | 'connected' | 'fallback';

type UseDashboardEventStreamOptions = {
  enabled: boolean;
  token: string | null;
  endpoints: string[];
  buildEventStreamUrl: (path: string) => string;
  applyStreamPayload: (raw: unknown) => boolean;
  refreshPoll: () => Promise<boolean>;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  refreshDebounceMs: number;
  staleAfterMs: number;
};

type UseDashboardEventStreamResult = {
  streamMode: StreamConnectionMode;
  streamConnected: boolean;
  streamFailureCount: number;
  streamLastEventAt: number | null;
};

export function useDashboardEventStream({
  enabled,
  token,
  endpoints,
  buildEventStreamUrl,
  applyStreamPayload,
  refreshPoll,
  reconnectBaseMs,
  reconnectMaxMs,
  refreshDebounceMs,
  staleAfterMs,
}: UseDashboardEventStreamOptions): UseDashboardEventStreamResult {
  const [streamMode, setStreamMode] = useState<StreamConnectionMode>('disabled');
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [streamFailureCount, setStreamFailureCount] = useState<number>(0);
  const [streamLastEventAt, setStreamLastEventAt] = useState<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const streamEndpoints = Array.isArray(endpoints)
      ? endpoints
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
      : [];
    const inactivityTimeoutMs = Number.isFinite(staleAfterMs)
      ? Math.max(5000, Math.floor(staleAfterMs))
      : 45000;
    if (!enabled || !token || streamEndpoints.length === 0) {
      setStreamMode('disabled');
      setStreamConnected(false);
      return undefined;
    }
    if (typeof EventSource === 'undefined') {
      setStreamMode('fallback');
      setStreamConnected(false);
      return undefined;
    }

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let activeStream: EventSource | null = null;
    let attemptCount = 0;
    let endpointIndex = 0;

    const closeStream = (): void => {
      if (activeStream) {
        activeStream.close();
        activeStream = null;
      }
    };
    const clearInactivityTimer = (): void => {
      if (!inactivityTimer) return;
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    };

    const scheduleStreamRefresh = (): void => {
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        void refreshPoll();
      }, refreshDebounceMs);
    };
    const scheduleReconnect = (): void => {
      if (reconnectTimer) return;
      const delay = Math.min(
        reconnectMaxMs,
        Math.round(reconnectBaseMs * Math.pow(1.5, Math.max(0, attemptCount - 1))),
      );
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };
    const markFallback = (): void => {
      setStreamMode('fallback');
      setStreamConnected(false);
      setStreamFailureCount((prev) => prev + 1);
      scheduleStreamRefresh();
    };
    const scheduleInactivityTimeout = (): void => {
      clearInactivityTimer();
      inactivityTimer = setTimeout(() => {
        if (disposed || !activeStream) return;
        closeStream();
        endpointIndex = 0;
        attemptCount += 1;
        markFallback();
        scheduleReconnect();
      }, inactivityTimeoutMs);
    };

    const connect = (): void => {
      if (disposed) return;
      setStreamMode('connecting');
      const nextEndpoint = streamEndpoints[Math.max(0, Math.min(endpointIndex, streamEndpoints.length - 1))];
      const streamUrl = buildEventStreamUrl(nextEndpoint);
      let source: EventSource;
      try {
        source = new EventSource(streamUrl);
      } catch {
        endpointIndex = 0;
        attemptCount += 1;
        markFallback();
        scheduleReconnect();
        return;
      }
      activeStream = source;

      source.onopen = () => {
        if (disposed) return;
        attemptCount = 0;
        setStreamMode('connected');
        setStreamConnected(true);
        setStreamFailureCount(0);
        scheduleInactivityTimeout();
      };

      source.onmessage = (event) => {
        if (disposed) return;
        setStreamLastEventAt(Date.now());
        scheduleInactivityTimeout();
        const eventText = typeof event.data === 'string' ? event.data : String(event.data ?? '');
        let parsed: unknown = eventText;
        try {
          parsed = JSON.parse(eventText);
        } catch {
          // Accept plain text event frames and trigger poll refresh below.
        }
        const applied = applyStreamPayload(parsed);
        if (!applied) {
          scheduleStreamRefresh();
        }
      };

      source.onerror = () => {
        if (disposed) return;
        closeStream();
        clearInactivityTimer();
        setStreamConnected(false);
        if (endpointIndex < streamEndpoints.length - 1) {
          endpointIndex += 1;
          connect();
          return;
        }
        endpointIndex = 0;
        attemptCount += 1;
        markFallback();
        scheduleReconnect();
      };
    };

    connect();
    return () => {
      disposed = true;
      closeStream();
      clearInactivityTimer();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [
    applyStreamPayload,
    buildEventStreamUrl,
    enabled,
    reconnectBaseMs,
    reconnectMaxMs,
    refreshDebounceMs,
    refreshPoll,
    staleAfterMs,
    token,
    endpoints,
  ]);

  return {
    streamMode,
    streamConnected,
    streamFailureCount,
    streamLastEventAt,
  };
}
