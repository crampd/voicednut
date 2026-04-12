import { hapticFeedback } from '@tma.js/sdk-react';
import { useCallback } from 'react';

export type DashboardHapticMode = 'selection' | 'impact' | 'success' | 'warning' | 'error';
export type DashboardHapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

type HapticApi = {
  isSupported?: (() => boolean) | boolean;
  selectionChanged?: (() => void) | { ifAvailable?: () => void };
  impactOccurred?: ((style: DashboardHapticImpactStyle) => void) | {
    ifAvailable?: (style: DashboardHapticImpactStyle) => void;
  };
  notificationOccurred?: ((state: 'success' | 'warning' | 'error') => void) | {
    ifAvailable?: (state: 'success' | 'warning' | 'error') => void;
  };
};

export function useDashboardHaptic(): {
  triggerHaptic: (mode: DashboardHapticMode, impactStyle?: DashboardHapticImpactStyle) => void;
} {
  const triggerHaptic = useCallback((
    mode: DashboardHapticMode,
    impactStyle: DashboardHapticImpactStyle = 'light',
  ): void => {
    const api = hapticFeedback as unknown as HapticApi;
    try {
      const supported = typeof api.isSupported === 'function'
        ? Boolean(api.isSupported())
        : api.isSupported !== false;
      if (!supported) return;
      if (mode === 'selection') {
        if (typeof api.selectionChanged === 'function') {
          api.selectionChanged();
          return;
        }
        api.selectionChanged?.ifAvailable?.();
        return;
      }
      if (mode === 'impact') {
        if (typeof api.impactOccurred === 'function') {
          api.impactOccurred(impactStyle);
          return;
        }
        api.impactOccurred?.ifAvailable?.(impactStyle);
        return;
      }
      if (typeof api.notificationOccurred === 'function') {
        api.notificationOccurred(mode);
        return;
      }
      api.notificationOccurred?.ifAvailable?.(mode);
    } catch {
      // Ignore haptic errors to avoid blocking control-path actions.
    }
  }, []);

  return {
    triggerHaptic,
  };
}
