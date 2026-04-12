import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { ProviderChannel, ProviderSwitchPlan } from '@/pages/AdminDashboard/types';

type ProviderSwitchPlanWithTarget = Pick<ProviderSwitchPlan, 'target'>;

type UseDashboardProviderSwitchDefaultsOptions<TPlanState extends ProviderSwitchPlanWithTarget> = {
  providerCurrentByChannel: Record<ProviderChannel, string>;
  providerSupportedByChannel: Record<ProviderChannel, string[]>;
  setProviderSwitchPlanByChannel: Dispatch<SetStateAction<Record<ProviderChannel, TPlanState>>>;
};

const CHANNELS: ProviderChannel[] = ['call', 'sms', 'email'];

export function useDashboardProviderSwitchDefaults<TPlanState extends ProviderSwitchPlanWithTarget>({
  providerCurrentByChannel,
  providerSupportedByChannel,
  setProviderSwitchPlanByChannel,
}: UseDashboardProviderSwitchDefaultsOptions<TPlanState>): void {
  useEffect(() => {
    setProviderSwitchPlanByChannel((prev) => {
      let changed = false;
      const next = { ...prev };
      CHANNELS.forEach((channel) => {
        const current = providerCurrentByChannel[channel];
        const supported = providerSupportedByChannel[channel];
        const fallbackTarget = current || supported[0] || '';
        if (!fallbackTarget || prev[channel].target) return;
        changed = true;
        next[channel] = {
          ...prev[channel],
          target: fallbackTarget,
        };
      });
      return changed ? next : prev;
    });
  }, [providerCurrentByChannel, providerSupportedByChannel, setProviderSwitchPlanByChannel]);
}
