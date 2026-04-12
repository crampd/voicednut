import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type ActivityStatus = 'info' | 'success' | 'error';

export interface ActivityEntry {
  id: string;
  title: string;
  detail: string;
  status: ActivityStatus;
  at: string;
}

type UseDashboardActivityFeedOptions = {
  setActivityLog: Dispatch<SetStateAction<ActivityEntry[]>>;
  maxItems: number;
  infoDedupeMs: number;
};

type UseDashboardActivityFeedResult = {
  pushActivity: (status: ActivityStatus, title: string, detail: string) => void;
  clearActivityLog: () => void;
};

const INITIAL_ACTIVITY_STATE = {
  signature: '',
  at: 0,
  repeats: 0,
};

export function useDashboardActivityFeed({
  setActivityLog,
  maxItems,
  infoDedupeMs,
}: UseDashboardActivityFeedOptions): UseDashboardActivityFeedResult {
  const lastActivityRef = useRef<{ signature: string; at: number; repeats: number }>(INITIAL_ACTIVITY_STATE);

  const pushActivity = useCallback((
    status: ActivityStatus,
    title: string,
    detail: string,
  ): void => {
    const now = Date.now();
    const signature = `${status}:${title}:${detail}`;
    if (status === 'info'
      && lastActivityRef.current.signature === signature
      && (now - lastActivityRef.current.at) < infoDedupeMs) {
      const nextRepeats = lastActivityRef.current.repeats + 1;
      lastActivityRef.current = {
        signature,
        at: now,
        repeats: nextRepeats,
      };
      setActivityLog((prev) => {
        if (prev.length === 0) return prev;
        const [first, ...rest] = prev;
        const baseDetail = first.detail.replace(/ \(x\d+\)$/, '');
        if (first.status !== status || first.title !== title || baseDetail !== detail) {
          return prev;
        }
        return [{
          ...first,
          detail: `${detail} (x${nextRepeats})`,
          at: new Date(now).toISOString(),
        }, ...rest];
      });
      return;
    }
    lastActivityRef.current = {
      signature: status === 'info' ? signature : '',
      at: now,
      repeats: 1,
    };
    const entry: ActivityEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      detail,
      status,
      at: new Date(now).toISOString(),
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, maxItems));
  }, [infoDedupeMs, maxItems, setActivityLog]);

  const clearActivityLog = useCallback((): void => {
    lastActivityRef.current = INITIAL_ACTIVITY_STATE;
    setActivityLog([]);
  }, [setActivityLog]);

  return {
    pushActivity,
    clearActivityLog,
  };
}
