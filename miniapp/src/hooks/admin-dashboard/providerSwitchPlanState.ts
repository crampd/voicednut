import type { ProviderChannel, ProviderSwitchPlan } from '@/pages/AdminDashboard/types';

const PROVIDER_CHANNELS: ProviderChannel[] = ['call', 'sms', 'email'];

export function createEmptyProviderSwitchPlan(): ProviderSwitchPlan {
  return {
    target: '',
    stage: 'idle',
    postCheck: 'idle',
    rollbackSuggestion: '',
  };
}

export function createDefaultProviderSwitchPlanByChannel(): Record<ProviderChannel, ProviderSwitchPlan> {
  return PROVIDER_CHANNELS.reduce<Record<ProviderChannel, ProviderSwitchPlan>>((acc, channel) => {
    acc[channel] = createEmptyProviderSwitchPlan();
    return acc;
  }, {
    call: createEmptyProviderSwitchPlan(),
    sms: createEmptyProviderSwitchPlan(),
    email: createEmptyProviderSwitchPlan(),
  });
}
