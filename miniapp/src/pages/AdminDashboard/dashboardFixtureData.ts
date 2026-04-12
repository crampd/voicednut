import { asRecord, toText } from '@/services/admin-dashboard/dashboardPrimitives';
import {
  DASHBOARD_ACTION_CONTRACTS,
  DASHBOARD_MODULE_ACTION_IDS,
} from '@/contracts/miniappParityContracts';

type DashboardFixtureRole = 'admin' | 'operator' | 'viewer';

const DASHBOARD_ALL_CAPS = [
  'dashboard_view',
  'sms_bulk_manage',
  'email_bulk_manage',
  'provider_manage',
  'caller_flags_manage',
  'users_manage',
] as const;

const DASHBOARD_ALL_MODULES = [
  'ops',
  'sms',
  'mailer',
  'provider',
  'content',
  'calllog',
  'callerflags',
  'scriptsparity',
  'messaging',
  'persona',
  'users',
  'audit',
] as const;

const DASHBOARD_FIXTURE_ROLE_QUERY_PARAM = 'fixtureRole';

const DASHBOARD_CAPS_BY_ROLE: Record<DashboardFixtureRole, readonly string[]> = {
  admin: DASHBOARD_ALL_CAPS,
  operator: ['dashboard_view'],
  viewer: [],
};

const DASHBOARD_SUPPORTED_ACTIONS = [...DASHBOARD_MODULE_ACTION_IDS];

const CALL_PERSONA_FIXTURE_BUILTIN = [
  {
    id: 'general',
    label: 'General',
    description: 'General voice call assistant',
    purposes: [{ id: 'general', label: 'General' }],
    default_purpose: 'general',
    default_emotion: 'neutral',
    default_urgency: 'normal',
    default_technical_level: 'general',
  },
  {
    id: 'technical_support',
    label: 'Technical Support',
    description: 'Guides callers through troubleshooting and onboarding steps.',
    purposes: [
      {
        id: 'general',
        label: 'General Troubleshooting',
        default_emotion: 'frustrated',
        default_urgency: 'normal',
        default_technical_level: 'novice',
      },
      {
        id: 'installation',
        label: 'Installation Help',
        default_emotion: 'confused',
        default_urgency: 'normal',
        default_technical_level: 'general',
      },
      {
        id: 'outage',
        label: 'Service Outage',
        default_emotion: 'urgent',
        default_urgency: 'high',
        default_technical_level: 'advanced',
      },
    ],
    default_purpose: 'general',
    default_emotion: 'frustrated',
    default_urgency: 'normal',
    default_technical_level: 'novice',
  },
  {
    id: 'finance',
    label: 'Financial Services',
    description: 'Covers account alerts, payment reminders, and fraud reviews.',
    purposes: [
      {
        id: 'security',
        label: 'Security Alert',
        default_emotion: 'urgent',
        default_urgency: 'high',
        default_technical_level: 'general',
      },
      {
        id: 'payment',
        label: 'Payment Reminder',
        default_emotion: 'neutral',
        default_urgency: 'normal',
        default_technical_level: 'general',
      },
      {
        id: 'fraud',
        label: 'Fraud Investigation',
        default_emotion: 'urgent',
        default_urgency: 'critical',
        default_technical_level: 'advanced',
      },
    ],
    default_purpose: 'security',
    default_emotion: 'urgent',
    default_urgency: 'high',
    default_technical_level: 'advanced',
  },
];

function isDashboardFixtureRole(value: unknown): value is DashboardFixtureRole {
  return value === 'admin' || value === 'operator' || value === 'viewer';
}

function resolveDashboardFixtureRole(): DashboardFixtureRole {
  const envRole = String(import.meta.env.VITE_ADMIN_DASHBOARD_DEV_FIXTURE_ROLE || '')
    .trim()
    .toLowerCase();
  let requestedRole = envRole;

  if (typeof window !== 'undefined') {
    const queryRole = new URLSearchParams(window.location.search)
      .get(DASHBOARD_FIXTURE_ROLE_QUERY_PARAM)
      ?.trim()
      .toLowerCase();
    if (queryRole) {
      requestedRole = queryRole;
    }
  }

  return isDashboardFixtureRole(requestedRole) ? requestedRole : 'admin';
}

function createDashboardFixturePayload(
  nowIso: string,
  role: DashboardFixtureRole,
): Record<string, unknown> {
  const sessionCaps = [...DASHBOARD_CAPS_BY_ROLE[role]];
  return {
    success: true,
    poll_interval_seconds: 15,
    poll_at: nowIso,
    server_time: nowIso,
    supported_actions: DASHBOARD_SUPPORTED_ACTIONS,
    supported_action_count: DASHBOARD_SUPPORTED_ACTIONS.length,
    session: {
      telegram_id: 1,
      role,
      role_source: 'dev_fixture',
      caps: sessionCaps,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    module_layout: {
      active_module: 'ops',
      modules: DASHBOARD_ALL_MODULES.map((id, index) => ({ id, enabled: true, order: index })),
    },
    provider: {
      providers: {
        call: {
          provider: 'twilio',
          supported_providers: ['twilio', 'vonage'],
          readiness: { twilio: 'ready', vonage: 'ready' },
        },
        sms: {
          provider: 'twilio',
          supported_providers: ['twilio', 'vonage'],
          readiness: { twilio: 'ready', vonage: 'ready' },
        },
        email: {
          provider: 'ses',
          supported_providers: ['ses', 'sendgrid'],
          readiness: { ses: 'ready', sendgrid: 'ready' },
        },
      },
    },
    provider_compatibility: {
      channels: {
        call: {
          twilio: { ready: true, degraded: false, parity_gaps: [] },
          vonage: { ready: true, degraded: false, parity_gaps: [] },
        },
        sms: {
          twilio: { ready: true, degraded: false, parity_gaps: [] },
          vonage: { ready: true, degraded: false, parity_gaps: [] },
        },
        email: {
          ses: { ready: true, degraded: false, parity_gaps: [] },
          sendgrid: { ready: true, degraded: false, parity_gaps: [] },
        },
      },
    },
    sms_bulk: {
      summary: {
        totalRecipients: 0,
        totalSuccessful: 0,
        totalFailed: 0,
      },
    },
    email_bulk_stats: {
      stats: {
        total_recipients: 0,
        sent: 0,
        failed: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        suppressed: 0,
      },
    },
    email_bulk_history: { jobs: [] },
    dlq: {
      call_open: 0,
      email_open: 0,
      call_preview: [],
      email_preview: [],
    },
    call_logs: {
      rows: [],
      total: 0,
      limit: 20,
      offset: 0,
    },
    call_scripts: {
      scripts: [
        {
          id: 1,
          name: 'Welcome Script',
          description: 'Default fixture script for local QA flows.',
          prompt: 'You are a helpful assistant.',
          first_message: 'Hello, this is the fixture flow.',
          default_profile: 'default',
          objective_tags: ['support'],
          flow_type: 'default',
          lifecycle_state: 'draft',
          version: 1,
        },
      ],
      total: 1,
      limit: 20,
      flow_types: ['default'],
    },
    call_stats: {
      total_calls: 0,
      completed_calls: 0,
      failed_calls: 0,
      success_rate: 100,
      recent_calls: 0,
      unique_users: 0,
    },
    voice_runtime: {
      runtime: {
        effective_mode: 'legacy',
        configured_mode: 'legacy',
        mode_override: 'none',
        effective_canary_percent: 0,
        canary_percent_override: null,
        circuit: {
          is_open: false,
          forced_legacy_until: null,
        },
      },
      active_calls: {
        total: 0,
        legacy: 0,
        voice_agent: 0,
      },
      actions: [],
      applied: [],
    },
    users: {
      rows: [
        {
          telegram_id: 1,
          role,
          role_source: 'dev_fixture',
          total_calls: 0,
          successful_calls: 0,
          failed_calls: 0,
          last_activity: nowIso,
        },
      ],
      total: 1,
    },
    audit: {
      rows: [
        {
          id: 'fixture-audit-1',
          service_name: 'miniapp',
          status: 'ok',
          details: 'Fixture audit event',
          timestamp: nowIso,
        },
      ],
      summary: {
        total: 1,
      },
      hours: 24,
    },
    incidents: {
      alerts: [],
      total_alerts: 0,
      runbooks: [
        {
          action: DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT,
          label: 'Run provider preflight',
          capability: 'provider_manage',
        },
      ],
      summary: {
        open: 0,
      },
    },
    ops: {
      queue_backlog: {
        total: 0,
        dlq_call_open: 0,
        dlq_email_open: 0,
        sms_failed: 0,
        email_failed: 0,
      },
      status: 'healthy',
      health: 'ok',
      qa: {
        window_hours: 168,
        totals: {
          total: 12,
          passed: 10,
          pass_rate: 83.33,
          avg_score: 91.2,
          scored: 12,
          insufficient_transcript: 0,
          skipped: 0,
        },
        top_findings: [
          { finding: 'Long hold time before first response', count: 2 },
          { finding: 'Compliance disclosure delayed', count: 1 },
        ],
        profile_breakdown: [
          {
            profile: 'customer_support',
            total: 8,
            passed: 7,
            pass_rate: 87.5,
            avg_score: 92.1,
          },
          {
            profile: 'lead_qualification',
            total: 4,
            passed: 3,
            pass_rate: 75,
            avg_score: 89.5,
          },
        ],
        trend_bucket: 'day',
        trend_series: [
          { bucket: '2026-03-12', total: 1, passed: 1, pass_rate: 100, avg_score: 94 },
          { bucket: '2026-03-13', total: 2, passed: 2, pass_rate: 100, avg_score: 93.5 },
          { bucket: '2026-03-14', total: 2, passed: 1, pass_rate: 50, avg_score: 82 },
          { bucket: '2026-03-15', total: 1, passed: 1, pass_rate: 100, avg_score: 95 },
          { bucket: '2026-03-16', total: 3, passed: 2, pass_rate: 66.67, avg_score: 88 },
          { bucket: '2026-03-17', total: 2, passed: 2, pass_rate: 100, avg_score: 96 },
          { bucket: '2026-03-18', total: 1, passed: 1, pass_rate: 100, avg_score: 90 },
        ],
        profile_thresholds: {
          default: 70,
          customer_support: 85,
          lead_qualification: 90,
        },
        low_score_calls: [],
        updated_at: nowIso,
      },
    },
    bridge: {
      hard_failures: 0,
      soft_failures: 0,
    },
  };
}

function resolveDashboardFixtureActionData(
  action: string,
  nowIso: string,
  role: DashboardFixtureRole,
  payload: Record<string, unknown> = {},
): Record<string, unknown> {
  const requestedCallSid = toText(payload.call_sid, '').trim() || 'CA_FIXTURE_CALL_001';
  switch (action) {
    case DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_LIST:
      return {
        scripts: [
          {
            id: 1,
            name: 'Welcome Script',
            description: 'Default fixture script for local QA flows.',
            prompt: 'You are a helpful assistant.',
            first_message: 'Hello, this is the fixture flow.',
            default_profile: 'default',
            objective_tags: ['support'],
            flow_type: 'default',
            lifecycle_state: 'draft',
            version: 1,
          },
        ],
        total: 1,
      };
    case DASHBOARD_ACTION_CONTRACTS.CALLS_GET:
      return {
        call: {
          call_sid: requestedCallSid,
          phone_number: '+15551230000',
          customer_name: 'Fixture Contact',
          provider: 'twilio',
          status: 'in-progress',
          direction: 'outbound-api',
          flow_state: 'collecting_context',
          call_mode: 'custom',
          created_at: nowIso,
          started_at: nowIso,
          updated_at: nowIso,
        },
      };
    case DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS:
      return {
        call_sid: requestedCallSid,
        recent_states: [
          {
            id: 'fixture-state-1',
            event: 'call.initiated',
            status: 'initiated',
            timestamp: nowIso,
            provider: 'twilio',
          },
          {
            id: 'fixture-state-2',
            event: 'call.answered',
            status: 'in-progress',
            timestamp: nowIso,
            provider: 'twilio',
          },
        ],
        notification_status: [
          {
            id: 'fixture-webhook-1',
            event: 'webhook.status',
            status: 'delivered',
            timestamp: nowIso,
            provider: 'twilio',
          },
        ],
        live_console: {
          status: 'in-progress',
          phase: 'Collecting context',
          provider: 'twilio',
          preview: 'Fixture live console snapshot from webhook-backed runtime state.',
          updated_at: nowIso,
        },
      };
    case DASHBOARD_ACTION_CONTRACTS.USERS_LIST:
      return {
        rows: [
          {
            telegram_id: 1,
            role,
            role_source: 'dev_fixture',
            total_calls: 0,
            successful_calls: 0,
            failed_calls: 0,
            last_activity: nowIso,
          },
        ],
        total: 1,
      };
    case DASHBOARD_ACTION_CONTRACTS.AUDIT_FEED:
      return {
        rows: [
          {
            id: 'fixture-audit-1',
            service_name: 'miniapp',
            status: 'ok',
            details: 'Fixture audit event',
            timestamp: nowIso,
          },
        ],
        summary: { total: 1 },
        hours: 24,
      };
    case DASHBOARD_ACTION_CONTRACTS.INCIDENTS_SUMMARY:
      return {
        alerts: [],
        total_alerts: 0,
        runbooks: [
          {
            action: DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT,
            label: 'Run provider preflight',
            capability: 'provider_manage',
          },
        ],
        summary: { open: 0 },
      };
    case DASHBOARD_ACTION_CONTRACTS.PROVIDER_PREFLIGHT:
    case DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT:
      return { success: true, result: 'ok' };
    default:
      return { success: true, applied_at: nowIso };
  }
}

export function resolveDashboardFixtureRequest(path: string, options: RequestInit = {}): unknown {
  const nowIso = new Date().toISOString();
  const role = resolveDashboardFixtureRole();
  if (path === '/miniapp/bootstrap' || path === '/miniapp/jobs/poll') {
    return createDashboardFixturePayload(nowIso, role);
  }
  if (path === '/api/personas') {
    return {
      success: true,
      builtin: CALL_PERSONA_FIXTURE_BUILTIN,
      custom: [],
    };
  }
  if (path === '/miniapp/calls/active') {
    return {
      success: true,
      resumed: false,
      call: null,
    };
  }
  if (path === '/miniapp/action') {
    const rawBody = typeof options.body === 'string' ? options.body : '{}';
    let parsedBody: Record<string, unknown> = {};
    try {
      parsedBody = asRecord(JSON.parse(rawBody));
    } catch {
      parsedBody = {};
    }
    const action = toText(parsedBody.action, '');
    const payload = asRecord(parsedBody.payload);
    return {
      success: true,
      data: resolveDashboardFixtureActionData(action, nowIso, role, payload),
    };
  }
  return { success: true };
}
