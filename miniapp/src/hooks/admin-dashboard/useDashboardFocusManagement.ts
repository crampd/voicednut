import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { DashboardDialogState } from '@/hooks/admin-dashboard/useDashboardDialog';
import type { DashboardModule } from '@/pages/AdminDashboard/dashboardShellConfig';

type UseDashboardFocusManagementOptions = {
  activeModule: DashboardModule;
  settingsOpen: boolean;
  dialogState: DashboardDialogState | null;
};

type UseDashboardFocusManagementResult = {
  actionDialogRef: MutableRefObject<HTMLElement | null>;
  dialogCancelButtonRef: MutableRefObject<HTMLButtonElement | null>;
  restoreFocusSelectorRef: MutableRefObject<string>;
  shouldRestoreFocusRef: MutableRefObject<boolean>;
  shouldFocusStageRef: MutableRefObject<boolean>;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => {
      if (element.matches(':disabled')) return false;
      if (element.getAttribute('aria-hidden') === 'true') return false;
      if (element instanceof HTMLInputElement && element.type === 'hidden') return false;
      if (element.tabIndex < 0) return false;
      return element.getClientRects().length > 0;
    });
}

export function useDashboardFocusManagement({
  activeModule,
  settingsOpen,
  dialogState,
}: UseDashboardFocusManagementOptions): UseDashboardFocusManagementResult {
  const actionDialogRef = useRef<HTMLElement>(null);
  const dialogCancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusSelectorRef = useRef<string>('#va-view-stage-root');
  const shouldRestoreFocusRef = useRef<boolean>(false);
  const shouldFocusStageRef = useRef<boolean>(false);

  useEffect(() => {
    if (settingsOpen) return;
    if (!shouldRestoreFocusRef.current) return;
    shouldRestoreFocusRef.current = false;
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(restoreFocusSelectorRef.current)
        || document.querySelector<HTMLElement>('#va-view-stage-root');
      target?.focus({ preventScroll: true });
    });
  }, [activeModule, settingsOpen]);

  useEffect(() => {
    if (settingsOpen) return;
    if (!shouldFocusStageRef.current) return;
    shouldFocusStageRef.current = false;
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('#va-view-stage-root')?.focus({ preventScroll: true });
    });
  }, [activeModule, settingsOpen]);

  useEffect(() => {
    if (!dialogState) return;
    if (typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    dialogReturnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    const requiresTextMatch = dialogState.kind === 'confirm' && Boolean(dialogState.requireMatchText);
    if (dialogState.kind === 'prompt' || requiresTextMatch) return;
    requestAnimationFrame(() => {
      dialogCancelButtonRef.current?.focus({ preventScroll: true });
    });
  }, [dialogState]);

  useEffect(() => {
    if (dialogState) return;
    const previousFocus = dialogReturnFocusRef.current;
    if (!previousFocus) return;
    dialogReturnFocusRef.current = null;
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      if (previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
        return;
      }
      document.querySelector<HTMLElement>('#va-view-stage-root')?.focus({ preventScroll: true });
    });
  }, [dialogState]);

  useEffect(() => {
    if (!dialogState) return undefined;
    if (typeof document === 'undefined') return undefined;

    const handleTabTrap = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const surface = actionDialogRef.current;
      if (!surface) return;
      const focusable = getFocusableElements(surface);
      if (focusable.length === 0) {
        event.preventDefault();
        surface.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement) || !surface.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
        return;
      }
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleTabTrap, true);
    return () => {
      document.removeEventListener('keydown', handleTabTrap, true);
    };
  }, [dialogState]);

  return {
    actionDialogRef,
    dialogCancelButtonRef,
    restoreFocusSelectorRef,
    shouldRestoreFocusRef,
    shouldFocusStageRef,
  };
}
