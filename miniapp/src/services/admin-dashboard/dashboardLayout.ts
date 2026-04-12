import { asRecord } from '@/services/admin-dashboard/dashboardPrimitives';

export type ModuleLayoutRule = {
  enabled: boolean;
  order: number | null;
  label: string | null;
};

export type ServerModuleDefinition<T extends string> = {
  id: T;
  enabled: boolean | null;
  order: number | null;
  label: string | null;
  capability: string | null;
  command: string | null;
  actionContracts: string[];
};

export function parseModuleId<T extends string>(value: unknown, allowed: Set<T>): T | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase() as T;
  if (allowed.has(normalized)) {
    return normalized;
  }
  return null;
}

export function parseModuleLayoutConfig<T extends string>(
  layout: unknown,
  allowed: Set<T>,
): Partial<Record<T, ModuleLayoutRule>> {
  const root = asRecord(layout);
  const candidates = root.modules ?? layout;
  const rules: Partial<Record<T, ModuleLayoutRule>> = {};

  const applyRule = (entry: unknown, keyHint?: string): void => {
    if (typeof entry === 'string') {
      const id = parseModuleId(entry, allowed) || parseModuleId(keyHint, allowed);
      if (!id) return;
      rules[id] = { enabled: true, order: null, label: null };
      return;
    }
    if (typeof entry === 'boolean') {
      const id = parseModuleId(keyHint, allowed);
      if (!id) return;
      rules[id] = { enabled: entry, order: null, label: null };
      return;
    }
    if (typeof entry === 'number') {
      const id = parseModuleId(keyHint, allowed);
      if (!id) return;
      rules[id] = {
        enabled: true,
        order: Number.isFinite(entry) ? Math.floor(entry) : null,
        label: null,
      };
      return;
    }
    const record = asRecord(entry);
    const id = parseModuleId(record.id ?? record.module ?? record.key ?? keyHint, allowed);
    if (!id) return;
    const hidden = record.hidden === true || record.disabled === true;
    const enabled = hidden ? false : record.enabled !== false;
    const orderRaw = Number(record.order);
    const order = Number.isFinite(orderRaw) ? Math.floor(orderRaw) : null;
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : null;
    rules[id] = { enabled, order, label };
  };

  if (Array.isArray(candidates)) {
    candidates.forEach((entry) => applyRule(entry));
    return rules;
  }
  if (candidates && typeof candidates === 'object') {
    Object.entries(asRecord(candidates)).forEach(([key, value]) => {
      applyRule(value, key);
    });
  }
  return rules;
}

function parseActionContracts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const actionContracts: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    actionContracts.push(normalized);
  }
  return actionContracts;
}

function parseOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseServerModuleDefinitions<T extends string>(
  payload: unknown,
  allowed: Set<T>,
): Partial<Record<T, ServerModuleDefinition<T>>> {
  const root = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(root.modules)
      ? root.modules
      : [];
  const definitions: Partial<Record<T, ServerModuleDefinition<T>>> = {};

  for (const entry of candidates) {
    const record = asRecord(entry);
    const id = parseModuleId(record.id ?? record.module ?? record.key, allowed);
    if (!id) continue;
    const orderRaw = Number(record.order);
    const order = Number.isFinite(orderRaw) ? Math.floor(orderRaw) : null;
    const enabled = typeof record.enabled === 'boolean'
      ? record.enabled
      : record.hidden === true || record.disabled === true
        ? false
        : null;
    const capability = parseOptionalText(record.capability);
    const label = parseOptionalText(record.label);
    const command = parseOptionalText(record.command);
    const actionContracts = parseActionContracts(
      record.action_contracts ?? record.actionContracts ?? record.actions,
    );
    definitions[id] = {
      id,
      enabled,
      order,
      label,
      capability,
      command,
      actionContracts,
    };
  }

  return definitions;
}
