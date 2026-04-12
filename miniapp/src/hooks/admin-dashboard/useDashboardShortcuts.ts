import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

import type { DashboardDialogState } from '@/hooks/admin-dashboard/useDashboardDialog';
import type { DashboardModule } from '@/pages/AdminDashboard/dashboardShellConfig';

type ActivityStatus = 'info' | 'success' | 'error';

type UseDashboardKeyboardShortcutsOptions = {
  dialogState: DashboardDialogState | null;
  dismissDialog: (state: DashboardDialogState | null) => void;
  loadBootstrap: () => Promise<void> | void;
  pushActivity: (status: ActivityStatus, title: string, detail: string) => void;
  selectModule: (moduleId: DashboardModule, options?: { fromKeyboard?: boolean }) => void;
  settingsOpen: boolean;
  toggleSettings: (next?: boolean, options?: { fallbackModule?: DashboardModule }) => void;
  triggerHaptic: (
    mode: 'selection' | 'impact' | 'success' | 'warning' | 'error',
    impactStyle?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
  ) => void;
  visibleModules: Array<{ id: DashboardModule }>;
  restoreFocusSelectorRef: MutableRefObject<string>;
  isTypingTarget: (target: EventTarget | null) => boolean;
};

export function useDashboardKeyboardShortcuts({
  dialogState,
  dismissDialog,
  loadBootstrap,
  pushActivity,
  selectModule,
  settingsOpen,
  toggleSettings,
  triggerHaptic,
  visibleModules,
  restoreFocusSelectorRef,
  isTypingTarget: isTypingTargetInput,
}: UseDashboardKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTargetInput(event.target)) return;
      const key = event.key.toLowerCase();
      if (dialogState && key === 'escape') {
        event.preventDefault();
        dismissDialog(dialogState);
        return;
      }
      if (dialogState) return;
      if ((event.ctrlKey || event.metaKey) && key === ',') {
        event.preventDefault();
        toggleSettings();
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (key === 'r') {
        event.preventDefault();
        triggerHaptic('impact', 'light');
        pushActivity('info', 'Manual refresh', 'Operator triggered dashboard refresh.');
        void loadBootstrap();
        return;
      }
      if (key === 's') {
        event.preventDefault();
        toggleSettings();
        return;
      }
      const moduleIndex = Number.parseInt(key, 10);
      if (!Number.isFinite(moduleIndex) || moduleIndex < 1 || moduleIndex > visibleModules.length) return;
      const nextModule = visibleModules[moduleIndex - 1];
      if (!nextModule) return;
      event.preventDefault();
      restoreFocusSelectorRef.current = `#va-launcher-module-${nextModule.id}, #va-view-stage-root`;
      if (settingsOpen) {
        toggleSettings(false, { fallbackModule: nextModule.id });
        selectModule(nextModule.id);
        return;
      }
      selectModule(nextModule.id, { fromKeyboard: true });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    dialogState,
    dismissDialog,
    isTypingTargetInput,
    loadBootstrap,
    pushActivity,
    restoreFocusSelectorRef,
    selectModule,
    settingsOpen,
    toggleSettings,
    triggerHaptic,
    visibleModules,
  ]);
}
