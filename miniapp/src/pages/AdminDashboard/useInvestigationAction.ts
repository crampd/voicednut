import { useCallback, useState } from 'react';

import { asRecord, type JsonMap } from '@/services/admin-dashboard/dashboardPrimitives';
import {
  isDashboardActionSupported,
  resolveDashboardActionId,
} from '@/services/admin-dashboard/dashboardActionGuards';

type InvokeAction = (action: string, payload: Record<string, unknown>) => Promise<unknown>;

type RunInvestigationAction = (
  action: string,
  payload: Record<string, unknown>,
  onSuccess: (result: JsonMap) => void,
) => Promise<void>;

type UseInvestigationActionResult = {
  investigationBusy: string;
  investigationError: string;
  runInvestigationAction: RunInvestigationAction;
};

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  return 'Request failed';
}

export function useInvestigationAction(invokeAction: InvokeAction): UseInvestigationActionResult {
  const [investigationBusy, setInvestigationBusy] = useState<string>('');
  const [investigationError, setInvestigationError] = useState<string>('');

  const runInvestigationAction = useCallback<RunInvestigationAction>(async (
    action,
    payload,
    onSuccess,
  ) => {
    const actionToInvoke = resolveDashboardActionId(action);
    if (!actionToInvoke) {
      setInvestigationError('Action blocked: missing action id. Refresh and retry.');
      return;
    }
    if (!isDashboardActionSupported(actionToInvoke)) {
      setInvestigationError(`Action blocked: "${actionToInvoke}" is unavailable in this Mini App build.`);
      return;
    }
    setInvestigationBusy(actionToInvoke);
    setInvestigationError('');
    try {
      const data = await invokeAction(actionToInvoke, payload);
      onSuccess(asRecord(data));
    } catch (error) {
      setInvestigationError(extractErrorMessage(error));
    } finally {
      setInvestigationBusy('');
    }
  }, [invokeAction]);

  return {
    investigationBusy,
    investigationError,
    runInvestigationAction,
  };
}
