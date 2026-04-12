import { useEffect, useRef } from 'react';

type UseDashboardBootstrapLifecycleOptions = {
  loadBootstrap: () => Promise<void>;
  devFixturesEnabled: boolean;
  setNoticeMessage: (value: string) => void;
  pushActivity: (status: 'info' | 'success' | 'error', title: string, detail: string) => void;
};

export function useDashboardBootstrapLifecycle({
  loadBootstrap,
  devFixturesEnabled,
  setNoticeMessage,
  pushActivity,
}: UseDashboardBootstrapLifecycleOptions): void {
  const fixtureModeNotedRef = useRef<boolean>(false);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!devFixturesEnabled) return;
    if (fixtureModeNotedRef.current) return;
    fixtureModeNotedRef.current = true;
    setNoticeMessage('Dev fixture mode enabled: backend calls are bypassed for local QA.');
    pushActivity('info', 'Dev fixture mode', 'Using local dashboard fixture data.');
  }, [devFixturesEnabled, pushActivity, setNoticeMessage]);
}
