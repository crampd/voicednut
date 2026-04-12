import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { ActivityStatus } from '@/hooks/admin-dashboard/useDashboardActivityFeed';

type PushActivity = (status: ActivityStatus, title: string, detail: string) => void;

type UseDashboardRecipientsImportOptions = {
  setSmsRecipientsInput: Dispatch<SetStateAction<string>>;
  setMailerRecipientsInput: Dispatch<SetStateAction<string>>;
  pushActivity: PushActivity;
};

type UseDashboardRecipientsImportResult = {
  handleRecipientsFile: (file: File | null, kind: 'sms' | 'mailer') => Promise<void>;
};

export function useDashboardRecipientsImport({
  setSmsRecipientsInput,
  setMailerRecipientsInput,
  pushActivity,
}: UseDashboardRecipientsImportOptions): UseDashboardRecipientsImportResult {
  const handleRecipientsFile = useCallback(async (
    file: File | null,
    kind: 'sms' | 'mailer',
  ): Promise<void> => {
    if (!file) return;
    const text = await file.text().catch(() => '');
    if (!text.trim()) return;
    const combined = text.replace(/[,\t;]/g, '\n');
    if (kind === 'sms') {
      setSmsRecipientsInput((prev) => `${prev}${prev ? '\n' : ''}${combined}`.trim());
      pushActivity('info', 'CSV imported', 'SMS recipient list imported from file.');
      return;
    }
    setMailerRecipientsInput((prev) => `${prev}${prev ? '\n' : ''}${combined}`.trim());
    pushActivity('info', 'CSV imported', 'Mailer recipient list imported from file.');
  }, [pushActivity, setMailerRecipientsInput, setSmsRecipientsInput]);

  return {
    handleRecipientsFile,
  };
}
