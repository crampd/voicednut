export type DashboardNoticeTone = 'info' | 'success' | 'warning' | 'error';

export function resolveNoticeTone(message: string): DashboardNoticeTone {
  const normalized = String(message || '').trim().toLowerCase();
  if (!normalized) return 'info';
  if (/error|failed|blocked|denied/.test(normalized)) return 'error';
  if (/warning|degraded|cancelled|canceled|retry/.test(normalized)) return 'warning';
  if (/success|completed|scheduled|synced|healthy|ready/.test(normalized)) return 'success';
  return 'info';
}

function pickFirstTextValue(
  sources: Array<Record<string, unknown>>,
  keys: string[],
): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        const normalized = String(value).trim();
        if (normalized) return normalized;
      }
    }
  }
  return '';
}

function toInitials(primary: string, secondary = ''): string {
  const first = String(primary || '').trim();
  const second = String(secondary || '').trim();
  if (first && second) {
    return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
  }
  const tokens = first.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0].slice(0, 1)}${tokens[1].slice(0, 1)}`.toUpperCase();
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 1).toUpperCase();
  }
  return '';
}

export type TelegramIdentity = {
  userLabel: string;
  userAvatarUrl: string;
  userAvatarFallback: string;
};

export function resolveTelegramIdentity(sources: Array<Record<string, unknown>>): TelegramIdentity {
  const firstNameSnake = pickFirstTextValue(sources, ['first_name']);
  const lastNameSnake = pickFirstTextValue(sources, ['last_name']);
  const firstNameCamel = pickFirstTextValue(sources, ['firstName']);
  const lastNameCamel = pickFirstTextValue(sources, ['lastName']);
  const usernameRaw = pickFirstTextValue(sources, ['username']);
  const displayName = pickFirstTextValue(sources, ['display_name', 'displayName', 'name', 'full_name', 'fullName']);
  const photoUrl = pickFirstTextValue(sources, ['photo_url', 'photoUrl']);
  const idRaw = pickFirstTextValue(sources, ['id', 'telegram_id', 'telegramId']);

  const username = usernameRaw.replace(/^@+/, '');
  const snakeName = `${firstNameSnake} ${lastNameSnake}`.trim();
  const camelName = `${firstNameCamel} ${lastNameCamel}`.trim();
  const userLabel = username
    ? `@${username}`
    : snakeName
      ? snakeName
      : camelName
        ? camelName
        : displayName
          ? displayName
          : idRaw
            ? `id:${idRaw}`
            : 'Unknown admin';

  const snakeInitials = toInitials(firstNameSnake, lastNameSnake);
  const camelInitials = toInitials(firstNameCamel, lastNameCamel);
  const usernameInitial = toInitials(username);
  const displayInitial = toInitials(displayName);
  const userAvatarFallback = snakeInitials || camelInitials || usernameInitial || displayInitial || 'U';

  return {
    userLabel,
    userAvatarUrl: photoUrl,
    userAvatarFallback,
  };
}
