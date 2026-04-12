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
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
  type MiniAppCommandActionId,
} from '@/contracts/miniappParityContracts';
import { useMiniAppCommandSession } from '@/hooks/useMiniAppCommandSession';

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
      <Page back={showBackButton}>
        <div className="va-dashboard va-command-page">
          <div className="va-card va-command-hero va-command-hero-loading">
            <div className="va-command-hero-top">
              <div className="va-hero-top">
                <span className="va-kicker">Preparing workspace</span>
                <strong>{pageTitle}</strong>
                <p className="va-muted">{resolveCommandPageLoadingCopy(pageTitle)}</p>
              </div>
            </div>
          </div>
          <Placeholder
            header={pageTitle}
            description={resolveCommandPageLoadingCopy(pageTitle)}
          />
        </div>
      </Page>
    );
  }

  if (!pageAccessAllowed) {
    return (
      <Page back={showBackButton}>
        <div className="va-dashboard va-command-page">
          <section className="va-page-intro">
            <div className="va-card va-command-hero">
              <div className="va-command-hero-top">
                <div className="va-hero-top">
                  <span className="va-kicker">Access-aware workspace</span>
                  <strong>{pageTitle}</strong>
                  <p className="va-muted">{contract.summary}</p>
                </div>
                <div className="va-inline-metrics">
                  <span className="va-pill va-pill-warning">Restricted</span>
                </div>
              </div>
              <div className="va-hero-stats">
                <article>
                  <span>Session access</span>
                  <strong>{describeAccessLevel(accessLevel)}</strong>
                </article>
                <article>
                  <span>Needed here</span>
                  <strong>{pageActionContract.minAccess}</strong>
                </article>
              </div>
              <p className="va-command-hero-note">
                {contract.notes} Access is denied for your current session role.
              </p>
            </div>
          </section>
          <List>
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
        </div>
      </Page>
    );
  }

  return (
    <Page back={showBackButton}>
      <div className="va-dashboard va-command-page">
        <section className="va-page-intro">
          <div className="va-card va-command-hero">
            <div className="va-command-hero-top">
              <div className="va-hero-top">
                <span className="va-kicker">Command workspace</span>
                <strong>{pageTitle}</strong>
                <p className="va-muted">{contract.summary}</p>
              </div>
              <div className="va-inline-metrics">
                <span className={`va-pill ${error ? 'va-pill-warning' : 'va-pill-success'}`}>
                  {error ? 'Needs attention' : 'Ready'}
                </span>
              </div>
            </div>
            <div className="va-hero-stats">
              <article>
                <span>Access level</span>
                <strong>{describeAccessLevel(accessLevel)}</strong>
              </article>
              <article>
                <span>Available actions</span>
                <strong>{listedActions.length}</strong>
              </article>
            </div>
            <p className="va-command-hero-note">{contract.notes}</p>
          </div>
        </section>
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
      </div>
    </Page>
  );
}
