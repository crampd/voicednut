import type { FC, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Cell,
  List,
  Navigation,
  Placeholder,
  Section,
} from '@telegram-apps/telegram-ui';

import '@/pages/AdminDashboard/AdminDashboardPage.css';
import { Link } from '@/components/Link/Link.tsx';
import { Page } from '@/components/Page.tsx';
import {
  DASHBOARD_ACTION_CONTRACTS,
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  type MiniAppCommandActionId,
  type MiniAppCommandAccessLevel,
} from '@/contracts/miniappParityContracts';
import { useMiniAppCommandSession } from '@/hooks/useMiniAppCommandSession';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiInput,
  UiMetricTile,
  UiSelect,
  UiStatePanel,
  UiTextarea,
} from '@/components/ui/AdminPrimitives';
import {
  asRecord,
  isValidE164,
  normalizePhone,
} from '@/services/admin-dashboard/dashboardPrimitives';

import {
  CALL_CUSTOM_FLOW_OPTIONS,
  CALL_CUSTOM_PERSONA_ID,
  CALL_FALLBACK_PERSONAS,
  CALL_FALLBACK_VOICE_MODELS,
  CALL_MOOD_OPTIONS,
  CALL_PURPOSE_OPTIONS,
  CALL_TECH_LEVEL_OPTIONS,
  CALL_URGENCY_OPTIONS,
  CALL_VOICE_AUTO_ID,
  CALL_VOICE_CUSTOM_ID,
  CALL_WORKFLOW_MODE_OPTIONS,
  RELATIONSHIP_CALL_FLOW_TYPE_SET,
  buildPersonalizedCallFirstMessage,
  buildCallPersonaOptionLabel,
  buildCallVoiceOptionLabel,
  describeAccessLevel,
  createCallIdempotencyKey,
  extractScriptVariables,
  getOptionLabel,
  inferCustomCallFlow,
  isTerminalCallStatus,
  mergeCallPersonaProfiles,
  readActiveCallConsoleSid,
  normalizeCallPersonaProfile,
  renderQuickActionCell,
  replacePlaceholders,
  resolveCallConsolePhase,
  summarizeCallNotificationRow,
  resolveCallConsoleStatus,
  resolveCommandPageLoadingCopy,
  resolveCommandPageTitle,
  summarizeCallStateRow,
  toCallScriptRows,
  toErrorCode,
  toErrorMessage,
  toEventRows,
  toFlowTypeLabel,
  toFlowTypes,
  toOptionalRecord,
  toPersonaConfig,
  toPositiveInt,
  toTextList,
  toTextValue,
  toWarningList,
  writeActiveCallConsoleSid,
  type CallActiveResumeResponse,
  type CallCommandResponse,
  type CallCommandStatusResponse,
  type CallPersonaCatalogResponse,
  type CallPersonaProfile,
  type CallPersonaPurposeOption,
  type CallScriptListResponse,
  type CallScriptRecord,
  type CallWorkflowMode,
} from './CommandPages.tsx';

type CallLiveConsoleSectionProps = {
  activeCallSid: string;
  callConsoleBusy: boolean;
  callConsoleRefreshing: boolean;
  callConsoleTerminal: boolean;
  callConsoleError: string;
  liveConsoleStatus: string;
  liveConsolePhase: string;
  callConsoleDetails: Record<string, unknown> | null;
  callConsoleLiveSnapshot: Record<string, unknown> | null;
  submitProvider: string;
  submitTo: string;
  normalizedNumber: string;
  selectedScriptName: string;
  liveConsolePreview: Record<string, unknown> | null;
  liveConsoleLastEvents: ReadonlyArray<Record<string, unknown>>;
  callConsoleRecentStates: ReadonlyArray<Record<string, unknown>>;
  callConsoleNotifications: ReadonlyArray<Record<string, unknown>>;
  onRefresh: () => void;
};

type CallQuickActionsSectionProps = {
  listedActions: readonly MiniAppCommandActionId[];
  accessLevel: MiniAppCommandAccessLevel;
  pathname: string;
};

function CallLoadingState({ pageTitle }: { pageTitle: string }) {
  return (
    <Page back>
      <Placeholder
        header={pageTitle}
        description={resolveCommandPageLoadingCopy(pageTitle)}
      />
    </Page>
  );
}

function CallAccessRequiredSection() {
  return (
    <Section
      header="Access required"
      footer="Call execution is restricted to authorized users. The Mini App keeps the same rule."
    >
      <UiStatePanel
        title="Authorized access required"
        description="Request access from an admin or use Help Center, Usage Guide, or Quick Actions to review available workflows."
        tone="warning"
      />
    </Section>
  );
}

function CallLiveConsoleSection({
  activeCallSid,
  callConsoleBusy,
  callConsoleRefreshing,
  callConsoleTerminal,
  callConsoleError,
  liveConsoleStatus,
  liveConsolePhase,
  callConsoleDetails,
  callConsoleLiveSnapshot,
  submitProvider,
  submitTo,
  normalizedNumber,
  selectedScriptName,
  liveConsolePreview,
  liveConsoleLastEvents,
  callConsoleRecentStates,
  callConsoleNotifications,
  onRefresh,
}: CallLiveConsoleSectionProps) {
  return (
    <Section
      header="Live call console"
      footer="This console stays attached to the active call SID after launch, restores that SID after Mini App refresh for the same Telegram session, can reattach to the latest still-active call for that session, and keeps polling the same call detail and call-status contracts used by the live operations console."
    >
      <div className="va-grid">
        <UiCard>
          <p className="va-card-eyebrow">Ongoing call status updates</p>
          <div className="va-inline-tools">
            <UiButton
              variant="secondary"
              disabled={!activeCallSid || callConsoleBusy || callConsoleRefreshing}
              onClick={onRefresh}
            >
              {callConsoleBusy || callConsoleRefreshing ? 'Refreshing...' : 'Refresh Live Console'}
            </UiButton>
          </div>
          <div className="va-inline-metrics">
            <UiBadge>SID {activeCallSid || 'none'}</UiBadge>
            <UiBadge>Status {liveConsoleStatus || 'idle'}</UiBadge>
            <UiBadge>Phase {liveConsolePhase || 'waiting'}</UiBadge>
            <UiBadge>{callConsoleTerminal ? 'Terminal' : activeCallSid ? 'Polling live' : 'Awaiting launch'}</UiBadge>
          </div>

          {callConsoleError ? (
            <UiStatePanel
              title="Live console refresh failed"
              description={callConsoleError}
              tone="error"
            />
          ) : null}

          {activeCallSid ? (
            <UiStatePanel
              compact
              title="Webhook-backed live call console"
              description={callConsoleBusy
                ? 'Loading the live call console from call details, recent provider states, and webhook-backed runtime snapshots.'
                : (callConsoleRefreshing
                  ? 'Refreshing live console while the call remains active.'
                  : `Tracking ${activeCallSid} until the backend reports a terminal call status.`)}
              tone={callConsoleError ? 'error' : (callConsoleTerminal ? 'success' : 'info')}
            />
          ) : (
            <UiStatePanel
              compact
              title="No active call SID yet"
              description="Launch a call from this page and the live console will stay visible here with ongoing status, phase, preview, and recent event updates. If the Mini App reloads before the call finishes, this page restores the same active call SID for the current Telegram session and can reattach to the latest still-active call for that session from the backend."
              tone="info"
            />
          )}

          {callConsoleDetails || callConsoleLiveSnapshot ? (
            <ul className="va-list va-list-dense">
              <li>Provider: {toTextValue(callConsoleDetails?.provider, toTextValue(callConsoleLiveSnapshot?.provider, submitProvider || 'unknown'))}</li>
              <li>Updated: {toTextValue(callConsoleLiveSnapshot?.updated_at, toTextValue(callConsoleDetails?.updated_at, 'n/a'))}</li>
              <li>Route: {toTextValue(callConsoleLiveSnapshot?.route_label, toTextValue(callConsoleDetails?.route_label, 'n/a'))}</li>
              <li>From: {toTextValue(callConsoleLiveSnapshot?.from, toTextValue(callConsoleDetails?.from_number, 'n/a'))}</li>
              <li>To: {toTextValue(callConsoleLiveSnapshot?.to, toTextValue(callConsoleDetails?.to_number, submitTo || normalizedNumber || 'n/a'))}</li>
              <li>Script: {toTextValue(callConsoleLiveSnapshot?.script, selectedScriptName || 'custom')}</li>
            </ul>
          ) : null}

          {liveConsolePreview ? (
            <>
              <p className="va-card-eyebrow">Conversation preview</p>
              <ul className="va-list va-list-dense">
                <li>User: {toTextValue(liveConsolePreview.user, 'No user preview yet')}</li>
                <li>Agent: {toTextValue(liveConsolePreview.agent, 'No agent preview yet')}</li>
              </ul>
            </>
          ) : null}
        </UiCard>

        <UiCard>
          <p className="va-card-eyebrow">Recent webhook and provider activity</p>
          {liveConsoleLastEvents.length > 0 ? (
            <>
              <p className="va-card-eyebrow">Live console events</p>
              <ul className="va-list va-list-dense">
                {liveConsoleLastEvents.map((event, index) => (
                  <li key={`live-console-event-${index}`}>{summarizeCallStateRow(event)}</li>
                ))}
              </ul>
            </>
          ) : null}

          {callConsoleRecentStates.length > 0 ? (
            <>
              <p className="va-card-eyebrow">Recent states</p>
              <ul className="va-list va-list-dense">
                {callConsoleRecentStates.slice(0, 8).map((state, index) => (
                  <li key={`call-state-${index}`}>{summarizeCallStateRow(state)}</li>
                ))}
              </ul>
            </>
          ) : null}

          {callConsoleNotifications.length > 0 ? (
            <>
              <p className="va-card-eyebrow">Notification delivery</p>
              <ul className="va-list va-list-dense">
                {callConsoleNotifications.slice(0, 6).map((row, index) => (
                  <li key={`call-notification-${index}`}>{summarizeCallNotificationRow(row)}</li>
                ))}
              </ul>
            </>
          ) : null}

          {!callConsoleBusy
          && !callConsoleRefreshing
          && liveConsoleLastEvents.length === 0
          && callConsoleRecentStates.length === 0
          && callConsoleNotifications.length === 0 ? (
            <UiStatePanel
              compact
              title="No runtime updates loaded yet"
              description={activeCallSid
                ? 'The call is being tracked, but the backend has not returned live events yet. Refresh again if the provider has only just started sending status webhooks.'
                : 'Runtime updates will populate here once a call has been launched from this page.'}
              tone="info"
            />
          ) : null}
        </UiCard>
      </div>
    </Section>
  );
}

function CallQuickActionsSection({
  listedActions,
  accessLevel,
  pathname,
}: CallQuickActionsSectionProps) {
  return (
    <Section
      header="Quick actions"
      footer="These shortcuts keep the call page connected to the rest of the available Mini App workflows."
    >
      {listedActions.map((actionId) => renderQuickActionCell(actionId, accessLevel, pathname))}
    </Section>
  );
}

function CallContinueAdminSection() {
  return (
    <Section
      header="Continue In Admin Console"
      footer="Unknown or stale actions return to the dashboard shell instead of leaving you at a dead end."
    >
      <Link to={DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT}>
        <Cell subtitle="Open the admin dashboard shell and route launcher.">
          Admin console
        </Cell>
      </Link>
    </Section>
  );
}

function CallCommandPageContent() {
  const contract = MINIAPP_COMMAND_PAGE_CONTRACTS.CALL;
  const pageTitle = resolveCommandPageTitle('CALL');
  const location = useLocation();
  const {
    loading,
    error,
    errorCode,
    accessLevel,
    activeCallProvider,
    hasCapability,
    invokeAction,
    request,
    reload,
    sessionTelegramId,
  } = useMiniAppCommandSession();
  const listedActions = contract.actionIds;
  const [workflowMode, setWorkflowMode] = useState<CallWorkflowMode>('custom');
  const [numberInput, setNumberInput] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [personaCatalogLoading, setPersonaCatalogLoading] = useState<boolean>(false);
  const [personaCatalogLoaded, setPersonaCatalogLoaded] = useState<boolean>(false);
  const [personaCatalogError, setPersonaCatalogError] = useState<string>('');
  const [personaProfiles, setPersonaProfiles] = useState<CallPersonaProfile[]>([...CALL_FALLBACK_PERSONAS]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(CALL_CUSTOM_PERSONA_ID);
  const [purposeInput, setPurposeInput] = useState<string>('general');
  const [customFlowPurposePinned, setCustomFlowPurposePinned] = useState<boolean>(false);
  const [promptInput, setPromptInput] = useState<string>('');
  const [firstMessageInput, setFirstMessageInput] = useState<string>('');
  const [voiceSelectionInput, setVoiceSelectionInput] = useState<string>(CALL_VOICE_AUTO_ID);
  const [voiceModelInput, setVoiceModelInput] = useState<string>('');
  const [emotionInput, setEmotionInput] = useState<string>('auto');
  const [urgencyInput, setUrgencyInput] = useState<string>('auto');
  const [technicalLevelInput, setTechnicalLevelInput] = useState<string>('auto');
  const [scriptCatalogLoading, setScriptCatalogLoading] = useState<boolean>(false);
  const [scriptCatalogError, setScriptCatalogError] = useState<string>('');
  const [scriptFlowFilterInput, setScriptFlowFilterInput] = useState<string>('');
  const [callScripts, setCallScripts] = useState<CallScriptRecord[]>([]);
  const [selectedCallScriptId, setSelectedCallScriptId] = useState<string>('');
  const [manualScriptIdInput, setManualScriptIdInput] = useState<string>('');
  const [scriptPlaceholderValues, setScriptPlaceholderValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitCode, setSubmitCode] = useState<string>('');
  const [submitResult, setSubmitResult] = useState<CallCommandResponse | null>(null);
  const [persistedActiveCallSid, setPersistedActiveCallSid] = useState<string>('');
  const [activeCallStorageReady, setActiveCallStorageReady] = useState<boolean>(false);
  const [callConsoleBusy, setCallConsoleBusy] = useState<boolean>(false);
  const [callConsoleRefreshing, setCallConsoleRefreshing] = useState<boolean>(false);
  const [callConsoleError, setCallConsoleError] = useState<string>('');
  const [callConsoleLoadedSid, setCallConsoleLoadedSid] = useState<string>('');
  const [callConsoleDetails, setCallConsoleDetails] = useState<Record<string, unknown> | null>(null);
  const [callConsoleLiveSnapshot, setCallConsoleLiveSnapshot] = useState<Record<string, unknown> | null>(null);
  const [callConsoleRecentStates, setCallConsoleRecentStates] = useState<Array<Record<string, unknown>>>([]);
  const [callConsoleNotifications, setCallConsoleNotifications] = useState<Array<Record<string, unknown>>>([]);
  const callConsoleRequestRef = useRef<string>('');
  const activeCallSidRef = useRef<string>('');
  const activeCallResumeAttemptRef = useRef<string>('');

  const canOperate = accessLevel === 'authorized' || accessLevel === 'admin';
  const canBrowseScripts = hasCapability('caller_flags_manage');
  const normalizedNumber = normalizePhone(numberInput.trim());
  const numberValid = isValidE164(normalizedNumber);
  const promptValue = promptInput.trim();
  const firstMessageValue = firstMessageInput.trim();
  const customerNameValue = customerNameInput.trim();
  const selectedPersona = useMemo(() => (
    personaProfiles.find((entry) => entry.id === selectedPersonaId)
    || personaProfiles.find((entry) => entry.custom)
    || personaProfiles[0]
    || null
  ), [personaProfiles, selectedPersonaId]);
  const personaPurposeOptions = useMemo(() => {
    if (selectedPersona?.custom) {
      return CALL_CUSTOM_FLOW_OPTIONS;
    }
    if (selectedPersona?.purposes?.length) {
      return selectedPersona.purposes;
    }
    return CALL_PURPOSE_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
    })) as CallPersonaPurposeOption[];
  }, [selectedPersona]);
  const selectedPurposeOption = useMemo(() => (
    personaPurposeOptions.find((entry) => entry.id === purposeInput) || null
  ), [personaPurposeOptions, purposeInput]);
  const recommendedEmotionId = toTextValue(
    selectedPurposeOption?.defaultEmotion,
    toTextValue(selectedPersona?.defaultEmotion, 'neutral'),
  ) || 'neutral';
  const recommendedUrgencyId = toTextValue(
    selectedPurposeOption?.defaultUrgency,
    toTextValue(selectedPersona?.defaultUrgency, 'normal'),
  ) || 'normal';
  const recommendedTechnicalLevelId = toTextValue(
    selectedPurposeOption?.defaultTechnicalLevel,
    toTextValue(selectedPersona?.defaultTechnicalLevel, 'general'),
  ) || 'general';
  const purposeValue = purposeInput.trim() || 'general';
  const normalizedPurposeValue = purposeValue.toLowerCase();
  const purposeIsRelationshipFlow = RELATIONSHIP_CALL_FLOW_TYPE_SET.has(normalizedPurposeValue);
  const inferredCustomFlow = useMemo(
    () => inferCustomCallFlow(promptValue, firstMessageValue),
    [firstMessageValue, promptValue],
  );
  const inferredCustomFlowLabel = getOptionLabel(personaPurposeOptions, inferredCustomFlow, inferredCustomFlow);
  const isCustomPersonaSelected = Boolean(selectedPersona?.custom);
  const customFlowMatchesRecommendation = normalizedPurposeValue === inferredCustomFlow;
  const voiceModelValue = voiceModelInput.trim();
  const resolvedVoiceModelValue = voiceSelectionInput === CALL_VOICE_CUSTOM_ID
    ? voiceModelValue
    : (voiceSelectionInput === CALL_VOICE_AUTO_ID ? '' : voiceSelectionInput);
  const emotionValue = emotionInput.trim() || 'auto';
  const urgencyValue = urgencyInput.trim() || 'auto';
  const technicalLevelValue = technicalLevelInput.trim() || 'auto';
  const selectedScriptId = toPositiveInt(selectedCallScriptId);
  const manualScriptId = toPositiveInt(manualScriptIdInput);
  const effectiveScriptId = workflowMode === 'script'
    ? (canBrowseScripts ? selectedScriptId : manualScriptId)
    : 0;
  const selectedScript = useMemo(() => (
    callScripts.find((entry) => toPositiveInt(entry.id) === selectedScriptId) || null
  ), [callScripts, selectedScriptId]);
  const selectedScriptName = toTextValue(selectedScript?.name, selectedScriptId > 0 ? `Script #${selectedScriptId}` : '');
  const selectedScriptVersion = toPositiveInt(selectedScript?.version) || undefined;
  const selectedScriptBusinessId = toTextValue(selectedScript?.business_id);
  const selectedScriptVoiceModel = toTextValue(selectedScript?.voice_model);
  const selectedScriptObjectiveTags = toTextList(selectedScript?.objective_tags);
  const selectedScriptPersonaConfig = toPersonaConfig(selectedScript?.persona_config);
  const selectedScriptPurpose = toTextValue(selectedScriptPersonaConfig?.purpose);
  const selectedScriptEmotion = toTextValue(selectedScriptPersonaConfig?.emotion);
  const selectedScriptUrgency = toTextValue(selectedScriptPersonaConfig?.urgency);
  const selectedScriptTechnicalLevel = toTextValue(selectedScriptPersonaConfig?.technical_level);
  const selectedScriptFlowTypes = useMemo(() => toFlowTypes(selectedScript), [selectedScript]);
  const selectedScriptRelationshipFlow = useMemo(() => (
    selectedScriptFlowTypes.find((entry) => RELATIONSHIP_CALL_FLOW_TYPE_SET.has(entry)) || ''
  ), [selectedScriptFlowTypes]);
  const scriptPromptValue = toTextValue(selectedScript?.prompt);
  const scriptFirstMessageValue = toTextValue(selectedScript?.first_message);
  const scriptPlaceholderTokens = useMemo(() => {
    const placeholderSet = new Set<string>();
    extractScriptVariables(scriptPromptValue).forEach((token) => placeholderSet.add(token));
    extractScriptVariables(scriptFirstMessageValue).forEach((token) => placeholderSet.add(token));
    return [...placeholderSet];
  }, [scriptFirstMessageValue, scriptPromptValue]);
  const resolvedScriptPlaceholderValues = useMemo(() => (
    scriptPlaceholderTokens.reduce<Record<string, string>>((accumulator, token) => {
      const value = scriptPlaceholderValues[token];
      if (typeof value === 'string' && value.trim()) {
        accumulator[token] = value.trim();
      }
      return accumulator;
    }, {})
  ), [scriptPlaceholderTokens, scriptPlaceholderValues]);
  const resolvedScriptPromptValue = scriptPromptValue
    ? replacePlaceholders(scriptPromptValue, resolvedScriptPlaceholderValues)
    : '';
  const resolvedScriptFirstMessageValue = scriptFirstMessageValue
    ? replacePlaceholders(scriptFirstMessageValue, resolvedScriptPlaceholderValues)
    : '';
  const unresolvedScriptPlaceholderTokens = useMemo(() => (
    scriptPlaceholderTokens.filter((token) => !resolvedScriptPlaceholderValues[token])
  ), [resolvedScriptPlaceholderValues, scriptPlaceholderTokens]);
  const requiresPaymentProviderGuard = workflowMode === 'script'
    && selectedScriptFlowTypes.includes('payment_collection');
  const paymentProviderGuardBlocked = requiresPaymentProviderGuard
    && Boolean(activeCallProvider)
    && activeCallProvider !== 'twilio';
  const [paymentProviderGuardAcknowledged, setPaymentProviderGuardAcknowledged] = useState<boolean>(false);
  const missingRequirements: string[] = [];

  if (!numberValid) {
    missingRequirements.push('Valid E.164 number required');
  }
  if (workflowMode === 'script') {
    if (effectiveScriptId <= 0) {
      missingRequirements.push(canBrowseScripts ? 'Select a call script' : 'Valid script ID required');
    }
    if (canBrowseScripts && selectedScript && !resolvedScriptFirstMessageValue) {
      missingRequirements.push('Selected script must resolve a first message');
    }
    if (paymentProviderGuardBlocked && !paymentProviderGuardAcknowledged) {
      missingRequirements.push('Payment flow provider guard must be acknowledged');
    }
  } else {
    if (!promptValue) {
      missingRequirements.push('Prompt required');
    }
    if (!firstMessageValue) {
      missingRequirements.push('First message required');
    }
    if (voiceSelectionInput === CALL_VOICE_CUSTOM_ID && !voiceModelValue) {
      missingRequirements.push('Custom voice ID required or switch back to auto');
    }
  }

  const canSubmit = canOperate && missingRequirements.length === 0 && !submitting;
  const warningList = toWarningList(submitResult?.warnings);
  const selectedScriptLifecycleLabel = toTextValue(selectedScript?.lifecycle_state, 'draft');
  const scriptSelectionSourceLabel = canBrowseScripts ? 'Live script catalog' : 'Known script ID';
  const selectedScriptFlowLabel = selectedScript ? toFlowTypeLabel(selectedScript) : '';
  const scriptVoiceRoutingLabel = selectedScriptVoiceModel || 'Auto / provider default';
  const scriptPlaceholderSummary = scriptPlaceholderTokens.length > 0
    ? `${Object.keys(resolvedScriptPlaceholderValues).length}/${scriptPlaceholderTokens.length} placeholder values provided`
    : 'No script placeholders detected';
  const scriptSummaryLines = selectedScript ? [
    `Script: ${selectedScriptName}`,
    `Script ID: ${selectedScriptId}`,
    `Flow: ${selectedScriptFlowLabel}`,
    `Version: v${selectedScriptVersion || 1}`,
    `Lifecycle: ${selectedScriptLifecycleLabel}`,
    ...(selectedScriptBusinessId ? [`Business: ${selectedScriptBusinessId}`] : []),
    ...(selectedScriptVoiceModel ? [`Voice model: ${selectedScriptVoiceModel}`] : []),
    ...(selectedScriptPurpose ? [`Purpose: ${selectedScriptPurpose}`] : []),
    ...(selectedScriptEmotion ? [`Tone: ${selectedScriptEmotion}`] : []),
    ...(selectedScriptUrgency ? [`Urgency: ${selectedScriptUrgency}`] : []),
    ...(selectedScriptTechnicalLevel ? [`Technical level: ${selectedScriptTechnicalLevel}`] : []),
    ...(selectedScriptObjectiveTags.length > 0 ? [`Objective tags: ${selectedScriptObjectiveTags.join(', ')}`] : []),
    ...(scriptPlaceholderTokens.length > 0 ? [`Placeholder coverage: ${scriptPlaceholderSummary}`] : []),
    ...(unresolvedScriptPlaceholderTokens.length > 0
      ? [`Unresolved placeholders remain: ${unresolvedScriptPlaceholderTokens.join(', ')}`]
      : []),
    ...(Object.keys(resolvedScriptPlaceholderValues).length > 0
      ? [`Variables: ${Object.entries(resolvedScriptPlaceholderValues).map(([key, value]) => `${key}=${value}`).join(', ')}`]
      : []),
  ] : [];

  const callPurposeLabel = getOptionLabel(personaPurposeOptions, purposeValue, purposeValue || 'general');
  const callMoodLabel = getOptionLabel(CALL_MOOD_OPTIONS, emotionValue, emotionValue || 'auto');
  const callUrgencyLabel = getOptionLabel(CALL_URGENCY_OPTIONS, urgencyValue, urgencyValue || 'auto');
  const callTechLevelLabel = getOptionLabel(
    CALL_TECH_LEVEL_OPTIONS,
    technicalLevelValue,
    technicalLevelValue || 'auto',
  );
  const recommendedMoodLabel = getOptionLabel(CALL_MOOD_OPTIONS, recommendedEmotionId, recommendedEmotionId);
  const recommendedUrgencyLabel = getOptionLabel(CALL_URGENCY_OPTIONS, recommendedUrgencyId, recommendedUrgencyId);
  const recommendedTechLevelLabel = getOptionLabel(
    CALL_TECH_LEVEL_OPTIONS,
    recommendedTechnicalLevelId,
    recommendedTechnicalLevelId,
  );
  const callToneSummary = emotionValue === 'auto'
    ? `${callMoodLabel} (${recommendedMoodLabel})`
    : callMoodLabel;
  const callUrgencySummary = urgencyValue === 'auto'
    ? `${callUrgencyLabel} (${recommendedUrgencyLabel})`
    : callUrgencyLabel;
  const callTechSummary = technicalLevelValue === 'auto'
    ? `${callTechLevelLabel} (${recommendedTechLevelLabel})`
    : callTechLevelLabel;
  const selectedVoiceOption = CALL_FALLBACK_VOICE_MODELS.find((entry) => entry.id === resolvedVoiceModelValue) || null;
  const selectedVoiceLabel = voiceSelectionInput === CALL_VOICE_CUSTOM_ID
    ? (voiceModelValue || 'Custom voice ID pending')
    : (selectedVoiceOption ? buildCallVoiceOptionLabel(selectedVoiceOption) : 'Auto / provider default');
  const callBriefLines = [
    `Number: ${numberValid ? normalizedNumber : 'Missing valid E.164 number'}`,
    customerNameValue ? `Customer: ${customerNameValue}` : 'Customer: optional',
    `Mode: ${workflowMode === 'script' ? 'Script-backed call' : 'Custom prompt workflow'}`,
    ...(workflowMode === 'script'
      ? [
        `Script source: ${scriptSelectionSourceLabel}`,
        `Script ID: ${effectiveScriptId > 0 ? effectiveScriptId : 'Missing script selection'}`,
        ...(scriptSummaryLines.length > 0 ? scriptSummaryLines : []),
        ...(!canBrowseScripts && effectiveScriptId > 0
          ? ['Metadata: Script details will resolve during launch because this session cannot browse the catalog.']
          : []),
      ]
      : [
        `Persona: ${selectedPersona?.label || 'Custom Persona'}`,
        `Purpose: ${callPurposeLabel}`,
        `Tone: ${callToneSummary}`,
        `Urgency: ${callUrgencySummary}`,
        `Technical level: ${callTechSummary}`,
        `Voice model: ${selectedVoiceLabel}`,
      ]),
  ];
  const activeCallSid = toTextValue(submitResult?.call_sid, persistedActiveCallSid);
  const liveConsoleLastEvents = useMemo(
    () => toEventRows(callConsoleLiveSnapshot?.last_events),
    [callConsoleLiveSnapshot],
  );
  const liveConsolePreview = useMemo(
    () => toOptionalRecord(callConsoleLiveSnapshot?.preview),
    [callConsoleLiveSnapshot],
  );
  const liveConsoleStatus = resolveCallConsoleStatus(
    callConsoleLiveSnapshot,
    callConsoleDetails,
    callConsoleRecentStates,
  );
  const liveConsolePhase = resolveCallConsolePhase(
    callConsoleLiveSnapshot,
    callConsoleDetails,
    callConsoleRecentStates,
  );
  const callConsoleTerminal = isTerminalCallStatus(liveConsoleStatus);

  const clearCallConsoleState = useCallback((options: { clearPersistedSid?: boolean } = {}) => {
    setCallConsoleBusy(false);
    setCallConsoleRefreshing(false);
    setCallConsoleError('');
    setCallConsoleLoadedSid('');
    setCallConsoleDetails(null);
    setCallConsoleLiveSnapshot(null);
    setCallConsoleRecentStates([]);
    setCallConsoleNotifications([]);
    if (options.clearPersistedSid) {
      setPersistedActiveCallSid('');
      writeActiveCallConsoleSid(sessionTelegramId, '');
    }
  }, [sessionTelegramId]);

  useEffect(() => {
    if (!sessionTelegramId) {
      setPersistedActiveCallSid('');
      setActiveCallStorageReady(false);
      return;
    }
    const restoredSid = readActiveCallConsoleSid(sessionTelegramId);
    setPersistedActiveCallSid(restoredSid);
    setActiveCallStorageReady(true);
  }, [sessionTelegramId]);

  useEffect(() => {
    const launchedCallSid = toTextValue(submitResult?.call_sid);
    if (!launchedCallSid) return;
    setPersistedActiveCallSid(launchedCallSid);
    writeActiveCallConsoleSid(sessionTelegramId, launchedCallSid);
  }, [sessionTelegramId, submitResult]);

  useEffect(() => {
    activeCallSidRef.current = activeCallSid.trim();
  }, [activeCallSid]);

  useEffect(() => {
    if (loading || !activeCallStorageReady || !sessionTelegramId || !canOperate) {
      return;
    }
    if (activeCallSid.trim()) {
      return;
    }
    if (activeCallResumeAttemptRef.current === sessionTelegramId) {
      return;
    }

    let cancelled = false;
    activeCallResumeAttemptRef.current = sessionTelegramId;

    const restoreActiveCallSid = async (): Promise<void> => {
      try {
        const response = await request<CallActiveResumeResponse>('/miniapp/calls/active', {
          method: 'GET',
        });
        if (cancelled) return;
        const resumedSid = toTextValue(asRecord(response?.call).call_sid);
        if (!resumedSid) return;
        setPersistedActiveCallSid(resumedSid);
        writeActiveCallConsoleSid(sessionTelegramId, resumedSid);
      } catch {
        // Keep the page usable even if active-call resume is unavailable.
      }
    };

    void restoreActiveCallSid();

    return () => {
      cancelled = true;
    };
  }, [activeCallSid, activeCallStorageReady, canOperate, loading, request, sessionTelegramId]);
  const callWizardSteps = [
    {
      title: '1. Capture recipient',
      complete: numberValid,
      description: numberValid
        ? `Number ready: ${normalizedNumber}${customerNameValue ? ` | customer ${customerNameValue}` : ''}`
        : 'Enter the destination number in E.164 format. Customer name stays optional.',
    },
    {
      title: '2. Choose setup path',
      complete: true,
      description: workflowMode === 'script'
        ? 'Current path: use a saved call script first.'
        : 'Current path: build a custom persona with the opening message on this page.',
    },
    {
      title: workflowMode === 'script' ? '3. Select script and fill variables' : '3. Draft prompt and opening line',
      complete: workflowMode === 'script'
        ? (effectiveScriptId > 0 && (!canBrowseScripts || !selectedScript || Boolean(resolvedScriptFirstMessageValue)))
        : Boolean(promptValue && firstMessageValue),
      description: workflowMode === 'script'
        ? (effectiveScriptId > 0
          ? (selectedScript
            ? `Script ready: ${selectedScriptName || `#${effectiveScriptId}`}${scriptPlaceholderTokens.length > 0 ? ` | variables ${Object.keys(resolvedScriptPlaceholderValues).length}/${scriptPlaceholderTokens.length} filled` : ''}`
            : `Known script ID ready: ${effectiveScriptId}`)
          : (canBrowseScripts
            ? 'Choose a script from the live catalog, then fill any placeholder values you want to replace.'
            : 'Enter a known script ID when guided script selection is not available in this session.'))
        : (promptValue && firstMessageValue
          ? `Prompt and first message captured | persona ${selectedPersona?.label || 'Custom Persona'} | purpose ${callPurposeLabel}`
          : 'Choose the service persona, then enter the agent prompt and first spoken message before launch.'),
    },
    {
      title: '4. Review flow posture',
      complete: workflowMode === 'script'
        ? (!requiresPaymentProviderGuard || !paymentProviderGuardBlocked || paymentProviderGuardAcknowledged)
        : true,
      description: workflowMode === 'script'
        ? (requiresPaymentProviderGuard
          ? (paymentProviderGuardBlocked
            ? `Payment flow selected on ${activeCallProvider || 'unknown'}; acknowledge the provider guard or choose another script.`
            : `Payment flow posture reviewed${activeCallProvider ? ` on ${activeCallProvider}` : ''}.`)
          : `Flow ${selectedScript ? toFlowTypeLabel(selectedScript) : 'not selected'}${selectedScriptVoiceModel ? ` | voice ${selectedScriptVoiceModel}` : ''}`)
        : `Persona ${selectedPersona?.label || 'Custom Persona'} | purpose ${callPurposeLabel} | tone ${callToneSummary} | urgency ${callUrgencySummary} | technical level ${callTechSummary}`,
    },
    {
      title: '5. Launch outbound call',
      complete: Boolean(submitResult?.call_sid),
      description: submitResult?.call_sid
        ? `Launch completed with call SID ${submitResult.call_sid}. Live call console polling is active while webhook updates continue.`
        : (canSubmit
          ? 'All required fields are present. Start Call will execute the live outbound call backend path.'
          : `Waiting on ${missingRequirements[0] || 'the remaining required fields'} before launch.`),
    },
  ];
  const activeWizardStepIndex = callWizardSteps.findIndex((step) => !step.complete);
  const activeWizardStepTitle = callWizardSteps[activeWizardStepIndex]?.title || 'All phases complete';
  const activeWizardStepLabel = activeWizardStepTitle.replace(/^\d+\.\s*/, '');
  const completedWizardSteps = callWizardSteps.filter((step) => step.complete).length;
  const launchStateLabel = submitResult?.call_sid
    ? (submitResult.deduped ? 'Reused' : 'Live')
    : (canSubmit ? 'Ready' : 'Needs input');
  const consoleStateLabel = activeCallSid
    ? (callConsoleTerminal
      ? 'Complete'
      : ((callConsoleBusy || callConsoleRefreshing) ? 'Refreshing' : 'Tracking'))
    : 'Idle';
  const remainingRequirementCount = Math.max(0, missingRequirements.length - 1);
  const actionBarTitle = submitResult?.call_sid
    ? 'Call tracking is active'
    : (canSubmit ? 'Ready to start call' : 'Complete launch requirements');
  const actionBarDescription = submitResult?.call_sid
    ? `Tracking ${submitResult.call_sid} in the live console below.`
    : (canSubmit
      ? `This will start an outbound call to ${normalizedNumber}${workflowMode === 'script' ? ` using ${selectedScriptName || `script #${effectiveScriptId}`}` : ''}.`
      : `${missingRequirements[0] || 'Fill the remaining fields'}${remainingRequirementCount > 0 ? ` and ${remainingRequirementCount} more ${remainingRequirementCount === 1 ? 'item' : 'items'}` : ''}.`);

  const refreshPersonaCatalog = useCallback(async (): Promise<void> => {
    setPersonaCatalogLoading(true);
    setPersonaCatalogError('');
    try {
      const response = await request<CallPersonaCatalogResponse>('/api/personas', {
        method: 'GET',
      });
      const builtinProfiles = Array.isArray(response?.builtin)
        ? response.builtin.map(normalizeCallPersonaProfile).filter(Boolean) as CallPersonaProfile[]
        : [];
      const customProfiles = Array.isArray(response?.custom)
        ? response.custom.map(normalizeCallPersonaProfile).filter(Boolean) as CallPersonaProfile[]
        : [];
      const nextProfiles = [...builtinProfiles, ...customProfiles];
      setPersonaProfiles(
        nextProfiles.length > 0
          ? mergeCallPersonaProfiles(nextProfiles, CALL_FALLBACK_PERSONAS)
          : [...CALL_FALLBACK_PERSONAS],
      );
    } catch (nextError) {
      setPersonaCatalogError(toErrorMessage(nextError));
      setPersonaProfiles([...CALL_FALLBACK_PERSONAS]);
    } finally {
      setPersonaCatalogLoaded(true);
      setPersonaCatalogLoading(false);
    }
  }, [request]);

  const refreshScriptCatalog = async (): Promise<void> => {
    if (!canBrowseScripts) return;
    setScriptCatalogLoading(true);
    setScriptCatalogError('');
    try {
      const response = await invokeAction<CallScriptListResponse>(
        DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_LIST,
        {
          limit: 120,
          flow_type: scriptFlowFilterInput.trim() || undefined,
        },
      );
      const nextRows = toCallScriptRows(response?.scripts);
      setCallScripts(nextRows);
      setSelectedCallScriptId((current) => {
        if (nextRows.length === 0) return '';
        const currentExists = nextRows.some((entry) => toPositiveInt(entry.id) === toPositiveInt(current));
        return currentExists ? current : String(toPositiveInt(nextRows[0]?.id));
      });
    } catch (nextError) {
      setScriptCatalogError(toErrorMessage(nextError));
      setCallScripts([]);
      setSelectedCallScriptId('');
    } finally {
      setScriptCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (!canOperate || personaCatalogLoaded || personaCatalogLoading) return;
    void refreshPersonaCatalog();
  }, [canOperate, personaCatalogLoaded, personaCatalogLoading, refreshPersonaCatalog]);

  useEffect(() => {
    if (personaProfiles.some((entry) => entry.id === selectedPersonaId)) return;
    const fallbackPersonaId = personaProfiles.find((entry) => entry.custom)?.id
      || personaProfiles[0]?.id
      || CALL_CUSTOM_PERSONA_ID;
    setSelectedPersonaId(fallbackPersonaId);
  }, [personaProfiles, selectedPersonaId]);

  useEffect(() => {
    if (workflowMode !== 'custom') return;
    const defaultPurpose = selectedPersona?.defaultPurpose
      || personaPurposeOptions[0]?.id
      || 'general';
    const purposeStillValid = personaPurposeOptions.some((entry) => entry.id === purposeInput);
    if (!purposeStillValid) {
      setPurposeInput(defaultPurpose);
    }
  }, [personaPurposeOptions, purposeInput, selectedPersona, workflowMode]);

  useEffect(() => {
    if (workflowMode !== 'custom' || !isCustomPersonaSelected) {
      if (customFlowPurposePinned) {
        setCustomFlowPurposePinned(false);
      }
      return;
    }
    if (customFlowPurposePinned) return;
    if (normalizedPurposeValue === inferredCustomFlow) return;
    setPurposeInput(inferredCustomFlow);
  }, [
    customFlowPurposePinned,
    inferredCustomFlow,
    isCustomPersonaSelected,
    normalizedPurposeValue,
    workflowMode,
  ]);

  useEffect(() => {
    if (workflowMode !== 'script' || !canBrowseScripts) return;
    if (callScripts.length > 0 || scriptCatalogLoading) return;
    void refreshScriptCatalog();
  }, [callScripts.length, canBrowseScripts, scriptCatalogLoading, workflowMode]);

  useEffect(() => {
    setScriptPlaceholderValues((current) => scriptPlaceholderTokens.reduce<Record<string, string>>((accumulator, token) => {
      accumulator[token] = current[token] || '';
      return accumulator;
    }, {}));
  }, [scriptPlaceholderTokens]);

  useEffect(() => {
    setPaymentProviderGuardAcknowledged(false);
  }, [workflowMode, selectedScriptId, activeCallProvider]);

  const loadCallConsole = useCallback(async (
    targetSid: string,
    options: { background?: boolean } = {},
  ): Promise<boolean> => {
    const normalizedSid = targetSid.trim();
    if (!normalizedSid || callConsoleRequestRef.current === normalizedSid) {
      return false;
    }

    callConsoleRequestRef.current = normalizedSid;
    if (options.background) {
      setCallConsoleRefreshing(true);
    } else {
      setCallConsoleBusy(true);
    }
    setCallConsoleError('');

    try {
      const [detailsPayload, statusPayload] = await Promise.all([
        invokeAction<Record<string, unknown>>(
          DASHBOARD_ACTION_CONTRACTS.CALLS_GET,
          { call_sid: normalizedSid },
        ),
        invokeAction<CallCommandStatusResponse>(
          DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS,
          { call_sid: normalizedSid },
        ),
      ]);

      const detailsRecord = toOptionalRecord(detailsPayload?.call) || toOptionalRecord(detailsPayload);
      const statusRecord = toOptionalRecord(statusPayload);
      const recentStates = toEventRows(statusRecord?.recent_states);
      const notificationRows = toEventRows(statusRecord?.notification_status);
      const liveSnapshot = toOptionalRecord(statusRecord?.live_console);

      if (activeCallSidRef.current !== normalizedSid) {
        return false;
      }

      setCallConsoleDetails(detailsRecord);
      setCallConsoleRecentStates(recentStates);
      setCallConsoleNotifications(notificationRows);
      setCallConsoleLiveSnapshot(liveSnapshot);
      setCallConsoleLoadedSid(normalizedSid);

      const reachedTerminal = isTerminalCallStatus(
        resolveCallConsoleStatus(liveSnapshot, detailsRecord, recentStates),
      );
      if (reachedTerminal && activeCallSidRef.current === normalizedSid) {
        writeActiveCallConsoleSid(sessionTelegramId, '');
      } else {
        setPersistedActiveCallSid(normalizedSid);
        writeActiveCallConsoleSid(sessionTelegramId, normalizedSid);
      }

      return reachedTerminal;
    } catch (nextError) {
      setCallConsoleError(toErrorMessage(nextError));
      return false;
    } finally {
      callConsoleRequestRef.current = '';
      setCallConsoleBusy(false);
      setCallConsoleRefreshing(false);
    }
  }, [invokeAction, sessionTelegramId]);

  useEffect(() => {
    const targetSid = activeCallSid.trim();
    if (!targetSid) return undefined;

    let disposed = false;
    let pollTimer: ReturnType<typeof window.setTimeout> | null = null;

    const scheduleNext = () => {
      if (disposed || callConsoleTerminal) return;
      pollTimer = window.setTimeout(() => {
        void poll(true);
      }, 4000);
    };

    const poll = async (background: boolean) => {
      const reachedTerminal = await loadCallConsole(targetSid, { background });
      if (disposed || reachedTerminal) return;
      scheduleNext();
    };

    if (callConsoleLoadedSid !== targetSid) {
      void poll(false);
    } else if (!callConsoleTerminal) {
      scheduleNext();
    }

    return () => {
      disposed = true;
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [activeCallSid, callConsoleLoadedSid, callConsoleTerminal, loadCallConsole]);

  const submitCall = async (): Promise<void> => {
    if (!canSubmit) return;
    const idempotencyKey = createCallIdempotencyKey();
    setSubmitting(true);
    setSubmitError('');
    setSubmitCode('');
    setSubmitResult(null);
    clearCallConsoleState({ clearPersistedSid: true });

    try {
      const response = await request<CallCommandResponse>('/outbound-call', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          number: normalizedNumber,
          idempotency_key: idempotencyKey,
          user_chat_id: sessionTelegramId || undefined,
          customer_name: customerNameValue || undefined,
          ...(workflowMode === 'script'
            ? {
              script_id: effectiveScriptId,
              script_version: selectedScriptVersion,
              script: selectedScriptName || undefined,
              business_id: selectedScriptBusinessId || undefined,
              prompt: resolvedScriptPromptValue || undefined,
              first_message: resolvedScriptFirstMessageValue
                ? buildPersonalizedCallFirstMessage(
                  resolvedScriptFirstMessageValue,
                  customerNameValue,
                  selectedScriptBusinessId || selectedScriptName || 'Custom',
                )
                : undefined,
              voice_model: selectedScriptVoiceModel || undefined,
              purpose: selectedScriptPurpose || selectedScriptRelationshipFlow || undefined,
              call_profile: selectedScriptRelationshipFlow || undefined,
              conversation_profile: selectedScriptRelationshipFlow || undefined,
              conversation_profile_lock: selectedScriptRelationshipFlow ? true : undefined,
              emotion: selectedScriptEmotion || undefined,
              urgency: selectedScriptUrgency || undefined,
              technical_level: selectedScriptTechnicalLevel || undefined,
            }
            : {
              business_id: selectedPersona && !selectedPersona.custom ? selectedPersona.id : undefined,
              prompt: promptValue,
              first_message: buildPersonalizedCallFirstMessage(
                firstMessageValue,
                customerNameValue,
                selectedPersona?.label || 'Custom Persona',
              ),
              purpose: purposeValue,
              script: selectedPersona?.custom ? 'custom' : selectedPersona?.id || 'custom',
              call_profile: purposeIsRelationshipFlow ? normalizedPurposeValue : undefined,
              conversation_profile: purposeIsRelationshipFlow ? normalizedPurposeValue : undefined,
              conversation_profile_lock: purposeIsRelationshipFlow ? true : undefined,
              voice_model: resolvedVoiceModelValue || undefined,
              emotion: emotionValue !== 'auto' ? emotionValue : undefined,
              urgency: urgencyValue !== 'auto' ? urgencyValue : undefined,
              technical_level: technicalLevelValue !== 'auto' ? technicalLevelValue : undefined,
            }),
        }),
      });
      setSubmitResult(response || null);
    } catch (nextError) {
      setSubmitError(toErrorMessage(nextError));
      setSubmitCode(toErrorCode(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const renderCallSetupWorkspace = (): ReactNode => (
    <>
      <Section
        header="Call setup workspace"
        footer="Set the route, confirm readiness, and keep launch context on one focused screen."
      >
        <div className="va-grid">
          <UiCard>
            <p className="va-card-eyebrow">Launch snapshot</p>
            <div className={`va-overview-metrics ${canSubmit ? 'is-healthy' : 'is-degraded'}`}>
              <UiMetricTile
                label="Mode"
                value={workflowMode === 'script' ? 'Script' : 'Custom'}
              />
              <UiMetricTile
                label="Next"
                value={activeWizardStepLabel}
              />
              <UiMetricTile
                label="Launch"
                value={launchStateLabel}
              />
              <UiMetricTile
                label="Console"
                value={consoleStateLabel}
              />
            </div>
            <p className="va-muted">
              Choose the workflow and complete only the fields needed for this call.
            </p>
            <div className="va-inline-tools">
              <UiButton
                variant={workflowMode === 'script' ? 'primary' : 'secondary'}
                onClick={() => setWorkflowMode('script')}
              >
                Use Call Script
              </UiButton>
              <UiButton
                variant={workflowMode === 'custom' ? 'primary' : 'secondary'}
                onClick={() => setWorkflowMode('custom')}
              >
                Build Custom Persona
              </UiButton>
            </div>
            <UiSelect
              aria-label="Call workflow mode"
              value={workflowMode}
              onChange={(event) => setWorkflowMode(event.target.value as CallWorkflowMode)}
            >
              {CALL_WORKFLOW_MODE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </UiSelect>
            <UiStatePanel
              compact
              title={workflowMode === 'script' ? 'Script-backed workflow' : 'Custom call workflow'}
              description={workflowMode === 'script'
                ? (canBrowseScripts
                  ? 'Browse the live script catalog, fill placeholders, review provider posture, and launch from this page.'
                  : 'Launch with a known script ID when catalog browsing is not available for this access tier.')
                : 'Capture the recipient, prompt, opening line, and conversation posture without leaving this workspace.'}
              tone={workflowMode === 'script' && !canBrowseScripts ? 'warning' : 'info'}
            />
            <UiDisclosure
              title="Setup checklist"
              subtitle={`${completedWizardSteps}/${callWizardSteps.length} phases complete`}
              open
            >
              <ul className="va-list va-list-dense">
                {callWizardSteps.map((step) => (
                  <li key={step.title}>
                    {step.complete ? '[done]' : '[next]'} {step.title}: {step.description}
                  </li>
                ))}
              </ul>
            </UiDisclosure>
          </UiCard>
          <UiCard>
            <p className="va-card-eyebrow">Session coverage</p>
            <div className="va-inline-metrics">
              <UiBadge>Access {accessLevel}</UiBadge>
              <UiBadge>Mode {workflowMode}</UiBadge>
              <UiBadge>{workflowMode === 'script' ? `Script ${effectiveScriptId > 0 ? 'ready' : 'missing'}` : `Prompt ${promptValue && firstMessageValue ? 'ready' : 'missing'}`}</UiBadge>
              <UiBadge>{activeCallSid ? `Console ${consoleStateLabel.toLowerCase()}` : 'Console idle'}</UiBadge>
            </div>
            <UiStatePanel
              compact
              title={workflowMode === 'script'
                ? (canBrowseScripts ? 'Script catalog available' : 'Manual script entry required')
                : 'Custom call execution ready'}
              description={workflowMode === 'script'
                ? (canBrowseScripts
                  ? 'This session can load the live call-script catalog and use it directly for launch.'
                  : 'This session can still launch a script-backed call, but it needs a known script ID.')
                : 'This page posts directly to the live outbound call path using the current Mini App session.'}
              tone={workflowMode === 'script' && !canBrowseScripts ? 'warning' : 'success'}
            />
            {activeCallSid ? (
              <UiStatePanel
                compact
                title={callConsoleTerminal ? 'Recent call finished' : 'Live console attached'}
                description={callConsoleTerminal
                  ? `Recent call ${activeCallSid} reached a terminal state and remains available for review below.`
                  : `Tracking ${activeCallSid} from this workspace while provider and webhook updates continue.`}
                tone={callConsoleTerminal ? 'success' : 'info'}
              />
            ) : null}
            <UiDisclosure
              title="Operational notes"
              subtitle="Access, catalog coverage, and provider safeguards"
            >
              <p className="va-muted">
                Validation and launch still use the same backend contract. This page only compresses setup,
                review, and live tracking into one workspace.
              </p>
              <ul className="va-list va-list-dense">
                <li>
                  {workflowMode === 'script'
                    ? (canBrowseScripts
                      ? 'The live script catalog is available in this session.'
                      : 'Script launch is available, but catalog browsing is restricted for this session.')
                    : 'Custom prompt calls can be prepared and launched directly here.'}
                </li>
                <li>
                  {requiresPaymentProviderGuard
                    ? 'Payment-related scripts still require provider posture confirmation before launch.'
                    : 'Provider posture stays visible during review and launch.'}
                </li>
                <li>
                  Runtime tracking restores the active call SID for the same Telegram session when a call is still in progress.
                </li>
              </ul>
            </UiDisclosure>
          </UiCard>
        </div>
      </Section>

      <Section
        header="Compose call"
        footer={workflowMode === 'script'
          ? 'The required minimum is a valid E.164 number plus a valid script selection. Selected script placeholders are resolved in-page, then the filled prompt and first message are forwarded to the live backend contract.'
          : 'The required minimum is a valid E.164 number plus a prompt and first message. Additional tuning fields stay optional.'}
      >
        <div className="va-grid">
          <UiCard>
            <p className="va-card-eyebrow">Recipient</p>
            <div className="va-inline-tools">
              <UiInput
                aria-label="Destination number"
                placeholder="+18005551234"
                value={numberInput}
                onChange={(event) => setNumberInput(event.target.value)}
              />
              <UiInput
                aria-label="Customer name"
                placeholder="Customer name (optional)"
                value={customerNameInput}
                onChange={(event) => setCustomerNameInput(event.target.value)}
              />
            </div>
            {!numberValid ? (
              <UiStatePanel
                compact
                title="Phone number format required"
                description="Use E.164 format with the + prefix and country code, for example +18005551234."
                tone="warning"
              />
            ) : null}

            <p className="va-card-eyebrow">Workflow</p>
            <div className="va-inline-tools">
              {workflowMode === 'script' ? (
                <>
                  {canBrowseScripts ? (
                    <>
                      <UiInput
                        aria-label="Script flow filter"
                        placeholder="Flow filter (optional)"
                        value={scriptFlowFilterInput}
                        onChange={(event) => setScriptFlowFilterInput(event.target.value)}
                      />
                      <UiButton
                        variant="secondary"
                        disabled={scriptCatalogLoading}
                        onClick={() => {
                          void refreshScriptCatalog();
                        }}
                      >
                        {scriptCatalogLoading ? 'Refreshing...' : 'Refresh Scripts'}
                      </UiButton>
                    </>
                  ) : (
                    <UiInput
                      aria-label="Script ID"
                      placeholder="Script ID"
                      value={manualScriptIdInput}
                      onChange={(event) => setManualScriptIdInput(event.target.value)}
                    />
                  )}
                </>
              ) : (
                <>
                  <UiSelect
                    aria-label="Service persona"
                    value={selectedPersonaId}
                    onChange={(event) => setSelectedPersonaId(event.target.value)}
                  >
                    {personaProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {buildCallPersonaOptionLabel(profile)}
                      </option>
                    ))}
                  </UiSelect>
                  <UiSelect
                    aria-label="Voice selection"
                    value={voiceSelectionInput}
                    onChange={(event) => setVoiceSelectionInput(event.target.value)}
                  >
                    <option value={CALL_VOICE_AUTO_ID}>Auto voice selection</option>
                    {CALL_FALLBACK_VOICE_MODELS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {buildCallVoiceOptionLabel(option)}
                      </option>
                    ))}
                    <option value={CALL_VOICE_CUSTOM_ID}>Custom voice ID</option>
                  </UiSelect>
                </>
              )}
            </div>

            {workflowMode === 'script' ? (
              <>
                {canBrowseScripts ? (
                  <>
                    <p className="va-card-eyebrow">Script catalog</p>
                    <UiSelect
                      aria-label="Call script"
                      value={selectedCallScriptId}
                      onChange={(event) => setSelectedCallScriptId(event.target.value)}
                    >
                      <option value="">Select a call script</option>
                      {callScripts.map((script) => {
                        const scriptId = toPositiveInt(script.id);
                        const scriptName = toTextValue(script.name, `Script #${scriptId || 'unknown'}`);
                        return (
                          <option key={scriptId || scriptName} value={scriptId > 0 ? String(scriptId) : ''}>
                            {scriptId > 0 ? `#${scriptId} ` : ''}{scriptName} [{toFlowTypeLabel(script)}]
                          </option>
                        );
                      })}
                    </UiSelect>
                    {scriptCatalogError ? (
                      <UiStatePanel
                        compact
                        title="Script catalog not loaded"
                        description={scriptCatalogError}
                        tone="error"
                      />
                    ) : null}
                    {!scriptCatalogLoading && callScripts.length === 0 && !scriptCatalogError ? (
                      <UiStatePanel
                        compact
                        title="No scripts loaded"
                        description="No call scripts are currently available for this Mini App session and filter."
                        tone="warning"
                      />
                    ) : null}
                  </>
                ) : (
                  <UiStatePanel
                    compact
                    title={effectiveScriptId > 0 ? 'Known script ID staged' : 'Catalog browsing restricted'}
                    description={effectiveScriptId > 0
                      ? `Script #${effectiveScriptId} is ready for launch. The backend will resolve the script, placeholders, and first message at submit time because this session cannot browse the live catalog.`
                      : 'This session cannot browse the live call-script catalog. Enter a known script ID here or continue in Script Designer for full browsing.'}
                    tone={effectiveScriptId > 0 ? 'info' : 'warning'}
                  />
                )}
                {selectedScript ? (
                  <>
                    <UiStatePanel
                      compact
                      title="Selected script ready"
                      description={`${selectedScriptName || `Script #${selectedScriptId}`} | flow ${selectedScriptFlowLabel} | lifecycle ${selectedScriptLifecycleLabel} | voice ${scriptVoiceRoutingLabel}`}
                      tone="success"
                    />
                    {!resolvedScriptFirstMessageValue ? (
                      <UiStatePanel
                        compact
                        title="First message missing after resolution"
                        description="The bot flow requires a first message before launch. Edit the script or fill any missing placeholders before continuing."
                        tone="error"
                      />
                    ) : null}
                    {scriptPlaceholderTokens.length > 0 ? (
                      <>
                        <p className="va-card-eyebrow">Variables</p>
                        <div className="va-inline-tools">
                          {scriptPlaceholderTokens.map((token) => (
                            <UiInput
                              key={token}
                              aria-label={`Variable ${token}`}
                              placeholder={`${token} (optional)`}
                              value={scriptPlaceholderValues[token] || ''}
                              onChange={(event) => setScriptPlaceholderValues((current) => ({
                                ...current,
                                [token]: event.target.value,
                              }))}
                            />
                          ))}
                        </div>
                        <UiStatePanel
                          compact
                          title="Placeholder resolution"
                          description={unresolvedScriptPlaceholderTokens.length > 0
                            ? `${scriptPlaceholderSummary}. Leaving a field blank keeps its original {token} placeholder in the launch payload.`
                            : `${scriptPlaceholderSummary}. All detected placeholders are resolved in the in-page preview below.`}
                          tone={unresolvedScriptPlaceholderTokens.length > 0 ? 'warning' : 'success'}
                        />
                      </>
                    ) : null}
                    {requiresPaymentProviderGuard ? (
                      paymentProviderGuardBlocked ? (
                        <>
                          <UiStatePanel
                            compact
                            title="Payment flow provider guard"
                            description={`Active call provider is ${activeCallProvider}. Payment capture is most reliable on twilio. Continue only if you intend to run this flow on the current provider.`}
                            tone="warning"
                          />
                          <div className="va-inline-tools">
                            <UiButton
                              variant="primary"
                              disabled={paymentProviderGuardAcknowledged}
                              onClick={() => setPaymentProviderGuardAcknowledged(true)}
                            >
                              {paymentProviderGuardAcknowledged ? 'Continuing on current provider' : 'Continue Anyway'}
                            </UiButton>
                            <UiButton
                              variant="secondary"
                              onClick={() => {
                                setSelectedCallScriptId('');
                                setPaymentProviderGuardAcknowledged(false);
                              }}
                            >
                              Choose Another Script
                            </UiButton>
                            <UiButton
                              variant="plain"
                              onClick={() => {
                                setSelectedCallScriptId('');
                                setSubmitResult(null);
                                setSubmitError('');
                                setSubmitCode('');
                                setPaymentProviderGuardAcknowledged(false);
                              }}
                            >
                              Cancel Launch
                            </UiButton>
                          </div>
                        </>
                      ) : (
                        <UiStatePanel
                          compact
                          title="Payment flow provider posture"
                          description={activeCallProvider
                            ? `Active call provider is ${activeCallProvider}. This payment flow matches the preferred twilio route.`
                            : 'Provider posture is unavailable in the current session snapshot. Verify Provider status if this payment flow is sensitive to routing.'}
                          tone={activeCallProvider ? 'success' : 'info'}
                        />
                      )
                    ) : null}
                    <UiDisclosure
                      title="Script preflight"
                      subtitle="Script metadata, variable coverage, and launch posture"
                    >
                      <ul className="va-list va-list-dense">
                        <li>Source: {scriptSelectionSourceLabel}</li>
                        <li>Script: {selectedScriptName || `Script #${selectedScriptId}`}</li>
                        <li>Flow: {selectedScriptFlowLabel}</li>
                        <li>Lifecycle: {selectedScriptLifecycleLabel}</li>
                        <li>Voice routing: {scriptVoiceRoutingLabel}</li>
                        {selectedScriptBusinessId ? <li>Persona / business: {selectedScriptBusinessId}</li> : null}
                        {selectedScriptObjectiveTags.length > 0 ? (
                          <li>Objective tags: {selectedScriptObjectiveTags.join(', ')}</li>
                        ) : null}
                        <li>{scriptPlaceholderSummary}</li>
                        {unresolvedScriptPlaceholderTokens.length > 0 ? (
                          <li>Unresolved placeholders: {unresolvedScriptPlaceholderTokens.join(', ')}</li>
                        ) : null}
                        {resolvedScriptFirstMessageValue ? (
                          <li>Resolved first message preview: {resolvedScriptFirstMessageValue}</li>
                        ) : null}
                      </ul>
                    </UiDisclosure>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {personaCatalogError ? (
                  <UiStatePanel
                    compact
                    title="Persona catalog fallback active"
                    description={`${personaCatalogError} The page is using the local persona fallback list from the bot flow.`}
                    tone="warning"
                  />
                ) : null}
                {personaCatalogLoading ? (
                  <UiStatePanel
                    compact
                    title="Refreshing persona guidance"
                    description="Loading the latest service personas from the bot-backed persona endpoint."
                    tone="info"
                  />
                ) : null}
                <UiStatePanel
                  compact
                  title={selectedPersona?.custom ? 'Custom persona path' : `${selectedPersona?.label || 'Persona'} selected`}
                  description={selectedPersona?.custom
                    ? 'Write the prompt and opening line manually, then use the recommended tone settings below as a guide.'
                    : `${selectedPersona?.description || 'Use this service persona as the starting point for tone and workflow posture.'} Recommended defaults stay available when the selectors remain on Auto.`}
                  tone={selectedPersona?.custom ? 'info' : 'success'}
                />
                <p className="va-card-eyebrow">Purpose and tone</p>
                <div className="va-inline-tools">
                  <UiSelect
                    aria-label="Call purpose"
                    value={purposeInput}
                    onChange={(event) => {
                      setPurposeInput(event.target.value);
                      if (isCustomPersonaSelected) {
                        setCustomFlowPurposePinned(true);
                      }
                    }}
                  >
                    {personaPurposeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.emoji ? `${option.emoji} ${option.label}` : option.label}
                      </option>
                    ))}
                  </UiSelect>
                  <UiSelect
                    aria-label="Emotion"
                    value={emotionInput}
                    onChange={(event) => setEmotionInput(event.target.value)}
                  >
                    {CALL_MOOD_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </UiSelect>
                  <UiSelect
                    aria-label="Urgency"
                    value={urgencyInput}
                    onChange={(event) => setUrgencyInput(event.target.value)}
                  >
                    {CALL_URGENCY_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </UiSelect>
                  <UiSelect
                    aria-label="Technical level"
                    value={technicalLevelInput}
                    onChange={(event) => setTechnicalLevelInput(event.target.value)}
                  >
                    {CALL_TECH_LEVEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </UiSelect>
                </div>
                <UiStatePanel
                  compact
                  title="Recommended posture"
                  description={`Purpose ${callPurposeLabel} | tone ${recommendedMoodLabel} | urgency ${recommendedUrgencyLabel} | technical level ${recommendedTechLevelLabel}`}
                  tone="info"
                />
                {selectedPersona?.custom ? (
                  <UiStatePanel
                    compact
                    title="Custom flow binding"
                    description={purposeIsRelationshipFlow
                      ? `${callPurposeLabel} will be locked as the conversation profile for this launch, matching bot custom-flow behavior.`
                      : 'General flow selected. No relationship profile lock will be applied.'}
                    tone={purposeIsRelationshipFlow ? 'info' : 'success'}
                  />
                ) : null}
                {selectedPersona?.custom ? (
                  <>
                    <UiStatePanel
                      compact
                      title="Flow recommendation"
                      description={customFlowMatchesRecommendation
                        ? `Recommended from prompt text: ${inferredCustomFlowLabel}.`
                        : `Recommended from prompt text: ${inferredCustomFlowLabel}. Current selection stays on ${callPurposeLabel}.`}
                      tone={customFlowMatchesRecommendation ? 'success' : 'info'}
                    />
                    {!customFlowMatchesRecommendation ? (
                      <div className="va-inline-tools">
                        <UiButton
                          variant="secondary"
                          onClick={() => {
                            setPurposeInput(inferredCustomFlow);
                            setCustomFlowPurposePinned(false);
                          }}
                        >
                          Use Recommended Flow
                        </UiButton>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {voiceSelectionInput === CALL_VOICE_CUSTOM_ID ? (
                  <UiInput
                    aria-label="Voice model"
                    placeholder="Voice model ID"
                    value={voiceModelInput}
                    onChange={(event) => setVoiceModelInput(event.target.value)}
                  />
                ) : (
                  <UiStatePanel
                    compact
                    title="Voice routing"
                    description={selectedVoiceOption
                      ? `Using ${buildCallVoiceOptionLabel(selectedVoiceOption)} from the bot fallback voice catalog.`
                      : 'Leaving voice selection on Auto so the backend can choose the best voice for this flow.'}
                    tone="info"
                  />
                )}
                <p className="va-card-eyebrow">Prompt</p>
                <UiTextarea
                  aria-label="Call prompt"
                  placeholder="Describe the persona, constraints, and goal for the outbound call."
                  rows={6}
                  value={promptInput}
                  onChange={(event) => setPromptInput(event.target.value)}
                />

                <p className="va-card-eyebrow">First message</p>
                <UiTextarea
                  aria-label="First message"
                  placeholder="Write the first spoken line the call should use."
                  rows={4}
                  value={firstMessageInput}
                  onChange={(event) => setFirstMessageInput(event.target.value)}
                />
                <UiStatePanel
                  compact
                  title="Greeting behavior"
                  description={customerNameValue
                    ? `The launch payload will prepend "Hello ${customerNameValue}!" to the first message, matching the bot flow.`
                    : 'If you add a customer name above, the first message will be personalized before launch.'}
                  tone="info"
                />
              </>
            )}

          </UiCard>

          <UiCard>
            <p className="va-card-eyebrow">Launch review</p>
            <div className="va-inline-metrics">
              <UiBadge>Recipient {numberValid ? normalizedNumber : 'missing'}</UiBadge>
              <UiBadge>Mode {workflowMode}</UiBadge>
              <UiBadge>Launch {launchStateLabel}</UiBadge>
              <UiBadge>{requiresPaymentProviderGuard ? 'Provider guard active' : 'Standard flow'}</UiBadge>
            </div>

            {missingRequirements.length > 0 ? (
              <UiStatePanel
                compact
                title="Call launch requirements not met"
                description={missingRequirements.join(' | ')}
                tone="warning"
              />
            ) : null}

            {requiresPaymentProviderGuard ? (
              <UiStatePanel
                compact
                title="Provider guard state"
                description={paymentProviderGuardBlocked
                  ? (paymentProviderGuardAcknowledged
                    ? `Non-preferred provider override acknowledged for ${activeCallProvider}.`
                    : `Waiting for provider-guard confirmation because active call provider is ${activeCallProvider}.`)
                  : (activeCallProvider
                    ? `Payment flow aligned to ${activeCallProvider}.`
                    : 'Provider posture unavailable; verify routing if this call depends on secure payment capture.')}
                tone={paymentProviderGuardBlocked && !paymentProviderGuardAcknowledged ? 'warning' : 'info'}
              />
            ) : null}
            {submitError ? (
              <UiStatePanel
                title="Call launch failed"
                description={submitCode ? `${submitError} [${submitCode}]` : submitError}
                tone="error"
              />
            ) : null}

            {submitResult?.call_sid ? (
              <UiStatePanel
                title={submitResult.deduped ? 'Existing call request reused' : 'Call launched'}
                description={`${submitResult.provider || 'Provider'} accepted the request for ${submitResult.to || normalizedNumber}. Status: ${submitResult.status || 'queued'}. Call SID: ${submitResult.call_sid}.`}
                tone="success"
              />
            ) : null}

            {!submitError && !submitResult?.call_sid ? (
              <UiStatePanel
                compact
                title="No active submission yet"
                description="Review the brief, then launch the outbound call when the required fields are complete."
                tone="info"
              />
            ) : null}

            <UiDisclosure
              title="Call brief"
              subtitle="Recipient, path, and launch inputs"
              open
            >
              <ul className="va-list va-list-dense">
                {callBriefLines.map((line, index) => (
                  <li key={`call-brief-${index}-${line}`}>{line}</li>
                ))}
              </ul>
            </UiDisclosure>

            {scriptSummaryLines.length > 0 ? (
              <UiDisclosure
                title="Selected script"
                subtitle={`${selectedScriptName || `Script #${effectiveScriptId}`}`}
              >
                {selectedScript && toTextValue(selectedScript.description) ? (
                  <p className="va-muted">{toTextValue(selectedScript.description)}</p>
                ) : null}
                <ul className="va-list va-list-dense">
                  {scriptSummaryLines.map((line, index) => (
                    <li key={`script-summary-${index}-${line}`}>{line}</li>
                  ))}
                </ul>
              </UiDisclosure>
            ) : null}

            {(resolvedScriptPromptValue || resolvedScriptFirstMessageValue) ? (
              <UiDisclosure
                title="Resolved script content"
                subtitle="Final prompt content after variable replacement"
              >
                <ul className="va-list va-list-dense">
                  {resolvedScriptPromptValue ? <li>Prompt: {resolvedScriptPromptValue}</li> : null}
                  {resolvedScriptFirstMessageValue ? <li>First message: {resolvedScriptFirstMessageValue}</li> : null}
                </ul>
              </UiDisclosure>
            ) : null}

            {warningList.length > 0 ? (
              <UiDisclosure
                title="Warnings"
                subtitle={`${warningList.length} item${warningList.length === 1 ? '' : 's'} to review`}
                tone="warning"
              >
                <ul className="va-list va-list-dense">
                  {warningList.map((warning, index) => (
                    <li key={`warning-${index}-${warning}`}>{warning}</li>
                  ))}
                </ul>
              </UiDisclosure>
            ) : null}
          </UiCard>
        </div>

        <UiActionBar
          title={actionBarTitle}
          description={actionBarDescription}
          actions={(
            <>
              <UiButton
                variant="primary"
                disabled={!canSubmit}
                onClick={() => {
                  void submitCall();
                }}
              >
                {submitting ? 'Starting call...' : 'Start Call'}
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={submitting && !submitResult}
                onClick={() => {
                  setSubmitResult(null);
                  setSubmitError('');
                  setSubmitCode('');
                  clearCallConsoleState({ clearPersistedSid: true });
                }}
              >
                Clear Result
              </UiButton>
            </>
          )}
        />
      </Section>
    </>
  );

  if (loading) {
    return <CallLoadingState pageTitle={pageTitle} />;
  }

  return (
    <Page back>
      <List>
        <Section header={pageTitle} footer={contract.notes}>
          <Cell subtitle={contract.summary}>
            {describeAccessLevel(accessLevel)}
          </Cell>
          <Cell
            subtitle={error ? `Session needs attention. ${error}` : 'Call workspace is ready.'}
            after={<Navigation>{error ? 'Retry' : 'Ready'}</Navigation>}
            onClick={() => {
              void reload();
            }}
          >
            Session status
          </Cell>
          {errorCode ? (
            <Cell subtitle="Latest session issue code">
              {errorCode}
            </Cell>
          ) : null}
        </Section>

        {!canOperate ? (
          <CallAccessRequiredSection />
        ) : (
          <>
            {renderCallSetupWorkspace()}

            <CallLiveConsoleSection
              activeCallSid={activeCallSid}
              callConsoleBusy={callConsoleBusy}
              callConsoleRefreshing={callConsoleRefreshing}
              callConsoleTerminal={callConsoleTerminal}
              callConsoleError={callConsoleError}
              liveConsoleStatus={liveConsoleStatus}
              liveConsolePhase={liveConsolePhase}
              callConsoleDetails={callConsoleDetails}
              callConsoleLiveSnapshot={callConsoleLiveSnapshot}
              submitProvider={submitResult?.provider || ''}
              submitTo={submitResult?.to || ''}
              normalizedNumber={normalizedNumber}
              selectedScriptName={selectedScriptName}
              liveConsolePreview={liveConsolePreview}
              liveConsoleLastEvents={liveConsoleLastEvents}
              callConsoleRecentStates={callConsoleRecentStates}
              callConsoleNotifications={callConsoleNotifications}
              onRefresh={() => {
                void loadCallConsole(activeCallSid, { background: false });
              }}
            />
          </>
        )}

        <CallQuickActionsSection
          listedActions={listedActions}
          accessLevel={accessLevel}
          pathname={location.pathname}
        />
        <CallContinueAdminSection />
      </List>
    </Page>
  );
}

export const CallCommandPage: FC = () => <CallCommandPageContent />;

export default CallCommandPage;
