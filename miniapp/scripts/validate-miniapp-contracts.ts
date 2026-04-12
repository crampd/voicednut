import {
  HOME_ACCESS_COPY,
  LAUNCHER_ACCESS_COPY,
  ROLE_SUPPORT_COPY,
  SUPPORT_LINKS_BY_ROLE,
  describeSessionIdentityLabel,
  describeSessionRole,
  describeSessionSource,
  normalizeSessionRoleKey,
  resolveCommandAccessSummary,
  resolveLauncherCommandInventory,
} from '../src/contracts/miniappAccessExperience.js';
import {
  getCommandPageCatalog as getCatalogEntries,
  hasCommandPageAccess,
  resolveAccessLevelFromRole,
  resolveCommandPageTitle,
} from '../src/contracts/commandPageCatalog.js';
import {
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
  type MiniAppCommandAccessLevel,
} from '../src/contracts/miniappParityContracts.js';

const ACCESS_LEVELS: readonly MiniAppCommandAccessLevel[] = ['guest', 'authorized', 'admin'];
const REQUIRED_COMMAND_PAGE_IDS = [
  'START',
  'CALL',
  'SMS',
  'EMAIL',
  'SCRIPTS',
  'HELP',
  'MENU',
  'GUIDE',
  'HEALTH',
  'STATUS',
] as const;
const EXPECTED_READY_PAGE_IDS_BY_ROLE = {
  viewer: ['START', 'HELP', 'MENU', 'GUIDE'],
  operator: ['START', 'CALL', 'SMS', 'HELP', 'EMAIL', 'MENU', 'GUIDE', 'HEALTH'],
  admin: ['START', 'CALL', 'SMS', 'EMAIL', 'SCRIPTS', 'HELP', 'MENU', 'GUIDE', 'HEALTH', 'STATUS'],
} as const;
const EXPECTED_LOCKED_PAGE_IDS_BY_ROLE = {
  viewer: ['CALL', 'SMS', 'EMAIL', 'SCRIPTS', 'HEALTH', 'STATUS'],
  operator: ['SCRIPTS', 'STATUS'],
  admin: [],
} as const;

function fail(message: string): never {
  throw new Error(`[miniapp contract validation] ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }
    seen.add(value);
  });

  assert(duplicates.size === 0, `${label} contains duplicates: ${Array.from(duplicates).join(', ')}`);
}

function sortValues(values: readonly string[]): string[] {
  return [...values].sort();
}

function validateRoleResolution(): void {
  assert(resolveAccessLevelFromRole('admin') === 'admin', 'admin role should resolve to admin access');
  assert(resolveAccessLevelFromRole('operator') === 'authorized', 'non-viewer roles should resolve to authorized access');
  assert(resolveAccessLevelFromRole('viewer') === 'guest', 'viewer role should resolve to guest access');
  assert(resolveAccessLevelFromRole('') === 'guest', 'empty role should resolve to guest access');
  assert(normalizeSessionRoleKey('admin') === 'admin', 'admin should normalize to admin session role');
  assert(normalizeSessionRoleKey('operator') === 'operator', 'operator should normalize to operator session role');
  assert(normalizeSessionRoleKey('viewer') === 'viewer', 'viewer should normalize to viewer session role');
  assert(normalizeSessionRoleKey('guest') === 'viewer', 'guest should normalize to viewer session role');
}

function validateCatalogShape(): void {
  const contractIds = Object.keys(MINIAPP_COMMAND_PAGE_CONTRACTS);
  const contractIdSet = new Set(contractIds);
  const actionIdSet = new Set(Object.keys(MINIAPP_COMMAND_ACTION_CONTRACTS));

  REQUIRED_COMMAND_PAGE_IDS.forEach((pageId) => {
    assert(contractIdSet.has(pageId), `required command page "${pageId}" is missing from page contracts`);
    assert(pageId in MINIAPP_COMMAND_ROUTE_CONTRACTS, `required command page "${pageId}" is missing from route contracts`);
    assert(pageId in MINIAPP_COMMAND_ACTION_CONTRACTS, `required command page "${pageId}" is missing from action contracts`);
  });

  ACCESS_LEVELS.forEach((accessLevel) => {
    const catalog = getCatalogEntries(accessLevel);

    assert(catalog.length === contractIds.length, `${accessLevel} catalog size drifted from command page contracts`);
    assertUnique(catalog.map((entry) => entry.id), `${accessLevel} catalog ids`);
    assertUnique(catalog.map((entry) => entry.title), `${accessLevel} catalog titles`);

    catalog.forEach((entry) => {
      const pageContract = MINIAPP_COMMAND_PAGE_CONTRACTS[entry.id];
      const actionContract = MINIAPP_COMMAND_ACTION_CONTRACTS[entry.id];
      const routeContract = MINIAPP_COMMAND_ROUTE_CONTRACTS[entry.id];

      assert(Boolean(entry.glyph.trim()), `catalog entry "${entry.id}" is missing a glyph`);
      assert(entry.summary === pageContract.summary, `catalog entry "${entry.id}" summary drifted from page contract`);
      assert(entry.routePath === routeContract, `catalog entry "${entry.id}" route drifted from route contract`);
      assert(entry.routePath === actionContract.routePath, `catalog entry "${entry.id}" route drifted from action contract`);
      assert(entry.title === resolveCommandPageTitle(entry.id), `catalog entry "${entry.id}" title drifted from title resolver`);
      assert(entry.availability === actionContract.availability, `catalog entry "${entry.id}" availability drifted from action contract`);
      assert(
        entry.hasCommandAccess === hasCommandPageAccess(actionContract.minAccess, accessLevel),
        `catalog entry "${entry.id}" access drifted from action contract`,
      );
      assert(
        entry.isAvailable === (Boolean(entry.routePath) && entry.hasCommandAccess),
        `catalog entry "${entry.id}" availability flag drifted from route/access state`,
      );
    });
  });

  Object.entries(MINIAPP_COMMAND_PAGE_CONTRACTS).forEach(([pageId, pageContract]) => {
    assertUnique(pageContract.actionIds, `${pageId} action ids`);
    pageContract.actionIds.forEach((actionId) => {
      assert(
        actionIdSet.has(actionId),
        `page contract "${pageId}" references missing action "${actionId}"`,
      );
    });
  });
}

function validateAccessMonotonicity(): void {
  const guestCatalog = getCatalogEntries('guest');
  const authorizedCatalog = getCatalogEntries('authorized');
  const adminCatalog = getCatalogEntries('admin');

  const byId = (catalog: ReturnType<typeof getCatalogEntries>) =>
    Object.fromEntries(catalog.map((entry) => [entry.id, entry])) as Record<
      (typeof guestCatalog)[number]['id'],
      (typeof guestCatalog)[number]
    >;

  const guestById = byId(guestCatalog);
  const authorizedById = byId(authorizedCatalog);
  const adminById = byId(adminCatalog);

  REQUIRED_COMMAND_PAGE_IDS.forEach((pageId) => {
    assert(adminById[pageId].isAvailable, `required page "${pageId}" should be available for admin inventory`);
  });

  Object.keys(MINIAPP_COMMAND_PAGE_CONTRACTS).forEach((pageId) => {
    const id = pageId as keyof typeof MINIAPP_COMMAND_PAGE_CONTRACTS;
    const guestVisible = guestById[id].isAvailable;
    const authorizedVisible = authorizedById[id].isAvailable;
    const adminVisible = adminById[id].isAvailable;

    assert(!guestVisible || authorizedVisible, `page "${id}" is visible to guests but hidden from authorized users`);
    assert(!authorizedVisible || adminVisible, `page "${id}" is visible to authorized users but hidden from admins`);
  });
}

function validateAccessExperience(): void {
  (['guest', 'authorized', 'admin'] as const).forEach((accessLevel) => {
    const homeCopy = HOME_ACCESS_COPY[accessLevel];
    const launcherCopy = LAUNCHER_ACCESS_COPY[accessLevel];

    assert(Boolean(homeCopy.title.trim()), `${accessLevel} home access title is empty`);
    assert(Boolean(homeCopy.description.trim()), `${accessLevel} home access description is empty`);
    assert(Boolean(launcherCopy.title.trim()), `${accessLevel} launcher title is empty`);
    assert(Boolean(launcherCopy.description.trim()), `${accessLevel} launcher description is empty`);
    assert(Boolean(launcherCopy.unlockedLabel.trim()), `${accessLevel} launcher unlocked label is empty`);
    assert(Boolean(launcherCopy.lockedLabel.trim()), `${accessLevel} launcher locked label is empty`);
  });

  (['admin', 'operator', 'viewer'] as const).forEach((roleKey) => {
    const summary = resolveCommandAccessSummary(roleKey);
    const launcherInventory = resolveLauncherCommandInventory(roleKey);
    const expectedReadyIds = EXPECTED_READY_PAGE_IDS_BY_ROLE[roleKey];
    const expectedLockedIds = EXPECTED_LOCKED_PAGE_IDS_BY_ROLE[roleKey];
    const actualReadyIds = summary.readyCommandPages.map((page) => page.id);
    const actualLockedIds = summary.lockedCommandPages.map((page) => page.id);

    assert(summary.roleKey === roleKey, `${roleKey} summary role key drifted`);
    assert(
      summary.commandPages.length === getCatalogEntries(summary.commandAccessLevel).length,
      `${roleKey} summary catalog length drifted`,
    );
    assert(
      summary.readyCommandPages.length + summary.lockedCommandPages.length === summary.commandPages.length,
      `${roleKey} summary counts do not reconcile`,
    );
    assert(
      sortValues(actualReadyIds).join(',') === sortValues(expectedReadyIds).join(','),
      `${roleKey} ready inventory drifted: expected [${expectedReadyIds.join(', ')}], received [${actualReadyIds.join(', ')}]`,
    );
    assert(
      sortValues(actualLockedIds).join(',') === sortValues(expectedLockedIds).join(','),
      `${roleKey} locked inventory drifted: expected [${expectedLockedIds.join(', ')}], received [${actualLockedIds.join(', ')}]`,
    );
    assert(
      summary.nextUnlockLabel === (summary.lockedCommandPages[0]?.title || 'Everything available'),
      `${roleKey} next unlock label drifted from locked inventory`,
    );
    assert(
      launcherInventory.filteredCommandPages.length === summary.commandPages.length,
      `${roleKey} launcher inventory drifted from command catalog length`,
    );
    assert(
      launcherInventory.matchedCount === summary.commandPages.length,
      `${roleKey} launcher matched count drifted without search`,
    );
    assert(
      launcherInventory.matchedReadyCount === summary.readyCommandPages.length,
      `${roleKey} launcher ready count drifted without search`,
    );
    assert(
      launcherInventory.matchedLockedCount === summary.lockedCommandPages.length,
      `${roleKey} launcher locked count drifted without search`,
    );
    assert(
      sortValues(launcherInventory.filteredReadyCommandPages.map((page) => page.id)).join(',')
      === sortValues(expectedReadyIds).join(','),
      `${roleKey} launcher ready inventory drifted`,
    );
    assert(
      sortValues(launcherInventory.filteredLockedCommandPages.map((page) => page.id)).join(',')
      === sortValues(expectedLockedIds).join(','),
      `${roleKey} launcher locked inventory drifted`,
    );
    assert(Boolean(ROLE_SUPPORT_COPY[roleKey].trim()), `${roleKey} support copy is empty`);
    assert(SUPPORT_LINKS_BY_ROLE[roleKey].length > 0, `${roleKey} support links are missing`);
    SUPPORT_LINKS_BY_ROLE[roleKey].forEach((link, index) => {
      assert(Boolean(link.title.trim()), `${roleKey} support link ${index + 1} title is empty`);
      assert(Boolean(link.description.trim()), `${roleKey} support link ${index + 1} description is empty`);
      assert(Boolean(link.to.trim()), `${roleKey} support link ${index + 1} route is empty`);
    });
  });

  assert(describeSessionIdentityLabel('admin') === 'Admin session', 'admin identity label drifted');
  assert(describeSessionIdentityLabel('operator') === 'Authorized session', 'operator identity label drifted');
  assert(describeSessionIdentityLabel('viewer') === 'Preview session', 'viewer identity label drifted');
  assert(describeSessionRole('admin') === 'Admin access', 'admin access label drifted');
  assert(describeSessionRole('operator') === 'Authorized access', 'operator access label drifted');
  assert(describeSessionRole('viewer') === 'Preview access', 'viewer access label drifted');
  assert(
    describeSessionSource('viewer', 'dev_fixture') === 'Fixture session with preview-only command coverage',
    'viewer fixture source label drifted',
  );
  assert(
    describeSessionSource('operator', 'live_session') === 'Signed in for day-to-day workflow execution',
    'operator live source label drifted',
  );

  const viewerSearchInventory = resolveLauncherCommandInventory('viewer', 'call');
  assert(
    viewerSearchInventory.matchedCount === 1 && viewerSearchInventory.filteredLockedCommandPages[0]?.id === 'CALL',
    'viewer launcher search for "call" should isolate the locked Call page',
  );
  const adminSearchInventory = resolveLauncherCommandInventory('admin', 'status');
  assert(
    adminSearchInventory.matchedCount === 1 && adminSearchInventory.filteredReadyCommandPages[0]?.id === 'STATUS',
    'admin launcher search for "status" should isolate the ready Status page',
  );
}

function main(): void {
  validateRoleResolution();
  validateCatalogShape();
  validateAccessMonotonicity();
  validateAccessExperience();

  const adminCatalog = getCatalogEntries('admin');
  const visibleTitles = adminCatalog
    .filter((entry) => entry.isAvailable)
    .map((entry) => `${entry.title} (${entry.routePath})`)
    .join(', ');

  console.log(`Validated ${adminCatalog.length} command pages. Admin inventory: ${visibleTitles}`);
}

main();
