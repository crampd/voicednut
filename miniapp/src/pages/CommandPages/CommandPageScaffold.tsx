import type { ReactNode } from 'react';
import {
  Cell,
  List,
  Placeholder,
  Section,
} from '@telegram-apps/telegram-ui';

import { Link } from '@/components/Link/Link.tsx';
import { Page } from '@/components/Page.tsx';
import { AdminPageIntro } from '@/components/admin-dashboard/AdminPageIntro';
import {
  UiBadge,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';
import {
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
  type MiniAppCommandAccessLevel,
} from '@/contracts/miniappParityContracts';
import {
  describeAccessLevel,
  describeRequiredAccess,
} from '@/contracts/commandPageCatalog';
import { resolveRestrictedSupportLinks } from '@/contracts/miniappAccessExperience';

type CommandPageBadgeVariant = 'meta' | 'info' | 'success' | 'warning' | 'error';

type CommandPageLayoutProps = {
  back?: boolean;
  eyebrow: string;
  title: string;
  summary: ReactNode;
  meta?: ReactNode;
  metaAriaLabel?: string;
  note?: ReactNode;
  pulse?: ReactNode;
  children: ReactNode;
};

export function CommandPageLayout({
  back = true,
  eyebrow,
  title,
  summary,
  meta,
  metaAriaLabel,
  note,
  pulse,
  children,
}: CommandPageLayoutProps) {
  return (
    <Page back={back}>
      <div className="va-dashboard va-command-page va-view-enter">
        <AdminPageIntro
          eyebrow={eyebrow}
          title={title}
          summary={summary}
          meta={meta}
          metaAriaLabel={metaAriaLabel}
          note={note}
        />
        {pulse}
        {children}
      </div>
    </Page>
  );
}

type CommandPageLoadingStateProps = {
  back?: boolean;
  title: string;
  summary: string;
  note: ReactNode;
  badge?: ReactNode;
};

export function CommandPageLoadingState({
  back = true,
  title,
  summary,
  note,
  badge = <UiBadge variant="info">Connecting</UiBadge>,
}: CommandPageLoadingStateProps) {
  return (
    <CommandPageLayout
      back={back}
      eyebrow="Preparing workspace"
      title={title}
      summary={summary}
      meta={badge}
      metaAriaLabel={`${title} loading state`}
      note={note}
    >
      <Placeholder header={title} description={summary} />
    </CommandPageLayout>
  );
}

type CommandPageRestrictedStateProps = {
  back?: boolean;
  title: string;
  summary: ReactNode;
  note: ReactNode;
  accessLevel: MiniAppCommandAccessLevel;
  requiredAccess: MiniAppCommandAccessLevel;
  stateTitle?: string;
  stateDescription?: ReactNode;
  badgeLabel?: ReactNode;
  badgeVariant?: CommandPageBadgeVariant;
};

export function CommandPageRestrictedState({
  back = true,
  title,
  summary,
  note,
  accessLevel,
  requiredAccess,
  stateTitle,
  stateDescription,
  badgeLabel,
  badgeVariant = 'warning',
}: CommandPageRestrictedStateProps) {
  const supportLinks = resolveRestrictedSupportLinks(accessLevel);
  const resolvedStateTitle = stateTitle ?? (
    accessLevel === 'guest'
      ? (requiredAccess === 'admin' ? 'Admin page preview only' : 'Approval required')
      : (requiredAccess === 'admin' ? 'Admin access required' : 'Authorized access required')
  );
  const resolvedStateDescription = stateDescription ?? (
    accessLevel === 'guest'
      ? 'This workspace stays visible so you can understand the workflow before access is granted. Continue with the browse-safe routes below while execution remains locked.'
      : (requiredAccess === 'admin'
          ? 'This route is reserved for admin oversight. Continue with your open workspaces below or ask an admin to complete this step.'
          : 'Request access from an admin or continue with the open workspaces below for the routes available to this session.')
  );
  const resolvedBadgeLabel = badgeLabel ?? (accessLevel === 'guest' ? 'Preview only' : 'Restricted');
  const fallbackSummary = accessLevel === 'guest'
    ? 'Browse-safe routes'
    : 'Open workspaces';

  return (
    <CommandPageLayout
      back={back}
      eyebrow="Access-aware workspace"
      title={title}
      summary={summary}
      meta={<UiBadge variant={badgeVariant}>{resolvedBadgeLabel}</UiBadge>}
      metaAriaLabel={`${title} access state`}
      note={note}
      pulse={(
        <UiWorkspacePulse
          title="Access posture"
          description="This workspace stays visible, but execution remains aligned with the same role gate enforced across the Mini App."
          tone="warning"
          status={resolvedBadgeLabel}
          items={[
            { label: 'Session access', value: describeAccessLevel(accessLevel) },
            { label: 'Required here', value: describeRequiredAccess(requiredAccess) },
            { label: 'Fallback', value: fallbackSummary },
          ]}
        />
      )}
    >
      <UiSurfaceState
        title={resolvedStateTitle}
        description={resolvedStateDescription}
        tone="warning"
        cardTone="status"
        eyebrow="Role gate"
        status={resolvedBadgeLabel}
        statusVariant="warning"
      />
      <List>
        <Section header={accessLevel === 'guest' ? 'Browse-safe routes' : 'Continue with open workspaces'}>
          {supportLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Cell subtitle={link.description}>
                {link.title}
              </Cell>
            </Link>
          ))}
          {accessLevel !== 'guest' ? (
            <Link to={DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT}>
              <Cell subtitle="Return to the main console and continue with a ready workspace.">
                Admin console
              </Cell>
            </Link>
          ) : null}
          {accessLevel === 'guest' ? (
            <Link to={MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU}>
              <Cell subtitle="Open Quick Actions for the routes that stay available right now.">
                Quick Actions
              </Cell>
            </Link>
          ) : null}
        </Section>
      </List>
    </CommandPageLayout>
  );
}
