import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { UiButton, UiInput } from '@/components/ui/AdminPrimitives';
import { Link } from '@/components/Link/Link';
import {
  describeRequiredAccess,
} from '@/contracts/commandPageCatalog';
import { LAUNCHER_ACCESS_COPY, resolveLauncherCommandInventory } from '@/contracts/miniappAccessExperience';
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
  pinnedModules: DashboardModule[];
  recentModules: DashboardModule[];
  sessionRole: string;
  onSelectModule: (moduleId: DashboardModule) => void;
  onTogglePinnedModule: (moduleId: DashboardModule) => void;
  onOpenSettings: () => void;
  onRefreshDashboard: () => void;
};

type QuickActionItem = {
  id: string;
  title: string;
  detail: string;
  groupLabel: string;
  moduleId?: DashboardModule;
  actionLabel: string;
  onSelect: () => void;
  keywords: string;
};

export function DashboardWorkspaceLauncher({
  groupedVisibleModules,
  moduleShortcutIndexById,
  activeModule,
  pinnedModules,
  recentModules,
  sessionRole,
  onSelectModule,
  onTogglePinnedModule,
  onOpenSettings,
  onRefreshDashboard,
}: DashboardWorkspaceLauncherProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearchTerm, setPaletteSearchTerm] = useState('');
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredPaletteSearchTerm = useDeferredValue(paletteSearchTerm);
  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const normalizedPaletteSearch = deferredPaletteSearchTerm.trim().toLowerCase();
  const {
    accessLabel,
    commandAccessLevel,
    commandPages,
    filteredCommandPages,
    filteredReadyCommandPages,
    filteredLockedCommandPages,
    matchedCount: matchedCommandPages,
    matchedReadyCount: matchedReadyCommandPages,
  } = resolveLauncherCommandInventory(sessionRole, deferredSearchTerm);
  const accessModeCopy = LAUNCHER_ACCESS_COPY[commandAccessLevel];
  const moduleMetaById = new Map(
    groupedVisibleModules.flatMap((group) => group.modules.map((module) => ([
      module.id,
      {
        ...module,
        groupLabel: group.label,
      },
    ]))),
  );
  const filteredGroups = groupedVisibleModules
    .map((group) => ({
      ...group,
      modules: group.modules.filter((module) => {
        if (!normalizedSearch) {
          return true;
        }
        const context = MODULE_CONTEXT[module.id];
        const haystack = [
          module.label,
          group.label,
          group.subtitle,
          context.subtitle,
          context.detail,
          module.isAvailable ? 'ready' : 'locked',
        ].join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
    }))
    .filter((group) => group.modules.length > 0);
  const totalAreas = groupedVisibleModules.reduce((sum, group) => sum + group.modules.length, 0)
    + commandPages.length;
  const matchedAreas = filteredGroups.reduce((sum, group) => sum + group.modules.length, 0)
    + matchedCommandPages;
  const matchedReady = filteredGroups.reduce(
    (sum, group) => sum + group.modules.filter((module) => module.isAvailable).length,
    0,
  ) + matchedReadyCommandPages;
  const matchedLocked = matchedAreas - matchedReady;
  const pinnedQuickAccess = pinnedModules
    .map((moduleId) => moduleMetaById.get(moduleId))
    .filter((module): module is DashboardWorkspaceLauncherModule & { groupLabel: string } => module != null);
  const recentQuickAccess = recentModules
    .filter((moduleId) => !pinnedModules.includes(moduleId))
    .map((moduleId) => moduleMetaById.get(moduleId))
    .filter((module): module is DashboardWorkspaceLauncherModule & { groupLabel: string } => module != null);
  const paletteItems = useMemo<QuickActionItem[]>(() => {
    const commandItems: QuickActionItem[] = [
      {
        id: 'palette-command-refresh',
        title: 'Sync dashboard now',
        detail: 'Refresh live dashboard data and update the current overview state.',
        groupLabel: 'Commands',
        actionLabel: 'Refresh',
        onSelect: onRefreshDashboard,
        keywords: 'sync dashboard refresh reload latest live data poll',
      },
      {
        id: 'palette-command-settings',
        title: 'Open settings',
        detail: 'Adjust polling, inspect environment state, and review feature flags.',
        groupLabel: 'Commands',
        actionLabel: 'Open',
        onSelect: onOpenSettings,
        keywords: 'settings preferences polling feature flags environment config',
      },
    ];
    const moduleItems = groupedVisibleModules.flatMap((group) => group.modules
      .filter((module) => module.isAvailable)
      .map((module) => {
        const shortcutIndex = moduleShortcutIndexById[module.id];
        const isPinned = pinnedModules.includes(module.id);
        const isRecent = recentModules.includes(module.id);
        const context = MODULE_CONTEXT[module.id];
        return {
          id: `palette-module-${module.id}`,
          title: module.label,
          detail: [
            context.subtitle,
            context.detail,
            isPinned ? 'Pinned area' : null,
            isRecent ? 'Recent area' : null,
            shortcutIndex ? `Alt + ${shortcutIndex}` : null,
          ].filter(Boolean).join(' · '),
          groupLabel: group.label,
          moduleId: module.id,
          actionLabel: activeModule === module.id ? 'Continue' : 'Open',
          onSelect: () => onSelectModule(module.id),
          keywords: [
            module.label,
            group.label,
            group.subtitle,
            context.subtitle,
            context.detail,
            isPinned ? 'pinned' : '',
            isRecent ? 'recent' : '',
          ].join(' ').toLowerCase(),
        } satisfies QuickActionItem;
      }));
    return commandItems.concat(moduleItems);
  }, [
    activeModule,
    groupedVisibleModules,
    moduleShortcutIndexById,
    onOpenSettings,
    onRefreshDashboard,
    onSelectModule,
    pinnedModules,
    recentModules,
  ]);
  const filteredPaletteItems = useMemo(() => {
    if (!normalizedPaletteSearch) {
      return paletteItems.slice(0, 9);
    }
    return paletteItems
      .filter((item) => (
        item.title.toLowerCase().includes(normalizedPaletteSearch)
        || item.detail.toLowerCase().includes(normalizedPaletteSearch)
        || item.keywords.includes(normalizedPaletteSearch)
        || item.groupLabel.toLowerCase().includes(normalizedPaletteSearch)
      ))
      .slice(0, 9);
  }, [normalizedPaletteSearch, paletteItems]);
  const selectedPaletteItem = filteredPaletteItems[activePaletteIndex] || filteredPaletteItems[0] || null;

  useEffect(() => {
    if (!paletteOpen) return;
    setActivePaletteIndex(0);
  }, [normalizedPaletteSearch, paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    paletteInputRef.current?.focus();
  }, [paletteOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (!paletteOpen) return;
      if (key === 'escape') {
        event.preventDefault();
        setPaletteOpen(false);
        setPaletteSearchTerm('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [paletteOpen]);

  const closePalette = (): void => {
    setPaletteOpen(false);
    setPaletteSearchTerm('');
  };

  const handlePaletteSelect = (item: QuickActionItem): void => {
    item.onSelect();
    closePalette();
  };

  const hasMatches = filteredGroups.length > 0 || filteredCommandPages.length > 0;

  return (
    <section className="va-overview-launcher" aria-labelledby="va-overview-launcher-title">
      <div className="va-overview-head va-launcher-head">
        <div>
          <h2 id="va-overview-launcher-title" className="va-section-title">All areas</h2>
          <p className="va-muted">
            Open the area that matches the task in front of you, including command pages like Call, Scripts, SMS, Email, Guide, Health, and Status.
          </p>
        </div>
        <div className="va-launcher-toolbar">
          <span className="va-launcher-summary">
            {matchedAreas} of {totalAreas} areas
            {' · '}
            {matchedReady} ready
            {' · '}
            {matchedLocked} locked
          </span>
          <UiInput
            className="va-launcher-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search areas, tasks, or controls"
            aria-label="Search dashboard areas"
          />
          <UiButton
            variant="plain"
            className="va-launcher-palette-trigger"
            onClick={() => setPaletteOpen(true)}
          >
            <span>Quick actions</span>
            <span className="va-launcher-palette-shortcut">Ctrl/⌘ K</span>
          </UiButton>
        </div>
      </div>
      {paletteOpen ? (
        <div
          className="va-launcher-palette-backdrop"
          onClick={() => closePalette()}
          aria-hidden="true"
        />
      ) : null}
      {paletteOpen ? (
        <div
          className="va-launcher-palette"
          role="dialog"
          aria-modal="true"
          aria-labelledby="va-launcher-palette-title"
        >
          <div className="va-launcher-palette-head">
            <div>
              <h3 id="va-launcher-palette-title" className="va-launcher-palette-title">
                Quick actions
              </h3>
              <p className="va-muted va-launcher-palette-copy">
                Search areas, open settings, or force a fresh sync without leaving the overview.
              </p>
            </div>
            <button
              type="button"
              className="va-launcher-palette-close"
              aria-label="Close quick actions"
              onClick={() => closePalette()}
            >
              ×
            </button>
          </div>
          <UiInput
            ref={paletteInputRef}
            className="va-launcher-palette-input"
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            value={paletteSearchTerm}
            onChange={(event) => setPaletteSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActivePaletteIndex((prev) => (
                  filteredPaletteItems.length > 0
                    ? Math.min(prev + 1, filteredPaletteItems.length - 1)
                    : 0
                ));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActivePaletteIndex((prev) => Math.max(prev - 1, 0));
              } else if (event.key === 'Enter' && selectedPaletteItem) {
                event.preventDefault();
                handlePaletteSelect(selectedPaletteItem);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                closePalette();
              }
            }}
            placeholder="Search actions, areas, or workspace names"
            aria-label="Search quick actions"
          />
          {filteredPaletteItems.length > 0 ? (
            <div className="va-launcher-palette-list" role="listbox" aria-label="Quick actions">
              {filteredPaletteItems.map((item, index) => {
                const isSelected = index === activePaletteIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={['va-launcher-palette-item', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                    onMouseEnter={() => setActivePaletteIndex(index)}
                    onClick={() => handlePaletteSelect(item)}
                  >
                    <span
                      className="va-launcher-palette-glyph"
                      data-module={item.moduleId || 'ops'}
                      aria-hidden
                    >
                      {item.moduleId ? moduleGlyph(item.moduleId) : '⌘'}
                    </span>
                    <span className="va-launcher-palette-item-copy">
                      <span className="va-launcher-palette-item-head">
                        <strong>{item.title}</strong>
                        <span className="va-launcher-palette-item-action">{item.actionLabel}</span>
                      </span>
                      <span>{item.detail}</span>
                    </span>
                    <span className="va-launcher-palette-item-group">{item.groupLabel}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="va-home-empty-panel va-launcher-palette-empty" role="status">
              <strong>No matching actions</strong>
              <p className="va-muted">
                Try a workspace name, “settings”, “sync”, or a task keyword.
              </p>
            </div>
          )}
        </div>
      ) : null}
      <div className="va-launcher-quick-access" aria-labelledby="va-launcher-quick-access-title">
        <div className="va-launcher-quick-access-head">
          <div>
            <h3 id="va-launcher-quick-access-title" className="va-launcher-quick-access-title">
              Quick access
            </h3>
            <p className="va-muted va-launcher-quick-access-copy">
              Pin the areas you revisit most. Recent areas update automatically as you move through the dashboard.
            </p>
          </div>
          <span className="va-meta-chip">
            {pinnedQuickAccess.length} pinned
            {' · '}
            {recentQuickAccess.length} recent
          </span>
        </div>
        <div className="va-launcher-quick-groups">
          <section className="va-launcher-quick-group" aria-labelledby="va-launcher-quick-pinned-title">
            <div className="va-launcher-quick-group-head">
              <h4 id="va-launcher-quick-pinned-title" className="va-launcher-quick-group-title">Pinned</h4>
              <span className="va-launcher-quick-group-meta">Your working set</span>
            </div>
            {pinnedQuickAccess.length > 0 ? (
              <div className="va-launcher-quick-row">
                {pinnedQuickAccess.map((module) => {
                  const isActive = activeModule === module.id;
                  return (
                    <UiButton
                      key={`launcher-pinned-${module.id}`}
                      variant="plain"
                      className={['va-launcher-chip', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                      aria-pressed={isActive}
                      onClick={() => onSelectModule(module.id)}
                    >
                      <span className="va-launcher-chip-glyph" data-module={module.id} aria-hidden>{moduleGlyph(module.id)}</span>
                      <span className="va-launcher-chip-copy">
                        <strong>{module.label}</strong>
                        <span>{module.groupLabel}</span>
                      </span>
                    </UiButton>
                  );
                })}
              </div>
            ) : (
              <p className="va-muted va-launcher-quick-empty">
                Pin the areas you return to most to keep them one tap away.
              </p>
            )}
          </section>
          {recentQuickAccess.length > 0 ? (
            <section className="va-launcher-quick-group" aria-labelledby="va-launcher-quick-recent-title">
              <div className="va-launcher-quick-group-head">
                <h4 id="va-launcher-quick-recent-title" className="va-launcher-quick-group-title">Recent</h4>
                <span className="va-launcher-quick-group-meta">Last visited</span>
              </div>
              <div className="va-launcher-quick-row">
                {recentQuickAccess.map((module) => {
                  const isActive = activeModule === module.id;
                  return (
                    <UiButton
                      key={`launcher-recent-${module.id}`}
                      variant="plain"
                      className={['va-launcher-chip', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                      aria-pressed={isActive}
                      onClick={() => onSelectModule(module.id)}
                    >
                      <span className="va-launcher-chip-glyph" data-module={module.id} aria-hidden>{moduleGlyph(module.id)}</span>
                      <span className="va-launcher-chip-copy">
                        <strong>{module.label}</strong>
                        <span>{MODULE_CONTEXT[module.id].subtitle}</span>
                      </span>
                    </UiButton>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
      <div className={`va-launcher-access-mode va-launcher-access-mode-${commandAccessLevel}`}>
        <div className="va-launcher-access-copy">
          <strong>{accessModeCopy.title}</strong>
          <span>{accessModeCopy.description}</span>
        </div>
        <div className="va-launcher-access-metrics" aria-label="Mini App page access summary">
          <span className="va-launcher-access-chip">{accessLabel}</span>
          <span className="va-launcher-access-chip">{filteredReadyCommandPages.length} open now</span>
          <span className="va-launcher-access-chip">{filteredLockedCommandPages.length} locked</span>
        </div>
      </div>
      {filteredGroups.length > 0 ? (
        <div className="va-launcher-groups">
          {filteredCommandPages.length > 0 ? (
            <section className="va-launcher-group">
              <div className="va-launcher-group-head">
                <div className="va-launcher-group-copy">
                  <h3 className="va-launcher-group-title">Mini App pages</h3>
                  <p className="va-muted va-launcher-group-subtitle">
                    Direct access to the full command-page surface exposed by the bot, not a curated subset.
                  </p>
                </div>
                <span className="va-meta-chip">
                  {filteredReadyCommandPages.length} ready
                  {' · '}
                  {filteredLockedCommandPages.length} locked
                </span>
              </div>
              {filteredReadyCommandPages.length > 0 ? (
                <div className="va-launcher-page-section">
                  <div className="va-launcher-page-section-head">
                    <strong className="va-launcher-page-section-title">{accessModeCopy.unlockedLabel}</strong>
                    <span className="va-launcher-page-section-copy">
                      {commandAccessLevel === 'guest'
                        ? 'Safe entry points and browse-friendly routes available in this session.'
                        : 'Execution-ready pages available from this session right now.'}
                    </span>
                  </div>
                  <div className="va-launcher-grid">
                    {filteredReadyCommandPages.map((page) => {
                      const cardContent = (
                        <>
                          <span className="va-launcher-glyph" aria-hidden>{page.glyph}</span>
                          <span className="va-launcher-copy">
                            <span className="va-launcher-copy-top">
                              <strong>{page.title}</strong>
                            </span>
                            <span>{page.summary}</span>
                            <span className="va-launcher-footer">
                              <span className="va-launcher-state-hint">Open page</span>
                              <span className="va-launcher-shortcut">{page.availability}</span>
                            </span>
                          </span>
                        </>
                      );
                      return (
                        <div
                          key={`command-page-ready-${page.id}`}
                          className="va-launcher-card-shell"
                          data-module={`command-${page.id.toLowerCase()}`}
                        >
                          <Link
                            to={page.routePath}
                            className="va-launcher-card"
                            aria-label={`Open ${page.title}`}
                          >
                            {cardContent}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {filteredLockedCommandPages.length > 0 ? (
                <div className="va-launcher-page-section">
                  <div className="va-launcher-page-section-head">
                    <strong className="va-launcher-page-section-title">{accessModeCopy.lockedLabel}</strong>
                    <span className="va-launcher-page-section-copy">
                      Pages stay visible so role boundaries are clear and approval paths stay easy to understand.
                    </span>
                  </div>
                  <div className="va-launcher-grid">
                    {filteredLockedCommandPages.map((page) => {
                      const stateHint = page.hasCommandAccess ? 'Unavailable' : describeRequiredAccess(page.requiredAccess);
                      return (
                        <div
                          key={`command-page-locked-${page.id}`}
                          className="va-launcher-card-shell"
                          data-module={`command-${page.id.toLowerCase()}`}
                        >
                          <div className="va-launcher-card is-locked" aria-disabled="true">
                            <span className="va-launcher-glyph" aria-hidden>{page.glyph}</span>
                            <span className="va-launcher-copy">
                              <span className="va-launcher-copy-top">
                                <strong>{page.title}</strong>
                                <span className="va-launcher-state is-locked">
                                  {page.hasCommandAccess ? 'Unavailable' : 'Locked'}
                                </span>
                              </span>
                              <span>{page.summary}</span>
                              <span className="va-launcher-footer">
                                <span className="va-launcher-state-hint">{stateHint}</span>
                                <span className="va-launcher-shortcut">{page.availability}</span>
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
          {filteredGroups.map((group) => (
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
                  const isPinned = pinnedModules.includes(module.id);
                  const stateHint = module.isAvailable
                    ? (isActive ? 'Continue here' : 'Open area')
                    : 'Request access';
                  return (
                    <div
                      key={`launcher-${module.id}`}
                      className="va-launcher-card-shell"
                      data-module={module.id}
                    >
                      {module.isAvailable ? (
                        <button
                          type="button"
                          className={['va-launcher-pin', isPinned ? 'is-active' : ''].filter(Boolean).join(' ')}
                          aria-label={isPinned ? `Unpin ${module.label}` : `Pin ${module.label}`}
                          aria-pressed={isPinned}
                          onClick={() => onTogglePinnedModule(module.id)}
                        >
                          {isPinned ? '★' : '☆'}
                        </button>
                      ) : null}
                      <UiButton
                        id={`va-launcher-module-${module.id}`}
                        variant="plain"
                        data-module={module.id}
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
                        <span className="va-launcher-glyph" data-module={module.id} aria-hidden>{moduleGlyph(module.id)}</span>
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
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : filteredCommandPages.length > 0 ? (
        <div className="va-launcher-groups">
          <section className="va-launcher-group">
            <div className="va-launcher-group-head">
              <div className="va-launcher-group-copy">
                <h3 className="va-launcher-group-title">Mini App pages</h3>
                <p className="va-muted va-launcher-group-subtitle">
                  Direct access to the full command-page surface exposed by the bot, not a curated subset.
                </p>
              </div>
              <span className="va-meta-chip">
                {filteredCommandPages.filter((page) => page.isAvailable).length} ready
                {' · '}
                {filteredCommandPages.filter((page) => !page.isAvailable).length} locked
              </span>
            </div>
            <div className="va-launcher-grid">
              {filteredCommandPages.map((page) => {
                const stateHint = page.isAvailable
                  ? 'Open page'
                  : page.hasCommandAccess
                    ? 'Unavailable'
                    : 'Request access';
                const cardContent = (
                  <>
                    <span className="va-launcher-glyph" aria-hidden>{page.glyph}</span>
                    <span className="va-launcher-copy">
                      <span className="va-launcher-copy-top">
                        <strong>{page.title}</strong>
                        {!page.isAvailable ? (
                          <span className="va-launcher-state is-locked">
                            {page.hasCommandAccess ? 'Unavailable' : 'Locked'}
                          </span>
                        ) : null}
                      </span>
                      <span>{page.summary}</span>
                      <span className="va-launcher-footer">
                        <span className="va-launcher-state-hint">{stateHint}</span>
                        <span className="va-launcher-shortcut">{page.availability}</span>
                      </span>
                    </span>
                  </>
                );
                const cardClassName = [
                  'va-launcher-card',
                  page.isAvailable ? '' : 'is-locked',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={`command-page-${page.id}`}
                    className="va-launcher-card-shell"
                    data-module={`command-${page.id.toLowerCase()}`}
                  >
                    {page.isAvailable && page.routePath ? (
                      <Link
                        to={page.routePath}
                        className={cardClassName}
                        aria-label={`Open ${page.title}`}
                      >
                        {cardContent}
                      </Link>
                    ) : (
                      <div className={cardClassName} aria-disabled="true">
                        {cardContent}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : hasMatches ? null : (
        <div className="va-home-empty-panel va-launcher-empty" role="status">
          <strong>No matching areas</strong>
          <p className="va-muted">
            No area matches “{searchTerm.trim()}”. Try a module name, task, or control keyword.
          </p>
        </div>
      )}
    </section>
  );
}
