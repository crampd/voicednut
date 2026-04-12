import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { DashboardModule } from '@/pages/AdminDashboard/dashboardShellConfig';

const DASHBOARD_PREFS_STORAGE_KEY = 'voxly-miniapp-dashboard-prefs';

interface DashboardStoredPrefs {
  active_module?: unknown;
  user_search?: unknown;
  user_sort_by?: unknown;
  user_sort_dir?: unknown;
}

type UseDashboardStoredPrefsOptions = {
  activeModule: DashboardModule;
  userSearch: string;
  userSortBy: string;
  userSortDir: string;
  setActiveModule: Dispatch<SetStateAction<DashboardModule>>;
  setUserSearch: Dispatch<SetStateAction<string>>;
  setUserSortBy: Dispatch<SetStateAction<string>>;
  setUserSortDir: Dispatch<SetStateAction<string>>;
  moduleIdSet: ReadonlySet<string>;
  initialServerModuleAppliedRef: MutableRefObject<boolean>;
};

export function useDashboardStoredPrefs({
  activeModule,
  userSearch,
  userSortBy,
  userSortDir,
  setActiveModule,
  setUserSearch,
  setUserSortBy,
  setUserSortDir,
  moduleIdSet,
  initialServerModuleAppliedRef,
}: UseDashboardStoredPrefsOptions): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DASHBOARD_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DashboardStoredPrefs | null;
      if (!parsed || typeof parsed !== 'object') return;
      const storedModule = typeof parsed.active_module === 'string'
        ? parsed.active_module.trim().toLowerCase()
        : '';
      if (moduleIdSet.has(storedModule)) {
        setActiveModule(storedModule as DashboardModule);
        initialServerModuleAppliedRef.current = true;
      }
      setUserSearch(typeof parsed.user_search === 'string' ? parsed.user_search : '');
      const sortBy = typeof parsed.user_sort_by === 'string' ? parsed.user_sort_by : 'last_activity';
      if (sortBy === 'last_activity' || sortBy === 'total_calls' || sortBy === 'role') {
        setUserSortBy(sortBy);
      }
      const sortDir = typeof parsed.user_sort_dir === 'string' ? parsed.user_sort_dir : 'desc';
      if (sortDir === 'asc' || sortDir === 'desc') {
        setUserSortDir(sortDir);
      }
    } catch {
      // Ignore invalid persisted dashboard preferences.
    }
  }, [
    initialServerModuleAppliedRef,
    moduleIdSet,
    setActiveModule,
    setUserSearch,
    setUserSortBy,
    setUserSortDir,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      active_module: activeModule,
      user_search: userSearch,
      user_sort_by: userSortBy,
      user_sort_dir: userSortDir,
    };
    try {
      window.localStorage.setItem(DASHBOARD_PREFS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore local storage failures in constrained clients.
    }
  }, [activeModule, userSearch, userSortBy, userSortDir]);
}
