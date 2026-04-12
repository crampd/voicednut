import { Link } from '@/components/Link/Link.tsx';
import {
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
} from '@/contracts/miniappParityContracts';
import { UiButton, UiCard, UiSkeletonLine, UiSurfaceState } from '@/components/ui/AdminPrimitives';
import { describeSessionBlockedReason } from '@/services/admin-dashboard/dashboardSessionErrors';

type ModuleErrorFallbackCardProps = {
  moduleLabel: string;
  onReload: () => void;
  reloadDisabled: boolean;
};

type SessionBlockedCardProps = {
  errorCode: string;
  onRetrySession: () => void;
  retryDisabled: boolean;
  onCloseMiniApp?: () => void;
  closeDisabled?: boolean;
};

type EmptyModulesCardProps = {
  sessionRole: string;
  lastSuccessfulPollLabel: string;
  onRefreshAccess: () => void;
  refreshDisabled: boolean;
};

type ModuleSkeletonGridProps = {
  labels?: string[];
};

type LoadingTelemetryCardProps = {
  visible: boolean;
  title: string;
  description: string;
};

const DEFAULT_SKELETON_LABELS = ['Loading module', 'Preparing data', 'Syncing controls'];

export function ModuleErrorFallbackCard({
  moduleLabel,
  onReload,
  reloadDisabled,
}: ModuleErrorFallbackCardProps) {
  return (
    <UiSurfaceState
      cardTone="fallback"
      tone="warning"
      eyebrow="Workspace recovery"
      status="Needs reload"
      statusVariant="warning"
      title={`${moduleLabel} is temporarily unavailable`}
      description="This module hit a render-time error. Refresh data and reopen the module."
      actions={(
        <UiButton
          variant="secondary"
          onClick={onReload}
          disabled={reloadDisabled}
        >
          Reload Module Data
        </UiButton>
      )}
    />
  );
}

export function SessionBlockedCard({
  errorCode,
  onRetrySession,
  retryDisabled,
  onCloseMiniApp,
  closeDisabled = false,
}: SessionBlockedCardProps) {
  const normalizedCode = errorCode || 'miniapp_auth_invalid';
  const reason = describeSessionBlockedReason(normalizedCode);
  return (
    <section className="va-grid">
      <UiSurfaceState
        cardTone="blocked"
        tone="error"
        eyebrow="Session access"
        status="Blocked"
        statusVariant="error"
        title="Mini App session blocked"
        description={(
          <>
            Code <strong>{normalizedCode}</strong>. {reason}
          </>
        )}
        actions={(
          <>
            <UiButton
              variant="secondary"
              onClick={onRetrySession}
              disabled={retryDisabled}
            >
              Retry Session
            </UiButton>
            {onCloseMiniApp ? (
              <UiButton
                variant="primary"
                onClick={onCloseMiniApp}
                disabled={closeDisabled}
              >
                Close Mini App
              </UiButton>
            ) : null}
          </>
        )}
      />
    </section>
  );
}

export function EmptyModulesCard({
  sessionRole,
  lastSuccessfulPollLabel,
  onRefreshAccess,
  refreshDisabled,
}: EmptyModulesCardProps) {
  const roleKey = sessionRole === 'admin' || sessionRole === 'operator' || sessionRole === 'viewer'
    ? sessionRole
    : 'viewer';
  const roleStatus = roleKey === 'viewer'
    ? 'Restricted access'
    : roleKey === 'operator'
      ? 'Access not provisioned'
      : 'Access unavailable';
  const supportLinks = roleKey === 'viewer'
    ? [
        {
          title: 'Request approval',
          description: 'Open help and access guidance for the workspaces this role cannot run yet.',
          to: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
        },
        {
          title: 'Review the guided start',
          description: 'See the browse-safe app flow and what unlocks after approval.',
          to: MINIAPP_COMMAND_ROUTE_CONTRACTS.START,
        },
        {
          title: 'Read the usage guide',
          description: 'Preview the main workflows before you ask for execution access.',
          to: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
        },
      ]
    : [
        {
          title: 'Open app settings',
          description: 'Check session posture, environment state, and recovery controls.',
          to: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
        },
        {
          title: 'Review operating guidance',
          description: 'Confirm the expected workflow before reloading module access.',
          to: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
        },
      ];

  return (
    <section className="va-grid">
      <UiSurfaceState
        cardTone="empty"
        tone="info"
        eyebrow="Workspace access"
        status={roleStatus}
        statusVariant="info"
        title="No modules available"
        description={(
          <div className="va-empty-state-copy">
            <p>
              {roleKey === 'viewer'
                ? 'This session is in browse-safe mode. You can review guidance now, then request approval for the workspaces you need.'
                : 'This session has no enabled modules yet. Use the support routes below, then reload access once provisioning is complete.'}
            </p>
            <p className="va-empty-state-meta">
              Last healthy sync: <strong>{lastSuccessfulPollLabel}</strong>
            </p>
            <div className="va-shortcut-list va-empty-state-links" aria-label="Access recovery routes">
              {supportLinks.map((link) => (
                <Link key={link.title} className="va-shortcut-link" to={link.to}>
                  <span className="va-shortcut-copy">
                    <strong>{link.title}</strong>
                    <span>{link.description}</span>
                  </span>
                  <span className="va-shortcut-action">Open</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        actions={(
          <UiButton
            variant="primary"
            onClick={onRefreshAccess}
            disabled={refreshDisabled}
          >
            Refresh Access
          </UiButton>
        )}
      />
    </section>
  );
}

export function ModuleSkeletonGrid({
  labels = DEFAULT_SKELETON_LABELS,
}: ModuleSkeletonGridProps) {
  return (
    <section className="va-grid va-module-skeleton-grid">
      {labels.map((label) => (
        <UiCard key={label} className="va-module-skeleton-card">
          <div className="va-module-skeleton-title" />
          <UiSkeletonLine />
          <UiSkeletonLine short />
          <p className="va-muted">{label}...</p>
        </UiCard>
      ))}
    </section>
  );
}

export function LoadingTelemetryCard({
  visible,
  title,
  description,
}: LoadingTelemetryCardProps) {
  if (!visible) return null;
  return (
    <section className="va-grid">
      <UiSurfaceState
        eyebrow="Workspace sync"
        status="Loading"
        statusVariant="info"
        title={title}
        description={description}
        tone="info"
      />
    </section>
  );
}
