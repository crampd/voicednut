import type { FC } from 'react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Cell,
  List,
  Navigation,
  Section,
  Text,
} from '@telegram-apps/telegram-ui';

import '@/pages/AdminDashboard/AdminDashboardPage.css';
import { Link } from '@/components/Link/Link.tsx';
import { UiBadge, UiWorkspacePulse } from '@/components/ui/AdminPrimitives';
import {
  DASHBOARD_MODULE_ROUTE_CONTRACTS,
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
} from '@/contracts/miniappParityContracts';
import { useMiniAppCommandSession } from '@/hooks/useMiniAppCommandSession';
import {
  CommandPageLayout,
  CommandPageLoadingState,
  CommandPageRestrictedState,
} from './CommandPageScaffold';

import {
  createCommandRuntimeSnapshot,
  describeAccessLevel,
  getCommandContent,
  getCommandRuntimeRows,
  hasAccess,
  renderQuickActionCell,
  resolveCommandPageLoadingCopy,
  resolveCommandPageTitle,
} from './CommandPages.tsx';

function ScriptsCommandPageContent() {
  const location = useLocation();
  const contract = MINIAPP_COMMAND_PAGE_CONTRACTS.SCRIPTS;
  const {
    loading,
    error,
    errorCode,
    bootstrapPayload,
    accessLevel,
    reload,
  } = useMiniAppCommandSession();
  const pageActionContract = MINIAPP_COMMAND_ACTION_CONTRACTS.SCRIPTS;
  const pageTitle = resolveCommandPageTitle('SCRIPTS');
  const listedActions = contract.actionIds;
  const contentSections = useMemo(
    () => getCommandContent('SCRIPTS', accessLevel),
    [accessLevel],
  );
  const pageAccessAllowed = hasAccess(pageActionContract.minAccess, accessLevel);
  const runtimeSnapshot = useMemo(
    () => createCommandRuntimeSnapshot(bootstrapPayload),
    [bootstrapPayload],
  );
  const runtimeRows = useMemo(
    () => getCommandRuntimeRows('SCRIPTS', runtimeSnapshot),
    [runtimeSnapshot],
  );

  if (loading) {
    return (
      <CommandPageLoadingState
        title={pageTitle}
        summary={resolveCommandPageLoadingCopy(pageTitle)}
        note="This handoff verifies the latest script-route contract before opening the unified Script Designer."
        badge={<UiBadge variant="info">Connecting</UiBadge>}
      />
    );
  }

  if (!pageAccessAllowed) {
    return (
      <CommandPageRestrictedState
        title={pageTitle}
        summary={contract.summary}
        note={`${contract.notes} Access is denied for your current session role.`}
        accessLevel={accessLevel}
        requiredAccess={pageActionContract.minAccess}
      />
    );
  }

  return (
    <CommandPageLayout
      eyebrow="Scripts workspace"
      title={pageTitle}
      summary="Open the unified Script Designer and move between review, simulation, approval, and live-promotion flows without guessing which route owns the lifecycle."
      metaAriaLabel="Scripts workspace summary"
      meta={(
        <>
          <UiBadge variant={error ? 'warning' : 'success'}>
            {error ? 'Needs attention' : 'Ready'}
          </UiBadge>
          <UiBadge variant="meta">Unified designer</UiBadge>
          <UiBadge variant="info">{listedActions.length} actions</UiBadge>
        </>
      )}
      note="This route is the supported handoff surface. It keeps operators inside the same authoritative Script Designer instead of fragmenting call, SMS, and email editing into duplicate pages."
      pulse={(
        <UiWorkspacePulse
          title="Workspace pulse"
          description="Track access posture, available actions, and shared runtime state before opening the editor."
          tone={error ? 'warning' : 'success'}
          status={error ? 'Needs attention' : 'Ready'}
          items={[
            { label: 'Access level', value: describeAccessLevel(accessLevel) },
            { label: 'Available actions', value: listedActions.length },
            { label: 'Primary destination', value: 'Script Designer' },
            { label: 'Fallback', value: errorCode || 'Healthy session' },
          ]}
        />
      )}
    >
      <List>
        <Section
          header="Session status"
          footer={contract.notes}
        >
          <Cell subtitle={contract.summary}>
            {describeAccessLevel(accessLevel)}
          </Cell>
          <Cell
            subtitle={error ? `Session needs attention. ${error}` : 'Connected to the latest available session data.'}
            after={<Navigation>{error ? 'Retry' : 'Ready'}</Navigation>}
            onClick={() => {
              void reload();
            }}
          >
            Session status
          </Cell>
          {errorCode && (
            <Cell subtitle="Latest session issue code">
              {errorCode}
            </Cell>
          )}
        </Section>

        {contentSections.map((section) => (
          <Section key={section.header} header={section.header}>
            {section.items.map((item) => (
              <Cell key={item}>
                <Text>{item}</Text>
              </Cell>
            ))}
          </Section>
        ))}

        <Section
          header="Workspace handoff"
          footer="These routes stay inside the existing admin workspace shell and land in the same shared Script Designer with different entry emphasis."
        >
          <Link to={DASHBOARD_MODULE_ROUTE_CONTRACTS.content}>
            <Cell
              subtitle="Open Script Designer for the combined call, SMS, and email editor with the full call-script lifecycle."
              after={<Navigation>Open</Navigation>}
            >
              Script Designer
            </Cell>
          </Link>
          <Link to={DASHBOARD_MODULE_ROUTE_CONTRACTS.scriptsparity}>
            <Cell
              subtitle="Open the focused message entry for the same Script Designer, landing directly on SMS and email editing."
              after={<Navigation>Open</Navigation>}
            >
              Focused Message Entry
            </Cell>
          </Link>
        </Section>

        <Section
          header="Runtime posture"
          footer="Sourced from the latest runtime snapshot so this handoff stays aligned with the same runtime and access posture as the rest of the Mini App."
        >
          {runtimeRows.map((row) => (
            <Cell key={row.label} subtitle={row.value}>
              {row.label}
            </Cell>
          ))}
        </Section>

        <Section
          header="Quick actions"
          footer="These shortcuts keep operators in the supported script workspaces without bypassing the intended handoff."
        >
          {listedActions.map((actionId) => renderQuickActionCell(actionId, accessLevel, location.pathname))}
        </Section>

        <Section
          header="Continue In Admin Console"
          footer="Unknown, stale, or unsupported actions return to the admin console instead of leaving you at a dead end."
        >
          <Link to={DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT}>
            <Cell subtitle="Open the admin dashboard shell and role-aware workspace launcher.">
              Admin console
            </Cell>
          </Link>
        </Section>
      </List>
    </CommandPageLayout>
  );
}

export const ScriptsCommandPage: FC = () => <ScriptsCommandPageContent />;

export default ScriptsCommandPage;
