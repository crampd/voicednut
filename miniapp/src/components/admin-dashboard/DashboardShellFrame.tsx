import type { ReactNode } from 'react';

type DashboardShellFrameProps = {
  loading: boolean;
  settingsOpen: boolean;
  activeModuleLabel: string;
  children: ReactNode;
};

export function DashboardShellFrame({
  loading,
  settingsOpen,
  activeModuleLabel,
  children,
}: DashboardShellFrameProps): JSX.Element {
  return (
    <main className="va-dashboard" aria-busy={loading}>
      <a className="va-skip-link" href="#va-view-stage-root">Skip to active content</a>
      <p className="va-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {settingsOpen
          ? 'Settings panel active.'
          : `${activeModuleLabel} module active.`}
      </p>
      {children}
    </main>
  );
}
