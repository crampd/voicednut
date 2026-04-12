import { buildProviderRequestState } from './moduleRequestState';
import type { DashboardVm, ProviderMatrixRow } from './types';
import { selectProviderPageVm } from './vmSelectors';
import { LoadingTelemetryCard } from '@/components/admin-dashboard/DashboardStateCards';
import {
  UiActionBar,
  UiBadge,
  UiButton,
  UiCard,
  UiDisclosure,
  UiSelect,
  UiSurfaceState,
  UiWorkspacePulse,
} from '@/components/ui/AdminPrimitives';

type ProviderControlPageProps = {
  visible: boolean;
  vm: DashboardVm;
};

export function ProviderControlPage({ visible, vm }: ProviderControlPageProps) {
  if (!visible) return null;

  const {
    providerReadinessTotals,
    providerDegradedCount,
    providerReadinessPercent,
    textBar,
    busyAction,
    providerPreflightBusy,
    preflightActiveProviders,
    loading,
    handleRefresh,
    providerMatrixRows,
    providerCurrentByChannel,
    providerSupportedByChannel,
    providerSwitchPlanByChannel,
    setProviderSwitchTarget,
    simulateProviderSwitchPlan,
    confirmProviderSwitchPlan,
    applyProviderSwitchPlan,
    resetProviderSwitchPlan,
    renderProviderSection,
  } = selectProviderPageVm(vm);
  const matrixReady = providerMatrixRows.length > 0;
  const providerRequestState = buildProviderRequestState({
    loading,
    busyAction,
    providerPreflightBusy,
  });
  const providerBusy = providerRequestState.isBusy;
  const supportedProviderTotal = (['call', 'sms', 'email'] as const)
    .reduce((total, channel) => total + (providerSupportedByChannel[channel]?.length || 0), 0);
  const plannerConfigured = supportedProviderTotal > 0;
  const providerSummaryTone = providerBusy
    ? 'info'
    : !plannerConfigured || providerDegradedCount > 0
      ? 'warning'
      : 'success';
  const providerSummaryStatus = providerBusy
    ? 'Syncing'
    : !plannerConfigured
      ? 'Needs setup'
      : providerDegradedCount > 0
        ? 'Watching'
        : 'Healthy';
  const providerSummaryDescription = providerBusy
    ? `Running ${providerRequestState.activeActionLabel || 'provider checks'}.`
    : !plannerConfigured
      ? 'Provider support metadata is still warming up. Refresh once bootstrap data is available.'
      : 'Keep the call backbone healthy first, then validate linked SMS and email lanes before applying changes.';
  const matrixStateTitle = loading ? 'Compatibility matrix warming up' : 'No matrix data available';
  const matrixStateDescription = loading
    ? 'Readiness compatibility rows will appear after the current sync cycle.'
    : 'Run preflight or refresh matrix to repopulate provider readiness rows.';

  const channelRoleCopy: Record<'call' | 'sms' | 'email', { label: string; detail: string }> = {
    call: {
      label: 'Primary lane',
      detail: 'This is the main provider workflow elevated by the bot and should be treated as the first change path.',
    },
    sms: {
      label: 'Linked delivery lane',
      detail: 'Keep SMS readiness aligned with the active call posture before large delivery work.',
    },
    email: {
      label: 'Linked delivery lane',
      detail: 'Review email readiness here when campaign or incident work depends on provider health.',
    },
  };

  const stageBadgeVariant = (stage: string): 'meta' | 'info' | 'success' | 'warning' => {
    switch (stage) {
      case 'confirmed':
        return 'success';
      case 'simulated':
        return 'info';
      case 'failed':
        return 'warning';
      default:
        return 'meta';
    }
  };

  return (
    <>
      <section className="va-page-intro">
        <p className="va-kicker">Operations</p>
        <h2 className="va-page-title">Provider Control</h2>
        <p className="va-muted">
          Review the active call backbone, then validate SMS and email readiness before staging any provider change.
        </p>
        <div className="va-page-intro-meta">
          <UiBadge variant={providerSummaryTone === 'warning' ? 'warning' : providerSummaryTone === 'info' ? 'info' : 'success'}>
            {providerSummaryStatus}
          </UiBadge>
          <UiBadge variant="meta">Call-first routing</UiBadge>
          <UiBadge variant={providerDegradedCount > 0 ? 'warning' : 'info'}>
            {providerDegradedCount > 0 ? `${providerDegradedCount} degraded` : 'Routing stable'}
          </UiBadge>
        </div>
        <p className="va-page-intro-note">
          Use this as the routing control surface: check the active backbone, simulate the target, confirm intent, and apply changes only after readiness clears.
        </p>
      </section>

      <UiWorkspacePulse
        title="Call backbone health"
        description={providerSummaryDescription}
        status={providerSummaryStatus}
        tone={providerSummaryTone}
        items={[
          { label: 'Ready providers', value: `${providerReadinessTotals.ready}/${providerReadinessTotals.total}` },
          { label: 'Degraded', value: providerDegradedCount },
          { label: 'Coverage', value: `${providerReadinessPercent}%` },
          { label: 'Targets', value: supportedProviderTotal || 'Pending' },
        ]}
      />

      <LoadingTelemetryCard
        visible={providerRequestState.isLoading && !matrixReady}
        title="Loading provider diagnostics"
        description="Syncing compatibility matrix, readiness signals, and switch safety checks."
      />

      <section className="va-grid">
        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Active routing</h3>
              <p className="va-muted">
                Review the live call backbone first, then check the linked SMS and email lanes before changing provider posture.
              </p>
            </div>
            <UiBadge variant={providerDegradedCount > 0 ? 'warning' : 'info'}>
              {providerDegradedCount > 0 ? `${providerDegradedCount} degraded` : 'Routing stable'}
            </UiBadge>
          </div>
          <ul className="va-list">
            {(['call', 'sms', 'email'] as const).map((channel) => {
              const current = providerCurrentByChannel[channel] || 'unknown';
              const supported = providerSupportedByChannel[channel] || [];
              const role = channelRoleCopy[channel];
              return (
                <li key={`provider-current-${channel}`}>
                  <div className="va-entity-head">
                    <strong>{channel.toUpperCase()}</strong>
                    <UiBadge variant={channel === 'call' ? 'info' : 'meta'}>
                      {role.label}
                    </UiBadge>
                  </div>
                  <span>Current provider: <strong>{current}</strong></span>
                  <span>Supported targets: <strong>{supported.length > 0 ? supported.join(', ') : 'pending'}</strong></span>
                  <span>{role.detail}</span>
                </li>
              );
            })}
          </ul>
        </UiCard>
        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Provider Status &amp; Readiness</h3>
              <p className="va-muted">Refresh the matrix, preflight active channels, and inspect compatibility before any routing move.</p>
            </div>
            <UiBadge variant={providerSummaryTone === 'warning' ? 'warning' : providerSummaryTone === 'info' ? 'info' : 'success'}>
              {providerSummaryStatus}
            </UiBadge>
          </div>
          <UiActionBar
            title="Refresh or preflight"
            description="Refresh the current provider picture, then preflight active lanes before committing a switch."
            actions={(
              <>
                <UiButton
                  variant="secondary"
                  disabled={providerBusy || !plannerConfigured}
                  onClick={() => { void preflightActiveProviders(); }}
                >
                  Preflight Active Providers
                </UiButton>
                <UiButton
                  variant="secondary"
                  disabled={loading || providerBusy}
                  onClick={handleRefresh}
                >
                  Refresh Matrix
                </UiButton>
              </>
            )}
          />
          {!plannerConfigured ? (
            <UiSurfaceState
              cardTone="subcard"
              eyebrow="Provider setup"
              status="Needs metadata"
              statusVariant="warning"
              title="Provider plan is not configured"
              description="No channel provider metadata is available yet. Refresh bootstrap data to hydrate provider support."
              tone="warning"
              compact
            />
          ) : null}
          {!matrixReady ? (
            <UiSurfaceState
              cardTone="subcard"
              eyebrow="Compatibility details"
              status={loading ? 'Syncing' : 'Needs refresh'}
              statusVariant={loading ? 'info' : 'warning'}
              title={matrixStateTitle}
              description={matrixStateDescription}
              tone={loading ? 'info' : 'warning'}
              compact
            />
          ) : (
            <UiDisclosure
              title="Readiness matrix"
              subtitle="Review readiness, degraded signals, and payment/path constraints by provider."
            >
              <pre>{textBar(providerReadinessPercent)}</pre>
              <ul className="va-list va-matrix-list">
                {providerMatrixRows.map((row: ProviderMatrixRow) => (
                  <li key={`matrix-${row.channel}-${row.provider}`}>
                    <strong>{row.channel.toUpperCase()} · {row.provider}</strong>
                    <span>
                      Ready: <strong>{row.ready ? 'yes' : 'no'}</strong>
                      {' '}| Degraded: <strong>{row.degraded ? 'yes' : 'no'}</strong>
                    </span>
                    <span>
                      Flows: <strong>{row.flowCount}</strong>
                      {' '}| Parity gaps: <strong>{row.parityGapCount}</strong>
                    </span>
                    {row.channel === 'call' ? (
                      <span>Payment mode: <strong>{row.paymentMode}</strong></span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </UiDisclosure>
          )}
        </UiCard>
      </section>
      <section className="va-grid">
        <UiCard>
          <div className="va-ops-card-header">
            <div className="va-ops-card-headline">
              <h3>Call-First Switch Planner</h3>
              <p className="va-muted">
                Simulate first, confirm intent second, and apply only after the active routing picture is clean.
              </p>
            </div>
            <UiBadge variant={plannerConfigured ? 'meta' : 'warning'}>
              {plannerConfigured ? 'Planner ready' : 'Awaiting metadata'}
            </UiBadge>
          </div>
          <p className="va-muted">
            Follow the operational sequence used by the bot: review readiness, simulate a target, confirm intent,
            apply the switch, then verify health. Call is the primary change lane; SMS and email stay available when
            backend policy allows.
          </p>
          {!plannerConfigured ? (
            <UiSurfaceState
              cardTone="subcard"
              eyebrow="Switch planner"
              status="Unavailable"
              statusVariant="warning"
              title="Planner unavailable"
              description="Provider targets are not ready yet. Refresh matrix after bootstrap completes."
              tone="warning"
              compact
            />
          ) : null}
          <ul className="va-list">
            {(['call', 'sms', 'email'] as const).map((channel) => {
              const current = providerCurrentByChannel[channel] || 'unknown';
              const supported = providerSupportedByChannel[channel] || [];
              const plan = providerSwitchPlanByChannel[channel];
              return (
                <li key={`provider-plan-${channel}`}>
                  <div className="va-entity-head">
                    <strong>{channel.toUpperCase()} plan</strong>
                    <UiBadge variant={stageBadgeVariant(plan.stage)}>
                      {plan.stage}
                    </UiBadge>
                  </div>
                  <span>{channelRoleCopy[channel].detail}</span>
                  <span>Current: {current}</span>
                  <div className="va-inline-tools">
                    <UiSelect
                      value={plan.target}
                      disabled={supported.length === 0 || providerBusy}
                      onChange={(event) => setProviderSwitchTarget(channel, event.target.value)}
                    >
                      <option value="">Select provider target</option>
                      {supported.map((provider) => (
                        <option key={`switch-${channel}-${provider}`} value={provider}>{provider}</option>
                      ))}
                    </UiSelect>
                    <UiButton
                      variant="secondary"
                      disabled={providerBusy || !plan.target || supported.length === 0}
                      onClick={() => { void simulateProviderSwitchPlan(channel); }}
                    >
                      Simulate
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={providerBusy || plan.stage !== 'simulated'}
                      onClick={() => confirmProviderSwitchPlan(channel)}
                    >
                      Confirm
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={providerBusy || plan.stage !== 'confirmed'}
                      onClick={() => { void applyProviderSwitchPlan(channel); }}
                    >
                      Apply
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      disabled={providerBusy}
                      onClick={() => resetProviderSwitchPlan(channel)}
                    >
                      Reset
                    </UiButton>
                  </div>
                  {supported.length === 0 ? (
                    <UiSurfaceState
                      cardTone="subcard"
                      eyebrow={`${channel.toUpperCase()} channel`}
                      status="No targets"
                      statusVariant="warning"
                      title={`${channel.toUpperCase()} provider data unavailable`}
                      description="No supported targets were reported for this channel. Retry bootstrap/preflight."
                      tone="warning"
                      compact
                    />
                  ) : null}
                  <span>Post-check: <strong>{plan.postCheck}</strong></span>
                  {plan.rollbackSuggestion ? (
                    <span>Rollback suggestion: <strong>{plan.rollbackSuggestion}</strong></span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </UiCard>
        {renderProviderSection('call')}
        {renderProviderSection('sms')}
        {renderProviderSection('email')}
      </section>
    </>
  );
}
