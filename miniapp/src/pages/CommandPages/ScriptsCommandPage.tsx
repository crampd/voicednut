import type { FC } from 'react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Cell,
  List,
  Navigation,
  Placeholder,
  Section,
  Text,
} from '@telegram-apps/telegram-ui';

import '@/pages/AdminDashboard/AdminDashboardPage.css';
import { Link } from '@/components/Link/Link.tsx';
import { Page } from '@/components/Page.tsx';
import {
  DASHBOARD_MODULE_ROUTE_CONTRACTS,
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
} from '@/contracts/miniappParityContracts';
import { useMiniAppCommandSession } from '@/hooks/useMiniAppCommandSession';

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
      <Page back>
        <Placeholder
          header={pageTitle}
          description={resolveCommandPageLoadingCopy(pageTitle)}
        />
      </Page>
    );
  }

  if (!pageAccessAllowed) {
    return (
      <Page back>
        <List>
          <Section
            header={pageTitle}
            footer={`${contract.notes} Access is denied for your current session role.`}
          >
            <Cell subtitle={contract.summary}>
              {describeAccessLevel(accessLevel)}
            </Cell>
            <Cell subtitle={`${pageActionContract.minAccess} access required`}>
              Route restricted
            </Cell>
          </Section>
          <Section header="Continue with guidance">
            <Link to={MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP}>
              <Cell subtitle="Open Help Center for role-aware guidance.">
                Help Center
              </Cell>
            </Link>
            <Link to={MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU}>
              <Cell subtitle="Open Quick Actions for currently accessible workflows.">
                Quick Actions
              </Cell>
            </Link>
            <Link to={DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT}>
              <Cell subtitle="Open the admin console home.">
                Admin console
              </Cell>
            </Link>
          </Section>
        </List>
      </Page>
    );
  }

  return (
    <Page back>
      <List>
        <Section
          header={pageTitle}
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
          footer="These routes stay inside the existing admin workspace shell and keep script work separated by job type."
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
              subtitle="Open Message Lanes for a narrower SMS and email editing workspace."
              after={<Navigation>Open</Navigation>}
            >
              Message Lanes
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
    </Page>
  );
}

export const ScriptsCommandPage: FC = () => <ScriptsCommandPageContent />;

export default ScriptsCommandPage;
