import { useMemo, useState } from 'react';

import { buildModuleRequestState } from './moduleRequestState';
import type { CallLogRow, DashboardVm } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectOpsPageVm } from './vmSelectors';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';
import {
  UiBadge,
  UiButton,
  UiCard,
  UiInput,
  UiStatePanel,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';

type CallLogExplorerPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function CallLogExplorerPage({ visible, vm }: CallLogExplorerPageProps) {
  if (!visible) return null;

  const {
    busyAction,
    invokeAction,
    toText,
    toInt,
    formatTime,
    callLogs,
    callLogsTotal,
    loading,
  } = selectOpsPageVm(vm);

  const [query, setQuery] = useState<string>('');
  const [callSid, setCallSid] = useState<string>('');
  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [detailsSid, setDetailsSid] = useState<string>('');
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [eventsSid, setEventsSid] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
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
  const error = validationError || investigationError;

  const recentStates = useMemo(() => events.slice(0, 12), [events]);
  const activeSid = callSid.trim();
  const hasDetails = Boolean(details) && detailsSid === activeSid;
  const hasEvents = recentStates.length > 0 && eventsSid === activeSid;
  const loadedRowsCount = rows.length > 0 ? rows.length : callLogs.length;

  const loadRows = async (): Promise<void> => {
    setValidationError('');
    const trimmed = query.trim();
    const action = trimmed.length >= 2
      ? DASHBOARD_ACTION_CONTRACTS.CALLS_SEARCH
      : DASHBOARD_ACTION_CONTRACTS.CALLS_LIST;
    const payload = trimmed.length >= 2
      ? { query: trimmed, limit: 20 }
      : { limit: 20, offset: 0 };
    await runInvestigationAction(action, payload, (data) => {
      const nextRows = Array.isArray(data.results)
        ? data.results as CallLogRow[]
        : Array.isArray(data.rows)
          ? data.rows as CallLogRow[]
          : [];
      setRows(nextRows);
      if (nextRows.length > 0 && !activeSid) {
        const firstSid = toText(nextRows[0]?.call_sid, '');
        if (firstSid) setCallSid(firstSid);
      }
    });
  };

  const loadDetails = async (): Promise<void> => {
    const targetSid = callSid.trim();
    if (!targetSid) {
      setValidationError('Provide a call SID before loading details.');
      return;
    }
    setValidationError('');
    await runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.CALLS_GET, { call_sid: targetSid }, (data) => {
      const nextDetails = data.call && typeof data.call === 'object' && !Array.isArray(data.call)
        ? data.call as Record<string, unknown>
        : data;
      setDetails(nextDetails);
      setDetailsSid(targetSid);
    });
  };

  const loadEvents = async (): Promise<void> => {
    const targetSid = callSid.trim();
    if (!targetSid) {
      setValidationError('Provide a call SID before loading events.');
      return;
    }
    setValidationError('');
    await runInvestigationAction(DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS, { call_sid: targetSid }, (data) => {
      setEvents(Array.isArray(data.recent_states) ? data.recent_states.map(asRecord) : []);
      setEventsSid(targetSid);
    });
  };

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Operations</p>
        <h2 className="va-page-title">Call Log Explorer</h2>
        <p className="va-muted">Search and inspect call records, state transitions, and runtime details.</p>
        <div className="va-page-intro-meta">
          <UiBadge variant={error ? 'error' : controlsBusy || loading ? 'info' : activeSid ? 'success' : 'warning'}>
            {error ? 'Needs attention' : controlsBusy || loading ? 'Working' : activeSid ? 'Ready' : 'Needs input'}
          </UiBadge>
          <UiBadge variant="meta">Call tracing</UiBadge>
          <UiBadge variant="info">{loadedRowsCount} loaded</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Use one workspace to locate a call, inspect its snapshot, and review recent state changes
          before escalating deeper runtime issues.
        </p>
      </section>

      <UiWorkspacePulse
        title="Call log workspace"
        description={error
          ? error
          : controlsBusy
            ? activeActionLabel ? `${activeActionLabel} is in progress.` : 'Call log requests are in progress.'
            : loading && rows.length === 0 && callLogs.length === 0
              ? 'Syncing latest call records and explorer metadata.'
              : activeSid
                ? 'Search results, details, and recent states stay in one place for faster call tracing.'
                : 'Load recent calls or search by SID, number, or status to start an investigation.'}
        status={error ? 'Needs attention' : controlsBusy || loading ? 'Working' : activeSid ? 'Ready' : 'Needs input'}
        tone={error ? 'error' : controlsBusy || loading ? 'info' : activeSid ? 'success' : 'warning'}
        items={[
          { label: 'Loaded rows', value: loadedRowsCount },
          { label: 'Recent logs', value: callLogsTotal },
          { label: 'Details', value: hasDetails ? 'Loaded' : activeSid ? 'Pending' : 'Not selected' },
          { label: 'Events', value: hasEvents ? 'Loaded' : activeSid ? 'Pending' : 'Not selected' },
        ]}
      />

      {(loading && rows.length === 0 && callLogs.length === 0) || error || controlsBusy ? (
        <div className="va-status-state-stack">
          {loading && rows.length === 0 && callLogs.length === 0 ? (
            <UiSurfaceState
              eyebrow="Explorer sync"
              status="Loading"
              statusVariant="info"
              title="Loading call telemetry"
              description="Syncing latest call records and explorer metadata."
              tone="info"
              compact
            />
          ) : null}
          {controlsBusy ? (
            <UiSurfaceState
              eyebrow="Explorer state"
              status="In progress"
              statusVariant="info"
              title="Call explorer request is running"
              description={`Running ${activeActionLabel || 'request'}...`}
              tone="info"
              compact
            />
          ) : null}
          {error ? (
            <UiSurfaceState
              eyebrow="Explorer state"
              status="Needs attention"
              statusVariant="error"
              title="Call explorer needs attention"
              description={error}
              tone="error"
              compact
            />
          ) : null}
        </div>
      ) : null}

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Search & Inspect</h3>
          <p className="va-muted">Find a call by SID/number, then inspect its snapshot and timeline.</p>
        </header>
        <section className="va-grid">
          <UiCard className="va-investigation-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Call Search</h3>
              <p className="va-muted">Search by SID, phone number, or status to start a faster investigation.</p>
            </div>
            <UiBadge variant={rows.length > 0 ? 'success' : 'info'}>
              {rows.length > 0 ? `${rows.length} rows` : 'Lookup ready'}
            </UiBadge>
          </div>
          <div className="va-inline-tools">
            <UiInput
              value={query}
              placeholder="Search by call SID, phone, or status"
              onChange={(event) => setQuery(event.target.value)}
            />
            <UiButton
              variant="secondary"
              disabled={controlsBusy}
              onClick={() => { void loadRows(); }}
            >
              {query.trim().length >= 2 ? 'Search' : 'Load Recent'}
            </UiButton>
          </div>
          {rows.length === 0 ? (
            <UiStatePanel
              compact
              title="No call rows loaded"
              description={query.trim().length >= 2
                ? `No calls matched "${query.trim()}".`
                : 'Run a search or load recent calls to populate this list.'}
            />
          ) : (
            <ul className="va-native-list">
              {rows.slice(0, 16).map((row, index) => {
                const rowSid = toText(row.call_sid, `call-${index + 1}`);
                const selected = rowSid === callSid.trim();
                const status = toText(row.status_normalized, toText(row.status, 'unknown'));
                return (
                  <li key={`call-log-explorer-row-${rowSid}-${index}`} className="va-native-list-row">
                    <div className="va-native-list-head">
                      <UiButton
                        variant="chip"
                        className={selected ? 'is-active' : ''}
                        onClick={() => setCallSid(rowSid)}
                      >
                        {rowSid}
                      </UiButton>
                      <span className="va-native-list-value">{status}</span>
                    </div>
                    <div className="va-native-list-meta">
                      <span>Number {toText(row.phone_number, 'n/a')}</span>
                      <span>{formatTime(row.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </UiCard>

          <UiCard className="va-investigation-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Call Detail</h3>
              <p className="va-muted">Load the selected call snapshot and timeline from the same operational surface.</p>
            </div>
            <UiBadge variant={hasDetails || hasEvents ? 'success' : activeSid ? 'warning' : 'info'}>
              {hasDetails || hasEvents ? 'Loaded' : activeSid ? 'Pending' : 'No SID'}
            </UiBadge>
          </div>
          {!callSid.trim() ? (
            <UiStatePanel
              compact
              title="No call SID selected"
              description="Select a call row or enter a call SID to inspect details and events."
              tone="warning"
            />
          ) : null}
          <div className="va-inline-tools">
            <UiInput
              value={callSid}
              placeholder="Call SID"
              onChange={(event) => setCallSid(event.target.value)}
            />
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !callSid.trim()}
              onClick={() => { void loadDetails(); }}
            >
              Details
            </UiButton>
            <UiButton
              variant="secondary"
              disabled={controlsBusy || !callSid.trim()}
              onClick={() => { void loadEvents(); }}
            >
              Events
            </UiButton>
          </div>
          {hasDetails ? (
            <ul className="va-native-list">
              <li className="va-native-list-row">
                <div className="va-native-list-head">
                  <strong>Call SID</strong>
                  <span className="va-native-list-value">{toText(details?.call_sid, activeSid || 'n/a')}</span>
                </div>
              </li>
              <li className="va-native-list-row">
                <div className="va-native-list-head">
                  <strong>Status</strong>
                  <span className="va-native-list-value">{toText(details?.status, 'unknown')}</span>
                </div>
              </li>
              <li className="va-native-list-row">
                <div className="va-native-list-head">
                  <strong>Phone</strong>
                  <span className="va-native-list-value">{toText(details?.phone_number, 'n/a')}</span>
                </div>
              </li>
              <li className="va-native-list-row">
                <div className="va-native-list-head">
                  <strong>Duration</strong>
                  <span className="va-native-list-value">{toInt(details?.duration)}s</span>
                </div>
              </li>
              <li className="va-native-list-row">
                <div className="va-native-list-head">
                  <strong>Started</strong>
                  <span className="va-native-list-value">{formatTime(details?.created_at)}</span>
                </div>
              </li>
              <li className="va-native-list-row">
                <div className="va-native-list-head">
                  <strong>Summary</strong>
                  <span className="va-native-list-value">{toText(details?.call_summary, 'n/a')}</span>
                </div>
              </li>
            </ul>
          ) : (
            <UiStatePanel
              compact
              title="No call details loaded"
              description="Enter or select a call SID, then request details."
            />
          )}
          <h4>Recent States</h4>
          <p className="va-muted">Loaded timeline events: <strong>{recentStates.length}</strong></p>
          {!hasEvents ? (
            <UiStatePanel
              compact
              title="No events loaded"
              description={activeSid
                ? 'Request call events to inspect the latest state timeline.'
                : 'Select or enter a call SID, then request events.'}
            />
          ) : (
            <ul className="va-native-list">
              {recentStates.map((state, index) => (
                <li key={`call-log-explorer-state-${index}`} className="va-native-list-row">
                  <div className="va-native-list-head">
                    <strong>{toText(state.state, 'event')}</strong>
                    <span className="va-native-list-value">{formatTime(state.timestamp)}</span>
                  </div>
                  <div className="va-native-list-meta">
                    <span>Source {toText(state.source, 'runtime')}</span>
                    <span>Reason {toText(state.reason, 'n/a')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </UiCard>
        </section>
      </section>

      <section className="va-section-block">
        <header className="va-section-header">
          <h3 className="va-section-title">Recent Call Logs</h3>
          <p className="va-muted">Operational feed of latest persisted call records.</p>
        </header>
        <section className="va-grid">
          <UiCard className="va-investigation-card">
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Recent Call Logs</h3>
              <p className="va-muted">Review the latest persisted records before jumping into a deeper trace.</p>
            </div>
            <UiBadge variant={callLogs.length > 0 ? 'success' : 'info'}>
              {callLogs.length > 0 ? `${callLogs.length} visible` : 'Feed idle'}
            </UiBadge>
          </div>
          <p>Showing <strong>{callLogs.length}</strong> of <strong>{callLogsTotal}</strong> calls.</p>
          {callLogs.length === 0 ? (
            <UiStatePanel
              compact
              title="No recent calls available"
              description="Call logs will appear here once data is synced."
            />
          ) : (
            <ul className="va-native-list">
              {callLogs.slice(0, 12).map((row: CallLogRow, index: number) => {
                const rowSid = toText(row.call_sid, `call-${index + 1}`);
                const rowStatus = toText(row.status_normalized, toText(row.status, 'unknown'));
                return (
                  <li key={`recent-call-log-${rowSid}-${index}`} className="va-native-list-row">
                    <div className="va-native-list-head">
                      <strong>{rowSid}</strong>
                      <span className="va-native-list-value">{rowStatus}</span>
                    </div>
                    <div className="va-native-list-meta">
                      <span>Number {toText(row.phone_number, 'n/a')}</span>
                      <span>{formatTime(row.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </UiCard>
        </section>
      </section>
    </>
  );
}
