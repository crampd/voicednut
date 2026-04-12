const SESSION_TOKEN_ERROR_CODES = new Set<string>([
  'miniapp_auth_required',
  'miniapp_auth_invalid',
  'miniapp_invalid_token',
  'miniapp_malformed_token',
  'miniapp_invalid_token_signature',
  'miniapp_invalid_token_payload',
  'miniapp_token_not_active',
  'miniapp_token_missing_exp',
  'miniapp_token_expired',
  'miniapp_token_revoked',
]);

export function normalizeMiniAppErrorCode(code: string): string {
  return String(code || '').trim().toLowerCase();
}

export function inferMiniAppErrorCodeFromMessage(message: string): string {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return '';
  if (text.includes('init data is expired') || text.includes('launch credentials expired')) {
    return 'miniapp_init_data_expired';
  }
  if (text.includes('missing telegram mini app init data')) {
    return 'miniapp_missing_init_data';
  }
  if (text.includes('session token required')) {
    return 'miniapp_auth_required';
  }
  if (text.includes('session token was revoked')) {
    return 'miniapp_token_revoked';
  }
  if (text.includes('session token is expired')) {
    return 'miniapp_token_expired';
  }
  if (text.includes('signature') && text.includes('invalid')) {
    return 'miniapp_invalid_signature';
  }
  if (text.includes('admin access is required') || text.includes('admin required')) {
    return 'miniapp_admin_required';
  }
  return '';
}

export function describeSessionBlockedReason(errorCode: string): string {
  const code = normalizeMiniAppErrorCode(errorCode);
  if (code === 'miniapp_init_data_expired') {
    return 'Telegram launch credentials expired. Retry session to continue.';
  }
  if (code === 'miniapp_missing_init_data') {
    return 'Telegram launch credentials are missing. Open this Mini App from Telegram and retry.';
  }
  if (code === 'miniapp_invalid_signature') {
    return 'Telegram launch credentials are invalid for this backend bot token. Reopen the Mini App from the correct bot.';
  }
  if (code === 'miniapp_admin_required') {
    return 'Your account is authenticated but lacks admin access for this workspace. Contact an administrator.';
  }
  if (code === 'miniapp_replay_detected') {
    return 'Telegram launch credentials appear replayed or duplicated. Reopen the Mini App to start a fresh session.';
  }
  if (code === 'miniapp_auth_date_future') {
    return 'Telegram launch credentials are not yet valid due to client clock skew. Check device time and reopen the Mini App.';
  }
  if (SESSION_TOKEN_ERROR_CODES.has(code)) {
    return 'Session token is missing, invalid, expired, or revoked. Reopen this Mini App from Telegram and retry.';
  }
  return 'Open this Mini App from the Telegram bot menu, then retry the session.';
}

export function describeDashboardRefreshFailure(
  errorCode: string,
  fallbackDetail: string,
): { title: string; description: string } {
  const code = normalizeMiniAppErrorCode(errorCode);
  if (code === 'miniapp_init_data_expired') {
    return {
      title: 'Telegram launch credentials expired',
      description: 'Retry session to continue syncing dashboard data.',
    };
  }
  if (code === 'miniapp_missing_init_data') {
    return {
      title: 'Telegram launch credentials missing',
      description: 'Open this Mini App from the Telegram bot menu and retry dashboard refresh.',
    };
  }
  if (code === 'miniapp_invalid_signature') {
    return {
      title: 'Telegram launch credentials invalid',
      description: 'Open this Mini App from the correct bot instance and retry refresh.',
    };
  }
  if (code === 'miniapp_admin_required') {
    return {
      title: 'Admin access required',
      description: 'Your Telegram account is authenticated but does not have admin access for this workspace.',
    };
  }
  if (SESSION_TOKEN_ERROR_CODES.has(code)) {
    return {
      title: 'Mini App session expired',
      description: 'Reopen this Mini App from Telegram to get a fresh session token, then retry refresh.',
    };
  }
  return {
    title: 'Dashboard refresh failed',
    description: fallbackDetail,
  };
}
