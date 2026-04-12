import { initData, miniApp, settingsButton, useRawInitData, useSignal } from '@tma.js/sdk-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import '@/pages/AdminDashboard/AdminDashboardPage.css';
import {
  DashboardActionDialog,
  resolveDashboardDialogDismissValue,
} from '@/components/admin-dashboard/DashboardActionDialog';
import { ProviderChannelCard } from '@/components/admin-dashboard/ProviderChannelCard';
import { DashboardShellFrame } from '@/components/admin-dashboard/DashboardShellFrame';
import { DashboardSettingsStage } from '@/components/admin-dashboard/DashboardSettingsStage';
import { DashboardTopShell } from '@/components/admin-dashboard/DashboardTopShell';
import { DashboardViewStage } from '@/components/admin-dashboard/DashboardViewStage';
import {
  asRecord,
  formatTime,
  textBar,
  toInt,
  toText,
} from '@/services/admin-dashboard/dashboardPrimitives';
import {
  buildEventStreamUrl,
  isNgrokApiBase,
  resolveRealtimeTransportContract,
} from '@/services/admin-dashboard/dashboardTransport';
import {
  createDashboardApiClient,
} from '@/services/admin-dashboard/dashboardApiClient';
import { buildDashboardVm } from '@/services/admin-dashboard/dashboardVm/buildDashboardVm';
import { buildGovernanceVmSection } from '@/services/admin-dashboard/dashboardVm/buildGovernanceVmSection';
import { buildMailerVmSection } from '@/services/admin-dashboard/dashboardVm/buildMailerVmSection';
import { buildOpsVmSection } from '@/services/admin-dashboard/dashboardVm/buildOpsVmSection';
import { buildProviderVmSection } from '@/services/admin-dashboard/dashboardVm/buildProviderVmSection';
import { buildSmsVmSection } from '@/services/admin-dashboard/dashboardVm/buildSmsVmSection';
import {
  useDashboardAbortCleanup,
} from '@/hooks/admin-dashboard/useDashboardAbortCleanup';
import {
  useDashboardActions,
} from '@/hooks/admin-dashboard/useDashboardActions';
import type { ActionRequestMeta } from '@/hooks/admin-dashboard/useDashboardActions';
import type { ActivityEntry } from '@/hooks/admin-dashboard/useDashboardActivityFeed';
import { useDashboardActivityFeed } from '@/hooks/admin-dashboard/useDashboardActivityFeed';
import {
  useDashboardAuthRefs,
} from '@/hooks/admin-dashboard/useDashboardAuthRefs';
import { useDashboardEventStream } from '@/hooks/admin-dashboard/useDashboardEventStream';
import {
  useDashboardFeatureFlags,
} from '@/hooks/admin-dashboard/useDashboardFeatureFlags';
import {
  useDashboardFocusManagement,
} from '@/hooks/admin-dashboard/useDashboardFocusManagement';
import {
  useDashboardModuleLayout,
} from '@/hooks/admin-dashboard/useDashboardModuleLayout';
import {
  useDashboardModuleRouteGuards,
} from '@/hooks/admin-dashboard/useDashboardRouteGuards';
import {
  useDashboardMessagingMetrics,
} from '@/hooks/admin-dashboard/useDashboardMessageMetrics';
import {
  useDashboardMessagingActions,
} from '@/hooks/admin-dashboard/useDashboardMessageActions';
import {
  useDashboardGovernanceData,
} from '@/hooks/admin-dashboard/useDashboardGovernanceData';
import {
  useDashboardGovernanceActions,
} from '@/hooks/admin-dashboard/useDashboardGovActions';
import {
  useDashboardCallScriptActions,
} from '@/hooks/admin-dashboard/useDashboardScriptActions';
import {
  useDashboardCallScriptSelectionSync,
} from '@/hooks/admin-dashboard/useDashboardCallScriptSync';
import {
  useDashboardBootstrapLifecycle,
} from '@/hooks/admin-dashboard/useDashboardBootstrap';
import {
  useDashboardStoredPrefs,
} from '@/hooks/admin-dashboard/useDashboardStoredPrefs';
import {
  useDashboardWorkspaceRouteSync,
} from '@/hooks/admin-dashboard/useDashboardWorkspaceSync';
import { useDashboardTelegramButtons } from '@/hooks/admin-dashboard/useDashboardTelegramButtons';
import {
  useDashboardRuntimeControls,
} from '@/hooks/admin-dashboard/useDashboardRuntimeControls';
import {
  useDashboardOpsMetrics,
} from '@/hooks/admin-dashboard/useDashboardOpsMetrics';
import {
  useDashboardProviderMetrics,
} from '@/hooks/admin-dashboard/useDashboardProviderMetrics';
import {
  useDashboardProviderSwitchDefaults,
} from '@/hooks/admin-dashboard/useDashboardProviderDefaults';
import {
  useDashboardProviderActions,
} from '@/hooks/admin-dashboard/useDashboardProviderActions';
import { useDashboardHaptic } from '@/hooks/admin-dashboard/useDashboardHaptic';
import { useDashboardNotice } from '@/hooks/admin-dashboard/useDashboardNotice';
import { useDashboardPollingLoop } from '@/hooks/admin-dashboard/useDashboardPollingLoop';
import { useDashboardPullToRefresh } from '@/hooks/admin-dashboard/useDashboardPullToRefresh';
import { useDashboardRecipientsImport } from '@/hooks/admin-dashboard/useDashboardRecipientImport';
import { useDashboardSessionControls } from '@/hooks/admin-dashboard/useDashboardSessionControls';
import { useDashboardKeyboardShortcuts } from '@/hooks/admin-dashboard/useDashboardShortcuts';
import {
  DEFAULT_DASHBOARD_AUTH_TELEMETRY,
  type DashboardAuthTelemetry,
  type DashboardSyncFailureDiagnostics,
  useDashboardSyncLoaders,
} from '@/hooks/admin-dashboard/useDashboardSyncLoaders';
import {
  createDefaultProviderSwitchPlanByChannel,
} from '@/hooks/admin-dashboard/providerSwitchPlanState';
import type { DashboardDialogState } from '@/hooks/admin-dashboard/useDashboardDialog';
import { useDashboardDialog } from '@/hooks/admin-dashboard/useDashboardDialog';
import {
  selectCallScriptByIdMemoized,
  selectSmsRouteSimulationRowsMemoized,
} from '@/pages/AdminDashboard/shellSelectors';
import {
  asAuditRows,
  asCallLogRows,
  asCallScripts,
  asDlqCallRows,
  asDlqEmailRows,
  asEmailJobs,
  asIncidentRows,
  asMiniAppUsers,
  asOpsQaSummary,
  asRunbooks,
  asStringList,
  createActionRequestMeta,
} from '@/pages/AdminDashboard/dashboardPayloadHelpers';
import {
  FEATURE_FLAG_REGISTRY,
  MODULE_CONTEXT,
  MODULE_DEFAULT_ORDER,
  MODULE_DEFINITIONS,
  MODULE_GROUPS,
  MODULE_ID_SET,
  moduleRoutePath,
  parseWorkspaceRoute,
  resolveWorkspaceRouteFallbackPath,
  type DashboardModule,
} from '@/pages/AdminDashboard/dashboardShellConfig';
import {
  resolveTelegramIdentity,
  type DashboardNoticeTone,
} from '@/pages/AdminDashboard/dashboardShellHelpers';
import { resolveDashboardFixtureRequest } from '@/pages/AdminDashboard/dashboardFixtureData';
import {
  DASHBOARD_ACTION_CONTRACTS,
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
} from '@/contracts/miniappParityContracts';
import type { ProviderChannel, ProviderSwitchPlan } from '@/pages/AdminDashboard/types';
import type {
  CallScriptSimulationPayload,
  CallScriptsPayload,
  DashboardApiPayload,
  MiniAppAuditPayload,
  MiniAppIncidentsPayload,
  MiniAppSessionSummary,
  MiniAppUsersPayload,
  SessionState,
} from '@/pages/AdminDashboard/dashboardPayloadTypes';

const POLL_BASE_INTERVAL_MS = 10000;
const POLL_MAX_INTERVAL_MS = 60000;
const POLL_BACKOFF_MULTIPLIER = 1.7;
const POLL_JITTER_MS = 1200;
const POLL_DEGRADED_FAILURES = 2;
const SESSION_STORAGE_KEY = 'voxly-miniapp-session';
const MAX_ACTIVITY_ITEMS = 18;
const ACTION_LATENCY_SAMPLE_LIMIT = 40;
const STREAM_RECONNECT_BASE_MS = 2500;
const STREAM_RECONNECT_MAX_MS = 30000;
const STREAM_REFRESH_DEBOUNCE_MS = 350;
const STREAM_STALE_FALLBACK_MS = 45000;
const SMS_DEFAULT_COST_PER_SEGMENT = 0.0075;
const ACTIVITY_INFO_DEDUPE_MS = 8000;
const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '',
).trim().replace(/\/+$/, '');
const API_BASE_IS_NGROK = isNgrokApiBase(API_BASE_URL);
const NGROK_BYPASS_HEADER = 'ngrok-skip-browser-warning';
const SESSION_REFRESH_RETRY_COUNT = 1;
const DASHBOARD_DEV_FIXTURES_ENABLED = import.meta.env.DEV && ['1', 'true', 'yes']
  .includes(String(import.meta.env.VITE_ADMIN_DASHBOARD_DEV_FIXTURES || '').trim().toLowerCase());

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function AdminDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceRoute = useMemo(
    () => (
      parseWorkspaceRoute(location.pathname)
      || parseWorkspaceRoute(location.hash.replace(/^#/, ''))
    ),
    [location.hash, location.pathname],
  );
  const focusedWorkspaceMode = workspaceRoute !== null;

  const initDataRawFromHook = useRawInitData();
  const initDataRaw = initDataRawFromHook;
  const initDataState = useSignal(initData.state) as SessionState | undefined;
  const settingsButtonSupported = useSignal(settingsButton.isSupported);
  const settingsButtonMounted = useSignal(settingsButton.isMounted);
  const settingsButtonVisible = useSignal(settingsButton.isVisible);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [noticeTone, setNoticeTone] = useState<DashboardNoticeTone>('info');
  const [bootstrap, setBootstrap] = useState<DashboardApiPayload | null>(null);
  const [pollPayload, setPollPayload] = useState<DashboardApiPayload | null>(null);
  const [busyAction, setBusyAction] = useState<string>('');
  const [pollFailureCount, setPollFailureCount] = useState<number>(0);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [lastSuccessfulPollAt, setLastSuccessfulPollAt] = useState<number | null>(null);
  const [nextPollAt, setNextPollAt] = useState<number | null>(null);
  const [refreshFailureDiagnostics, setRefreshFailureDiagnostics] = useState<DashboardSyncFailureDiagnostics | null>(null);
  const [authTelemetry, setAuthTelemetry] = useState<DashboardAuthTelemetry>(DEFAULT_DASHBOARD_AUTH_TELEMETRY);
  const [sessionBlocked, setSessionBlocked] = useState<boolean>(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [actionLatencyMsSamples, setActionLatencyMsSamples] = useState<number[]>([]);
  const [activeModule, setActiveModule] = useState<DashboardModule>('ops');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [pollingPaused, setPollingPaused] = useState<boolean>(false);
  const [smsRecipientsInput, setSmsRecipientsInput] = useState<string>('');
  const [smsMessageInput, setSmsMessageInput] = useState<string>('');
  const [smsScheduleAt, setSmsScheduleAt] = useState<string>('');
  const [smsProviderInput, setSmsProviderInput] = useState<string>('');
  const [smsCostPerSegment, setSmsCostPerSegment] = useState<string>(String(SMS_DEFAULT_COST_PER_SEGMENT));
  const [smsDryRunMode, setSmsDryRunMode] = useState<boolean>(false);
  const [mailerRecipientsInput, setMailerRecipientsInput] = useState<string>('');
  const [mailerSubjectInput, setMailerSubjectInput] = useState<string>('');
  const [mailerHtmlInput, setMailerHtmlInput] = useState<string>('');
  const [mailerTextInput, setMailerTextInput] = useState<string>('');
  const [mailerTemplateIdInput, setMailerTemplateIdInput] = useState<string>('');
  const [mailerVariablesInput, setMailerVariablesInput] = useState<string>('{}');
  const [mailerScheduleAt, setMailerScheduleAt] = useState<string>('');
  const [runtimeCanaryInput, setRuntimeCanaryInput] = useState<string>('');
  const [scriptFlowFilter, setScriptFlowFilter] = useState<string>('');
  const [callScriptsSnapshot, setCallScriptsSnapshot] = useState<CallScriptsPayload | null>(null);
  const [selectedCallScriptId, setSelectedCallScriptId] = useState<number>(0);
  const [scriptNameInput, setScriptNameInput] = useState<string>('');
  const [scriptDescriptionInput, setScriptDescriptionInput] = useState<string>('');
  const [scriptDefaultProfileInput, setScriptDefaultProfileInput] = useState<string>('');
  const [scriptPromptInput, setScriptPromptInput] = useState<string>('');
  const [scriptFirstMessageInput, setScriptFirstMessageInput] = useState<string>('');
  const [scriptObjectiveTagsInput, setScriptObjectiveTagsInput] = useState<string>('');
  const [scriptReviewNoteInput, setScriptReviewNoteInput] = useState<string>('');
  const [scriptSimulationVariablesInput, setScriptSimulationVariablesInput] = useState<string>('{}');
  const [scriptSimulationResult, setScriptSimulationResult] = useState<CallScriptSimulationPayload | null>(null);
  const [providerPreflightBusy, setProviderPreflightBusy] = useState<string>('');
  const [providerPreflightRows, setProviderPreflightRows] = useState<Record<string, string>>({});
  const [providerRollbackByChannel, setProviderRollbackByChannel] = useState<
    Partial<Record<ProviderChannel, string>>
  >({});
  const [providerSwitchPlanByChannel, setProviderSwitchPlanByChannel] = useState<
    Record<ProviderChannel, ProviderSwitchPlan>
  >(createDefaultProviderSwitchPlanByChannel);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userSortBy, setUserSortBy] = useState<string>('last_activity');
  const [userSortDir, setUserSortDir] = useState<string>('desc');
  const [usersSnapshot, setUsersSnapshot] = useState<MiniAppUsersPayload | null>(null);
  const [auditSnapshot, setAuditSnapshot] = useState<MiniAppAuditPayload | null>(null);
  const [incidentsSnapshot, setIncidentsSnapshot] = useState<MiniAppIncidentsPayload | null>(null);
  const {
    dialogState,
    dialogInputValue,
    dialogInputError,
    setDialogInputValue,
    setDialogInputError,
    closeDialog,
    openConfirmDialog,
    openPromptDialog,
    handleDialogConfirm,
  } = useDashboardDialog();
  const pollFailureNotedRef = useRef<boolean>(false);
  const bootstrapRequestSeqRef = useRef<number>(0);
  const pollRequestSeqRef = useRef<number>(0);
  const stateEpochRef = useRef<number>(0);
  const bootstrapAbortRef = useRef<AbortController | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const initialServerModuleAppliedRef = useRef<boolean>(false);
  const {
    actionDialogRef,
    dialogCancelButtonRef,
    restoreFocusSelectorRef,
    shouldRestoreFocusRef,
    shouldFocusStageRef,
  } = useDashboardFocusManagement({
    activeModule,
    settingsOpen,
    dialogState,
  });
  const dismissDialog = useCallback((state: DashboardDialogState | null): void => {
    if (!state) return;
    closeDialog(resolveDashboardDialogDismissValue(state));
  }, [closeDialog]);

  useDashboardAbortCleanup({
    bootstrapAbortRef,
    pollAbortRef,
  });

  const { triggerHaptic } = useDashboardHaptic();

  const toggleSettings = useCallback((next?: boolean, options?: { fallbackModule?: DashboardModule }): void => {
    const target = typeof next === 'boolean' ? next : !settingsOpen;
    setSettingsOpen((prev) => {
      if (!prev && target) {
        if (typeof document !== 'undefined') {
          const activeElement = document.activeElement as HTMLElement | null;
          if (activeElement?.id) {
            restoreFocusSelectorRef.current = `#${activeElement.id}`;
          } else {
            restoreFocusSelectorRef.current = `#va-launcher-module-${activeModule}, #va-view-stage-root`;
          }
        }
      }
      if (prev && !target) {
        shouldRestoreFocusRef.current = true;
      }
      return target;
    });
    if (target === settingsOpen) return;
    triggerHaptic('selection');
    if (target) {
      if (location.pathname !== DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS) {
        navigate(DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS);
      }
      return;
    }
    const fallbackModule = options?.fallbackModule || activeModule;
    const fallbackPath = focusedWorkspaceMode
      ? moduleRoutePath(fallbackModule)
      : DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT;
    if (location.pathname !== fallbackPath) {
      navigate(fallbackPath);
    }
  }, [
    activeModule,
    focusedWorkspaceMode,
    location.pathname,
    navigate,
    settingsOpen,
    triggerHaptic,
  ]);

  const selectModule = useCallback((moduleId: DashboardModule, options?: { fromKeyboard?: boolean }): void => {
    setActiveModule((prev) => {
      if (prev === moduleId) return prev;
      if (options?.fromKeyboard) {
        shouldFocusStageRef.current = true;
      }
      triggerHaptic('selection');
      return moduleId;
    });
    const targetPath = moduleRoutePath(moduleId);
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  }, [location.pathname, navigate, triggerHaptic]);

  const returnToHome = useCallback((): void => {
    setSettingsOpen((prev) => {
      if (prev) {
        shouldRestoreFocusRef.current = true;
      }
      return false;
    });
    setActiveModule('ops');
    if (location.pathname !== DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT) {
      navigate(DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT);
    }
  }, [location.pathname, navigate]);

  const { pushActivity, clearActivityLog } = useDashboardActivityFeed({
    setActivityLog,
    maxItems: MAX_ACTIVITY_ITEMS,
    infoDedupeMs: ACTIVITY_INFO_DEDUPE_MS,
  });

  const { setNoticeMessage } = useDashboardNotice({
    setNotice,
    setNoticeTone,
  });

  const { userLabel, userAvatarUrl, userAvatarFallback } = useMemo(() => {
    const pollSession = asRecord(pollPayload?.session);
    const bootstrapSession = asRecord(bootstrap?.session);
    const dashboardRoot = asRecord(bootstrap?.dashboard);
    const dashboardSession = asRecord(dashboardRoot.session);
    return resolveTelegramIdentity([
      asRecord(initDataState?.user),
      asRecord(pollSession.user),
      asRecord(bootstrapSession.user),
      asRecord(dashboardSession.user),
      asRecord(asRecord(pollPayload).user),
      asRecord(asRecord(bootstrap).user),
      asRecord(dashboardRoot.user),
    ]);
  }, [bootstrap, initDataState, pollPayload]);

  useDashboardStoredPrefs({
    activeModule,
    userSearch,
    userSortBy,
    userSortDir,
    setActiveModule,
    setUserSearch,
    setUserSortBy,
    setUserSortDir,
    moduleIdSet: MODULE_ID_SET,
    initialServerModuleAppliedRef,
  });

  useDashboardWorkspaceRouteSync({
    workspaceRoute,
    activeModule,
    setSettingsOpen,
    setActiveModule,
    initialServerModuleAppliedRef,
  });

  const { tokenRef, initDataRawRef } = useDashboardAuthRefs({
    token,
    initDataRaw,
  });
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
      setSessionBlocked,
      pushActivity,
    },
  ), [pushActivity]);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    if (DASHBOARD_DEV_FIXTURES_ENABLED) {
      return resolveDashboardFixtureRequest(path, options) as T;
    }
    return dashboardApiClient.request<T>(path, options);
  }, [dashboardApiClient]);

  const {
    loadBootstrap,
    loadPoll,
    applyStreamPayload,
  } = useDashboardSyncLoaders({
    request,
    pushActivity,
    stateEpochRef,
    bootstrapRequestSeqRef,
    pollRequestSeqRef,
    bootstrapAbortRef,
    pollAbortRef,
    pollFailureNotedRef,
    setLoading,
    setError,
    setPollFailureCount,
    setRefreshFailureDiagnostics,
    setAuthTelemetry,
    setBootstrap,
    setPollPayload,
    setLastPollAt,
    setLastSuccessfulPollAt,
    setUsersSnapshot,
    setAuditSnapshot,
    setIncidentsSnapshot,
    setCallScriptsSnapshot,
    setRuntimeCanaryInput,
  });

  const createActionMeta = useCallback((action: string): ActionRequestMeta => (
    createActionRequestMeta(action, activeModule)
  ), [activeModule]);
  const sessionCapsForActionGuards = useMemo(() => {
    const pollSession = asRecord(pollPayload?.session);
    const bootstrapSession = asRecord(bootstrap?.session);
    const dashboardSession = asRecord(asRecord(bootstrap?.dashboard).session);
    return asStringList(pollSession.caps || bootstrapSession.caps || dashboardSession.caps);
  }, [bootstrap?.dashboard, bootstrap?.session, pollPayload?.session]);
  const hasActionCapability = useCallback((capability: string): boolean => {
    const normalized = String(capability || '').trim().toLowerCase();
    if (!normalized) return true;
    if (sessionCapsForActionGuards.length === 0) return true;
    return sessionCapsForActionGuards.includes(normalized);
  }, [sessionCapsForActionGuards]);

  const { invokeAction, runAction, actionTelemetry } = useDashboardActions({
    createActionMeta,
    request,
    loadBootstrap,
    pushActivity,
    triggerHaptic,
    setBusyAction,
    setNotice: setNoticeMessage,
    setError,
    setActionLatencyMsSamples,
    actionLatencySampleLimit: ACTION_LATENCY_SAMPLE_LIMIT,
    confirmAction: openConfirmDialog,
    hasCapability: hasActionCapability,
  });
  const {
    featureFlags,
    featureFlagsSourceLabel,
    featureFlagsUpdatedAtLabel,
    isFeatureEnabled,
    realtimeStreamEnabled,
    moduleSkeletonsEnabled,
    moduleErrorBoundariesEnabled,
  } = useDashboardFeatureFlags({
    pollPayload,
    bootstrap,
    registry: FEATURE_FLAG_REGISTRY,
  });

  useDashboardBootstrapLifecycle({
    loadBootstrap,
    devFixturesEnabled: DASHBOARD_DEV_FIXTURES_ENABLED,
    setNoticeMessage,
    pushActivity,
  });

  useDashboardTelegramButtons({
    settingsButtonSupported,
    toggleSettings,
    returnToHome,
    dialogState,
    dismissDialog,
    triggerHaptic,
    settingsOpen,
    focusedWorkspaceMode,
    activeModule,
  });

  const serverPollIntervalMs = useMemo(() => {
    const intervalSeconds = Number(bootstrap?.poll_interval_seconds);
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
      return POLL_BASE_INTERVAL_MS;
    }
    return Math.max(3000, Math.min(POLL_MAX_INTERVAL_MS, Math.floor(intervalSeconds * 1000)));
  }, [bootstrap?.poll_interval_seconds]);
  const realtimeTransport = useMemo(
    () => resolveRealtimeTransportContract(pollPayload, bootstrap),
    [bootstrap, pollPayload],
  );
  const resolveEventStreamUrl = useCallback((path: string): string => (
    buildEventStreamUrl(path, API_BASE_URL, {
      authMode: realtimeTransport.authMode,
      authQueryParam: realtimeTransport.authQueryParam,
      token,
    })
  ), [realtimeTransport.authMode, realtimeTransport.authQueryParam, token]);
  const streamStaleAfterMs = Math.max(STREAM_STALE_FALLBACK_MS, serverPollIntervalMs * 3);

  const {
    streamMode,
    streamConnected,
    streamFailureCount,
    streamLastEventAt,
  } = useDashboardEventStream({
    enabled: realtimeStreamEnabled
      && realtimeTransport.enabled
      && !sessionBlocked
      && !pollingPaused
      && !API_BASE_IS_NGROK,
    token,
    endpoints: realtimeTransport.endpoints,
    buildEventStreamUrl: resolveEventStreamUrl,
    applyStreamPayload,
    refreshPoll: loadPoll,
    reconnectBaseMs: STREAM_RECONNECT_BASE_MS,
    reconnectMaxMs: STREAM_RECONNECT_MAX_MS,
    refreshDebounceMs: STREAM_REFRESH_DEBOUNCE_MS,
    staleAfterMs: streamStaleAfterMs,
  });

  useDashboardPollingLoop({
    enabled: Boolean(token) && !sessionBlocked && !pollingPaused && !streamConnected,
    baseIntervalMs: serverPollIntervalMs,
    loadPoll,
    setNextPollAt,
    maxIntervalMs: POLL_MAX_INTERVAL_MS,
    backoffMultiplier: POLL_BACKOFF_MULTIPLIER,
    jitterMs: POLL_JITTER_MS,
  });

  const dashboard = bootstrap?.dashboard;
  const providerPayload = pollPayload?.provider || dashboard?.provider || {};
  const providersByChannel = providerPayload.providers || {};
  const providerCompatibilityPayload =
    pollPayload?.provider_compatibility || dashboard?.provider_compatibility || {};
  const providerCompatibilityRoot = asRecord(
    asRecord(providerCompatibilityPayload).compatibility || providerCompatibilityPayload,
  );
  const providerCompatibilityChannels = asRecord(providerCompatibilityRoot.channels);
  const smsPayload = pollPayload?.sms_bulk || dashboard?.sms_bulk || {};
  const smsSummary = smsPayload.summary || {};
  const emailStatsPayload = pollPayload?.email_bulk_stats || dashboard?.email_bulk_stats || {};
  const emailStats = emailStatsPayload.stats || {};
  const emailHistoryPayload = pollPayload?.email_bulk_history || dashboard?.email_bulk_history || {};
  const emailJobs = asEmailJobs(emailHistoryPayload.jobs);
  const dlqPayload = pollPayload?.dlq || dashboard?.dlq || {};
  const callLogsPayload = pollPayload?.call_logs || dashboard?.call_logs || {};
  const callScriptsPayload = callScriptsSnapshot || pollPayload?.call_scripts || dashboard?.call_scripts || {};
  const callStatsPayload = pollPayload?.call_stats || dashboard?.call_stats || {};
  const voiceRuntimePayload = pollPayload?.voice_runtime || dashboard?.voice_runtime || {};
  const opsPayload = pollPayload?.ops || dashboard?.ops || {};
  const opsQueueBacklog = opsPayload.queue_backlog || {};
  const opsQaSummary = asOpsQaSummary(opsPayload.qa);
  const usersPayload = usersSnapshot || dashboard?.users || {};
  const auditPayload = auditSnapshot || dashboard?.audit || {};
  const incidentsPayload = incidentsSnapshot || dashboard?.incidents || {};
  const sessionPayload = asRecord(
    pollPayload?.session || bootstrap?.session || dashboard?.session || {},
  ) as MiniAppSessionSummary;
  const callDlq = asDlqCallRows(dlqPayload.call_preview);
  const emailDlq = asDlqEmailRows(dlqPayload.email_preview);
  const callLogs = asCallLogRows(callLogsPayload.rows);
  const callScripts = asCallScripts(callScriptsPayload.scripts);
  const usersRows = asMiniAppUsers(usersPayload.rows);
  const auditRows = asAuditRows(auditPayload.rows);
  const incidentRows = asIncidentRows(incidentsPayload.alerts);
  const runbookRows = asRunbooks(incidentsPayload.runbooks);
  const sessionRole = toText(sessionPayload.role, 'viewer').toLowerCase();
  const sessionRoleSource = toText(sessionPayload.role_source, 'inferred');
  const sessionCaps = asStringList(sessionPayload.caps);
  const dashboardLayoutPayload = pollPayload?.module_layout
    || bootstrap?.module_layout
    || dashboard?.module_layout
    || {};
  const moduleDefinitionsPayload = pollPayload?.modules
    || bootstrap?.modules
    || dashboard?.modules
    || {};
  const {
    hasCapability,
    visibleModules,
    preferredServerModule,
  } = useDashboardModuleLayout<DashboardModule>({
    sessionCaps,
    dashboardLayoutPayload,
    moduleDefinitionsPayload,
    moduleDefinitions: MODULE_DEFINITIONS,
    moduleDefaultOrder: MODULE_DEFAULT_ORDER,
    moduleIdSet: MODULE_ID_SET,
  });
  const settingsStatusLabel = !settingsButtonSupported
    ? 'Unsupported'
    : settingsButtonMounted
      ? settingsButtonVisible
        ? 'Visible'
        : 'Mounted'
      : 'Pending';

  useDashboardModuleRouteGuards({
    activeModule,
    setActiveModule,
    visibleModules,
    workspaceRoute,
    locationPathname: location.pathname,
    navigate,
    preferredServerModule,
    workspaceRouteFallbackPath: resolveWorkspaceRouteFallbackPath,
    initialServerModuleAppliedRef,
    routeAccessReady: !loading,
  });
  const activeModuleMeta = MODULE_CONTEXT[activeModule] || MODULE_CONTEXT.ops;
  const activeModuleLabel = useMemo(() => (
    visibleModules.find((module) => module.id === activeModule)?.label
      || MODULE_DEFINITIONS.find((module) => module.id === activeModule)?.label
      || activeModule
  ), [activeModule, visibleModules]);
  const moduleShortcutIndexById = useMemo(() => (
    visibleModules.reduce<Record<string, number>>((acc, module, index) => {
      acc[module.id] = index + 1;
      return acc;
    }, {})
  ), [visibleModules]);
  const workspaceModules = useMemo(() => {
    const visibleModuleMap = new Map(visibleModules.map((module) => [module.id, module]));
    return MODULE_DEFINITIONS.map((module) => {
      const visibleModule = visibleModuleMap.get(module.id);
      return {
        id: module.id,
        label: visibleModule?.label || module.label,
        isAvailable: Boolean(visibleModule),
      };
    });
  }, [visibleModules]);
  const groupedVisibleModules = useMemo(() => (
    MODULE_GROUPS
      .map((group) => ({
        ...group,
        modules: group.moduleIds
          .map((moduleId) => workspaceModules.find((module) => module.id === moduleId))
          .filter((module): module is (typeof workspaceModules)[number] => module != null),
      }))
      .filter((group) => group.modules.length > 0)
  ), [workspaceModules]);
  const openIncidentCount = toInt(asRecord(incidentsPayload.summary).open, incidentRows.length);
  const showOverviewMode = !focusedWorkspaceMode && !settingsOpen;
  const showFocusedModuleMode = focusedWorkspaceMode && !settingsOpen;

  useDashboardKeyboardShortcuts({
    dialogState,
    dismissDialog,
    loadBootstrap,
    pushActivity,
    selectModule,
    settingsOpen,
    toggleSettings,
    triggerHaptic,
    visibleModules,
    restoreFocusSelectorRef,
    isTypingTarget,
  });

  const selectedCallScript = selectCallScriptByIdMemoized({
    callScripts,
    selectedCallScriptId,
    toInt,
  });
  useDashboardCallScriptSelectionSync({
    callScripts,
    selectedCallScriptId,
    setSelectedCallScriptId,
    selectedCallScript,
    setScriptNameInput,
    setScriptDescriptionInput,
    setScriptDefaultProfileInput,
    setScriptPromptInput,
    setScriptFirstMessageInput,
    setScriptObjectiveTagsInput,
    toInt,
    toText,
    asStringList,
  });

  const {
    smsTotalRecipients,
    smsSuccess,
    smsFailed,
    smsProcessedPercent,
    emailTotalRecipients,
    emailSent,
    emailFailed,
    emailDelivered,
    emailBounced,
    emailComplained,
    emailSuppressed,
    emailProcessedPercent,
    emailDeliveredPercent,
    emailBouncePercent,
    emailComplaintPercent,
    smsRecipientsParsed,
    smsInvalidRecipients,
    smsDuplicateCount,
    smsSegmentEstimate,
    smsValidationCategories,
    smsEstimatedCost,
    mailerRecipientsParsed,
    mailerInvalidRecipients,
    mailerDuplicateCount,
    mailerVariableKeys,
    mailerTemplatePreviewSubject,
    mailerTemplatePreviewBody,
    mailerTemplatePreviewError,
    mailerDomainHealthStatus,
    mailerDomainHealthDetail,
    mailerTrendBars,
  } = useDashboardMessagingMetrics({
    smsSummary,
    emailStats,
    emailJobs,
    smsRecipientsInput,
    smsMessageInput,
    smsCostPerSegment,
    smsDefaultCostPerSegment: SMS_DEFAULT_COST_PER_SEGMENT,
    mailerRecipientsInput,
    mailerSubjectInput,
    mailerHtmlInput,
    mailerTextInput,
    mailerVariablesInput,
  });
  const hasBootstrapData = Boolean(
    bootstrap?.success
    || bootstrap?.dashboard
    || pollPayload?.dashboard
    || pollPayload?.provider
    || pollPayload?.sms_bulk
    || pollPayload?.email_bulk_stats
    || pollPayload?.dlq,
  );
  const hasProviderData = Object.keys(asRecord(providersByChannel)).length > 0;
  const hasBulkVolume = smsTotalRecipients > 0 || emailTotalRecipients > 0;
  const hasQueueData = emailJobs.length > 0 || callDlq.length > 0 || emailDlq.length > 0;
  const hasMeaningfulData = hasProviderData || hasBulkVolume || hasQueueData || callLogs.length > 0;
  const {
    syncHealthState,
    syncHealthMessage,
    bridgeHardFailures,
    bridgeSoftFailures,
    isDashboardDegraded,
    streamModeLabel,
    streamLastEventLabel,
    syncModeLabel,
    nextPollLabel,
    lastPollLabel,
    lastSuccessfulPollLabel,
    pollFreshnessLabel,
    callTotal,
    callCompleted,
    callFailed,
    callFailureRate,
    callSuccessRate,
    queueBacklogTotal,
    sloErrorBudgetPercent,
    sloP95ActionLatencyMs,
    degradedCauses,
  } = useDashboardOpsMetrics({
    bridgePayload: pollPayload?.bridge || dashboard?.bridge,
    sessionBlocked,
    pollFailureCount,
    pollDegradedFailures: POLL_DEGRADED_FAILURES,
    error,
    hasBootstrapData,
    streamMode,
    streamConnected,
    streamLastEventAt,
    pollingPaused,
    nextPollAt,
    lastPollAt,
    lastSuccessfulPollAt,
    callStatsPayload,
    opsQueueBacklog,
    actionLatencyMsSamples,
  });
  const callLogsTotal = toInt(callLogsPayload.total, callLogs.length);
  const voiceRuntime = asRecord(voiceRuntimePayload.runtime);
  const voiceRuntimeCircuit = asRecord(voiceRuntime.circuit);
  const voiceRuntimeActiveCalls = asRecord(voiceRuntimePayload.active_calls);
  const runtimeEffectiveMode = toText(
    voiceRuntime.effective_mode,
    toText(voiceRuntime.configured_mode, 'unknown'),
  );
  const runtimeModeOverride = toText(voiceRuntime.mode_override, 'none');
  const runtimeCanaryEffective = toInt(voiceRuntime.effective_canary_percent);
  const runtimeCanaryOverride = Number(voiceRuntime.canary_percent_override);
  const runtimeCanaryOverrideLabel = Number.isFinite(runtimeCanaryOverride)
    ? `${Math.max(0, Math.min(100, Math.round(runtimeCanaryOverride)))}%`
    : 'none';
  const runtimeIsCircuitOpen = voiceRuntimeCircuit.is_open === true;
  const runtimeForcedLegacyUntil = formatTime(voiceRuntimeCircuit.forced_legacy_until);
  const runtimeActiveTotal = toInt(voiceRuntimeActiveCalls.total);
  const runtimeActiveLegacy = toInt(voiceRuntimeActiveCalls.legacy);
  const runtimeActiveVoiceAgent = toInt(voiceRuntimeActiveCalls.voice_agent);
  const callScriptsTotal = toInt(callScriptsPayload.total, callScripts.length);
  const selectedCallScriptLifecycle = asRecord(selectedCallScript?.lifecycle);
  const selectedCallScriptLifecycleState = toText(
    selectedCallScript?.lifecycle_state || selectedCallScriptLifecycle.lifecycle_state,
    'draft',
  ).toLowerCase();
  const {
    providerMatrixRows,
    providerReadinessTotals,
    providerReadinessPercent,
    providerDegradedCount,
    providerCurrentByChannel,
    providerSupportedByChannel,
  } = useDashboardProviderMetrics({
    providerCompatibilityChannels,
    providersByChannel: asRecord(providersByChannel),
  });
  useDashboardProviderSwitchDefaults({
    providerCurrentByChannel,
    providerSupportedByChannel,
    setProviderSwitchPlanByChannel,
  });

  const resetProviderSwitchPlanState = useCallback((): void => {
    setProviderSwitchPlanByChannel(createDefaultProviderSwitchPlanByChannel());
  }, []);

  const {
    handleRefresh,
    handleTogglePolling,
    handleCloseMiniApp,
    resetSession,
  } = useDashboardSessionControls({
    triggerHaptic,
    pushActivity,
    setNoticeMessage,
    setPollingPaused,
    loadBootstrap,
    closeMiniApp: () => miniApp.close.ifAvailable(),
    stateEpochRef,
    bootstrapRequestSeqRef,
    pollRequestSeqRef,
    bootstrapAbortRef,
    pollAbortRef,
    clearSession: dashboardApiClient.clearSession,
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
    smsDefaultCostPerSegment: SMS_DEFAULT_COST_PER_SEGMENT,
    setSmsDryRunMode,
    setCallScriptsSnapshot,
    setSelectedCallScriptId,
    setScriptSimulationResult,
    resetProviderSwitchPlan: resetProviderSwitchPlanState,
    setSettingsOpen,
    clearActivityLog,
    pollFailureNotedRef,
  });
  const handlePullReadyStateChange = useCallback((ready: boolean): void => {
    if (!ready) return;
    triggerHaptic('selection');
  }, [triggerHaptic]);
  const handlePullRelease = useCallback((event: {
    triggeredRefresh: boolean;
    ready: boolean;
    offset: number;
  }): void => {
    if (!event.ready || event.triggeredRefresh) return;
    triggerHaptic('impact', 'soft');
  }, [triggerHaptic]);
  const {
    pullOffset,
    pullIndicatorVisible,
    pullReady,
    pullRefreshing,
    pullLabel,
    isPulling,
    onTouchStart: handleStageTouchStart,
    onTouchMove: handleStageTouchMove,
    onTouchEnd: handleStageTouchEnd,
    onTouchCancel: handleStageTouchCancel,
  } = useDashboardPullToRefresh({
    onRefresh: handleRefresh,
    disabled: loading || busyAction.length > 0 || settingsOpen || sessionBlocked,
    refreshing: loading,
    onReadyStateChange: handlePullReadyStateChange,
    onRelease: handlePullRelease,
  });
  const smsRouteSimulationRows = selectSmsRouteSimulationRowsMemoized({
    providerMatrixRows,
  });

  const { handleRecipientsFile } = useDashboardRecipientsImport({
    setSmsRecipientsInput,
    setMailerRecipientsInput,
    pushActivity,
  });

  const {
    refreshUsersModule,
    refreshAuditModule,
  } = useDashboardGovernanceData<
    MiniAppUsersPayload,
    MiniAppAuditPayload,
    MiniAppIncidentsPayload
  >({
    invokeAction,
    pushActivity,
    setError,
    setUsersSnapshot,
    setAuditSnapshot,
    setIncidentsSnapshot,
    userSearch,
    userSortBy,
    userSortDir,
  });

  const {
    roleReasonTemplates,
    handleApplyUserRole,
    runbookAction,
  } = useDashboardGovernanceActions({
    runAction,
    pushActivity,
    refreshUsersModule,
    refreshAuditModule,
    providersByChannel,
    requestTextInput: openPromptDialog,
  });

  const {
    refreshRuntimeStatus,
    enableRuntimeMaintenance,
    disableRuntimeMaintenance,
    applyRuntimeCanary,
    clearRuntimeCanary,
  } = useDashboardRuntimeControls({
    invokeAction,
    runAction,
    pushActivity,
    setError,
    setRuntimeCanaryInput,
    runtimeCanaryInput,
    runtimeStatusSnapshot: voiceRuntimePayload,
    onRuntimeStatusLoaded: (data) => {
      setPollPayload((prev) => ({
        ...(prev || {}),
        voice_runtime: data,
      }));
    },
  });

  const {
    refreshCallScriptsModule,
    saveCallScriptDraft,
    submitCallScriptForReview,
    reviewCallScript,
    promoteCallScriptLive,
    simulateCallScript,
  } = useDashboardCallScriptActions({
    invokeAction,
    runAction,
    pushActivity,
    setError,
    setCallScriptsSnapshot,
    setScriptSimulationResult,
    scriptFlowFilter,
    selectedCallScriptId,
    scriptNameInput,
    scriptDescriptionInput,
    scriptDefaultProfileInput,
    scriptPromptInput,
    scriptFirstMessageInput,
    scriptObjectiveTagsInput,
    scriptReviewNoteInput,
    scriptSimulationVariablesInput,
  });

  const {
    sendSmsFromConsole,
    sendMailerFromConsole,
  } = useDashboardMessagingActions({
    invokeAction,
    runAction,
    pushActivity,
    setError,
    setNotice: setNoticeMessage,
    setBusyAction,
    formatTime,
    smsRecipientsParsed,
    smsMessageInput,
    smsDryRunMode,
    smsSegmentEstimateSegments: smsSegmentEstimate.segments,
    smsEstimatedCost,
    smsScheduleAt,
    smsProviderInput,
    mailerRecipientsParsed,
    mailerTemplateIdInput,
    mailerSubjectInput,
    mailerHtmlInput,
    mailerTextInput,
    mailerVariablesInput,
    mailerScheduleAt,
  });

  const {
    preflightActiveProviders,
    safeSwitchProvider,
    setProviderSwitchTarget,
    simulateProviderSwitchPlan,
    confirmProviderSwitchPlan,
    applyProviderSwitchPlan,
    resetProviderSwitchPlan,
    runProviderPreflight,
  } = useDashboardProviderActions({
    invokeAction,
    runAction,
    pushActivity,
    triggerHaptic,
    loadBootstrap,
    setError,
    setNotice: setNoticeMessage,
    setProviderPreflightBusy,
    setProviderPreflightRows,
    setProviderRollbackByChannel,
    setProviderSwitchPlanByChannel,
    providersByChannel,
    providerCurrentByChannel,
    providerSwitchPlanByChannel,
  });

  const renderProviderSection = (channel: ProviderChannel) => {
    const channelData = providersByChannel[channel] || {};
    const currentProvider = toText(channelData.provider, '').toLowerCase();
    const supported = asStringList(channelData.supported_providers);
    const readiness = asRecord(channelData.readiness);
    const rollbackTarget = toText(providerRollbackByChannel[channel], '').toLowerCase();

    return (
      <ProviderChannelCard
        key={channel}
        channel={channel}
        currentProvider={currentProvider}
        supportedProviders={supported}
        readinessByProvider={readiness}
        busyAction={busyAction}
        providerPreflightBusy={providerPreflightBusy}
        providerPreflightRows={providerPreflightRows}
        rollbackTarget={rollbackTarget}
        onSwitchProvider={safeSwitchProvider}
        onRunPreflight={runProviderPreflight}
        onRollback={async (rollbackChannel, provider) => {
          await runAction(
            DASHBOARD_ACTION_CONTRACTS.PROVIDER_ROLLBACK,
            { channel: rollbackChannel, provider },
            {
              confirmText: `Rollback ${rollbackChannel.toUpperCase()} provider to "${provider}"?`,
              successMessage: `${rollbackChannel.toUpperCase()} provider rolled back to ${provider}.`,
            },
          );
        }}
      />
    );
  };

  const opsVmSection = buildOpsVmSection({
    isFeatureEnabled,
    isDashboardDegraded,
    syncModeLabel,
    streamModeLabel,
    streamLastEventLabel,
    streamFailureCount,
    pollFailureCount,
    bridgeHardFailures,
    bridgeSoftFailures,
    sloErrorBudgetPercent,
    sloP95ActionLatencyMs,
    pollFreshnessLabel,
    degradedCauses,
    lastPollLabel,
    lastSuccessfulPollLabel,
    nextPollLabel,
    callCompleted,
    callTotal,
    callFailed,
    callFailureRate,
    callSuccessRate,
    queueBacklogTotal,
    opsQaSummary,
    providerReadinessTotals,
    providerReadinessPercent,
    textBar,
    runtimeEffectiveMode,
    runtimeModeOverride,
    runtimeCanaryEffective,
    runtimeCanaryOverrideLabel,
    runtimeIsCircuitOpen,
    runtimeForcedLegacyUntil,
    runtimeActiveTotal,
    runtimeActiveLegacy,
    runtimeActiveVoiceAgent,
    busyAction,
    enableRuntimeMaintenance,
    disableRuntimeMaintenance,
    refreshRuntimeStatus,
    runtimeCanaryInput,
    setRuntimeCanaryInput,
    applyRuntimeCanary,
    clearRuntimeCanary,
    activityLog,
    formatTime,
    renderProviderSection,
    smsTotalRecipients,
    smsSuccess,
    smsFailed,
    smsProcessedPercent,
    emailTotalRecipients,
    emailSent,
    emailFailed,
    emailDelivered,
    emailBounced,
    emailComplained,
    emailSuppressed,
    emailProcessedPercent,
    emailDeliveredPercent,
    callLogs,
    callLogsTotal,
    toText,
    toInt,
    emailJobs,
    dlqPayload,
    callDlq,
    emailDlq,
    runAction,
    invokeAction,
    hasMeaningfulData,
  });

  const smsVmSection = buildSmsVmSection({
    smsRecipientsInput,
    setSmsRecipientsInput,
    handleRecipientsFile,
    smsProviderInput,
    setSmsProviderInput,
    smsMessageInput,
    setSmsMessageInput,
    smsScheduleAt,
    setSmsScheduleAt,
    busyAction,
    sendSmsFromConsole,
    smsRecipientsParsed,
    smsInvalidRecipients,
    smsDuplicateCount,
    smsSegmentEstimate,
    smsCostPerSegment,
    setSmsCostPerSegment,
    smsEstimatedCost,
    smsDryRunMode,
    setSmsDryRunMode,
    smsValidationCategories,
    smsRouteSimulationRows,
    smsTotalRecipients,
    smsSuccess,
    smsFailed,
    smsProcessedPercent,
    textBar,
    invokeAction,
  });

  const mailerVmSection = buildMailerVmSection({
    mailerRecipientsInput,
    setMailerRecipientsInput,
    handleRecipientsFile,
    mailerTemplateIdInput,
    setMailerTemplateIdInput,
    mailerSubjectInput,
    setMailerSubjectInput,
    mailerHtmlInput,
    setMailerHtmlInput,
    mailerTextInput,
    setMailerTextInput,
    mailerVariablesInput,
    setMailerVariablesInput,
    mailerScheduleAt,
    setMailerScheduleAt,
    busyAction,
    sendMailerFromConsole,
    mailerRecipientsParsed,
    mailerInvalidRecipients,
    mailerDuplicateCount,
    mailerVariableKeys,
    mailerTemplatePreviewSubject,
    mailerTemplatePreviewBody,
    mailerTemplatePreviewError,
    mailerDomainHealthStatus,
    mailerDomainHealthDetail,
    mailerTrendBars,
    emailTotalRecipients,
    emailSent,
    emailFailed,
    emailDelivered,
    emailBounced,
    emailComplained,
    emailSuppressed,
    emailProcessedPercent,
    emailDeliveredPercent,
    emailBouncePercent,
    emailComplaintPercent,
    textBar,
    emailJobs,
    toText,
    toInt,
    invokeAction,
  });

  const providerVmSection = buildProviderVmSection({
    providerReadinessTotals,
    providerDegradedCount,
    providerReadinessPercent,
    textBar,
    busyAction,
    providerPreflightBusy,
    preflightActiveProviders,
    loading,
    handleRefresh,
    providerMatrixRows,
    providerCurrentByChannel,
    providerSupportedByChannel,
    providerSwitchPlanByChannel,
    setProviderSwitchTarget,
    simulateProviderSwitchPlan,
    confirmProviderSwitchPlan,
    applyProviderSwitchPlan,
    resetProviderSwitchPlan,
    renderProviderSection,
  });

  const governanceVmSection = buildGovernanceVmSection({
    hasCapability,
    isFeatureEnabled,
    asRecord,
    toInt,
    toText,
    formatTime,
    busyAction,
    scriptFlowFilter,
    setScriptFlowFilter,
    refreshCallScriptsModule,
    callScriptsTotal,
    callScripts,
    selectedCallScriptId,
    setSelectedCallScriptId,
    selectedCallScript,
    selectedCallScriptLifecycleState,
    selectedCallScriptLifecycle,
    scriptNameInput,
    setScriptNameInput,
    scriptDefaultProfileInput,
    setScriptDefaultProfileInput,
    scriptDescriptionInput,
    setScriptDescriptionInput,
    scriptPromptInput,
    setScriptPromptInput,
    scriptFirstMessageInput,
    setScriptFirstMessageInput,
    scriptObjectiveTagsInput,
    setScriptObjectiveTagsInput,
    saveCallScriptDraft,
    submitCallScriptForReview,
    scriptReviewNoteInput,
    setScriptReviewNoteInput,
    reviewCallScript,
    promoteCallScriptLive,
    scriptSimulationVariablesInput,
    setScriptSimulationVariablesInput,
    simulateCallScript,
    scriptSimulationResult,
    invokeAction,
    userSearch,
    setUserSearch,
    userSortBy,
    setUserSortBy,
    userSortDir,
    setUserSortDir,
    refreshUsersModule,
    usersPayload,
    usersRows,
    roleReasonTemplates,
    handleApplyUserRole,
    refreshAuditModule,
    runbookAction,
    incidentsPayload,
    incidentRows,
    runbookRows,
    auditRows,
  });

  const moduleVm = buildDashboardVm(
    opsVmSection,
    smsVmSection,
    mailerVmSection,
    providerVmSection,
    governanceVmSection,
  );
  const showModuleSkeleton = moduleSkeletonsEnabled && loading && !hasBootstrapData;
  const moduleBoundaryKeySuffix = `${activeModule}:${lastSuccessfulPollAt ?? 0}`;

  return (
    <>
      <DashboardShellFrame
        loading={loading}
        settingsOpen={settingsOpen}
        activeModuleLabel={activeModuleLabel}
      >
        <DashboardTopShell
          settingsOpen={settingsOpen}
          showOverviewMode={showOverviewMode}
          sessionBlocked={sessionBlocked}
          loading={loading}
          userLabel={userLabel}
          userAvatarUrl={userAvatarUrl}
          userAvatarFallback={userAvatarFallback}
          sessionRole={sessionRole}
          sessionRoleSource={sessionRoleSource}
          settingsStatusLabel={settingsStatusLabel}
          featureFlagsCount={Object.keys(featureFlags).length || 'default'}
          activeModuleLabel={activeModuleLabel}
          activeModuleSubtitle={activeModuleMeta.subtitle}
          onOpenSettings={() => toggleSettings(true)}
          error={error}
          errorCode={errorCode}
          refreshFailureDiagnostics={refreshFailureDiagnostics}
          authTelemetry={authTelemetry}
          notice={notice}
          noticeTone={noticeTone}
          busyAction={busyAction}
          isDashboardDegraded={isDashboardDegraded}
          syncHealthState={syncHealthState}
          syncModeLabel={syncModeLabel}
          syncHealthMessage={syncHealthMessage}
          streamModeLabel={streamModeLabel}
          streamLastEventLabel={streamLastEventLabel}
          lastPollLabel={lastPollLabel}
          lastSuccessfulPollLabel={lastSuccessfulPollLabel}
          nextPollLabel={nextPollLabel}
          pollFreshnessLabel={pollFreshnessLabel}
          pollFailureCount={pollFailureCount}
          streamFailureCount={streamFailureCount}
          bridgeHardFailures={bridgeHardFailures}
          bridgeSoftFailures={bridgeSoftFailures}
          degradedCauses={degradedCauses}
          actionTelemetry={actionTelemetry}
        />
      <DashboardSettingsStage
        isOpen={settingsOpen}
        userLabel={userLabel}
        sessionRole={sessionRole}
        pollingPaused={pollingPaused}
        loading={loading}
        busy={busyAction.length > 0}
        settingsStatusLabel={settingsStatusLabel}
        apiBaseLabel={API_BASE_URL || 'same-origin'}
        featureFlagsCount={Object.keys(featureFlags).length || 'default'}
        featureFlagsSourceLabel={featureFlagsSourceLabel}
        featureFlagsUpdatedAtLabel={featureFlagsUpdatedAtLabel}
        onTogglePolling={handleTogglePolling}
        onSyncNow={handleRefresh}
        onRetrySession={resetSession}
      />
      <DashboardViewStage
        settingsOpen={settingsOpen}
        sessionBlocked={sessionBlocked}
        errorCode={errorCode}
        loading={loading}
        busy={busyAction.length > 0}
        onRetrySession={resetSession}
        onCloseMiniApp={miniApp.close.isAvailable() ? handleCloseMiniApp : undefined}
        closeDisabled={loading || busyAction.length > 0}
        showOverviewMode={showOverviewMode}
        showFocusedModuleMode={showFocusedModuleMode}
        isDashboardDegraded={isDashboardDegraded}
        syncModeLabel={syncModeLabel}
        openIncidentCount={openIncidentCount}
        queueBacklogTotal={queueBacklogTotal}
        lastSuccessfulPollLabel={lastSuccessfulPollLabel}
        visibleModulesCount={visibleModules.length}
        sessionRole={sessionRole}
        activityLog={activityLog}
        callLogs={callLogs}
        emailJobs={emailJobs}
        incidentRows={incidentRows}
        onRefreshAccess={handleRefresh}
        showModuleSkeleton={showModuleSkeleton}
        groupedVisibleModules={groupedVisibleModules}
        moduleShortcutIndexById={moduleShortcutIndexById}
        activeModule={activeModule}
        onSelectModule={selectModule}
        moduleVm={moduleVm}
        hasCapability={hasCapability}
        moduleErrorBoundariesEnabled={moduleErrorBoundariesEnabled}
        moduleBoundaryKeySuffix={moduleBoundaryKeySuffix}
        onReload={handleRefresh}
        pullOffset={pullOffset}
        pullIndicatorVisible={pullIndicatorVisible}
        pullReady={pullReady}
        pullRefreshing={pullRefreshing}
        pullLabel={pullLabel}
        isPulling={isPulling}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onTouchCancel={handleStageTouchCancel}
      />
      </DashboardShellFrame>
      <DashboardActionDialog
        dialogState={dialogState}
        dialogInputValue={dialogInputValue}
        dialogInputError={dialogInputError}
        setDialogInputValue={setDialogInputValue}
        setDialogInputError={setDialogInputError}
        onDismiss={() => dismissDialog(dialogState)}
        onConfirm={handleDialogConfirm}
        actionDialogRef={actionDialogRef}
        dialogCancelButtonRef={dialogCancelButtonRef}
      />
    </>
  );
}
