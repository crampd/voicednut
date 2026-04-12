import type { ProviderChannel } from '@/pages/AdminDashboard/types';
import { classNames } from '@/css/classnames';
import { UiButton, UiCard } from '@/components/ui/AdminPrimitives';

type ProviderChannelCardProps = {
  channel: ProviderChannel;
  currentProvider: string;
  supportedProviders: string[];
  readinessByProvider: Record<string, unknown>;
  busyAction: string;
  providerPreflightBusy: string;
  providerPreflightRows: Record<string, string>;
  rollbackTarget: string;
  onSwitchProvider: (channel: ProviderChannel, provider: string, previousProvider: string) => Promise<void>;
  onRunPreflight: (channel: ProviderChannel, provider: string) => Promise<void>;
  onRollback: (channel: ProviderChannel, provider: string) => Promise<void>;
};

export function ProviderChannelCard({
  channel,
  currentProvider,
  supportedProviders,
  readinessByProvider,
  busyAction,
  providerPreflightBusy,
  providerPreflightRows,
  rollbackTarget,
  onSwitchProvider,
  onRunPreflight,
  onRollback,
}: ProviderChannelCardProps) {
  return (
    <UiCard>
      <h3>{channel.toUpperCase()} Provider</h3>
      <p className="va-muted">Current: <strong>{currentProvider || 'unknown'}</strong></p>
      <div className="va-chip-grid">
        {supportedProviders.map((provider) => {
          const normalized = provider.toLowerCase();
          const ready = readinessByProvider[normalized] !== false;
          const active = normalized === currentProvider;
          return (
            <UiButton
              key={`${channel}-${normalized}`}
              variant="chip"
              className={classNames(active && 'is-active')}
              disabled={busyAction.length > 0 || !ready || active}
              onClick={() => { void onSwitchProvider(channel, normalized, currentProvider); }}
            >
              {normalized}
              {!ready ? ' (not ready)' : ''}
            </UiButton>
          );
        })}
      </div>
      <div className="va-provider-tools">
        {supportedProviders.map((provider) => {
          const key = `${channel}:${provider}`;
          const state = providerPreflightRows[key] || 'idle';
          return (
            <UiButton
              key={`${key}:preflight`}
              variant="chip"
              disabled={providerPreflightBusy.length > 0}
              onClick={() => { void onRunPreflight(channel, provider); }}
            >
              preflight {provider}: {state}
            </UiButton>
          );
        })}
        <UiButton
          variant="chip"
          disabled={busyAction.length > 0 || !rollbackTarget || rollbackTarget === currentProvider}
          onClick={() => { void onRollback(channel, rollbackTarget); }}
        >
          rollback: {rollbackTarget || 'n/a'}
        </UiButton>
      </div>
    </UiCard>
  );
}
