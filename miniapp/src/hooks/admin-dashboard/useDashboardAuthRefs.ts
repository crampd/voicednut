import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

type UseDashboardAuthRefsOptions = {
  token: string | null;
  initDataRaw: string | null | undefined;
};

type UseDashboardAuthRefsResult = {
  tokenRef: MutableRefObject<string | null>;
  initDataRawRef: MutableRefObject<string>;
};

export function useDashboardAuthRefs({
  token,
  initDataRaw,
}: UseDashboardAuthRefsOptions): UseDashboardAuthRefsResult {
  const tokenRef = useRef<string | null>(token);
  const initDataRawRef = useRef<string>(initDataRaw || '');

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    initDataRawRef.current = initDataRaw || '';
  }, [initDataRaw]);

  return {
    tokenRef,
    initDataRawRef,
  };
}
