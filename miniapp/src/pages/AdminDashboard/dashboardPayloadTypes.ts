import type { ProviderChannel } from '@/pages/AdminDashboard/types';

export interface SessionStateUser {
  username?: unknown;
  firstName?: unknown;
  first_name?: unknown;
  lastName?: unknown;
  last_name?: unknown;
  photoUrl?: unknown;
  photo_url?: unknown;
  id?: unknown;
}

export interface SessionState {
  user?: SessionStateUser;
}

export interface ProviderChannelData {
  provider?: unknown;
  supported_providers?: unknown;
  readiness?: unknown;
}

export interface ProviderPayload {
  providers?: Partial<Record<ProviderChannel, ProviderChannelData>>;
}

export interface SmsSummary {
  totalRecipients?: unknown;
  totalSuccessful?: unknown;
  totalFailed?: unknown;
}

export interface SmsPayload {
  summary?: SmsSummary;
}

export interface EmailStats {
  total_recipients?: unknown;
  sent?: unknown;
  failed?: unknown;
  delivered?: unknown;
  bounced?: unknown;
  complained?: unknown;
  suppressed?: unknown;
}

export interface EmailStatsPayload {
  stats?: EmailStats;
}

export interface EmailHistoryPayload {
  jobs?: unknown;
}

export interface DlqPayload {
  call_open?: unknown;
  email_open?: unknown;
  call_preview?: unknown;
  email_preview?: unknown;
}

export interface CallStatsPayload {
  total_calls?: unknown;
  completed_calls?: unknown;
  failed_calls?: unknown;
  success_rate?: unknown;
  recent_calls?: unknown;
  unique_users?: unknown;
}

export interface CallLogsPayload {
  rows?: unknown;
  total?: unknown;
  limit?: unknown;
  offset?: unknown;
}

export interface VoiceRuntimePayload {
  runtime?: unknown;
  active_calls?: unknown;
  actions?: unknown;
  applied?: unknown;
}

export interface CallScriptSimulationPayload {
  simulation?: unknown;
}

export interface CallScriptsPayload {
  scripts?: unknown;
  total?: unknown;
  limit?: unknown;
  flow_types?: unknown;
}

export interface OpsQueueBacklogPayload {
  total?: unknown;
  dlq_call_open?: unknown;
  dlq_email_open?: unknown;
  sms_failed?: unknown;
  email_failed?: unknown;
}

export interface OpsPayload {
  queue_backlog?: OpsQueueBacklogPayload;
  status?: unknown;
  health?: unknown;
  qa?: unknown;
}

export interface MiniAppUsersPayload {
  rows?: unknown;
  total?: unknown;
}

export interface MiniAppAuditPayload {
  rows?: unknown;
  summary?: unknown;
  hours?: unknown;
}

export interface MiniAppIncidentsPayload {
  alerts?: unknown;
  total_alerts?: unknown;
  runbooks?: unknown;
  summary?: unknown;
}

export interface DashboardPayload {
  supported_actions?: unknown;
  supported_action_count?: unknown;
  session?: unknown;
  provider?: ProviderPayload;
  provider_compatibility?: unknown;
  module_layout?: unknown;
  modules?: unknown;
  feature_flags?: unknown;
  flags?: unknown;
  sms_bulk?: SmsPayload;
  sms_stats?: unknown;
  email_bulk_stats?: EmailStatsPayload;
  email_bulk_history?: EmailHistoryPayload;
  dlq?: DlqPayload;
  call_logs?: CallLogsPayload;
  call_scripts?: CallScriptsPayload;
  call_stats?: CallStatsPayload;
  voice_runtime?: VoiceRuntimePayload;
  users?: MiniAppUsersPayload;
  audit?: MiniAppAuditPayload;
  incidents?: MiniAppIncidentsPayload;
  ops?: OpsPayload;
  bridge?: unknown;
}

export interface DashboardApiPayload extends DashboardPayload {
  success?: boolean;
  dashboard?: DashboardPayload;
  supported_actions?: unknown;
  supported_action_count?: unknown;
  session?: unknown;
  bridge?: unknown;
  module_layout?: unknown;
  modules?: unknown;
  feature_flags?: unknown;
  flags?: unknown;
  poll_interval_seconds?: unknown;
  poll_at?: unknown;
  server_time?: unknown;
}

export interface MiniAppSessionSummary {
  telegram_id?: unknown;
  role?: unknown;
  role_source?: unknown;
  caps?: unknown;
  exp?: unknown;
}
