import { UiBadge, UiCard } from '@/components/ui/AdminPrimitives';
import {
  DASHBOARD_MODULE_PAGE_WORKFLOW_CONTRACTS,
  DASHBOARD_MODULE_WORKFLOW_DETAIL_CONTRACTS,
  type DashboardModuleId,
} from '@/contracts/miniappParityContracts';

type DashboardWorkflowContractCardProps = {
  moduleId: 'ops' | 'mailer' | 'content' | 'scriptsparity' | 'messaging' | 'persona' | 'audit';
};

function renderListItems(values: readonly string[]) {
  return (
    <ul className="va-list">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  );
}

export function DashboardWorkflowContractCard({ moduleId }: DashboardWorkflowContractCardProps) {
  const detailContract = DASHBOARD_MODULE_WORKFLOW_DETAIL_CONTRACTS[moduleId];
  const pageContract = DASHBOARD_MODULE_PAGE_WORKFLOW_CONTRACTS[moduleId as DashboardModuleId];

  return (
    <section className="va-section-block" aria-label="Workspace guide">
      <header className="va-section-header">
        <h3 className="va-section-title">Workspace guide</h3>
        <p className="va-muted">
          What this workspace handles, what it needs, and how it behaves when data is stale.
        </p>
      </header>
      <section className="va-grid">
        <UiCard>
          <h3>Workspace scope</h3>
          <div className="va-inline-metrics">
            <UiBadge>Access {detailContract.capability || 'shared'}</UiBadge>
            <UiBadge>Coverage {pageContract.workflowStatus}</UiBadge>
            <UiBadge>Fallback home</UiBadge>
          </div>
          <p className="va-card-eyebrow">Required inputs</p>
          {renderListItems(detailContract.requiredInputs)}
          <p className="va-card-eyebrow">Operator notes</p>
          <p className="va-muted">{pageContract.notes}</p>
        </UiCard>

        <UiCard>
          <h3>Before you start</h3>
          <p className="va-card-eyebrow">Validation and prechecks</p>
          {renderListItems(detailContract.validationSteps)}
          <p className="va-card-eyebrow">Confirmation rules</p>
          {renderListItems(detailContract.confirmationRules)}
          <p className="va-card-eyebrow">Action family</p>
          <div className="va-inline-tools">
            {detailContract.executionActions.map((actionId) => (
              <code key={`${moduleId}-${actionId}`}>{actionId}</code>
            ))}
          </div>
        </UiCard>

        <UiCard>
          <h3>Resilience and follow-up</h3>
          <p className="va-card-eyebrow">Success behavior</p>
          {renderListItems(detailContract.successBehavior)}
          <p className="va-card-eyebrow">Failure behavior</p>
          {renderListItems(detailContract.failureBehavior)}
          <p className="va-card-eyebrow">Degraded-state behavior</p>
          {renderListItems(detailContract.degradedBehavior)}
          <p className="va-card-eyebrow">Approved Mini App-only productivity enhancements</p>
          {renderListItems(detailContract.productivityEnhancements)}
        </UiCard>
      </section>
    </section>
  );
}
