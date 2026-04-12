import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildSmsRequestState } from './moduleRequestState';
import type { DashboardVm } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectSmsPageVm } from './vmSelectors';
import { LoadingTelemetryCard } from '@/components/admin-dashboard/DashboardStateCards';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiInput,
  UiSelect,
  UiStatePanel,
  UiSurfaceState,
  UiTextarea,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';
import { asRecord, pickDisplayText } from '@/services/admin-dashboard/dashboardPrimitives';

type SmsSenderPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

type SmsScriptRow = {
  name?: unknown;
  description?: unknown;
  content?: unknown;
  is_builtin?: unknown;
  lifecycle_state?: unknown;
};

function toScriptRows(value: unknown): SmsScriptRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asRecord(entry) as SmsScriptRow);
}

function toErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  return 'Request failed';
}

function extractTemplateTokens(content: string): string[] {
  return Array.from(
    new Set(
      Array.from(content.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g))
        .map((match) => match[1].trim())
        .filter(Boolean),
    ),
  );
}

export function SmsSenderPage({ visible, vm }: SmsSenderPageProps) {
  if (!visible) return null;

  const {
    hasCapability,
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
    loading,
  } = selectSmsPageVm(vm);
  const smsHasRecipients = smsRecipientsParsed.length > 0;
  const smsHasMessage = smsMessageInput.trim().length > 0;
  const smsRecipientsInvalid = !smsHasRecipients;
  const smsMessageInvalid = !smsHasMessage;
  const smsCanSubmit = smsHasRecipients && smsHasMessage;
  const smsReadinessHint = !smsHasRecipients && !smsHasMessage
    ? 'Add at least one valid recipient and a message body to enable batch execution.'
    : !smsHasRecipients
      ? 'Add at least one valid recipient to enable batch execution.'
      : 'Add a message body to enable batch execution.';
  const [statusSidInput, setStatusSidInput] = useState<string>('');
  const [conversationPhoneInput, setConversationPhoneInput] = useState<string>('');
  const [statusSnapshot, setStatusSnapshot] = useState<Record<string, unknown> | null>(null);
  const [recentMessages, setRecentMessages] = useState<Array<Record<string, unknown>>>([]);
  const [conversationMessages, setConversationMessages] = useState<Array<Record<string, unknown>>>([]);
  const [statsSnapshot, setStatsSnapshot] = useState<Record<string, unknown> | null>(null);
  const [smsScriptAssistBusy, setSmsScriptAssistBusy] = useState<boolean>(false);
  const [smsScriptAssistError, setSmsScriptAssistError] = useState<string>('');
  const [smsScriptRows, setSmsScriptRows] = useState<SmsScriptRow[]>([]);
  const [selectedSmsScriptName, setSelectedSmsScriptName] = useState<string>('');
  const {
    investigationBusy,
    investigationError,
    runInvestigationAction,
  } = useInvestigationAction(invokeAction);
  const smsRequestState = buildSmsRequestState({
    loading,
    busyAction,
    secondaryBusyAction: investigationBusy,
  });
  const controlsBusy = smsRequestState.isBusy;
  const activeActionLabel = smsRequestState.activeActionLabel;
  const pulseTone: 'info' | 'success' | 'warning' | 'error' = investigationError
    ? 'error'
    : smsRequestState.status === 'busy'
      ? 'info'
      : !smsCanSubmit && (smsRecipientsInput.trim() || smsMessageInput.trim())
        ? 'warning'
        : 'success';
  const pulseStatus = investigationError
    ? 'Needs attention'
    : smsRequestState.status === 'busy'
      ? 'Working'
      : !smsCanSubmit && (smsRecipientsInput.trim() || smsMessageInput.trim())
        ? 'Needs setup'
        : 'Ready';
  const pulseDescription = investigationError
    ? investigationError
    : smsRequestState.status === 'busy'
      ? activeActionLabel ? `${activeActionLabel} is in progress.` : 'SMS actions are in progress.'
      : !smsCanSubmit && (smsRecipientsInput.trim() || smsMessageInput.trim())
        ? smsReadinessHint
        : 'Recipients, routing checks, and send controls are ready for the next batch.';
  const canManageSmsScripts = hasCapability('caller_flags_manage');
  const selectedSmsScript = useMemo(() => (
    smsScriptRows.find((script) => pickDisplayText([script.name], '') === selectedSmsScriptName) || null
  ), [selectedSmsScriptName, smsScriptRows]);
  const selectedSmsScriptContent = pickDisplayText([selectedSmsScript?.content], '');
  const selectedSmsScriptDescription = pickDisplayText([selectedSmsScript?.description], '');
  const selectedSmsScriptTokens = useMemo(
    () => extractTemplateTokens(selectedSmsScriptContent),
    [selectedSmsScriptContent],
  );

  const loadSmsScripts = useCallback(async (): Promise<void> => {
    if (!canManageSmsScripts) return;
    setSmsScriptAssistBusy(true);
    setSmsScriptAssistError('');
    try {
      const payload = asRecord(await invokeAction(
        DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_LIST,
        {
          include_builtins: true,
          detailed: true,
        },
      ));
      const merged = [
        ...toScriptRows(payload.scripts),
        ...toScriptRows(payload.builtin),
      ];
      setSmsScriptRows(merged);
      setSelectedSmsScriptName((current) => {
        if (!merged.length) return '';
        const hasCurrent = merged.some((script) => pickDisplayText([script.name], '') === current);
        return hasCurrent ? current : pickDisplayText([merged[0]?.name], '');
      });
    } catch (error) {
      setSmsScriptAssistError(toErrorText(error));
    } finally {
      setSmsScriptAssistBusy(false);
    }
  }, [canManageSmsScripts, invokeAction]);

  useEffect(() => {
    if (!canManageSmsScripts) return;
    void loadSmsScripts();
  }, [canManageSmsScripts, loadSmsScripts]);

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Messaging</p>
        <h2 className="va-page-title">SMS Operations Console</h2>
        <p className="va-muted">
          Compose bulk SMS campaigns, validate recipients, estimate cost, and monitor completion.
        </p>
        <div className="va-page-intro-meta">
          <UiBadge variant={pulseTone}>{pulseStatus}</UiBadge>
          <UiBadge variant="meta">Bulk messaging</UiBadge>
          <UiBadge variant="info">{smsRecipientsParsed.length} recipients</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Prepare a batch, validate routing and cost, then move into message-level diagnostics from
          the same workspace when delivery needs deeper review.
        </p>
      </section>

      <UiWorkspacePulse
        title="SMS workspace"
        description={pulseDescription}
        status={pulseStatus}
        tone={pulseTone}
        items={[
          { label: 'Audience', value: smsRecipientsParsed.length },
          { label: 'Invalid', value: smsInvalidRecipients.length },
          { label: 'Segments', value: smsSegmentEstimate.segments },
          { label: 'Est. cost', value: `$${smsEstimatedCost.toFixed(4)}` },
        ]}
      />

      <LoadingTelemetryCard
        visible={smsRequestState.isLoading && smsRecipientsParsed.length === 0}
        title="Loading SMS telemetry"
        description="Syncing recipient analytics, route simulation, and job outcomes."
      />

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Compose & Validate</h3>
          <p className="va-muted">Prepare recipients, author message, and configure delivery settings.</p>
        </header>
        <section className="va-grid">
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>SMS Sender Console</h3>
                <p className="va-muted">Stage recipients, refine message content, and confirm delivery settings before execution.</p>
              </div>
              <UiBadge variant={smsCanSubmit ? 'success' : smsRecipientsInput.trim() || smsMessageInput.trim() ? 'warning' : 'info'}>
                {smsCanSubmit ? 'Ready' : smsRecipientsInput.trim() || smsMessageInput.trim() ? 'Needs setup' : 'Idle'}
              </UiBadge>
            </div>
            <UiActionBar
              title="Prepare the next batch"
              description={
                smsCanSubmit
                  ? 'Review delivery settings, then run a dry-run or send the batch.'
                  : 'Paste recipients and a message body, or upload a CSV/TXT recipient list.'
              }
              actions={(
                <UiButton
                  variant="primary"
                  disabled={controlsBusy || !smsCanSubmit}
                  onClick={() => { void sendSmsFromConsole(); }}
                >
                  {smsDryRunMode ? 'Run Dry-Run' : smsScheduleAt ? 'Schedule SMS Batch' : 'Send SMS Batch'}
                </UiButton>
              )}
            />
            <p className="va-card-eyebrow">Audience</p>
            <UiTextarea
              id="va-sms-recipients"
              placeholder="Recipients (+15551230001), separated by comma/newline"
              value={smsRecipientsInput}
              onChange={(event) => setSmsRecipientsInput(event.target.value)}
              aria-required
              aria-invalid={smsRecipientsInvalid}
              aria-describedby="va-sms-recipients-hint"
              rows={5}
            />
            <p id="va-sms-recipients-hint" className="va-field-hint">
              Enter one or more valid phone numbers. This field is required for batch send.
            </p>
            <div className="va-inline-tools">
              <input
                type="file"
                accept=".csv,.txt"
                aria-label="Upload SMS recipients file"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  void handleRecipientsFile(file, 'sms');
                  event.currentTarget.value = '';
                }}
              />
              <UiInput
                placeholder="Provider (optional)"
                value={smsProviderInput}
                onChange={(event) => setSmsProviderInput(event.target.value)}
              />
            </div>
            <p className="va-card-eyebrow">Message</p>
            <UiTextarea
              id="va-sms-message"
              placeholder="Message body"
              value={smsMessageInput}
              onChange={(event) => setSmsMessageInput(event.target.value)}
              aria-required
              aria-invalid={smsMessageInvalid}
              aria-describedby="va-sms-message-hint"
              rows={4}
            />
            <p id="va-sms-message-hint" className="va-field-hint">
              Message content is required to execute a send or schedule operation.
            </p>
            <UiDisclosure
              title="Script-assisted composer"
              subtitle={
                canManageSmsScripts
                  ? 'Use approved script assets as a starting point for message composition.'
                  : 'Safe script rendering for this role is pending backend action contract exposure.'
              }
            >
              {!canManageSmsScripts ? (
                <UiStatePanel
                  title="Script assist pending for this role"
                  description="Manual composition is available now. Script-assisted rendering for non-admin users will unlock after backend action contracts are exposed on this page."
                  tone="info"
                  compact
                />
              ) : (
                <>
                  <UiActionBar
                    title="Script library"
                    description={
                      smsScriptRows.length > 0
                        ? 'Select a script and apply it to the message body.'
                        : 'Load scripts from the content workspace, then apply one to the composer.'
                    }
                    actions={(
                      <div className="va-inline-tools">
                        <UiButton
                          variant="secondary"
                          disabled={controlsBusy || smsScriptAssistBusy}
                          onClick={() => { void loadSmsScripts(); }}
                        >
                          Refresh Scripts
                        </UiButton>
                        <UiButton
                          variant="secondary"
                          disabled={controlsBusy || smsScriptAssistBusy || !selectedSmsScriptContent}
                          onClick={() => setSmsMessageInput(selectedSmsScriptContent)}
                        >
                          Apply to Composer
                        </UiButton>
                      </div>
                    )}
                  />
                  {smsScriptAssistError ? (
                    <UiStatePanel
                      title="Script library unavailable"
                      description={smsScriptAssistError}
                      tone="error"
                      compact
                    />
                  ) : null}
                  <UiSelect
                    aria-label="Select SMS script"
                    value={selectedSmsScriptName}
                    disabled={controlsBusy || smsScriptAssistBusy || smsScriptRows.length === 0}
                    onChange={(event) => setSelectedSmsScriptName(event.target.value)}
                  >
                    {smsScriptRows.length === 0 ? (
                      <option value="">No scripts loaded</option>
                    ) : (
                      smsScriptRows.map((script, index) => {
                        const scriptName = pickDisplayText([script.name], `script-${index + 1}`);
                        const lifecycle = pickDisplayText([script.lifecycle_state], '').trim();
                        return (
                          <option key={`${scriptName}-${index}`} value={scriptName}>
                            {lifecycle ? `${scriptName} (${lifecycle})` : scriptName}
                          </option>
                        );
                      })
                    )}
                  </UiSelect>
                  {selectedSmsScript ? (
                    <div className="va-subcard-grid va-subcard-grid-two">
                      <UiCard tone="subcard">
                        <h4>Selected Script</h4>
                        <p className="va-muted"><strong>{pickDisplayText([selectedSmsScript.name], 'Unnamed script')}</strong></p>
                        {selectedSmsScriptDescription ? (
                          <p className="va-muted">{selectedSmsScriptDescription}</p>
                        ) : (
                          <p className="va-muted">No description provided.</p>
                        )}
                        <p className="va-muted">
                          Template tokens: <strong>{selectedSmsScriptTokens.length}</strong>
                        </p>
                        {selectedSmsScriptTokens.length > 0 ? (
                          <p className="va-muted">{selectedSmsScriptTokens.join(', ')}</p>
                        ) : null}
                      </UiCard>
                      <UiCard tone="subcard">
                        <h4>Render mode</h4>
                        <p className="va-muted">
                          Applying a script inserts raw template text into the composer.
                          Variable rendering remains disabled until the safe render contract is exposed on this page.
                        </p>
                        <UiTextarea
                          value={selectedSmsScriptContent}
                          readOnly
                          rows={4}
                          aria-label="Selected SMS script preview"
                        />
                      </UiCard>
                    </div>
                  ) : (
                    <UiStatePanel
                      title="No script selected"
                      description="Select a script to preview and apply it to the message composer."
                      tone="info"
                      compact
                    />
                  )}
                </>
              )}
            </UiDisclosure>
            <p className="va-card-eyebrow">Delivery Settings</p>
            <div className="va-inline-tools">
              <label className="va-muted">
                Schedule at:
                <UiInput
                  type="datetime-local"
                  value={smsScheduleAt}
                  onChange={(event) => setSmsScheduleAt(event.target.value)}
                />
              </label>
              <label className="va-muted">
                Cost/segment ($):
                <UiInput
                  inputMode="decimal"
                  placeholder="0.0075"
                  value={smsCostPerSegment}
                  onChange={(event) => setSmsCostPerSegment(event.target.value)}
                />
              </label>
              <label className="va-muted">
                <input
                  type="checkbox"
                  checked={smsDryRunMode}
                  onChange={(event) => setSmsDryRunMode(event.target.checked)}
                />
                {' '}Dry-run only
              </label>
            </div>
            {!smsCanSubmit ? (
              <UiStatePanel
                title="Batch requirements not met"
                description={smsReadinessHint}
                tone="warning"
                compact
              />
            ) : null}
            <div className="va-subcard-grid va-subcard-grid-two">
              <UiCard tone="subcard">
                <h4>Validation Preview</h4>
                <p className="va-muted">Valid: <strong>{smsValidationCategories.valid}</strong></p>
                <p className="va-muted">Invalid: <strong>{smsValidationCategories.invalid}</strong></p>
                <p className="va-muted">Duplicates: <strong>{smsValidationCategories.duplicate}</strong></p>
                <p className="va-muted">Likely landline: <strong>{smsValidationCategories.likelyLandline}</strong></p>
              </UiCard>
              <UiCard tone="subcard">
                <h4>Cost Estimate</h4>
                <p className="va-muted">Estimated send cost: <strong>${smsEstimatedCost.toFixed(4)}</strong></p>
                <p className="va-muted">
                  Based on {smsSegmentEstimate.segments} segment(s) per recipient and your cost/segment.
                </p>
              </UiCard>
            </div>
            <p className="va-muted">
              Recipients: <strong>{smsRecipientsParsed.length}</strong>
              {' '}| Invalid: <strong>{smsInvalidRecipients.length}</strong>
              {' '}| Duplicates removed: <strong>{smsDuplicateCount}</strong>
            </p>
            <p className="va-muted">
              Segment estimate: <strong>{smsSegmentEstimate.segments}</strong>
              {' '}segment(s), {smsSegmentEstimate.perSegment} chars/segment.
            </p>
            <UiDisclosure
              title="Routing preview"
              subtitle={
                smsRouteSimulationRows.length === 0
                  ? 'Provider diagnostics will appear after the first parse or send cycle.'
                  : `${smsRouteSimulationRows.length} provider path${smsRouteSimulationRows.length === 1 ? '' : 's'} loaded`
              }
            >
              {smsRouteSimulationRows.length === 0 ? (
                <UiStatePanel
                  title="Route simulation warming up"
                  description="Provider routing diagnostics will appear after the first parse/run cycle."
                  tone="info"
                  compact
                />
              ) : (
                <ul className="va-list va-list-dense">
                  {smsRouteSimulationRows.map((row) => (
                    <li key={`sms-route-${row.provider}`}>
                      <strong>{row.provider}</strong>
                      <span>Ready: {row.ready ? 'yes' : 'no'} | Degraded: {row.degraded ? 'yes' : 'no'}</span>
                      <span>Parity gaps: {row.parityGapCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </UiDisclosure>
          </UiCard>
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>SMS Job Tracker</h3>
                <p className="va-muted">Watch 24-hour throughput, failures, and suppression risk after batch execution.</p>
              </div>
              <UiBadge variant={smsFailed > 0 ? 'warning' : 'success'}>
                {smsTotalRecipients > 0 ? `${smsProcessedPercent}% processed` : 'No activity'}
              </UiBadge>
            </div>
            <p>Total recipients (24h): <strong>{smsTotalRecipients}</strong></p>
            <p>Successful: <strong>{smsSuccess}</strong> | Failed: <strong>{smsFailed}</strong></p>
            <pre>{textBar(smsProcessedPercent)}</pre>
            {smsInvalidRecipients.length > 0 ? (
              <UiStatePanel
                title="Recipient format warnings"
                description={`Suppression preview: ${smsInvalidRecipients.slice(0, 10).join(', ')}`}
                tone="warning"
                compact
              />
            ) : null}
          </UiCard>
        </section>
      </section>

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Investigation & Status</h3>
          <p className="va-muted">Message-level diagnostics for recent, conversation, and SID lookups.</p>
        </header>
        {investigationError || smsRequestState.status === 'busy' ? (
          <div className="va-status-state-stack">
            {investigationError ? (
              <UiSurfaceState
                eyebrow="Lookup status"
                status="Needs attention"
                statusVariant="error"
                title="SMS investigation needs attention"
                description={investigationError}
                tone="error"
                compact
              />
            ) : null}
            {smsRequestState.status === 'busy' ? (
              <UiSurfaceState
                eyebrow="Lookup status"
                status="In progress"
                statusVariant="info"
                title="SMS investigation is running"
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
                <h3>SMS Message Lookup</h3>
                <p className="va-muted">Inspect individual SID status, phone-level conversations, and recent delivery artifacts.</p>
              </div>
              <UiBadge
                variant={statusSnapshot || recentMessages.length > 0 || conversationMessages.length > 0 || statsSnapshot ? 'success' : 'info'}
              >
                {statusSnapshot || recentMessages.length > 0 || conversationMessages.length > 0 || statsSnapshot ? 'Artifacts loaded' : 'Lookup ready'}
              </UiBadge>
            </div>
            <div className="va-inline-tools">
              <UiInput
                placeholder="Message SID"
                value={statusSidInput}
                onChange={(event) => setStatusSidInput(event.target.value)}
              />
              <UiButton
                variant="secondary"
                disabled={controlsBusy || !statusSidInput.trim()}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGE_STATUS,
                    { message_sid: statusSidInput.trim() },
                    (payload) => setStatusSnapshot(asRecord(payload.message) || payload),
                  );
                }}
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
                disabled={controlsBusy || !conversationPhoneInput.trim()}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_CONVERSATION,
                    { phone: conversationPhoneInput.trim(), limit: 20 },
                    (payload) => setConversationMessages(
                      Array.isArray(payload.messages) ? payload.messages.map(asRecord) : [],
                    ),
                  );
                }}
              >
                Load Conversation
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={controlsBusy}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_RECENT,
                    { limit: 12, offset: 0 },
                    (payload) => setRecentMessages(
                      Array.isArray(payload.messages) ? payload.messages.map(asRecord) : [],
                    ),
                  );
                }}
              >
                Recent
              </UiButton>
              <UiButton
                variant="secondary"
                disabled={controlsBusy}
                onClick={() => {
                  void runInvestigationAction(
                    DASHBOARD_ACTION_CONTRACTS.SMS_STATS,
                    { hours: 24 },
                    (payload) => setStatsSnapshot(payload),
                  );
                }}
              >
                Stats
              </UiButton>
            </div>
            <div className="va-subcard-grid va-subcard-grid-two">
              <UiCard tone="subcard">
                <h4>Status Snapshot</h4>
                {statusSnapshot ? (
                  <ul className="va-list va-list-dense">
                    <li><strong>SID:</strong> {pickDisplayText([statusSnapshot.message_sid, statusSidInput], 'n/a')}</li>
                    <li><strong>Status:</strong> {pickDisplayText([statusSnapshot.status], 'unknown')}</li>
                    <li><strong>To:</strong> {pickDisplayText([statusSnapshot.to_number], 'n/a')}</li>
                    <li><strong>From:</strong> {pickDisplayText([statusSnapshot.from_number], 'n/a')}</li>
                    <li><strong>Provider:</strong> {pickDisplayText([statusSnapshot.provider], 'n/a')}</li>
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
                    description="Run the recent query to populate this list."
                  />
                ) : (
                  <ul className="va-list va-list-dense">
                    {recentMessages.slice(0, 8).map((message, index) => (
                      <li key={`sms-recent-${index}`}>
                        <strong>{pickDisplayText([message.message_sid], `message-${index + 1}`)}</strong>
                        <span>{pickDisplayText([message.status], 'unknown')}</span>
                        <span>{pickDisplayText([message.to_number, message.from_number], 'n/a')}</span>
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
                  <ul className="va-list va-list-dense">
                    {conversationMessages.slice(0, 10).map((message, index) => (
                      <li key={`sms-convo-${index}`}>
                        <strong>{pickDisplayText([message.direction], 'unknown')}</strong>
                        <span>{pickDisplayText([message.status], 'unknown')}</span>
                        <span>{pickDisplayText([message.body], '').slice(0, 120) || 'No body'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>Stats Snapshot</h4>
                {statsSnapshot ? (
                  <ul className="va-list va-list-dense">
                    <li><strong>Total:</strong> {pickDisplayText([statsSnapshot.total_messages, statsSnapshot.total], '0')}</li>
                    <li><strong>Sent:</strong> {pickDisplayText([statsSnapshot.sent_messages], '0')}</li>
                    <li><strong>Received:</strong> {pickDisplayText([statsSnapshot.received_messages], '0')}</li>
                    <li><strong>Delivered:</strong> {pickDisplayText([statsSnapshot.delivered_count], '0')}</li>
                    <li><strong>Failed:</strong> {pickDisplayText([statsSnapshot.failed_count], '0')}</li>
                    <li><strong>Success Rate:</strong> {pickDisplayText([statsSnapshot.success_rate], '0')}%</li>
                  </ul>
                ) : (
                  <UiStatePanel
                    compact
                    title="No stats snapshot"
                    description="Run stats lookup to inspect current SMS posture."
                  />
                )}
              </UiCard>
            </div>
          </UiCard>
        </section>
      </section>
    </>
  );
}
