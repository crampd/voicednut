import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildMailerRequestState } from './moduleRequestState';
import { moduleRoutePath } from './dashboardShellConfig';
import type { DashboardVm, EmailJob } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectMailerPageVm } from './vmSelectors';
import { DashboardWorkflowContractCard } from '@/components/admin-dashboard/DashboardWorkflowContractCard';
import { LoadingTelemetryCard } from '@/components/admin-dashboard/DashboardStateCards';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiInput,
  UiStatePanel,
  UiSurfaceState,
  UiTextarea,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';
import { asRecord, pickDisplayText } from '@/services/admin-dashboard/dashboardPrimitives';

type MailerPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

type MailerLinkedWorkspace = 'content' | 'scriptsparity';

export function MailerPage({ visible, vm }: MailerPageProps) {
  const navigate = useNavigate();

  if (!visible) return null;

  const {
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
    loading,
  } = selectMailerPageVm(vm);
  const mailerHasRecipients = mailerRecipientsParsed.length > 0;
  const mailerHasTemplate = mailerTemplateIdInput.trim().length > 0;
  const mailerHasSubject = mailerSubjectInput.trim().length > 0;
  const mailerHasBody = mailerHtmlInput.trim().length > 0 || mailerTextInput.trim().length > 0;
  const mailerSubjectRequired = !mailerHasTemplate;
  const mailerBodyRequired = !mailerHasTemplate;
  const mailerRecipientsInvalid = !mailerHasRecipients;
  const mailerSubjectInvalid = mailerSubjectRequired && !mailerHasSubject;
  const mailerBodyInvalid = mailerBodyRequired && !mailerHasBody;
  const mailerMissingRequirements: string[] = [];
  if (!mailerHasRecipients) {
    mailerMissingRequirements.push('add at least one valid recipient');
  }
  if (!mailerHasTemplate && !mailerHasSubject) {
    mailerMissingRequirements.push('provide a subject or template ID');
  }
  if (!mailerHasTemplate && !mailerHasBody) {
    mailerMissingRequirements.push('provide a body (text or HTML) or template ID');
  }
  const mailerCanSubmit = mailerMissingRequirements.length === 0;
  const [messageIdInput, setMessageIdInput] = useState<string>('');
  const [jobIdInput, setJobIdInput] = useState<string>('');
  const [providerSnapshot, setProviderSnapshot] = useState<Record<string, unknown> | null>(null);
  const [bulkStatsSnapshot, setBulkStatsSnapshot] = useState<Record<string, unknown> | null>(null);
  const [messageSnapshot, setMessageSnapshot] = useState<Record<string, unknown> | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<Record<string, unknown> | null>(null);
  const [historySnapshot, setHistorySnapshot] = useState<Array<Record<string, unknown>>>([]);
  const {
    investigationBusy,
    investigationError,
    runInvestigationAction,
  } = useInvestigationAction(invokeAction);
  const mailerRequestState = buildMailerRequestState({
    loading,
    busyAction,
    secondaryBusyAction: investigationBusy,
  });
  const controlsBusy = mailerRequestState.isBusy;
  const activeActionLabel = mailerRequestState.activeActionLabel;
  const domainHealthStatusLabel = pickDisplayText([mailerDomainHealthStatus], 'Unknown');
  const domainHealthNeedsAttention = /warning|degraded|failed|error|unhealthy|suppressed/i.test(domainHealthStatusLabel);
  const providerReadiness = asRecord(providerSnapshot?.email_readiness);
  const providerSupportedProviders = Array.isArray(providerSnapshot?.email_supported_providers)
    ? providerSnapshot.email_supported_providers.map((provider) => String(provider))
    : [];
  const bulkStats = asRecord(bulkStatsSnapshot?.stats);
  const bulkStatsHours = pickDisplayText([bulkStatsSnapshot?.hours], '24');
  const pulseTone: 'info' | 'success' | 'warning' | 'error' = investigationError || mailerTemplatePreviewError
    ? 'error'
    : mailerRequestState.status === 'busy'
      ? 'info'
      : (!mailerCanSubmit && (
        mailerRecipientsInput.trim()
        || mailerSubjectInput.trim()
        || mailerTextInput.trim()
        || mailerHtmlInput.trim()
        || mailerTemplateIdInput.trim()
      )) || domainHealthNeedsAttention
        ? 'warning'
        : 'success';
  const pulseStatus = investigationError || mailerTemplatePreviewError
    ? 'Needs attention'
    : mailerRequestState.status === 'busy'
      ? 'Working'
      : (!mailerCanSubmit && (
        mailerRecipientsInput.trim()
        || mailerSubjectInput.trim()
        || mailerTextInput.trim()
        || mailerHtmlInput.trim()
        || mailerTemplateIdInput.trim()
      )) || domainHealthNeedsAttention
        ? 'Needs review'
        : 'Ready';
  const pulseDescription = investigationError
    ? investigationError
    : mailerTemplatePreviewError
      ? mailerTemplatePreviewError
      : mailerRequestState.status === 'busy'
        ? activeActionLabel ? `${activeActionLabel} is in progress.` : 'Mailer actions are in progress.'
        : !mailerCanSubmit && (
          mailerRecipientsInput.trim()
          || mailerSubjectInput.trim()
          || mailerTextInput.trim()
          || mailerHtmlInput.trim()
          || mailerTemplateIdInput.trim()
        )
          ? `Before queueing, ${mailerMissingRequirements.join(', ')}.`
          : domainHealthNeedsAttention
            ? mailerDomainHealthDetail
            : 'Audience, content, and deliverability controls are ready for the next send.';
  const openMailerLinkedWorkspace = (moduleId: MailerLinkedWorkspace) => {
    navigate(moduleRoutePath(moduleId));
  };

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Messaging</p>
        <h2 className="va-page-title">Mailer</h2>
        <p className="va-muted">
          Run the bulk-email lane from one place: readiness, queueing, job status, history, and 24-hour delivery posture.
        </p>
        <div className="va-page-intro-meta">
          <UiBadge variant={pulseTone === 'error' ? 'error' : pulseTone === 'warning' ? 'warning' : pulseTone === 'info' ? 'info' : 'success'}>
            {pulseStatus}
          </UiBadge>
          <UiBadge variant="meta">Bulk email lane</UiBadge>
          <UiBadge variant={domainHealthNeedsAttention ? 'warning' : 'info'}>
            Domain {domainHealthStatusLabel}
          </UiBadge>
        </div>
        <p className="va-page-intro-note">
          Keep campaign execution here, refresh readiness before queueing, and hand off governed template editing to the dedicated script workspaces.
        </p>
      </section>

      <UiWorkspacePulse
        title="Bulk email workspace"
        description={pulseDescription}
        status={pulseStatus}
        tone={pulseTone}
        items={[
          { label: 'Audience', value: mailerRecipientsParsed.length },
          { label: 'Invalid', value: mailerInvalidRecipients.length },
          { label: 'Delivered', value: emailDelivered },
          { label: 'Domain', value: domainHealthStatusLabel },
        ]}
      />

      <LoadingTelemetryCard
        visible={mailerRequestState.isLoading && mailerRecipientsParsed.length === 0}
        title="Loading mailer telemetry"
        description="Syncing provider readiness, bulk-send telemetry, and recent delivery outcomes."
      />
      <DashboardWorkflowContractCard moduleId="mailer" />
      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Operational Checks</h3>
          <p className="va-muted">Refresh readiness, inspect 24-hour bulk performance, and jump into the template workspaces when needed.</p>
        </header>
        <section className="va-grid">
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Provider Readiness</h3>
                <p className="va-muted">Refresh the active email route, check stored posture, and confirm readiness before a large send.</p>
              </div>
              <UiBadge variant={domainHealthNeedsAttention ? 'warning' : 'info'}>
                {domainHealthStatusLabel}
              </UiBadge>
            </div>
            <UiActionBar
              title="Refresh the email provider snapshot"
              description="Use this before large sends or when delivery posture needs confirmation."
              actions={(
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy}
                  onClick={() => {
                    void runInvestigationAction(
                      DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
                      { channel: 'email' },
                      (payload) => setProviderSnapshot(payload),
                    );
                  }}
                >
                  Refresh Email Readiness
                </UiButton>
              )}
            />
            <p className="va-muted">
              Active provider: <strong>{pickDisplayText([providerSnapshot?.email_provider, providerSnapshot?.provider], 'unknown')}</strong>
            </p>
            <p className="va-muted">
              Stored provider: <strong>{pickDisplayText([providerSnapshot?.email_stored_provider, providerSnapshot?.stored_provider], 'unknown')}</strong>
            </p>
            <p className="va-muted">
              Readiness: <strong>{pickDisplayText([providerReadiness?.status, providerReadiness?.summary, domainHealthStatusLabel], domainHealthStatusLabel)}</strong>
            </p>
            <p className="va-muted">
              Supported providers: {providerSupportedProviders.length ? providerSupportedProviders.join(', ') : 'refresh to load'}
            </p>
            <UiStatePanel
              compact
              tone={domainHealthNeedsAttention ? 'warning' : 'info'}
              title="Readiness note"
              description={pickDisplayText([providerReadiness?.detail, mailerDomainHealthDetail], mailerDomainHealthDetail)}
            />
          </UiCard>
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Bulk Stats</h3>
                <p className="va-muted">Keep the last 24 hours of job volume and delivery posture visible while you prepare the next campaign.</p>
              </div>
              <UiBadge variant="meta">{bulkStatsHours}h window</UiBadge>
            </div>
            <UiActionBar
              title="Refresh the 24-hour bulk rollup"
              description="Matches the bulk stats lane from the bot-side Mailer workflow."
              actions={(
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy}
                  onClick={() => {
                    void runInvestigationAction(
                      DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_STATS,
                      { hours: 24 },
                      (payload) => setBulkStatsSnapshot(payload),
                    );
                  }}
                >
                  Refresh 24h Stats
                </UiButton>
              )}
            />
            <p className="va-muted">Window: <strong>{bulkStatsHours}h</strong></p>
            <p className="va-muted">
              Jobs: <strong>{pickDisplayText([bulkStats?.total_jobs], String(emailJobs.length))}</strong>
              {' '}| Recipients: <strong>{pickDisplayText([bulkStats?.total_recipients], String(emailTotalRecipients))}</strong>
            </p>
            <p className="va-muted">
              Sent: <strong>{pickDisplayText([bulkStats?.sent], String(emailSent))}</strong>
              {' '}| Delivered: <strong>{pickDisplayText([bulkStats?.delivered], String(emailDelivered))}</strong>
            </p>
            <p className="va-muted">
              Failed: <strong>{pickDisplayText([bulkStats?.failed], String(emailFailed))}</strong>
              {' '}| Bounced: <strong>{pickDisplayText([bulkStats?.bounced], String(emailBounced))}</strong>
              {' '}| Complaints: <strong>{pickDisplayText([bulkStats?.complained], String(emailComplained))}</strong>
            </p>
            <p className="va-muted">
              Suppressed: <strong>{pickDisplayText([bulkStats?.suppressed], String(emailSuppressed))}</strong>
            </p>
          </UiCard>
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Template Handoff</h3>
                <p className="va-muted">Keep bulk sending operational here while governed authoring and review stay in the script workspaces.</p>
              </div>
              <UiBadge variant="meta">Linked workspaces</UiBadge>
            </div>
            <UiActionBar
              title="Keep bulk delivery here and editing there"
              description="Reviewed template authoring stays in the dedicated editing pages, not in the bulk-send console."
              actions={(
                <>
                  <UiButton
                    variant="secondary"
                    disabled={controlsBusy}
                    onClick={() => openMailerLinkedWorkspace('scriptsparity')}
                  >
                    Open Message Lanes
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={controlsBusy}
                    onClick={() => openMailerLinkedWorkspace('content')}
                  >
                    Open Script Designer
                  </UiButton>
                </>
              )}
            />
            <p className="va-muted">
              Use Message Lanes for email template review, promotion, simulation, and rollback.
            </p>
            <p className="va-muted">
              Use Script Designer when you need the combined call, SMS, and email editing model from the main bot workflow.
            </p>
          </UiCard>
        </section>
      </section>

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Bulk Send</h3>
          <p className="va-muted">Prepare recipients, select a template or body, and queue the outbound batch.</p>
        </header>
        <section className="va-grid">
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Bulk Send Console</h3>
                <p className="va-muted">Assemble audience, content, variables, and timing in one queue-ready surface.</p>
              </div>
              <UiBadge variant={mailerCanSubmit ? 'success' : 'warning'}>
                {mailerCanSubmit ? 'Queue ready' : 'Needs input'}
              </UiBadge>
            </div>
            <UiActionBar
              title="Prepare the next mailer job"
              description={
                mailerCanSubmit
                  ? 'Confirm readiness, review timing and variables, then queue the next job.'
                  : 'Add recipients and draft content, or load a template before queueing.'
              }
              actions={(
                <UiButton
                  variant="primary"
                  disabled={controlsBusy || !mailerCanSubmit}
                  onClick={() => { void sendMailerFromConsole(); }}
                >
                  Queue Mailer Job
                </UiButton>
              )}
            />
            <p className="va-card-eyebrow">Audience</p>
            <UiTextarea
              id="va-mailer-recipients"
              placeholder="Recipient emails separated by comma/newline"
              value={mailerRecipientsInput}
              onChange={(event) => setMailerRecipientsInput(event.target.value)}
              aria-required
              aria-invalid={mailerRecipientsInvalid}
              aria-describedby="va-mailer-recipients-hint"
              rows={5}
            />
            <p id="va-mailer-recipients-hint" className="va-field-hint">
              Enter at least one valid recipient email to queue this batch.
            </p>
            <div className="va-inline-tools">
              <input
                type="file"
                accept=".csv,.txt"
                aria-label="Upload mailer recipients file"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  void handleRecipientsFile(file, 'mailer');
                  event.currentTarget.value = '';
                }}
              />
              <UiInput
                placeholder="Template ID (optional)"
                value={mailerTemplateIdInput}
                onChange={(event) => setMailerTemplateIdInput(event.target.value)}
              />
            </div>
            <p className="va-field-hint">
              Use a reviewed template ID from Message Lanes when this batch should run a governed email template.
            </p>
            <p className="va-card-eyebrow">Content</p>
            <UiInput
              id="va-mailer-subject"
              placeholder="Subject (supports {{variables}})"
              value={mailerSubjectInput}
              onChange={(event) => setMailerSubjectInput(event.target.value)}
              aria-required={mailerSubjectRequired}
              aria-invalid={mailerSubjectInvalid}
              aria-describedby="va-mailer-subject-hint"
            />
            <p id="va-mailer-subject-hint" className="va-field-hint">
              Required when template ID is empty.
            </p>
            <UiTextarea
              id="va-mailer-html-body"
              placeholder="HTML body (optional)"
              value={mailerHtmlInput}
              onChange={(event) => setMailerHtmlInput(event.target.value)}
              aria-required={mailerBodyRequired}
              aria-invalid={mailerBodyInvalid}
              aria-describedby="va-mailer-body-hint"
              rows={4}
            />
            <UiTextarea
              id="va-mailer-text-body"
              placeholder="Text body (optional)"
              value={mailerTextInput}
              onChange={(event) => setMailerTextInput(event.target.value)}
              aria-required={mailerBodyRequired}
              aria-invalid={mailerBodyInvalid}
              aria-describedby="va-mailer-body-hint"
              rows={3}
            />
            <p id="va-mailer-body-hint" className="va-field-hint">
              When template ID is empty, provide HTML or text body content.
            </p>
            <p className="va-card-eyebrow">Template Variables</p>
            <UiTextarea
              placeholder={'Variables JSON, e.g. {"first_name":"Ada"}'}
              value={mailerVariablesInput}
              onChange={(event) => setMailerVariablesInput(event.target.value)}
              rows={3}
            />
            <p className="va-card-eyebrow">Scheduling</p>
            <div className="va-inline-tools">
              <label className="va-muted">
                Send at:
                <UiInput
                  type="datetime-local"
                  value={mailerScheduleAt}
                  onChange={(event) => setMailerScheduleAt(event.target.value)}
                />
              </label>
            </div>
            {!mailerCanSubmit ? (
              <UiStatePanel
                title="Mailer requirements not met"
                description={`Before queueing, ${mailerMissingRequirements.join(', ')}.`}
                tone="warning"
                compact
              />
            ) : null}
            <p className="va-muted">
              Audience: <strong>{mailerRecipientsParsed.length}</strong>
              {' '}| Invalid: <strong>{mailerInvalidRecipients.length}</strong>
              {' '}| Duplicates removed: <strong>{mailerDuplicateCount}</strong>
            </p>
            <p className="va-muted">
              Template variables detected: {mailerVariableKeys.length ? mailerVariableKeys.join(', ') : 'none'}
            </p>
            {mailerInvalidRecipients.length > 0 ? (
              <UiStatePanel
                title="Recipient format warnings"
                description={`Suppression preview: ${mailerInvalidRecipients.slice(0, 10).join(', ')}`}
                tone="warning"
                compact
              />
            ) : null}
            <UiDisclosure
              title="Template preview"
              subtitle={
                mailerTemplatePreviewError
                  ? 'Needs attention before queueing'
                  : mailerVariableKeys.length
                    ? `${mailerVariableKeys.length} variable${mailerVariableKeys.length === 1 ? '' : 's'} detected`
                    : 'No template variables detected'
              }
              tone={mailerTemplatePreviewError ? 'warning' : 'neutral'}
              open={Boolean(mailerTemplatePreviewError)}
            >
              <UiCard tone="subcard">
                <h4>Template Render Preview</h4>
                <p className="va-muted">Subject preview: <strong>{mailerTemplatePreviewSubject}</strong></p>
                <p className="va-muted">Body preview: {mailerTemplatePreviewBody}</p>
                {mailerTemplatePreviewError ? (
                  <UiStatePanel
                    title="Template render issue"
                    description={mailerTemplatePreviewError}
                    tone="error"
                    compact
                  />
                ) : null}
              </UiCard>
            </UiDisclosure>
          </UiCard>
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Readiness & Deliverability</h3>
                <p className="va-muted">Watch delivery health, bounce trends, and recent jobs before and after each batch.</p>
              </div>
              <UiBadge variant={emailFailed > 0 || emailBounced > 0 || emailComplained > 0 ? 'warning' : 'info'}>
                {emailDelivered} delivered
              </UiBadge>
            </div>
            <p>Total recipients (24h): <strong>{emailTotalRecipients}</strong></p>
            <p>Sent: <strong>{emailSent}</strong> | Failed: <strong>{emailFailed}</strong></p>
            <p>Delivered: <strong>{emailDelivered}</strong></p>
            <p>
              Bounced: <strong>{emailBounced}</strong> | Complaints: <strong>{emailComplained}</strong>
              {' '}| Suppressed: <strong>{emailSuppressed}</strong>
            </p>
            <pre>{textBar(emailProcessedPercent)}</pre>
            <pre>{textBar(emailDeliveredPercent)}</pre>
            <pre>{textBar(emailBouncePercent)}</pre>
            <pre>{textBar(emailComplaintPercent)}</pre>
            <UiDisclosure
              title="Deliverability detail"
              subtitle={
                emailJobs.length > 0
                  ? `${Math.min(emailJobs.length, 6)} recent job${emailJobs.length === 1 ? '' : 's'} loaded`
                  : 'Domain health, trend, and recent jobs'
              }
            >
              <UiCard tone="subcard">
                <h4>Domain Health</h4>
                <p className="va-muted">Status: <strong>{mailerDomainHealthStatus}</strong></p>
                <p className="va-muted">{mailerDomainHealthDetail}</p>
              </UiCard>
              <UiCard tone="subcard">
                <h4>Bounce/Complaint Trend</h4>
                {mailerTrendBars.length === 0 ? (
                  <UiStatePanel
                    title="No trend data yet"
                    description="Bounce/complaint trend bars will appear once recent jobs are available."
                    tone="info"
                    compact
                  />
                ) : (
                  <ul className="va-list va-list-dense">
                    {mailerTrendBars.map((bar, index) => (
                      <li key={`mailer-trend-${index}`}><pre>{bar}</pre></li>
                    ))}
                  </ul>
                )}
              </UiCard>
              {emailJobs.length > 0 ? (
                <ul className="va-list va-list-dense">
                  {emailJobs.slice(0, 6).map((job: EmailJob, index: number) => (
                    <li key={`mailer-job-${index}`}>
                      <strong>{toText(job.job_id, `job-${index + 1}`)}</strong>
                      <span>{toText(job.status, 'unknown')}</span>
                      <span>{toInt(job.sent)}/{toInt(job.total)} sent</span>
                      <span>
                        Fail: {toInt(job.failed)} | Deliv: {toInt(job.delivered)} | Bounce: {toInt(job.bounced)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <UiStatePanel
                  title="No recent mailer jobs"
                  description="Queued and completed jobs will appear here once deliveries are processed."
                  tone="info"
                  compact
                />
              )}
            </UiDisclosure>
          </UiCard>
        </section>
      </section>

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Status, History & Trace</h3>
          <p className="va-muted">Lookup individual message status, inspect bulk jobs, and review recent mailer history.</p>
        </header>
        {investigationError || mailerRequestState.status === 'busy' ? (
          <div className="va-status-state-stack">
            {investigationError ? (
              <UiSurfaceState
                eyebrow="Lookup status"
                status="Needs attention"
                statusVariant="error"
                title="Email investigation needs attention"
                description={investigationError}
                tone="error"
                compact
              />
            ) : null}
            {mailerRequestState.status === 'busy' ? (
              <UiSurfaceState
                eyebrow="Lookup status"
                status="In progress"
                statusVariant="info"
                title="Email investigation is running"
                description={activeActionLabel ? `${activeActionLabel} is running.` : 'Request is running.'}
                tone="info"
                compact
              />
            ) : null}
          </div>
        ) : null}
        <section className="va-grid">
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Email Diagnostics Console</h3>
                <p className="va-muted">Look up a single message, inspect a bulk job, and pull recent history without leaving the mailer lane.</p>
              </div>
              <UiBadge variant={historySnapshot.length > 0 ? 'meta' : 'info'}>
                {historySnapshot.length > 0 ? `${historySnapshot.length} loaded` : 'Lookup ready'}
              </UiBadge>
            </div>
            <div className="va-inline-tools">
              <UiInput
                placeholder="Message ID"
                value={messageIdInput}
                onChange={(event) => setMessageIdInput(event.target.value)}
              />
              <UiButton
                variant="secondary"
                disabled={controlsBusy || !messageIdInput.trim()}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS,
                    { message_id: messageIdInput.trim() },
                    (payload) => setMessageSnapshot(asRecord(payload.message) || payload),
                  );
                }}
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
                disabled={controlsBusy || !jobIdInput.trim()}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB,
                    { job_id: jobIdInput.trim() },
                    (payload) => setJobSnapshot(payload),
                  );
                }}
              >
                Job Status
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={controlsBusy}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
                    { limit: 12, offset: 0 },
                    (payload) => setHistorySnapshot(
                      Array.isArray(payload.jobs) ? payload.jobs.map(asRecord) : [],
                    ),
                  );
                }}
              >
                Load History
              </UiButton>
            </div>
            <div className="va-subcard-grid va-subcard-grid-two">
              <UiCard tone="subcard">
                <h4>Message Snapshot</h4>
                {messageSnapshot ? (
                  <ul className="va-list va-list-dense">
                    <li><strong>ID:</strong> {pickDisplayText([messageSnapshot.message_id, messageIdInput], 'n/a')}</li>
                    <li><strong>Status:</strong> {pickDisplayText([messageSnapshot.status], 'unknown')}</li>
                    <li><strong>Recipient:</strong> {pickDisplayText([messageSnapshot.recipient_email, messageSnapshot.to], 'n/a')}</li>
                    <li><strong>Provider:</strong> {pickDisplayText([messageSnapshot.provider], 'n/a')}</li>
                    <li><strong>Last Attempt:</strong> {pickDisplayText([messageSnapshot.last_attempt_at], 'n/a')}</li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No message snapshot"
                    description="Run message status lookup to inspect details."
                  />
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>Bulk Job Snapshot</h4>
                {jobSnapshot ? (
                  <ul className="va-list va-list-dense">
                    <li><strong>Job ID:</strong> {pickDisplayText([jobSnapshot.job_id, jobIdInput], 'n/a')}</li>
                    <li><strong>Status:</strong> {pickDisplayText([jobSnapshot.status], 'unknown')}</li>
                    <li><strong>Sent:</strong> {pickDisplayText([jobSnapshot.sent], '0')} / {pickDisplayText([jobSnapshot.total], '0')}</li>
                    <li><strong>Delivered:</strong> {pickDisplayText([jobSnapshot.delivered], '0')}</li>
                    <li><strong>Failed:</strong> {pickDisplayText([jobSnapshot.failed], '0')}</li>
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
                  description="Run history lookup to inspect recent email bulk jobs."
                />
              ) : (
                <ul className="va-list va-list-dense">
                  {historySnapshot.slice(0, 10).map((job, index) => (
                    <li key={`mailer-history-${index}`}>
                      <strong>{pickDisplayText([job.job_id], `job-${index + 1}`)}</strong>
                      <span>{pickDisplayText([job.status], 'unknown')}</span>
                      <span>{pickDisplayText([job.sent], '0')} / {pickDisplayText([job.total], '0')} sent</span>
                    </li>
                  ))}
                </ul>
              )}
            </UiCard>
          </UiCard>
        </section>
      </section>
    </>
  );
}
