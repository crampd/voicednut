import { Link } from '@/components/Link/Link.tsx';
import { UiBadge, UiCard, UiDisclosure } from '@/components/ui/AdminPrimitives';
import { ROLE_SUPPORT_COPY, SUPPORT_LINKS_BY_ROLE, normalizeSessionRoleKey, resolveCommandAccessSummary } from '@/contracts/miniappAccessExperience';

type DashboardShellOwnershipCardProps = {
  sessionRole: string;
  visibleModulesCount: number;
};

export function DashboardShellOwnershipCard({
  sessionRole,
  visibleModulesCount,
}: DashboardShellOwnershipCardProps) {
  const roleKey = normalizeSessionRoleKey(sessionRole);
  const supportLinks = SUPPORT_LINKS_BY_ROLE[roleKey] || SUPPORT_LINKS_BY_ROLE.viewer;
  const { accessLabel, readyCommandPages, lockedCommandPages } = resolveCommandAccessSummary(sessionRole);

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
              <UiBadge>{accessLabel}</UiBadge>
              <UiBadge>{readyCommandPages.length} open now</UiBadge>
              <UiBadge>{lockedCommandPages.length} locked</UiBadge>
              <UiBadge>Telegram native shell</UiBadge>
              <UiBadge>{visibleModulesCount} areas</UiBadge>
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
