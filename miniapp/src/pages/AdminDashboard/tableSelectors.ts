import type { AuditRow, IncidentRow, JsonRecord, UserRow } from './types';

type ToTextFn = (value: unknown, fallback?: string) => string;
type ToIntFn = (value: unknown, fallback?: number) => number;
type AsRecordFn = (value: unknown) => JsonRecord;
type SelectorParams = Record<string, unknown>;

export type UserRoleFilter = 'all' | 'admin' | 'operator' | 'viewer';
export type UserSortBy = 'last_activity' | 'total_calls' | 'role';
export type UserSortDir = 'asc' | 'desc';

function areSelectorParamsEqual(prev: SelectorParams, next: SelectorParams): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!Object.is(prev[key], next[key])) return false;
  }
  return true;
}

function createMemoizedSelector<Params extends SelectorParams, Result>(
  selector: (params: Params) => Result,
): (params: Params) => Result {
  let hasCachedResult = false;
  let cachedParams = {} as Params;
  let cachedResult = {} as Result;

  return (params: Params): Result => {
    if (hasCachedResult && areSelectorParamsEqual(cachedParams, params)) {
      return cachedResult;
    }
    const nextResult = selector(params);
    cachedParams = params;
    cachedResult = nextResult;
    hasCachedResult = true;
    return nextResult;
  };
}

export function selectUsersRows(params: {
  usersRows: UserRow[];
  roleFilter: UserRoleFilter;
  userSearch: string;
  userSortBy: UserSortBy;
  userSortDir: UserSortDir;
  toText: ToTextFn;
  toInt: ToIntFn;
}): UserRow[] {
  const {
    usersRows,
    roleFilter,
    userSearch,
    userSortBy,
    userSortDir,
    toText,
    toInt,
  } = params;
  const query = String(userSearch || '').trim().toLowerCase();
  const filtered = usersRows.filter((user) => {
    const role = toText(user.role, 'viewer').toLowerCase();
    if (roleFilter !== 'all' && role !== roleFilter) return false;
    if (!query) return true;
    const telegramId = toText(user.telegram_id, '').toLowerCase();
    const username = toText(user.username, '').toLowerCase();
    const roleSource = toText(user.role_source, '').toLowerCase();
    return telegramId.includes(query)
      || username.includes(query)
      || role.includes(query)
      || roleSource.includes(query);
  });

  const direction = userSortDir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    if (userSortBy === 'last_activity') {
      const aTime = Date.parse(toText(a.last_activity, ''));
      const bTime = Date.parse(toText(b.last_activity, ''));
      const safeATime = Number.isFinite(aTime) ? aTime : 0;
      const safeBTime = Number.isFinite(bTime) ? bTime : 0;
      return (safeATime - safeBTime) * direction;
    }
    if (userSortBy === 'total_calls') {
      return (toInt(a.total_calls) - toInt(b.total_calls)) * direction;
    }
    if (userSortBy === 'role') {
      return toText(a.role, 'viewer').localeCompare(toText(b.role, 'viewer')) * direction;
    }
    return toText(a.telegram_id, '').localeCompare(toText(b.telegram_id, '')) * direction;
  });
}

function sortedUnique(values: Set<string>): string[] {
  return Array.from(values).filter(Boolean).sort();
}

export function selectIncidentFilterOptions(params: {
  incidentRows: IncidentRow[];
  asRecord: AsRecordFn;
  toText: ToTextFn;
}): {
  statusOptions: string[];
  actorOptions: string[];
  moduleOptions: string[];
  severityOptions: string[];
} {
  const { incidentRows, asRecord, toText } = params;
  const statuses = new Set<string>();
  const actors = new Set<string>();
  const modules = new Set<string>();
  const severities = new Set<string>();

  incidentRows.forEach((row) => {
    statuses.add(toText(row.status, 'unknown').toLowerCase());
    const details = asRecord(row.details);
    actors.add(toText(details.actor, '').toLowerCase());
    modules.add(toText(details.module, '').toLowerCase());
    severities.add(toText(details.severity, '').toLowerCase());
  });

  return {
    statusOptions: sortedUnique(statuses),
    actorOptions: sortedUnique(actors),
    moduleOptions: sortedUnique(modules),
    severityOptions: sortedUnique(severities),
  };
}

export function selectIncidentRows(params: {
  incidentRows: IncidentRow[];
  query: string;
  statusFilter: string;
  actorFilter: string;
  moduleFilter: string;
  severityFilter: string;
  asRecord: AsRecordFn;
  toText: ToTextFn;
}): IncidentRow[] {
  const {
    incidentRows,
    query,
    statusFilter,
    actorFilter,
    moduleFilter,
    severityFilter,
    asRecord,
    toText,
  } = params;
  const normalizedQuery = query.trim().toLowerCase();

  return [...incidentRows]
    .filter((incident) => {
      const status = toText(incident.status, 'unknown').toLowerCase();
      const details = asRecord(incident.details);
      const actor = toText(details.actor, '').toLowerCase();
      const moduleName = toText(details.module, '').toLowerCase();
      const severity = toText(details.severity, '').toLowerCase();

      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (actorFilter !== 'all' && actor !== actorFilter) return false;
      if (moduleFilter !== 'all' && moduleName !== moduleFilter) return false;
      if (severityFilter !== 'all' && severity !== severityFilter) return false;
      if (!normalizedQuery) return true;

      const service = toText(incident.service_name, 'service').toLowerCase();
      const detail = toText(details.message, toText(incident.details, '')).toLowerCase();
      return service.includes(normalizedQuery)
        || status.includes(normalizedQuery)
        || detail.includes(normalizedQuery)
        || actor.includes(normalizedQuery)
        || moduleName.includes(normalizedQuery)
        || severity.includes(normalizedQuery);
    })
    .sort((a, b) => {
      const aTime = Date.parse(toText(a.timestamp, ''));
      const bTime = Date.parse(toText(b.timestamp, ''));
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}

export function selectAuditFilterOptions(params: {
  auditRows: AuditRow[];
  asRecord: AsRecordFn;
  toText: ToTextFn;
}): {
  actorOptions: string[];
  moduleOptions: string[];
  severityOptions: string[];
} {
  const { auditRows, asRecord, toText } = params;
  const actors = new Set<string>();
  const modules = new Set<string>();
  const severities = new Set<string>();

  auditRows.forEach((row) => {
    const details = asRecord(row.details);
    actors.add(toText(details.actor, '').toLowerCase());
    modules.add(toText(details.module, '').toLowerCase());
    severities.add(toText(details.severity, '').toLowerCase());
  });

  return {
    actorOptions: sortedUnique(actors),
    moduleOptions: sortedUnique(modules),
    severityOptions: sortedUnique(severities),
  };
}

export function selectAuditRows(params: {
  auditRows: AuditRow[];
  query: string;
  actorFilter: string;
  moduleFilter: string;
  severityFilter: string;
  asRecord: AsRecordFn;
  toText: ToTextFn;
}): AuditRow[] {
  const {
    auditRows,
    query,
    actorFilter,
    moduleFilter,
    severityFilter,
    asRecord,
    toText,
  } = params;
  const normalizedQuery = query.trim().toLowerCase();

  return [...auditRows]
    .filter((row) => {
      const details = asRecord(row.details);
      const actor = toText(details.actor, 'unknown').toLowerCase();
      const moduleName = toText(details.module, toText(row.service_name, 'unknown')).toLowerCase();
      const severity = toText(details.severity, 'info').toLowerCase();

      if (actorFilter !== 'all' && actor !== actorFilter) return false;
      if (moduleFilter !== 'all' && moduleName !== moduleFilter) return false;
      if (severityFilter !== 'all' && severity !== severityFilter) return false;
      if (!normalizedQuery) return true;

      const service = toText(row.service_name, 'service').toLowerCase();
      const status = toText(row.status, 'unknown').toLowerCase();
      const detail = toText(details.message, toText(row.details, '')).toLowerCase();
      return service.includes(normalizedQuery)
        || status.includes(normalizedQuery)
        || detail.includes(normalizedQuery)
        || actor.includes(normalizedQuery)
        || moduleName.includes(normalizedQuery)
        || severity.includes(normalizedQuery);
    })
    .sort((a, b) => {
      const aTime = Date.parse(toText(a.timestamp, ''));
      const bTime = Date.parse(toText(b.timestamp, ''));
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}

export const selectUsersRowsMemoized = createMemoizedSelector(selectUsersRows);
export const selectIncidentFilterOptionsMemoized = createMemoizedSelector(selectIncidentFilterOptions);
export const selectIncidentRowsMemoized = createMemoizedSelector(selectIncidentRows);
export const selectAuditFilterOptionsMemoized = createMemoizedSelector(selectAuditFilterOptions);
export const selectAuditRowsMemoized = createMemoizedSelector(selectAuditRows);
