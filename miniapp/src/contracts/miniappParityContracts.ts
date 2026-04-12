export const BOT_PRIMARY_COMMANDS = {
  START: '/start',
  HELP: '/help',
  MENU: '/menu',
  GUIDE: '/guide',
  HEALTH: '/health',
  CALL: '/call',
  CALLLOG: '/calllog',
  SMS: '/sms',
  EMAIL: '/email',
  SMSSENDER: '/smssender',
  MAILER: '/mailer',
  SCRIPTS: '/scripts',
  PERSONA: '/persona',
  PROVIDER: '/provider',
  CALLERFLAGS: '/callerflags',
  USERS: '/users',
  ADMIN: '/admin',
  STATUS: '/status',
} as const;

export const BOT_COMPAT_COMMANDS = {
  PING: '/ping',
  SCHEDULESMS: '/schedulesms',
  SMSCONVERSATION: '/smsconversation',
  SMSSTATS: '/smsstats',
  SMSSTATUS: '/smsstatus',
  RECENTSMS: '/recentsms',
  EMAILSTATUS: '/emailstatus',
} as const;

export const BOT_CALLBACK_ACTIONS = [
  'CALL',
  'SMS',
  'EMAIL',
  'CALLLOG',
  'GUIDE',
  'HELP',
  'MENU',
  'HEALTH',
  'STATUS',
  'USERS',
  'USERS_LIST',
  'CALLER_FLAGS',
  'CALLER_FLAGS_LIST',
  'BULK_SMS',
  'BULK_SMS_PRECHECK',
  'BULK_SMS_SEND',
  'BULK_SMS_STATUS',
  'BULK_SMS_LIST',
  'BULK_SMS_STATS',
  'BULK_EMAIL',
  'BULK_EMAIL_PRECHECK',
  'BULK_EMAIL_SEND',
  'BULK_EMAIL_STATUS',
  'BULK_EMAIL_LIST',
  'BULK_EMAIL_STATS',
  'EMAIL_SEND',
  'EMAIL_STATUS',
  'EMAIL_TIMELINE',
  'EMAIL_BULK',
  'EMAIL_TEMPLATES',
  'EMAIL_HISTORY',
  'PROVIDER_STATUS',
  'PROVIDER_SET',
  'PROVIDER_CONFIRM',
  'PROVIDER_APPLY',
  'SCRIPTS',
  'PERSONA',
  'ADMIN_PANEL',
  'SMS_SEND',
  'SMS_SCHEDULE',
  'SMS_STATUS',
  'SMS_CONVO',
  'SMS_STATS',
  'SMS_RECENT',
  'SMS_RECENT_PAGE',
  'CALLLOG_RECENT',
  'CALLLOG_SEARCH',
  'CALLLOG_DETAILS',
  'CALLLOG_EVENTS',
  'CALL_DETAILS',
] as const;

export const DASHBOARD_MODULE_IDS = [
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

export type DashboardModuleId = typeof DASHBOARD_MODULE_IDS[number];

export const DASHBOARD_STATIC_ROUTE_CONTRACTS = {
  ROOT: '/',
  SETTINGS: '/settings',
} as const;

export const MINIAPP_COMMAND_ROUTE_CONTRACTS = {
  START: '/start',
  CALL: '/call',
  SMS: '/sms',
  EMAIL: '/email',
  SCRIPTS: '/scripts',
  HELP: '/help',
  MENU: '/menu',
  GUIDE: '/guide',
  HEALTH: '/health',
  STATUS: '/status',
} as const;

export const DASHBOARD_MODULE_ROUTE_CONTRACTS: Record<DashboardModuleId, string> = {
  ops: '/ops',
  sms: '/smssender',
  mailer: '/mailer',
  provider: '/provider',
  content: '/content',
  calllog: '/calllog',
  callerflags: '/callerflags',
  scriptsparity: '/scriptsparity',
  messaging: '/messaging',
  persona: '/persona',
  users: '/users',
  audit: '/audit',
};

export const DASHBOARD_MODULE_SCREEN_CONTRACTS: Record<DashboardModuleId, {
  label: string;
  capability: string;
}> = {
  ops: {
    label: 'Ops Dashboard',
    capability: 'dashboard_view',
  },
  sms: {
    label: 'SMS Sender',
    capability: 'users_manage',
  },
  mailer: {
    label: 'Mailer',
    capability: 'email_bulk_manage',
  },
  provider: {
    label: 'Provider Control',
    capability: 'provider_manage',
  },
  content: {
    label: 'Script Designer',
    capability: 'caller_flags_manage',
  },
  calllog: {
    label: 'Call Log Explorer',
    capability: 'dashboard_view',
  },
  callerflags: {
    label: 'Caller Screening',
    capability: 'caller_flags_manage',
  },
  scriptsparity: {
    label: 'Message Lanes',
    capability: 'caller_flags_manage',
  },
  messaging: {
    label: 'Messaging Investigation',
    capability: 'dashboard_view',
  },
  persona: {
    label: 'Persona Manager',
    capability: 'caller_flags_manage',
  },
  users: {
    label: 'User & Role Admin',
    capability: 'users_manage',
  },
  audit: {
    label: 'System Status & Audit',
    capability: 'dashboard_view',
  },
};

export type DashboardWorkflowStatus = 'aligned' | 'partial' | 'dashboard-composed' | 'shell-only';

export type DashboardPageWorkflowContract = {
  pageId: string;
  path: string;
  pageComponent: string;
  canonicalCommand: string;
  relatedCommands: readonly string[];
  capability: string | null;
  workflowStatus: DashboardWorkflowStatus;
  fallbackPath: string;
  moduleId: DashboardModuleId | null;
  notes: string;
};

export const DASHBOARD_PAGE_WORKFLOW_CONTRACTS: readonly DashboardPageWorkflowContract[] = [
  {
    pageId: 'dashboard.home',
    path: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    pageComponent: 'AdminDashboardPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.ADMIN,
    relatedCommands: [BOT_PRIMARY_COMMANDS.MENU, BOT_PRIMARY_COMMANDS.START],
    capability: null,
    workflowStatus: 'shell-only',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: null,
    notes: 'Admin home for navigation, access-aware launchers, and shared settings.',
  },
  {
    pageId: 'dashboard.module.ops',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.ops,
    pageComponent: 'OpsDashboardPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.STATUS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.HEALTH],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.ops.capability,
    workflowStatus: 'dashboard-composed',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'ops',
    notes: 'Live reliability, runtime, and queue signals in one workspace.',
  },
  {
    pageId: 'dashboard.module.sms',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.sms,
    pageComponent: 'SmsSenderPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SMSSENDER,
    relatedCommands: [BOT_PRIMARY_COMMANDS.SMS],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.sms.capability,
    workflowStatus: 'dashboard-composed',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'sms',
    notes: 'Bulk SMS workspace for audience upload, scheduling, and delivery tracking.',
  },
  {
    pageId: 'dashboard.module.mailer',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.mailer,
    pageComponent: 'MailerPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.MAILER,
    relatedCommands: [BOT_PRIMARY_COMMANDS.EMAIL],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.mailer.capability,
    workflowStatus: 'dashboard-composed',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'mailer',
    notes: 'Admin bulk email workspace for readiness checks, queueing, job status, history, and delivery stats.',
  },
  {
    pageId: 'dashboard.module.provider',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.provider,
    pageComponent: 'ProviderControlPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.PROVIDER,
    relatedCommands: [BOT_PRIMARY_COMMANDS.STATUS],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.provider.capability,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'provider',
    notes: 'Provider readiness, switching, and rollback controls for supported channels.',
  },
  {
    pageId: 'dashboard.module.content',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.content,
    pageComponent: 'ScriptStudioPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SCRIPTS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.PERSONA],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.content.capability,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'content',
    notes: 'Primary script designer entry with lane switching across call, SMS, and email editors. Advanced authoring recovery continues in the broader scripts workflow.',
  },
  {
    pageId: 'dashboard.module.calllog',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.calllog,
    pageComponent: 'CallLogExplorerPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.CALLLOG,
    relatedCommands: [BOT_PRIMARY_COMMANDS.CALL],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.calllog.capability,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'calllog',
    notes: 'Recent calls, record details, and event history in one searchable view.',
  },
  {
    pageId: 'dashboard.module.callerflags',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.callerflags,
    pageComponent: 'CallerFlagsModerationPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.CALLERFLAGS,
    relatedCommands: [],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.callerflags.capability,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'callerflags',
    notes: 'Review inbound caller decisions and apply allow, block, or spam updates with shared admin validation.',
  },
  {
    pageId: 'dashboard.module.scriptsparity',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.scriptsparity,
    pageComponent: 'ScriptsParityExpansionPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SCRIPTS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.SMS, BOT_PRIMARY_COMMANDS.EMAIL],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.scriptsparity.capability,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'scriptsparity',
    notes: 'Maintain SMS scripts and email templates here with review, simulation, promotion, and version recovery, while clone and preview handoff still continue in the broader scripts workflow.',
  },
  {
    pageId: 'dashboard.module.messaging',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.messaging,
    pageComponent: 'MessagingInvestigationPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SMS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.EMAIL],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.messaging.capability,
    workflowStatus: 'dashboard-composed',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'messaging',
    notes: 'Investigate SMS and email delivery, conversations, job history, and email batch stats from one shared workspace.',
  },
  {
    pageId: 'dashboard.module.persona',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.persona,
    pageComponent: 'PersonaManagerPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.PERSONA,
    relatedCommands: [BOT_PRIMARY_COMMANDS.SCRIPTS],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.persona.capability,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'persona',
    notes: 'Review the shared persona registry here. Persona create, edit, delete, and cache refresh still continue in the broader bot workflow.',
  },
  {
    pageId: 'dashboard.module.users',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.users,
    pageComponent: 'UsersRolePage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.USERS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.ADMIN],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.users.capability,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'users',
    notes: 'Review authorized users, roles, and access changes.',
  },
  {
    pageId: 'dashboard.module.audit',
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS.audit,
    pageComponent: 'AuditIncidentsPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.STATUS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.HEALTH, BOT_PRIMARY_COMMANDS.ADMIN],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.audit.capability,
    workflowStatus: 'dashboard-composed',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: 'audit',
    notes: 'Review health/status posture, alert history, response actions, and audit trails in one place.',
  },
  {
    pageId: 'dashboard.settings',
    path: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
    pageComponent: 'SettingsPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.ADMIN,
    relatedCommands: [BOT_PRIMARY_COMMANDS.MENU, BOT_PRIMARY_COMMANDS.HELP],
    capability: 'dashboard_view',
    workflowStatus: 'shell-only',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    moduleId: null,
    notes: 'App settings, session controls, accessibility posture, and diagnostics for the current session.',
  },
] as const;

export const DASHBOARD_MODULE_PAGE_WORKFLOW_CONTRACTS = Object.fromEntries(
  DASHBOARD_PAGE_WORKFLOW_CONTRACTS
    .filter((contract): contract is DashboardPageWorkflowContract & { moduleId: DashboardModuleId } => contract.moduleId !== null)
    .map((contract) => [contract.moduleId, contract]),
) as Record<DashboardModuleId, DashboardPageWorkflowContract & { moduleId: DashboardModuleId }>;

export const DASHBOARD_MODULE_COMMAND_CONTRACTS: Record<DashboardModuleId, string> = Object.fromEntries(
  DASHBOARD_MODULE_IDS.map((moduleId) => [
    moduleId,
    DASHBOARD_MODULE_PAGE_WORKFLOW_CONTRACTS[moduleId].canonicalCommand,
  ]),
) as Record<DashboardModuleId, string>;

export type DashboardModuleWorkflowDetailContract = {
  moduleId: DashboardModuleId;
  canonicalCommand: string;
  relatedCommands: readonly string[];
  capability: string | null;
  requiredInputs: readonly string[];
  validationSteps: readonly string[];
  confirmationRules: readonly string[];
  executionActions: readonly string[];
  successBehavior: readonly string[];
  failureBehavior: readonly string[];
  degradedBehavior: readonly string[];
  fallbackPath: string;
  productivityEnhancements: readonly string[];
};

export const DASHBOARD_MODULE_WORKFLOW_DETAIL_CONTRACTS: Record<
  'ops' | 'mailer' | 'content' | 'scriptsparity' | 'messaging' | 'persona' | 'audit',
  DashboardModuleWorkflowDetailContract
> = {
  ops: {
    moduleId: 'ops',
    canonicalCommand: BOT_PRIMARY_COMMANDS.STATUS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.HEALTH, BOT_PRIMARY_COMMANDS.ADMIN],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.ops.capability,
    requiredInputs: [
      'None for status overview and runtime posture refresh',
      'Call SID before call details or call events lookup',
      'Search query before narrowed call log search',
      'Runtime canary percentage before override apply',
    ],
    validationSteps: [
      'Keep runtime mutation controls behind the runtime_controls feature flag.',
      'Require a concrete call SID before details or events requests.',
      'Keep provider diagnostics read-only unless backend action guards authorize a change path.',
    ],
    confirmationRules: [
      'Runtime maintenance toggles, canary overrides, and DLQ replay actions stay explicit operator-triggered actions.',
      'Overview refresh and call exploration remain safe idempotent reads.',
    ],
    executionActions: [
      'runtime.status',
      'calls.list',
      'calls.search',
      'calls.get',
      'calls.events',
      'dlq.call.replay',
      'dlq.email.replay',
    ],
    successBehavior: [
      'Refresh runtime posture and preserve the latest control-plane snapshot after mutations.',
      'Keep call explorer rows, details, and recent event artifacts visible after successful lookups.',
    ],
    failureBehavior: [
      'Preserve the latest telemetry snapshot and show operation-specific errors without clearing the page state.',
      'Leave operator-entered search and call SID values intact after failures.',
    ],
    degradedBehavior: [
      'Expose stale poll or stream posture rather than hiding runtime degradation.',
      'Allow partial call exploration and provider-readiness review even when one telemetry stream is stale.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'Cross-channel telemetry consolidation across calls, SMS, and email.',
      'In-page call explorer with direct details and event drill-down.',
      'DLQ replay shortcuts for operational recovery.',
    ],
  },
  mailer: {
    moduleId: 'mailer',
    canonicalCommand: BOT_PRIMARY_COMMANDS.MAILER,
    relatedCommands: [BOT_PRIMARY_COMMANDS.EMAIL, BOT_COMPAT_COMMANDS.EMAILSTATUS],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.mailer.capability,
    requiredInputs: [
      'One or more valid recipient emails before queueing a batch',
      'Template ID or subject before send',
      'HTML or text body when template ID is absent',
      'Message ID or job ID before diagnostics lookup',
    ],
    validationSteps: [
      'Refresh provider readiness through provider.get(channel=email) before large send decisions.',
      'Parse, deduplicate, and surface invalid recipients before queueing.',
      'Preview template variables and render hints before execution.',
      'Keep template authoring and review in Message Lanes or Script Designer instead of mixing it into bulk-send execution.',
    ],
    confirmationRules: [
      'Queue a bulk email job only after audience and content requirements pass.',
      'Message status, job status, history, and bulk stats actions remain read-only investigations.',
    ],
    executionActions: [
      'email.bulk.send',
      'provider.get',
      'email.message.status',
      'email.bulk.job',
      'email.bulk.history',
      'email.bulk.stats',
    ],
    successBehavior: [
      'Queue the email job while keeping recipient parsing, template preview, and diagnostics visible.',
      'Refresh provider readiness, bulk stats, job, and history artifacts without resetting compose inputs.',
    ],
    failureBehavior: [
      'Preserve compose state and surface inline request errors when queueing fails.',
      'Keep prior readiness, message, job, stats, and history snapshots visible when diagnostics fail.',
    ],
    degradedBehavior: [
      'Allow history and job diagnostics to remain usable even when trend telemetry is incomplete.',
      'Retain current compose and preview state when provider telemetry is stale.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'One-tap email readiness refresh before large sends.',
      'CSV/TXT audience upload for bulk mailer ownership.',
      'Inline template render preview before queueing.',
      'Deliverability trend monitoring alongside compose flow.',
      'Direct handoff to Message Lanes and Script Designer for governed email template work.',
    ],
  },
  content: {
    moduleId: 'content',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SCRIPTS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.PERSONA],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.content.capability,
    requiredInputs: [
      'A selected call script before edit, review, promote, or simulate actions',
      'Script name, prompt, and first message before meaningful draft updates',
      'Review note before approval or rejection actions',
      'Simulation variables JSON before simulation when placeholders are present',
    ],
    validationSteps: [
      'Keep script lifecycle actions behind caller_flags_manage capability.',
      'Require a concrete selected script before lifecycle mutations.',
      'Preserve draft form state locally while review and simulation actions run.',
    ],
    confirmationRules: [
      'Draft save, review, and promote-live actions remain explicit operator actions.',
      'Simulation stays a bounded non-mutating verification path.',
    ],
    executionActions: [
      'callscript.list',
      'callscript.update',
      'callscript.submit_review',
      'callscript.review',
      'callscript.promote_live',
      'callscript.simulate',
      'persona.list',
      'callerflags.list',
      'callerflags.upsert',
    ],
    successBehavior: [
      'Keep the selected script, lifecycle state, and form inputs visible after lifecycle actions.',
      'Refresh supporting persona and caller-flag context without leaving the scripts workspace.',
    ],
    failureBehavior: [
      'Preserve in-progress draft edits, review notes, and simulation variables when an action fails.',
      'Show lifecycle-specific errors inline instead of clearing the current script context.',
    ],
    degradedBehavior: [
      'Allow direct script editing to continue even when persona or caller-flag support data is stale.',
      'Retain the latest selected-script context when one supporting lookup fails.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'Script drafting, review, simulation, and adjacent support data in one workspace.',
      'Direct lifecycle progression without losing the currently selected script context.',
      'In-page support context for persona and caller-flag checks around script changes.',
    ],
  },
  scriptsparity: {
    moduleId: 'scriptsparity',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SCRIPTS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.SMS, BOT_PRIMARY_COMMANDS.EMAIL],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.scriptsparity.capability,
    requiredInputs: [
      'Script name and content before SMS script creation',
      'Selected SMS script before SMS updates',
      'Template ID before email template create or update',
      'Subject plus HTML or text content before email template updates',
    ],
    validationSteps: [
      'Keep SMS script and email template actions behind caller_flags_manage capability.',
      'Require explicit selected assets before governance actions such as review, promote, simulate, diff, or rollback.',
      'Refresh both content lists after create, update, delete, review, promote, or rollback so the operator sees the authoritative result.',
    ],
    confirmationRules: [
      'Create, update, delete, review, promote, and rollback actions remain explicit operator-triggered mutations.',
      'List, version, diff, and simulation requests stay bounded read-only requests.',
    ],
    executionActions: [
      'smsscript.list',
      'smsscript.get',
      'smsscript.create',
      'smsscript.update',
      'smsscript.delete',
      'smsscript.submit_review',
      'smsscript.review',
      'smsscript.promote_live',
      'smsscript.simulate',
      'smsscript.versions',
      'smsscript.diff',
      'smsscript.rollback',
      'emailtemplate.list',
      'emailtemplate.get',
      'emailtemplate.create',
      'emailtemplate.update',
      'emailtemplate.delete',
      'emailtemplate.submit_review',
      'emailtemplate.review',
      'emailtemplate.promote_live',
      'emailtemplate.simulate',
      'emailtemplate.versions',
      'emailtemplate.diff',
      'emailtemplate.rollback',
    ],
    successBehavior: [
      'Refresh SMS script and email template lists while preserving the active workspace.',
      'Keep the currently selected script or template visible after successful updates, reviews, promotions, and rollback actions.',
    ],
    failureBehavior: [
      'Preserve draft content, governance notes, simulation variables, and selected assets when content updates fail.',
      'Show request-specific errors inline without clearing the opposing channel workspace.',
    ],
    degradedBehavior: [
      'Allow SMS and email workspaces to degrade independently when one content family is unavailable.',
      'Retain the most recent fetched list for one channel while the other channel refresh fails.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'One workspace for SMS and email content ownership.',
      'Parallel refresh and maintenance of adjacent content families.',
      'Selection-preserving updates that reduce operator context switching between channels.',
      'Lifecycle review, simulation, and version recovery without leaving the focused message lanes.',
    ],
  },
  messaging: {
    moduleId: 'messaging',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SMS,
    relatedCommands: [
      BOT_PRIMARY_COMMANDS.EMAIL,
      BOT_COMPAT_COMMANDS.SMSSTATUS,
      BOT_COMPAT_COMMANDS.SMSCONVERSATION,
      BOT_COMPAT_COMMANDS.RECENTSMS,
      BOT_COMPAT_COMMANDS.EMAILSTATUS,
    ],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.messaging.capability,
    requiredInputs: [
      'Message SID before SMS status lookup',
      'Phone number before SMS conversation lookup',
      'Message ID before email status lookup',
      'Job ID before email bulk job lookup',
    ],
    validationSteps: [
      'Allow SMS status checks for authorized users and require admin access for conversation, recent history, and stats diagnostics.',
      'Require email_bulk_manage capability for email diagnostic actions.',
      'Keep recent and history requests bounded to dashboard page sizes.',
    ],
    confirmationRules: [
      'Investigation actions remain read-only and do not mutate delivery state.',
    ],
    executionActions: [
      'sms.message.status',
      'sms.messages.conversation',
      'sms.messages.recent',
      'sms.stats',
      'email.message.status',
      'email.bulk.job',
      'email.bulk.history',
      'email.bulk.stats',
    ],
    successBehavior: [
      'Populate SMS and email artifacts side by side inside one investigation workspace.',
      'Keep filter counts and snapshot summaries visible after each successful lookup.',
    ],
    failureBehavior: [
      'Preserve existing SMS and email artifacts and show the failing investigation path inline.',
      'Keep operator-entered lookup identifiers intact after investigation errors.',
    ],
    degradedBehavior: [
      'Allow SMS and email diagnostics to degrade independently when one channel is unavailable.',
      'Continue bounded history reads even when one status endpoint is stale.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'Unified SMS and email diagnostics in one operator surface.',
      'Shared filter count and artifact summary across both channels.',
      'One investigation workspace for alias-derived status, history, and email batch health checks.',
    ],
  },
  persona: {
    moduleId: 'persona',
    canonicalCommand: BOT_PRIMARY_COMMANDS.PERSONA,
    relatedCommands: [BOT_PRIMARY_COMMANDS.SCRIPTS],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.persona.capability,
    requiredInputs: [
      'None to refresh and review the current persona registry.',
      'Custom persona authoring inputs still continue in the broader bot workflow.',
      'Linked script defaults and policy metadata are shown only when the current bridge payload provides them.',
    ],
    validationSteps: [
      'Keep persona visibility behind the same admin access used by the bot persona manager.',
      'Treat the miniapp as a registry review surface until create, edit, delete, and cache-refresh actions are explicitly bridged.',
      'Preserve the last successful persona snapshot when a refresh attempt fails.',
    ],
    confirmationRules: [
      'Refresh remains a safe read-only action.',
      'Persona mutations still require the broader bot workflow until dedicated miniapp actions are exposed.',
    ],
    executionActions: [
      'persona.list',
    ],
    successBehavior: [
      'Refresh built-in and custom persona visibility without leaving the current workspace.',
      'Keep persona policy context visible for nearby script and messaging work.',
    ],
    failureBehavior: [
      'Preserve the last successful persona snapshot and show the sync failure inline.',
      'Avoid implying that create, edit, or delete completed in the miniapp when those flows are not bridged here.',
    ],
    degradedBehavior: [
      'Allow operators to inspect the last visible persona registry when a live refresh fails.',
      'Keep persona policy visibility available even when adjacent script metadata is stale or missing.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'Built-in and custom persona visibility in one place.',
      'Shared review context for script designers and messaging operators.',
      'Refreshable registry view without leaving the admin dashboard.',
    ],
  },
  audit: {
    moduleId: 'audit',
    canonicalCommand: BOT_PRIMARY_COMMANDS.STATUS,
    relatedCommands: [BOT_PRIMARY_COMMANDS.HEALTH, BOT_PRIMARY_COMMANDS.ADMIN],
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS.audit.capability,
    requiredInputs: [
      'Optional incident and audit filters for narrowed views',
      'Saved query state for repeat investigations',
      'Runbook payloads when the selected playbook needs scope or channel context',
    ],
    validationSteps: [
      'Runbook actions must resolve through dashboard action guards before execution.',
      'Advanced tables and CSV export remain feature-flagged.',
      'Refresh paths preserve focus restoration and saved filter state.',
    ],
    confirmationRules: [
      'Runbook actions stay explicit admin-triggered operations.',
      'Filtering, saved queries, and CSV export remain read-only support tools.',
    ],
    executionActions: [
      'audit.feed',
      'incidents.summary',
      'runbook.sms.reconcile',
      'runbook.payment.reconcile',
      'runbook.provider.preflight',
    ],
    successBehavior: [
      'Refresh incident and audit feeds without dropping saved filters or view preferences.',
      'Return focus to the triggering control after refresh and runbook execution.',
    ],
    failureBehavior: [
      'Preserve current table state and surface unsupported or failed runbook actions inline.',
      'Keep saved query state intact when refresh or export-adjacent actions fail.',
    ],
    degradedBehavior: [
      'Continue local filtering and saved-query workflows when live refresh is unavailable.',
      'Allow operators to inspect the last known incident and audit feed while a refresh failure is active.',
    ],
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    productivityEnhancements: [
      'Saved queries for repeat incident triage.',
      'CSV export for incident and audit tables.',
      'Keyboard shortcuts and focus restoration for faster admin investigation.',
    ],
  },
};

type DashboardRouteScreenContract = {
  routeId: string;
  path: string;
  screenLabel: string;
  capability: string | null;
  linkedCommand: string | null;
  moduleId: DashboardModuleId | null;
  fallbackPath: string;
};

export const DASHBOARD_ROUTE_SCREEN_CONTRACTS: DashboardRouteScreenContract[] = [
  {
    routeId: 'dashboard.root',
    path: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    screenLabel: 'Dashboard Home',
    capability: null,
    linkedCommand: BOT_PRIMARY_COMMANDS.ADMIN,
    moduleId: null,
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
  },
  ...DASHBOARD_MODULE_IDS.map((moduleId) => ({
    routeId: `dashboard.module.${moduleId}`,
    path: DASHBOARD_MODULE_ROUTE_CONTRACTS[moduleId],
    screenLabel: DASHBOARD_MODULE_SCREEN_CONTRACTS[moduleId].label,
    capability: DASHBOARD_MODULE_SCREEN_CONTRACTS[moduleId].capability,
    linkedCommand: DASHBOARD_MODULE_COMMAND_CONTRACTS[moduleId],
    moduleId,
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
  })),
  {
    routeId: 'dashboard.settings',
    path: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
    screenLabel: 'Dashboard Settings',
    capability: 'dashboard_view',
    linkedCommand: BOT_PRIMARY_COMMANDS.ADMIN,
    moduleId: null,
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
  },
];

export type MiniAppCommandAccessLevel = 'guest' | 'authorized' | 'admin';
export type MiniAppCommandActionAvailability = 'aligned' | 'partial' | 'missing';

export type MiniAppCommandActionContract = {
  actionId: string;
  label: string;
  description: string;
  linkedCommand: string | null;
  routePath: string | null;
  minAccess: MiniAppCommandAccessLevel;
  availability: MiniAppCommandActionAvailability;
  notes: string;
};

export const MINIAPP_COMMAND_ACTION_CONTRACTS = {
  START: {
    actionId: 'START',
    label: 'Start',
    description: 'Open the role-aware home and workspace launcher.',
    linkedCommand: BOT_PRIMARY_COMMANDS.START,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.START,
    minAccess: 'guest',
    availability: 'aligned',
    notes: 'Role-aware entry point for launchers, access guidance, and next steps.',
  },
  CALL: {
    actionId: 'CALL',
    label: 'Call',
    description: 'Launch a voice session with the live call workflow.',
    linkedCommand: BOT_PRIMARY_COMMANDS.CALL,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.CALL,
    minAccess: 'authorized',
    availability: 'partial',
    notes: 'Supports custom and script-backed outbound calls with guided setup, launch review, and live call follow-up. Active calls restore on refresh for the same Telegram session.',
  },
  SMS: {
    actionId: 'SMS',
    label: 'SMS',
    description: 'Open the SMS center and messaging investigation workflow.',
    linkedCommand: BOT_PRIMARY_COMMANDS.SMS,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.SMS,
    minAccess: 'authorized',
    availability: 'partial',
    notes: 'Supports SMS send, scheduling, delivery checks, recent activity, and quick handoff to bulk sending when needed.',
  },
  EMAIL: {
    actionId: 'EMAIL',
    label: 'Email',
    description: 'Open email sending, history, and status workflows.',
    linkedCommand: BOT_PRIMARY_COMMANDS.EMAIL,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.EMAIL,
    minAccess: 'authorized',
    availability: 'partial',
    notes: 'Supports email send, scheduling, preview, status checks, history, and quick handoff to bulk email tools when needed.',
  },
  CALLLOG: {
    actionId: 'CALLLOG',
    label: 'Call Log',
    description: 'Browse recent calls, search, and inspect call events.',
    linkedCommand: BOT_PRIMARY_COMMANDS.CALLLOG,
    routePath: DASHBOARD_MODULE_ROUTE_CONTRACTS.calllog,
    minAccess: 'authorized',
    availability: 'aligned',
    notes: 'Search recent calls, inspect records, and review event history.',
  },
  GUIDE: {
    actionId: 'GUIDE',
    label: 'Guide',
    description: 'Review operating guidance, number formatting rules, and best practices.',
    linkedCommand: BOT_PRIMARY_COMMANDS.GUIDE,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
    minAccess: 'guest',
    availability: 'aligned',
    notes: 'Short operating guidance with role-aware next steps.',
  },
  HELP: {
    actionId: 'HELP',
    label: 'Help',
    description: 'Review workflow coverage, examples, and access posture.',
    linkedCommand: BOT_PRIMARY_COMMANDS.HELP,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
    minAccess: 'guest',
    availability: 'aligned',
    notes: 'Coverage, access guidance, and shortcuts for the current role.',
  },
  MENU: {
    actionId: 'MENU',
    label: 'Menu',
    description: 'Open the role-aware quick-actions menu.',
    linkedCommand: BOT_PRIMARY_COMMANDS.MENU,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU,
    minAccess: 'guest',
    availability: 'aligned',
    notes: 'Quick launcher for common operator workflows.',
  },
  HEALTH: {
    actionId: 'HEALTH',
    label: 'Health',
    description: 'Inspect runtime health posture and operator diagnostics.',
    linkedCommand: BOT_PRIMARY_COMMANDS.HEALTH,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.HEALTH,
    minAccess: 'authorized',
    availability: 'aligned',
    notes: 'Runtime health snapshot backed by the same server-authoritative diagnostics used across the app.',
  },
  STATUS: {
    actionId: 'STATUS',
    label: 'Status',
    description: 'Review deep status, incidents, and operational runtime posture.',
    linkedCommand: BOT_PRIMARY_COMMANDS.STATUS,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.STATUS,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Admin status overview for live operations, incidents, and runtime posture.',
  },
  USERS: {
    actionId: 'USERS',
    label: 'Users',
    description: 'Manage authorized users and role assignments.',
    linkedCommand: BOT_PRIMARY_COMMANDS.USERS,
    routePath: DASHBOARD_MODULE_ROUTE_CONTRACTS.users,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Manage authorized users and role assignments.',
  },
  CALLER_FLAGS: {
    actionId: 'CALLER_FLAGS',
    label: 'Caller Flags',
    description: 'Review and update caller flags moderation rules.',
    linkedCommand: BOT_PRIMARY_COMMANDS.CALLERFLAGS,
    routePath: DASHBOARD_MODULE_ROUTE_CONTRACTS.callerflags,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Review and update caller flag moderation rules.',
  },
  PROVIDER_STATUS: {
    actionId: 'PROVIDER_STATUS',
    label: 'Provider',
    description: 'Inspect provider readiness and apply voice provider changes.',
    linkedCommand: BOT_PRIMARY_COMMANDS.PROVIDER,
    routePath: DASHBOARD_MODULE_ROUTE_CONTRACTS.provider,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Inspect provider readiness and apply supported provider changes.',
  },
  SCRIPTS: {
    actionId: 'SCRIPTS',
    label: 'Scripts',
    description: 'Manage reusable prompts, scripts, and templates.',
    linkedCommand: BOT_PRIMARY_COMMANDS.SCRIPTS,
    routePath: MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS,
    minAccess: 'admin',
    availability: 'partial',
    notes: 'Entry point for scripts, templates, and linked content workspaces.',
  },
  BULK_SMS: {
    actionId: 'BULK_SMS',
    label: 'SMS Sender',
    description: 'Run bulk SMS sender and scheduling workflows.',
    linkedCommand: BOT_PRIMARY_COMMANDS.SMSSENDER,
    routePath: DASHBOARD_MODULE_ROUTE_CONTRACTS.sms,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Bulk SMS workspace for high-volume delivery operations.',
  },
  BULK_EMAIL: {
    actionId: 'BULK_EMAIL',
    label: 'Mailer',
    description: 'Run bulk email readiness, send, status, history, and stats workflows.',
    linkedCommand: BOT_PRIMARY_COMMANDS.MAILER,
    routePath: DASHBOARD_MODULE_ROUTE_CONTRACTS.mailer,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Admin bulk email workspace for readiness checks, queued sends, and delivery monitoring.',
  },
  ADMIN_PANEL: {
    actionId: 'ADMIN_PANEL',
    label: 'Admin Console',
    description: 'Open the Mini App admin console shell.',
    linkedCommand: BOT_PRIMARY_COMMANDS.ADMIN,
    routePath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    minAccess: 'admin',
    availability: 'aligned',
    notes: 'Admin home for navigation, status, and workspace launch.',
  },
} as const satisfies Record<string, MiniAppCommandActionContract>;

export type MiniAppCommandActionId = keyof typeof MINIAPP_COMMAND_ACTION_CONTRACTS;

export type MiniAppCommandPageContract = {
  pageId: string;
  path: string;
  pageComponent: string;
  canonicalCommand: string;
  workflowStatus: DashboardWorkflowStatus;
  fallbackPath: string;
  summary: string;
  actionIds: readonly MiniAppCommandActionId[];
  notes: string;
};

export const MINIAPP_COMMAND_PAGE_CONTRACTS = {
  START: {
    pageId: 'command.start',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.START,
    pageComponent: 'StartCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.START,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Welcome operators, explain access, and launch the right workspace.',
    actionIds: ['START', 'CALL', 'SMS', 'EMAIL', 'CALLLOG', 'GUIDE', 'HELP', 'MENU', 'HEALTH', 'STATUS', 'USERS', 'CALLER_FLAGS', 'SCRIPTS', 'PROVIDER_STATUS', 'BULK_SMS', 'BULK_EMAIL', 'ADMIN_PANEL'],
    notes: 'Guest sessions stay read-only and are routed to guidance instead of protected tools.',
  },
  CALL: {
    pageId: 'command.call',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.CALL,
    pageComponent: 'CallCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.CALL,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Set up and launch outbound calls with live follow-up in the same workspace.',
    actionIds: ['CALLLOG', 'HELP', 'GUIDE', 'MENU', 'START'],
    notes: 'Supports custom prompts and script-backed calls, resolves placeholders before launch, restores the latest active call for the current Telegram session, and keeps live call details visible while the call is running.',
  },
  SMS: {
    pageId: 'command.sms',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.SMS,
    pageComponent: 'SmsCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SMS,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Send, schedule, and investigate SMS work from one focused workspace.',
    actionIds: ['SMS', 'BULK_SMS', 'CALLLOG', 'HELP', 'GUIDE', 'MENU', 'PROVIDER_STATUS'],
    notes: 'Keeps single-recipient delivery work in-app, surfaces provider readiness before launch, and hands off high-volume sending to SMS Sender.',
  },
  HELP: {
    pageId: 'command.help',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
    pageComponent: 'HelpCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.HELP,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Explain available tools and route operators to the right workspace.',
    actionIds: ['START', 'CALL', 'SMS', 'EMAIL', 'MENU', 'GUIDE', 'HELP', 'USERS', 'CALLER_FLAGS', 'PROVIDER_STATUS', 'ADMIN_PANEL'],
    notes: 'Keeps guidance short, role-aware, and action-oriented.',
  },
  EMAIL: {
    pageId: 'command.email',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.EMAIL,
    pageComponent: 'EmailCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.EMAIL,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Send, schedule, preview, and investigate email work from one focused workspace.',
    actionIds: ['EMAIL', 'BULK_EMAIL', 'HELP', 'GUIDE', 'MENU', 'PROVIDER_STATUS'],
    notes: 'Keeps single-recipient delivery work in-app, surfaces template and history tools nearby, and hands off high-volume sending to Mailer.',
  },
  SCRIPTS: {
    pageId: 'command.scripts',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS,
    pageComponent: 'ScriptsCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.SCRIPTS,
    workflowStatus: 'partial',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Start script work here, then move into the dedicated editing workspaces.',
    actionIds: ['SCRIPTS', 'MENU', 'HELP', 'START', 'CALLER_FLAGS', 'PROVIDER_STATUS', 'ADMIN_PANEL'],
    notes: 'Keeps call scripts, SMS scripts, and email templates organized through focused downstream workspaces.',
  },
  MENU: {
    pageId: 'command.menu',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU,
    pageComponent: 'MenuCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.MENU,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Quick launcher for the most useful operator workflows.',
    actionIds: ['START', 'CALL', 'SMS', 'EMAIL', 'CALLLOG', 'GUIDE', 'HELP', 'HEALTH', 'STATUS', 'USERS', 'SCRIPTS', 'CALLER_FLAGS', 'PROVIDER_STATUS', 'BULK_SMS', 'BULK_EMAIL', 'ADMIN_PANEL'],
    notes: 'Shows available actions for the current role and routes directly into supported workspaces.',
  },
  GUIDE: {
    pageId: 'command.guide',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
    pageComponent: 'GuideCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.GUIDE,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Short operating guide with the next best actions for the current role.',
    actionIds: ['START', 'HELP', 'MENU', 'CALL', 'SMS', 'EMAIL'],
    notes: 'Keeps setup and operating guidance concise, then points to the right next action.',
  },
  HEALTH: {
    pageId: 'command.health',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.HEALTH,
    pageComponent: 'HealthCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.HEALTH,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Live runtime health and system posture for authorized operators.',
    actionIds: ['START', 'MENU', 'HELP', 'GUIDE', 'STATUS'],
    notes: 'Keeps degraded states visible and grounded in the same server-authoritative runtime data used elsewhere in the app.',
  },
  STATUS: {
    pageId: 'command.status',
    path: MINIAPP_COMMAND_ROUTE_CONTRACTS.STATUS,
    pageComponent: 'StatusCommandPage',
    canonicalCommand: BOT_PRIMARY_COMMANDS.STATUS,
    workflowStatus: 'aligned',
    fallbackPath: DASHBOARD_STATIC_ROUTE_CONTRACTS.ROOT,
    summary: 'Admin status overview for live operations, incidents, and runtime posture.',
    actionIds: ['START', 'HEALTH', 'PROVIDER_STATUS', 'ADMIN_PANEL', 'MENU'],
    notes: 'Reuses the same live status, health, and runtime data that powers the rest of the console.',
  },
} as const satisfies Record<'START' | 'CALL' | 'SMS' | 'HELP' | 'EMAIL' | 'SCRIPTS' | 'MENU' | 'GUIDE' | 'HEALTH' | 'STATUS', MiniAppCommandPageContract>;

export const DASHBOARD_ACTION_CONTRACTS = {
  RUNTIME_STATUS: 'runtime.status',
  RUNTIME_MAINTENANCE_ENABLE: 'runtime.maintenance.enable',
  RUNTIME_MAINTENANCE_DISABLE: 'runtime.maintenance.disable',
  RUNTIME_CANARY_SET: 'runtime.canary.set',
  RUNTIME_CANARY_CLEAR: 'runtime.canary.clear',
  SMS_BULK_SEND: 'sms.bulk.send',
  SMS_BULK_STATUS: 'sms.bulk.status',
  SMS_SCHEDULE_SEND: 'sms.schedule.send',
  EMAIL_BULK_SEND: 'email.bulk.send',
  EMAIL_PREVIEW: 'email.preview',
  PROVIDER_GET: 'provider.get',
  PROVIDER_PREFLIGHT: 'provider.preflight',
  PROVIDER_SET: 'provider.set',
  PROVIDER_ROLLBACK: 'provider.rollback',
  CALLSCRIPT_LIST: 'callscript.list',
  CALLSCRIPT_UPDATE: 'callscript.update',
  CALLSCRIPT_SUBMIT_REVIEW: 'callscript.submit_review',
  CALLSCRIPT_REVIEW: 'callscript.review',
  CALLSCRIPT_PROMOTE_LIVE: 'callscript.promote_live',
  CALLSCRIPT_SIMULATE: 'callscript.simulate',
  DLQ_CALL_REPLAY: 'dlq.call.replay',
  DLQ_EMAIL_REPLAY: 'dlq.email.replay',
  CALLS_LIST: 'calls.list',
  CALLS_SEARCH: 'calls.search',
  CALLS_GET: 'calls.get',
  CALLS_EVENTS: 'calls.events',
  CALLERFLAGS_LIST: 'callerflags.list',
  CALLERFLAGS_UPSERT: 'callerflags.upsert',
  SMSSCRIPT_LIST: 'smsscript.list',
  SMSSCRIPT_GET: 'smsscript.get',
  SMSSCRIPT_CREATE: 'smsscript.create',
  SMSSCRIPT_UPDATE: 'smsscript.update',
  SMSSCRIPT_DELETE: 'smsscript.delete',
  SMSSCRIPT_SUBMIT_REVIEW: 'smsscript.submit_review',
  SMSSCRIPT_REVIEW: 'smsscript.review',
  SMSSCRIPT_PROMOTE_LIVE: 'smsscript.promote_live',
  SMSSCRIPT_SIMULATE: 'smsscript.simulate',
  SMSSCRIPT_VERSIONS: 'smsscript.versions',
  SMSSCRIPT_DIFF: 'smsscript.diff',
  SMSSCRIPT_ROLLBACK: 'smsscript.rollback',
  EMAILTEMPLATE_LIST: 'emailtemplate.list',
  EMAILTEMPLATE_GET: 'emailtemplate.get',
  EMAILTEMPLATE_CREATE: 'emailtemplate.create',
  EMAILTEMPLATE_UPDATE: 'emailtemplate.update',
  EMAILTEMPLATE_DELETE: 'emailtemplate.delete',
  EMAILTEMPLATE_SUBMIT_REVIEW: 'emailtemplate.submit_review',
  EMAILTEMPLATE_REVIEW: 'emailtemplate.review',
  EMAILTEMPLATE_PROMOTE_LIVE: 'emailtemplate.promote_live',
  EMAILTEMPLATE_SIMULATE: 'emailtemplate.simulate',
  EMAILTEMPLATE_VERSIONS: 'emailtemplate.versions',
  EMAILTEMPLATE_DIFF: 'emailtemplate.diff',
  EMAILTEMPLATE_ROLLBACK: 'emailtemplate.rollback',
  SMS_MESSAGES_RECENT: 'sms.messages.recent',
  SMS_MESSAGES_CONVERSATION: 'sms.messages.conversation',
  SMS_MESSAGE_STATUS: 'sms.message.status',
  SMS_STATS: 'sms.stats',
  EMAIL_MESSAGE_STATUS: 'email.message.status',
  EMAIL_BULK_STATS: 'email.bulk.stats',
  PERSONA_LIST: 'persona.list',
  USERS_LIST: 'users.list',
  USERS_ROLE_SET: 'users.role.set',
  AUDIT_FEED: 'audit.feed',
  INCIDENTS_SUMMARY: 'incidents.summary',
  EMAIL_BULK_JOB: 'email.bulk.job',
  EMAIL_BULK_HISTORY: 'email.bulk.history',
  RUNBOOK_SMS_RECONCILE: 'runbook.sms.reconcile',
  RUNBOOK_PAYMENT_RECONCILE: 'runbook.payment.reconcile',
  RUNBOOK_PROVIDER_PREFLIGHT: 'runbook.provider.preflight',
} as const;

export const BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS: Record<string, string> = {
  SMS_SEND: DASHBOARD_ACTION_CONTRACTS.SMS_BULK_SEND,
  SMS_SCHEDULE: DASHBOARD_ACTION_CONTRACTS.SMS_SCHEDULE_SEND,
  SMS_STATUS: DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGE_STATUS,
  SMS_CONVO: DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_CONVERSATION,
  SMS_RECENT: DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_RECENT,
  SMS_RECENT_PAGE: DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_RECENT,
  SMS_STATS: DASHBOARD_ACTION_CONTRACTS.SMS_STATS,
  EMAIL_SEND: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_SEND,
  EMAIL_STATUS: DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS,
  EMAIL_TIMELINE: DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS,
  EMAIL_TEMPLATES: DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_LIST,
  EMAIL_HISTORY: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
  EMAIL_BULK: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB,
  BULK_SMS_PRECHECK: DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
  BULK_SMS_LIST: DASHBOARD_ACTION_CONTRACTS.SMS_BULK_STATUS,
  BULK_SMS_PAGE: DASHBOARD_ACTION_CONTRACTS.SMS_BULK_STATUS,
  BULK_EMAIL_LIST: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
  BULK_EMAIL_PAGE: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
  BULK_EMAIL_STATS: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_STATS,
  BULK_EMAIL_PRECHECK: DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
  BULK_SMS_SEND: DASHBOARD_ACTION_CONTRACTS.SMS_BULK_SEND,
  BULK_SMS_STATUS: DASHBOARD_ACTION_CONTRACTS.SMS_BULK_STATUS,
  BULK_SMS_STATS: DASHBOARD_ACTION_CONTRACTS.SMS_BULK_STATUS,
  BULK_EMAIL_SEND: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_SEND,
  BULK_EMAIL_STATUS: DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB,
  CALLLOG_RECENT: DASHBOARD_ACTION_CONTRACTS.CALLS_LIST,
  CALLLOG_SEARCH: DASHBOARD_ACTION_CONTRACTS.CALLS_SEARCH,
  CALLLOG_DETAILS: DASHBOARD_ACTION_CONTRACTS.CALLS_GET,
  CALLLOG_EVENTS: DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS,
  CALL_DETAILS: DASHBOARD_ACTION_CONTRACTS.CALLS_GET,
  USERS_LIST: DASHBOARD_ACTION_CONTRACTS.USERS_LIST,
  CALLER_FLAGS_LIST: DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_LIST,
} as const;

const BOT_CALLBACK_ACTION_ALIAS_CONTRACTS: Record<string, string> = Object.fromEntries(
  Object.entries(BOT_CALLBACK_TO_DASHBOARD_ACTION_CONTRACTS).map(([callbackAction, actionId]) => [
    callbackAction.toLowerCase(),
    actionId,
  ]),
);

export const DASHBOARD_ACTION_ALIAS_CONTRACTS: Record<string, string> = {
  'sms.reconcile': DASHBOARD_ACTION_CONTRACTS.RUNBOOK_SMS_RECONCILE,
  'payment.reconcile': DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PAYMENT_RECONCILE,
  'provider.preflight.runbook': DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT,
  'runbook.sms_reconcile': DASHBOARD_ACTION_CONTRACTS.RUNBOOK_SMS_RECONCILE,
  'runbook.payment_reconcile': DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PAYMENT_RECONCILE,
  'runbook.provider_preflight': DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT,
  ...BOT_CALLBACK_ACTION_ALIAS_CONTRACTS,
};

export const DASHBOARD_MODULE_ACTION_CONTRACTS = {
  ops: [
    DASHBOARD_ACTION_CONTRACTS.RUNTIME_STATUS,
    DASHBOARD_ACTION_CONTRACTS.CALLS_LIST,
    DASHBOARD_ACTION_CONTRACTS.CALLS_SEARCH,
    DASHBOARD_ACTION_CONTRACTS.CALLS_GET,
    DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS,
    DASHBOARD_ACTION_CONTRACTS.DLQ_CALL_REPLAY,
    DASHBOARD_ACTION_CONTRACTS.DLQ_EMAIL_REPLAY,
  ],
  sms: [
    DASHBOARD_ACTION_CONTRACTS.SMS_BULK_SEND,
    DASHBOARD_ACTION_CONTRACTS.SMS_BULK_STATUS,
    DASHBOARD_ACTION_CONTRACTS.SMS_SCHEDULE_SEND,
  ],
  mailer: [
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_SEND,
    DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_STATS,
  ],
  provider: [
    DASHBOARD_ACTION_CONTRACTS.PROVIDER_GET,
    DASHBOARD_ACTION_CONTRACTS.PROVIDER_PREFLIGHT,
    DASHBOARD_ACTION_CONTRACTS.PROVIDER_SET,
    DASHBOARD_ACTION_CONTRACTS.PROVIDER_ROLLBACK,
  ],
  content: [
    DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_LIST,
    DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_UPDATE,
    DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_SUBMIT_REVIEW,
    DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_REVIEW,
    DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_PROMOTE_LIVE,
    DASHBOARD_ACTION_CONTRACTS.CALLSCRIPT_SIMULATE,
  ],
  calllog: [
    DASHBOARD_ACTION_CONTRACTS.CALLS_LIST,
    DASHBOARD_ACTION_CONTRACTS.CALLS_SEARCH,
    DASHBOARD_ACTION_CONTRACTS.CALLS_GET,
    DASHBOARD_ACTION_CONTRACTS.CALLS_EVENTS,
  ],
  callerflags: [DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_LIST, DASHBOARD_ACTION_CONTRACTS.CALLERFLAGS_UPSERT],
  scriptsparity: [
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_LIST,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_GET,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_CREATE,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_UPDATE,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_DELETE,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_SUBMIT_REVIEW,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_REVIEW,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_PROMOTE_LIVE,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_SIMULATE,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_VERSIONS,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_DIFF,
    DASHBOARD_ACTION_CONTRACTS.SMSSCRIPT_ROLLBACK,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_LIST,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_GET,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_CREATE,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_UPDATE,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_DELETE,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_SUBMIT_REVIEW,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_REVIEW,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_PROMOTE_LIVE,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_SIMULATE,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_VERSIONS,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_DIFF,
    DASHBOARD_ACTION_CONTRACTS.EMAILTEMPLATE_ROLLBACK,
  ],
  messaging: [
    DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_RECENT,
    DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGES_CONVERSATION,
    DASHBOARD_ACTION_CONTRACTS.SMS_MESSAGE_STATUS,
    DASHBOARD_ACTION_CONTRACTS.SMS_STATS,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_MESSAGE_STATUS,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_JOB,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_HISTORY,
    DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_STATS,
  ],
  persona: [DASHBOARD_ACTION_CONTRACTS.PERSONA_LIST],
  users: [DASHBOARD_ACTION_CONTRACTS.USERS_LIST, DASHBOARD_ACTION_CONTRACTS.USERS_ROLE_SET],
  audit: [
    DASHBOARD_ACTION_CONTRACTS.AUDIT_FEED,
    DASHBOARD_ACTION_CONTRACTS.INCIDENTS_SUMMARY,
    DASHBOARD_ACTION_CONTRACTS.RUNBOOK_SMS_RECONCILE,
    DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PAYMENT_RECONCILE,
    DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT,
  ],
} as const;

export const DASHBOARD_MODULE_ACTION_IDS = Array.from(new Set(
  Object.values(DASHBOARD_MODULE_ACTION_CONTRACTS).flat(),
));
