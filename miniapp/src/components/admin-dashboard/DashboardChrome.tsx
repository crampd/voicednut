import { UiButton } from '@/components/ui/AdminPrimitives';
import { DashboardAvatar } from '@/components/admin-dashboard/DashboardAvatar';

type ModuleItem = {
  id: string;
  label: string;
};

type DashboardMainHeaderProps = {
  userLabel: string;
  userAvatarUrl: string;
  userAvatarFallback: string;
  sessionRole: string;
  sessionRoleSource: string;
  settingsStatusLabel: string;
  featureFlagsCount: number | string;
  moduleDetail: string;
  activeModuleGlyph: string;
  loading: boolean;
  compact?: boolean;
  onOpenSettings: () => void;
};

type DashboardModuleNavProps = {
  modules: ModuleItem[];
  activeModuleId: string;
  onSelectModule: (moduleId: string) => void;
};

type DashboardFocusedHeaderProps = {
  title: string;
  subtitle: string;
  userAvatarUrl: string;
  userAvatarFallback: string;
  loading: boolean;
  onOpenSettings: () => void;
};

type DashboardBottomNavProps = {
  modules: ModuleItem[];
  activeModuleId: string;
  moduleGlyph: (moduleId: string) => string;
  onSelectModule: (moduleId: string) => void;
};

type DashboardProfileAvatarButtonProps = {
  userLabel: string;
  userAvatarUrl: string;
  userAvatarFallback: string;
  compact?: boolean;
  loading: boolean;
  onOpenSettings: () => void;
};

function DashboardProfileAvatarButton({
  userLabel,
  userAvatarUrl,
  userAvatarFallback,
  compact = false,
  loading,
  onOpenSettings,
}: DashboardProfileAvatarButtonProps) {
  const triggerClass = compact
    ? 'va-profile-trigger va-profile-trigger-sm'
    : 'va-profile-trigger';
  const profileAlt = compact ? 'Profile' : `${userLabel} profile`;
  return (
    <UiButton
      variant="plain"
      className={triggerClass}
      aria-label="Open settings"
      title="Open settings"
      onClick={onOpenSettings}
      disabled={loading}
    >
      <DashboardAvatar
        src={userAvatarUrl}
        alt={profileAlt}
        fallback={userAvatarFallback}
      />
    </UiButton>
  );
}

function resolveHeaderPosture(sessionRole: string): { label: string; tone: 'success' | 'warning' | 'info' } {
  const normalizedRole = sessionRole.trim().toLowerCase();
  if (normalizedRole === 'admin') {
    return { label: 'Admin console healthy', tone: 'success' };
  }
  if (normalizedRole === 'viewer' || normalizedRole === 'guest') {
    return { label: 'Limited access', tone: 'warning' };
  }
  return { label: 'Ready for work', tone: 'info' };
}

export function DashboardMainHeader({
  userLabel,
  userAvatarUrl,
  userAvatarFallback,
  sessionRole,
  sessionRoleSource,
  settingsStatusLabel,
  featureFlagsCount,
  moduleDetail,
  activeModuleGlyph,
  loading,
  compact = false,
  onOpenSettings,
}: DashboardMainHeaderProps) {
  const posture = resolveHeaderPosture(sessionRole);
  const normalizedRoleSource = sessionRoleSource.replace(/_/g, ' ');
  const flagsLabel = typeof featureFlagsCount === 'number'
    ? `${featureFlagsCount} active`
    : String(featureFlagsCount);

  return (
    <header className={`va-header${compact ? ' is-compact' : ''}`}>
      <div className="va-header-primary">
        <div className="va-header-avatar-shell">
          <DashboardProfileAvatarButton
            userLabel={userLabel}
            userAvatarUrl={userAvatarUrl}
            userAvatarFallback={userAvatarFallback}
            compact={compact}
            loading={loading}
            onOpenSettings={onOpenSettings}
          />
        </div>
        <div className="va-header-copy">
          <div className="va-header-eyebrow-row">
            <p className="va-header-eyebrow">Telegram operations workspace</p>
            <span className="va-header-brand-chip">Mini App</span>
          </div>
          <div className="va-header-title-row">
            <h1>VOICEDNUT</h1>
            <span className={`va-header-posture is-${posture.tone}`}>{posture.label}</span>
          </div>
          <p className="va-header-subtitle">Operations command center</p>
          <div className="va-header-story">
            <p className="va-header-lead">
              One professional workspace for delivery, calling, provider health, and incident response.
            </p>
            <p className="va-module-context-line va-muted">
              <span className="va-module-context-icon" aria-hidden>{activeModuleGlyph}</span>
              <span>{moduleDetail}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="va-header-meta">
        <div className="va-header-signal-card">
          <span className="va-header-signal-label">Operator</span>
          <strong>{userLabel}</strong>
          <span className="va-header-signal-note">Signed in for live workflow coverage</span>
        </div>
        <div className="va-header-signal-grid">
          <div className="va-header-signal-card">
            <span className="va-header-signal-label">Access</span>
            <strong>Role {sessionRole}</strong>
            <span className="va-header-signal-note">Source {normalizedRoleSource}</span>
          </div>
          <div className="va-header-signal-card">
            <span className="va-header-signal-label">Workspace</span>
            <strong>{settingsStatusLabel}</strong>
            <span className="va-header-signal-note">Feature flags {flagsLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function DashboardModuleNav({
  modules,
  activeModuleId,
  onSelectModule,
}: DashboardModuleNavProps) {
  return (
    <nav className="va-module-nav" aria-label="Module navigation">
      {modules.map((module, index) => (
        <UiButton
          key={module.id}
          id={`va-module-chip-${module.id}`}
          variant="chip"
          className={activeModuleId === module.id ? 'is-active' : ''}
          aria-pressed={activeModuleId === module.id}
          aria-current={activeModuleId === module.id ? 'page' : undefined}
          aria-label={`Open ${module.label} module`}
          aria-keyshortcuts={`Alt+${index + 1}`}
          aria-controls="va-view-stage-root"
          onClick={() => onSelectModule(module.id)}
        >
          {module.label}
        </UiButton>
      ))}
    </nav>
  );
}

export function DashboardFocusedHeader({
  title,
  subtitle,
  userAvatarUrl,
  userAvatarFallback,
  loading,
  onOpenSettings,
}: DashboardFocusedHeaderProps) {
  return (
    <header className="va-focused-header">
      <div className="va-focused-main">
        <div className="va-focused-copy">
          <div className="va-focused-eyebrow-row">
            <p className="va-focused-eyebrow">Focused workspace</p>
            <span className="va-focused-chip">Live module</span>
          </div>
          <h2 className="va-page-title">{title}</h2>
          <p className="va-focused-subtitle">Operations workspace</p>
          <div className="va-focused-story">
            <p className="va-muted">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="va-focused-actions">
        <DashboardProfileAvatarButton
          userLabel={title}
          userAvatarUrl={userAvatarUrl}
          userAvatarFallback={userAvatarFallback}
          compact
          loading={loading}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </header>
  );
}

export function DashboardBottomNav({
  modules,
  activeModuleId,
  moduleGlyph,
  onSelectModule,
}: DashboardBottomNavProps) {
  return (
    <nav className="va-bottom-nav-wrap" aria-label="Quick module navigation">
      <div className="va-bottom-nav">
        {modules.map((module, index) => (
          <UiButton
            key={`bottom-${module.id}`}
            id={`va-module-bottom-${module.id}`}
            variant="plain"
            className={`va-bottom-nav-item ${activeModuleId === module.id ? 'is-active' : ''}`}
            aria-current={activeModuleId === module.id ? 'page' : undefined}
            aria-label={`Open ${module.label} module`}
            aria-keyshortcuts={`Alt+${index + 1}`}
            aria-controls="va-view-stage-root"
            onClick={() => onSelectModule(module.id)}
          >
            <span className="va-bottom-nav-glyph" aria-hidden>{moduleGlyph(module.id)}</span>
            <span>{module.label}</span>
          </UiButton>
        ))}
      </div>
    </nav>
  );
}
