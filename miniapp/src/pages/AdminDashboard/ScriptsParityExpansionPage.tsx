import { useEffect, useMemo, useState } from 'react';
import { Cell, Navigation } from '@telegram-apps/telegram-ui';

import { buildModuleRequestState } from './moduleRequestState';
import type { DashboardVm } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectScriptStudioPageVm } from './vmSelectors';
import { Link } from '@/components/Link/Link.tsx';
import { DashboardWorkflowContractCard } from '@/components/admin-dashboard/DashboardWorkflowContractCard';
import { useDashboardHaptic } from '@/hooks/admin-dashboard/useDashboardHaptic';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiInput,
  UiSelect,
  UiStatePanel,
  UiTextarea,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import {
  DASHBOARD_ACTION_CONTRACTS,
  DASHBOARD_MODULE_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
} from '@/contracts/miniappParityContracts';

type ScriptsParityExpansionPageProps = {
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

type EmailTemplateRow = {
  template_id?: unknown;
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  lifecycle_state?: unknown;
};

type GovernanceVersionRow = {
  version?: unknown;
  reason?: unknown;
  created_by?: unknown;
  created_at?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asRecord(entry));
}

function toLifecycleBadgeVariant(value: unknown): 'meta' | 'info' | 'success' | 'warning' | 'error' {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase()
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim().toLowerCase()
      : '';
  if (!normalized) return 'meta';
  if (normalized.includes('active') || normalized.includes('ready') || normalized.includes('published')) {
    return 'success';
  }
  if (normalized.includes('review') || normalized.includes('submitted') || normalized.includes('pending')) {
    return 'warning';
  }
  if (normalized.includes('error') || normalized.includes('fail') || normalized.includes('blocked')) {
    return 'error';
  }
  return 'info';
}

function toStatePanelTone(value: unknown): 'info' | 'success' | 'warning' | 'error' {
  const badgeVariant = toLifecycleBadgeVariant(value);
  if (badgeVariant === 'meta') return 'info';
  return badgeVariant;
}

function normalizeLifecycleState(value: unknown, fallback = 'draft'): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || fallback;
}

function toVersionNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

export function ScriptsParityExpansionPage({ visible, vm }: ScriptsParityExpansionPageProps) {
  if (!visible) return null;

  const { triggerHaptic } = useDashboardHaptic();

  const { toText, invokeAction, runAction, busyAction } = selectScriptStudioPageVm(vm);

  const [smsScripts, setSmsScripts] = useState<SmsScriptRow[]>([]);
  const [selectedSmsScriptName, setSelectedSmsScriptName] = useState<string>('');
  const [smsScriptDescriptionInput, setSmsScriptDescriptionInput] = useState<string>('');
  const [smsScriptContentInput, setSmsScriptContentInput] = useState<string>('');
  const [smsScriptCreateName, setSmsScriptCreateName] = useState<string>('');
  const [smsScriptCreateContent, setSmsScriptCreateContent] = useState<string>('');
  const [smsScriptReviewNoteInput, setSmsScriptReviewNoteInput] = useState<string>('');
  const [smsScriptSimulationVariablesInput, setSmsScriptSimulationVariablesInput] = useState<string>('');
  const [smsScriptSimulationResult, setSmsScriptSimulationResult] = useState<Record<string, unknown> | null>(null);
  const [smsScriptVersions, setSmsScriptVersions] = useState<GovernanceVersionRow[]>([]);
  const [smsScriptDiffFromVersion, setSmsScriptDiffFromVersion] = useState<string>('');
  const [smsScriptDiffToVersion, setSmsScriptDiffToVersion] = useState<string>('');
  const [smsScriptDiffResult, setSmsScriptDiffResult] = useState<Record<string, unknown> | null>(null);
  const [smsScriptRollbackVersion, setSmsScriptRollbackVersion] = useState<string>('');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRow[]>([]);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>('');
  const [emailTemplateSubjectInput, setEmailTemplateSubjectInput] = useState<string>('');
  const [emailTemplateHtmlInput, setEmailTemplateHtmlInput] = useState<string>('');
  const [emailTemplateTextInput, setEmailTemplateTextInput] = useState<string>('');
  const [emailTemplateCreateId, setEmailTemplateCreateId] = useState<string>('');
  const [emailTemplateCreateSubject, setEmailTemplateCreateSubject] = useState<string>('');
  const [emailTemplateCreateText, setEmailTemplateCreateText] = useState<string>('');
  const [emailTemplateReviewNoteInput, setEmailTemplateReviewNoteInput] = useState<string>('');
  const [emailTemplateSimulationVariablesInput, setEmailTemplateSimulationVariablesInput] = useState<string>('');
  const [emailTemplateSimulationResult, setEmailTemplateSimulationResult] = useState<Record<string, unknown> | null>(null);
  const [emailTemplateVersions, setEmailTemplateVersions] = useState<GovernanceVersionRow[]>([]);
  const [emailTemplateDiffFromVersion, setEmailTemplateDiffFromVersion] = useState<string>('');
  const [emailTemplateDiffToVersion, setEmailTemplateDiffToVersion] = useState<string>('');
  const [emailTemplateDiffResult, setEmailTemplateDiffResult] = useState<Record<string, unknown> | null>(null);
  const [emailTemplateRollbackVersion, setEmailTemplateRollbackVersion] = useState<string>('');
  const [localValidationError, setLocalValidationError] = useState<string>('');
  const {
    investigationBusy,
    investigationError,
    runInvestigationAction,
  } = useInvestigationAction(invokeAction);
  const requestState = buildModuleRequestState({
    busyAction,
    secondaryBusyAction: investigationBusy,
  });
  const actionError = localValidationError || investigationError;
  const controlsBusy = requestState.isBusy;
  const activeAction = requestState.activeActionLabel;
  const pulseTone = actionError
    ? 'error'
    : controlsBusy
      ? 'info'
      : selectedSmsScriptName || selectedEmailTemplateId
        ? 'success'
        : 'neutral';
  const pulseStatus = actionError
    ? 'Needs attention'
    : controlsBusy
      ? activeAction || 'Refreshing'
      : selectedSmsScriptName || selectedEmailTemplateId
        ? 'Editing'
        : 'Ready';

  const selectedSmsScript = useMemo(() => (
    smsScripts.find((script) => toText(script.name, '') === selectedSmsScriptName) || null
  ), [selectedSmsScriptName, smsScripts, toText]);

  const selectedEmailTemplate = useMemo(() => (
    emailTemplates.find((template) => toText(template.template_id, '') === selectedEmailTemplateId) || null
  ), [emailTemplates, selectedEmailTemplateId, toText]);

  const selectedSmsScriptLifecycleState = normalizeLifecycleState(selectedSmsScript?.lifecycle_state, selectedSmsScript?.is_builtin === true ? 'builtin' : 'draft');
  const selectedEmailTemplateLifecycleState = normalizeLifecycleState(selectedEmailTemplate?.lifecycle_state, 'draft');

  useEffect(() => {
    if (!selectedSmsScript) return;
    setSmsScriptDescriptionInput(toText(selectedSmsScript.description, ''));
    setSmsScriptContentInput(toText(selectedSmsScript.content, ''));
    setSmsScriptReviewNoteInput('');
    setSmsScriptSimulationVariablesInput('');
    setSmsScriptSimulationResult(null);
    setSmsScriptVersions([]);
    setSmsScriptDiffFromVersion('');
    setSmsScriptDiffToVersion('');
    setSmsScriptDiffResult(null);
    setSmsScriptRollbackVersion('');
    setLocalValidationError('');
  }, [selectedSmsScript, toText]);

  useEffect(() => {
    if (!selectedEmailTemplate) return;
    setEmailTemplateSubjectInput(toText(selectedEmailTemplate.subject, ''));
    setEmailTemplateHtmlInput(toText(selectedEmailTemplate.html, ''));
    setEmailTemplateTextInput(toText(selectedEmailTemplate.text, ''));
    setEmailTemplateReviewNoteInput('');
    setEmailTemplateSimulationVariablesInput('');
    setEmailTemplateSimulationResult(null);
    setEmailTemplateVersions([]);
    setEmailTemplateDiffFromVersion('');
    setEmailTemplateDiffToVersion('');
    setEmailTemplateDiffResult(null);
    setEmailTemplateRollbackVersion('');
    setLocalValidationError('');
  }, [selectedEmailTemplate, toText]);

  const parseVariablesInput = (rawValue: string, label: string): Record<string, unknown> | null => {
    const trimmed = rawValue.trim();
    setLocalValidationError('');
    if (!trimmed) return {};
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setLocalValidationError(`${label} variables must be a JSON object.`);
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      setLocalValidationError(`${label} variables JSON is invalid.`);
      return null;
    }
  };

  const loadSmsScriptVersions = async (): Promise<void> => {
    if (!selectedSmsScriptName || selectedSmsScript?.is_builtin === true) return;
    setLocalValidationError('');
    await runInvestigationAction(
      DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_VERSIONS,
      { script_name: selectedSmsScriptName },
      (data) => {
        const rows = toRows(data.versions) as GovernanceVersionRow[];
        setSmsScriptVersions(rows);
        const [latestVersion] = rows;
        const latestValue = latestVersion ? String(toVersionNumber(latestVersion.version)) : '';
        setSmsScriptRollbackVersion(latestValue);
        setSmsScriptDiffFromVersion(latestValue);
        setSmsScriptDiffToVersion(rows.length > 1 ? String(toVersionNumber(rows[1].version)) : latestValue);
      },
    );
  };

  const loadEmailTemplateVersions = async (): Promise<void> => {
    if (!selectedEmailTemplateId) return;
    setLocalValidationError('');
    await runInvestigationAction(
      DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_VERSIONS,
      { template_id: selectedEmailTemplateId },
      (data) => {
        const rows = toRows(data.versions) as GovernanceVersionRow[];
        setEmailTemplateVersions(rows);
        const [latestVersion] = rows;
        const latestValue = latestVersion ? String(toVersionNumber(latestVersion.version)) : '';
        setEmailTemplateRollbackVersion(latestValue);
        setEmailTemplateDiffFromVersion(latestValue);
        setEmailTemplateDiffToVersion(rows.length > 1 ? String(toVersionNumber(rows[1].version)) : latestValue);
      },
    );
  };

  const loadSmsScripts = async (): Promise<void> => {
    await runInvestigationAction(
      DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_LIST,
      {
        include_builtins: true,
        detailed: true,
      },
      (data) => {
        const customRows = toRows(data.scripts);
        const builtinRows = toRows(data.builtin);
        const merged = [...customRows, ...builtinRows] as SmsScriptRow[];
        setSmsScripts(merged);
        setSelectedSmsScriptName((current) => {
          if (merged.length === 0) return '';
          const currentExists = merged.some((script) => toText(script.name, '') === current);
          return currentExists ? current : toText(merged[0].name, '');
        });
      },
    );
  };

  const loadEmailTemplates = async (): Promise<void> => {
    await runInvestigationAction(
      DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_LIST,
      { limit: 120 },
      (data) => {
        const rows = toRows(data.templates) as EmailTemplateRow[];
        setEmailTemplates(rows);
        setSelectedEmailTemplateId((current) => {
          if (rows.length === 0) return '';
          const currentExists = rows.some((template) => toText(template.template_id, '') === current);
          return currentExists ? current : toText(rows[0].template_id, '');
        });
      },
    );
  };

  useEffect(() => {
    void loadSmsScripts();
    void loadEmailTemplates();
  }, []);

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Content</p>
        <h2 className="va-page-title">Message Lanes</h2>
        <p className="va-muted">Focus on the SMS and email lanes of Script Designer without leaving the broader scripts workspace.</p>
        <div className="va-page-intro-meta">
          <UiBadge variant={pulseTone === 'neutral' ? 'meta' : pulseTone}>{pulseStatus}</UiBadge>
          <UiBadge variant="meta">Focused content editing</UiBadge>
          <UiBadge variant="info">{smsScripts.length + emailTemplates.length} assets</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Stay in a narrower message-editing lane for SMS scripts and email templates while keeping
          the broader Script Designer one move away.
        </p>
      </section>
      <UiWorkspacePulse
        title="Workspace pulse"
        description="Keep content sync, active selections, and editing readiness visible at a glance."
        tone={pulseTone}
        status={pulseStatus}
        items={[
          { label: 'SMS scripts', value: smsScripts.length },
          { label: 'Email templates', value: emailTemplates.length },
          { label: 'Selected script', value: selectedSmsScriptName || 'None' },
          { label: 'Selected template', value: selectedEmailTemplateId || 'None' },
        ]}
      />

      <DashboardWorkflowContractCard moduleId="scriptsparity" />
      <UiCard>
        <div className="va-ops-card-header">
          <div className="va-ops-card-headline">
            <h3>Focused lane launcher</h3>
            <p className="va-muted">
              Use this page when you want a narrower editor for SMS scripts and email templates while keeping the main Script Designer one tap away.
            </p>
          </div>
          <UiBadge variant="info">Two lanes</UiBadge>
        </div>
        <Link to={MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS}>
          <Cell
            subtitle="Open the scripts overview before moving between designer lanes or broader script tasks."
            after={<Navigation>Open</Navigation>}
          >
            Scripts overview
          </Cell>
        </Link>
        <Link to={DASHBOARD_MODULE_ROUTE_CONTRACTS.content}>
          <Cell
            subtitle="Return to the full Script Designer for call scripts or to switch between all three editing lanes."
            after={<Navigation>Open</Navigation>}
          >
            Script Designer
          </Cell>
        </Link>
      </UiCard>
      <UiDisclosure
        title="Workspace coverage"
        subtitle="Keep this focused message editor explicit without hiding the broader scripts lifecycle."
      >
        <UiStatePanel
          compact
          tone="success"
          title="Available here now"
          description="Refresh, inspect, create, update, review, simulate, promote, diff, and rollback SMS scripts and email templates while preserving the active message lane context."
        />
        <UiStatePanel
          compact
          tone="info"
          title="Continue in broader scripts workflow"
          description="Clone flows, SMS preview delivery, and the broader scripts handoff still continue in the wider scripts workflow when operators need a guided console path."
        />
      </UiDisclosure>

      <section className="va-grid">
        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>SMS Scripts</h3>
              <p className="va-muted">Create, update, and maintain SMS script assets.</p>
            </div>
            <UiBadge variant={selectedSmsScriptName ? 'success' : 'info'}>
              {selectedSmsScriptName ? 'Editor active' : 'Select script'}
            </UiBadge>
          </div>
          <div className="va-inline-tools">
            <UiButton
              variant="secondary"
              disabled={controlsBusy}
              onClick={() => {
                triggerHaptic('impact', 'light');
                void loadSmsScripts();
              }}
            >
              Refresh SMS Scripts
            </UiButton>
            <UiInput
              placeholder="Create script name"
              value={smsScriptCreateName}
              onChange={(event) => setSmsScriptCreateName(event.target.value)}
            />
          </div>
          <UiTextarea
            placeholder="Create script content"
            value={smsScriptCreateContent}
            onChange={(event) => setSmsScriptCreateContent(event.target.value)}
            rows={3}
          />
          <div className="va-inline-tools">
            <UiButton
              variant="primary"
              disabled={controlsBusy || !smsScriptCreateName.trim() || !smsScriptCreateContent.trim()}
              onClick={() => {
                void runAction(
                  DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_CREATE,
                  {
                    name: smsScriptCreateName.trim(),
                    content: smsScriptCreateContent,
                  },
                  {
                    successMessage: `Created SMS script "${smsScriptCreateName.trim()}"`,
                    onSuccess: () => {
                      setSmsScriptCreateName('');
                      setSmsScriptCreateContent('');
                      void loadSmsScripts();
                    },
                  },
                );
              }}
            >
              Create SMS Script
            </UiButton>
          </div>
          {smsScripts.length === 0 ? (
            <UiStatePanel
              compact
              title="No SMS scripts found"
              description="Create a script or refresh to pull latest content."
            />
          ) : (
            <ul className="va-list va-list-dense">
              {smsScripts.slice(0, 40).map((script, index) => {
              const scriptName = toText(script.name, `sms-script-${index + 1}`);
              const builtin = script.is_builtin === true;
              const active = scriptName === selectedSmsScriptName;
              return (
                <li key={`scripts-parity-sms-${scriptName}`}>
                  <strong>{scriptName}</strong>
                  <span>
                    <UiBadge variant={toLifecycleBadgeVariant(script.lifecycle_state)}>
                      Lifecycle {toText(script.lifecycle_state, builtin ? 'builtin' : 'draft')}
                    </UiBadge>
                  </span>
                  <span>
                    <UiBadge variant={builtin ? 'info' : 'meta'}>
                      {builtin ? 'Built-in (read-only)' : 'Custom'}
                    </UiBadge>
                  </span>
                  <UiButton
                    variant="chip"
                    className={active ? 'is-active' : ''}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedSmsScriptName(scriptName);
                    }}
                  >
                    {active ? 'Selected' : 'Select'}
                  </UiButton>
                </li>
              );
              })}
            </ul>
          )}
          {selectedSmsScript ? (
            <>
              <h4>SMS Script Editor</h4>
              <UiStatePanel
                compact
                tone={selectedSmsScript.is_builtin === true ? 'info' : toStatePanelTone(selectedSmsScriptLifecycleState)}
                title={`Editing ${selectedSmsScriptName}`}
                description={selectedSmsScript.is_builtin === true
                  ? 'Built-in scripts stay read-only. Governance actions only apply to custom scripts.'
                  : `Lifecycle state: ${selectedSmsScriptLifecycleState}. Save changes, route review, simulate content, or recover a prior version without leaving this page.`}
              />
              {selectedSmsScript.is_builtin === true ? (
                <UiStatePanel
                  compact
                  title="Read-only built-in script"
                  description="Clone this script into a custom script if you need to modify content."
                  tone="info"
                />
              ) : null}
              <UiInput value={selectedSmsScriptName} disabled />
              <UiTextarea
                placeholder="Description"
                value={smsScriptDescriptionInput}
                onChange={(event) => setSmsScriptDescriptionInput(event.target.value)}
                rows={2}
                disabled={selectedSmsScript.is_builtin === true}
              />
              <UiTextarea
                placeholder="SMS script content"
                value={smsScriptContentInput}
                onChange={(event) => setSmsScriptContentInput(event.target.value)}
                rows={4}
                disabled={selectedSmsScript.is_builtin === true}
              />
              <UiTextarea
                placeholder="Review note / approval reason"
                value={smsScriptReviewNoteInput}
                onChange={(event) => setSmsScriptReviewNoteInput(event.target.value)}
                rows={2}
                disabled={selectedSmsScript.is_builtin === true}
              />
              <UiActionBar
                title={controlsBusy ? 'SMS script action in progress' : 'SMS script ready'}
                description={selectedSmsScript.is_builtin === true
                  ? 'Built-in scripts are read-only. Create a custom script to make edits.'
                  : 'Save content changes, route review, or recover a prior version from this focused lane.'}
                actions={(
                  <>
                    <UiButton
                      variant="primary"
                      disabled={controlsBusy || selectedSmsScript.is_builtin === true || !selectedSmsScriptName}
                      onClick={() => {
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_UPDATE,
                          {
                            script_name: selectedSmsScriptName,
                            description: smsScriptDescriptionInput,
                            content: smsScriptContentInput,
                          },
                          {
                            successMessage: `Updated SMS script "${selectedSmsScriptName}"`,
                            onSuccess: () => {
                              void loadSmsScripts();
                            },
                          },
                        );
                      }}
                    >
                      Save SMS Script
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || selectedSmsScript.is_builtin === true || !selectedSmsScriptName}
                      onClick={() => {
                        setLocalValidationError('');
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_SUBMIT_REVIEW,
                          { script_name: selectedSmsScriptName },
                          {
                            successMessage: `Submitted "${selectedSmsScriptName}" for review`,
                            onSuccess: () => {
                              void loadSmsScripts();
                            },
                          },
                        );
                      }}
                    >
                      Submit Review
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || selectedSmsScript.is_builtin === true || !selectedSmsScriptName}
                      onClick={() => {
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_DELETE,
                          { script_name: selectedSmsScriptName },
                          {
                            confirmText: `Delete SMS script "${selectedSmsScriptName}"?`,
                            successMessage: `Deleted SMS script "${selectedSmsScriptName}"`,
                            onSuccess: () => {
                              void loadSmsScripts();
                            },
                          },
                        );
                      }}
                    >
                      Delete SMS Script
                    </UiButton>
                  </>
                )}
              />
              {selectedSmsScript.is_builtin === true ? null : (
                <>
                  <div className="va-inline-tools">
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || !selectedSmsScriptName}
                      onClick={() => {
                        setLocalValidationError('');
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_REVIEW,
                          {
                            script_name: selectedSmsScriptName,
                            decision: 'approve',
                            note: smsScriptReviewNoteInput,
                          },
                          {
                            successMessage: `Approved "${selectedSmsScriptName}"`,
                            onSuccess: () => {
                              void loadSmsScripts();
                            },
                          },
                        );
                      }}
                    >
                      Approve
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || !selectedSmsScriptName}
                      onClick={() => {
                        setLocalValidationError('');
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_REVIEW,
                          {
                            script_name: selectedSmsScriptName,
                            decision: 'reject',
                            note: smsScriptReviewNoteInput,
                          },
                          {
                            successMessage: `Returned "${selectedSmsScriptName}" to draft`,
                            onSuccess: () => {
                              void loadSmsScripts();
                            },
                          },
                        );
                      }}
                    >
                      Reject
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || !selectedSmsScriptName}
                      onClick={() => {
                        setLocalValidationError('');
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_PROMOTE_LIVE,
                          { script_name: selectedSmsScriptName },
                          {
                            successMessage: `Promoted "${selectedSmsScriptName}" live`,
                            onSuccess: () => {
                              void loadSmsScripts();
                            },
                          },
                        );
                      }}
                    >
                      Promote Live
                    </UiButton>
                  </div>
                  <UiDisclosure
                    title="Simulation and recovery"
                    subtitle="Use variables, inspect rendered output, compare versions, and rollback when the current draft drifts."
                    tone={smsScriptSimulationResult || smsScriptDiffResult ? 'success' : 'neutral'}
                  >
                    <UiTextarea
                      placeholder={'Variables JSON, e.g. {"customer_name":"Ada"}'}
                      value={smsScriptSimulationVariablesInput}
                      onChange={(event) => setSmsScriptSimulationVariablesInput(event.target.value)}
                      rows={3}
                    />
                    <div className="va-inline-tools">
                      <UiButton
                        variant="secondary"
                        disabled={controlsBusy || !selectedSmsScriptName}
                        onClick={() => {
                          const variables = parseVariablesInput(smsScriptSimulationVariablesInput, 'SMS script');
                          if (variables === null) return;
                          void runInvestigationAction(
                            DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_SIMULATE,
                            { script_name: selectedSmsScriptName, variables },
                            (data) => {
                              setSmsScriptSimulationResult(asRecord(data.simulation));
                            },
                          );
                        }}
                      >
                        Run Simulation
                      </UiButton>
                      <UiButton
                        variant="secondary"
                        disabled={controlsBusy || !selectedSmsScriptName}
                        onClick={() => {
                          void loadSmsScriptVersions();
                        }}
                      >
                        Load Versions
                      </UiButton>
                    </div>
                    {smsScriptSimulationResult ? (
                      <pre>{JSON.stringify(smsScriptSimulationResult, null, 2)}</pre>
                    ) : (
                      <UiStatePanel
                        compact
                        title="No simulation output yet"
                        description="Run a simulation to inspect missing variables and the resolved SMS content."
                        tone="info"
                      />
                    )}
                    {smsScriptVersions.length > 0 ? (
                      <>
                        <ul className="va-list va-list-dense">
                          {smsScriptVersions.slice(0, 6).map((version) => {
                            const versionNumber = toVersionNumber(version.version);
                            return (
                              <li key={`sms-version-${versionNumber}`}>
                                <strong>{`v${versionNumber}`}</strong>
                                <span>{toText(version.reason, 'unknown reason')}</span>
                                <span>{toText(version.created_at, 'Unknown time')}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="va-inline-tools">
                          <UiSelect
                            value={smsScriptDiffFromVersion}
                            onChange={(event) => setSmsScriptDiffFromVersion(event.target.value)}
                          >
                            <option value="">Diff from version</option>
                            {smsScriptVersions.map((version) => {
                              const versionNumber = toVersionNumber(version.version);
                              return (
                                <option key={`sms-diff-from-${versionNumber}`} value={String(versionNumber)}>
                                  {`v${versionNumber}`}
                                </option>
                              );
                            })}
                          </UiSelect>
                          <UiSelect
                            value={smsScriptDiffToVersion}
                            onChange={(event) => setSmsScriptDiffToVersion(event.target.value)}
                          >
                            <option value="">Diff to version</option>
                            {smsScriptVersions.map((version) => {
                              const versionNumber = toVersionNumber(version.version);
                              return (
                                <option key={`sms-diff-to-${versionNumber}`} value={String(versionNumber)}>
                                  {`v${versionNumber}`}
                                </option>
                              );
                            })}
                          </UiSelect>
                          <UiButton
                            variant="secondary"
                            disabled={controlsBusy || !smsScriptDiffFromVersion || !smsScriptDiffToVersion}
                            onClick={() => {
                              setLocalValidationError('');
                              void runInvestigationAction(
                                DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_DIFF,
                                {
                                  script_name: selectedSmsScriptName,
                                  from_version: Number(smsScriptDiffFromVersion),
                                  to_version: Number(smsScriptDiffToVersion),
                                },
                                (data) => {
                                  setSmsScriptDiffResult(asRecord(data));
                                },
                              );
                            }}
                          >
                            Compare Versions
                          </UiButton>
                        </div>
                        <div className="va-inline-tools">
                          <UiSelect
                            value={smsScriptRollbackVersion}
                            onChange={(event) => setSmsScriptRollbackVersion(event.target.value)}
                          >
                            <option value="">Rollback target</option>
                            {smsScriptVersions.map((version) => {
                              const versionNumber = toVersionNumber(version.version);
                              return (
                                <option key={`sms-rollback-${versionNumber}`} value={String(versionNumber)}>
                                  {`v${versionNumber}`}
                                </option>
                              );
                            })}
                          </UiSelect>
                          <UiButton
                            variant="secondary"
                            disabled={controlsBusy || !smsScriptRollbackVersion}
                            onClick={() => {
                              setLocalValidationError('');
                              void runAction(
                                DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_ROLLBACK,
                                {
                                  script_name: selectedSmsScriptName,
                                  version: Number(smsScriptRollbackVersion),
                                },
                                {
                                  confirmText: `Rollback "${selectedSmsScriptName}" to v${smsScriptRollbackVersion}?`,
                                  successMessage: `Rolled back "${selectedSmsScriptName}" to v${smsScriptRollbackVersion}`,
                                  onSuccess: () => {
                                    void loadSmsScripts();
                                    void loadSmsScriptVersions();
                                  },
                                },
                              );
                            }}
                          >
                            Rollback
                          </UiButton>
                        </div>
                        {smsScriptDiffResult ? <pre>{JSON.stringify(smsScriptDiffResult, null, 2)}</pre> : null}
                      </>
                    ) : null}
                  </UiDisclosure>
                </>
              )}
            </>
          ) : null}
        </UiCard>

        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Email Templates</h3>
              <p className="va-muted">Create and maintain reusable email templates.</p>
            </div>
            <UiBadge variant={selectedEmailTemplateId ? 'success' : 'info'}>
              {selectedEmailTemplateId ? 'Editor active' : 'Select template'}
            </UiBadge>
          </div>
          <div className="va-inline-tools">
            <UiButton variant="secondary" disabled={controlsBusy} onClick={() => {
              triggerHaptic('impact', 'light');
              void loadEmailTemplates();
            }}>
              Refresh Templates
            </UiButton>
            <UiInput
              placeholder="Create template ID"
              value={emailTemplateCreateId}
              onChange={(event) => setEmailTemplateCreateId(event.target.value)}
            />
          </div>
          <UiInput
            placeholder="Create subject"
            value={emailTemplateCreateSubject}
            onChange={(event) => setEmailTemplateCreateSubject(event.target.value)}
          />
          <UiTextarea
            placeholder="Create plain-text body"
            value={emailTemplateCreateText}
            onChange={(event) => setEmailTemplateCreateText(event.target.value)}
            rows={3}
          />
          <UiButton
            variant="primary"
            disabled={
              controlsBusy
              || !emailTemplateCreateId.trim()
              || !emailTemplateCreateSubject.trim()
              || !emailTemplateCreateText.trim()
            }
            onClick={() => {
              void runAction(
                DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_CREATE,
                {
                  template_id: emailTemplateCreateId.trim(),
                  subject: emailTemplateCreateSubject.trim(),
                  text: emailTemplateCreateText,
                },
                {
                  successMessage: `Created template "${emailTemplateCreateId.trim()}"`,
                  onSuccess: () => {
                    setEmailTemplateCreateId('');
                    setEmailTemplateCreateSubject('');
                    setEmailTemplateCreateText('');
                    void loadEmailTemplates();
                  },
                },
              );
            }}
          >
            Create Template
          </UiButton>
          {emailTemplates.length === 0 ? (
            <UiStatePanel
              compact
              title="No templates found"
              description="Create a template or refresh to pull latest templates."
            />
          ) : (
            <ul className="va-list va-list-dense">
              {emailTemplates.slice(0, 40).map((template, index) => {
              const templateId = toText(template.template_id, `template-${index + 1}`);
              const active = templateId === selectedEmailTemplateId;
              return (
                <li key={`scripts-parity-email-${templateId}`}>
                  <strong>{templateId}</strong>
                  <span>
                    <UiBadge variant={toLifecycleBadgeVariant(template.lifecycle_state)}>
                      {toText(template.lifecycle_state, 'draft')}
                    </UiBadge>
                  </span>
                  <UiButton
                    variant="chip"
                    className={active ? 'is-active' : ''}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedEmailTemplateId(templateId);
                    }}
                  >
                    {active ? 'Selected' : 'Select'}
                  </UiButton>
                </li>
              );
              })}
            </ul>
          )}
          {selectedEmailTemplate ? (
            <>
              <h4>Email Template Editor</h4>
              <UiStatePanel
                compact
                tone={toStatePanelTone(selectedEmailTemplateLifecycleState)}
                title={`Editing ${selectedEmailTemplateId}`}
                description={`Lifecycle state: ${selectedEmailTemplateLifecycleState}. Save changes, route review, simulate render output, or recover a prior version without leaving this lane.`}
              />
              <UiInput value={selectedEmailTemplateId} disabled />
              <UiInput
                placeholder="Subject"
                value={emailTemplateSubjectInput}
                onChange={(event) => setEmailTemplateSubjectInput(event.target.value)}
              />
              <UiTextarea
                placeholder="HTML"
                value={emailTemplateHtmlInput}
                onChange={(event) => setEmailTemplateHtmlInput(event.target.value)}
                rows={3}
              />
              <UiTextarea
                placeholder="Text"
                value={emailTemplateTextInput}
                onChange={(event) => setEmailTemplateTextInput(event.target.value)}
                rows={3}
              />
              <UiTextarea
                placeholder="Review note / approval reason"
                value={emailTemplateReviewNoteInput}
                onChange={(event) => setEmailTemplateReviewNoteInput(event.target.value)}
                rows={2}
              />
              <UiActionBar
                title={controlsBusy ? 'Template action in progress' : 'Template ready'}
                description="Save subject/body changes, route review, or recover a prior template version once the current revision is confirmed."
                actions={(
                  <>
                    <UiButton
                      variant="primary"
                      disabled={controlsBusy || !selectedEmailTemplateId}
                      onClick={() => {
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_UPDATE,
                          {
                            template_id: selectedEmailTemplateId,
                            subject: emailTemplateSubjectInput,
                            html: emailTemplateHtmlInput,
                            text: emailTemplateTextInput,
                          },
                          {
                            successMessage: `Updated template "${selectedEmailTemplateId}"`,
                            onSuccess: () => {
                              void loadEmailTemplates();
                            },
                          },
                        );
                      }}
                    >
                      Save Template
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || !selectedEmailTemplateId}
                      onClick={() => {
                        setLocalValidationError('');
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_SUBMIT_REVIEW,
                          { template_id: selectedEmailTemplateId },
                          {
                            successMessage: `Submitted template "${selectedEmailTemplateId}" for review`,
                            onSuccess: () => {
                              void loadEmailTemplates();
                            },
                          },
                        );
                      }}
                    >
                      Submit Review
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={controlsBusy || !selectedEmailTemplateId}
                      onClick={() => {
                        void runAction(
                          DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_DELETE,
                          { template_id: selectedEmailTemplateId },
                          {
                            confirmText: `Delete template "${selectedEmailTemplateId}"?`,
                            successMessage: `Deleted template "${selectedEmailTemplateId}"`,
                            onSuccess: () => {
                              void loadEmailTemplates();
                            },
                          },
                        );
                      }}
                    >
                      Delete Template
                    </UiButton>
                  </>
                )}
              />
              <div className="va-inline-tools">
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !selectedEmailTemplateId}
                  onClick={() => {
                    setLocalValidationError('');
                    void runAction(
                      DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_REVIEW,
                      {
                        template_id: selectedEmailTemplateId,
                        decision: 'approve',
                        note: emailTemplateReviewNoteInput,
                      },
                      {
                        successMessage: `Approved template "${selectedEmailTemplateId}"`,
                        onSuccess: () => {
                          void loadEmailTemplates();
                        },
                      },
                    );
                  }}
                >
                  Approve
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !selectedEmailTemplateId}
                  onClick={() => {
                    setLocalValidationError('');
                    void runAction(
                      DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_REVIEW,
                      {
                        template_id: selectedEmailTemplateId,
                        decision: 'reject',
                        note: emailTemplateReviewNoteInput,
                      },
                      {
                        successMessage: `Returned template "${selectedEmailTemplateId}" to draft`,
                        onSuccess: () => {
                          void loadEmailTemplates();
                        },
                      },
                    );
                  }}
                >
                  Reject
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={controlsBusy || !selectedEmailTemplateId}
                  onClick={() => {
                    setLocalValidationError('');
                    void runAction(
                      DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_PROMOTE_LIVE,
                      { template_id: selectedEmailTemplateId },
                      {
                        successMessage: `Promoted template "${selectedEmailTemplateId}" live`,
                        onSuccess: () => {
                          void loadEmailTemplates();
                        },
                      },
                    );
                  }}
                >
                  Promote Live
                </UiButton>
              </div>
              <UiDisclosure
                title="Simulation and recovery"
                subtitle="Use variables, inspect rendered output, compare versions, and rollback when the current template drifts."
                tone={emailTemplateSimulationResult || emailTemplateDiffResult ? 'success' : 'neutral'}
              >
                <UiTextarea
                  placeholder={'Variables JSON, e.g. {"customer_name":"Ada"}'}
                  value={emailTemplateSimulationVariablesInput}
                  onChange={(event) => setEmailTemplateSimulationVariablesInput(event.target.value)}
                  rows={3}
                />
                <div className="va-inline-tools">
                  <UiButton
                    variant="secondary"
                    disabled={controlsBusy || !selectedEmailTemplateId}
                    onClick={() => {
                      const variables = parseVariablesInput(emailTemplateSimulationVariablesInput, 'Email template');
                      if (variables === null) return;
                      void runInvestigationAction(
                        DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_SIMULATE,
                        { template_id: selectedEmailTemplateId, variables },
                        (data) => {
                          setEmailTemplateSimulationResult(asRecord(data.simulation));
                        },
                      );
                    }}
                  >
                    Run Simulation
                  </UiButton>
                  <UiButton
                    variant="secondary"
                    disabled={controlsBusy || !selectedEmailTemplateId}
                    onClick={() => {
                      void loadEmailTemplateVersions();
                    }}
                  >
                    Load Versions
                  </UiButton>
                </div>
                {emailTemplateSimulationResult ? (
                  <pre>{JSON.stringify(emailTemplateSimulationResult, null, 2)}</pre>
                ) : (
                  <UiStatePanel
                    compact
                    title="No simulation output yet"
                    description="Run a simulation to inspect required variables and the rendered subject or body."
                    tone="info"
                  />
                )}
                {emailTemplateVersions.length > 0 ? (
                  <>
                    <ul className="va-list va-list-dense">
                      {emailTemplateVersions.slice(0, 6).map((version) => {
                        const versionNumber = toVersionNumber(version.version);
                        return (
                          <li key={`email-version-${versionNumber}`}>
                            <strong>{`v${versionNumber}`}</strong>
                            <span>{toText(version.reason, 'unknown reason')}</span>
                            <span>{toText(version.created_at, 'Unknown time')}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="va-inline-tools">
                      <UiSelect
                        value={emailTemplateDiffFromVersion}
                        onChange={(event) => setEmailTemplateDiffFromVersion(event.target.value)}
                      >
                        <option value="">Diff from version</option>
                        {emailTemplateVersions.map((version) => {
                          const versionNumber = toVersionNumber(version.version);
                          return (
                            <option key={`email-diff-from-${versionNumber}`} value={String(versionNumber)}>
                              {`v${versionNumber}`}
                            </option>
                          );
                        })}
                      </UiSelect>
                      <UiSelect
                        value={emailTemplateDiffToVersion}
                        onChange={(event) => setEmailTemplateDiffToVersion(event.target.value)}
                      >
                        <option value="">Diff to version</option>
                        {emailTemplateVersions.map((version) => {
                          const versionNumber = toVersionNumber(version.version);
                          return (
                            <option key={`email-diff-to-${versionNumber}`} value={String(versionNumber)}>
                              {`v${versionNumber}`}
                            </option>
                          );
                        })}
                      </UiSelect>
                      <UiButton
                        variant="secondary"
                        disabled={controlsBusy || !emailTemplateDiffFromVersion || !emailTemplateDiffToVersion}
                        onClick={() => {
                          setLocalValidationError('');
                          void runInvestigationAction(
                            DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_DIFF,
                            {
                              template_id: selectedEmailTemplateId,
                              from_version: Number(emailTemplateDiffFromVersion),
                              to_version: Number(emailTemplateDiffToVersion),
                            },
                            (data) => {
                              setEmailTemplateDiffResult(asRecord(data));
                            },
                          );
                        }}
                      >
                        Compare Versions
                      </UiButton>
                    </div>
                    <div className="va-inline-tools">
                      <UiSelect
                        value={emailTemplateRollbackVersion}
                        onChange={(event) => setEmailTemplateRollbackVersion(event.target.value)}
                      >
                        <option value="">Rollback target</option>
                        {emailTemplateVersions.map((version) => {
                          const versionNumber = toVersionNumber(version.version);
                          return (
                            <option key={`email-rollback-${versionNumber}`} value={String(versionNumber)}>
                              {`v${versionNumber}`}
                            </option>
                          );
                        })}
                      </UiSelect>
                      <UiButton
                        variant="secondary"
                        disabled={controlsBusy || !emailTemplateRollbackVersion}
                        onClick={() => {
                          setLocalValidationError('');
                          void runAction(
                            DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_ROLLBACK,
                            {
                              template_id: selectedEmailTemplateId,
                              version: Number(emailTemplateRollbackVersion),
                            },
                            {
                              confirmText: `Rollback template "${selectedEmailTemplateId}" to v${emailTemplateRollbackVersion}?`,
                              successMessage: `Rolled back template "${selectedEmailTemplateId}" to v${emailTemplateRollbackVersion}`,
                              onSuccess: () => {
                                void loadEmailTemplates();
                                void loadEmailTemplateVersions();
                              },
                            },
                          );
                        }}
                      >
                        Rollback
                      </UiButton>
                    </div>
                    {emailTemplateDiffResult ? <pre>{JSON.stringify(emailTemplateDiffResult, null, 2)}</pre> : null}
                  </>
                ) : null}
              </UiDisclosure>
            </>
          ) : null}
        </UiCard>
      </section>

      {controlsBusy ? (
        <section className="va-grid">
          <UiCard>
            <UiStatePanel
              compact
              title="Request in progress"
              description={`Running ${activeAction || 'request'}...`}
            />
          </UiCard>
        </section>
      ) : null}

      {actionError ? (
        <section className="va-grid">
          <UiCard>
            <UiStatePanel
              title="Message template action failed"
              description={actionError}
              tone="error"
            />
          </UiCard>
        </section>
      ) : null}
    </>
  );
}
