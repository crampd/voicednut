import { Link } from '@/components/Link/Link.tsx';
import { UiBadge, UiCard, UiDisclosure } from '@/components/ui/AdminPrimitives';
import {
  DASHBOARD_MODULE_ROUTE_CONTRACTS,
  DASHBOARD_STATIC_ROUTE_CONTRACTS,
  MINIAPP_COMMAND_ROUTE_CONTRACTS,
} from '@/contracts/miniappParityContracts';

type DashboardShellOwnershipCardProps = {
  sessionRole: string;
  visibleModulesCount: number;
};

type SupportLink = {
  title: string;
  description: string;
  to: string;
};

const ROLE_SUPPORT_COPY: Record<string, string> = {
  admin: 'Admin actions stay on the home screen, while access governance and incident follow-up stay one tap away.',
  operator: 'Keep the next task close, and use support surfaces for rules, help, and recovery.',
  viewer: 'The home screen stays browse-safe and explains what unlocks after approval.',
};

const SUPPORT_LINKS_BY_ROLE: Record<string, SupportLink[]> = {
  admin: [
    {
      title: 'Users & access',
      description: 'Review role assignments, access posture, and operator visibility.',
      to: DASHBOARD_MODULE_ROUTE_CONTRACTS.users,
    },
    {
      title: 'Incident center',
      description: 'Open the audit and incident workspace for active follow-up.',
      to: DASHBOARD_MODULE_ROUTE_CONTRACTS.audit,
    },
    {
      title: 'App settings',
      description: 'Open preferences, session controls, and recovery actions.',
      to: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
    },
  ],
  operator: [
    {
      title: 'Help Center',
      description: 'Open support guidance and the safest next step when something blocks work.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
    },
    {
      title: 'Operational rules',
      description: 'Review the main flows, safeguards, and fallback behavior before acting.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
    },
    {
      title: 'App settings',
      description: 'Open preferences, session controls, and recovery actions.',
      to: DASHBOARD_STATIC_ROUTE_CONTRACTS.SETTINGS,
    },
  ],
  viewer: [
    {
      title: 'Request access',
      description: 'Open help and approval guidance for the capabilities this role cannot run yet.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP,
    },
    {
      title: 'How it works',
      description: 'Review the role-aware app entry flow and what becomes available after approval.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.START,
    },
    {
      title: 'Usage guide',
      description: 'See the main workflows before trying them from the home screen.',
      to: MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE,
    },
  ],
};

export function DashboardShellOwnershipCard({
  sessionRole,
  visibleModulesCount,
}: DashboardShellOwnershipCardProps) {
  const roleKey = Object.prototype.hasOwnProperty.call(ROLE_SUPPORT_COPY, sessionRole)
    ? sessionRole
    : 'viewer';
  const supportLinks = SUPPORT_LINKS_BY_ROLE[roleKey] || SUPPORT_LINKS_BY_ROLE.viewer;

  return (
    <section className="va-section-block va-shell-guide-block" aria-label="Support and access">
      <UiDisclosure
        title="Support and access"
        subtitle="Guidance, settings, and safe fallback routes stay available from the dashboard home."
      >
        <div className="va-grid">
          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Access posture</h3>
                <p className="va-muted">Home stays role-aware and keeps the safest next route in easy reach.</p>
              </div>
              <UiBadge>{visibleModulesCount} areas</UiBadge>
            </div>
            <div className="va-inline-metrics">
              <UiBadge>Role {sessionRole}</UiBadge>
              <UiBadge>Telegram native shell</UiBadge>
              <UiBadge>Home safe</UiBadge>
            </div>
            <p className="va-muted">{ROLE_SUPPORT_COPY[roleKey]}</p>
          </UiCard>

          <UiCard>
            <div className="va-ops-card-header">
              <div className="va-ops-card-headline">
                <h3>Support surfaces</h3>
                <p className="va-muted">Guidance, recovery, and approval routes stay close to the dashboard home.</p>
              </div>
              <UiBadge>{supportLinks.length} routes</UiBadge>
            </div>
            <div className="va-shortcut-list">
              {supportLinks.map((link) => (
                <Link key={link.title} className="va-shortcut-link" to={link.to}>
                  <span className="va-shortcut-copy">
                    <strong>{link.title}</strong>
                    <span>{link.description}</span>
                  </span>
                  <span className="va-shortcut-action">Open</span>
                </Link>
              ))}
            </div>
          </UiCard>
        </div>
      </UiDisclosure>
    </section>
  );
}
