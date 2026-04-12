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
  onRefreshAccess,
  refreshDisabled,
}: EmptyModulesCardProps) {
  return (
    <section className="va-grid">
      <UiSurfaceState
        cardTone="empty"
        tone="info"
        eyebrow="Workspace access"
        status="No modules yet"
        statusVariant="info"
        title="No modules available"
        description="This role has no enabled modules yet. Ask an administrator to grant access, then refresh."
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
