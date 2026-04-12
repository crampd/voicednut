import type { FC } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
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
  estimateSmsSegments,
  isValidE164,
  normalizePhone,
  toInt,
  toText,
} from '@/services/admin-dashboard/dashboardPrimitives';
import { resolveDashboardAction } from '@/services/admin-dashboard/dashboardActionGuards';

import {
  SMS_CALLBACK_PARITY_ROWS,
  SMS_MESSAGE_MAX_CHARS,
  createSmsProviderSnapshot,
  describeAccessLevel,
  parseCallbackToken,
  renderQuickActionCell,
  resolveCallbackActionLabel,
  resolveCommandPageLoadingCopy,
  resolveCommandPageTitle,
  summarizeBulkSmsOperation,
  summarizeBulkSmsStats,
  summarizeSmsMessage,
  toBulkSmsOperations,
  toErrorMessage,
  toEventRows,
  toJsonText,
  toTextList,
} from './CommandPages.tsx';

type SmsCommandMessageStatusResponse = {
  success?: boolean;
  message?: unknown;
  error?: unknown;
};

type SmsCommandMessagesResponse = {
  success?: boolean;
  messages?: unknown;
  error?: unknown;
};

type SmsCommandStatsResponse = {
  success?: boolean;
  total_messages?: unknown;
  total?: unknown;
  sent_messages?: unknown;
  received_messages?: unknown;
  delivered_count?: unknown;
  failed_count?: unknown;
  success_rate?: unknown;
  error?: unknown;
};

type SmsCommandBulkStatusOperation = {
  id?: unknown;
  created_at?: unknown;
  total_recipients?: unknown;
  successful?: unknown;
  failed?: unknown;
  message?: unknown;
  provider?: unknown;
};

type SmsCommandBulkStatusResponse = {
  success?: boolean;
  summary?: unknown;
  operations?: unknown;
  time_period_hours?: unknown;
  error?: unknown;
};

type SmsCommandProviderStatusResponse = {
  success?: boolean;
  channel?: unknown;
  provider?: unknown;
  supported_providers?: unknown;
  sms_provider?: unknown;
  sms_supported_providers?: unknown;
  sms_readiness?: unknown;
  providers?: unknown;
};

function SmsCommandPageContent() {
  const contract = MINIAPP_COMMAND_PAGE_CONTRACTS.SMS;
  const pageTitle = resolveCommandPageTitle('SMS');
  const location = useLocation();
  const navigate = useNavigate();
  const {
    loading,
    error,
    errorCode,
    accessLevel,
    hasCapability,
    invokeAction,
    reload,
  } = useMiniAppCommandSession();
  const listedActions = contract.actionIds;
  const [statusSidInput, setStatusSidInput] = useState<string>('');
  const [conversationPhoneInput, setConversationPhoneInput] = useState<string>('');
  const [sendRecipientInput, setSendRecipientInput] = useState<string>('');
  const [sendMessageInput, setSendMessageInput] = useState<string>('');
  const [sendProviderInput, setSendProviderInput] = useState<string>('');
  const [sendScheduleAtInput, setSendScheduleAtInput] = useState<string>('');
  const [sendBusy, setSendBusy] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<string>('');
  const [statusBusy, setStatusBusy] = useState<boolean>(false);
  const [conversationBusy, setConversationBusy] = useState<boolean>(false);
  const [recentBusy, setRecentBusy] = useState<boolean>(false);
  const [statsBusy, setStatsBusy] = useState<boolean>(false);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [precheckBusy, setPrecheckBusy] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>('');
  const [callbackActionInput, setCallbackActionInput] = useState<string>('SMS_SEND');
  const [callbackResult, setCallbackResult] = useState<string>('');
  const [guidedActionHint, setGuidedActionHint] = useState<string>('');
  const [statusSnapshot, setStatusSnapshot] = useState<Record<string, unknown> | null>(null);
  const [recentMessages, setRecentMessages] = useState<Array<Record<string, unknown>>>([]);
  const [recentPage, setRecentPage] = useState<number>(1);
  const [recentLimit, setRecentLimit] = useState<number>(10);
  const [conversationMessages, setConversationMessages] = useState<Array<Record<string, unknown>>>([]);
  const [statsSnapshot, setStatsSnapshot] = useState<Record<string, unknown> | null>(null);
  const [bulkOperations, setBulkOperations] = useState<SmsCommandBulkStatusOperation[]>([]);
  const [bulkSummary, setBulkSummary] = useState<Record<string, unknown> | null>(null);
  const [providerSnapshot, setProviderSnapshot] = useState<Record<string, unknown> | null>(null);
  const [bulkJobIdInput, setBulkJobIdInput] = useState<string>('');

  const canOperate = accessLevel === 'authorized' || accessLevel === 'admin';
  const isAdminAccess = accessLevel === 'admin';
  const canManageProvider = hasCapability('provider_manage');
  const canUseSmsCore = canOperate;
  const canUseSmsAdminTools = isAdminAccess;
  const statusSid = statusSidInput.trim();
  const sendRecipient = normalizePhone(sendRecipientInput.trim());
  const sendRecipientValid = isValidE164(sendRecipient);
  const sendMessage = sendMessageInput.trim();
  const sendMessageLength = sendMessage.length;
  const sendMessageTooLong = sendMessageLength > SMS_MESSAGE_MAX_CHARS;
  const sendMessageSegmentEstimate = estimateSmsSegments(sendMessage);
  const sendProvider = sendProviderInput.trim();
  const normalizedConversationPhone = normalizePhone(conversationPhoneInput.trim());
  const conversationPhoneValid = isValidE164(normalizedConversationPhone);
  const bulkJobId = bulkJobIdInput.trim();
  const bulkSmsRoute = MINIAPP_COMMAND_ACTION_CONTRACTS.BULK_SMS.routePath
    ?? DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT;
  const activeBusy = sendBusy
    || statusBusy
    || conversationBusy
    || recentBusy
    || statsBusy
    || bulkBusy
    || precheckBusy;
  const actionReadyCount = Number(Boolean(statusSnapshot))
    + Number(Boolean(callbackResult))
    + Number(Boolean(statsSnapshot))
    + Number(Boolean(bulkSummary))
    + Number(Boolean(providerSnapshot))
    + Number(recentMessages.length > 0)
    + Number(conversationMessages.length > 0)
    + Number(bulkOperations.length > 0);
  const smsComposerReady = sendRecipientValid && Boolean(sendMessage) && !sendMessageTooLong && canUseSmsCore;
  const recentCanGoPrev = recentPage > 1;
  const recentHasFullPage = recentMessages.length >= recentLimit;
  const recentCanGoNext = recentHasFullPage;
  const scheduleInputProvided = sendScheduleAtInput.trim().length > 0;
  const scheduleCandidateMs = scheduleInputProvided ? Date.parse(sendScheduleAtInput) : Number.NaN;
  const scheduleValidationError = scheduleInputProvided
    ? (Number.isNaN(scheduleCandidateMs)
      ? 'Scheduled time is invalid.'
      : (scheduleCandidateMs <= Date.now() ? 'Scheduled time must be in the future.' : ''))
    : '';
  const visibleSmsCallbackRows = SMS_CALLBACK_PARITY_ROWS.filter((row) => {
    const { baseAction } = parseCallbackToken(row.callbackAction);
    if (baseAction === 'SMS_SEND' || baseAction === 'SMS_SCHEDULE' || baseAction === 'SMS_STATUS') {
      return canUseSmsCore;
    }
    if (baseAction === 'BULK_SMS_PRECHECK') {
      return canManageProvider;
    }
    return canUseSmsAdminTools;
  });
  const selectedSmsCallbackAction = visibleSmsCallbackRows.find((row) => row.callbackAction === callbackActionInput)
    ? callbackActionInput
    : (visibleSmsCallbackRows[0]?.callbackAction || '');
  const smsActionBarTitle = sendResult
    ? 'SMS request accepted'
    : (smsComposerReady ? 'Ready to send' : 'Complete send details');
  const smsActionBarDescription = sendResult
    ? sendResult
    : (smsComposerReady
      ? `Send now to ${sendRecipient}. Scheduling is ${scheduleInputProvided
        ? (scheduleValidationError ? 'waiting for a valid future time' : 'available')
        : 'waiting for a send time'}.`
      : (!canUseSmsCore
        ? 'Authorized access is required for SMS actions.'
        : (!sendRecipientValid
          ? 'Add a valid E.164 recipient before sending.'
          : (sendMessageTooLong
            ? `Message exceeds ${SMS_MESSAGE_MAX_CHARS} characters. Shorten it before sending.`
            : 'Add a message body before sending.'))));

  const resolveScheduledIso = (): { iso: string | null; error: string | null } => {
    const scheduledAtMs = Date.parse(sendScheduleAtInput);
    if (Number.isNaN(scheduledAtMs)) {
      return { iso: null, error: 'Scheduled time is invalid.' };
    }
    if (scheduledAtMs <= Date.now()) {
      return { iso: null, error: 'Scheduled time must be in the future.' };
    }
    return { iso: new Date(scheduledAtMs).toISOString(), error: null };
  };

  const runSendNow = async (): Promise<void> => {
    if (!sendRecipientValid || !sendMessage || !canUseSmsCore) return;
    if (sendMessageTooLong) {
      setActionError(`SMS message exceeds ${SMS_MESSAGE_MAX_CHARS} characters. Shorten the message before sending.`);
      return;
    }
    setGuidedActionHint('');
    setSendBusy(true);
    setActionError('');
    setSendResult('');
    try {
      await invokeAction(
        DASHBOARD_ACTION_CONTRACTS.SMS_BULK_SEND,
        {
          recipients: [sendRecipient],
          message: sendMessage,
          provider: sendProvider || undefined,
          options: {
            durable: true,
          },
        },
      );
      setSendResult(`Queued SMS send for ${sendRecipient}.`);
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setSendBusy(false);
    }
  };

  const runSchedule = async (): Promise<void> => {
    if (!sendRecipientValid || !sendMessage || !sendScheduleAtInput || !canUseSmsCore) return;
    if (sendMessageTooLong) {
      setActionError(`SMS message exceeds ${SMS_MESSAGE_MAX_CHARS} characters. Shorten the message before scheduling.`);
      return;
    }
    setGuidedActionHint('');
    const scheduleResolution = resolveScheduledIso();
    if (!scheduleResolution.iso || scheduleResolution.error) {
      setActionError(scheduleResolution.error ?? 'Scheduled time is invalid.');
      return;
    }
    const scheduledIso = scheduleResolution.iso;
    setSendBusy(true);
    setActionError('');
    setSendResult('');
    try {
      await invokeAction(
        DASHBOARD_ACTION_CONTRACTS.SMS_SCHEDULE_SEND,
        {
          to: sendRecipient,
          message: sendMessage,
          scheduled_time: scheduledIso,
          provider: sendProvider || undefined,
          options: {
            durable: true,
          },
        },
      );
      setSendResult(`Scheduled SMS for ${sendRecipient} at ${scheduledIso}.`);
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setSendBusy(false);
    }
  };

  const runStatusLookup = async (): Promise<void> => {
    if (!statusSid || !canUseSmsCore) return;
    setGuidedActionHint('');
    setStatusBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<SmsCommandMessageStatusResponse>(
        DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGE_STATUS,
        { message_sid: statusSid },
      );
      const messageRecord = asRecord(payload?.message);
      setStatusSnapshot(Object.keys(messageRecord).length > 0 ? messageRecord : asRecord(payload));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setStatusBusy(false);
    }
  };

  const runConversationLookup = async (): Promise<void> => {
    if (!conversationPhoneValid || !canUseSmsAdminTools) return;
    setGuidedActionHint('');
    setConversationBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<SmsCommandMessagesResponse>(
        DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_CONVERSATION,
        { phone: normalizedConversationPhone, limit: 20 },
      );
      setConversationMessages(toEventRows(payload?.messages));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setConversationBusy(false);
    }
  };

  const runRecentLookup = async (options: { page?: number; limit?: number } = {}): Promise<void> => {
    if (!canUseSmsAdminTools) return;
    const page = Math.max(1, Math.trunc(options.page ?? recentPage) || 1);
    const limit = Math.max(1, Math.min(20, Math.trunc(options.limit ?? recentLimit) || 10));
    setGuidedActionHint('');
    setRecentBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<SmsCommandMessagesResponse>(
        DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_RECENT,
        { limit, offset: (page - 1) * limit },
      );
      setRecentMessages(toEventRows(payload?.messages));
      setRecentPage(page);
      setRecentLimit(limit);
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setRecentBusy(false);
    }
  };

  const runStatsLookup = async (): Promise<void> => {
    if (!canUseSmsAdminTools) return;
    setGuidedActionHint('');
    setStatsBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<SmsCommandStatsResponse>(
        DASHBOARD_ACTION_CONTRACTS.SMS_STATS,
        { hours: 24 },
      );
      setStatsSnapshot(asRecord(payload));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setStatsBusy(false);
    }
  };

  const runBulkStatusLookup = async (options: { limit?: number; hours?: number } = {}): Promise<void> => {
    if (!canUseSmsAdminTools) return;
    setGuidedActionHint('');
    setBulkBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<SmsCommandBulkStatusResponse>(
        DASHBOARD_ACTION_CONTRACTS.SMS_BULK_STATUS,
        {
          limit: options.limit ?? 12,
          hours: options.hours ?? 24,
        },
      );
      setBulkOperations(toBulkSmsOperations(payload?.operations));
      setBulkSummary(asRecord(payload?.summary));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkPrecheck = async (): Promise<void> => {
    if (!canManageProvider) return;
    setGuidedActionHint('');
    setPrecheckBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<SmsCommandProviderStatusResponse>(
        DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
        { channel: 'sms' },
      );
      setProviderSnapshot(createSmsProviderSnapshot(payload));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setPrecheckBusy(false);
    }
  };

  const executeCallbackAction = async (rawCallbackActionInput: string): Promise<void> => {
    if ((!canUseSmsCore && !canManageProvider) || activeBusy) return;
    const rawCallbackAction = rawCallbackActionInput.trim();
    const { baseAction, suffix } = parseCallbackToken(rawCallbackAction);
    const actionLabel = resolveCallbackActionLabel(rawCallbackAction);
    if (!baseAction) {
      setActionError('Select an advanced action first.');
      setCallbackResult('');
      return;
    }
    const actionResolution = resolveDashboardAction(rawCallbackAction);
    if (!actionResolution.actionId || !actionResolution.supported) {
      setActionError(`${actionLabel} is not active for this session. Refresh session data or continue in Admin Console.`);
      setCallbackResult('');
      return;
    }

    let callbackStatusBusy = false;
    let callbackConversationBusy = false;
    let callbackRecentBusy = false;
    let callbackStatsBusy = false;
    let callbackBulkBusy = false;
    let callbackPrecheckBusy = false;
    try {
      setGuidedActionHint('');
      setActionError('');
      setCallbackResult('');
      let callbackSummary = `${actionLabel} completed.`;
      if (baseAction === 'SMS_SEND') {
        if (!canUseSmsCore) {
          setActionError('Send SMS requires authorized access.');
          return;
        }
        if (!sendRecipientValid || !sendMessage) {
          setActionError('Send SMS requires a valid recipient and message body. Fill the single-recipient form first.');
          return;
        }
        if (sendMessageTooLong) {
          setActionError(`Send SMS rejected: message exceeds ${SMS_MESSAGE_MAX_CHARS} characters.`);
          return;
        }
        await invokeAction(rawCallbackAction, {
          recipients: [sendRecipient],
          message: sendMessage,
          provider: sendProvider || undefined,
          options: { durable: true },
        });
        callbackSummary = 'Send SMS queued with the current compose payload.';
      } else if (baseAction === 'SMS_SCHEDULE') {
        if (!canUseSmsCore) {
          setActionError('Schedule SMS requires authorized access.');
          return;
        }
        if (!sendRecipientValid || !sendMessage || !sendScheduleAtInput) {
          setActionError('Schedule SMS requires recipient, message, and schedule timestamp. Fill the scheduling fields first.');
          return;
        }
        if (sendMessageTooLong) {
          setActionError(`Schedule SMS rejected: message exceeds ${SMS_MESSAGE_MAX_CHARS} characters.`);
          return;
        }
        const scheduleResolution = resolveScheduledIso();
        if (!scheduleResolution.iso || scheduleResolution.error) {
          setActionError(scheduleResolution.error ?? 'Scheduled time is invalid.');
          return;
        }
        await invokeAction(rawCallbackAction, {
          to: sendRecipient,
          message: sendMessage,
          scheduled_time: scheduleResolution.iso,
          provider: sendProvider || undefined,
          options: { durable: true },
        });
        callbackSummary = 'SMS scheduling accepted with the current compose payload.';
      } else if (baseAction === 'SMS_STATUS') {
        if (!canUseSmsCore) {
          setActionError('Check Delivery Status requires authorized access.');
          return;
        }
        if (!statusSid) {
          setActionError('Check Delivery Status requires a message SID. Fill the status lookup field first.');
          return;
        }
        callbackStatusBusy = true;
        setStatusBusy(true);
        const payload = await invokeAction<SmsCommandMessageStatusResponse>(
          rawCallbackAction,
          { message_sid: statusSid },
        );
        const messageRecord = asRecord(payload?.message);
        setStatusSnapshot(Object.keys(messageRecord).length > 0 ? messageRecord : asRecord(payload));
        callbackSummary = `Loaded delivery status for ${statusSid}.`;
      } else if (baseAction === 'SMS_CONVO') {
        if (!canUseSmsAdminTools) {
          setActionError('Load Conversation requires admin access.');
          return;
        }
        if (!conversationPhoneValid) {
          setActionError('Load Conversation requires a valid conversation phone. Fill the conversation phone field first.');
          return;
        }
        callbackConversationBusy = true;
        setConversationBusy(true);
        const payload = await invokeAction<SmsCommandMessagesResponse>(
          rawCallbackAction,
          { phone: normalizedConversationPhone, limit: 20 },
        );
        const messages = toEventRows(payload?.messages);
        setConversationMessages(messages);
        callbackSummary = `Loaded ${messages.length} conversation message(s).`;
      } else if (baseAction === 'SMS_RECENT_PAGE') {
        if (!canUseSmsAdminTools) {
          setActionError('Load Recent Messages (Paged) requires admin access.');
          return;
        }
        callbackRecentBusy = true;
        setRecentBusy(true);
        const page = Math.max(1, toInt(suffix, 1));
        const limit = Math.max(1, Math.min(20, Math.trunc(recentLimit) || 10));
        const payload = await invokeAction<SmsCommandMessagesResponse>(
          rawCallbackAction,
          { limit, offset: (page - 1) * limit },
        );
        const messages = toEventRows(payload?.messages);
        setRecentMessages(messages);
        setRecentPage(page);
        setRecentLimit(limit);
        callbackSummary = `Loaded ${messages.length} recent message(s) from page ${page}.`;
      } else if (baseAction === 'SMS_RECENT') {
        if (!canUseSmsAdminTools) {
          setActionError('Load Recent Messages requires admin access.');
          return;
        }
        callbackRecentBusy = true;
        setRecentBusy(true);
        const page = 1;
        const limit = Math.max(1, Math.min(20, Math.trunc(recentLimit) || 10));
        const payload = await invokeAction<SmsCommandMessagesResponse>(
          rawCallbackAction,
          { limit, offset: (page - 1) * limit },
        );
        const messages = toEventRows(payload?.messages);
        setRecentMessages(messages);
        setRecentPage(page);
        setRecentLimit(limit);
        callbackSummary = `Loaded ${messages.length} recent message(s).`;
      } else if (baseAction === 'SMS_STATS') {
        if (!canUseSmsAdminTools) {
          setActionError('Load SMS Stats requires admin access.');
          return;
        }
        callbackStatsBusy = true;
        setStatsBusy(true);
        const payload = await invokeAction<SmsCommandStatsResponse>(rawCallbackAction, { hours: 24 });
        setStatsSnapshot(asRecord(payload));
        callbackSummary = 'Loaded SMS stats snapshot.';
      } else if (baseAction === 'BULK_SMS_PRECHECK') {
        if (!canManageProvider) {
          setActionError('Provider precheck requires provider management capability.');
          return;
        }
        callbackPrecheckBusy = true;
        setPrecheckBusy(true);
        const payload = await invokeAction<SmsCommandProviderStatusResponse>(
          rawCallbackAction,
          { channel: 'sms' },
        );
        const nextSnapshot = createSmsProviderSnapshot(payload);
        setProviderSnapshot(nextSnapshot);
        callbackSummary = `Loaded SMS provider readiness for ${toText(nextSnapshot?.provider, 'unknown')}.`;
      } else if (baseAction === 'BULK_SMS_LIST' || baseAction === 'BULK_SMS_STATS' || baseAction === 'BULK_SMS_STATUS') {
        if (!canUseSmsAdminTools) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires admin access.`);
          return;
        }
        const resolvedJobId = baseAction === 'BULK_SMS_STATUS' ? suffix || bulkJobId : '';
        if (baseAction === 'BULK_SMS_STATUS' && !resolvedJobId) {
          setActionError('Load Bulk Job Details requires a bulk job ID.');
          return;
        }
        callbackBulkBusy = true;
        setBulkBusy(true);
        const payload = await invokeAction<SmsCommandBulkStatusResponse>(
          rawCallbackAction,
          {
            limit: baseAction === 'BULK_SMS_STATUS' ? 50 : 12,
            hours: baseAction === 'BULK_SMS_STATUS' ? 72 : 24,
          },
        );
        const operations = toBulkSmsOperations(payload?.operations);
        const summary = asRecord(payload?.summary);
        setBulkOperations(operations);
        setBulkSummary(summary);
        if (baseAction === 'BULK_SMS_STATUS') {
          const matchedOperation = operations.find((operation) => toText(operation.id, '') === resolvedJobId);
          if (!matchedOperation) {
            setActionError(`Bulk SMS job "${resolvedJobId}" was not found in recent history.`);
            setCallbackResult('');
            return;
          }
          callbackSummary = summarizeBulkSmsOperation(matchedOperation);
        } else if (baseAction === 'BULK_SMS_STATS') {
          callbackSummary = summarizeBulkSmsStats(summary);
        } else {
          callbackSummary = `Loaded ${operations.length} bulk SMS job(s).`;
        }
      } else {
        await invokeAction(rawCallbackAction, {});
      }
      setCallbackResult(callbackSummary);
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
      setCallbackResult('');
    } finally {
      if (callbackStatusBusy) setStatusBusy(false);
      if (callbackConversationBusy) setConversationBusy(false);
      if (callbackRecentBusy) setRecentBusy(false);
      if (callbackStatsBusy) setStatsBusy(false);
      if (callbackBulkBusy) setBulkBusy(false);
      if (callbackPrecheckBusy) setPrecheckBusy(false);
    }
  };

  const runCallbackAction = async (): Promise<void> => {
    if (!selectedSmsCallbackAction) {
      setActionError('Select an advanced action first.');
      return;
    }
    await executeCallbackAction(selectedSmsCallbackAction);
  };

  const runGuidedSmsMenuAction = async (rawCallbackAction: string): Promise<void> => {
    setCallbackActionInput(rawCallbackAction);
    const { baseAction } = parseCallbackToken(rawCallbackAction);
    if (baseAction === 'SMS_SEND') {
      setActionError('');
      setCallbackResult('');
      setGuidedActionHint('Send flow is staged. Fill recipient and message, then select Send Now.');
      return;
    }
    if (baseAction === 'SMS_SCHEDULE') {
      setActionError('');
      setCallbackResult('');
      setGuidedActionHint('Schedule flow is staged. Add recipient, message, and a future schedule time, then select Schedule.');
      return;
    }
    if (baseAction === 'SMS_STATUS' && !statusSid) {
      setActionError('');
      setCallbackResult('');
      setGuidedActionHint('Delivery status flow is staged. Enter a message SID first, then select Check Status.');
      return;
    }
    if (baseAction === 'SMS_CONVO' && !conversationPhoneValid) {
      setActionError('');
      setCallbackResult('');
      setGuidedActionHint('Conversation flow is staged. Enter a valid E.164 phone first, then select Load Conversation.');
      return;
    }
    setGuidedActionHint('');
    await executeCallbackAction(rawCallbackAction);
  };

  const openGuidedSmsRoute = (path: string): void => {
    setActionError('');
    setCallbackResult('');
    setGuidedActionHint('');
    navigate(path);
  };

  if (loading) {
    return (
      <Page back>
        <Placeholder
          header={pageTitle}
          description={resolveCommandPageLoadingCopy(pageTitle)}
        />
      </Page>
    );
  }

  return (
    <Page back>
      <List>
        <Section header={pageTitle} footer={contract.notes}>
          <Cell subtitle={contract.summary}>
            {describeAccessLevel(accessLevel)}
          </Cell>
          <Cell
            subtitle={error ? `Session needs attention. ${error}` : 'SMS workspace is ready.'}
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
          <Section
            header="Access required"
            footer="SMS execution is restricted to authorized users. The Mini App enforces the same rule."
          >
            <UiStatePanel
              title="Authorized access required"
              description="Request access from an admin or use Help Center, Usage Guide, or Quick Actions to review available workflows."
              tone="warning"
            />
          </Section>
        ) : (
          <Section
            header="SMS workspace"
            footer="This page executes SMS diagnostics through shared action contracts while keeping bulk sends in the dedicated sender workspace."
          >
            <div className="va-grid">
              <UiCard>
                <p className="va-card-eyebrow">Workspace overview</p>
                <div className={`va-overview-metrics ${actionReadyCount > 0 || sendResult ? 'is-healthy' : 'is-degraded'}`}>
                  <UiMetricTile label="Access" value={isAdminAccess ? 'Admin' : 'Authorized'} />
                  <UiMetricTile label="Composer" value={smsComposerReady ? 'Ready' : 'Needs input'} />
                  <UiMetricTile label="Diagnostics" value={actionReadyCount > 0 ? `${actionReadyCount} loaded` : 'Idle'} />
                  <UiMetricTile label="Activity" value={activeBusy ? 'Working' : (sendResult ? 'Queued' : 'Standing by')} />
                </div>
                <p className="va-muted">
                  Send one message, inspect delivery state, or move into script and bulk tools without leaving this page.
                </p>
                <div className="va-inline-tools">
                  <UiButton
                    variant="primary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedSmsMenuAction('SMS_SEND');
                    }}
                  >
                    Send SMS
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedSmsMenuAction('SMS_SCHEDULE');
                    }}
                  >
                    Schedule SMS
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedSmsMenuAction('SMS_STATUS');
                    }}
                  >
                    Delivery Status
                  </UiButton>
                </div>
                {guidedActionHint ? (
                  <UiStatePanel
                    compact
                    title="Guided action staged"
                    description={guidedActionHint}
                    tone="info"
                  />
                ) : null}
                {isAdminAccess ? (
                  <div className="va-inline-tools">
                    <UiButton
                      variant="secondary"
                      disabled={!canOperate || activeBusy}
                      onClick={() => {
                        void runGuidedSmsMenuAction('SMS_CONVO');
                      }}
                    >
                      Conversation
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={!canOperate || activeBusy}
                      onClick={() => {
                        void runGuidedSmsMenuAction('SMS_RECENT');
                      }}
                    >
                      Recent SMS
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={!canOperate || activeBusy}
                      onClick={() => {
                        void runGuidedSmsMenuAction('SMS_STATS');
                      }}
                    >
                      SMS Stats
                    </UiButton>
                  </div>
                ) : null}
                <div className="va-inline-tools">
                  {isAdminAccess ? (
                    <UiButton
                      variant="secondary"
                      disabled={activeBusy}
                      onClick={() => {
                        openGuidedSmsRoute(bulkSmsRoute);
                      }}
                    >
                      Open SMS Sender
                    </UiButton>
                  ) : null}
                  <UiButton
                    variant="secondary"
                    disabled={activeBusy}
                    onClick={() => {
                      openGuidedSmsRoute(MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS);
                    }}
                  >
                    Script Workflows
                  </UiButton>
                  <UiButton
                    variant="plain"
                    disabled={activeBusy}
                    onClick={() => {
                      openGuidedSmsRoute(MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU);
                    }}
                  >
                    All Workflows
                  </UiButton>
                </div>
                <UiStatePanel
                  compact
                  title={isAdminAccess ? 'Admin tools are included' : 'Admin tools require admin access'}
                  description={isAdminAccess
                    ? 'Conversation, Recent SMS, SMS Stats, and the bulk sender handoff remain visible because this session has admin access.'
                    : 'Conversation, Recent SMS, SMS Stats, and the bulk sender workspace unlock in admin sessions.'}
                  tone="info"
                />
                <UiStatePanel
                  compact
                  title="Form-backed workflow execution"
                  description="This page runs the same backend action family by using the input fields below as the structured workflow payload."
                  tone="info"
                />
                <UiDisclosure
                  title="Operational notes"
                  subtitle="Action routing, bulk handoff, and parity coverage"
                >
                  <ul className="va-list va-list-dense">
                    <li>Single-recipient send and schedule use the same backend SMS action family as the wider admin console.</li>
                    <li>
                      {isAdminAccess
                        ? 'Conversation, recent activity, stats, and the sender handoff stay available in this session.'
                        : 'Conversation, recent activity, stats, and the sender workspace unlock in admin sessions.'}
                    </li>
                    <li>Advanced action execution remains available below for structured parity checks when needed.</li>
                  </ul>
                </UiDisclosure>
              </UiCard>

              <UiCard>
                <p className="va-card-eyebrow">Single-recipient send</p>
                <UiInput
                  aria-label="SMS recipient"
                  placeholder="+15551230001"
                  value={sendRecipientInput}
                  onChange={(event) => setSendRecipientInput(event.target.value)}
                />
                <UiTextarea
                  aria-label="SMS message body"
                  placeholder="Message body"
                  rows={4}
                  value={sendMessageInput}
                  onChange={(event) => setSendMessageInput(event.target.value)}
                />
                {sendMessage ? (
                  <UiStatePanel
                    compact
                    title={sendMessageTooLong ? 'Message length exceeds SMS limit' : 'SMS payload estimate'}
                    description={sendMessageTooLong
                      ? `Length ${sendMessageLength}/${SMS_MESSAGE_MAX_CHARS}. Reduce the message before sending or scheduling.`
                      : `Length ${sendMessageLength}/${SMS_MESSAGE_MAX_CHARS}. Estimated ${sendMessageSegmentEstimate.segments} segment(s) at ${sendMessageSegmentEstimate.perSegment} chars/segment.`}
                    tone={sendMessageTooLong ? 'warning' : 'info'}
                  />
                ) : null}
                <div className="va-inline-tools">
                  <UiInput
                    aria-label="SMS provider override"
                    placeholder="Provider (optional)"
                    value={sendProviderInput}
                    onChange={(event) => setSendProviderInput(event.target.value)}
                  />
                  <UiInput
                    aria-label="Schedule at"
                    type="datetime-local"
                    value={sendScheduleAtInput}
                    onChange={(event) => setSendScheduleAtInput(event.target.value)}
                  />
                </div>
                {!sendRecipientValid && sendRecipientInput.trim() ? (
                  <UiStatePanel
                    compact
                    title="Recipient phone format required"
                    description="Use E.164 format with the + prefix and country code, for example +18005551234."
                    tone="warning"
                  />
                ) : null}
                {scheduleValidationError ? (
                  <UiStatePanel
                    compact
                    title="Schedule time needs correction"
                    description={scheduleValidationError}
                    tone="warning"
                  />
                ) : null}
                {sendResult ? (
                  <UiStatePanel
                    compact
                    title="Send workflow accepted"
                    description={sendResult}
                    tone="success"
                  />
                ) : null}
                {!canUseSmsAdminTools ? (
                  <UiStatePanel
                    compact
                    title="Admin diagnostics require admin access"
                    description="Conversation, recent messages, stats, and bulk job views unlock in admin sessions."
                    tone="warning"
                  />
                ) : null}

                <UiActionBar
                  title={smsActionBarTitle}
                  description={smsActionBarDescription}
                  actions={(
                    <>
                      <UiButton
                        variant="primary"
                        disabled={!sendRecipientValid || !sendMessage || sendMessageTooLong || !canUseSmsCore || activeBusy}
                        onClick={() => {
                          void runSendNow();
                        }}
                      >
                        {sendBusy ? 'Submitting...' : 'Send Now'}
                      </UiButton>
                      <UiButton
                        variant="secondary"
                        disabled={!sendRecipientValid || !sendMessage || sendMessageTooLong || !sendScheduleAtInput || Boolean(scheduleValidationError) || !canUseSmsCore || activeBusy}
                        onClick={() => {
                          void runSchedule();
                        }}
                      >
                        {sendBusy ? 'Submitting...' : 'Schedule'}
                      </UiButton>
                    </>
                  )}
                />

                <UiDisclosure
                  title="Advanced workflow actions"
                  subtitle="Run mapped actions against the current inputs"
                >
                  <UiSelect
                    aria-label="SMS advanced action"
                    value={selectedSmsCallbackAction}
                    onChange={(event) => setCallbackActionInput(event.target.value)}
                  >
                    {visibleSmsCallbackRows.map((row) => (
                      <option key={row.callbackAction} value={row.callbackAction}>
                        {row.label}
                      </option>
                    ))}
                  </UiSelect>
                  <div className="va-inline-tools">
                    <UiButton
                      variant="secondary"
                      disabled={!selectedSmsCallbackAction || (!canUseSmsCore && !canManageProvider) || activeBusy}
                      onClick={() => {
                        void runCallbackAction();
                      }}
                    >
                      Run Selected Action
                    </UiButton>
                  </div>
                  <ul className="va-list va-list-dense">
                    {visibleSmsCallbackRows.map((row) => (
                      <li key={row.callbackAction}>
                        {row.label} ({row.summary})
                      </li>
                    ))}
                  </ul>
                  {callbackResult ? (
                    <UiStatePanel
                      compact
                      title="Action completed"
                      description={callbackResult}
                      tone="success"
                    />
                  ) : null}
                </UiDisclosure>

                <UiDisclosure
                  title="Status and conversation tools"
                  subtitle="Inspect one message or load a conversation thread"
                >
                  <div className="va-inline-tools">
                    <UiInput
                      aria-label="SMS message SID"
                      placeholder="Message SID"
                      value={statusSidInput}
                      onChange={(event) => setStatusSidInput(event.target.value)}
                    />
                    <UiButton
                      variant="secondary"
                      disabled={!statusSid || !canUseSmsCore || activeBusy}
                      onClick={() => {
                        void runStatusLookup();
                      }}
                    >
                      {statusBusy ? 'Loading...' : 'Check Status'}
                    </UiButton>
                  </div>
                  <div className="va-inline-tools">
                    <UiInput
                      aria-label="Conversation phone"
                      placeholder="+15551230001"
                      value={conversationPhoneInput}
                      onChange={(event) => setConversationPhoneInput(event.target.value)}
                    />
                    <UiButton
                      variant="secondary"
                      disabled={!conversationPhoneValid || !canUseSmsAdminTools || activeBusy}
                      onClick={() => {
                        void runConversationLookup();
                      }}
                    >
                      {conversationBusy ? 'Loading...' : 'Load Conversation'}
                    </UiButton>
                  </div>
                  {!conversationPhoneValid && conversationPhoneInput.trim() ? (
                    <UiStatePanel
                      compact
                      title="Conversation phone format required"
                      description="Use E.164 format with the + prefix and country code, for example +18005551234."
                      tone="warning"
                    />
                  ) : null}
                  {!canUseSmsAdminTools ? (
                    <UiStatePanel
                      compact
                      title="Conversation lookup requires admin access"
                      description="Use SMS status with a message SID in authorized sessions, or switch to an admin session for full conversation history."
                      tone="info"
                    />
                  ) : null}
                  {statusSnapshot ? (
                    <ul className="va-list va-list-dense">
                      <li>SID: {toText(statusSnapshot.message_sid, toText(statusSnapshot.sid, statusSid || 'n/a'))}</li>
                      <li>Status: {toText(statusSnapshot.status, 'unknown')}</li>
                      <li>To: {toText(statusSnapshot.to_number, toText(statusSnapshot.to, 'n/a'))}</li>
                      <li>From: {toText(statusSnapshot.from_number, toText(statusSnapshot.from, 'n/a'))}</li>
                      <li>Provider: {toText(statusSnapshot.provider, 'unknown')}</li>
                    </ul>
                  ) : (
                    <UiStatePanel
                      compact
                      title="No status snapshot"
                      description="Run a SID lookup to inspect single-message delivery state."
                      tone="info"
                    />
                  )}
                </UiDisclosure>
              </UiCard>

              <UiCard>
                <p className="va-card-eyebrow">Diagnostics and history</p>
                <div className="va-inline-metrics">
                  <UiBadge>{providerSnapshot ? 'Provider loaded' : 'Provider idle'}</UiBadge>
                  <UiBadge>{recentMessages.length > 0 ? `Recent ${recentMessages.length}` : 'Recent idle'}</UiBadge>
                  <UiBadge>{statsSnapshot ? 'Stats loaded' : 'Stats idle'}</UiBadge>
                  <UiBadge>{bulkOperations.length > 0 ? `Bulk ${bulkOperations.length}` : 'Bulk idle'}</UiBadge>
                </div>
                <div className="va-inline-tools">
                  <UiSelect
                    aria-label="Recent SMS count"
                    value={String(recentLimit)}
                    onChange={(event) => {
                      const nextLimit = Math.max(1, Math.min(20, toInt(event.target.value, 10)));
                      setRecentLimit(nextLimit);
                      setRecentPage(1);
                      if (canUseSmsAdminTools && !activeBusy) {
                        void runRecentLookup({ page: 1, limit: nextLimit });
                      }
                    }}
                  >
                    <option value="5">5 / page</option>
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                  </UiSelect>
                  <UiButton
                    variant="secondary"
                    disabled={!canUseSmsAdminTools || activeBusy}
                    onClick={() => {
                      void runRecentLookup();
                    }}
                  >
                    {recentBusy ? 'Loading...' : 'Load Recent'}
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canUseSmsAdminTools || activeBusy}
                    onClick={() => {
                      void runStatsLookup();
                    }}
                  >
                    {statsBusy ? 'Loading...' : 'Load Stats'}
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canUseSmsAdminTools || activeBusy}
                    onClick={() => {
                      void runBulkStatusLookup();
                    }}
                  >
                    {bulkBusy ? 'Loading...' : 'Load Bulk Jobs'}
                  </UiButton>
                </div>
                <div className="va-inline-tools">
                  <UiButton
                    variant="plain"
                    disabled={!canUseSmsAdminTools || activeBusy || !recentCanGoPrev}
                    onClick={() => {
                      void runRecentLookup({ page: Math.max(1, recentPage - 1) });
                    }}
                  >
                    Prev Page
                  </UiButton>
                  <UiButton
                    variant="plain"
                    disabled={!canUseSmsAdminTools || activeBusy}
                    onClick={() => {
                      void runRecentLookup();
                    }}
                  >
                    Refresh Page {recentPage}
                  </UiButton>
                  <UiButton
                    variant="plain"
                    disabled={!canUseSmsAdminTools || activeBusy || !recentCanGoNext}
                    onClick={() => {
                      void runRecentLookup({ page: recentPage + 1 });
                    }}
                  >
                    Next Page
                  </UiButton>
                </div>
                <div className="va-inline-tools">
                  <UiInput
                    aria-label="Bulk SMS job ID"
                    placeholder="Bulk SMS job ID (optional)"
                    value={bulkJobIdInput}
                    onChange={(event) => setBulkJobIdInput(event.target.value)}
                  />
                  <UiButton
                    variant="secondary"
                    disabled={!canManageProvider || activeBusy}
                    onClick={() => {
                      void runBulkPrecheck();
                    }}
                  >
                    {precheckBusy ? 'Loading...' : 'Run Bulk Precheck'}
                  </UiButton>
                  <UiButton
                    variant="plain"
                    disabled={activeBusy}
                    onClick={() => {
                      setSendResult('');
                      setCallbackResult('');
                      setStatusSnapshot(null);
                      setRecentMessages([]);
                      setRecentPage(1);
                      setConversationMessages([]);
                      setStatsSnapshot(null);
                      setBulkOperations([]);
                      setBulkSummary(null);
                      setProviderSnapshot(null);
                      setActionError('');
                    }}
                  >
                    Clear Diagnostics
                  </UiButton>
                </div>

                {recentMessages.length === 0
                  && conversationMessages.length === 0
                  && !statsSnapshot
                  && !bulkSummary
                  && bulkOperations.length === 0
                  && !providerSnapshot ? (
                  <UiStatePanel
                    compact
                    title="No SMS diagnostics loaded"
                    description="Run recent, stats, provider precheck, or bulk status actions to populate diagnostics."
                    tone="info"
                  />
                ) : null}

                {providerSnapshot ? (
                  <UiDisclosure
                    title="Provider readiness"
                    subtitle={providerSnapshot.ready === true ? 'Ready for SMS delivery' : 'Configuration needs attention'}
                    open
                  >
                    <ul className="va-list va-list-dense">
                      <li>Channel: {toText(providerSnapshot.channel, 'sms')}</li>
                      <li>Provider: {toText(providerSnapshot.provider, 'unknown')}</li>
                      <li>Readiness: {providerSnapshot.ready === true ? 'Ready' : 'Check configuration'}</li>
                      <li>Supported providers: {toTextList(providerSnapshot.supported_providers).join(', ') || 'n/a'}</li>
                    </ul>
                    {Object.keys(asRecord(providerSnapshot.readiness)).length > 0 ? (
                      <UiStatePanel
                        compact
                        title="SMS provider readiness map"
                        description={toJsonText(providerSnapshot.readiness)}
                        tone={providerSnapshot.ready === true ? 'success' : 'warning'}
                      />
                    ) : null}
                  </UiDisclosure>
                ) : null}

                {recentMessages.length > 0 ? (
                  <UiDisclosure
                    title="Recent messages"
                    subtitle={`${recentMessages.length} item${recentMessages.length === 1 ? '' : 's'} loaded | page ${recentPage} | limit ${recentLimit}`}
                  >
                    <ul className="va-list va-list-dense">
                      {recentMessages.slice(0, 6).map((message, index) => (
                        <li key={`${toText(message.message_sid, toText(message.sid, 'sms'))}-${index}`}>
                          {summarizeSmsMessage(message)}
                        </li>
                      ))}
                    </ul>
                  </UiDisclosure>
                ) : null}

                {conversationMessages.length > 0 ? (
                  <UiDisclosure
                    title="Conversation snapshot"
                    subtitle={`${conversationMessages.length} item${conversationMessages.length === 1 ? '' : 's'} loaded`}
                  >
                    <ul className="va-list va-list-dense">
                      {conversationMessages.slice(0, 6).map((message, index) => (
                        <li key={`${toText(message.message_sid, toText(message.sid, 'convo'))}-${index}`}>
                          {summarizeSmsMessage(message)}
                        </li>
                      ))}
                    </ul>
                  </UiDisclosure>
                ) : null}

                {statsSnapshot ? (
                  <UiDisclosure
                    title="Message stats"
                    subtitle="24-hour delivery snapshot"
                  >
                    <ul className="va-list va-list-dense">
                      <li>Total: {toInt(statsSnapshot.total_messages ?? statsSnapshot.total, 0)}</li>
                      <li>Sent: {toInt(statsSnapshot.sent_messages, 0)}</li>
                      <li>Received: {toInt(statsSnapshot.received_messages, 0)}</li>
                      <li>Delivered: {toInt(statsSnapshot.delivered_count, 0)}</li>
                      <li>Failed: {toInt(statsSnapshot.failed_count, 0)}</li>
                      <li>Success rate: {toText(statsSnapshot.success_rate, '0')}%</li>
                    </ul>
                  </UiDisclosure>
                ) : null}

                {bulkSummary ? (
                  <UiDisclosure
                    title="Bulk summary"
                    subtitle="Recent bulk SMS performance"
                    open
                  >
                    <UiStatePanel
                      compact
                      title="Bulk SMS summary"
                      description={summarizeBulkSmsStats(bulkSummary)}
                      tone="info"
                    />
                  </UiDisclosure>
                ) : null}

                {bulkOperations.length > 0 ? (
                  <UiDisclosure
                    title="Bulk jobs"
                    subtitle={`${bulkOperations.length} job${bulkOperations.length === 1 ? '' : 's'} loaded`}
                  >
                    <ul className="va-list va-list-dense">
                      {bulkOperations.slice(0, 6).map((operation, index) => (
                        <li key={`${toText(operation.id, 'bulk-sms')}-${index}`}>
                          {summarizeBulkSmsOperation(operation)}
                        </li>
                      ))}
                    </ul>
                  </UiDisclosure>
                ) : null}
              </UiCard>
            </div>
          </Section>
        )}

        {actionError ? (
          <Section header="Action error">
            <UiStatePanel
              title="SMS action failed"
              description={actionError}
              tone="error"
            />
          </Section>
        ) : null}

        {canOperate ? (
          <Section header="Workflow snapshot">
            <Cell subtitle="How many workflow panels currently hold data in this session.">
              Loaded slices: {actionReadyCount}
            </Cell>
          </Section>
        ) : null}

        <Section
          header="Quick actions"
          footer="These shortcuts keep the SMS page connected to the rest of the available Mini App workflows."
        >
          {listedActions.map((actionId) => renderQuickActionCell(actionId, accessLevel, location.pathname))}
        </Section>

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
      </List>
    </Page>
  );
}

export const SmsCommandPage: FC = () => <SmsCommandPageContent />;

export default SmsCommandPage;
