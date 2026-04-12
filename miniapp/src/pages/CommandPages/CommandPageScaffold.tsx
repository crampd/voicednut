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
  const resolvedStateTitle = stateTitle ?? (
    accessLevel === 'guest'
      ? (requiredAccess === 'admin' ? 'Admin page preview only' : 'Approval required')
      : (requiredAccess === 'admin' ? 'Admin access required' : 'Authorized access required')
  );
  const resolvedStateDescription = stateDescription ?? (
    accessLevel === 'guest'
      ? 'This workspace stays visible so you can understand the workflow before access is granted. Use Help Center, Quick Actions, or the home screen for routes that are open now.'
      : (requiredAccess === 'admin'
          ? 'This route is reserved for admin oversight. Continue with your open workspaces or ask an admin to complete this step.'
          : 'Request access from an admin or continue with Help Center, Quick Actions, or the admin console for available workflows.')
  );
  const resolvedBadgeLabel = badgeLabel ?? (accessLevel === 'guest' ? 'Preview only' : 'Restricted');

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
            { label: 'Fallback', value: 'Help or admin console' },
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
    </CommandPageLayout>
  );
}
