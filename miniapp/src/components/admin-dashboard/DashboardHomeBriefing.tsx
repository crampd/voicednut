import { Link } from '@/components/Link/Link.tsx';
import { UiSurfaceState, UiWorkspacePulse } from '@/components/ui/AdminPrimitives';
import {
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  type DashboardModuleId,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
} from '@/contracts/miniappParityContracts';
import type { DashboardWorkspaceLauncherGroup } from '@/components/admin-dashboard/DashboardWorkspaceLauncher';
import type {
  ActivityEntry,
  CallLogRow,
  EmailJob,
  IncidentRow,
} from '@/pages/AdminDashboard/types';
import { moduleGlyph, moduleRoutePath, MODULE_CONTEXT } from '@/pages/AdminDashboard/dashboardShellConfig';
import { formatTime, toInt, toText } from '@/services/admin-dashboard/dashboardPrimitives';

type DashboardHomeBriefingProps = {
  sessionRole: string;
  visibleModulesCount: number;
  groupedVisibleModules: DashboardWorkspaceLauncherGroup[];
  activityLog: ActivityEntry[];
  callLogs: CallLogRow[];
  emailJobs: EmailJob[];
  incidentRows: IncidentRow[];
  openIncidentCount: number;
  queueBacklogTotal: number;
  lastSuccessfulPollLabel: string;
};

type HomeActionCopy = {
  title: string;
  description: string;
};

type HomeActionLink = HomeActionCopy & {
  id: string;
  to: string;
  actionLabel?: string;
  moduleId?: DashboardModuleId;
};

type ContinueItem = {
  id: string;
  title: string;
  detail: string;
  value: string;
  to: string;
};

type RoleKey = 'admin' | 'operator' | 'viewer';

const ROLE_COPY: Record<string, { title: string; description: string; status: string }> = {
  admin: {
    title: 'Admin console healthy',
    description: 'Keep operations, delivery tooling, and incident response within one Telegram-native home.',
    status: 'Full access',
  },
  operator: {
    title: 'Ready for work',
    description: 'Start the next task directly from home and keep runtime posture within easy reach.',
    status: 'Authorized access',
  },
  viewer: {
    title: 'Limited access',
    description: 'You can review workflows now. Execution unlocks after approval.',
    status: 'Limited access',
  },
};

const HOME_ACTION_COPY: Partial<Record<DashboardModuleId, HomeActionCopy>> = {
  ops: {
    title: 'Operations',
    description: 'Check health, incidents, and runtime posture.',
  },
  sms: {
    title: 'Bulk SMS',
    description: 'Prepare recipient batches, schedule sends, and watch delivery failures.',
  },
  mailer: {
    title: 'Mailer',
    description: 'Launch email campaigns and review delivery health.',
  },
  provider: {
    title: 'Provider control',
    description: 'Review readiness, switch providers, and protect rollback safety.',
  },
  calllog: {
    title: 'Call history',
    description: 'Search recent calls and inspect record timelines.',
  },
  messaging: {
    title: 'Delivery checks',
    description: 'Investigate SMS and email issues from one diagnostics workspace.',
  },
  content: {
    title: 'Script Designer',
    description: 'Switch between call, SMS, and email script editing from one workspace.',
  },
  scriptsparity: {
    title: 'Message lanes',
    description: 'Open a narrower SMS and email editor without leaving the scripts model.',
  },
  callerflags: {
    title: 'Caller flags',
    description: 'Moderate inbound caller policies and exceptions.',
  },
  persona: {
    title: 'Persona manager',
    description: 'Manage built-in and custom personas safely.',
  },
  users: {
    title: 'Users and roles',
    description: 'Handle access, roles, and operator visibility.',
  },
  audit: {
    title: 'Audit and incidents',
    description: 'Review alerts, runbooks, and the immutable activity trail.',
  },
};

const HOME_ACTION_PRIORITY: Record<string, DashboardModuleId[]> = {
  admin: ['ops', 'sms', 'mailer', 'provider', 'users', 'audit'],
  operator: ['ops', 'messaging', 'calllog', 'sms', 'mailer'],
  viewer: ['ops', 'calllog', 'messaging', 'audit'],
};

const PRIMARY_ACTIONS_BY_ROLE: Record<RoleKey, HomeActionLink[]> = {
  admin: [
    {
      id: 'ops',
      title: 'Operations',
      description: 'Check incidents, queue posture, and live runtime health.',
      to: moduleRoutePath('ops'),
      moduleId: 'ops',
    },
    {
      id: 'sms',
      title: 'Bulk SMS',
      description: 'Launch recipient batches and track delivery issues.',
      to: moduleRoutePath('sms'),
      moduleId: 'sms',
    },
    {
      id: 'mailer',
      title: 'Mailer',
      description: 'Run email sends and watch recent delivery status.',
      to: moduleRoutePath('mailer'),
      moduleId: 'mailer',
    },
    {
      id: 'provider',
      title: 'Provider Control',
      description: 'Review provider readiness and safe switch controls.',
      to: moduleRoutePath('provider'),
      moduleId: 'provider',
    },
    {
      id: 'status',
      title: 'Incident Status',
      description: 'Open the deeper status route for admin incident follow-up.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.STATUS,
    },
  ],
  operator: [
    {
      id: 'call',
      title: 'New Call',
      description: 'Launch the main call workflow without leaving the app home.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.CALL,
    },
    {
      id: 'messaging',
      title: 'Messaging',
      description: 'Open messaging workflows and delivery checks from one entry point.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.SMS,
    },
    {
      id: 'calllog',
      title: 'Call History',
      description: 'Review recent call lookups and active follow-up timelines.',
      to: moduleRoutePath('calllog'),
      moduleId: 'calllog',
    },
    {
      id: 'health',
      title: 'System Health',
      description: 'Inspect live health posture before starting the next task.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.HEALTH,
    },
  ],
  viewer: [
    {
      id: 'explore-call',
      title: 'Explore Call Flow',
      description: 'Review the call workflow now. Execution unlocks after approval.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.CALL,
      actionLabel: 'Review',
    },
    {
      id: 'explore-messaging',
      title: 'Explore Messaging',
      description: 'See how messaging works before access is granted.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.SMS,
      actionLabel: 'Review',
    },
    {
      id: 'calllog',
      title: 'View Call History',
      description: 'Browse recent call history and role-safe follow-up context.',
      to: moduleRoutePath('calllog'),
      actionLabel: 'Review',
      moduleId: 'calllog',
    },
  ],
};

const ADMIN_STRIP_ACTIONS: HomeActionLink[] = [
  {
    id: 'admin-strip-sms',
    title: 'Bulk SMS',
    description: 'High-volume delivery and queued recipient batches.',
    to: moduleRoutePath('sms'),
    moduleId: 'sms',
  },
  {
    id: 'admin-strip-mailer',
    title: 'Mailer',
    description: 'Bulk email sends, delivery follow-up, and recent jobs.',
    to: moduleRoutePath('mailer'),
    moduleId: 'mailer',
  },
  {
    id: 'admin-strip-users',
    title: 'Users & Roles',
    description: 'Access changes, role assignments, and operator visibility.',
    to: moduleRoutePath('users'),
    moduleId: 'users',
  },
  {
    id: 'admin-strip-callerflags',
    title: 'Caller Flags',
    description: 'Inbound caller moderation rules and exceptions.',
    to: moduleRoutePath('callerflags'),
    moduleId: 'callerflags',
  },
  {
    id: 'admin-strip-scripts',
    title: 'Scripts',
    description: 'Open script and template workflows from the dedicated workspace.',
    to: MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS,
  },
  {
    id: 'admin-strip-provider',
    title: 'Provider Control',
    description: 'Provider readiness, switching, and rollback safety.',
    to: moduleRoutePath('provider'),
    moduleId: 'provider',
  },
  {
    id: 'admin-strip-status',
    title: 'Incident Status',
    description: 'Deep runtime status and incident posture for admins.',
    to: MINIAPP_COMMAND_ROUTE_CONTRACTS.STATUS,
  },
];

function uniqueModuleOrder(
  preferred: DashboardModuleId[],
  visibleIds: DashboardModuleId[],
): DashboardModuleId[] {
  const visibleSet = new Set(visibleIds);
  const ordered = preferred
    .filter((moduleId) => visibleSet.has(moduleId))
    .concat(visibleIds.filter((moduleId) => !preferred.includes(moduleId)));
  return Array.from(new Set(ordered));
}

function homeActionGlyph(actionId: string): string {
  switch (actionId) {
    case 'call':
    case 'explore-call':
      return '◌';
    case 'health':
    case 'status':
      return '◉';
    default:
      return moduleGlyph(actionId);
  }
}

function buildContinueItems(
  activityLog: ActivityEntry[],
  callLogs: CallLogRow[],
  emailJobs: EmailJob[],
  incidentRows: IncidentRow[],
  openIncidentCount: number,
): ContinueItem[] {
  const items: ContinueItem[] = [];
  const leadIncident = incidentRows[0];
  if (openIncidentCount > 0 || leadIncident) {
    const serviceName = toText(leadIncident?.service_name, 'Operations incident');
    const status = toText(leadIncident?.status, openIncidentCount > 0 ? 'Open' : 'Active');
    const detail = toText(leadIncident?.details, `${serviceName} needs follow-up.`);
    items.push({
      id: 'incident',
      title: openIncidentCount > 1 ? `${openIncidentCount} incidents need attention` : serviceName,
      detail,
      value: status,
      to: moduleRoutePath(openIncidentCount > 0 ? 'audit' : 'ops'),
    });
  }

  const recentActivity = activityLog[0];
  if (recentActivity) {
    items.push({
      id: 'activity',
      title: recentActivity.title,
      detail: recentActivity.detail,
      value: formatTime(recentActivity.at),
      to: moduleRoutePath('ops'),
    });
  }

  const recentEmailJob = emailJobs[0];
  if (recentEmailJob) {
    const sent = toInt(recentEmailJob.sent);
    const total = toInt(recentEmailJob.total);
    const failed = toInt(recentEmailJob.failed);
    items.push({
      id: 'mailer',
      title: 'Recent mailer job',
      detail: `${toText(recentEmailJob.status, 'Queued')} • ${sent}/${total || sent} sent • ${failed} failed`,
      value: formatTime(recentEmailJob.updated_at || recentEmailJob.created_at),
      to: moduleRoutePath('mailer'),
    });
  }

  const recentCall = callLogs[0];
  if (recentCall) {
    const phone = toText(recentCall.phone_number, 'Recent call');
    const status = toText(
      recentCall.status_normalized || recentCall.status,
      toText(recentCall.ended_reason, 'Updated'),
    );
    items.push({
      id: 'calllog',
      title: 'Recent call follow-up',
      detail: `${phone} • ${status}`,
      value: formatTime(recentCall.updated_at || recentCall.created_at),
      to: moduleRoutePath('calllog'),
    });
  }

  return items.slice(0, 3);
}

export function DashboardHomeBriefing({
  sessionRole,
  visibleModulesCount,
  groupedVisibleModules,
  activityLog,
  callLogs,
  emailJobs,
  incidentRows,
  openIncidentCount,
  queueBacklogTotal,
  lastSuccessfulPollLabel,
}: DashboardHomeBriefingProps) {
  const roleKey: RoleKey = Object.prototype.hasOwnProperty.call(ROLE_COPY, sessionRole)
    ? (sessionRole as RoleKey)
    : 'viewer';
  const roleCopy = ROLE_COPY[roleKey];
  const visibleModules = groupedVisibleModules.flatMap((group) => group.modules);
  const visibleModuleIds = visibleModules.map((module) => module.id);
  const visibleModuleIdSet = new Set<DashboardModuleId>(visibleModuleIds);
  const prioritizedModuleIds = uniqueModuleOrder(
    HOME_ACTION_PRIORITY[roleKey] || HOME_ACTION_PRIORITY.viewer,
    visibleModuleIds,
  );
  const primaryActions = PRIMARY_ACTIONS_BY_ROLE[roleKey]
    .filter((action) => roleKey !== 'admin' || !action.moduleId || visibleModuleIdSet.has(action.moduleId))
    .slice(0, roleKey === 'viewer' ? 3 : 4);
  const fallbackPrimaryActions = prioritizedModuleIds
    .map((moduleId) => visibleModules.find((module) => module.id === moduleId))
    .filter((module): module is (typeof visibleModules)[number] => module != null)
    .map((module) => ({
      id: module.id,
      to: moduleRoutePath(module.id),
      actionLabel: 'Open',
      moduleId: module.id,
      title: HOME_ACTION_COPY[module.id]?.title || module.label,
      description: HOME_ACTION_COPY[module.id]?.description || MODULE_CONTEXT[module.id].detail,
    }));
  const resolvedPrimaryActions = (primaryActions.length > 0 ? primaryActions : fallbackPrimaryActions)
    .slice(0, roleKey === 'viewer' ? 3 : 4);
  const adminStripActions = roleKey === 'admin'
    ? ADMIN_STRIP_ACTIONS.filter((action) => !action.moduleId || visibleModuleIdSet.has(action.moduleId))
    : [];
  const continueItems = buildContinueItems(
    activityLog,
    callLogs,
    emailJobs,
    incidentRows,
    openIncidentCount,
  );
  const homeTone: 'warning' | 'success' = openIncidentCount > 0 ? 'warning' : 'success';

  return (
    <section className="va-section-block va-home-briefing" aria-labelledby="va-home-briefing-title">
      <UiWorkspacePulse
        title={roleCopy.title}
        description={roleCopy.description}
        status={roleCopy.status}
        tone={homeTone}
        items={[
          { label: 'Role', value: sessionRole },
          { label: 'Ready areas', value: visibleModulesCount },
          { label: 'Open incidents', value: openIncidentCount },
          { label: 'Queue backlog', value: queueBacklogTotal },
        ]}
      />

      <div className="va-grid va-home-grid">
        <UiSurfaceState
          className="va-home-panel"
          eyebrow="Start here"
          status="Workspace ready"
          statusVariant="info"
          tone="info"
          title="Primary actions"
          description={`This home follows the bot's start posture, but keeps launch actions in standard app navigation. Last healthy sync: ${lastSuccessfulPollLabel}.`}
        />
        {resolvedPrimaryActions.length > 0 ? (
          <div className="va-home-action-grid" aria-labelledby="va-home-briefing-title">
            <h2 id="va-home-briefing-title" className="va-sr-only">Homepage actions</h2>
            {resolvedPrimaryActions.map((action) => (
              <Link
                key={`home-action-${action.id}`}
                className="va-home-action-card"
                to={action.to}
              >
                <span className="va-home-action-glyph" aria-hidden>{homeActionGlyph(action.id)}</span>
                <span className="va-home-action-copy">
                  <span className="va-home-action-head">
                    <span className="va-home-action-kicker">
                      {action.moduleId ? 'Workspace' : 'Workflow'}
                    </span>
                    <span className="va-shortcut-action">{action.actionLabel || 'Open'}</span>
                  </span>
                  <strong>{action.title}</strong>
                  <span>{action.description}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="va-home-empty-panel">
            <p className="va-muted">
              {roleKey === 'viewer'
                ? 'You can review workflows now. Execution unlocks after approval.'
                : 'Areas will appear here as soon as access is granted to this session.'}
            </p>
          </div>
        )}

        <UiSurfaceState
          className="va-home-panel"
          eyebrow="Continue"
          status={continueItems.length > 0 ? `${continueItems.length} items` : 'No pending work'}
          statusVariant={continueItems.length > 0 ? 'success' : 'meta'}
          tone={continueItems.length > 0 ? 'success' : 'info'}
          title="Pick up where work stopped"
          description="Use the latest activity, incidents, or send history as the fastest path back into the right area."
        />
        {continueItems.length > 0 ? (
          <div className="va-native-list va-home-continue-list">
            {continueItems.map((item) => (
              <Link
                key={item.id}
                className="va-native-list-row va-home-continue-row"
                to={item.to}
              >
                <span className="va-native-list-head">
                  <strong>{item.title}</strong>
                  <span className="va-native-list-value">{item.value}</span>
                </span>
                <span className="va-home-continue-detail">{item.detail}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="va-home-empty-panel">
            <p className="va-muted">
              Recent work will appear here after calls, messaging actions, or incident updates.
            </p>
            <div className="va-shortcut-list">
              <Link className="va-shortcut-link" to={MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE}>
                <span className="va-shortcut-copy">
                  <strong>Usage guide</strong>
                  <span>Review the main flows before starting the next task.</span>
                </span>
                <span className="va-shortcut-action">Open</span>
              </Link>
              <Link className="va-shortcut-link" to={DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS}>
                <span className="va-shortcut-copy">
                  <strong>App settings</strong>
                  <span>Check session controls, preferences, and safe recovery options.</span>
                </span>
                <span className="va-shortcut-action">Open</span>
              </Link>
            </div>
          </div>
        )}

        {adminStripActions.length > 0 ? (
          <>
            <UiSurfaceState
              className="va-home-panel"
              eyebrow="Admin strip"
              status="Admin only"
              statusVariant="warning"
              tone="warning"
              title="High-priority admin tools"
              description="Keep the main admin routes one tap away from the dashboard home without overloading the primary action rail."
            />
            <div className="va-native-list va-home-admin-list" aria-label="Admin tools">
              {adminStripActions.map((action) => (
                <Link
                  key={action.id}
                  className="va-native-list-row va-home-admin-row"
                  to={action.to}
                >
                  <span className="va-native-list-head">
                    <strong>{action.title}</strong>
                    <span className="va-native-list-value">Open</span>
                  </span>
                  <span className="va-home-continue-detail">{action.description}</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
