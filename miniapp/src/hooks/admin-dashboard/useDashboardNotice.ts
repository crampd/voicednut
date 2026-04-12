import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  resolveNoticeTone,
  type DashboardNoticeTone,
} from '@/pages/AdminDashboard/dashboardShellHelpers';

type UseDashboardNoticeOptions = {
  setNotice: Dispatch<SetStateAction<string>>;
  setNoticeTone: Dispatch<SetStateAction<DashboardNoticeTone>>;
};

export function useDashboardNotice({
  setNotice,
  setNoticeTone,
}: UseDashboardNoticeOptions): {
  setNoticeMessage: (value: string) => void;
} {
  const setNoticeMessage = useCallback((value: string): void => {
    setNotice(value);
    setNoticeTone(resolveNoticeTone(value));
  }, [setNotice, setNoticeTone]);

  return {
    setNoticeMessage,
  };
}
