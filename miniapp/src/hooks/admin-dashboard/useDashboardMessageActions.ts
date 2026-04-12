import { useCallback } from 'react';

import { DASHBOARD_ACTION_CONTRACTS } from '@/contracts/miniappParityContracts';
import { isLikelyEmail, isValidE164 } from '@/services/admin-dashboard/dashboardPrimitives';

type ActivityStatus = 'info' | 'success' | 'error';

type InvokeAction = (
  action: string,
  payload: Record<string, unknown>,
  metaOverride?: Record<string, unknown>,
) => Promise<unknown>;

type RunAction = (
  action: string,
  payload: Record<string, unknown>,
  options?: { confirmText?: string; successMessage?: string },
) => Promise<void>;

type UseDashboardMessagingActionsOptions = {
  invokeAction: InvokeAction;
  runAction: RunAction;
  pushActivity: (status: ActivityStatus, title: string, detail: string) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  setBusyAction: (action: string) => void;
  formatTime: (value: unknown) => string;
  smsRecipientsParsed: string[];
  smsMessageInput: string;
  smsDryRunMode: boolean;
  smsSegmentEstimateSegments: number;
  smsEstimatedCost: number;
  smsScheduleAt: string;
  smsProviderInput: string;
  mailerRecipientsParsed: string[];
  mailerTemplateIdInput: string;
  mailerSubjectInput: string;
  mailerHtmlInput: string;
  mailerTextInput: string;
  mailerVariablesInput: string;
  mailerScheduleAt: string;
};

type UseDashboardMessagingActionsResult = {
  sendSmsFromConsole: () => Promise<void>;
  sendMailerFromConsole: () => Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function useDashboardMessagingActions({
  invokeAction,
  runAction,
  pushActivity,
  setError,
  setNotice,
  setBusyAction,
  formatTime,
  smsRecipientsParsed,
  smsMessageInput,
  smsDryRunMode,
  smsSegmentEstimateSegments,
  smsEstimatedCost,
  smsScheduleAt,
  smsProviderInput,
  mailerRecipientsParsed,
  mailerTemplateIdInput,
  mailerSubjectInput,
  mailerHtmlInput,
  mailerTextInput,
  mailerVariablesInput,
  mailerScheduleAt,
}: UseDashboardMessagingActionsOptions): UseDashboardMessagingActionsResult {
  const sendSmsFromConsole = useCallback(async (): Promise<void> => {
    const recipients = smsRecipientsParsed.filter((phone) => isValidE164(phone));
    if (!recipients.length) {
      setError('Provide at least one valid E.164 recipient.');
      return;
    }
    if (!smsMessageInput.trim()) {
      setError('SMS message is required.');
      return;
    }
    if (smsDryRunMode) {
      const previewMsg = `Dry-run complete: ${recipients.length} recipients, ${smsSegmentEstimateSegments} segment(s), est. $${smsEstimatedCost.toFixed(4)}.`;
      setNotice(previewMsg);
      pushActivity('info', 'SMS dry-run simulation', previewMsg);
      return;
    }
    if (smsScheduleAt) {
      setBusyAction(DASHBOARD_ACTION_CONTRACTS.SMS_SCHEDULE_SEND);
      setError('');
      setNotice('');
      try {
        const scheduledIso = new Date(smsScheduleAt).toISOString();
        let queued = 0;
        const failures: Array<{ recipient: string; error: string }> = [];
        for (const recipient of recipients) {
          try {
            await invokeAction(DASHBOARD_ACTION_CONTRACTS.SMS_SCHEDULE_SEND, {
              to: recipient,
              message: smsMessageInput,
              scheduled_time: scheduledIso,
              provider: smsProviderInput || undefined,
              options: {
                durable: true,
              },
            });
            queued += 1;
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            failures.push({ recipient, error: detail });
          }
        }
        if (failures.length === 0) {
          const msg = `Scheduled ${queued} SMS messages for ${formatTime(scheduledIso)}.`;
          setNotice(msg);
          pushActivity('success', 'SMS scheduled', msg);
          return;
        }
        if (queued === 0) {
          const detail = failures[0]?.error || 'Scheduling failed for all recipients.';
          setError(detail);
          pushActivity('error', 'SMS scheduling failed', detail);
          return;
        }
        const msg = `Scheduled ${queued}/${recipients.length} SMS messages for ${formatTime(scheduledIso)}. ${failures.length} failed.`;
        setNotice(msg);
        setError(`Some recipients failed scheduling. First failure: ${failures[0]?.recipient} (${failures[0]?.error || 'unknown'})`);
        pushActivity('error', 'SMS partially scheduled', msg);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setError(detail);
        pushActivity('error', 'SMS scheduling failed', detail);
      } finally {
        setBusyAction('');
      }
      return;
    }
    await runAction(
      DASHBOARD_ACTION_CONTRACTS.SMS_BULK_SEND,
      {
        recipients,
        message: smsMessageInput,
        provider: smsProviderInput || undefined,
        options: {
          durable: true,
        },
      },
      {
        confirmText: `Send SMS to ${recipients.length} recipients now?`,
        successMessage: `Bulk SMS submitted (${recipients.length} recipients).`,
      },
    );
  }, [
    formatTime,
    invokeAction,
    pushActivity,
    runAction,
    setBusyAction,
    setError,
    setNotice,
    smsDryRunMode,
    smsEstimatedCost,
    smsMessageInput,
    smsProviderInput,
    smsRecipientsParsed,
    smsScheduleAt,
    smsSegmentEstimateSegments,
  ]);

  const sendMailerFromConsole = useCallback(async (): Promise<void> => {
    const validRecipients = mailerRecipientsParsed
      .filter((email) => isLikelyEmail(email))
      .map((email) => ({ email }));
    if (!validRecipients.length) {
      setError('Provide at least one valid recipient email.');
      return;
    }
    let parsedVariables: Record<string, unknown> = {};
    if (mailerVariablesInput.trim()) {
      try {
        parsedVariables = asRecord(JSON.parse(mailerVariablesInput));
      } catch {
        setError('Variables must be valid JSON.');
        return;
      }
    }
    const payload: Record<string, unknown> = {
      recipients: validRecipients,
      provider: undefined,
      script_id: mailerTemplateIdInput || undefined,
      subject: mailerSubjectInput || undefined,
      html: mailerHtmlInput || undefined,
      text: mailerTextInput || undefined,
      variables: parsedVariables,
      send_at: mailerScheduleAt ? new Date(mailerScheduleAt).toISOString() : undefined,
    };
    await runAction(
      DASHBOARD_ACTION_CONTRACTS.EMAIL_BULK_SEND,
      payload,
      {
        confirmText: `Queue bulk email for ${validRecipients.length} recipients?`,
        successMessage: `Bulk email queued (${validRecipients.length} recipients).`,
      },
    );
  }, [
    mailerHtmlInput,
    mailerRecipientsParsed,
    mailerScheduleAt,
    mailerSubjectInput,
    mailerTemplateIdInput,
    mailerTextInput,
    mailerVariablesInput,
    runAction,
    setError,
  ]);

  return {
    sendSmsFromConsole,
    sendMailerFromConsole,
  };
}
