import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';

import type { AuditRow, DashboardVm, IncidentRow, RunbookRow } from './types';
import { selectAuditIncidentsPageVm } from './vmSelectors';
import {
  selectAuditFilterOptionsMemoized,
  selectAuditRowsMemoized,
  selectIncidentFilterOptionsMemoized,
  selectIncidentRowsMemoized,
} from './tableSelectors';
import { downloadCsv } from './csvExport';
import { DashboardWorkflowContractCard } from '@/components/admin-dashboard/DashboardWorkflowContractCard';
import {
  UiBadge,
  UiButton,
  UiCard,
  UiInput,
  UiSelect,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';
import { isDashboardActionSupported, resolveDashboardActionId } from '@/services/admin-dashboard/dashboardActionGuards';

type AuditIncidentsPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

const PAGE_SIZE_OPTIONS = [10, 20, 40] as const;
const SAVED_QUERY_STORAGE_KEY = 'voxly-miniapp-audit-saved-queries';
const AUDIT_VIEW_PREFS_STORAGE_KEY = 'voxly-miniapp-audit-view-prefs';

type SavedQuery = {
  id: string;
  label: string;
  incidentQuery: string;
  incidentStatus: string;
  actor: string;
  module: string;
  severity: string;
  auditQuery: string;
  auditActor: string;
  auditModule: string;
  auditSeverity: string;
};

type AuditViewPrefs = {
  incident_query?: unknown;
  incident_status?: unknown;
  incident_actor?: unknown;
  incident_module?: unknown;
  incident_severity?: unknown;
  incident_page_size?: unknown;
  audit_query?: unknown;
  audit_actor?: unknown;
  audit_module?: unknown;
  audit_severity?: unknown;
  audit_page_size?: unknown;
};

function statusBadgeVariant(status: string): 'success' | 'info' | 'error' | 'meta' {
  const normalized = status.toLowerCase();
  if (normalized === 'ok' || normalized === 'healthy' || normalized === 'success') return 'success';
  if (normalized === 'warning' || normalized === 'degraded' || normalized === 'pending') return 'info';
  if (normalized === 'error' || normalized === 'failed' || normalized === 'critical') return 'error';
  return 'meta';
}

function isTypingTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function AuditIncidentsPage({ visible, vm }: AuditIncidentsPageProps) {
  if (!visible) return null;

  const {
    refreshAuditModule,
    hasCapability,
    isFeatureEnabled,
    runbookAction,
    incidentsPayload,
    incidentRows,
    toInt,
    toText,
    asRecord,
    formatTime,
    runbookRows,
    busyAction,
    auditRows,
  } = selectAuditIncidentsPageVm(vm);
  const advancedTablesEnabled = isFeatureEnabled('advanced_tables', true);
  const runbookActionsEnabled = isFeatureEnabled('runbook_actions', true);
  const incidentCsvEnabled = isFeatureEnabled('incidents_csv_export', advancedTablesEnabled);
  const auditCsvEnabled = isFeatureEnabled('audit_csv_export', advancedTablesEnabled);
  const [incidentQuery, setIncidentQuery] = useState<string>('');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>('all');
  const [incidentActorFilter, setIncidentActorFilter] = useState<string>('all');
  const [incidentModuleFilter, setIncidentModuleFilter] = useState<string>('all');
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState<string>('all');
  const [incidentPage, setIncidentPage] = useState<number>(1);
  const [incidentPageSize, setIncidentPageSize] = useState<number>(20);
  const [auditQuery, setAuditQuery] = useState<string>('');
  const [auditActorFilter, setAuditActorFilter] = useState<string>('all');
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('all');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<string>('all');
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number>(20);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const incidentQueryInputRef = useRef<HTMLInputElement | null>(null);
  const refreshAlertsButtonRef = useRef<HTMLButtonElement | null>(null);

  const restoreFocus = (target: HTMLElement | null): void => {
    if (!target || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      if (!target.isConnected) return;
      target.focus({ preventScroll: true });
    });
  };

  const handleRefreshAuditModule = (target: HTMLElement | null = refreshAlertsButtonRef.current): void => {
    void refreshAuditModule().finally(() => {
      restoreFocus(target);
    });
  };

  const handleRunbookAction = (
    action: string,
    payload: Record<string, unknown> = {},
    target?: HTMLButtonElement | null,
  ): void => {
    void runbookAction(action, payload).finally(() => {
      restoreFocus(target ?? null);
    });
  };

  const focusIncidentQueryInput = (): void => {
    const target = incidentQueryInputRef.current;
    if (!target || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      if (!target.isConnected) return;
      target.focus({ preventScroll: true });
      target.select();
    });
  };

  const handleSectionShortcutKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const key = event.key.toLowerCase();
    const typingTarget = isTypingTarget(event.target);
    if (typingTarget && event.altKey && !event.ctrlKey && !event.metaKey && key === 'r') {
      event.preventDefault();
      event.stopPropagation();
      handleRefreshAuditModule(event.target instanceof HTMLElement ? event.target : null);
      return;
    }
    if (typingTarget) return;
    if (key !== '/' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    focusIncidentQueryInput();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(AUDIT_VIEW_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AuditViewPrefs | null;
      if (!parsed || typeof parsed !== 'object') return;
      setIncidentQuery(typeof parsed.incident_query === 'string' ? parsed.incident_query : '');
      setIncidentStatusFilter(typeof parsed.incident_status === 'string' ? parsed.incident_status : 'all');
      setIncidentActorFilter(typeof parsed.incident_actor === 'string' ? parsed.incident_actor : 'all');
      setIncidentModuleFilter(typeof parsed.incident_module === 'string' ? parsed.incident_module : 'all');
      setIncidentSeverityFilter(typeof parsed.incident_severity === 'string' ? parsed.incident_severity : 'all');
      const incidentPageSizeValue = Number(parsed.incident_page_size);
      if (PAGE_SIZE_OPTIONS.includes(incidentPageSizeValue as (typeof PAGE_SIZE_OPTIONS)[number])) {
        setIncidentPageSize(incidentPageSizeValue);
      }
      setAuditQuery(typeof parsed.audit_query === 'string' ? parsed.audit_query : '');
      setAuditActorFilter(typeof parsed.audit_actor === 'string' ? parsed.audit_actor : 'all');
      setAuditModuleFilter(typeof parsed.audit_module === 'string' ? parsed.audit_module : 'all');
      setAuditSeverityFilter(typeof parsed.audit_severity === 'string' ? parsed.audit_severity : 'all');
      const auditPageSizeValue = Number(parsed.audit_page_size);
      if (PAGE_SIZE_OPTIONS.includes(auditPageSizeValue as (typeof PAGE_SIZE_OPTIONS)[number])) {
        setAuditPageSize(auditPageSizeValue);
      }
    } catch {
      // Ignore malformed persisted audit-view state.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      incident_query: incidentQuery,
      incident_status: incidentStatusFilter,
      incident_actor: incidentActorFilter,
      incident_module: incidentModuleFilter,
      incident_severity: incidentSeverityFilter,
      incident_page_size: incidentPageSize,
      audit_query: auditQuery,
      audit_actor: auditActorFilter,
      audit_module: auditModuleFilter,
      audit_severity: auditSeverityFilter,
      audit_page_size: auditPageSize,
    };
    try {
      window.localStorage.setItem(AUDIT_VIEW_PREFS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore local storage failures in constrained clients.
    }
  }, [
    auditActorFilter,
    auditModuleFilter,
    auditPageSize,
    auditQuery,
    auditSeverityFilter,
    incidentActorFilter,
    incidentModuleFilter,
    incidentPageSize,
    incidentQuery,
    incidentSeverityFilter,
    incidentStatusFilter,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SAVED_QUERY_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const rows = parsed
        .map((entry) => asRecord(entry))
        .map((entry) => ({
          id: toText(entry.id, `${Date.now()}`),
          label: toText(entry.label, 'Saved query'),
          incidentQuery: toText(entry.incidentQuery, ''),
          incidentStatus: toText(entry.incidentStatus, 'all'),
          actor: toText(entry.actor, 'all'),
          module: toText(entry.module, 'all'),
          severity: toText(entry.severity, 'all'),
          auditQuery: toText(entry.auditQuery, ''),
          auditActor: toText(entry.auditActor, 'all'),
          auditModule: toText(entry.auditModule, 'all'),
          auditSeverity: toText(entry.auditSeverity, 'all'),
        }));
      setSavedQueries(rows);
    } catch {
      setSavedQueries([]);
    }
  }, [asRecord, toText]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SAVED_QUERY_STORAGE_KEY, JSON.stringify(savedQueries.slice(0, 8)));
    } catch {
      // Ignore local storage failures in constrained clients.
    }
  }, [savedQueries]);

  const {
    statusOptions: incidentStatusOptions,
    actorOptions: incidentActorOptions,
    moduleOptions: incidentModuleOptions,
    severityOptions: incidentSeverityOptions,
  } = selectIncidentFilterOptionsMemoized({
    incidentRows,
    asRecord,
    toText,
  });

  const filteredIncidentRows = selectIncidentRowsMemoized({
    incidentRows,
    query: incidentQuery,
    statusFilter: incidentStatusFilter,
    actorFilter: incidentActorFilter,
    moduleFilter: incidentModuleFilter,
    severityFilter: incidentSeverityFilter,
    asRecord,
    toText,
  });

  const filteredAuditRows = selectAuditRowsMemoized({
    auditRows,
    query: auditQuery,
    actorFilter: auditActorFilter,
    moduleFilter: auditModuleFilter,
    severityFilter: auditSeverityFilter,
    asRecord,
    toText,
  });
  const {
    actorOptions: auditActorOptions,
    moduleOptions: auditModuleOptions,
    severityOptions: auditSeverityOptions,
  } = selectAuditFilterOptionsMemoized({
    auditRows,
    asRecord,
    toText,
  });

  const incidentTotalPages = Math.max(1, Math.ceil(filteredIncidentRows.length / incidentPageSize));
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditRows.length / auditPageSize));
  useEffect(() => {
    if (incidentPage > incidentTotalPages) setIncidentPage(incidentTotalPages);
  }, [incidentPage, incidentTotalPages]);
  useEffect(() => {
    if (auditPage > auditTotalPages) setAuditPage(auditTotalPages);
  }, [auditPage, auditTotalPages]);
  useEffect(() => {
    setIncidentPage(1);
  }, [incidentActorFilter, incidentModuleFilter, incidentQuery, incidentSeverityFilter, incidentStatusFilter, incidentPageSize]);
  useEffect(() => {
    setAuditPage(1);
  }, [auditActorFilter, auditModuleFilter, auditQuery, auditSeverityFilter, auditPageSize]);

  const effectiveIncidentPageSize = advancedTablesEnabled ? incidentPageSize : 30;
  const effectiveIncidentPage = advancedTablesEnabled ? incidentPage : 1;
  const incidentStart = (effectiveIncidentPage - 1) * effectiveIncidentPageSize;
  const incidentPageRows = filteredIncidentRows.slice(incidentStart, incidentStart + effectiveIncidentPageSize);
  const incidentRangeStart = filteredIncidentRows.length === 0 ? 0 : incidentStart + 1;
  const incidentRangeEnd = Math.min(filteredIncidentRows.length, incidentStart + incidentPageRows.length);
  const effectiveAuditPageSize = advancedTablesEnabled ? auditPageSize : 40;
  const effectiveAuditPage = advancedTablesEnabled ? auditPage : 1;
  const auditStart = (effectiveAuditPage - 1) * effectiveAuditPageSize;
  const auditPageRows = filteredAuditRows.slice(auditStart, auditStart + effectiveAuditPageSize);
  const auditRangeStart = filteredAuditRows.length === 0 ? 0 : auditStart + 1;
  const auditRangeEnd = Math.min(filteredAuditRows.length, auditStart + auditPageRows.length);
  const exportIncidentCsv = (): void => {
    const rows = filteredIncidentRows.map((incident) => [
      toText(incident.service_name, 'service'),
      toText(incident.status, 'unknown'),
      toText(asRecord(incident.details).message, toText(incident.details, '')),
      formatTime(incident.timestamp),
    ]);
    downloadCsv('miniapp-incidents.csv', ['service_name', 'status', 'message', 'timestamp'], rows);
  };
  const exportAuditCsv = (): void => {
    const rows = filteredAuditRows.map((row) => [
      toText(row.service_name, 'service'),
      toText(row.status, 'unknown'),
      toText(asRecord(row.details).message, toText(row.details, '')),
      formatTime(row.timestamp),
    ]);
    downloadCsv('miniapp-audit-feed.csv', ['service_name', 'status', 'message', 'timestamp'], rows);
  };
  const saveCurrentQuery = (): void => {
    const label = `${incidentStatusFilter}/${incidentSeverityFilter} @ ${new Date().toLocaleTimeString()}`;
    const entry: SavedQuery = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      incidentQuery,
      incidentStatus: incidentStatusFilter,
      actor: incidentActorFilter,
      module: incidentModuleFilter,
      severity: incidentSeverityFilter,
      auditQuery,
      auditActor: auditActorFilter,
      auditModule: auditModuleFilter,
      auditSeverity: auditSeverityFilter,
    };
    setSavedQueries((prev) => [entry, ...prev].slice(0, 8));
  };
  const applySavedQuery = (entry: SavedQuery): void => {
    setIncidentQuery(entry.incidentQuery);
    setIncidentStatusFilter(entry.incidentStatus || 'all');
    setIncidentActorFilter(entry.actor || 'all');
    setIncidentModuleFilter(entry.module || 'all');
    setIncidentSeverityFilter(entry.severity || 'all');
    setAuditQuery(entry.auditQuery || '');
    setAuditActorFilter(entry.auditActor || 'all');
    setAuditModuleFilter(entry.auditModule || 'all');
    setAuditSeverityFilter(entry.auditSeverity || 'all');
  };
  const deleteSavedQuery = (id: string): void => {
    setSavedQueries((prev) => prev.filter((query) => query.id !== id));
  };
  const hasAnyFilteredRecords = filteredIncidentRows.length > 0 || filteredAuditRows.length > 0;
  const availableRunbooks = runbookRows.filter((runbook) => {
    const action = toText(runbook.action, '');
    const resolvedAction = resolveDashboardActionId(action);
    const capability = toText(runbook.capability, 'dashboard_view');
    return Boolean(action) && isDashboardActionSupported(resolvedAction) && hasCapability(capability);
  }).length;
  const incidentFiltersApplied = incidentQuery.trim().length > 0
    || incidentStatusFilter !== 'all'
    || incidentActorFilter !== 'all'
    || incidentModuleFilter !== 'all'
    || incidentSeverityFilter !== 'all';
  const auditFiltersApplied = auditQuery.trim().length > 0
    || auditActorFilter !== 'all'
    || auditModuleFilter !== 'all'
    || auditSeverityFilter !== 'all';
  const auditPulseTone: 'info' | 'success' | 'warning' = busyAction.length > 0
    ? 'info'
    : hasAnyFilteredRecords
      ? 'success'
      : 'warning';
  const auditPulseStatus = busyAction.length > 0
    ? 'Working'
    : hasAnyFilteredRecords
      ? 'Ready'
      : 'Filtered';
  const auditPulseDescription = busyAction.length > 0
    ? 'A refresh or runbook action is in progress.'
    : hasAnyFilteredRecords
      ? 'Alerts, runbooks, and audit review stay together for fast response and follow-up.'
      : 'No alerts or audit entries match the current filters. Widen filters or refresh the feed.';

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">System Posture</p>
        <h2 className="va-page-title">System Status & Audit</h2>
        <p className="va-muted">
          Mirrors bot-backed health and status posture while keeping alert triage, response actions,
          and audit history together in one workspace.
        </p>
        <div className="va-page-intro-meta" aria-label="System status and audit summary">
          <UiBadge variant={auditPulseTone === 'warning' ? 'info' : auditPulseTone}>
            {auditPulseStatus}
          </UiBadge>
          <UiBadge variant="meta">Incident command center</UiBadge>
          <UiBadge variant="info">{filteredIncidentRows.length} active alerts</UiBadge>
          <UiBadge variant="meta">{filteredAuditRows.length} audit entries</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Use this surface to review live posture first, then move into response actions and audit follow-up without
          leaving the operational context the bot already maintains.
        </p>
      </section>

      <UiWorkspacePulse
        title="Operational posture"
        description={auditPulseDescription}
        status={auditPulseStatus}
        tone={auditPulseTone}
        items={[
          { label: 'Total alerts', value: toInt(incidentsPayload.total_alerts, incidentRows.length) },
          { label: 'Filtered alerts', value: filteredIncidentRows.length },
          { label: 'Audit entries', value: filteredAuditRows.length },
          { label: 'Runbooks ready', value: availableRunbooks },
        ]}
      />

      <DashboardWorkflowContractCard moduleId="audit" />

      {busyAction.length > 0 ? (
        <div className="va-status-state-stack">
          <UiSurfaceState
            eyebrow="Workspace state"
            status="In progress"
            statusVariant="info"
            title="A response action is running"
            description="Status review stays available while the current recovery action completes."
            tone="info"
            compact
          />
        </div>
      ) : null}

      <section className="va-grid" onKeyDownCapture={handleSectionShortcutKeyDown}>
        <UiCard>
        <div className="va-ops-card-header">
          <div className="va-ops-card-headline">
            <h3>System posture and alerts</h3>
            <p className="va-muted">Triage live alerts, trigger recovery runbooks, and keep the current health picture in view.</p>
          </div>
          <UiBadge variant={auditPulseTone === 'warning' ? 'info' : auditPulseTone}>
            {busyAction.length > 0 ? 'Live action running' : `${filteredIncidentRows.length} in scope`}
          </UiBadge>
        </div>
        <div className="va-filter-grid" role="toolbar" aria-label="Audit and incident actions">
          <UiButton
            ref={refreshAlertsButtonRef}
            variant="secondary"
            aria-keyshortcuts="Alt+R"
            onClick={(event) => {
              handleRefreshAuditModule(event.currentTarget);
            }}
          >
            Refresh Status
          </UiButton>
          <UiButton
            variant="secondary"
            disabled={!hasCapability('users_manage')}
            onClick={(event) => {
              handleRunbookAction(DASHBOARD_ACTION_CONTRACTS.RUNBOOK_SMS_RECONCILE, {}, event.currentTarget);
            }}
          >
            Reconcile SMS
          </UiButton>
          <UiButton
            variant="secondary"
            disabled={!hasCapability('provider_manage')}
            onClick={(event) => {
              handleRunbookAction(DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PAYMENT_RECONCILE, {}, event.currentTarget);
            }}
          >
            Reconcile Payments
          </UiButton>
          <UiButton
            variant="secondary"
            disabled={!hasCapability('provider_manage')}
            onClick={(event) => {
              handleRunbookAction(DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT, {}, event.currentTarget);
            }}
          >
            Provider Preflight
          </UiButton>
          <UiButton
            variant="secondary"
            disabled={!hasCapability('provider_manage')}
            onClick={(event) => {
              handleRunbookAction(DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT, { channel: 'call' }, event.currentTarget);
            }}
          >
            Check Call Provider
          </UiButton>
          <UiButton
            variant="secondary"
            disabled={!hasCapability('users_manage')}
            onClick={(event) => {
              handleRunbookAction(DASHBOARD_ACTION_CONTRACTS.RUNBOOK_SMS_RECONCILE, { scope: 'failure_spike' }, event.currentTarget);
            }}
          >
            Recover SMS Spike
          </UiButton>
        </div>
        <p className="va-muted">
          Data sources: bot-backed /health, admin /status, service health logs, and bridge runbooks.
          This page is the frontend for those operational signals, not a separate incident engine.
        </p>
        {advancedTablesEnabled ? (
          <div className="va-filter-grid">
            <UiInput
              ref={incidentQueryInputRef}
              placeholder="Search service, status, or incident detail"
              value={incidentQuery}
              onChange={(event) => setIncidentQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleRefreshAuditModule(event.currentTarget);
                  return;
                }
                if (event.key === 'Escape' && incidentQuery.length > 0) {
                  event.preventDefault();
                  setIncidentQuery('');
                }
              }}
            />
            <UiSelect
              value={incidentStatusFilter}
              onChange={(event) => setIncidentStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {incidentStatusOptions.map((status) => (
                <option key={`incident-status-${status}`} value={status}>{status}</option>
              ))}
            </UiSelect>
            <UiSelect
              value={incidentActorFilter}
              onChange={(event) => setIncidentActorFilter(event.target.value)}
            >
              <option value="all">All actors</option>
              {incidentActorOptions.map((actor) => (
                <option key={`incident-actor-${actor}`} value={actor}>{actor}</option>
              ))}
            </UiSelect>
            <UiSelect
              value={incidentModuleFilter}
              onChange={(event) => setIncidentModuleFilter(event.target.value)}
            >
              <option value="all">All modules</option>
              {incidentModuleOptions.map((moduleName) => (
                <option key={`incident-module-${moduleName}`} value={moduleName}>{moduleName}</option>
              ))}
            </UiSelect>
            <UiSelect
              value={incidentSeverityFilter}
              onChange={(event) => setIncidentSeverityFilter(event.target.value)}
            >
              <option value="all">All severities</option>
              {incidentSeverityOptions.map((severity) => (
                <option key={`incident-severity-${severity}`} value={severity}>{severity}</option>
              ))}
            </UiSelect>
            <UiSelect
              value={String(incidentPageSize)}
              onChange={(event) => setIncidentPageSize(toInt(event.target.value, 20))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={`incident-page-size-${size}`} value={size}>{size} / page</option>
              ))}
            </UiSelect>
            {incidentCsvEnabled ? (
              <UiButton variant="secondary" onClick={exportIncidentCsv} disabled={filteredIncidentRows.length === 0}>
                Export Alerts
              </UiButton>
            ) : null}
            <UiButton variant="secondary" onClick={saveCurrentQuery}>
              Save View
            </UiButton>
          </div>
        ) : null}
        {savedQueries.length > 0 ? (
          <div className="va-inline-tools">
            {savedQueries.map((query) => (
              <div key={`saved-query-${query.id}`} className="va-saved-query">
                <UiButton variant="secondary" onClick={() => applySavedQuery(query)}>{query.label}</UiButton>
                <UiButton variant="secondary" onClick={() => deleteSavedQuery(query.id)}>✕</UiButton>
              </div>
            ))}
          </div>
        ) : null}
        <p className="va-muted">
          System alerts: <strong>{toInt(incidentsPayload.total_alerts, incidentRows.length)}</strong>
          {' '}| Filtered: <strong>{filteredIncidentRows.length}</strong>
          {' '}| Showing: <strong>{incidentRangeStart}-{incidentRangeEnd}</strong>
        </p>
        <ul className="va-list">
          {incidentPageRows.map((incident: IncidentRow, index: number) => {
            const details = asRecord(incident.details);
            const status = toText(incident.status, 'unknown');
            const actor = toText(details.actor, 'unknown');
            const moduleName = toText(details.module, 'n/a');
            const severity = toText(details.severity, 'info');
            return (
              <li key={`incident-${incidentStart + index}`} className="va-entity-row">
                <div className="va-entity-head">
                  <strong>{toText(incident.service_name, 'service')}</strong>
                  <UiBadge variant={statusBadgeVariant(status)}>{status}</UiBadge>
                </div>
                <p className="va-entity-message">{toText(details.message, toText(incident.details, ''))}</p>
                <div className="va-entity-meta">
                  <span>Actor: {actor}</span>
                  <span>Module: {moduleName}</span>
                  <span>Severity: {severity}</span>
                  <span>At: {formatTime(incident.timestamp)}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {incidentPageRows.length === 0 ? (
          <UiSurfaceState
            eyebrow="Incident filters"
            status={incidentFiltersApplied ? 'No matches' : 'Awaiting results'}
            statusVariant={incidentFiltersApplied ? 'warning' : 'info'}
            title="No alerts matched this view"
            description={incidentFiltersApplied
              ? 'Widen status, actor, module, or severity filters to restore matching alerts.'
              : 'Refresh status or begin filtering to load the first alert view.'}
            tone={incidentFiltersApplied ? 'warning' : 'info'}
            compact
            cardTone="subcard"
          />
        ) : null}
        {advancedTablesEnabled ? (
          <div className="va-table-pager">
            <UiButton
              variant="secondary"
              onClick={() => setIncidentPage((prev) => Math.max(1, prev - 1))}
              disabled={incidentPage <= 1}
            >
              Previous
            </UiButton>
            <span className="va-muted">Page {incidentPage} of {incidentTotalPages}</span>
            <UiButton
              variant="secondary"
              onClick={() => setIncidentPage((prev) => Math.min(incidentTotalPages, prev + 1))}
              disabled={incidentPage >= incidentTotalPages}
            >
              Next
            </UiButton>
          </div>
        ) : null}
        {runbookActionsEnabled && runbookRows.length > 0 ? (
          <>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Response actions</h3>
                <p className="va-muted">Launch supported runbooks directly from the current alert context.</p>
              </div>
              <UiBadge variant={availableRunbooks > 0 ? 'success' : 'info'}>
                {availableRunbooks > 0 ? `${availableRunbooks} ready` : 'No runbooks'}
              </UiBadge>
            </div>
            <ul className="va-list">
              {runbookRows.map((runbook: RunbookRow, index: number) => {
                const action = toText(runbook.action, '');
                const resolvedAction = resolveDashboardActionId(action);
                const supportedAction = isDashboardActionSupported(resolvedAction);
                const capability = toText(runbook.capability, 'dashboard_view');
                return (
                  <li key={`runbook-${index}`}>
                    <strong>{toText(runbook.label, 'Runbook')}</strong>
                    <span>{resolvedAction || action || 'unknown_action'}</span>
                    <UiButton
                      variant="secondary"
                      disabled={busyAction.length > 0 || !action || !supportedAction || !hasCapability(capability)}
                      onClick={(event) => {
                        handleRunbookAction(resolvedAction || action, {}, event.currentTarget);
                      }}
                    >
                      Run
                    </UiButton>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </UiCard>
      <UiCard>
        <div className="va-ops-card-header">
          <div className="va-ops-card-headline">
            <h3>Audit trail</h3>
            <p className="va-muted">Track who acted, which module changed, and how each response path unfolded.</p>
          </div>
          <UiBadge variant={filteredAuditRows.length > 0 ? 'meta' : 'info'}>
            {filteredAuditRows.length} visible
          </UiBadge>
        </div>
        {advancedTablesEnabled ? (
          <div className="va-filter-grid">
            <UiInput
              placeholder="Search audit entries"
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleRefreshAuditModule(event.currentTarget);
                  return;
                }
                if (event.key === 'Escape' && auditQuery.length > 0) {
                  event.preventDefault();
                  setAuditQuery('');
                }
              }}
            />
            <UiSelect
              value={String(auditPageSize)}
              onChange={(event) => setAuditPageSize(toInt(event.target.value, 20))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={`audit-page-size-${size}`} value={size}>{size} / page</option>
              ))}
            </UiSelect>
            <UiSelect
              value={auditActorFilter}
              onChange={(event) => setAuditActorFilter(event.target.value)}
            >
              <option value="all">Actor: all</option>
              {auditActorOptions.map((actor) => (
                <option key={`audit-actor-${actor}`} value={actor}>{actor}</option>
              ))}
            </UiSelect>
            <UiSelect
              value={auditModuleFilter}
              onChange={(event) => setAuditModuleFilter(event.target.value)}
            >
              <option value="all">Module: all</option>
              {auditModuleOptions.map((moduleName) => (
                <option key={`audit-module-${moduleName}`} value={moduleName}>{moduleName}</option>
              ))}
            </UiSelect>
            <UiSelect
              value={auditSeverityFilter}
              onChange={(event) => setAuditSeverityFilter(event.target.value)}
            >
              <option value="all">Severity: all</option>
              {auditSeverityOptions.map((severity) => (
                <option key={`audit-severity-${severity}`} value={severity}>{severity}</option>
              ))}
            </UiSelect>
            {auditCsvEnabled ? (
              <UiButton variant="secondary" onClick={exportAuditCsv} disabled={filteredAuditRows.length === 0}>
                Export Audit
              </UiButton>
            ) : null}
          </div>
        ) : null}
        <p className="va-muted">
          Filtered: <strong>{filteredAuditRows.length}</strong>
          {' '}| Showing: <strong>{auditRangeStart}-{auditRangeEnd}</strong>
        </p>
        <ul className="va-list">
          {auditPageRows.map((row: AuditRow, index: number) => {
            const details = asRecord(row.details);
            const status = toText(row.status, 'unknown');
            const actor = toText(details.actor, 'unknown');
            const moduleName = toText(details.module, toText(row.service_name, 'n/a'));
            const severity = toText(details.severity, 'info');
            return (
              <li key={`audit-${auditStart + index}`} className="va-entity-row">
                <div className="va-entity-head">
                  <strong>{toText(row.service_name, 'service')}</strong>
                  <UiBadge variant={statusBadgeVariant(status)}>{status}</UiBadge>
                </div>
                <p className="va-entity-message">{toText(details.message, toText(row.details, ''))}</p>
                <div className="va-entity-meta">
                  <span>Actor: {actor}</span>
                  <span>Module: {moduleName}</span>
                  <span>Severity: {severity}</span>
                  <span>At: {formatTime(row.timestamp)}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {auditPageRows.length === 0 ? (
          <UiSurfaceState
            eyebrow="Audit filters"
            status={auditFiltersApplied ? 'No matches' : 'Awaiting results'}
            statusVariant={auditFiltersApplied ? 'warning' : 'info'}
            title="No audit entries matched this view"
            description={auditFiltersApplied
              ? 'Widen actor, module, or severity filters to restore matching audit entries.'
              : 'Refresh status or begin filtering to load the first audit view.'}
            tone={auditFiltersApplied ? 'warning' : 'info'}
            compact
            cardTone="subcard"
          />
        ) : null}
        {advancedTablesEnabled ? (
          <div className="va-table-pager">
            <UiButton
              variant="secondary"
              onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
              disabled={auditPage <= 1}
            >
              Previous
            </UiButton>
            <span className="va-muted">Page {auditPage} of {auditTotalPages}</span>
            <UiButton
              variant="secondary"
              onClick={() => setAuditPage((prev) => Math.min(auditTotalPages, prev + 1))}
              disabled={auditPage >= auditTotalPages}
            >
              Next
            </UiButton>
          </div>
        ) : null}
        </UiCard>
      </section>
    </>
  );
}
