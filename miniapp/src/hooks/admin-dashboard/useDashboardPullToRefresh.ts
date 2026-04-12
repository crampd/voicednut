import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEventHandler,
} from 'react';

const PULL_TRIGGER_PX = 72;
const PULL_MAX_OFFSET_PX = 110;
const PULL_RESISTANCE = 0.52;
const TRIGGER_LINGER_MS = 420;
const REFRESH_LOCK_FAILSAFE_MS = 12000;

type UseDashboardPullToRefreshOptions = {
  onRefresh: () => void;
  disabled: boolean;
  refreshing: boolean;
  onReadyStateChange?: (ready: boolean) => void;
  onRelease?: (event: {
    triggeredRefresh: boolean;
    ready: boolean;
    offset: number;
  }) => void;
};

type UseDashboardPullToRefreshResult = {
  pullOffset: number;
  pullIndicatorVisible: boolean;
  pullReady: boolean;
  pullRefreshing: boolean;
  pullLabel: string;
  isPulling: boolean;
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchMove: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  onTouchCancel: TouchEventHandler<HTMLElement>;
};

function getWindowScrollTop(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(
    window.scrollY,
    document.documentElement?.scrollTop ?? 0,
    document.body?.scrollTop ?? 0,
  );
}

export function useDashboardPullToRefresh({
  onRefresh,
  disabled,
  refreshing,
  onReadyStateChange,
  onRelease,
}: UseDashboardPullToRefreshOptions): UseDashboardPullToRefreshResult {
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef<boolean>(false);
  const hideTriggeredTimerRef = useRef<number | null>(null);
  const refreshLockFailsafeTimerRef = useRef<number | null>(null);
  const pullReadyRef = useRef<boolean>(false);
  const refreshTriggerLockRef = useRef<boolean>(false);
  const [pullOffset, setPullOffset] = useState<number>(0);
  const [refreshTriggered, setRefreshTriggered] = useState<boolean>(false);

  const clearTriggeredTimer = useCallback((): void => {
    if (hideTriggeredTimerRef.current === null) return;
    window.clearTimeout(hideTriggeredTimerRef.current);
    hideTriggeredTimerRef.current = null;
  }, []);

  const clearRefreshLockFailsafe = useCallback((): void => {
    if (refreshLockFailsafeTimerRef.current === null) return;
    window.clearTimeout(refreshLockFailsafeTimerRef.current);
    refreshLockFailsafeTimerRef.current = null;
  }, []);

  const releaseRefreshLock = useCallback((): void => {
    refreshTriggerLockRef.current = false;
    clearRefreshLockFailsafe();
  }, [clearRefreshLockFailsafe]);

  useEffect(() => () => {
    clearTriggeredTimer();
    clearRefreshLockFailsafe();
  }, [clearRefreshLockFailsafe, clearTriggeredTimer]);

  useEffect(() => {
    if (!refreshTriggered || refreshing) return;
    clearTriggeredTimer();
    hideTriggeredTimerRef.current = window.setTimeout(() => {
      setRefreshTriggered(false);
    }, TRIGGER_LINGER_MS);
    return clearTriggeredTimer;
  }, [clearTriggeredTimer, refreshTriggered, refreshing]);

  useEffect(() => {
    if (refreshing || refreshTriggered) return;
    releaseRefreshLock();
  }, [refreshing, refreshTriggered, releaseRefreshLock]);

  const setReadyState = useCallback((ready: boolean): void => {
    if (pullReadyRef.current === ready) return;
    pullReadyRef.current = ready;
    onReadyStateChange?.(ready);
  }, [onReadyStateChange]);

  const resetPullState = useCallback((): void => {
    startYRef.current = null;
    pullingRef.current = false;
    setPullOffset(0);
    setReadyState(false);
  }, [setReadyState]);

  const onTouchStart = useCallback<TouchEventHandler<HTMLElement>>((event) => {
    if (disabled || refreshing || refreshTriggerLockRef.current) return;
    if (event.touches.length !== 1) return;
    if (getWindowScrollTop() > 0) return;
    startYRef.current = event.touches[0]?.clientY ?? null;
    pullingRef.current = startYRef.current !== null;
    if (pullingRef.current) {
      setReadyState(false);
    }
  }, [disabled, refreshing, setReadyState]);

  const onTouchMove = useCallback<TouchEventHandler<HTMLElement>>((event) => {
    if (!pullingRef.current || disabled || refreshing || refreshTriggerLockRef.current) return;
    const startY = startYRef.current;
    if (startY === null) return;
    const currentY = event.touches[0]?.clientY ?? startY;
    const deltaY = currentY - startY;
    if (deltaY <= 0) {
      setPullOffset(0);
      setReadyState(false);
      return;
    }
    if (getWindowScrollTop() > 0) {
      resetPullState();
      return;
    }
    event.preventDefault();
    const nextPullOffset = Math.min(PULL_MAX_OFFSET_PX, deltaY * PULL_RESISTANCE);
    setPullOffset(nextPullOffset);
    setReadyState(nextPullOffset >= PULL_TRIGGER_PX);
  }, [disabled, refreshing, resetPullState, setReadyState]);

  const onTouchEnd = useCallback<TouchEventHandler<HTMLElement>>(() => {
    if (!pullingRef.current) return;
    const releaseOffset = pullOffset;
    const releaseWasReady = releaseOffset >= PULL_TRIGGER_PX;
    const shouldTriggerRefresh = releaseWasReady
      && !disabled
      && !refreshing
      && !refreshTriggerLockRef.current;
    resetPullState();
    if (shouldTriggerRefresh) {
      refreshTriggerLockRef.current = true;
      clearRefreshLockFailsafe();
      refreshLockFailsafeTimerRef.current = window.setTimeout(() => {
        refreshLockFailsafeTimerRef.current = null;
        refreshTriggerLockRef.current = false;
        setRefreshTriggered(false);
      }, REFRESH_LOCK_FAILSAFE_MS);
      clearTriggeredTimer();
      setRefreshTriggered(true);
      try {
        onRefresh();
      } catch {
        releaseRefreshLock();
        setRefreshTriggered(false);
      }
      onRelease?.({
        triggeredRefresh: true,
        ready: releaseWasReady,
        offset: releaseOffset,
      });
      return;
    }
    onRelease?.({
      triggeredRefresh: false,
      ready: releaseWasReady,
      offset: releaseOffset,
    });
    if (!refreshing) {
      setRefreshTriggered(false);
    }
  }, [
    clearTriggeredTimer,
    clearRefreshLockFailsafe,
    disabled,
    onRefresh,
    onRelease,
    pullOffset,
    refreshing,
    releaseRefreshLock,
    resetPullState,
  ]);

  const onTouchCancel = useCallback<TouchEventHandler<HTMLElement>>(() => {
    const releaseOffset = pullOffset;
    const releaseWasReady = releaseOffset >= PULL_TRIGGER_PX;
    resetPullState();
    onRelease?.({
      triggeredRefresh: false,
      ready: releaseWasReady,
      offset: releaseOffset,
    });
    if (!refreshing) {
      setRefreshTriggered(false);
    }
  }, [onRelease, pullOffset, refreshing, resetPullState]);

  const pullReady = pullOffset >= PULL_TRIGGER_PX;
  const pullRefreshing = refreshing || refreshTriggered;

  return {
    pullOffset,
    pullIndicatorVisible: pullOffset > 0 || pullRefreshing,
    pullReady,
    pullRefreshing,
    pullLabel: pullRefreshing
      ? 'Refreshing dashboard...'
      : pullReady
        ? 'Release to refresh'
        : 'Pull to refresh',
    isPulling: pullOffset > 0 && !refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
}
