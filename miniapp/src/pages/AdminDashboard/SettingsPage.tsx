import { UiBadge, UiButton } from '@/components/ui/AdminPrimitives';

type SettingsPageProps = {
  userLabel: string;
  sessionRole: string;
  pollingPaused: boolean;
  loading: boolean;
  busy: boolean;
  settingsStatusLabel: string;
  apiBaseLabel: string;
  featureFlagsCount: number | string;
  featureFlagsSourceLabel: string;
  featureFlagsUpdatedAtLabel: string;
  onTogglePolling: () => void;
  onSyncNow: () => void;
  onRetrySession: () => void;
};

type SettingsRowProps = {
  icon: string;
  iconTone: string;
  title: string;
  description?: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
};

function SettingsRow({
  icon,
  iconTone,
  title,
  description,
  value,
  onClick,
  disabled = false,
}: SettingsRowProps) {
  const rowBody = (
    <>
      <span className={`va-settings-icon ${iconTone}`}>{icon}</span>
      <span className="va-settings-copy">
        <strong>{title}</strong>
        {description ? <span className="va-settings-desc">{description}</span> : null}
      </span>
      <span className="va-settings-trail">
        {value ? <span className="va-settings-value">{value}</span> : null}
        {onClick ? <span className="va-settings-arrow" aria-hidden>›</span> : null}
      </span>
    </>
  );

  if (onClick) {
    return (
      <UiButton
        variant="plain"
        className="va-settings-row va-settings-row-btn"
        onClick={onClick}
        disabled={disabled}
      >
        {rowBody}
      </UiButton>
    );
  }

  return (
    <div className="va-settings-row">
      {rowBody}
    </div>
  );
}

export function SettingsPage({
  userLabel,
  sessionRole,
  pollingPaused,
  loading,
  busy,
  settingsStatusLabel,
  apiBaseLabel,
  featureFlagsCount,
  featureFlagsSourceLabel,
  featureFlagsUpdatedAtLabel,
  onTogglePolling,
  onSyncNow,
  onRetrySession,
}: SettingsPageProps) {
  const actionsDisabled = loading || busy;
  const liveUpdatesLabel = pollingPaused ? 'Off' : 'On';
  const roleLabel = sessionRole.slice(0, 1).toUpperCase() + sessionRole.slice(1);
  const syncStatusLabel = loading ? 'Loading' : busy ? 'Working' : 'Ready';
  const featureFlagsLabel = `${featureFlagsCount} active`;
  const accessibilityStatusLabel = settingsStatusLabel === 'Visible' ? 'Connected' : settingsStatusLabel;
  const updatesVariant = pollingPaused ? 'warning' : 'success';

  return (
    <section className="va-settings-page">
      <div className="va-settings-hero">
        <div className="va-settings-title-wrap">
          <p className="va-kicker">Preferences</p>
          <h2 className="va-settings-title">Settings</h2>
          <p className="va-muted">
            Manage account basics, app behavior, accessibility posture, and recovery controls.
          </p>
          <div className="va-settings-meta-strip">
            <UiBadge variant={updatesVariant}>Live updates {liveUpdatesLabel}</UiBadge>
            <UiBadge variant="meta">{roleLabel} access</UiBadge>
            <UiBadge variant="info">{featureFlagsLabel}</UiBadge>
          </div>
          <p className="va-settings-hero-note">
            This page stays focused on session, accessibility, and diagnostics so the dashboard home
            remains the place for navigation and day-to-day work.
          </p>
        </div>
        <div className="va-settings-summary">
          <span className={`va-settings-flag-state ${pollingPaused ? 'is-disabled' : 'is-enabled'}`}>
            Live updates {liveUpdatesLabel}
          </span>
          <span className="va-settings-meta">{syncStatusLabel} session</span>
        </div>
      </div>

      <section className="va-settings-cluster">
        <p className="va-settings-section-label">Account</p>
        <div className="va-settings-group">
          <SettingsRow
            icon="◎"
            iconTone="is-cyan"
            title="Signed-in account"
            description={userLabel}
            value={roleLabel}
          />
          <SettingsRow
            icon="⌁"
            iconTone={busy ? 'is-orange' : 'is-green'}
            title="Session recovery"
            description="Reconnect this session when Telegram state or access data becomes stale."
            value={actionsDisabled ? 'Busy' : 'Retry'}
            onClick={onRetrySession}
            disabled={actionsDisabled}
          />
          <SettingsRow
            icon="⚑"
            iconTone="is-blue"
            title="Access posture"
            description="Role-aware visibility and protected actions follow the main bot access model."
            value={roleLabel}
          />
        </div>
      </section>

      <section className="va-settings-cluster">
        <p className="va-settings-section-label">App behavior</p>
        <div className="va-settings-group">
          <SettingsRow
            icon="⟳"
            iconTone={pollingPaused ? 'is-orange' : 'is-green'}
            title="Live updates"
            description="Pause or resume background refresh loops for dashboard and workspace data."
            value={liveUpdatesLabel}
            onClick={onTogglePolling}
          />
          <SettingsRow
            icon="↻"
            iconTone="is-green"
            title="Refresh workspace data"
            description="Fetch the latest dashboard, module, and status snapshots on demand."
            value={actionsDisabled ? 'Busy' : 'Sync now'}
            onClick={onSyncNow}
            disabled={actionsDisabled}
          />
          <SettingsRow
            icon="◉"
            iconTone="is-blue"
            title="Sync status"
            description="Current background refresh posture for this session."
            value={syncStatusLabel}
          />
        </div>
      </section>

      <section className="va-settings-cluster">
        <p className="va-settings-section-label">Accessibility</p>
        <div className="va-settings-group">
          <SettingsRow
            icon="⚙"
            iconTone="is-violet"
            title="Telegram settings button"
            description="Native settings entry binding inside Telegram Mini Apps."
            value={accessibilityStatusLabel}
          />
          <SettingsRow
            icon="⌘"
            iconTone="is-cyan"
            title="Navigation and focus"
            description="Keyboard focus order, route memory, and clear action targets stay enabled."
            value="Enabled"
          />
          <SettingsRow
            icon="◌"
            iconTone="is-yellow"
            title="Readable interface"
            description="High-contrast dark styling and Telegram-native controls remain active across the app."
            value="Default"
          />
        </div>
      </section>

      <section className="va-settings-cluster">
        <p className="va-settings-section-label">Diagnostics</p>
        <div className="va-settings-group">
          <SettingsRow
            icon="⌘"
            iconTone="is-yellow"
            title="API endpoint"
            description={apiBaseLabel}
            value="Bound"
          />
          <SettingsRow
            icon="⚑"
            iconTone="is-blue"
            title="Feature flags"
            description={`Config source: ${featureFlagsSourceLabel}`}
            value={featureFlagsLabel}
          />
          <div className="va-settings-footnote">Configuration updated {featureFlagsUpdatedAtLabel}</div>
        </div>
      </section>
    </section>
  );
}
