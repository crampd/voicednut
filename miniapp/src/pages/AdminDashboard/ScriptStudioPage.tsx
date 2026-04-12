import { useEffect, useMemo, useState } from 'react';
import { Cell, Navigation } from '@telegram-apps/telegram-ui';

import type { CallScriptRow, DashboardVm } from './types';
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

type ScriptStudioPageProps = {
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

type ScriptStudioLane = 'call' | 'sms' | 'email';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asRecord(entry));
}

function toLifecycleTone(value: unknown): 'info' | 'success' | 'warning' | 'error' {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase()
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim().toLowerCase()
      : '';
  if (!normalized) return 'info';
  if (normalized.includes('live') || normalized.includes('active')) return 'success';
  if (normalized.includes('review') || normalized.includes('submitted') || normalized.includes('pending')) {
    return 'warning';
  }
  if (normalized.includes('reject') || normalized.includes('error') || normalized.includes('blocked')) {
    return 'error';
  }
  return 'info';
}

function toCallerFlagTone(value: unknown): 'info' | 'success' | 'warning' | 'error' {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase()
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim().toLowerCase()
      : '';
  if (!normalized) return 'info';
  if (normalized.includes('allow')) return 'success';
  if (normalized.includes('spam')) return 'warning';
  if (normalized.includes('block')) return 'error';
  return 'info';
}

export function ScriptStudioPage({ visible, vm }: ScriptStudioPageProps) {
  if (!visible) return null;

  const { triggerHaptic } = useDashboardHaptic();

  const {
    scriptFlowFilter,
    setScriptFlowFilter,
    refreshCallScriptsModule,
    callScriptsTotal,
    callScripts,
    toInt,
    toText,
    selectedCallScriptId,
    setSelectedCallScriptId,
    selectedCallScript,
    selectedCallScriptLifecycleState,
    selectedCallScriptLifecycle,
    formatTime,
    scriptNameInput,
    setScriptNameInput,
    scriptDefaultProfileInput,
    setScriptDefaultProfileInput,
    scriptDescriptionInput,
    setScriptDescriptionInput,
    scriptPromptInput,
    setScriptPromptInput,
    scriptFirstMessageInput,
    setScriptFirstMessageInput,
    scriptObjectiveTagsInput,
    setScriptObjectiveTagsInput,
    busyAction,
    saveCallScriptDraft,
    submitCallScriptForReview,
    scriptReviewNoteInput,
    setScriptReviewNoteInput,
    reviewCallScript,
    promoteCallScriptLive,
    scriptSimulationVariablesInput,
    setScriptSimulationVariablesInput,
    simulateCallScript,
    scriptSimulationResult,
    runAction,
    invokeAction,
  } = selectScriptStudioPageVm(vm);

  const [studioBusy, setStudioBusy] = useState<string>('');
  const [studioError, setStudioError] = useState<string>('');
  const [smsScripts, setSmsScripts] = useState<SmsScriptRow[]>([]);
  const [selectedSmsScriptName, setSelectedSmsScriptName] = useState<string>('');
  const [smsScriptDescriptionInput, setSmsScriptDescriptionInput] = useState<string>('');
  const [smsScriptContentInput, setSmsScriptContentInput] = useState<string>('');
  const [smsScriptCreateName, setSmsScriptCreateName] = useState<string>('');
  const [smsScriptCreateContent, setSmsScriptCreateContent] = useState<string>('');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRow[]>([]);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>('');
  const [emailTemplateSubjectInput, setEmailTemplateSubjectInput] = useState<string>('');
  const [emailTemplateHtmlInput, setEmailTemplateHtmlInput] = useState<string>('');
  const [emailTemplateTextInput, setEmailTemplateTextInput] = useState<string>('');
  const [emailTemplateCreateId, setEmailTemplateCreateId] = useState<string>('');
  const [emailTemplateCreateSubject, setEmailTemplateCreateSubject] = useState<string>('');
  const [emailTemplateCreateText, setEmailTemplateCreateText] = useState<string>('');
  const [activeScriptStudioLane, setActiveScriptStudioLane] = useState<ScriptStudioLane>('call');
  const [callerFlags, setCallerFlags] = useState<Array<Record<string, unknown>>>([]);
  const [callerFlagsStatusFilter, setCallerFlagsStatusFilter] = useState<string>('all');
  const [callerFlagPhoneInput, setCallerFlagPhoneInput] = useState<string>('');
  const [callerFlagStatusInput, setCallerFlagStatusInput] = useState<string>('blocked');
  const [callerFlagNoteInput, setCallerFlagNoteInput] = useState<string>('');
  const [personaBuiltin, setPersonaBuiltin] = useState<Array<Record<string, unknown>>>([]);
  const [personaCustom, setPersonaCustom] = useState<Array<Record<string, unknown>>>([]);

  const selectedSmsScript = useMemo(() => (
    smsScripts.find((script) => toText(script.name, '') === selectedSmsScriptName) || null
  ), [selectedSmsScriptName, smsScripts, toText]);
  const selectedEmailTemplate = useMemo(() => (
    emailTemplates.find((template) => toText(template.template_id, '') === selectedEmailTemplateId) || null
  ), [emailTemplates, selectedEmailTemplateId, toText]);

  useEffect(() => {
    if (!selectedSmsScript) return;
    setSmsScriptDescriptionInput(toText(selectedSmsScript.description, ''));
    setSmsScriptContentInput(toText(selectedSmsScript.content, ''));
  }, [selectedSmsScript, toText]);

  useEffect(() => {
    if (!selectedEmailTemplate) return;
    setEmailTemplateSubjectInput(toText(selectedEmailTemplate.subject, ''));
    setEmailTemplateHtmlInput(toText(selectedEmailTemplate.html, ''));
    setEmailTemplateTextInput(toText(selectedEmailTemplate.text, ''));
  }, [selectedEmailTemplate, toText]);

  const executeStudioAction = async (
    action: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    setStudioBusy(action);
    setStudioError('');
    try {
      const data = await invokeAction(action, payload);
      return asRecord(data);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : String(error));
      return {};
    } finally {
      setStudioBusy('');
    }
  };

  const loadSmsScripts = async (): Promise<void> => {
    const data = await executeStudioAction(DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_LIST, {
      include_builtins: true,
      detailed: true,
    });
    const customRows = toRows(data.scripts);
    const builtinRows = toRows(data.builtin);
    const merged = [...customRows, ...builtinRows] as SmsScriptRow[];
    setSmsScripts(merged);
    setSelectedSmsScriptName((current) => {
      if (merged.length === 0) return '';
      const currentExists = merged.some((script) => toText(script.name, '') === current);
      return currentExists ? current : toText(merged[0].name, '');
    });
  };

  const loadEmailTemplates = async (): Promise<void> => {
    const data = await executeStudioAction(DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_LIST, { limit: 120 });
    const rows = toRows(data.templates) as EmailTemplateRow[];
    setEmailTemplates(rows);
    setSelectedEmailTemplateId((current) => {
      if (rows.length === 0) return '';
      const currentExists = rows.some((template) => toText(template.template_id, '') === current);
      return currentExists ? current : toText(rows[0].template_id, '');
    });
  };

  const loadCallerFlags = async (): Promise<void> => {
    const status = callerFlagsStatusFilter === 'all' ? undefined : callerFlagsStatusFilter;
    const data = await executeStudioAction(DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_LIST, {
      status,
      limit: 120,
    });
    setCallerFlags(toRows(data.flags));
  };

  const loadPersonas = async (): Promise<void> => {
    const data = await executeStudioAction(DASHBOARD_ACTION_CONTRACTS.PERSONA_LIST, {});
    setPersonaBuiltin(toRows(data.builtin));
    setPersonaCustom(toRows(data.custom));
  };

  useEffect(() => {
    void loadSmsScripts();
    void loadEmailTemplates();
    void loadCallerFlags();
    void loadPersonas();
  }, []);

  const activeScriptStudioLaneLabel = activeScriptStudioLane === 'call'
    ? 'Call scripts'
    : activeScriptStudioLane === 'sms'
      ? 'SMS scripts'
      : 'Email templates';
  const activeScriptStudioSelection = activeScriptStudioLane === 'call'
    ? (selectedCallScript ? toText(selectedCallScript.name, 'Unknown') : 'None')
    : activeScriptStudioLane === 'sms'
      ? (selectedSmsScriptName || 'None')
      : (selectedEmailTemplateId || 'None');
  const activeScriptStudioCount = activeScriptStudioLane === 'call'
    ? callScriptsTotal
    : activeScriptStudioLane === 'sms'
      ? smsScripts.length
      : emailTemplates.length;
  const pulseTone = studioError
    ? 'error'
    : busyAction.length > 0 || studioBusy.length > 0
      ? 'info'
      : activeScriptStudioSelection !== 'None'
        ? 'success'
        : 'neutral';
  const pulseStatus = studioError
    ? 'Needs attention'
    : busyAction.length > 0 || studioBusy.length > 0
      ? (busyAction || studioBusy || 'Refreshing')
      : activeScriptStudioSelection !== 'None'
        ? `Editing ${activeScriptStudioLaneLabel}`
        : `${activeScriptStudioLaneLabel} ready`;
  const totalPersonas = personaBuiltin.length + personaCustom.length;
  const selectedCallScriptLifecycleTone = toLifecycleTone(selectedCallScriptLifecycleState);

  const renderSmsScriptsCard = () => (
    <UiCard>
      <h3>SMS Scripts</h3>
      <p className="va-muted">Create, update, and maintain SMS script assets.</p>
      <div className="va-inline-tools">
        <UiButton
          variant="secondary"
          disabled={studioBusy.length > 0 || busyAction.length > 0}
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
          disabled={
            studioBusy.length > 0
            || busyAction.length > 0
            || !smsScriptCreateName.trim()
            || !smsScriptCreateContent.trim()
          }
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
          description="Create a script or refresh to pull the latest content."
        />
      ) : (
        <ul className="va-list va-list-dense">
          {smsScripts.slice(0, 40).map((script, index) => {
            const scriptName = toText(script.name, `sms-script-${index + 1}`);
            const builtin = script.is_builtin === true;
            const active = scriptName === selectedSmsScriptName;
            return (
              <li key={`sms-script-row-${scriptName}`}>
                <strong>{scriptName}</strong>
                <span>
                  <UiBadge variant={toLifecycleTone(script.lifecycle_state)}>
                    {toText(script.lifecycle_state, builtin ? 'builtin' : 'draft')}
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
          {selectedSmsScript.is_builtin === true ? (
            <UiStatePanel
              compact
              title="Read-only built-in script"
              description="Clone this script into a custom entry if you need to modify the content."
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
          <div className="va-inline-tools">
            <UiButton
              variant="primary"
              disabled={
                studioBusy.length > 0
                || busyAction.length > 0
                || selectedSmsScript.is_builtin === true
                || !selectedSmsScriptName
              }
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
              disabled={
                studioBusy.length > 0
                || busyAction.length > 0
                || selectedSmsScript.is_builtin === true
                || !selectedSmsScriptName
              }
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
          </div>
        </>
      ) : null}
    </UiCard>
  );

  const renderEmailTemplatesCard = () => (
    <UiCard>
      <h3>Email Templates</h3>
      <p className="va-muted">Manage outbound email templates from the app.</p>
      <div className="va-inline-tools">
        <UiButton
          variant="secondary"
          disabled={studioBusy.length > 0}
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadEmailTemplates();
          }}
        >
          Refresh Templates
        </UiButton>
        <UiInput
          placeholder="Create template ID"
          value={emailTemplateCreateId}
          onChange={(event) => setEmailTemplateCreateId(event.target.value)}
        />
        <UiInput
          placeholder="Create subject"
          value={emailTemplateCreateSubject}
          onChange={(event) => setEmailTemplateCreateSubject(event.target.value)}
        />
      </div>
      <UiTextarea
        placeholder="Create plain-text body"
        value={emailTemplateCreateText}
        onChange={(event) => setEmailTemplateCreateText(event.target.value)}
        rows={3}
      />
      <UiButton
        variant="primary"
        disabled={
          studioBusy.length > 0
          || busyAction.length > 0
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
          description="Create a template or refresh to load the latest set."
        />
      ) : (
        <ul className="va-list va-list-dense">
          {emailTemplates.slice(0, 40).map((template, index) => {
            const templateId = toText(template.template_id, `template-${index + 1}`);
            const active = templateId === selectedEmailTemplateId;
            return (
              <li key={`email-template-row-${templateId}`}>
                <strong>{templateId}</strong>
                <span>
                  <UiBadge variant={toLifecycleTone(template.lifecycle_state)}>
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
          <div className="va-inline-tools">
            <UiButton
              variant="primary"
              disabled={studioBusy.length > 0 || busyAction.length > 0 || !selectedEmailTemplateId}
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
              disabled={studioBusy.length > 0 || busyAction.length > 0 || !selectedEmailTemplateId}
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
          </div>
        </>
      ) : null}
    </UiCard>
  );

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Content</p>
        <h2 className="va-page-title">Script Designer</h2>
        <p className="va-muted">Switch between call scripts, SMS scripts, and email templates in one operator workspace.</p>
        <div className="va-page-intro-meta" aria-label="Script designer summary">
          <UiBadge variant={pulseTone === 'neutral' ? 'meta' : pulseTone}>
            {pulseStatus}
          </UiBadge>
          <UiBadge variant="meta">Unified designer</UiBadge>
          <UiBadge variant="info">{activeScriptStudioLaneLabel}</UiBadge>
          <UiBadge variant="meta">{activeScriptStudioCount} in lane</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Keep authoring in one place: move between call, SMS, and email lanes without losing the surrounding policy,
          persona, and caller-screening context the broader scripts workflow depends on.
        </p>
      </section>
      <UiWorkspacePulse
        title="Workspace pulse"
        description="Track the active script lane, current selection, and shared policy context in one compact summary."
        tone={pulseTone}
        status={pulseStatus}
        items={[
          { label: 'Active lane', value: activeScriptStudioLaneLabel },
          { label: 'Selected', value: activeScriptStudioSelection },
          { label: activeScriptStudioLaneLabel, value: activeScriptStudioCount },
          { label: 'Shared context', value: `${callerFlags.length} flags · ${totalPersonas} personas` },
        ]}
      />
      <DashboardWorkflowContractCard moduleId={activeScriptStudioLane === 'call' ? 'content' : 'scriptsparity'} />
      <UiCard>
        <div className="va-ops-card-header">
          <div className="va-ops-card-headline">
            <h3>Designer switchboard</h3>
            <p className="va-muted">
              Match the bot-side Script Designer by switching between call scripts, SMS scripts, and email templates from one page.
            </p>
          </div>
          <UiBadge variant="meta">{activeScriptStudioSelection}</UiBadge>
        </div>
        <div className="va-inline-tools">
          <UiButton
            variant="chip"
            className={activeScriptStudioLane === 'call' ? 'is-active' : ''}
            onClick={() => {
              triggerHaptic('selection');
              setActiveScriptStudioLane('call');
            }}
          >
            Call Scripts
          </UiButton>
          <UiButton
            variant="chip"
            className={activeScriptStudioLane === 'sms' ? 'is-active' : ''}
            onClick={() => {
              triggerHaptic('selection');
              setActiveScriptStudioLane('sms');
            }}
          >
            SMS Scripts
          </UiButton>
          <UiButton
            variant="chip"
            className={activeScriptStudioLane === 'email' ? 'is-active' : ''}
            onClick={() => {
              triggerHaptic('selection');
              setActiveScriptStudioLane('email');
            }}
          >
            Email Templates
          </UiButton>
        </div>
        <Link to={MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS}>
          <Cell
            subtitle="Open the scripts overview before moving to another content workspace."
            after={<Navigation>Open</Navigation>}
          >
            Scripts overview
          </Cell>
        </Link>
        <Link to={DASHBOARD_MODULE_ROUTE_CONTRACTS.scriptsparity}>
          <Cell
            subtitle="Open the focused message-lane workspace when you want a narrower editor."
            after={<Navigation>Open</Navigation>}
          >
            Message Lanes
          </Cell>
        </Link>
      </UiCard>
      <UiDisclosure
        title="Workspace coverage"
        subtitle="Expose the current combined designer surface while keeping the broader lifecycle gaps explicit."
      >
        <UiStatePanel
          compact
          tone="success"
          title="Available here now"
          description="Switch between call, SMS, and email lanes. Call scripts support draft review, approval, promotion, and simulation here, while SMS and email lanes support create, update, inspect, and delete."
        />
        <UiStatePanel
          compact
          tone="info"
          title="Continue in broader scripts workflow"
          description="Call script creation, cloning, inbound default assignment, version history, diff, rollback, and the full SMS or email review and publishing lifecycle remain outside this current Mini App surface."
        />
      </UiDisclosure>
      <section className="va-grid">
        {activeScriptStudioLane === 'call' ? (
          <>
        <UiCard>
          <h3>Call Scripts</h3>
          <p className="va-muted">
            Draft edits, review approvals, and promote-live workflow for call scripts.
          </p>
          <div className="va-inline-tools">
            <UiInput
              placeholder="Flow filter (optional)"
              value={scriptFlowFilter}
              onChange={(event) => setScriptFlowFilter(event.target.value)}
            />
            <UiButton
              variant="secondary"
              onClick={() => {
                triggerHaptic('impact', 'light');
                void refreshCallScriptsModule();
              }}
            >
              Refresh Scripts
            </UiButton>
          </div>
          <p className="va-muted">
            Scripts available: <strong>{callScriptsTotal}</strong>
          </p>
          <ul className="va-list va-list-dense">
            {callScripts.slice(0, 60).map((script: CallScriptRow) => {
              const scriptId = toInt(script.id);
              const lifecycle = toText(script.lifecycle_state, 'draft');
              const lifecycleTone = toLifecycleTone(lifecycle);
              const active = scriptId === selectedCallScriptId;
              return (
                <li key={`call-script-${scriptId}`}>
                  <strong>{toText(script.name, `script-${scriptId || 'unknown'}`)}</strong>
                  <span>
                    ID: {scriptId} | Flow: {toText(script.flow_type, 'general')} | v{toInt(script.version, 1)}
                  </span>
                  <span>
                    <UiBadge variant={lifecycleTone}>
                      {lifecycle}
                    </UiBadge>
                    {' '}
                    Persona(default_profile): <strong>{toText(script.default_profile, 'general')}</strong>
                  </span>
                  <UiButton
                    variant="chip"
                    className={active ? 'is-active' : ''}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedCallScriptId(scriptId);
                    }}
                  >
                    {active ? 'Selected' : 'Select'}
                  </UiButton>
                </li>
              );
            })}
          </ul>
        </UiCard>

        <UiCard>
          <h3>Call Script Editor</h3>
          {selectedCallScript ? (
            <>
              <UiStatePanel
                compact
                tone={selectedCallScriptLifecycleTone}
                title={`Editing ${toText(selectedCallScript.name, 'unknown')}`}
                description={(
                  <>
                    Script #{selectedCallScriptId} is currently <strong>{selectedCallScriptLifecycleState}</strong>.
                    {' '}Submitted <strong>{formatTime(selectedCallScriptLifecycle.submitted_for_review_at)}</strong>,
                    reviewed <strong>{formatTime(selectedCallScriptLifecycle.reviewed_at)}</strong>.
                  </>
                )}
              />
              <UiInput
                placeholder="Script name"
                value={scriptNameInput}
                onChange={(event) => setScriptNameInput(event.target.value)}
              />
              <UiInput
                placeholder="Persona profile (default_profile)"
                value={scriptDefaultProfileInput}
                onChange={(event) => setScriptDefaultProfileInput(event.target.value)}
              />
              <UiTextarea
                placeholder="Description"
                value={scriptDescriptionInput}
                onChange={(event) => setScriptDescriptionInput(event.target.value)}
                rows={2}
              />
              <UiTextarea
                placeholder="Prompt"
                value={scriptPromptInput}
                onChange={(event) => setScriptPromptInput(event.target.value)}
                rows={6}
              />
              <UiTextarea
                placeholder="First message"
                value={scriptFirstMessageInput}
                onChange={(event) => setScriptFirstMessageInput(event.target.value)}
                rows={3}
              />
              <UiInput
                placeholder="Objective tags (comma-separated)"
                value={scriptObjectiveTagsInput}
                onChange={(event) => setScriptObjectiveTagsInput(event.target.value)}
              />
              <UiTextarea
                placeholder="Review note / approval reason"
                value={scriptReviewNoteInput}
                onChange={(event) => setScriptReviewNoteInput(event.target.value)}
                rows={2}
              />
              <UiActionBar
                title={busyAction.length > 0 ? 'Call script action in progress' : 'Call script ready'}
                description={busyAction.length > 0
                  ? `${busyAction} is running for the selected script.`
                  : 'Save changes, route the draft for review, or run a quick simulation before approving.'}
                actions={(
                  <>
                    <UiButton
                      variant="primary"
                      disabled={busyAction.length > 0}
                      onClick={() => { void saveCallScriptDraft(); }}
                    >
                      Save Draft
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={busyAction.length > 0}
                      onClick={() => { void submitCallScriptForReview(); }}
                    >
                      Submit Review
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={busyAction.length > 0}
                      onClick={() => { void simulateCallScript(); }}
                    >
                      Run Simulation
                    </UiButton>
                  </>
                )}
              />
              <div className="va-inline-tools">
                <UiButton
                  variant="secondary"
                  disabled={busyAction.length > 0}
                  onClick={() => { void reviewCallScript('approve'); }}
                >
                  Approve
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={busyAction.length > 0}
                  onClick={() => { void reviewCallScript('reject'); }}
                >
                  Reject
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={busyAction.length > 0}
                  onClick={() => { void promoteCallScriptLive(); }}
                >
                  Promote Live
                </UiButton>
              </div>
              <UiDisclosure
                title="Simulation preview"
                subtitle="Use test variables and inspect the resolved output before promoting a script."
                tone={scriptSimulationResult ? 'success' : 'neutral'}
              >
                <UiTextarea
                  placeholder={'Variables JSON, e.g. {"customer_name":"Ada"}'}
                  value={scriptSimulationVariablesInput}
                  onChange={(event) => setScriptSimulationVariablesInput(event.target.value)}
                  rows={3}
                />
                {scriptSimulationResult ? (
                  <pre>
                    {JSON.stringify(asRecord(scriptSimulationResult).simulation || scriptSimulationResult, null, 2)}
                  </pre>
                ) : (
                  <UiStatePanel
                    compact
                    title="No simulation output yet"
                    description="Run a simulation to inspect the resolved conversation content."
                    tone="info"
                  />
                )}
              </UiDisclosure>
            </>
          ) : (
            <UiStatePanel
              title="No call script selected"
              description="Choose a script from the list to start editing, reviewing, or simulating."
              tone="info"
            />
          )}
        </UiCard>
          </>
        ) : null}
        {activeScriptStudioLane === 'sms' ? renderSmsScriptsCard() : null}
        {activeScriptStudioLane === 'email' ? renderEmailTemplatesCard() : null}
      </section>

      <UiDisclosure
        title="Shared policy context"
        subtitle={`${callerFlags.length} caller flags, ${totalPersonas} personas`}
      >
        <section className="va-grid">
          <UiCard>
            <h3>Caller Flags Moderation</h3>
            <p className="va-muted">Allow, block, and spam classifications for inbound caller controls.</p>
            <div className="va-inline-tools">
              <UiSelect
                value={callerFlagsStatusFilter}
                onChange={(event) => setCallerFlagsStatusFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="allowed">Allowed</option>
                <option value="blocked">Blocked</option>
                <option value="spam">Spam</option>
              </UiSelect>
              <UiButton
                variant="secondary"
                disabled={studioBusy.length > 0}
                onClick={() => {
                  triggerHaptic('impact', 'light');
                  void loadCallerFlags();
                }}
              >
                Refresh Flags
              </UiButton>
            </div>
            <div className="va-inline-tools">
              <UiInput
                placeholder="Phone (+1555...)"
                value={callerFlagPhoneInput}
                onChange={(event) => setCallerFlagPhoneInput(event.target.value)}
              />
              <UiSelect
                value={callerFlagStatusInput}
                onChange={(event) => setCallerFlagStatusInput(event.target.value)}
              >
                <option value="blocked">Blocked</option>
                <option value="allowed">Allowed</option>
                <option value="spam">Spam</option>
              </UiSelect>
              <UiInput
                placeholder="Note (optional)"
                value={callerFlagNoteInput}
                onChange={(event) => setCallerFlagNoteInput(event.target.value)}
              />
              <UiButton
                variant="primary"
                disabled={studioBusy.length > 0 || busyAction.length > 0 || !callerFlagPhoneInput.trim()}
                onClick={() => {
                  void runAction(
                    DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_UPSERT,
                    {
                      phone_number: callerFlagPhoneInput.trim(),
                      status: callerFlagStatusInput,
                      note: callerFlagNoteInput.trim() || undefined,
                    },
                    {
                      successMessage: `Updated caller flag for ${callerFlagPhoneInput.trim()}`,
                      onSuccess: () => {
                        setCallerFlagPhoneInput('');
                        setCallerFlagNoteInput('');
                        void loadCallerFlags();
                      },
                    },
                  );
                }}
              >
                Upsert Flag
              </UiButton>
            </div>
            {callerFlags.length === 0 ? (
              <UiStatePanel
                compact
                title="No caller flags loaded"
                description="Refresh the moderation feed or add a new number to begin reviewing states."
              />
            ) : (
              <ul className="va-list va-list-dense">
                {callerFlags.slice(0, 40).map((flag, index) => (
                  <li key={`caller-flag-${index}`}>
                    <strong>{toText(flag.phone_number, 'n/a')}</strong>
                    <span>
                      <UiBadge variant={toCallerFlagTone(flag.status)}>
                        {toText(flag.status, 'unknown')}
                      </UiBadge>
                    </span>
                    <span>{toText(flag.note, 'no note')}</span>
                  </li>
                ))}
              </ul>
            )}
          </UiCard>

          <UiCard>
            <h3>Persona Manager</h3>
            <p className="va-muted">
              Persona catalog visibility for script review and policy checks.
            </p>
            <div className="va-inline-tools">
              <UiButton
                variant="secondary"
                disabled={studioBusy.length > 0}
                onClick={() => {
                  triggerHaptic('impact', 'light');
                  void loadPersonas();
                }}
              >
                Refresh Personas
              </UiButton>
            </div>
            <div className="va-inline-tools">
              <UiCard tone="subcard">
                <h4>Built-in Personas ({personaBuiltin.length})</h4>
                {personaBuiltin.length === 0 ? (
                  <UiStatePanel
                    title="No built-in personas reported"
                    description="Refresh the catalog to recheck the shared persona set."
                    tone="info"
                    compact
                  />
                ) : (
                  <ul className="va-list va-list-dense">
                    {personaBuiltin.slice(0, 20).map((persona, index) => (
                      <li key={`persona-builtin-${index}`}>
                        <strong>{toText(persona.label, toText(persona.name, `builtin-${index + 1}`))}</strong>
                        <span>{toText(persona.id, 'n/a')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </UiCard>
              <UiCard tone="subcard">
                <h4>Custom Personas ({personaCustom.length})</h4>
                {personaCustom.length === 0 ? (
                  <UiStatePanel
                    title="No custom personas available"
                    description="This environment currently exposes built-ins only."
                    tone="info"
                    compact
                  />
                ) : (
                  <ul className="va-list va-list-dense">
                    {personaCustom.slice(0, 20).map((persona, index) => (
                      <li key={`persona-custom-${index}`}>
                        <strong>{toText(persona.label, toText(persona.name, `custom-${index + 1}`))}</strong>
                        <span>{toText(persona.slug, toText(persona.id, 'n/a'))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </UiCard>
            </div>
          </UiCard>
        </section>
      </UiDisclosure>

      {studioError ? (
        <div className="va-card">
          <UiStatePanel
            title="Studio action failed"
            description={studioError}
            tone="error"
          />
        </div>
      ) : null}
    </>
  );
}
