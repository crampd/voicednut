import {
  DASHBOARD_MODULE_ROUTE_CONTRACTS,
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
} from './miniappParityContracts.js';

import {
  describeAccessLevel,
  getCommandPageCatalog,
  resolveAccessLevelFromRole,
  type CommandPageCatalogEntry,
} from './commandPageCatalog.js';

export type MiniAppSessionRoleKey = 'admin' | 'operator' | 'viewer';

export type MiniAppAccessModeCopy = {
  title: string;
  description: string;
  unlockedLabel: string;
  lockedLabel: string;
};

export type MiniAppSupportLink = {
  title: string;
  description: string;
  to: string;
};

export type MiniAppCommandAccessSummary = {
  roleKey: MiniAppSessionRoleKey;
  accessLabel: string;
  commandAccessLevel: ReturnType<typeof resolveAccessLevelFromRole>;
  commandPages: CommandPageCatalogEntry[];
  readyCommandPages: CommandPageCatalogEntry[];
  lockedCommandPages: CommandPageCatalogEntry[];
  nextUnlockLabel: string;
};

export type MiniAppCommandInventoryModel = MiniAppCommandAccessSummary & {
  normalizedSearch: string;
  filteredCommandPages: CommandPageCatalogEntry[];
  filteredReadyCommandPages: CommandPageCatalogEntry[];
  filteredLockedCommandPages: CommandPageCatalogEntry[];
  matchedCount: number;
  matchedReadyCount: number;
  matchedLockedCount: number;
};

export const HOME_ACCESS_COPY: Record<'guest' | 'authorized' | 'admin', {
  title: string;
  description: string;
}> = {
  guest: {
    title: 'Preview before approval',
    description: 'Open routes stay obvious, locked routes stay visible, and each page explains what unlocks next.',
  },
  authorized: {
    title: 'Execution-ready access',
    description: 'Authorized workspaces stay one tap away while admin-only areas remain visible with clear escalation paths.',
  },
  admin: {
    title: 'Full operational surface',
    description: 'Every command page stays available from the same mobile-first shell, including governance and recovery routes.',
  },
};

export const LAUNCHER_ACCESS_COPY: Record<'guest' | 'authorized' | 'admin', MiniAppAccessModeCopy> = {
  guest: {
    title: 'Preview mode',
    description: 'Browse-safe pages stay open now. Locked workspaces remain visible so approval paths stay obvious instead of disappearing.',
    unlockedLabel: 'Open now',
    lockedLabel: 'Unlock after approval',
  },
  authorized: {
    title: 'Operator mode',
    description: 'Execution-ready workspaces come first, while admin-only pages stay visible with clear escalation language.',
    unlockedLabel: 'Ready now',
    lockedLabel: 'Admin only',
  },
  admin: {
    title: 'Admin mode',
    description: 'All Mini App pages stay directly available from one inventory, including command workspaces and governance surfaces.',
    unlockedLabel: 'Ready now',
    lockedLabel: 'Requires setup',
  },
};

export const ROLE_SUPPORT_COPY: Record<MiniAppSessionRoleKey, string> = {
  admin: 'Admin actions stay on the home screen, while access governance and incident follow-up stay one tap away.',
  operator: 'Keep the next task close, and use support surfaces for rules, help, and recovery.',
  viewer: 'The home screen stays browse-safe and explains what unlocks after approval.',
};

export const SUPPORT_LINKS_BY_ROLE: Record<MiniAppSessionRoleKey, MiniAppSupportLink[]> = {
  admin: [
    {
      title: 'Users & access',
      description: 'Review role assignments, access posture, and operator visibility.',
      to: DASHBOARD_MODULE_ROUTE_CONTRACTS.users,
    },
    {
      title: 'Incident center',
      description: 'Open the audit and incident workspace for active follow-up.',
      to: DASHBOARD_MODULE_ROUTE_CONTRACTS.audit,
    },
    {
      title: 'App settings',
      description: 'Open preferences, session controls, and recovery actions.',
      to: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
    },
  ],
  operator: [
    {
      title: 'Help Center',
      description: 'Open support guidance and the safest next step when something blocks work.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
    },
    {
      title: 'Operational rules',
      description: 'Review the main flows, safeguards, and fallback behavior before acting.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
    },
    {
      title: 'App settings',
      description: 'Open preferences, session controls, and recovery actions.',
      to: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
    },
  ],
  viewer: [
    {
      title: 'Request access',
      description: 'Open help and approval guidance for the capabilities this role cannot run yet.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
    },
    {
      title: 'How it works',
      description: 'Review the role-aware app entry flow and what becomes available after approval.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.START,
    },
    {
      title: 'Usage guide',
      description: 'See the main workflows before trying them from the home screen.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
    },
  ],
};

export function normalizeSessionRoleKey(sessionRole: string): MiniAppSessionRoleKey {
  const normalizedRole = sessionRole.trim().toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'operator') return 'operator';
  return 'viewer';
}

export function describeSessionRole(sessionRole: string): string {
  const roleKey = normalizeSessionRoleKey(sessionRole);
  if (roleKey === 'admin') return 'Admin access';
  if (roleKey === 'operator') return 'Authorized access';
  return 'Preview access';
}

export function describeSessionIdentityLabel(sessionRole: string): string {
  const roleKey = normalizeSessionRoleKey(sessionRole);
  if (roleKey === 'admin') return 'Admin session';
  if (roleKey === 'operator') return 'Authorized session';
  return 'Preview session';
}

export function describeSessionSource(sessionRole: string, sessionRoleSource: string): string {
  const roleKey = normalizeSessionRoleKey(sessionRole);
  const normalizedSource = sessionRoleSource.trim().toLowerCase();

  if (normalizedSource === 'dev_fixture') {
    if (roleKey === 'admin') return 'Fixture session with full command coverage';
    if (roleKey === 'operator') return 'Fixture session with authorized command coverage';
    return 'Fixture session with preview-only command coverage';
  }

  if (roleKey === 'admin') return 'Signed in for live operational control';
  if (roleKey === 'operator') return 'Signed in for day-to-day workflow execution';
  return 'Signed in for preview, guidance, and access review';
}

export function resolveCommandAccessSummary(sessionRole: string): MiniAppCommandAccessSummary {
  const roleKey = normalizeSessionRoleKey(sessionRole);
  const commandAccessLevel = resolveAccessLevelFromRole(sessionRole);
  const commandPages = getCommandPageCatalog(commandAccessLevel);
  const readyCommandPages = commandPages.filter((page) => page.hasCommandAccess);
  const lockedCommandPages = commandPages.filter((page) => !page.hasCommandAccess);

  return {
    roleKey,
    accessLabel: describeAccessLevel(commandAccessLevel),
    commandAccessLevel,
    commandPages,
    readyCommandPages,
    lockedCommandPages,
    nextUnlockLabel: lockedCommandPages[0]?.title || 'Everything available',
  };
}

function matchesCommandPageSearch(page: CommandPageCatalogEntry, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true;

  const haystack = [
    page.title,
    page.summary,
    page.availability,
    page.isAvailable ? 'ready available open' : 'locked unavailable',
  ].join(' ').toLowerCase();

  return haystack.includes(normalizedSearch);
}

export function resolveLauncherCommandInventory(
  sessionRole: string,
  searchTerm = '',
): MiniAppCommandInventoryModel {
  const summary = resolveCommandAccessSummary(sessionRole);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCommandPages = summary.commandPages.filter((page) => (
    matchesCommandPageSearch(page, normalizedSearch)
  ));
  const filteredReadyCommandPages = filteredCommandPages.filter((page) => page.isAvailable);
  const filteredLockedCommandPages = filteredCommandPages.filter((page) => !page.isAvailable);

  return {
    ...summary,
    normalizedSearch,
    filteredCommandPages,
    filteredReadyCommandPages,
    filteredLockedCommandPages,
    matchedCount: filteredCommandPages.length,
    matchedReadyCount: filteredReadyCommandPages.length,
    matchedLockedCount: filteredLockedCommandPages.length,
  };
}
