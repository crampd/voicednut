import {
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  type MiniAppCommandAccessLevel,
} from './miniappParityContracts.js';

type CommandPageCatalogPageId = keyof typeof MINIAPP_COMMAND_PAGE_CONTRACTS;

export type CommandPageCatalogEntry = {
  id: CommandPageCatalogPageId;
  title: string;
  summary: string;
  routePath: string;
  requiredAccess: MiniAppCommandAccessLevel;
  availability: string;
  hasCommandAccess: boolean;
  isAvailable: boolean;
  glyph: string;
};

const COMMAND_PAGE_UI_TITLES: Record<CommandPageCatalogPageId, string> = {
  START: 'Home',
  CALL: 'Call Workspace',
  SMS: 'Messaging Workspace',
  HELP: 'Help Center',
  EMAIL: 'Email Workspace',
  SCRIPTS: 'Scripts Workspace',
  MENU: 'Quick Actions',
  GUIDE: 'Usage Guide',
  HEALTH: 'System Health',
  STATUS: 'Incident Status',
};

const COMMAND_PAGE_GLYPHS: Record<CommandPageCatalogPageId, string> = {
  START: 'ST',
  CALL: 'CL',
  SMS: 'SM',
  HELP: 'HP',
  EMAIL: 'EM',
  SCRIPTS: 'SC',
  MENU: 'ME',
  GUIDE: 'GU',
  HEALTH: 'HL',
  STATUS: 'ST',
};

export function hasCommandPageAccess(
  required: MiniAppCommandAccessLevel,
  current: MiniAppCommandAccessLevel,
): boolean {
  if (required === 'guest') return true;
  if (required === 'authorized') return current === 'authorized' || current === 'admin';
  return current === 'admin';
}

export function resolveAccessLevelFromRole(role: string): MiniAppCommandAccessLevel {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole && normalizedRole !== 'viewer') return 'authorized';
  return 'guest';
}

export function resolveCommandPageTitle(pageId: CommandPageCatalogPageId): string {
  return COMMAND_PAGE_UI_TITLES[pageId];
}

export function describeAccessLevel(accessLevel: MiniAppCommandAccessLevel): string {
  switch (accessLevel) {
    case 'admin':
      return 'Admin access';
    case 'authorized':
      return 'Authorized access';
    default:
      return 'Guest access';
  }
}

export function describeRequiredAccess(accessLevel: MiniAppCommandAccessLevel): string {
  switch (accessLevel) {
    case 'admin':
      return 'Admin approval required';
    case 'authorized':
      return 'Approval required';
    default:
      return 'Open now';
  }
}

export function getCommandPageCatalog(accessLevel: MiniAppCommandAccessLevel): CommandPageCatalogEntry[] {
  return (Object.entries(MINIAPP_COMMAND_PAGE_CONTRACTS) as [CommandPageCatalogPageId, typeof MINIAPP_COMMAND_PAGE_CONTRACTS[CommandPageCatalogPageId]][])
    .map(([id, page]) => {
      const action = MINIAPP_COMMAND_ACTION_CONTRACTS[id];
      const routePath = action?.routePath || page.path;
      const hasCommandAccess = action ? hasCommandPageAccess(action.minAccess, accessLevel) : false;
      return {
        id,
        title: resolveCommandPageTitle(id),
        summary: page.summary,
        routePath,
        requiredAccess: action?.minAccess ?? 'guest',
        availability: action?.availability ?? page.workflowStatus,
        hasCommandAccess,
        isAvailable: Boolean(routePath) && hasCommandAccess,
        glyph: COMMAND_PAGE_GLYPHS[id],
      };
    });
}
