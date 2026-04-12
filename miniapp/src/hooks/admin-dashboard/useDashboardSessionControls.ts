import { useCallback } from 'react';
import type { MutableRefObject } from 'react';

import type { ActivityStatus } from '@/hooks/admin-dashboard/useDashboardActivityFeed';

type UseDashboardSessionControlsOptions = {
  triggerHaptic: (
    mode: 'selection' | 'impact' | 'success' | 'warning' | 'error',
    impactStyle?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
  ) => void;
  pushActivity: (status: ActivityStatus, title: string, detail: string) => void;
  setNoticeMessage: (value: string) => void;
  setPollingPaused: (value: boolean | ((prev: boolean) => boolean)) => void;
  loadBootstrap: () => Promise<void> | void;
  closeMiniApp: () => void;
  stateEpochRef: MutableRefObject<number>;
  bootstrapRequestSeqRef: MutableRefObject<number>;
  pollRequestSeqRef: MutableRefObject<number>;
  bootstrapAbortRef: MutableRefObject<AbortController | null>;
  pollAbortRef: MutableRefObject<AbortController | null>;
  clearSession: () => void;
  setError: (value: string) => void;
  setErrorCode: (value: string) => void;
  setSessionBlocked: (value: boolean) => void;
  setBootstrap: (value: null) => void;
  setPollPayload: (value: null) => void;
  setLastPollAt: (value: number | null) => void;
  setLastSuccessfulPollAt: (value: number | null) => void;
  setNextPollAt: (value: number | null) => void;
  setPollFailureCount: (value: number) => void;
  setActionLatencyMsSamples: (value: number[]) => void;
  setRuntimeCanaryInput: (value: string) => void;
  setSmsCostPerSegment: (value: string) => void;
  smsDefaultCostPerSegment: number;
  setSmsDryRunMode: (value: boolean) => void;
  setCallScriptsSnapshot: (value: null) => void;
  setSelectedCallScriptId: (value: number) => void;
  setScriptSimulationResult: (value: null) => void;
  resetProviderSwitchPlan: () => void;
  setSettingsOpen: (value: boolean) => void;
  clearActivityLog: () => void;
  pollFailureNotedRef: MutableRefObject<boolean>;
};

type UseDashboardSessionControlsResult = {
  handleRefresh: () => void;
  handleTogglePolling: () => void;
  handleCloseMiniApp: () => void;
  resetSession: () => void;
};

export function useDashboardSessionControls({
  triggerHaptic,
  pushActivity,
  setNoticeMessage,
  setPollingPaused,
  loadBootstrap,
  closeMiniApp,
  stateEpochRef,
  bootstrapRequestSeqRef,
  pollRequestSeqRef,
  bootstrapAbortRef,
  pollAbortRef,
  clearSession,
  setError,
  setErrorCode,
  setSessionBlocked,
  setBootstrap,
  setPollPayload,
  setLastPollAt,
  setLastSuccessfulPollAt,
  setNextPollAt,
  setPollFailureCount,
  setActionLatencyMsSamples,
  setRuntimeCanaryInput,
  setSmsCostPerSegment,
  smsDefaultCostPerSegment,
  setSmsDryRunMode,
  setCallScriptsSnapshot,
  setSelectedCallScriptId,
  setScriptSimulationResult,
  resetProviderSwitchPlan,
  setSettingsOpen,
  clearActivityLog,
  pollFailureNotedRef,
}: UseDashboardSessionControlsOptions): UseDashboardSessionControlsResult {
  const handleRefresh = useCallback((): void => {
    triggerHaptic('impact', 'light');
    pushActivity('info', 'Manual refresh', 'Operator triggered dashboard refresh.');
    void loadBootstrap();
  }, [loadBootstrap, pushActivity, triggerHaptic]);

  const handleTogglePolling = useCallback((): void => {
    triggerHaptic('selection');
    setPollingPaused((prev) => {
      const next = !prev;
      setNoticeMessage(next ? 'Live updates paused.' : 'Live updates resumed.');
      return next;
    });
  }, [setNoticeMessage, setPollingPaused, triggerHaptic]);

  const handleCloseMiniApp = useCallback((): void => {
    triggerHaptic('impact', 'light');
    closeMiniApp();
  }, [closeMiniApp, triggerHaptic]);

  const resetSession = useCallback((): void => {
    stateEpochRef.current += 1;
    bootstrapRequestSeqRef.current += 1;
    pollRequestSeqRef.current += 1;
    if (bootstrapAbortRef.current) {
      bootstrapAbortRef.current.abort();
      bootstrapAbortRef.current = null;
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
    triggerHaptic('warning');
    clearSession();
    setError('');
    setErrorCode('');
    setNoticeMessage('');
    setSessionBlocked(false);
    setBootstrap(null);
    setPollPayload(null);
    setLastPollAt(null);
    setLastSuccessfulPollAt(null);
    setNextPollAt(null);
    setPollFailureCount(0);
    setPollingPaused(false);
    setActionLatencyMsSamples([]);
    setRuntimeCanaryInput('');
    setSmsCostPerSegment(String(smsDefaultCostPerSegment));
    setSmsDryRunMode(false);
    setCallScriptsSnapshot(null);
    setSelectedCallScriptId(0);
    setScriptSimulationResult(null);
    resetProviderSwitchPlan();
    setSettingsOpen(false);
    clearActivityLog();
    pollFailureNotedRef.current = false;
    void loadBootstrap();
  }, [
    bootstrapAbortRef,
    bootstrapRequestSeqRef,
    clearActivityLog,
    clearSession,
    loadBootstrap,
    pollAbortRef,
    pollFailureNotedRef,
    pollRequestSeqRef,
    resetProviderSwitchPlan,
    setActionLatencyMsSamples,
    setBootstrap,
    setCallScriptsSnapshot,
    setError,
    setErrorCode,
    setLastPollAt,
    setLastSuccessfulPollAt,
    setNextPollAt,
    setNoticeMessage,
    setPollFailureCount,
    setPollPayload,
    setPollingPaused,
    setRuntimeCanaryInput,
    setScriptSimulationResult,
    setSelectedCallScriptId,
    setSessionBlocked,
    setSettingsOpen,
    setSmsCostPerSegment,
    setSmsDryRunMode,
    smsDefaultCostPerSegment,
    stateEpochRef,
    triggerHaptic,
  ]);

  return {
    handleRefresh,
    handleTogglePolling,
    handleCloseMiniApp,
    resetSession,
  };
}
