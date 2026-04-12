import { useLaunchParams, useSignal, miniApp } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MINIAPP_COMMAND_ROUTE_CONTRACTS } from '@/contracts/miniappParityContracts';
import { DASHBOARD_WORKSPACE_ROUTE_PATHS } from '@/pages/AdminDashboard/dashboardShellConfig';

const AdminDashboardPage = lazy(async () => {
  const module = await import('@/pages/AdminDashboard/AdminDashboardPage.tsx');
  return { default: module.AdminDashboardPage };
});
const CallCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/CallCommandPage.tsx');
  return { default: module.default };
});
const SmsCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/SmsCommandPage.tsx');
  return { default: module.default };
});
const StartCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/StartCommandPage.tsx');
  return { default: module.default };
});
const HelpCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/HelpCommandPage.tsx');
  return { default: module.default };
});
const EmailCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/EmailCommandPage.tsx');
  return { default: module.default };
});
const ScriptsCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/ScriptsCommandPage.tsx');
  return { default: module.default };
});
const MenuCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/MenuCommandPage.tsx');
  return { default: module.default };
});
const GuideCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/GuideCommandPage.tsx');
  return { default: module.default };
});
const HealthCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/HealthCommandPage.tsx');
  return { default: module.default };
});
const StatusCommandPage = lazy(async () => {
  const module = await import('@/pages/CommandPages/StatusCommandPage.tsx');
  return { default: module.default };
});

const adminWorkspaceRoutes = [...DASHBOARD_WORKSPACE_ROUTE_PATHS];

function AppShellFallback() {
  return (
    <div className="app-shell-loading" role="status" aria-live="polite" aria-atomic="true">
      <div className="app-shell-loading__panel">
        <div className="app-shell-loading__topline">
          <span className="app-shell-loading__eyebrow">Voice Call Bot</span>
          <span className="app-shell-loading__badge">Syncing shell</span>
        </div>
        <strong className="app-shell-loading__title">Preparing mission control</strong>
        <p className="app-shell-loading__copy">
          Restoring dashboard routes, session posture, and workspace shortcuts.
        </p>
        <div className="app-shell-loading__metrics" aria-hidden="true">
          <span className="app-shell-loading__metric" />
          <span className="app-shell-loading__metric" />
          <span className="app-shell-loading__metric" />
        </div>
      </div>
      <div className="app-shell-loading__grid" aria-hidden="true">
        <div className="app-shell-loading__card app-shell-loading__card--hero" />
        <div className="app-shell-loading__card" />
        <div className="app-shell-loading__card" />
      </div>
    </div>
  );
}

export function App() {
  const lp = useLaunchParams();
  const isDark = useSignal(miniApp.isDark);

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <Suspense fallback={<AppShellFallback />}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AdminDashboardPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.START} element={<StartCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.CALL} element={<CallCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.SMS} element={<SmsCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.HELP} element={<HelpCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.EMAIL} element={<EmailCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.SCRIPTS} element={<ScriptsCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.MENU} element={<MenuCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.GUIDE} element={<GuideCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.HEALTH} element={<HealthCommandPage />} />
            <Route path={MINIAPP_COMMAND_ROUTE_CONTRACTS.STATUS} element={<StatusCommandPage />} />
            {adminWorkspaceRoutes.map((path) => (
              <Route key={`workspace-${path}`} path={path} element={<AdminDashboardPage />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </Suspense>
    </AppRoot>
  );
}
