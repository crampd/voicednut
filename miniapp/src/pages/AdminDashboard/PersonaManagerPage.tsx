import { useEffect, useState } from 'react';

import { buildModuleRequestState } from './moduleRequestState';
import type { DashboardVm } from './types';
import { useInvestigationAction } from './useInvestigationAction';
import { selectScriptStudioPageVm } from './vmSelectors';
import { DashboardWorkflowContractCard } from '@/components/admin-dashboard/DashboardWorkflowContractCard';
import {
  UiBadge,
  UiButton,
  UiCard,
  UiStatePanel,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';

type PersonaManagerPageProps = {
  visible: boolean;
  vm: DashboardVm;
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

export function PersonaManagerPage({ visible, vm }: PersonaManagerPageProps) {
  if (!visible) return null;

  const { toText, invokeAction, busyAction } = selectScriptStudioPageVm(vm);

  const [builtin, setBuiltin] = useState<Array<Record<string, unknown>>>([]);
  const [custom, setCustom] = useState<Array<Record<string, unknown>>>([]);
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
  const pulseTone = controlsBusy ? 'info' : custom.length > 0 ? 'success' : 'neutral';
  const pulseStatus = controlsBusy ? 'Refreshing' : custom.length > 0 ? 'Active' : 'Built-ins only';
  const pulseDescription = controlsBusy
    ? `Running ${requestState.activeActionLabel || 'persona sync'}.`
    : 'Review the active persona registry used by call scripts and messaging lanes. Persona create, edit, delete, and cache refresh still continue in the broader bot workflow.';

  const loadPersonas = async (): Promise<void> => {
    await runInvestigationAction(
      DASHBOARD_ACTION_CONTRACTS.PERSONA_LIST,
      {},
      (data) => {
        setBuiltin(toRows(data.builtin));
        setCustom(toRows(data.custom));
      },
    );
  };

  useEffect(() => {
    void loadPersonas();
  }, []);

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Persona Policy</p>
        <h2 className="va-page-title">Persona Manager</h2>
        <p className="va-muted">
          Review the admin persona registry mirrored from the bot flow before it is used by call
          scripts, agents, and messaging lanes.
        </p>
        <div className="va-page-intro-meta">
          <UiBadge variant={pulseTone === 'neutral' ? 'meta' : pulseTone}>{pulseStatus}</UiBadge>
          <UiBadge variant="meta">Persona registry</UiBadge>
          <UiBadge variant="info">{builtin.length + custom.length} profiles</UiBadge>
        </div>
        <p className="va-page-intro-note">
          Use this surface to verify persona coverage and policy posture before operators apply the
          registry in calls, scripts, or messaging flows.
        </p>
      </section>

      <UiWorkspacePulse
        title="Persona registry"
        description={pulseDescription}
        status={pulseStatus}
        tone={pulseTone}
        items={[
          { label: 'Built-in', value: builtin.length },
          { label: 'Custom', value: custom.length },
          { label: 'Sync state', value: controlsBusy ? 'Refreshing' : 'Ready' },
          { label: 'Editing path', value: 'Bot workflow' },
        ]}
      />

      <DashboardWorkflowContractCard moduleId="persona" />

      <section className="va-grid">
        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Persona library</h3>
              <p className="va-muted">Review built-in and custom personas while keeping bot-owned editing steps explicit.</p>
            </div>
            <UiBadge variant={custom.length > 0 ? 'success' : 'info'}>
              {custom.length > 0 ? `${custom.length} custom` : 'Built-ins only'}
            </UiBadge>
          </div>
          <div className="va-inline-tools">
            <UiButton
              variant="secondary"
              disabled={controlsBusy}
              onClick={() => { void loadPersonas(); }}
            >
              Refresh Personas
            </UiButton>
          </div>
          <p className="va-muted">
            Available here now: review built-in and custom personas and refresh the visible registry.
            Continue in the bot workflow: create persona, edit defaults, delete persona, and refresh
            persona cache.
          </p>
          {controlsBusy ? (
            <UiStatePanel
              compact
              title="Refreshing persona catalog"
              description="Loading built-in and custom persona definitions."
            />
          ) : null}
          <div className="va-subcard-grid va-subcard-grid-two">
            {builtin.length === 0 ? (
              <UiSurfaceState
                cardTone="subcard"
                compact
                eyebrow="Built-in catalog"
                status="Empty"
                title="No built-in personas reported"
                description="The shared persona registry did not return any built-in persona entries."
              />
            ) : (
              <UiCard tone="subcard">
                <h4>Built-in personas ({builtin.length})</h4>
                <ul className="va-list">
                  {builtin.slice(0, 30).map((persona, index) => (
                    <li key={`persona-builtin-${index}`} className="va-entity-row">
                      <div className="va-entity-head">
                        <strong>{toText(persona.label, toText(persona.name, `builtin-${index + 1}`))}</strong>
                        <span className="va-native-list-value">{toText(persona.id, 'n/a')}</span>
                      </div>
                      <p className="va-entity-message">
                        {toText(persona.description, 'Built-in persona available for shared call guidance.')}
                      </p>
                      <div className="va-entity-meta">
                        <span>Default purpose: {toText(persona.default_purpose, 'n/a')}</span>
                        <span>Tone: {toText(persona.default_emotion, 'n/a')}</span>
                        <span>Urgency: {toText(persona.default_urgency, 'n/a')}</span>
                        <span>Technical level: {toText(persona.default_technical_level, 'n/a')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </UiCard>
            )}
            {custom.length === 0 ? (
              <UiSurfaceState
                cardTone="subcard"
                eyebrow="Custom catalog"
                status="Built-ins only"
                statusVariant="info"
                title="No custom personas available"
                description="The current miniapp bridge shows the shared built-in set only. Custom persona authoring still continues in the bot workflow."
                tone="info"
                compact
              />
            ) : (
              <UiCard tone="subcard">
                <h4>Custom personas ({custom.length})</h4>
                <ul className="va-list">
                  {custom.slice(0, 30).map((persona, index) => (
                    <li key={`persona-custom-${index}`} className="va-entity-row">
                      <div className="va-entity-head">
                        <strong>{toText(persona.label, toText(persona.name, `custom-${index + 1}`))}</strong>
                        <span className="va-native-list-value">{toText(persona.slug, toText(persona.id, 'n/a'))}</span>
                      </div>
                      <p className="va-entity-message">
                        {toText(persona.description, 'Custom persona available for targeted workflows.')}
                      </p>
                      <div className="va-entity-meta">
                        <span>Default purpose: {toText(persona.default_purpose, 'n/a')}</span>
                        <span>Call script: {toText(persona.call_script_id, 'not linked')}</span>
                        <span>SMS script: {toText(persona.sms_script_name, 'not linked')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </UiCard>
            )}
          </div>
        </UiCard>
      </section>

      {investigationError ? (
        <section className="va-grid">
          <UiSurfaceState
            eyebrow="Catalog sync"
            status="Action failed"
            statusVariant="error"
            title="Persona action failed"
            description={investigationError}
            tone="error"
          />
        </section>
      ) : null}
    </>
  );
}
