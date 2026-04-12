import {
  Cell,
} from '@telegram-apps/telegram-ui';

import { Link } from '@/components/Link/Link.tsx';
import {
  BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS,
  MINIAPP_COMMAND_ACTION_CONTRACTS,
  MINIAPP_COMMAND_PAGE_CONTRACTS,
  type MiniAppCommandAccessLevel,
  type MiniAppCommandActionId,
} from '@/contracts/miniappParityContracts';
import {
  asRecord,
  toInt,
  toText,
} from '@/services/admin-dashboard/dashboardPrimitives';

export type CommandPageId = Exclude<keyof typeof MINIAPP_COMMAND_PAGE_CONTRACTS, 'CALL'>;
export type CallWorkflowMode = 'custom' | 'script';

type CommandContentSection = {
  header: string;
  items: readonly string[];
};

export type CallCommandResponse = {
  success?: boolean;
  call_sid?: string;
  to?: string;
  status?: string;
  deduped?: boolean;
  warnings?: unknown[];
  provider?: string;
};

export type CallCommandStatusResponse = {
  call?: unknown;
  recent_states?: unknown;
  live_console?: unknown;
  notification_status?: unknown;
  webhook_service_status?: unknown;
  enhanced_tracking?: unknown;
  error?: unknown;
};

export type CallActiveResumeResponse = {
  success?: boolean;
  resumed?: boolean;
  call?: unknown;
  error?: unknown;
};

export type CallScriptLifecycle = {
  live_at?: unknown;
};

export type CallScriptPersonaConfig = {
  purpose?: unknown;
  emotion?: unknown;
  urgency?: unknown;
  technical_level?: unknown;
};

export type CallScriptRecord = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  prompt?: unknown;
  first_message?: unknown;
  business_id?: unknown;
  voice_model?: unknown;
  objective_tags?: unknown;
  persona_config?: CallScriptPersonaConfig | null;
  flow_type?: unknown;
  flow_types?: unknown;
  version?: unknown;
  lifecycle_state?: unknown;
  lifecycle?: CallScriptLifecycle | null;
};

export type CallScriptListResponse = {
  scripts?: unknown;
  total?: unknown;
};

export type CallPersonaPurposeOption = {
  id: string;
  label: string;
  emoji?: string;
  defaultEmotion?: string;
  defaultUrgency?: string;
  defaultTechnicalLevel?: string;
};

export type CallPersonaProfile = {
  id: string;
  label: string;
  description: string;
  emoji?: string;
  purposes: CallPersonaPurposeOption[];
  defaultPurpose: string;
  defaultEmotion?: string;
  defaultUrgency?: string;
  defaultTechnicalLevel?: string;
  custom: boolean;
  dynamic: boolean;
};

export type CallPersonaCatalogResponse = {
  success?: boolean;
  builtin?: unknown;
  custom?: unknown;
};

export type CallVoiceModelOption = {
  id: string;
  label: string;
  gender: string;
  style: string;
};

type EmailCommandBulkHistoryJob = {
  job_id?: unknown;
  provider?: unknown;
  status?: unknown;
  created_at?: unknown;
  recipient_count?: unknown;
  sent_count?: unknown;
  failed_count?: unknown;
  script_id?: unknown;
  subject?: unknown;
};

type EmailCommandTemplateSummary = {
  template_id?: unknown;
  id?: unknown;
  name?: unknown;
  subject?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  required_vars?: unknown;
  required_variables?: unknown;
};

type EmailCommandProviderStatusResponse = {
  success?: boolean;
  channel?: unknown;
  provider?: unknown;
  supported_providers?: unknown;
  email_provider?: unknown;
  email_supported_providers?: unknown;
  email_readiness?: unknown;
  providers?: unknown;
};

type SmsCommandBulkStatusOperation = {
  id?: unknown;
  created_at?: unknown;
  total_recipients?: unknown;
  successful?: unknown;
  failed?: unknown;
  message?: unknown;
  provider?: unknown;
};

type SmsCommandProviderStatusResponse = {
  success?: boolean;
  channel?: unknown;
  provider?: unknown;
  supported_providers?: unknown;
  sms_provider?: unknown;
  sms_supported_providers?: unknown;
  sms_readiness?: unknown;
  providers?: unknown;
};

export const CALL_WORKFLOW_MODE_OPTIONS: ReadonlyArray<{ id: CallWorkflowMode; label: string }> = [
  { id: 'custom', label: 'Custom prompt workflow' },
  { id: 'script', label: 'Script template workflow' },
];

export const CALL_CUSTOM_PERSONA_ID = 'custom';
export const CALL_VOICE_AUTO_ID = 'auto';
export const CALL_VOICE_CUSTOM_ID = 'custom';

export const CALL_PURPOSE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'general_outreach', label: 'General outreach' },
  { id: 'identity_verification', label: 'Identity verification' },
  { id: 'appointment_confirmation', label: 'Appointment confirmation' },
  { id: 'service_recovery', label: 'Service recovery' },
  { id: 'payment_collection', label: 'Payment collection' },
];
export const RELATIONSHIP_CALL_FLOW_TYPE_SET = new Set<string>([
  'dating',
  'celebrity',
  'fan',
  'creator',
  'friendship',
  'networking',
  'community',
  'marketplace_seller',
  'real_estate_agent',
]);
export const CALL_CUSTOM_FLOW_OPTIONS: ReadonlyArray<CallPersonaPurposeOption> = [
  { id: 'general', label: 'General', emoji: '🧩' },
  { id: 'dating', label: 'Dating', emoji: '💕' },
  { id: 'celebrity', label: 'Celebrity fan engagement', emoji: '⭐' },
  { id: 'fan', label: 'Fan engagement', emoji: '🎤' },
  { id: 'creator', label: 'Creator collaboration', emoji: '🎬' },
  { id: 'friendship', label: 'Friendship', emoji: '🤝' },
  { id: 'networking', label: 'Networking', emoji: '🌐' },
  { id: 'community', label: 'Community engagement', emoji: '🫶' },
  { id: 'marketplace_seller', label: 'Marketplace seller', emoji: '🛍️' },
  { id: 'real_estate_agent', label: 'Real estate outreach', emoji: '🏡' },
];
export const SMS_MESSAGE_MAX_CHARS = 1600;
const CALL_CUSTOM_FLOW_TEXT_SIGNALS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  dating: ['dating', 'girlfriend', 'boyfriend', 'romance', 'situationship'],
  celebrity: ['celebrity', 'fan club', 'artist', 'official assistant'],
  fan: ['fandom', 'fan', 'community update', 'exclusive drop'],
  creator: ['creator', 'collab', 'partnership', 'ugc'],
  friendship: ['friend', 'check in', 'reconnect', 'catch up'],
  networking: ['network', 'follow-up', 'intro', 'referral'],
  community: ['community', 'member', 'moderation', 'onboarding'],
  marketplace_seller: ['listing', 'buyer', 'marketplace', 'item details'],
  real_estate_agent: ['property', 'open house', 'tour', 'real estate', 'agent'],
});

export const CALL_MOOD_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'auto', label: 'Auto (use recommended)' },
  { id: 'neutral', label: 'Neutral / professional' },
  { id: 'frustrated', label: 'Empathetic troubleshooter' },
  { id: 'urgent', label: 'Urgent / high-priority' },
  { id: 'confused', label: 'Patient explainer' },
  { id: 'positive', label: 'Upbeat / encouraging' },
  { id: 'stressed', label: 'Reassuring & calming' },
];

export const CALL_URGENCY_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'auto', label: 'Auto (use recommended)' },
  { id: 'low', label: 'Low - casual follow-up' },
  { id: 'normal', label: 'Normal - timely assistance' },
  { id: 'high', label: 'High - priority handling' },
  { id: 'critical', label: 'Critical - emergency protocol' },
];

export const CALL_TECH_LEVEL_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'auto', label: 'Auto (general audience)' },
  { id: 'general', label: 'General audience' },
  { id: 'novice', label: 'Beginner-friendly' },
  { id: 'advanced', label: 'Advanced / technical specialist' },
];

export const CALL_FALLBACK_PERSONAS: ReadonlyArray<CallPersonaProfile> = [
  {
    id: CALL_CUSTOM_PERSONA_ID,
    label: 'Custom Persona',
    description: 'Manually configure prompt, first message, and tone for ad-hoc outbound calls.',
    defaultPurpose: 'general',
    defaultEmotion: 'neutral',
    defaultUrgency: 'normal',
    defaultTechnicalLevel: 'general',
    purposes: [{ id: 'general', label: 'General' }],
    custom: true,
    dynamic: false,
  },
  {
    id: 'technical_support',
    label: 'Technical Support',
    emoji: '🛠️',
    description: 'Guides callers through troubleshooting steps and software onboarding.',
    defaultPurpose: 'general',
    defaultEmotion: 'frustrated',
    defaultUrgency: 'normal',
    defaultTechnicalLevel: 'novice',
    purposes: [
      {
        id: 'general',
        label: 'General Troubleshooting',
        emoji: '🛠️',
        defaultEmotion: 'frustrated',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'novice',
      },
      {
        id: 'installation',
        label: 'Installation Help',
        emoji: '💿',
        defaultEmotion: 'confused',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'outage',
        label: 'Service Outage',
        emoji: '🚨',
        defaultEmotion: 'urgent',
        defaultUrgency: 'high',
        defaultTechnicalLevel: 'advanced',
      },
    ],
    custom: false,
    dynamic: false,
  },
  {
    id: 'healthcare',
    label: 'Healthcare Services',
    emoji: '🩺',
    description: 'Coordinates patient reminders, follow-ups, and care outreach.',
    defaultPurpose: 'appointment',
    defaultEmotion: 'positive',
    defaultUrgency: 'normal',
    defaultTechnicalLevel: 'general',
    purposes: [
      {
        id: 'appointment',
        label: 'Appointment Reminder',
        emoji: '📅',
        defaultEmotion: 'positive',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'follow_up',
        label: 'Post-Visit Follow-up',
        emoji: '📋',
        defaultEmotion: 'empathetic',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'wellness_check',
        label: 'Wellness Check',
        emoji: '💙',
        defaultEmotion: 'empathetic',
        defaultUrgency: 'low',
        defaultTechnicalLevel: 'general',
      },
    ],
    custom: false,
    dynamic: false,
  },
  {
    id: 'finance',
    label: 'Financial Services',
    emoji: '💳',
    description: 'Delivers account alerts, security notices, and payment reminders.',
    defaultPurpose: 'security',
    defaultEmotion: 'urgent',
    defaultUrgency: 'high',
    defaultTechnicalLevel: 'advanced',
    purposes: [
      {
        id: 'security',
        label: 'Security Alert',
        emoji: '🔐',
        defaultEmotion: 'urgent',
        defaultUrgency: 'high',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'payment',
        label: 'Payment Reminder',
        emoji: '🧾',
        defaultEmotion: 'neutral',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'fraud',
        label: 'Fraud Investigation',
        emoji: '🚔',
        defaultEmotion: 'urgent',
        defaultUrgency: 'critical',
        defaultTechnicalLevel: 'advanced',
      },
    ],
    custom: false,
    dynamic: false,
  },
  {
    id: 'hospitality',
    label: 'Hospitality & Guest Services',
    emoji: '🏨',
    description: 'Handles reservations, service recovery, and VIP outreach.',
    defaultPurpose: 'recovery',
    defaultEmotion: 'empathetic',
    defaultUrgency: 'normal',
    defaultTechnicalLevel: 'general',
    purposes: [
      {
        id: 'reservation',
        label: 'Reservation Follow-up',
        emoji: '📞',
        defaultEmotion: 'positive',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'recovery',
        label: 'Service Recovery',
        emoji: '💡',
        defaultEmotion: 'empathetic',
        defaultUrgency: 'high',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'vip_outreach',
        label: 'VIP Outreach',
        emoji: '⭐',
        defaultEmotion: 'positive',
        defaultUrgency: 'low',
        defaultTechnicalLevel: 'general',
      },
    ],
    custom: false,
    dynamic: false,
  },
  {
    id: 'emergency_response',
    label: 'Emergency Response',
    emoji: '🚑',
    description: 'Coordinates critical incident response and escalation workflows.',
    defaultPurpose: 'incident',
    defaultEmotion: 'urgent',
    defaultUrgency: 'critical',
    defaultTechnicalLevel: 'advanced',
    purposes: [
      {
        id: 'incident',
        label: 'Incident Response',
        emoji: '⚠️',
        defaultEmotion: 'urgent',
        defaultUrgency: 'critical',
        defaultTechnicalLevel: 'advanced',
      },
      {
        id: 'safety_check',
        label: 'Safety Check',
        emoji: '🆘',
        defaultEmotion: 'urgent',
        defaultUrgency: 'high',
        defaultTechnicalLevel: 'general',
      },
      {
        id: 'drill',
        label: 'Emergency Drill',
        emoji: '🛡️',
        defaultEmotion: 'neutral',
        defaultUrgency: 'normal',
        defaultTechnicalLevel: 'general',
      },
    ],
    custom: false,
    dynamic: false,
  },
];

export const CALL_FALLBACK_VOICE_MODELS: ReadonlyArray<CallVoiceModelOption> = [
  { id: 'aura-2-andromeda-en', label: 'aura-2-andromeda-en', gender: 'female', style: 'balanced' },
  { id: 'aura-2-helena-en', label: 'aura-2-helena-en', gender: 'female', style: 'warm' },
  { id: 'aura-2-thalia-en', label: 'aura-2-thalia-en', gender: 'female', style: 'clear' },
  { id: 'aura-2-arcas-en', label: 'aura-2-arcas-en', gender: 'male', style: 'grounded' },
  { id: 'aura-2-aries-en', label: 'aura-2-aries-en', gender: 'male', style: 'confident' },
  { id: 'aura-asteria-en', label: 'aura-asteria-en', gender: 'female', style: 'bright' },
];

const ACTIVE_CALL_CONSOLE_STORAGE_PREFIX = 'voxly-miniapp-active-call-console';

type CallbackParityRow = {
  callbackAction: string;
  label: string;
  dashboardAction: string;
  summary: string;
};

export const SMS_CALLBACK_PARITY_ROWS: ReadonlyArray<CallbackParityRow> = [
  {
    callbackAction: 'SMS_SEND',
    label: 'Send SMS',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_SEND,
    summary: 'Single-recipient send (uses current recipient and message fields).',
  },
  {
    callbackAction: 'SMS_SCHEDULE',
    label: 'Schedule SMS',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_SCHEDULE,
    summary: 'Single-recipient schedule (requires schedule timestamp).',
  },
  {
    callbackAction: 'SMS_STATUS',
    label: 'Check Delivery Status',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_STATUS,
    summary: 'Message status by SID.',
  },
  {
    callbackAction: 'SMS_CONVO',
    label: 'Load Conversation',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_CONVO,
    summary: 'Conversation snapshot by phone.',
  },
  {
    callbackAction: 'SMS_RECENT',
    label: 'Load Recent Messages',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_RECENT,
    summary: 'Recent messages list.',
  },
  {
    callbackAction: 'SMS_RECENT_PAGE',
    label: 'Load Recent Messages (Paged)',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_RECENT_PAGE,
    summary: 'Recent messages pagination (uses current page controls).',
  },
  {
    callbackAction: 'SMS_STATS',
    label: 'Load SMS Stats',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.SMS_STATS,
    summary: 'Delivery stats snapshot.',
  },
  {
    callbackAction: 'BULK_SMS_PRECHECK',
    label: 'Run Provider Precheck',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_SMS_PRECHECK,
    summary: 'Provider readiness check using the live SMS provider status contract.',
  },
  {
    callbackAction: 'BULK_SMS_LIST',
    label: 'Load Bulk Jobs',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_SMS_LIST,
    summary: 'Recent bulk-SMS job history.',
  },
  {
    callbackAction: 'BULK_SMS_STATUS',
    label: 'Load Bulk Job Details',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_SMS_STATUS,
    summary: 'Bulk-SMS job status lookup (uses bulk job ID input).',
  },
  {
    callbackAction: 'BULK_SMS_STATS',
    label: 'Load Bulk SMS Stats',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_SMS_STATS,
    summary: 'Bulk-SMS summary stats.',
  },
];

export const EMAIL_CALLBACK_PARITY_ROWS: ReadonlyArray<CallbackParityRow> = [
  {
    callbackAction: 'EMAIL_SEND',
    label: 'Send Email',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.EMAIL_SEND,
    summary: 'Single-recipient send (uses current recipient/content fields).',
  },
  {
    callbackAction: 'EMAIL_STATUS',
    label: 'Check Delivery Status',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.EMAIL_STATUS,
    summary: 'Message status lookup by message ID.',
  },
  {
    callbackAction: 'EMAIL_TIMELINE',
    label: 'Load Delivery Timeline',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.EMAIL_TIMELINE,
    summary: 'Message timeline lookup (uses message ID input).',
  },
  {
    callbackAction: 'EMAIL_TEMPLATES',
    label: 'Load Templates',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.EMAIL_TEMPLATES,
    summary: 'Email template catalog list.',
  },
  {
    callbackAction: 'EMAIL_HISTORY',
    label: 'Load History',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.EMAIL_HISTORY,
    summary: 'Recent bulk-email job history.',
  },
  {
    callbackAction: 'EMAIL_BULK',
    label: 'Load Bulk Job Details',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK,
    summary: 'Bulk-email job status lookup (uses bulk job ID input).',
  },
  {
    callbackAction: 'BULK_EMAIL_PRECHECK',
    label: 'Run Provider Precheck',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_EMAIL_PRECHECK,
    summary: 'Provider readiness check using the live email provider status contract.',
  },
  {
    callbackAction: 'BULK_EMAIL_SEND',
    label: 'Queue Bulk Email',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_EMAIL_SEND,
    summary: 'Bulk-email send using current recipient/content fields.',
  },
  {
    callbackAction: 'BULK_EMAIL_STATUS',
    label: 'Load Bulk Job Status',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_EMAIL_STATUS,
    summary: 'Bulk-email status lookup (uses bulk job ID input).',
  },
  {
    callbackAction: 'BULK_EMAIL_LIST',
    label: 'Load Bulk Jobs',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_EMAIL_LIST,
    summary: 'Bulk-email history list.',
  },
  {
    callbackAction: 'BULK_EMAIL_PAGE',
    label: 'Load Bulk Jobs (Paged)',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_EMAIL_PAGE,
    summary: 'Bulk-email history pagination (uses current page controls).',
  },
  {
    callbackAction: 'BULK_EMAIL_STATS',
    label: 'Load Bulk Email Stats',
    dashboardAction: BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS.BULK_EMAIL_STATS,
    summary: 'Bulk-email stats snapshot.',
  },
];

type CommandRuntimeSnapshot = {
  status: string;
  health: string;
  queueBacklogTotal: number;
  queueBacklogCallDlq: number;
  queueBacklogEmailDlq: number;
  runtimeEffectiveMode: string;
  runtimeConfiguredMode: string;
  runtimeCanaryPercent: number;
  runtimeCircuitState: string;
  activeCallsTotal: number;
  activeCallsLegacy: number;
  activeCallsVoiceAgent: number;
  bridgeStatuses: number[];
  pollAt: string;
  serverTime: string;
};

function toBridgeStatuses(value: unknown): number[] {
  return Object.values(asRecord(value))
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry >= 100 && entry <= 599);
}

export function createCommandRuntimeSnapshot(payload: unknown): CommandRuntimeSnapshot {
  const root = asRecord(payload);
  const dashboard = asRecord(root.dashboard);
  const ops = asRecord(root.ops || dashboard.ops);
  const queueBacklog = asRecord(ops.queue_backlog);
  const voiceRuntime = asRecord(root.voice_runtime || dashboard.voice_runtime);
  const runtime = asRecord(voiceRuntime.runtime);
  const runtimeCircuit = asRecord(runtime.circuit);
  const activeCalls = asRecord(voiceRuntime.active_calls);
  const bridgeStatuses = toBridgeStatuses(root.bridge || dashboard.bridge);
  const pollAt = toText(root.poll_at || dashboard.poll_at, '');
  const serverTime = toText(root.server_time || dashboard.server_time, '');

  return {
    status: toText(ops.status, 'unknown').toLowerCase(),
    health: toText(ops.health, 'unknown').toLowerCase(),
    queueBacklogTotal: toInt(queueBacklog.total, 0),
    queueBacklogCallDlq: toInt(queueBacklog.dlq_call_open, 0),
    queueBacklogEmailDlq: toInt(queueBacklog.dlq_email_open, 0),
    runtimeEffectiveMode: toText(runtime.effective_mode, 'unknown').toLowerCase(),
    runtimeConfiguredMode: toText(runtime.configured_mode, 'unknown').toLowerCase(),
    runtimeCanaryPercent: toInt(runtime.effective_canary_percent, 0),
    runtimeCircuitState: asRecord(runtimeCircuit).is_open === true ? 'open' : 'closed',
    activeCallsTotal: toInt(activeCalls.total, 0),
    activeCallsLegacy: toInt(activeCalls.legacy, 0),
    activeCallsVoiceAgent: toInt(activeCalls.voice_agent, 0),
    bridgeStatuses,
    pollAt,
    serverTime,
  };
}

export function getCommandRuntimeRows(
  pageId: CommandPageId,
  snapshot: CommandRuntimeSnapshot,
): Array<{ label: string; value: string }> {
  const baseRows = [
    {
      label: 'Overall posture',
      value: `status=${snapshot.status} | health=${snapshot.health}`,
    },
    {
      label: 'Queue backlog',
      value: `${snapshot.queueBacklogTotal} total | call DLQ ${snapshot.queueBacklogCallDlq} | email DLQ ${snapshot.queueBacklogEmailDlq}`,
    },
    {
      label: 'Bridge HTTP status trail',
      value: snapshot.bridgeStatuses.length > 0
        ? snapshot.bridgeStatuses.join(', ')
        : 'No bridge response status history in the current session snapshot',
    },
    {
      label: 'Bootstrap timing',
      value: `poll_at=${snapshot.pollAt || 'n/a'} | server_time=${snapshot.serverTime || 'n/a'}`,
    },
  ];

  if (pageId === 'STATUS') {
    return [
      {
        label: 'Runtime mode',
        value: `effective=${snapshot.runtimeEffectiveMode} | configured=${snapshot.runtimeConfiguredMode} | canary=${snapshot.runtimeCanaryPercent}%`,
      },
      {
        label: 'Runtime circuit',
        value: snapshot.runtimeCircuitState,
      },
      {
        label: 'Active calls',
        value: `${snapshot.activeCallsTotal} total | legacy ${snapshot.activeCallsLegacy} | voice-agent ${snapshot.activeCallsVoiceAgent}`,
      },
      ...baseRows,
    ];
  }

  return baseRows;
}

export function hasAccess(required: MiniAppCommandAccessLevel, current: MiniAppCommandAccessLevel): boolean {
  if (required === 'guest') return true;
  if (required === 'authorized') return current === 'authorized' || current === 'admin';
  return current === 'admin';
}

export function describeAccessLevel(accessLevel: MiniAppCommandAccessLevel): string {
  if (accessLevel === 'admin') return 'Administrator access active';
  if (accessLevel === 'authorized') return 'Authorized operator access active';
  return 'Limited access only';
}

type CommandUiPageId = keyof typeof MINIAPP_COMMAND_PAGE_CONTRACTS;

const COMMAND_PAGE_UI_TITLES: Record<CommandUiPageId, string> = {
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

export function resolveCommandPageTitle(pageId: CommandUiPageId): string {
  return COMMAND_PAGE_UI_TITLES[pageId];
}

export function resolveCommandPageLoadingCopy(title: string): string {
  return `Loading Mini App session and ${title.toLowerCase()}...`;
}

function buildActiveCallConsoleStorageKey(sessionTelegramId: string): string {
  return `${ACTIVE_CALL_CONSOLE_STORAGE_PREFIX}:${sessionTelegramId.trim() || 'anonymous'}`;
}

export function readActiveCallConsoleSid(sessionTelegramId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(buildActiveCallConsoleStorageKey(sessionTelegramId))?.trim() || '';
  } catch {
    return '';
  }
}

export function writeActiveCallConsoleSid(sessionTelegramId: string, callSid: string): void {
  if (typeof window === 'undefined') return;
  const storageKey = buildActiveCallConsoleStorageKey(sessionTelegramId);
  try {
    const normalizedSid = callSid.trim();
    if (normalizedSid) {
      window.localStorage.setItem(storageKey, normalizedSid);
      return;
    }
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore local storage failures. The live console still works for the current page session.
  }
}

function describeActionAvailability(
  actionId: MiniAppCommandActionId,
  accessLevel: MiniAppCommandAccessLevel,
): string {
  const action = MINIAPP_COMMAND_ACTION_CONTRACTS[actionId];
  if (!hasAccess(action.minAccess, accessLevel)) {
    return action.minAccess === 'admin'
      ? 'Admin access required'
      : 'Authorized access required';
  }
  if (!action.routePath) {
    return 'Mini App route not mounted yet';
  }
  if (action.availability === 'partial') {
    return 'Partially available workflow';
  }
  return 'Available now';
}

export function renderQuickActionCell(
  actionId: MiniAppCommandActionId,
  accessLevel: MiniAppCommandAccessLevel,
  pathname: string,
) {
  const action = MINIAPP_COMMAND_ACTION_CONTRACTS[actionId];
  const currentRoute = action.routePath === pathname;
  const canOpenAction = Boolean(action.routePath) && hasAccess(action.minAccess, accessLevel) && !currentRoute;
  const subtitle = `${action.description} ${describeActionAvailability(actionId, accessLevel)}.`;

  if (canOpenAction && action.routePath) {
    return (
      <Link key={actionId} to={action.routePath}>
        <Cell
          subtitle={subtitle}
          after={<span className="va-command-nav-state">Open</span>}
        >
          {action.label}
        </Cell>
      </Link>
    );
  }

  let navigationLabel = 'Unavailable';
  if (currentRoute) {
    navigationLabel = 'Current';
  } else if (!hasAccess(action.minAccess, accessLevel)) {
    navigationLabel = 'Locked';
  }

  return (
    <Cell
      key={actionId}
      subtitle={`${subtitle} ${action.notes}`}
      after={<span className="va-command-nav-state">{navigationLabel}</span>}
    >
      {action.label}
    </Cell>
  );
}

export function createCallIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `call-${globalThis.crypto.randomUUID()}`;
  }
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Call request failed.';
}

export function toErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

export function toWarningList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
    : [];
}

export function toOptionalRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function toPositiveInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function toTextValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function toTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => toTextValue(entry)).filter(Boolean)
    : [];
}

export function toEmailHistoryRows(value: unknown): EmailCommandBulkHistoryJob[] {
  return Array.isArray(value) ? value as EmailCommandBulkHistoryJob[] : [];
}

export function toEmailTemplateRows(value: unknown): EmailCommandTemplateSummary[] {
  return Array.isArray(value) ? value as EmailCommandTemplateSummary[] : [];
}

export function toEventRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value
      .filter((entry) => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => entry as Record<string, unknown>)
    : [];
}

export function resolveCallConsoleStatus(
  liveConsole: Record<string, unknown> | null,
  call: Record<string, unknown> | null,
  recentStates: Array<Record<string, unknown>>,
): string {
  const liveStatus = toTextValue(liveConsole?.status);
  if (liveStatus) return liveStatus.toLowerCase();
  const callStatus = toTextValue(call?.status);
  if (callStatus) return callStatus.toLowerCase();
  const latestState = recentStates[0] || null;
  return toTextValue(latestState?.status, toTextValue(latestState?.state)).toLowerCase();
}

export function resolveCallConsolePhase(
  liveConsole: Record<string, unknown> | null,
  call: Record<string, unknown> | null,
  recentStates: Array<Record<string, unknown>>,
): string {
  const livePhase = toTextValue(liveConsole?.phase_label, toTextValue(liveConsole?.phase));
  if (livePhase) return livePhase;
  const callPhase = toTextValue(call?.call_phase, toTextValue(call?.phase));
  if (callPhase) return callPhase;
  const latestState = recentStates[0] || null;
  return toTextValue(latestState?.phase_label, toTextValue(latestState?.phase, 'Pending provider update'));
}

export function isTerminalCallStatus(status: string): boolean {
  return [
    'completed',
    'busy',
    'failed',
    'canceled',
    'cancelled',
    'no-answer',
    'no_answer',
    'voicemail',
    'ended',
  ].includes(status.trim().toLowerCase());
}

export function summarizeCallStateRow(row: Record<string, unknown>): string {
  const status = toTextValue(row.status, toTextValue(row.state, 'unknown'));
  const phase = toTextValue(row.phase_label, toTextValue(row.phase));
  const at = toTextValue(row.created_at, toTextValue(row.updated_at, toTextValue(row.timestamp, 'n/a')));
  const source = toTextValue(row.source, '');
  const reason = toTextValue(row.reason, toTextValue(row.error_message));
  return [
    `status=${status || 'unknown'}`,
    phase ? `phase=${phase}` : '',
    source ? `source=${source}` : '',
    reason ? `detail=${reason}` : '',
    `at=${at || 'n/a'}`,
  ].filter(Boolean).join(' | ');
}

export function summarizeCallNotificationRow(row: Record<string, unknown>): string {
  const notificationType = toTextValue(row.notification_type, 'unknown');
  const status = toTextValue(row.status, 'unknown');
  const sentAt = toTextValue(row.sent_at, toTextValue(row.created_at, 'n/a'));
  const deliveryMs = toText(row.delivery_time_ms, '');
  const errorMessage = toTextValue(row.error_message);
  return [
    `type=${notificationType}`,
    `status=${status}`,
    deliveryMs ? `delivery_ms=${deliveryMs}` : '',
    errorMessage ? `error=${errorMessage}` : '',
    `at=${sentAt}`,
  ].filter(Boolean).join(' | ');
}

export function toJsonText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }
}

export function summarizeEmailJob(job: EmailCommandBulkHistoryJob): string {
  const id = toTextValue(job.job_id, 'n/a');
  const provider = toTextValue(job.provider, 'unknown');
  const status = toTextValue(job.status, 'unknown');
  const sent = toInt(job.sent_count, 0);
  const failed = toInt(job.failed_count, 0);
  const recipients = toInt(job.recipient_count, 0);
  const createdAt = toTextValue(job.created_at, 'n/a');
  return `job=${id} | status=${status} | provider=${provider} | recipients=${recipients} | sent=${sent} | failed=${failed} | created=${createdAt}`;
}

export function summarizeEmailTemplate(template: EmailCommandTemplateSummary): string {
  const templateId = toTextValue(template.template_id, toTextValue(template.id, toTextValue(template.name, 'n/a')));
  const subject = toTextValue(template.subject, '(no subject)');
  const updatedAt = toTextValue(template.updated_at, toTextValue(template.created_at, 'n/a'));
  const requiredVars = toTextList(template.required_vars).length > 0
    ? toTextList(template.required_vars)
    : toTextList(template.required_variables);
  const requiredVarsLabel = requiredVars.length > 0 ? requiredVars.join(', ') : 'none';
  return `template=${templateId} | subject=${subject} | required_vars=${requiredVarsLabel} | updated=${updatedAt}`;
}

export function summarizeEmailBulkStats(stats: Record<string, unknown>): string {
  const total = toInt(stats.total_recipients ?? stats.total_jobs ?? stats.total, 0);
  const queued = toInt(stats.queued_count ?? stats.queued, 0);
  const sent = toInt(stats.sent_count ?? stats.sent, 0);
  const failed = toInt(stats.failed_count ?? stats.failed, 0);
  const successRate = toText(stats.success_rate, '0');
  return `total=${total} | queued=${queued} | sent=${sent} | failed=${failed} | success_rate=${successRate}%`;
}

function toBooleanRecord(value: unknown): Record<string, boolean> {
  const record = asRecord(value);
  const normalized = Object.entries(record).reduce<Record<string, boolean>>((result, [key, entry]) => {
    if (typeof entry === 'boolean') {
      result[key] = entry;
    }
    return result;
  }, {});
  return normalized;
}

export function createEmailProviderSnapshot(payload: EmailCommandProviderStatusResponse | null): Record<string, unknown> | null {
  if (!payload) return null;
  const providers = asRecord(payload.providers);
  const emailProviders = asRecord(providers.email);
  const supportedProviders = toTextList(
    payload.email_supported_providers ?? payload.supported_providers ?? emailProviders.supported_providers,
  );
  const readiness = toBooleanRecord(payload.email_readiness ?? emailProviders.readiness);
  const provider = toTextValue(payload.email_provider ?? payload.provider ?? emailProviders.provider, 'unknown');
  const ready = provider ? readiness[provider] !== false : false;
  return {
    channel: toTextValue(payload.channel, 'email'),
    provider,
    ready,
    supported_providers: supportedProviders,
    readiness,
  };
}

export function createSmsProviderSnapshot(payload: SmsCommandProviderStatusResponse | null): Record<string, unknown> | null {
  if (!payload) return null;
  const providers = asRecord(payload.providers);
  const smsProviders = asRecord(providers.sms);
  const supportedProviders = toTextList(
    payload.sms_supported_providers ?? payload.supported_providers ?? smsProviders.supported_providers,
  );
  const readiness = toBooleanRecord(payload.sms_readiness ?? smsProviders.readiness);
  const provider = toTextValue(payload.sms_provider ?? payload.provider ?? smsProviders.provider, 'unknown');
  const ready = provider ? readiness[provider] !== false : false;
  return {
    channel: toTextValue(payload.channel, 'sms'),
    provider,
    ready,
    supported_providers: supportedProviders,
    readiness,
  };
}

export function toBulkSmsOperations(value: unknown): SmsCommandBulkStatusOperation[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asRecord(entry) as SmsCommandBulkStatusOperation);
}

export function summarizeBulkSmsOperation(operation: SmsCommandBulkStatusOperation): string {
  const id = toTextValue(operation.id, 'n/a');
  const provider = toTextValue(operation.provider, 'unknown');
  const total = toInt(operation.total_recipients, 0);
  const successful = toInt(operation.successful, 0);
  const failed = toInt(operation.failed, 0);
  const createdAt = toTextValue(operation.created_at, 'n/a');
  return `job=${id} | provider=${provider} | sent=${successful}/${total} | failed=${failed} | created=${createdAt}`;
}

export function summarizeBulkSmsStats(stats: Record<string, unknown>): string {
  const totalJobs = toInt(stats.totalOperations ?? stats.total_jobs ?? stats.total, 0);
  const totalRecipients = toInt(stats.totalRecipients ?? stats.total_recipients, 0);
  const totalSuccessful = toInt(stats.totalSuccessful ?? stats.total_successful ?? stats.successful, 0);
  const totalFailed = toInt(stats.totalFailed ?? stats.total_failed ?? stats.failed, 0);
  const successRate = toInt(stats.successRate ?? stats.success_rate, 0);
  return `jobs=${totalJobs} | recipients=${totalRecipients} | success=${totalSuccessful} | failed=${totalFailed} | success_rate=${successRate}%`;
}

export function summarizeSmsMessage(message: Record<string, unknown>): string {
  const messageSid = toText(message.message_sid, toText(message.sid, 'n/a'));
  const status = toText(message.status, 'unknown');
  const direction = toText(message.direction, '');
  const toNumber = toText(message.to_number, toText(message.to, 'n/a'));
  const fromNumber = toText(message.from_number, toText(message.from, 'n/a'));
  const body = toText(message.body, '').slice(0, 90);
  const bodySummary = body ? ` | body=${body}` : '';
  return `sid=${messageSid} | status=${status}${direction ? ` | direction=${direction}` : ''} | to=${toNumber} | from=${fromNumber}${bodySummary}`;
}

export function parseCallbackToken(raw: string): { baseAction: string; suffix: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { baseAction: '', suffix: '' };
  const separatorIndex = trimmed.indexOf(':');
  if (separatorIndex < 0) {
    return { baseAction: trimmed.toUpperCase(), suffix: '' };
  }
  return {
    baseAction: trimmed.slice(0, separatorIndex).trim().toUpperCase(),
    suffix: trimmed.slice(separatorIndex + 1).trim(),
  };
}

const CALLBACK_ACTION_LABELS: Record<string, string> = {
  SMS_SEND: 'Send SMS',
  SMS_SCHEDULE: 'Schedule SMS',
  SMS_STATUS: 'Check SMS Status',
  SMS_CONVO: 'Load Conversation',
  SMS_RECENT: 'Load Recent SMS',
  SMS_RECENT_PAGE: 'Load Recent SMS (Paged)',
  SMS_STATS: 'Load SMS Stats',
  BULK_SMS_PRECHECK: 'Run SMS Provider Precheck',
  BULK_SMS_LIST: 'Load Bulk SMS Jobs',
  BULK_SMS_STATUS: 'Load Bulk SMS Job Details',
  BULK_SMS_STATS: 'Load Bulk SMS Stats',
  EMAIL_SEND: 'Send Email',
  EMAIL_STATUS: 'Check Email Status',
  EMAIL_TIMELINE: 'Load Email Timeline',
  EMAIL_TEMPLATES: 'Load Templates',
  EMAIL_HISTORY: 'Load Email History',
  EMAIL_BULK: 'Load Bulk Email Job Details',
  BULK_EMAIL_PRECHECK: 'Run Email Provider Precheck',
  BULK_EMAIL_SEND: 'Queue Bulk Email',
  BULK_EMAIL_STATUS: 'Load Bulk Email Job Status',
  BULK_EMAIL_LIST: 'Load Bulk Email Jobs',
  BULK_EMAIL_PAGE: 'Load Bulk Email Jobs (Paged)',
  BULK_EMAIL_STATS: 'Load Bulk Email Stats',
};

export function resolveCallbackActionLabel(raw: string): string {
  const { baseAction } = parseCallbackToken(raw);
  return CALLBACK_ACTION_LABELS[baseAction] || 'Selected action';
}

function normalizeCallPersonaPurpose(value: unknown): CallPersonaPurposeOption | null {
  const record = asRecord(value);
  const id = toText(record.id ?? record.slug ?? record.name, '').trim();
  if (!id) return null;
  return {
    id,
    label: toText(record.label ?? record.name, id).trim() || id,
    emoji: toText(record.emoji, '').trim() || undefined,
    defaultEmotion: toText(record.defaultEmotion ?? record.default_emotion, '').trim() || undefined,
    defaultUrgency: toText(record.defaultUrgency ?? record.default_urgency, '').trim() || undefined,
    defaultTechnicalLevel: toText(
      record.defaultTechnicalLevel ?? record.default_technical_level,
      '',
    ).trim() || undefined,
  };
}

export function normalizeCallPersonaProfile(value: unknown): CallPersonaProfile | null {
  const record = asRecord(value);
  const id = toText(record.slug ?? record.id, '').trim();
  if (!id) return null;
  const purposes = Array.isArray(record.purposes)
    ? record.purposes.map(normalizeCallPersonaPurpose).filter(Boolean) as CallPersonaPurposeOption[]
    : [];
  const defaultPurpose = toText(
    record.defaultPurpose ?? record.default_purpose,
    purposes[0]?.id || 'general',
  ).trim() || 'general';
  return {
    id,
    label: toText(record.label ?? record.name, id).trim() || id,
    description: toText(record.description, '').trim(),
    emoji: toText(record.emoji, '').trim() || undefined,
    purposes,
    defaultPurpose,
    defaultEmotion: toText(record.defaultEmotion ?? record.default_emotion, '').trim() || undefined,
    defaultUrgency: toText(record.defaultUrgency ?? record.default_urgency, '').trim() || undefined,
    defaultTechnicalLevel: toText(
      record.defaultTechnicalLevel ?? record.default_technical_level,
      '',
    ).trim() || undefined,
    custom: Boolean(record.custom || id === CALL_CUSTOM_PERSONA_ID),
    dynamic: Boolean(record.slug && id !== CALL_CUSTOM_PERSONA_ID),
  };
}

export function mergeCallPersonaProfiles(
  primary: CallPersonaProfile[],
  fallback: ReadonlyArray<CallPersonaProfile>,
): CallPersonaProfile[] {
  const merged = new Map<string, CallPersonaProfile>();
  primary.forEach((profile) => {
    merged.set(profile.id, profile);
  });
  fallback.forEach((profile) => {
    if (profile.custom || !merged.has(profile.id)) {
      merged.set(profile.id, merged.get(profile.id) || profile);
    }
  });
  return [...merged.values()];
}

export function buildCallPersonaOptionLabel(profile: CallPersonaProfile): string {
  if (profile.custom) return 'Custom Persona';
  return profile.emoji ? `${profile.emoji} ${profile.label}` : profile.label;
}

export function buildCallVoiceOptionLabel(option: CallVoiceModelOption): string {
  if (option.gender === 'male') return `${option.label} (male, ${option.style})`;
  if (option.gender === 'female') return `${option.label} (female, ${option.style})`;
  return `${option.label} (${option.style})`;
}

export function buildPersonalizedCallFirstMessage(
  baseMessage: string,
  victimName: string,
  personaLabel: string,
): string {
  if (!victimName) {
    return baseMessage;
  }
  const greeting = `Hello ${victimName}!`;
  const trimmedBase = baseMessage.trim();
  if (!trimmedBase) {
    const brandLabel = personaLabel || 'our team';
    return `${greeting} Welcome to ${brandLabel}!`;
  }
  const withoutExistingGreeting = trimmedBase.replace(/^hello[^.!?]*[.!?]?\s*/i, '').trim();
  const remainder = withoutExistingGreeting || trimmedBase;
  return `${greeting} ${remainder}`;
}

export function toCallScriptRows(value: unknown): CallScriptRecord[] {
  return Array.isArray(value) ? value as CallScriptRecord[] : [];
}

export function toFlowTypeLabel(script: CallScriptRecord): string {
  const flowTypes = Array.isArray(script.flow_types)
    ? script.flow_types.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if (flowTypes.length > 0) return flowTypes[0];
  return toTextValue(script.flow_type, 'general') || 'general';
}

export function toFlowTypes(script: CallScriptRecord | null): string[] {
  if (!script) return [];
  const flowTypes = toTextList(script.flow_types)
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);
  if (flowTypes.length > 0) return flowTypes;
  const flowType = toTextValue(script.flow_type).toLowerCase();
  return flowType ? [flowType] : [];
}

export function toPersonaConfig(value: unknown): CallScriptPersonaConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as CallScriptPersonaConfig;
}

export function extractScriptVariables(scriptText = ''): string[] {
  const matches = scriptText.match(/\{(\w+)\}/g) || [];
  return Array.from(new Set(matches.map((token) => token.replace(/[{}]/g, ''))));
}

export function replacePlaceholders(text = '', values: Record<string, string>): string {
  let output = text;
  for (const [token, value] of Object.entries(values)) {
    const pattern = new RegExp(`{${token}}`, 'g');
    output = output.replace(pattern, value);
  }
  return output;
}

export function getOptionLabel(
  options: ReadonlyArray<{ id: string; label: string }>,
  id: string,
  fallback: string,
): string {
  return options.find((option) => option.id === id)?.label || fallback;
}

export function inferCustomCallFlow(prompt: string, firstMessage: string): string {
  const combinedText = `${prompt} ${firstMessage}`.trim().toLowerCase();
  if (!combinedText) return 'general';

  let bestFlow = 'general';
  let bestScore = 0;

  Object.entries(CALL_CUSTOM_FLOW_TEXT_SIGNALS).forEach(([flowId, signals]) => {
    let score = 0;
    signals.forEach((signal) => {
      const normalizedSignal = signal.toLowerCase().trim();
      if (!normalizedSignal) return;
      if (combinedText.includes(normalizedSignal)) {
        score += normalizedSignal.includes(' ') ? 2 : 1;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      bestFlow = flowId;
    }
  });

  return bestFlow;
}

export function getCommandContent(
  pageId: CommandPageId,
  accessLevel: MiniAppCommandAccessLevel,
): CommandContentSection[] {
  if (pageId === 'START') {
    if (accessLevel === 'guest') {
      return [
        {
          header: 'Welcome posture',
          items: [
            'Review available workflows and current access before you start work in the admin console.',
            'Use Help Center to review available workflows and access expectations.',
          ],
        },
        {
          header: 'Guest next steps',
          items: [
            'Open Usage Guide for workflow rules and safe usage practices.',
            'Open Quick Actions for the workflows currently available in the Mini App.',
            'Request access from an admin to unlock call, SMS, and email execution.',
          ],
        },
      ];
    }

    const sections: CommandContentSection[] = [
      {
        header: 'Welcome posture',
        items: [
          'Start from the workflows available to your current access level.',
          'Each action below opens the same backend-backed flow used across the admin console.',
        ],
      },
      {
        header: 'Primary workflows',
        items: [
          'Call opens outbound call workflows.',
          'SMS and Email open messaging and delivery workflows.',
          'Call Log opens recent calls, search, details, and events.',
        ],
      },
      {
        header: 'Utilities',
        items: [
          'Usage Guide, Help Center, and Quick Actions remain available for navigation and operator guidance.',
          'Health exposes runtime posture and Status provides deeper admin diagnostics.',
        ],
      },
    ];

    if (accessLevel === 'admin') {
      sections.push({
        header: 'Admin extensions',
        items: [
          'SMS Sender and Mailer stay available through admin workspace routes.',
          'Users, Caller Flags, Scripts, and Provider remain available as admin workflows.',
        ],
      });
    }

    return sections;
  }

  if (pageId === 'HELP') {
    if (accessLevel === 'guest') {
      return [
        {
          header: 'Access posture',
          items: [
            'You can review menus and guides, but execution remains locked until access is approved.',
            'Authorization is managed separately from this Mini App session.',
          ],
        },
        {
          header: 'What this app can do',
          items: [
            'Run AI-powered voice calls and message workflows.',
            'Track call, SMS, and email execution from the same backend.',
            'Let admins manage users, scripts, providers, and investigations.',
          ],
        },
      ];
    }
    const sections: CommandContentSection[] = [
      {
        header: 'Call tools',
        items: [
          'Call opens the Mini App call composer for custom outbound calls.',
          'Call Log opens recent calls, search, details, and events.',
        ],
      },
      {
        header: 'Messaging tools',
        items: [
          'SMS opens the SMS center and diagnostics.',
          'Email opens sending, status, and history workflows.',
        ],
      },
      {
        header: 'Navigation',
        items: [
          'Quick Actions reopens the core workspace launcher.',
          'Usage Guide shows operating guidance and number rules.',
          'Health and Status surface runtime posture through the ops workspace.',
        ],
      },
      {
        header: 'Quick usage',
        items: [
          'Use the quick-action list below to open the workspace you need.',
          'If a workflow is not available in this build, the page tells you directly instead of sending you into a dead end.',
        ],
      },
    ];
    if (accessLevel === 'admin') {
      sections.push({
        header: 'Admin toolkit',
        items: [
          'Users manages access and roles.',
          'Caller Flags moderates inbound caller flags.',
          'Provider, SMS Sender, and Mailer stay on the admin console routes.',
        ],
      });
    }
    return sections;
  }

  if (pageId === 'SMS') {
    if (accessLevel === 'guest') {
      return [
        {
          header: 'SMS center access',
          items: [
            'SMS tools stay locked until your account has the required access.',
            'You can still review the workflow layout and operating guidance before requesting approval.',
          ],
        },
        {
          header: 'Guest next steps',
          items: [
            'Use Help Center for access expectations and workflow guidance.',
            'Use Usage Guide for number formatting rules and safe delivery practices.',
          ],
        },
      ];
    }

    const sections: CommandContentSection[] = [
      {
        header: 'SMS center workflow',
        items: [
          'Keep send, schedule, delivery checks, and diagnostics in one SMS workspace.',
          'Actions on this page use the same live workflows available across the wider operations console.',
        ],
      },
      {
        header: 'Current workflow coverage',
        items: [
          'Single-recipient workflows execute here with the same live operations used in the admin console.',
          'Advanced send, status, conversation, paging, and stats actions stay aligned with the shared operations workflow and show clear status when extra access is required.',
          'High-volume bulk execution remains in SMS Sender with precheck and batching safeguards.',
        ],
      },
      {
        header: 'Operational safety',
        items: [
          'Validate E.164 recipients and test with small batches before wider sends.',
          'If a workflow is not active on this screen yet, it still stays visible with clear status so operators can continue in the right workspace.',
        ],
      },
    ];

    if (accessLevel === 'admin') {
      sections.push({
        header: 'Admin sender controls',
        items: [
          'SMS Sender remains the bulk SMS execution control plane.',
          'Use schedule and delivery checks before high-volume sends.',
        ],
      });
    }

    return sections;
  }

  if (pageId === 'EMAIL') {
    if (accessLevel === 'guest') {
      return [
        {
          header: 'Email center access',
          items: [
            'Email tools stay locked until your account has the required access.',
            'You can still review the workflow layout, guidance, and handoff points before requesting approval.',
          ],
        },
        {
          header: 'Guest next steps',
          items: [
            'Use Help Center for access details and workflow guidance.',
            'Use Usage Guide for safe usage practices and operational checks.',
          ],
        },
      ];
    }

    const sections: CommandContentSection[] = [
      {
        header: 'Email center workflow',
        items: [
          'Manage send, status, templates, and history in one email workspace.',
          'This page coordinates the same live email workflows used elsewhere in operations rather than creating a separate path.',
        ],
      },
      {
        header: 'Current workflow coverage',
        items: [
          'Single-recipient send/schedule, template preview, status/timeline, template list, and bulk history execute directly through the shared email workspace.',
          'Advanced send, status, timeline, template, and history actions stay aligned with the same operations workflow used elsewhere in the console.',
          'Mailer remains the high-volume control plane with broader campaign and deliverability tooling.',
        ],
      },
      {
        header: 'Operational safety',
        items: [
          'Use provider diagnostics before large campaigns or incident response actions.',
          'If a workflow is not active on this screen yet, it still stays visible with clear status so operators can continue in the right workspace.',
        ],
      },
    ];

    if (accessLevel === 'admin') {
      sections.push({
        header: 'Admin mailer controls',
        items: [
          'Mailer remains the bulk-email execution control plane.',
          'Use preflight, job status, and history checks before high-volume sends.',
        ],
      });
    }

    return sections;
  }

  if (pageId === 'SCRIPTS') {
    return [
      {
        header: 'Scripts workspace',
        items: [
          'Use this page to enter the script workspace without losing the current admin session context.',
          'Reusable prompts, call scripts, SMS scripts, and email templates stay routed through the existing admin workflows.',
        ],
      },
      {
        header: 'Workspace split',
        items: [
          'Script Designer is the primary script workspace and switches between call, SMS, and email editing lanes.',
          'Message Lanes provides the narrower SMS and email editor when operators want a more focused workspace.',
        ],
      },
      {
        header: 'Operational rule',
        items: [
          'This route should hand operators into the correct workspace, not duplicate script business logic locally.',
          'If script capabilities drift, update the shared script contracts first so both downstream workspaces stay aligned.',
        ],
      },
    ];
  }

  if (pageId === 'GUIDE') {
    const sections: CommandContentSection[] = [
      {
        header: 'Making calls',
        items: [
          'Start a call from the Call quick action.',
          'The Mini App supports both custom and script-backed call launches against the live call workflow.',
          'Script browsing may be limited in some sessions, but you can still launch with a known script ID or continue in Script Designer for the full guided flow.',
          'Provide the destination number in E.164 format such as +18005551234.',
          'Describe persona, objective, and first spoken message clearly.',
        ],
      },
      {
        header: 'Phone number rules',
        items: [
          'Include the + symbol and country code first.',
          'Avoid spaces, punctuation, or local-only number formatting.',
          'Validate the number before scaling to larger campaigns.',
        ],
      },
      {
        header: 'Best practices',
        items: [
          'Keep prompts precise so the model remains on task.',
          'Test with a short call or a small batch before wider execution.',
          'Use health and status views before blaming downstream providers.',
        ],
      },
    ];
    if (accessLevel === 'guest') {
      sections.unshift({
        header: 'Limited access',
        items: [
          'You can review the usage guide now, but execution workflows require approval.',
          'Use Help Center or Quick Actions to review currently reachable Mini App surfaces.',
        ],
      });
    } else if (accessLevel === 'admin') {
      sections.push({
        header: 'Admin controls',
        items: [
          'Provider changes, user access, and bulk message launchers remain admin-scoped.',
          'Use the Admin Console quick action when you need the full dashboard shell.',
        ],
      });
    }
    return sections;
  }

  if (pageId === 'HEALTH') {
    return [
      {
        header: 'Health workflow',
        items: [
          'Review quick runtime posture from the same session snapshot used across the admin console.',
          'Use refresh when you need the latest state without leaving this workspace.',
          'Open Incident Status for deeper runtime controls and admin diagnostics.',
        ],
      },
      {
        header: 'Session behavior',
        items: [
          'If session refresh fails, the page keeps last-known visibility and shows the blocking error code.',
          'Unknown or stale navigation still returns to the admin console instead of hard-failing.',
        ],
      },
    ];
  }

  if (pageId === 'STATUS') {
    return [
      {
        header: 'Status workflow',
        items: [
          'Review detailed runtime posture from the same session snapshot used by operations.',
          'Use Provider or Admin Console quick actions when incident handling requires admin-level workflows.',
          'This route stays admin-scoped and always respects server authorization.',
        ],
      },
      {
        header: 'Operational checks',
        items: [
          'Check runtime mode/canary/circuit before applying maintenance changes in admin workflows.',
          'Review bridge status history and queue backlog before escalating to provider-level remediation.',
        ],
      },
    ];
  }

  return [
    {
      header: 'Quick actions',
      items: [
        'Use this page to open only the quick actions relevant to your current access tier.',
        'Each item below opens the workflow available for your current access level and shows clear status when extra access is needed.',
      ],
    },
    {
      header: 'Workflow rule',
      items: [
        'Quick Actions should launch real supported workflows, not standalone Mini App logic.',
        'Actions remain listed even when they continue in another workspace, so operators can see the full surface from one menu.',
      ],
    },
  ];
}
