import { UiButton } from '@/components/ui/AdminPrimitives';
import {
  MODULE_CONTEXT,
  moduleGlyph,
  type DashboardModule,
} from '@/pages/AdminDashboard/dashboardShellConfig';

export type DashboardWorkspaceLauncherModule = {
  id: DashboardModule;
  label: string;
  isAvailable: boolean;
};

export type DashboardWorkspaceLauncherGroup = {
  id: string;
  label: string;
  subtitle: string;
  modules: DashboardWorkspaceLauncherModule[];
};

type DashboardWorkspaceLauncherProps = {
  groupedVisibleModules: DashboardWorkspaceLauncherGroup[];
  moduleShortcutIndexById: Record<string, number>;
  activeModule: DashboardModule;
  onSelectModule: (moduleId: DashboardModule) => void;
};

export function DashboardWorkspaceLauncher({
  groupedVisibleModules,
  moduleShortcutIndexById,
  activeModule,
  onSelectModule,
}: DashboardWorkspaceLauncherProps): JSX.Element {
  return (
    <section className="va-overview-launcher" aria-labelledby="va-overview-launcher-title">
      <div className="va-overview-head">
        <h2 id="va-overview-launcher-title" className="va-section-title">All areas</h2>
        <p className="va-muted">
          Open the area that matches the task in front of you.
        </p>
      </div>
      <div className="va-launcher-groups">
        {groupedVisibleModules.map((group) => (
          <section key={`launcher-group-${group.id}`} className="va-launcher-group">
            <div className="va-launcher-group-head">
              <div className="va-launcher-group-copy">
                <h3 className="va-launcher-group-title">{group.label}</h3>
                <p className="va-muted va-launcher-group-subtitle">{group.subtitle}</p>
              </div>
              <span className="va-meta-chip">
                {group.modules.filter((module) => module.isAvailable).length} ready
                {' · '}
                {group.modules.filter((module) => !module.isAvailable).length} locked
              </span>
            </div>
            <div className="va-launcher-grid">
              {group.modules.map((module) => {
                const shortcutIndex = moduleShortcutIndexById[module.id] || 0;
                const isActive = module.isAvailable && activeModule === module.id;
                const stateHint = module.isAvailable
                  ? (isActive ? 'Continue here' : 'Open area')
                  : 'Request access';
                return (
                  <UiButton
                    key={`launcher-${module.id}`}
                    id={`va-launcher-module-${module.id}`}
                    variant="plain"
                    className={[
                      'va-launcher-card',
                      isActive ? 'is-active' : '',
                      module.isAvailable ? '' : 'is-locked',
                    ].filter(Boolean).join(' ')}
                    aria-label={module.isAvailable ? `Open ${module.label}` : `${module.label} is locked`}
                    aria-pressed={isActive}
                    aria-keyshortcuts={module.isAvailable && shortcutIndex > 0 ? `Alt+${shortcutIndex}` : undefined}
                    disabled={!module.isAvailable}
                    onClick={module.isAvailable ? () => onSelectModule(module.id) : undefined}
                  >
                    <span className="va-launcher-glyph" aria-hidden>{moduleGlyph(module.id)}</span>
                    <span className="va-launcher-copy">
                      <span className="va-launcher-copy-top">
                        <strong>{module.label}</strong>
                        {isActive || !module.isAvailable ? (
                          <span className={`va-launcher-state ${module.isAvailable ? '' : 'is-locked'}`}>
                            {module.isAvailable ? 'Current' : 'Locked'}
                          </span>
                        ) : null}
                      </span>
                      <span>{MODULE_CONTEXT[module.id].detail}</span>
                      <span className="va-launcher-footer">
                        <span className="va-launcher-state-hint">{stateHint}</span>
                        {module.isAvailable && shortcutIndex > 0 ? (
                          <span className="va-launcher-shortcut">Alt + {shortcutIndex}</span>
                        ) : null}
                      </span>
                    </span>
                  </UiButton>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
