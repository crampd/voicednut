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
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  type MiniAppCommandActionId,
} from '@/contracts/miniappParityContracts';
import { useMiniAppCommandSession } from '@/hooks/useMiniAppCommandSession';
import {
  CommandPageLayout,
  CommandPageLoadingState,
  CommandPageRestrictedState,
} from './CommandPageScaffold';

import type { CommandPageId } from './CommandPages.tsx';
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

type GenericCommandPageProps = {
  pageId: CommandPageId;
};

export default function GenericCommandPage({ pageId }: GenericCommandPageProps) {
  const location = useLocation();
  const contract = MINIAPP_COMMAND_PAGE_CONTRACTS[pageId];
  const {
    loading,
    error,
    errorCode,
    bootstrapPayload,
    accessLevel,
    reload,
  } = useMiniAppCommandSession();
  const pageActionContract = MINIAPP_COMMAND_ACTION_CONTRACTS[pageId as MiniAppCommandActionId];
  const pageTitle = resolveCommandPageTitle(pageId);
  const listedActions = contract.actionIds;
  const contentSections = useMemo(
    () => getCommandContent(pageId, accessLevel),
    [accessLevel, pageId],
  );
  const pageAccessAllowed = hasAccess(pageActionContract.minAccess, accessLevel);
  const runtimeSnapshot = useMemo(
    () => createCommandRuntimeSnapshot(bootstrapPayload),
    [bootstrapPayload],
  );
  const runtimeRows = useMemo(
    () => getCommandRuntimeRows(pageId, runtimeSnapshot),
    [pageId, runtimeSnapshot],
  );
  const showBackButton = pageId !== 'MENU' && pageId !== 'START';

  if (loading) {
    return (
      <CommandPageLoadingState
        back={showBackButton}
        title={pageTitle}
        summary={resolveCommandPageLoadingCopy(pageTitle)}
        note="The workspace is syncing its route contract, runtime posture, and access state before controls are shown."
      />
    );
  }

  if (!pageAccessAllowed) {
    return (
      <CommandPageRestrictedState
        back={showBackButton}
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
      back={showBackButton}
      eyebrow="Command workspace"
      title={pageTitle}
      summary={contract.summary}
      meta={<UiBadge variant={error ? 'warning' : 'success'}>{error ? 'Needs attention' : 'Ready'}</UiBadge>}
      metaAriaLabel={`${pageTitle} readiness`}
      note={contract.notes}
      pulse={(
        <UiWorkspacePulse
          title="Workspace pulse"
          description="Access, action availability, and runtime posture stay aligned with the same command contract used by the launcher."
          tone={error ? 'warning' : 'success'}
          status={error ? 'Needs attention' : 'Ready'}
          items={[
            { label: 'Access level', value: describeAccessLevel(accessLevel) },
            { label: 'Available actions', value: listedActions.length },
            { label: 'Fallback', value: errorCode || 'Healthy session' },
          ]}
        />
      )}
    >
      <List>
        <Section
          header="Session status"
          footer={error ? `Session needs attention. ${error}` : 'Connected to the latest available session data.'}
        >
          <Cell subtitle={contract.summary}>
            {describeAccessLevel(accessLevel)}
          </Cell>
          <Cell
            subtitle={error ? 'Reload the workspace after reviewing the session issue.' : 'Refresh this workspace if runtime details change.'}
            after={<Navigation>{error ? 'Retry' : 'Refresh'}</Navigation>}
            onClick={() => {
              void reload();
            }}
          >
            Runtime connection
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
        {(pageId === 'HEALTH' || pageId === 'STATUS') && (
          <Section
            header="Live system snapshot"
            footer="Sourced from the latest runtime snapshot so this page stays aligned with the same operational posture used across the admin console."
          >
            {runtimeRows.map((row) => (
              <Cell key={row.label} subtitle={row.value}>
                {row.label}
              </Cell>
            ))}
          </Section>
        )}

        <Section
          header="Quick actions"
          footer="These shortcuts open the workflows currently available in the Mini App for your access level."
        >
          {listedActions.map((actionId) => renderQuickActionCell(actionId, accessLevel, location.pathname))}
        </Section>

        <Section
          header="Continue In Admin Console"
          footer="If you need a workflow that is not active here, continue in the admin console workspace."
        >
          <Link to={DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT}>
            <Cell subtitle="Open the admin console home and choose another workspace.">
              Admin console
            </Cell>
          </Link>
        </Section>
      </List>
    </CommandPageLayout>
  );
}
