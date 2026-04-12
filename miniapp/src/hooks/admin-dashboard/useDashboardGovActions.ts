import { useCallback } from 'react';

import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';
import { asRecord, toText } from '@/services/admin-dashboard/dashboardPrimitives';
import {
  resolveDashboardAction,
} from '@/services/admin-dashboard/dashboardActionGuards';
import type { ProviderChannel, UserRole } from '@/pages/AdminDashboard/types';

const USER_ROLE_REASON_TEMPLATES = [
  'Policy update',
  'On-call rotation',
  'Temporary escalation',
  'Incident response',
  'Access requested by owner',
] as const;

type ActivityStatus = 'info' | 'success' | 'error';

type ProviderChannelData = {
  provider?: unknown;
  supported_providers?: unknown;
  readiness?: unknown;
};

type RunAction = (
  action: string,
  payload: Record<string, unknown>,
  options?: { confirmText?: string; successMessage?: string },
) => Promise<void>;

type UseDashboardGovernanceActionsOptions = {
  runAction: RunAction;
  pushActivity: (status: ActivityStatus, title: string, detail: string) => void;
  refreshUsersModule: () => Promise<void>;
  refreshAuditModule: () => Promise<void>;
  providersByChannel: Partial<Record<ProviderChannel, ProviderChannelData>>;
  requestTextInput?: (options: {
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    requireNonEmpty?: boolean;
    validationMessage?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'default' | 'warning' | 'danger';
  }) => Promise<string | null>;
};

type UseDashboardGovernanceActionsResult = {
  roleReasonTemplates: string[];
  handleApplyUserRole: (
    telegramId: string,
    role: UserRole,
    reasonHint?: string,
  ) => Promise<void>;
  runbookAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
};

const CHANNELS: ProviderChannel[] = ['call', 'sms', 'email'];

export function useDashboardGovernanceActions({
  runAction,
  pushActivity,
  refreshUsersModule,
  refreshAuditModule,
  providersByChannel,
  requestTextInput,
}: UseDashboardGovernanceActionsOptions): UseDashboardGovernanceActionsResult {
  const handleApplyUserRole = useCallback(async (
    telegramId: string,
    role: UserRole,
    reasonHint = '',
  ): Promise<void> => {
    const reasonInputRaw = requestTextInput
      ? await requestTextInput({
        title: 'Audit Reason Required',
        message: `Provide audit reason for ${telegramId} -> ${role}.`,
        defaultValue: reasonHint || '',
        placeholder: 'Reason for role change',
        requireNonEmpty: true,
        validationMessage: 'Audit reason is required.',
        confirmLabel: 'Continue',
        cancelLabel: 'Cancel',
        tone: 'warning',
      })
      : (typeof window !== 'undefined'
        ? window.prompt(
          `Provide audit reason for ${telegramId} -> ${role}`,
          reasonHint || '',
        )
        : reasonHint);
    const reasonInput = String(reasonInputRaw || '').trim();
    const reason = reasonInput || reasonHint.trim();
    if (!reason) {
      pushActivity('info', 'Role update cancelled', `No audit reason supplied for ${telegramId}.`);
      return;
    }
    if (role === 'admin') {
      const policyAckRaw = requestTextInput
        ? await requestTextInput({
          title: 'Two-Step Approval',
          message: 'Type "APPROVE ADMIN" to continue with admin elevation.',
          defaultValue: '',
          placeholder: 'APPROVE ADMIN',
          requireNonEmpty: true,
          validationMessage: 'Approval phrase is required.',
          confirmLabel: 'Approve',
          cancelLabel: 'Cancel',
          tone: 'danger',
        })
        : (typeof window !== 'undefined'
          ? window.prompt('Two-step approval required. Type "APPROVE ADMIN" to continue.', '')
          : '');
      const policyAck = String(policyAckRaw || '').trim().toUpperCase();
      if (policyAck !== 'APPROVE ADMIN') {
        pushActivity('info', 'Admin elevation blocked', `${telegramId} elevation not approved.`);
        return;
      }
    }
    await runAction(
      DASHBOARD_ACTION_CONTRACTS.USERS_ROLE_SET,
      { telegram_id: telegramId, role, reason },
      {
        confirmText: `Set role for ${telegramId} to ${role}?`,
        successMessage: `Updated ${telegramId} role to ${role}.`,
      },
    );
    await refreshUsersModule();
  }, [pushActivity, refreshUsersModule, requestTextInput, runAction]);

  const runbookAction = useCallback(async (
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> => {
    const actionResolution = resolveDashboardAction(action);
    if (!actionResolution.actionId) {
      pushActivity('error', 'Runbook blocked', 'Runbook blocked: missing action id. Refresh dashboard and retry.');
      return;
    }
    if (!actionResolution.supported) {
      pushActivity('error', 'Unsupported runbook action', `Runbook blocked: "${actionResolution.actionId}" is unavailable in this Mini App build.`);
      return;
    }
    const normalizedAction = actionResolution.actionId;
    let nextPayload: Record<string, unknown> = { ...payload };
    if (
      normalizedAction === DASHBOARD_ACTION_CONTRACTS.RUNBOOK_PROVIDER_PREFLIGHT
      || normalizedAction === DASHBOARD_ACTION_CONTRACTS.PROVIDER_PREFLIGHT
    ) {
      const selectedChannel = toText(nextPayload.channel, 'call').toLowerCase();
      const normalizedChannel = CHANNELS.includes(selectedChannel as ProviderChannel)
        ? selectedChannel as ProviderChannel
        : 'call';
      const fallbackProvider = toText(
        asRecord(providersByChannel[normalizedChannel]).provider,
        '',
      ).toLowerCase();
      const selectedProvider = toText(nextPayload.provider, fallbackProvider).toLowerCase();
      if (!selectedProvider) {
        pushActivity('error', 'Runbook blocked', 'No active provider available for preflight runbook.');
        return;
      }
      nextPayload = {
        ...nextPayload,
        channel: normalizedChannel,
        provider: selectedProvider,
      };
    }
    await runAction(normalizedAction, nextPayload, {
      confirmText: `Execute runbook action "${normalizedAction}"?`,
      successMessage: `Runbook executed: ${normalizedAction}`,
    });
    await refreshAuditModule();
  }, [providersByChannel, pushActivity, refreshAuditModule, runAction]);

  return {
    roleReasonTemplates: [...USER_ROLE_REASON_TEMPLATES],
    handleApplyUserRole,
    runbookAction,
  };
}
