import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

type UseDashboardAbortCleanupOptions = {
  bootstrapAbortRef: MutableRefObject<AbortController | null>;
  pollAbortRef: MutableRefObject<AbortController | null>;
};

export function useDashboardAbortCleanup({
  bootstrapAbortRef,
  pollAbortRef,
}: UseDashboardAbortCleanupOptions): void {
  useEffect(() => () => {
    bootstrapAbortRef.current?.abort();
    pollAbortRef.current?.abort();
  }, [bootstrapAbortRef, pollAbortRef]);
}
