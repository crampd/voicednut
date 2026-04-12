import type { FC } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Cell,
  List,
  Navigation,
  Placeholder,
  Section,
  Text,
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
  isLikelyEmail,
  toInt,
  toText,
} from '@/services/admin-dashboard/dashboardPrimitives';
import { resolveDashboardAction } from '@/services/admin-dashboard/dashboardActionGuards';

import {
  EMAIL_CALLBACK_PARITY_ROWS,
  createEmailProviderSnapshot,
  describeAccessLevel,
  parseCallbackToken,
  renderQuickActionCell,
  resolveCallbackActionLabel,
  resolveCommandPageLoadingCopy,
  resolveCommandPageTitle,
  summarizeEmailBulkStats,
  summarizeEmailJob,
  summarizeEmailTemplate,
  toEmailHistoryRows,
  toEmailTemplateRows,
  toErrorMessage,
  toEventRows,
  toJsonText,
  toTextList,
  toTextValue,
} from './CommandPages.tsx';

type EmailCommandPreviewResponse = {
  success?: boolean;
  ok?: boolean;
  missing?: unknown;
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  error?: unknown;
};

type EmailCommandMessageStatusResponse = {
  success?: boolean;
  message?: unknown;
  events?: unknown;
  error?: unknown;
};

type EmailCommandBulkHistoryJob = {
  job_id?: unknown;
  provider?: unknown;
  status?: unknown;
  created_at?: unknown;
  recipient_count?: unknown;
  sent_count?: unknown;
  failed_count?: unknown;
  script_id?: unknown;
  subject?: unknown;
};

type EmailCommandBulkHistoryResponse = {
  success?: boolean;
  jobs?: unknown;
  limit?: unknown;
  offset?: unknown;
};

type EmailCommandBulkSendResponse = {
  success?: boolean;
  bulk_job_id?: unknown;
  job_id?: unknown;
  deduped?: boolean;
  error?: unknown;
};

type EmailCommandBulkJobResponse = {
  success?: boolean;
  job?: unknown;
  error?: unknown;
};

type EmailCommandTemplateSummary = {
  template_id?: unknown;
  id?: unknown;
  name?: unknown;
  subject?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  required_vars?: unknown;
  required_variables?: unknown;
};

type EmailCommandTemplateListResponse = {
  success?: boolean;
  templates?: unknown;
  total?: unknown;
  limit?: unknown;
  offset?: unknown;
};

type EmailCommandProviderStatusResponse = {
  success?: boolean;
  channel?: unknown;
  provider?: unknown;
  supported_providers?: unknown;
  email_provider?: unknown;
  email_supported_providers?: unknown;
  email_readiness?: unknown;
  providers?: unknown;
};

function EmailCommandPageContent() {
  const contract = MINIAPP_COMMAND_PAGE_CONTRACTS.EMAIL;
  const pageTitle = resolveCommandPageTitle('EMAIL');
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
  const [templateIdInput, setTemplateIdInput] = useState<string>('');
  const [previewVariablesInput, setPreviewVariablesInput] = useState<string>('{}');
  const [messageIdInput, setMessageIdInput] = useState<string>('');
  const [jobIdInput, setJobIdInput] = useState<string>('');
  const [sendRecipientInput, setSendRecipientInput] = useState<string>('');
  const [sendProviderInput, setSendProviderInput] = useState<string>('');
  const [sendSubjectInput, setSendSubjectInput] = useState<string>('');
  const [sendHtmlInput, setSendHtmlInput] = useState<string>('');
  const [sendTextInput, setSendTextInput] = useState<string>('');
  const [sendScheduleAtInput, setSendScheduleAtInput] = useState<string>('');
  const [sendBusy, setSendBusy] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<string>('');
  const [previewBusy, setPreviewBusy] = useState<boolean>(false);
  const [statusBusy, setStatusBusy] = useState<boolean>(false);
  const [historyBusy, setHistoryBusy] = useState<boolean>(false);
  const [templatesBusy, setTemplatesBusy] = useState<boolean>(false);
  const [jobBusy, setJobBusy] = useState<boolean>(false);
  const [statsBusy, setStatsBusy] = useState<boolean>(false);
  const [precheckBusy, setPrecheckBusy] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>('');
  const [callbackActionInput, setCallbackActionInput] = useState<string>('EMAIL_SEND');
  const [callbackResult, setCallbackResult] = useState<string>('');
  const [previewSnapshot, setPreviewSnapshot] = useState<EmailCommandPreviewResponse | null>(null);
  const [messageSnapshot, setMessageSnapshot] = useState<Record<string, unknown> | null>(null);
  const [messageEvents, setMessageEvents] = useState<Array<Record<string, unknown>>>([]);
  const [historyRows, setHistoryRows] = useState<EmailCommandBulkHistoryJob[]>([]);
  const [templateRows, setTemplateRows] = useState<EmailCommandTemplateSummary[]>([]);
  const [bulkJobSnapshot, setBulkJobSnapshot] = useState<Record<string, unknown> | null>(null);
  const [statsSnapshot, setStatsSnapshot] = useState<Record<string, unknown> | null>(null);
  const [providerSnapshot, setProviderSnapshot] = useState<Record<string, unknown> | null>(null);

  const canOperate = accessLevel === 'authorized' || accessLevel === 'admin';
  const canManageEmail = hasCapability('email_bulk_manage');
  const canManageProvider = hasCapability('provider_manage');
  const templateId = templateIdInput.trim();
  const messageId = messageIdInput.trim();
  const jobId = jobIdInput.trim();
  const sendRecipient = sendRecipientInput.trim().toLowerCase();
  const sendRecipientValid = isLikelyEmail(sendRecipient);
  const sendProvider = sendProviderInput.trim();
  const sendSubject = sendSubjectInput.trim();
  const sendHtml = sendHtmlInput.trim();
  const sendText = sendTextInput.trim();
  const sendHasContent = Boolean(templateId || sendSubject || sendHtml || sendText);
  const bulkEmailRoute = MINIAPP_COMMAND_ACTION_CONTRACTS.BULK_EMAIL.routePath
    ?? DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT;
  const activeBusy = sendBusy || previewBusy || statusBusy || historyBusy || templatesBusy || jobBusy || statsBusy || precheckBusy;
  const previewMissing = toTextList(previewSnapshot?.missing);
  const previewSubject = toTextValue(previewSnapshot?.subject);
  const previewHtml = toTextValue(previewSnapshot?.html);
  const previewText = toTextValue(previewSnapshot?.text);
  const messageStatus = toTextValue(messageSnapshot?.status);
  const messageProvider = toTextValue(messageSnapshot?.provider);
  const messageTo = toTextValue(messageSnapshot?.to);
  const messageScriptId = toTextValue(messageSnapshot?.script_id);
  const messageCreatedAt = toTextValue(messageSnapshot?.created_at);
  const actionReadyCount = Number(Boolean(sendResult))
    + Number(Boolean(callbackResult))
    + Number(Boolean(previewSnapshot))
    + Number(Boolean(messageSnapshot))
    + Number(Boolean(bulkJobSnapshot))
    + Number(Boolean(providerSnapshot))
    + Number(Boolean(statsSnapshot))
    + Number(historyRows.length > 0)
    + Number(templateRows.length > 0);
  const emailComposerReady = sendRecipientValid && sendHasContent && canManageEmail;
  const emailActionBarTitle = sendResult
    ? 'Email request accepted'
    : (emailComposerReady ? 'Ready to send' : 'Complete send details');
  const emailActionBarDescription = sendResult
    ? sendResult
    : (emailComposerReady
      ? `Send now to ${sendRecipient}. Scheduling is ${sendScheduleAtInput ? 'available' : 'waiting for a send time'}.`
      : (!canManageEmail
        ? 'Email bulk management capability is required for send and diagnostics actions.'
        : (!sendRecipientValid
          ? 'Add a valid recipient email before sending.'
          : 'Provide a template ID or message content before sending.')));
  const visibleEmailCallbackRows = EMAIL_CALLBACK_PARITY_ROWS.filter((row) => {
    const { baseAction } = parseCallbackToken(row.callbackAction);
    if (baseAction === 'BULK_EMAIL_PRECHECK') {
      return canManageProvider;
    }
    return canManageEmail;
  });
  const selectedEmailCallbackAction = visibleEmailCallbackRows.find((row) => row.callbackAction === callbackActionInput)
    ? callbackActionInput
    : (visibleEmailCallbackRows[0]?.callbackAction || '');

  const parseVariablesPayload = (): Record<string, unknown> => {
    if (!previewVariablesInput.trim()) {
      return {};
    }
    const parsedVariables: unknown = JSON.parse(previewVariablesInput);
    if (!parsedVariables || typeof parsedVariables !== 'object' || Array.isArray(parsedVariables)) {
      throw new Error('Preview variables must be a JSON object.');
    }
    return parsedVariables as Record<string, unknown>;
  };

  const runSendNow = async (): Promise<void> => {
    if (!sendRecipientValid || !sendHasContent || !canManageEmail) return;
    setSendBusy(true);
    setActionError('');
    setSendResult('');
    try {
      const variablesPayload = parseVariablesPayload();
      const payload = await invokeAction<EmailCommandBulkSendResponse>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_SEND,
        {
          recipients: [{ email: sendRecipient }],
          provider: sendProvider || undefined,
          script_id: templateId || undefined,
          subject: sendSubject || undefined,
          html: sendHtml || undefined,
          text: sendText || undefined,
          variables: variablesPayload,
        },
      );
      const bulkJobId = toTextValue(payload?.bulk_job_id ?? payload?.job_id);
      setSendResult(
        bulkJobId
          ? `Queued email send for ${sendRecipient}. Job ID: ${bulkJobId}.`
          : `Queued email send for ${sendRecipient}.`,
      );
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setSendBusy(false);
    }
  };

  const runSendScheduled = async (): Promise<void> => {
    if (!sendRecipientValid || !sendHasContent || !sendScheduleAtInput || !canManageEmail) return;
    const sendAtMs = Date.parse(sendScheduleAtInput);
    if (Number.isNaN(sendAtMs)) {
      setActionError('Scheduled time is invalid.');
      return;
    }
    const sendAtIso = new Date(sendAtMs).toISOString();
    setSendBusy(true);
    setActionError('');
    setSendResult('');
    try {
      const variablesPayload = parseVariablesPayload();
      const payload = await invokeAction<EmailCommandBulkSendResponse>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_SEND,
        {
          recipients: [{ email: sendRecipient }],
          provider: sendProvider || undefined,
          script_id: templateId || undefined,
          subject: sendSubject || undefined,
          html: sendHtml || undefined,
          text: sendText || undefined,
          variables: variablesPayload,
          send_at: sendAtIso,
        },
      );
      const bulkJobId = toTextValue(payload?.bulk_job_id ?? payload?.job_id);
      setSendResult(
        bulkJobId
          ? `Scheduled email for ${sendRecipient} at ${sendAtIso}. Job ID: ${bulkJobId}.`
          : `Scheduled email for ${sendRecipient} at ${sendAtIso}.`,
      );
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setSendBusy(false);
    }
  };

  const runPreview = async (): Promise<void> => {
    if (!templateId || !canManageEmail) return;
    setPreviewBusy(true);
    setActionError('');
    try {
      const variablesPayload = parseVariablesPayload();
      const payload = await invokeAction<EmailCommandPreviewResponse>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_PREVIEW,
        {
          script_id: templateId,
          template_id: templateId,
          variables: variablesPayload,
        },
      );
      setPreviewSnapshot(payload || null);
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setPreviewBusy(false);
    }
  };

  const runMessageStatus = async (): Promise<void> => {
    if (!messageId || !canManageEmail) return;
    setStatusBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<EmailCommandMessageStatusResponse>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS,
        { message_id: messageId },
      );
      const messageRecord = asRecord(payload?.message);
      setMessageSnapshot(Object.keys(messageRecord).length > 0 ? messageRecord : asRecord(payload));
      setMessageEvents(toEventRows(payload?.events));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setStatusBusy(false);
    }
  };

  const runBulkHistory = async (offset = 0): Promise<void> => {
    if (!canManageEmail) return;
    setHistoryBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<EmailCommandBulkHistoryResponse>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
        { limit: 12, offset },
      );
      setHistoryRows(toEmailHistoryRows(payload?.jobs));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setHistoryBusy(false);
    }
  };

  const runBulkJobStatus = async (): Promise<void> => {
    if (!jobId || !canManageEmail) return;
    setJobBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<EmailCommandBulkJobResponse>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB,
        { job_id: jobId },
      );
      const jobRecord = asRecord(payload?.job);
      setBulkJobSnapshot(Object.keys(jobRecord).length > 0 ? jobRecord : asRecord(payload));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setJobBusy(false);
    }
  };

  const runBulkStats = async (): Promise<void> => {
    if (!canManageEmail) return;
    setStatsBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<Record<string, unknown>>(
        DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_STATS,
        { hours: 24 },
      );
      setStatsSnapshot(asRecord(payload));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setStatsBusy(false);
    }
  };

  const runBulkPrecheck = async (): Promise<void> => {
    if (!canManageProvider) return;
    setPrecheckBusy(true);
    setActionError('');
    try {
      const payload = await invokeAction<EmailCommandProviderStatusResponse>(
        DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
        { channel: 'email' },
      );
      setProviderSnapshot(createEmailProviderSnapshot(payload));
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
    } finally {
      setPrecheckBusy(false);
    }
  };

  const executeCallbackAction = async (rawCallbackActionInput: string): Promise<void> => {
    if ((!canManageEmail && !canManageProvider) || activeBusy) return;
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
    let callbackHistoryBusy = false;
    let callbackTemplatesBusy = false;
    let callbackJobBusy = false;
    let callbackStatsBusy = false;
    let callbackPrecheckBusy = false;
    try {
      setActionError('');
      setCallbackResult('');
      let callbackSummary = `${actionLabel} completed.`;
      if (baseAction === 'BULK_EMAIL_PRECHECK') {
        if (!canManageProvider) {
          setActionError('Provider precheck requires provider management capability.');
          return;
        }
        callbackPrecheckBusy = true;
        setPrecheckBusy(true);
        const payload = await invokeAction<EmailCommandProviderStatusResponse>(
          rawCallbackAction,
          { channel: 'email' },
        );
        const nextSnapshot = createEmailProviderSnapshot(payload);
        setProviderSnapshot(nextSnapshot);
        callbackSummary = `Loaded email provider readiness for ${toText(nextSnapshot?.provider, 'unknown')}.`;
      } else if (baseAction === 'EMAIL_SEND' || baseAction === 'BULK_EMAIL_SEND') {
        if (!canManageEmail) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires email bulk management capability.`);
          return;
        }
        if (!sendRecipientValid || !sendHasContent) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires a valid recipient and template/content fields. Fill the email composer first.`);
          return;
        }
        const variablesPayload = parseVariablesPayload();
        await invokeAction(rawCallbackAction, {
          recipients: [{ email: sendRecipient }],
          provider: sendProvider || undefined,
          script_id: templateId || undefined,
          subject: sendSubject || undefined,
          html: sendHtml || undefined,
          text: sendText || undefined,
          variables: variablesPayload,
        });
        callbackSummary = 'Email payload queued with the current compose fields.';
      } else if (baseAction === 'EMAIL_STATUS' || baseAction === 'EMAIL_TIMELINE') {
        if (!canManageEmail) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires email bulk management capability.`);
          return;
        }
        const resolvedMessageId = suffix || messageId;
        if (!resolvedMessageId) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires a message ID. Fill the status field first.`);
          return;
        }
        callbackStatusBusy = true;
        setStatusBusy(true);
        const payload = await invokeAction<EmailCommandMessageStatusResponse>(
          rawCallbackAction,
          { message_id: resolvedMessageId },
        );
        const messageRecord = asRecord(payload?.message);
        setMessageSnapshot(Object.keys(messageRecord).length > 0 ? messageRecord : asRecord(payload));
        const events = toEventRows(payload?.events);
        setMessageEvents(events);
        callbackSummary = baseAction === 'EMAIL_TIMELINE'
          ? `Loaded ${events.length} timeline event(s).`
          : `Loaded delivery status for ${resolvedMessageId}.`;
      } else if (baseAction === 'EMAIL_HISTORY') {
        if (!canManageEmail) {
          setActionError('Load History requires email bulk management capability.');
          return;
        }
        callbackHistoryBusy = true;
        setHistoryBusy(true);
        const payload = await invokeAction<EmailCommandBulkHistoryResponse>(
          rawCallbackAction,
          { limit: 12, offset: 0 },
        );
        const jobs = toEmailHistoryRows(payload?.jobs);
        setHistoryRows(jobs);
        callbackSummary = `Loaded ${jobs.length} job(s).`;
      } else if (baseAction === 'BULK_EMAIL_LIST' || baseAction === 'BULK_EMAIL_PAGE') {
        if (!canManageEmail) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires email bulk management capability.`);
          return;
        }
        callbackHistoryBusy = true;
        setHistoryBusy(true);
        const page = baseAction === 'BULK_EMAIL_PAGE' ? Math.max(1, toInt(suffix, 1)) : 1;
        const limit = 12;
        const offset = (page - 1) * limit;
        const payload = await invokeAction<EmailCommandBulkHistoryResponse>(
          rawCallbackAction,
          { limit, offset },
        );
        const jobs = toEmailHistoryRows(payload?.jobs);
        setHistoryRows(jobs);
        callbackSummary = `Loaded ${jobs.length} job(s) from page ${page}.`;
      } else if (baseAction === 'EMAIL_TEMPLATES') {
        if (!canManageEmail) {
          setActionError('Load Templates requires email bulk management capability.');
          return;
        }
        callbackTemplatesBusy = true;
        setTemplatesBusy(true);
        const payload = await invokeAction<EmailCommandTemplateListResponse>(
          rawCallbackAction,
          { limit: 12, offset: 0 },
        );
        const templates = toEmailTemplateRows(payload?.templates);
        setTemplateRows(templates);
        callbackSummary = `Loaded ${templates.length} template(s).`;
      } else if (baseAction === 'EMAIL_BULK' || baseAction === 'BULK_EMAIL_STATUS') {
        if (!canManageEmail) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires email bulk management capability.`);
          return;
        }
        const resolvedJobId = suffix || jobId;
        if (!resolvedJobId) {
          setActionError(`${resolveCallbackActionLabel(baseAction)} requires a bulk job ID. Fill the bulk job field first.`);
          return;
        }
        callbackJobBusy = true;
        setJobBusy(true);
        const payload = await invokeAction<EmailCommandBulkJobResponse>(rawCallbackAction, { job_id: resolvedJobId });
        const jobRecord = asRecord(payload?.job);
        const resolvedJob = Object.keys(jobRecord).length > 0 ? jobRecord : asRecord(payload);
        setBulkJobSnapshot(resolvedJob);
        callbackSummary = `Loaded bulk job ${toText(resolvedJob.job_id, resolvedJobId)}.`;
      } else if (baseAction === 'BULK_EMAIL_STATS') {
        if (!canManageEmail) {
          setActionError('Load Bulk Email Stats requires email bulk management capability.');
          return;
        }
        callbackStatsBusy = true;
        setStatsBusy(true);
        const payload = await invokeAction<Record<string, unknown>>(rawCallbackAction, { hours: 24 });
        setStatsSnapshot(asRecord(payload));
        callbackSummary = 'Loaded bulk email stats snapshot.';
      } else {
        await invokeAction(rawCallbackAction, {});
      }
      setCallbackResult(callbackSummary);
    } catch (nextError) {
      setActionError(toErrorMessage(nextError));
      setCallbackResult('');
    } finally {
      if (callbackStatusBusy) setStatusBusy(false);
      if (callbackHistoryBusy) setHistoryBusy(false);
      if (callbackTemplatesBusy) setTemplatesBusy(false);
      if (callbackJobBusy) setJobBusy(false);
      if (callbackStatsBusy) setStatsBusy(false);
      if (callbackPrecheckBusy) setPrecheckBusy(false);
    }
  };

  const runCallbackAction = async (): Promise<void> => {
    if (!selectedEmailCallbackAction) {
      setActionError('Select an advanced action first.');
      return;
    }
    await executeCallbackAction(selectedEmailCallbackAction);
  };

  const runGuidedEmailMenuAction = async (rawCallbackAction: string): Promise<void> => {
    setCallbackActionInput(rawCallbackAction);
    await executeCallbackAction(rawCallbackAction);
  };

  const openGuidedEmailRoute = (path: string): void => {
    setActionError('');
    setCallbackResult('');
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
            subtitle={error ? `Session needs attention. ${error}` : 'Email workspace is ready.'}
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
            footer="Email execution is restricted to authorized users. The Mini App enforces the same rule."
          >
            <UiStatePanel
              title="Authorized access required"
              description="Request access from an admin or use Help Center, Usage Guide, or Quick Actions to review available workflows."
              tone="warning"
            />
          </Section>
        ) : (
          <Section
            header="Email workspace"
            footer="This page executes send, preview, status, template, and history actions through the existing backend contracts."
          >
            <div className="va-grid">
              <UiCard>
                <p className="va-card-eyebrow">Workspace overview</p>
                <div className={`va-overview-metrics ${actionReadyCount > 0 || sendResult ? 'is-healthy' : 'is-degraded'}`}>
                  <UiMetricTile label="Composer" value={emailComposerReady ? 'Ready' : 'Needs input'} />
                  <UiMetricTile label="Preview" value={previewSnapshot ? 'Loaded' : 'Idle'} />
                  <UiMetricTile label="Diagnostics" value={actionReadyCount > 0 ? `${actionReadyCount} loaded` : 'Idle'} />
                </div>
                <Text>
                  Work from one focused email workspace for sends, previews, status checks, and bulk delivery visibility.
                </Text>
                <div className="va-inline-tools">
                  <UiButton
                    variant="primary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedEmailMenuAction('EMAIL_SEND');
                    }}
                  >
                    Send Email
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedEmailMenuAction('EMAIL_STATUS');
                    }}
                  >
                    Delivery Status
                  </UiButton>
                </div>
                <div className="va-inline-tools">
                  <UiButton
                    variant="secondary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedEmailMenuAction('EMAIL_TEMPLATES');
                    }}
                  >
                    Templates
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canOperate || activeBusy}
                    onClick={() => {
                      void runGuidedEmailMenuAction('EMAIL_HISTORY');
                    }}
                  >
                    History
                  </UiButton>
                </div>
                <div className="va-inline-tools">
                  <UiButton
                    variant="secondary"
                    disabled={activeBusy}
                    onClick={() => {
                      openGuidedEmailRoute(bulkEmailRoute);
                    }}
                  >
                    Open Mailer
                  </UiButton>
                  <UiButton
                    variant="plain"
                    disabled={activeBusy}
                    onClick={() => {
                      openGuidedEmailRoute(MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU);
                    }}
                  >
                    All Workflows
                  </UiButton>
                </div>
                <UiStatePanel
                  compact
                  title="Authorized access controls execution"
                  description="Email actions only run for authorized users. This page keeps the same gate before any send, preview, or diagnostics workflow runs."
                  tone="info"
                />
                <UiStatePanel
                  compact
                  title={canManageProvider ? 'Provider checks are available' : 'Provider checks stay gated'}
                  description={canManageProvider
                    ? 'Provider readiness checks can run here without leaving the current workspace.'
                    : 'Provider readiness checks unlock when provider management access is available.'}
                  tone="info"
                />
                <UiDisclosure
                  title="Operational notes"
                  subtitle="Execution scope, preview support, and bulk handoff"
                >
                  <ul className="va-list va-list-dense">
                    <li>Single-recipient send and schedule use the same backend email action family as the wider admin console.</li>
                    <li>Template preview uses the current template ID and merge-field JSON from the compose form below.</li>
                    <li>Bulk Mailer remains the handoff for dedicated bulk operations, while this page stays optimized for focused sends and inspection.</li>
                  </ul>
                </UiDisclosure>
              </UiCard>

              <UiCard>
                <p className="va-card-eyebrow">Single-recipient send</p>
                <UiInput
                  aria-label="Recipient email"
                  placeholder="recipient@example.com"
                  value={sendRecipientInput}
                  onChange={(event) => setSendRecipientInput(event.target.value)}
                />
                <UiInput
                  aria-label="Email provider override"
                  placeholder="Provider (optional)"
                  value={sendProviderInput}
                  onChange={(event) => setSendProviderInput(event.target.value)}
                />
                <UiInput
                  aria-label="Template ID"
                  placeholder="Template / Script ID (optional)"
                  value={templateIdInput}
                  onChange={(event) => setTemplateIdInput(event.target.value)}
                />
                <UiInput
                  aria-label="Email subject"
                  placeholder="Subject (optional when template ID is set)"
                  value={sendSubjectInput}
                  onChange={(event) => setSendSubjectInput(event.target.value)}
                />
                <UiTextarea
                  aria-label="Email HTML body"
                  placeholder="HTML body (optional)"
                  rows={4}
                  value={sendHtmlInput}
                  onChange={(event) => setSendHtmlInput(event.target.value)}
                />
                <UiTextarea
                  aria-label="Email text body"
                  placeholder="Text body (optional)"
                  rows={3}
                  value={sendTextInput}
                  onChange={(event) => setSendTextInput(event.target.value)}
                />
                <UiTextarea
                  aria-label="Template variables JSON"
                  placeholder='{"first_name":"Alex"}'
                  rows={4}
                  value={previewVariablesInput}
                  onChange={(event) => setPreviewVariablesInput(event.target.value)}
                />
                <UiInput
                  aria-label="Schedule email at"
                  type="datetime-local"
                  value={sendScheduleAtInput}
                  onChange={(event) => setSendScheduleAtInput(event.target.value)}
                />
                {!sendRecipientValid && sendRecipientInput.trim() ? (
                  <UiStatePanel
                    compact
                    title="Recipient email format required"
                    description="Use a valid recipient email address before sending."
                    tone="warning"
                  />
                ) : null}
                {!sendHasContent ? (
                  <UiStatePanel
                    compact
                    title="Content required"
                    description="Provide a template ID or subject/body content before sending."
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
                {!canManageEmail ? (
                  <UiStatePanel
                    compact
                    title="Email actions unavailable"
                    description="Your account needs email bulk management capability to run these execution actions in the Mini App."
                    tone="warning"
                  />
                ) : null}

                <UiActionBar
                  title={emailActionBarTitle}
                  description={emailActionBarDescription}
                  actions={(
                    <>
                      <UiButton
                        variant="primary"
                        disabled={!sendRecipientValid || !sendHasContent || !canManageEmail || activeBusy}
                        onClick={() => {
                          void runSendNow();
                        }}
                      >
                        {sendBusy ? 'Submitting...' : 'Send Now'}
                      </UiButton>
                      <UiButton
                        variant="secondary"
                        disabled={!sendRecipientValid || !sendHasContent || !sendScheduleAtInput || !canManageEmail || activeBusy}
                        onClick={() => {
                          void runSendScheduled();
                        }}
                      >
                        {sendBusy ? 'Submitting...' : 'Schedule'}
                      </UiButton>
                    </>
                  )}
                />

                <UiDisclosure
                  title="Advanced workflow actions"
                  subtitle="Run mapped actions against the current compose inputs"
                >
                  <UiSelect
                    aria-label="Email advanced action"
                    value={selectedEmailCallbackAction}
                    onChange={(event) => setCallbackActionInput(event.target.value)}
                  >
                    {visibleEmailCallbackRows.map((row) => (
                      <option key={row.callbackAction} value={row.callbackAction}>
                        {row.label}
                      </option>
                    ))}
                  </UiSelect>
                  <div className="va-inline-tools">
                    <UiButton
                      variant="secondary"
                      disabled={!selectedEmailCallbackAction || (!canManageEmail && !canManageProvider) || activeBusy}
                      onClick={() => {
                        void runCallbackAction();
                      }}
                    >
                      Run Selected Action
                    </UiButton>
                  </div>
                  <ul className="va-list va-list-dense">
                    {visibleEmailCallbackRows.map((row) => (
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
                  title="Template preview"
                  subtitle="Render the current template and merge fields before sending"
                >
                  <div className="va-inline-tools">
                    <UiButton
                      variant="primary"
                      disabled={!templateId || !canManageEmail || activeBusy}
                      onClick={() => {
                        void runPreview();
                      }}
                    >
                      {previewBusy ? 'Previewing...' : 'Preview Template'}
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={activeBusy}
                      onClick={() => {
                        setSendResult('');
                        setCallbackResult('');
                        setPreviewSnapshot(null);
                        setTemplateRows([]);
                      }}
                    >
                      Clear Preview
                    </UiButton>
                  </div>
                  {previewSnapshot?.success === false && previewMissing.length > 0 ? (
                    <UiStatePanel
                      compact
                      title="Missing template variables"
                      description={previewMissing.join(', ')}
                      tone="warning"
                    />
                  ) : null}
                  {previewSnapshot?.success ? (
                    <>
                      <ul className="va-list va-list-dense">
                        <li>Subject: {previewSubject || '(empty subject)'}</li>
                        <li>HTML length: {previewHtml.length}</li>
                        <li>Text length: {previewText.length}</li>
                      </ul>
                      {previewText ? (
                        <UiStatePanel
                          compact
                          title="Rendered text preview"
                          description={previewText}
                          tone="success"
                        />
                      ) : null}
                    </>
                  ) : (
                    <UiStatePanel
                      compact
                      title="No preview loaded"
                      description="Set a template ID and merge fields, then preview the rendered email before sending."
                      tone="info"
                    />
                  )}
                </UiDisclosure>
              </UiCard>

              <UiCard>
                <p className="va-card-eyebrow">Diagnostics and history</p>
                <div className="va-inline-metrics">
                  <UiBadge>{messageSnapshot ? 'Status loaded' : 'Status idle'}</UiBadge>
                  <UiBadge>{providerSnapshot ? 'Provider loaded' : 'Provider idle'}</UiBadge>
                  <UiBadge>{historyRows.length > 0 ? `History ${historyRows.length}` : 'History idle'}</UiBadge>
                  <UiBadge>{templateRows.length > 0 ? `Templates ${templateRows.length}` : 'Templates idle'}</UiBadge>
                </div>
                <div className="va-inline-tools">
                  <UiInput
                    aria-label="Email message ID"
                    placeholder="Message ID"
                    value={messageIdInput}
                    onChange={(event) => setMessageIdInput(event.target.value)}
                  />
                  <UiButton
                    variant="secondary"
                    disabled={!messageId || !canManageEmail || activeBusy}
                    onClick={() => {
                      void runMessageStatus();
                    }}
                  >
                    {statusBusy ? 'Loading...' : 'Check Status'}
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canManageEmail || activeBusy}
                    onClick={() => {
                      void runBulkHistory();
                    }}
                  >
                    {historyBusy ? 'Loading...' : 'Load History'}
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canManageEmail || activeBusy}
                    onClick={() => {
                      void runGuidedEmailMenuAction('EMAIL_TEMPLATES');
                    }}
                  >
                    {templatesBusy ? 'Loading...' : 'Load Templates'}
                  </UiButton>
                </div>
                <div className="va-inline-tools">
                  <UiInput
                    aria-label="Email bulk job ID"
                    placeholder="Bulk job ID"
                    value={jobIdInput}
                    onChange={(event) => setJobIdInput(event.target.value)}
                  />
                  <UiButton
                    variant="secondary"
                    disabled={!jobId || !canManageEmail || activeBusy}
                    onClick={() => {
                      void runBulkJobStatus();
                    }}
                  >
                    {jobBusy ? 'Loading...' : 'Load Job'}
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canManageProvider || activeBusy}
                    onClick={() => {
                      void runBulkPrecheck();
                    }}
                  >
                    {precheckBusy ? 'Loading...' : 'Run Precheck'}
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={!canManageEmail || activeBusy}
                    onClick={() => {
                      void runBulkStats();
                    }}
                  >
                    {statsBusy ? 'Loading...' : 'Load Stats'}
                  </UiButton>
                  <UiButton
                    variant="plain"
                    disabled={activeBusy}
                    onClick={() => {
                      setMessageSnapshot(null);
                      setMessageEvents([]);
                      setHistoryRows([]);
                      setTemplateRows([]);
                      setBulkJobSnapshot(null);
                      setProviderSnapshot(null);
                      setStatsSnapshot(null);
                      setActionError('');
                    }}
                  >
                    Clear Diagnostics
                  </UiButton>
                </div>

                {!messageSnapshot && !bulkJobSnapshot && historyRows.length === 0 && templateRows.length === 0 && !statsSnapshot ? (
                  <UiStatePanel
                    compact
                    title="No email diagnostics loaded"
                    description="Run status/timeline, bulk job, templates, history, or stats actions to populate diagnostics."
                    tone="info"
                  />
                ) : null}

                {messageSnapshot ? (
                  <UiDisclosure
                    title="Message status"
                    subtitle={messageStatus || 'Delivery state snapshot'}
                    open
                  >
                    <ul className="va-list va-list-dense">
                      <li>Status: {messageStatus || 'unknown'}</li>
                      <li>Provider: {messageProvider || 'unknown'}</li>
                      <li>To: {messageTo || 'n/a'}</li>
                      <li>Script: {messageScriptId || 'n/a'}</li>
                      <li>Created: {messageCreatedAt || 'n/a'}</li>
                      <li>Events: {messageEvents.length}</li>
                    </ul>
                    {messageEvents.length > 0 ? (
                      <UiStatePanel
                        compact
                        title="Recent message event"
                        description={toJsonText(messageEvents[0])}
                        tone="info"
                      />
                    ) : null}
                  </UiDisclosure>
                ) : null}

                {bulkJobSnapshot ? (
                  <UiDisclosure
                    title="Bulk job snapshot"
                    subtitle={toText(bulkJobSnapshot.status, 'unknown')}
                    open
                  >
                    <ul className="va-list va-list-dense">
                      <li>Job ID: {toText(bulkJobSnapshot.job_id, toText(bulkJobSnapshot.id, 'n/a'))}</li>
                      <li>Status: {toText(bulkJobSnapshot.status, 'unknown')}</li>
                      <li>Provider: {toText(bulkJobSnapshot.provider, 'unknown')}</li>
                      <li>Recipients: {toInt(bulkJobSnapshot.recipient_count, 0)}</li>
                      <li>Sent: {toInt(bulkJobSnapshot.sent_count, 0)}</li>
                      <li>Failed: {toInt(bulkJobSnapshot.failed_count, 0)}</li>
                    </ul>
                  </UiDisclosure>
                ) : null}

                {providerSnapshot ? (
                  <UiDisclosure
                    title="Provider readiness"
                    subtitle={providerSnapshot.ready === true ? 'Ready for email delivery' : 'Configuration needs attention'}
                  >
                    <ul className="va-list va-list-dense">
                      <li>Channel: {toText(providerSnapshot.channel, 'email')}</li>
                      <li>Provider: {toText(providerSnapshot.provider, 'unknown')}</li>
                      <li>Readiness: {providerSnapshot.ready === true ? 'Ready' : 'Check configuration'}</li>
                      <li>Supported providers: {toTextList(providerSnapshot.supported_providers).join(', ') || 'n/a'}</li>
                    </ul>
                    {Object.keys(asRecord(providerSnapshot.readiness)).length > 0 ? (
                      <UiStatePanel
                        compact
                        title="Readiness map"
                        description={toJsonText(providerSnapshot.readiness)}
                        tone={providerSnapshot.ready === true ? 'success' : 'warning'}
                      />
                    ) : null}
                  </UiDisclosure>
                ) : null}

                {historyRows.length > 0 ? (
                  <UiDisclosure
                    title="Recent bulk jobs"
                    subtitle={`${historyRows.length} job${historyRows.length === 1 ? '' : 's'} loaded`}
                  >
                    <ul className="va-list va-list-dense">
                      {historyRows.slice(0, 6).map((job) => (
                        <li key={toTextValue(job.job_id, summarizeEmailJob(job))}>
                          {summarizeEmailJob(job)}
                        </li>
                      ))}
                    </ul>
                  </UiDisclosure>
                ) : null}

                {statsSnapshot ? (
                  <UiDisclosure
                    title="Bulk stats"
                    subtitle="24-hour delivery snapshot"
                  >
                    <ul className="va-list va-list-dense">
                      <li>{summarizeEmailBulkStats(statsSnapshot)}</li>
                    </ul>
                  </UiDisclosure>
                ) : null}

                {templateRows.length > 0 ? (
                  <UiDisclosure
                    title="Template catalog"
                    subtitle={`${templateRows.length} template${templateRows.length === 1 ? '' : 's'} loaded`}
                  >
                    <ul className="va-list va-list-dense">
                      {templateRows.slice(0, 6).map((template) => (
                        <li key={toTextValue(template.template_id, toTextValue(template.id, summarizeEmailTemplate(template)))}>
                          {summarizeEmailTemplate(template)}
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
              title="Email action failed"
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
          footer="These shortcuts keep the email page connected to the rest of the available Mini App workflows."
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

export const EmailCommandPage: FC = () => <EmailCommandPageContent />;

export default EmailCommandPage;
