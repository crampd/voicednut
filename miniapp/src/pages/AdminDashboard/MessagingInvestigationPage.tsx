import { useState } from 'react';

import { buildModuleRequestState } from './moduleRequestState';
import type { DashboardVm } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectSmsPageVm } from './vmSelectors';
import { DashboardWorkflowContractCard } from '@/components/admin-dashboard/DashboardWorkflowContractCard';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiInput,
  UiStatePanel,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';

type MessagingInvestigationPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asDisplayText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function pickDisplayText(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const next = asDisplayText(value);
    if (next) return next;
  }
  return fallback;
}

export function MessagingInvestigationPage({ visible, vm }: MessagingInvestigationPageProps) {
  if (!visible) return null;

  const { invokeAction, busyAction, hasCapability } = selectSmsPageVm(vm);

  const [statusSidInput, setStatusSidInput] = useState<string>('');
  const [conversationPhoneInput, setConversationPhoneInput] = useState<string>('');
  const [statusSnapshot, setStatusSnapshot] = useState<Record<string, unknown> | null>(null);
  const [recentMessages, setRecentMessages] = useState<Array<Record<string, unknown>>>([]);
  const [conversationMessages, setConversationMessages] = useState<Array<Record<string, unknown>>>([]);
  const [smsStatsSnapshot, setSmsStatsSnapshot] = useState<Record<string, unknown> | null>(null);

  const [messageIdInput, setMessageIdInput] = useState<string>('');
  const [jobIdInput, setJobIdInput] = useState<string>('');
  const [messageSnapshot, setMessageSnapshot] = useState<Record<string, unknown> | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<Record<string, unknown> | null>(null);
  const [historySnapshot, setHistorySnapshot] = useState<Array<Record<string, unknown>>>([]);
  const [emailStatsSnapshot, setEmailStatsSnapshot] = useState<Record<string, unknown> | null>(null);
  const {
    investigationBusy,
    investigationError,
    runInvestigationAction,
  } = useInvestigationAction(invokeAction);
  const requestState = buildModuleRequestState({
    busyAction,
    secondaryBusyAction: investigationBusy,
  });
  const controlsBusy = requestState.isBusy;
  const activeActionLabel = requestState.activeActionLabel;
  const statusSid = statusSidInput.trim();
  const conversationPhone = conversationPhoneInput.trim();
  const messageId = messageIdInput.trim();
  const jobId = jobIdInput.trim();
  const hasSmsInvestigationData = Boolean(
    statusSnapshot
    || smsStatsSnapshot
    || recentMessages.length > 0
    || conversationMessages.length > 0,
  );
  const hasEmailInvestigationData = Boolean(
    messageSnapshot
    || jobSnapshot
    || emailStatsSnapshot
    || historySnapshot.length > 0,
  );
  const smsArtifactsCount = Number(statusSnapshot ? 1 : 0)
    + Number(smsStatsSnapshot ? 1 : 0)
    + (recentMessages.length > 0 ? 1 : 0)
    + (conversationMessages.length > 0 ? 1 : 0);
  const emailArtifactsCount = Number(messageSnapshot ? 1 : 0)
    + Number(jobSnapshot ? 1 : 0)
    + Number(emailStatsSnapshot ? 1 : 0)
    + (historySnapshot.length > 0 ? 1 : 0);
  const activeFilterCount = [statusSid, conversationPhone, messageId, jobId]
    .filter((value) => value.length > 0).length;
  const canCheckSmsStatus = hasCapability('sms_bulk_manage');
  const canRunSmsDiagnostics = hasCapability('users_manage');
  const canManageEmail = hasCapability('email_bulk_manage');
  const hasAnyInvestigationData = hasSmsInvestigationData || hasEmailInvestigationData;
  const pulseTone: 'info' | 'success' | 'warning' | 'error' = investigationError
    ? 'error'
    : controlsBusy
      ? 'info'
      : !hasAnyInvestigationData || !canCheckSmsStatus || !canManageEmail
        ? 'warning'
        : 'success';
  const pulseStatus = investigationError
    ? 'Needs attention'
    : controlsBusy
      ? 'Working'
      : !hasAnyInvestigationData || !canCheckSmsStatus || !canManageEmail
        ? 'Needs input'
        : 'Ready';
  const pulseDescription = investigationError
    ? investigationError
    : controlsBusy
      ? activeActionLabel ? `${activeActionLabel} is in progress.` : 'Messaging diagnostics are in progress.'
      : !canCheckSmsStatus && !canManageEmail
        ? 'SMS and email diagnostics are unavailable for this account.'
        : !canRunSmsDiagnostics
          ? 'SMS status checks are available. Conversation, recent history, and stats require admin access.'
        : !hasAnyInvestigationData
          ? 'Choose an SMS or email lookup to load the first diagnostic artifact.'
          : 'SMS and email snapshots stay available together for cross-channel investigation.';

  const runSmsStatusLookup = (): void => {
    if (!statusSid) return;
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGE_STATUS, { message_sid: statusSid }, (payload) => {
      setStatusSnapshot(asRecord(payload.message) || payload);
    });
  };

  const runSmsConversationLookup = (): void => {
    if (!conversationPhone) return;
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_CONVERSATION, { phone: conversationPhone, limit: 20 }, (payload) => {
      setConversationMessages(Array.isArray(payload.messages) ? payload.messages.map(asRecord) : []);
    });
  };

  const runSmsRecentLookup = (): void => {
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_RECENT, { limit: 12, offset: 0 }, (payload) => {
      setRecentMessages(Array.isArray(payload.messages) ? payload.messages.map(asRecord) : []);
    });
  };

  const runSmsStatsLookup = (): void => {
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.SMS_STATS, { hours: 24 }, (payload) => setSmsStatsSnapshot(payload));
  };

  const runEmailMessageLookup = (): void => {
    if (!messageId) return;
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS, { message_id: messageId }, (payload) => {
      setMessageSnapshot(asRecord(payload.message) || payload);
    });
  };

  const runEmailJobLookup = (): void => {
    if (!jobId) return;
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB, { job_id: jobId }, (payload) => setJobSnapshot(payload));
  };

  const runEmailHistoryLookup = (): void => {
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY, { limit: 12, offset: 0 }, (payload) => {
      setHistorySnapshot(Array.isArray(payload.jobs) ? payload.jobs.map(asRecord) : []);
    });
  };

  const runEmailStatsLookup = (): void => {
    void runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_STATS, { hours: 24 }, (payload) => {
      setEmailStatsSnapshot(asRecord(payload.stats) || payload);
    });
  };

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Messaging</p>
        <h2 className="va-page-title">Messaging Investigation</h2>
        <p className="va-muted">
          Unified delivery investigation for the bot-backed SMS and email workflows, including status,
          conversations, recent activity, job history, and channel health snapshots.
        </p>
        <div className="va-page-intro-meta">
          <UiBadge variant={pulseTone}>{pulseStatus}</UiBadge>
          <UiBadge variant="meta">Cross-channel delivery</UiBadge>
          <UiBadge variant="info">{activeFilterCount} active filters</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Use one operational surface to inspect SMS delivery, email jobs, recent artifacts, and
          message history before escalating to the broader admin workflow.
        </p>
      </section>

      <UiWorkspacePulse
        title="Delivery investigation"
        description={pulseDescription}
        status={pulseStatus}
        tone={pulseTone}
        items={[
          { label: 'SMS artifacts', value: smsArtifactsCount },
          { label: 'Email artifacts', value: emailArtifactsCount },
          { label: 'Active filters', value: activeFilterCount },
          { label: 'Channel access', value: `${canCheckSmsStatus ? 'SMS status' : 'No SMS'} / ${canManageEmail ? 'Email' : 'No email'}` },
        ]}
      />

      <DashboardWorkflowContractCard moduleId="messaging" />

      {investigationError || requestState.isBusy ? (
        <div className="va-status-state-stack">
          {investigationError ? (
            <UiSurfaceState
              eyebrow="Investigation state"
              status="Needs attention"
              statusVariant="error"
              title="Messaging investigation needs attention"
              description={investigationError}
              tone="error"
              compact
            />
          ) : null}
          {requestState.isBusy ? (
            <UiSurfaceState
              eyebrow="Investigation state"
              status="In progress"
              statusVariant="info"
              title="Messaging request is running"
              description={`Running ${activeActionLabel || 'request'}...`}
              tone="info"
              compact
            />
          ) : null}
        </div>
      ) : null}

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">SMS Diagnostics</h3>
          <p className="va-muted">Investigate delivery status, phone conversation history, and delivery stats.</p>
        </header>
        <section className="va-grid">
          <UiCard className="va-investigation-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>SMS Investigation</h3>
              <p className="va-muted">Inspect delivery state, phone-level conversation history, and recent SMS health.</p>
            </div>
            <UiBadge variant={hasSmsInvestigationData ? 'success' : 'info'}>
              {hasSmsInvestigationData ? `${smsArtifactsCount} loaded` : 'Lookup ready'}
            </UiBadge>
          </div>
          {!canCheckSmsStatus ? (
            <UiStatePanel
              compact
              title="SMS diagnostics unavailable"
              description="Your account needs SMS bulk management capability to run SMS status checks."
              tone="warning"
            />
          ) : null}
          {canCheckSmsStatus && !canRunSmsDiagnostics ? (
            <UiStatePanel
              compact
              title="Admin diagnostics are locked"
              description="Conversation history, recent messages, and stats are available to admins."
              tone="info"
            />
          ) : null}
          {!hasSmsInvestigationData ? (
            <UiStatePanel
              compact
              title="No SMS diagnostics loaded"
              description="Run status, conversation, recent, or stats queries to populate this workspace."
              tone="info"
            />
          ) : null}
          <UiActionBar
            title="Load SMS diagnostics"
            description="Check a single message, inspect a phone conversation, or pull recent and stats snapshots."
            actions={(
              <>
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !canRunSmsDiagnostics}
                  onClick={runSmsRecentLookup}
                >
                  Recent
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !canRunSmsDiagnostics}
                  onClick={runSmsStatsLookup}
                >
                  Stats
                </UiButton>
              </>
            )}
          />
          <div className="va-inline-tools">
            <UiInput
              placeholder="Message SID"
              value={statusSidInput}
              onChange={(event) => setStatusSidInput(event.target.value)}
            />
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !statusSid || !canCheckSmsStatus}
              onClick={runSmsStatusLookup}
            >
              Check Status
            </UiButton>
          </div>
          <div className="va-inline-tools">
            <UiInput
              placeholder="Phone for conversation (+1555...)"
              value={conversationPhoneInput}
              onChange={(event) => setConversationPhoneInput(event.target.value)}
            />
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !conversationPhone || !canRunSmsDiagnostics}
              onClick={runSmsConversationLookup}
            >
              Load Conversation
            </UiButton>
          </div>
          <UiDisclosure
            title="SMS artifacts"
            subtitle={
              hasSmsInvestigationData
                ? `${smsArtifactsCount} diagnostic artifact${smsArtifactsCount === 1 ? '' : 's'} loaded`
                : 'Snapshots, conversation history, and stats'
            }
            open={hasSmsInvestigationData}
          >
            <div className="va-subcard-grid va-subcard-grid-two">
              <UiCard tone="subcard">
                <h4>Status Snapshot</h4>
                {statusSnapshot ? (
                  <ul className="va-native-list">
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Message SID</strong>
                        <span className="va-native-list-value">{pickDisplayText([statusSnapshot.message_sid, statusSidInput], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Status</strong>
                        <span className="va-native-list-value">{pickDisplayText([statusSnapshot.status], 'unknown')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>To</strong>
                        <span className="va-native-list-value">{pickDisplayText([statusSnapshot.to_number], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>From</strong>
                        <span className="va-native-list-value">{pickDisplayText([statusSnapshot.from_number], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Provider</strong>
                        <span className="va-native-list-value">{pickDisplayText([statusSnapshot.provider], 'n/a')}</span>
                      </div>
                    </li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No status snapshot"
                    description="Run a SID lookup to load status details."
                  />
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>Recent Messages</h4>
                {recentMessages.length === 0 ? (
                  <UiStatePanel
                    compact
                    title="No recent messages loaded"
                    description="Run a recent-message query to populate this list."
                  />
                ) : (
                  <ul className="va-native-list">
                    {recentMessages.slice(0, 10).map((message, index) => (
                      <li key={`msg-investigation-recent-${index}`} className="va-native-list-row">
                        <div className="va-native-list-head">
                          <strong>{pickDisplayText([message.message_sid], `message-${index + 1}`)}</strong>
                          <span className="va-native-list-value">{pickDisplayText([message.status], 'unknown')}</span>
                        </div>
                        <div className="va-native-list-meta">
                          <span>{pickDisplayText([message.to_number, message.from_number], 'n/a')}</span>
                          <span>{pickDisplayText([message.provider], 'provider:n/a')}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </UiCard>
            </div>
            <div className="va-subcard-grid va-subcard-grid-two">
              <UiCard tone="subcard">
                <h4>Conversation</h4>
                {conversationMessages.length === 0 ? (
                  <UiStatePanel
                    compact
                    title="No conversation loaded"
                    description="Load a phone number to inspect conversation history."
                  />
                ) : (
                  <ul className="va-native-list">
                    {conversationMessages.slice(0, 12).map((message, index) => (
                      <li key={`msg-investigation-convo-${index}`} className="va-native-list-row">
                        <div className="va-native-list-head">
                          <strong>{pickDisplayText([message.direction], 'unknown')}</strong>
                          <span className="va-native-list-value">{pickDisplayText([message.status], 'unknown')}</span>
                        </div>
                        <div className="va-native-list-meta">
                          <span>{pickDisplayText([message.body], '').slice(0, 120) || 'No body'}</span>
                          <span>{pickDisplayText([message.message_sid], `message-${index + 1}`)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>SMS Stats Snapshot</h4>
                {smsStatsSnapshot ? (
                  <ul className="va-native-list">
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Total</strong>
                        <span className="va-native-list-value">{pickDisplayText([smsStatsSnapshot.total_messages, smsStatsSnapshot.total], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Sent</strong>
                        <span className="va-native-list-value">{pickDisplayText([smsStatsSnapshot.sent_messages], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Received</strong>
                        <span className="va-native-list-value">{pickDisplayText([smsStatsSnapshot.received_messages], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Delivered</strong>
                        <span className="va-native-list-value">{pickDisplayText([smsStatsSnapshot.delivered_count], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Failed</strong>
                        <span className="va-native-list-value">{pickDisplayText([smsStatsSnapshot.failed_count], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Success Rate</strong>
                        <span className="va-native-list-value">{pickDisplayText([smsStatsSnapshot.success_rate], '0')}%</span>
                      </div>
                    </li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No SMS stats loaded"
                    description="Run a stats lookup to inspect current SMS posture."
                  />
                )}
              </UiCard>
            </div>
          </UiDisclosure>
          </UiCard>
        </section>
      </section>

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Email Diagnostics</h3>
          <p className="va-muted">Inspect single-message status, bulk job snapshots, recent batch history, and email batch health.</p>
        </header>
        <section className="va-grid">
          <UiCard className="va-investigation-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Email Investigation</h3>
              <p className="va-muted">Review message status, job progress, recent history, and 24-hour email health.</p>
            </div>
            <UiBadge variant={hasEmailInvestigationData ? 'success' : 'info'}>
              {hasEmailInvestigationData ? `${emailArtifactsCount} loaded` : 'Lookup ready'}
            </UiBadge>
          </div>
          {!canManageEmail ? (
            <UiStatePanel
              compact
              title="Email diagnostics unavailable"
              description="Your account needs email bulk management capability to run email diagnostic actions."
              tone="warning"
            />
          ) : null}
          {!hasEmailInvestigationData ? (
            <UiStatePanel
              compact
              title="No email diagnostics loaded"
              description="Run message status, job status, or history queries to populate this workspace."
              tone="info"
            />
          ) : null}
          <UiActionBar
            title="Load email diagnostics"
            description="Check a single message, inspect a bulk job, review batch history, or load bulk email stats."
            actions={(
              <>
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !canManageEmail}
                  onClick={runEmailHistoryLookup}
                >
                  Load History
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !canManageEmail}
                  onClick={runEmailStatsLookup}
                >
                  Load Stats
                </UiButton>
              </>
            )}
          />
          <div className="va-inline-tools">
            <UiInput
              placeholder="Message ID"
              value={messageIdInput}
              onChange={(event) => setMessageIdInput(event.target.value)}
            />
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !messageId || !canManageEmail}
              onClick={runEmailMessageLookup}
            >
              Message Status
            </UiButton>
          </div>
          <div className="va-inline-tools">
            <UiInput
              placeholder="Bulk Job ID"
              value={jobIdInput}
              onChange={(event) => setJobIdInput(event.target.value)}
            />
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !jobId || !canManageEmail}
              onClick={runEmailJobLookup}
            >
              Job Status
            </UiButton>
          </div>
          <UiDisclosure
            title="Email artifacts"
            subtitle={
              hasEmailInvestigationData
                ? `${emailArtifactsCount} diagnostic artifact${emailArtifactsCount === 1 ? '' : 's'} loaded`
                : 'Message status, bulk jobs, and recent history'
            }
            open={hasEmailInvestigationData}
          >
            <div className="va-subcard-grid va-subcard-grid-two">
              <UiCard tone="subcard">
                <h4>Message Snapshot</h4>
                {messageSnapshot ? (
                  <ul className="va-native-list">
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Message ID</strong>
                        <span className="va-native-list-value">{pickDisplayText([messageSnapshot.message_id, messageIdInput], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Status</strong>
                        <span className="va-native-list-value">{pickDisplayText([messageSnapshot.status], 'unknown')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Recipient</strong>
                        <span className="va-native-list-value">{pickDisplayText([messageSnapshot.recipient_email, messageSnapshot.to], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Provider</strong>
                        <span className="va-native-list-value">{pickDisplayText([messageSnapshot.provider], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Last Attempt</strong>
                        <span className="va-native-list-value">{pickDisplayText([messageSnapshot.last_attempt_at], 'n/a')}</span>
                      </div>
                    </li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No message snapshot"
                    description="Run message status lookup to inspect delivery details."
                  />
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>Email Stats Snapshot</h4>
                {emailStatsSnapshot ? (
                  <ul className="va-native-list">
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Jobs</strong>
                        <span className="va-native-list-value">{pickDisplayText([emailStatsSnapshot.total_jobs], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Recipients</strong>
                        <span className="va-native-list-value">{pickDisplayText([emailStatsSnapshot.total_recipients], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Sent</strong>
                        <span className="va-native-list-value">{pickDisplayText([emailStatsSnapshot.sent], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Delivered</strong>
                        <span className="va-native-list-value">{pickDisplayText([emailStatsSnapshot.delivered], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Failed</strong>
                        <span className="va-native-list-value">{pickDisplayText([emailStatsSnapshot.failed], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Bounced</strong>
                        <span className="va-native-list-value">{pickDisplayText([emailStatsSnapshot.bounced], '0')}</span>
                      </div>
                    </li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No email stats loaded"
                    description="Run a stats lookup to inspect recent bulk email health."
                  />
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>Bulk Job Snapshot</h4>
                {jobSnapshot ? (
                  <ul className="va-native-list">
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Job ID</strong>
                        <span className="va-native-list-value">{pickDisplayText([jobSnapshot.job_id, jobIdInput], 'n/a')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Status</strong>
                        <span className="va-native-list-value">{pickDisplayText([jobSnapshot.status], 'unknown')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Sent</strong>
                        <span className="va-native-list-value">{pickDisplayText([jobSnapshot.sent], '0')} / {pickDisplayText([jobSnapshot.total], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Delivered</strong>
                        <span className="va-native-list-value">{pickDisplayText([jobSnapshot.delivered], '0')}</span>
                      </div>
                    </li>
                    <li className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>Failed</strong>
                        <span className="va-native-list-value">{pickDisplayText([jobSnapshot.failed], '0')}</span>
                      </div>
                    </li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No bulk job snapshot"
                    description="Run job status lookup to inspect send progress."
                  />
                )}
              </UiCard>
            </div>
            <UiCard tone="subcard">
              <h4>Recent History</h4>
              {historySnapshot.length === 0 ? (
                <UiStatePanel
                  compact
                  title="No history loaded"
                  description="Load email bulk history to inspect recent jobs."
                />
              ) : (
                <ul className="va-native-list">
                  {historySnapshot.slice(0, 12).map((job, index) => (
                    <li key={`msg-investigation-email-history-${index}`} className="va-native-list-row">
                      <div className="va-native-list-head">
                        <strong>{pickDisplayText([job.job_id], `job-${index + 1}`)}</strong>
                        <span className="va-native-list-value">{pickDisplayText([job.status], 'unknown')}</span>
                      </div>
                      <div className="va-native-list-meta">
                        <span>{pickDisplayText([job.sent], '0')} / {pickDisplayText([job.total], '0')} sent</span>
                        <span>{pickDisplayText([job.provider], 'provider:n/a')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </UiCard>
          </UiDisclosure>
          </UiCard>
        </section>
      </section>
    </>
  );
}
