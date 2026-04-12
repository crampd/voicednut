import { useEffect, useState } from 'react';

import { buildModuleRequestState } from './moduleRequestState';
import type { DashboardVm } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectScriptStudioPageVm } from './vmSelectors';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiInput,
  UiSelect,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';

type CallerFlagsModerationPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

function statusLabel(status: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'allowed':
      return 'Allowed';
    case 'blocked':
      return 'Blocked';
    case 'spam':
      return 'Spam';
    default:
      return 'All callers';
  }
}

function emptyStateLabel(status: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'allowed':
      return 'No allowed callers loaded';
    case 'blocked':
      return 'No blocked callers loaded';
    case 'spam':
      return 'No spam callers loaded';
    default:
      return 'No caller flags loaded';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asRecord(entry));
}

export function CallerFlagsModerationPage({ visible, vm }: CallerFlagsModerationPageProps) {
  if (!visible) return null;

  const { toText, invokeAction, runAction, busyAction } = selectScriptStudioPageVm(vm);

  const [flags, setFlags] = useState<Array<Record<string, unknown>>>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
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
  const pulseTone = controlsBusy ? 'info' : flags.length === 0 ? 'neutral' : 'warning';
  const pulseStatus = controlsBusy ? 'Updating' : flags.length === 0 ? 'Ready to review' : 'Monitoring';
  const pulseDescription = controlsBusy
    ? `Running ${requestState.activeActionLabel || 'caller flag update'}.`
    : 'Review the bot-backed caller policy, filter by decision, and apply allow, block, or spam updates.';
  const visibleFlags = flags.slice(0, 60);
  const hasRows = visibleFlags.length > 0;
  const blockedCount = flags.filter((flag) => toText(flag.status, '').toLowerCase() === 'blocked').length;
  const allowedCount = flags.filter((flag) => toText(flag.status, '').toLowerCase() === 'allowed').length;
  const spamCount = flags.filter((flag) => toText(flag.status, '').toLowerCase() === 'spam').length;

  const loadFlags = async (): Promise<void> => {
    const status = statusFilter === 'all' ? undefined : statusFilter;
    await runInvestigationAction(
      DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_LIST,
      { status, limit: 120 },
      (data) => {
        setFlags(toRows(data.flags));
      },
    );
  };

  useEffect(() => {
    void loadFlags();
  }, [statusFilter]);

  const submitFlagDecision = (status: 'allowed' | 'blocked' | 'spam'): void => {
    const phone = phoneInput.trim();
    const note = noteInput.trim();
    if (!phone) return;
    void runAction(
      DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_UPSERT,
      {
        phone_number: phone,
        status,
        note: note || undefined,
      },
      {
        successMessage: `${statusLabel(status)} decision saved for ${phone}`,
        onSuccess: () => {
          setPhoneInput('');
          setNoteInput('');
          void loadFlags();
        },
      },
    );
  };

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Inbound Screening</p>
        <h2 className="va-page-title">Caller Flags</h2>
        <p className="va-muted">Review the same caller screening flow the bot exposes and update inbound allow, block, or spam decisions from a standard admin workspace.</p>
        <div className="va-page-intro-meta" aria-label="Caller flag screening summary">
          <UiBadge variant={pulseTone === 'warning' ? 'info' : pulseTone === 'neutral' ? 'meta' : pulseTone}>
            {pulseStatus}
          </UiBadge>
          <UiBadge variant="meta">Bot-backed policy</UiBadge>
          <UiBadge variant="info">{statusLabel(statusFilter)}</UiBadge>
          <UiBadge variant="meta">{flags.length} loaded</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Keep inbound screening deliberate: review the current caller posture, then apply allow, block, or spam
          decisions with the same source of truth used by the bot.
        </p>
      </section>

      <UiWorkspacePulse
        title="Caller screening"
        description={pulseDescription}
        status={pulseStatus}
        tone={pulseTone}
        items={[
          { label: 'Loaded', value: flags.length },
          { label: 'Scope', value: statusLabel(statusFilter) },
          { label: 'Blocked', value: blockedCount },
          { label: 'Allowed', value: allowedCount },
          { label: 'Spam', value: spamCount },
          { label: 'Action state', value: controlsBusy ? 'Busy' : 'Ready' },
        ]}
      />

      <section className="va-grid">
        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Caller policy decisions</h3>
              <p className="va-muted">Use the current screening view to inspect callers, then record the next safe decision.</p>
            </div>
            <UiBadge variant={hasRows ? 'warning' : 'meta'}>
              {hasRows ? `${visibleFlags.length} visible` : 'Ready to review'}
            </UiBadge>
          </div>
          <UiActionBar
            title="Mirror the bot caller-flags workflow"
            description="List current caller decisions, then apply Allow, Block, or Spam to one phone number with an optional note."
            actions={(
              <UiButton variant="secondary" disabled={controlsBusy} onClick={() => { void loadFlags(); }}>
                Refresh Flags
              </UiButton>
            )}
          />
          <div className="va-inline-tools">
            <UiSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All callers</option>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
              <option value="spam">Spam</option>
            </UiSelect>
          </div>
          <p className="va-muted">
            Source of truth: this list reflects the same caller-flags store used by the bot. The mini app is an admin frontend for that workflow, not a separate rules engine.
          </p>
          <div className="va-inline-tools">
            <UiInput
              placeholder="Caller number (+1555...)"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
            />
            <UiInput
              placeholder="Decision note (optional)"
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
            />
            <UiButton
              variant="primary"
              disabled={controlsBusy || !phoneInput.trim()}
              onClick={() => {
                submitFlagDecision('allowed');
              }}
            >
              Allow
            </UiButton>
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !phoneInput.trim()}
              onClick={() => {
                submitFlagDecision('blocked');
              }}
            >
              Block
            </UiButton>
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !phoneInput.trim()}
              onClick={() => {
                submitFlagDecision('spam');
              }}
            >
              Mark Spam
            </UiButton>
          </div>
          {hasRows ? (
            <UiDisclosure
              title={`${statusLabel(statusFilter)} records`}
              subtitle={`Showing ${visibleFlags.length} caller decisions from the current screening view.`}
            >
              <ul className="va-list va-list-dense">
                {visibleFlags.map((flag, index) => (
                  <li key={`caller-flag-row-${index}`}>
                    <strong>{toText(flag.phone_number, 'n/a')}</strong>
                    <span>{statusLabel(toText(flag.status, 'unknown'))}</span>
                    <span>{toText(flag.note, 'No note')}</span>
                    <span>{toText(flag.updated_at, 'Unknown update')}</span>
                  </li>
                ))}
              </ul>
            </UiDisclosure>
          ) : (
            <UiSurfaceState
              cardTone="subcard"
              compact
              eyebrow="Caller screening"
              status="No rows"
              title={emptyStateLabel(statusFilter)}
              description={`Refresh the ${statusLabel(statusFilter).toLowerCase()} view or add a caller decision to populate this list.`}
            />
          )}
        </UiCard>
      </section>

      {investigationError ? (
        <section className="va-grid">
          <UiSurfaceState
            eyebrow="Caller screening"
            status="Action failed"
            statusVariant="error"
            title="Caller flags action failed"
            description={investigationError}
            tone="error"
          />
        </section>
      ) : null}
    </>
  );
}
