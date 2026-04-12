import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardActionConfirmDialog } from '@/hooks/admin-dashboard/useDashboardActions';

export type DashboardDialogTone = 'default' | 'warning' | 'danger';

export type DashboardPromptDialog = {
  kind: 'prompt';
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  requireNonEmpty?: boolean;
  validationMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DashboardDialogTone;
};

export type DashboardConfirmDialogState = DashboardActionConfirmDialog & { kind: 'confirm' };

export type DashboardDialogState = DashboardConfirmDialogState | DashboardPromptDialog;

export type DashboardDialogResolveValue = boolean | string | null;

type OpenPromptDialogOptions = Omit<DashboardPromptDialog, 'kind'>;

type UseDashboardDialogResult = {
  dialogState: DashboardDialogState | null;
  dialogInputValue: string;
  dialogInputError: string;
  setDialogInputValue: (value: string) => void;
  setDialogInputError: (value: string) => void;
  closeDialog: (value: DashboardDialogResolveValue) => void;
  openConfirmDialog: (dialog: DashboardActionConfirmDialog) => Promise<boolean>;
  openPromptDialog: (options: OpenPromptDialogOptions) => Promise<string | null>;
  handleDialogConfirm: () => void;
};

export function useDashboardDialog(): UseDashboardDialogResult {
  const [dialogState, setDialogState] = useState<DashboardDialogState | null>(null);
  const [dialogInputValue, setDialogInputValue] = useState<string>('');
  const [dialogInputError, setDialogInputError] = useState<string>('');
  const dialogResolverRef = useRef<((value: DashboardDialogResolveValue) => void) | null>(null);

  const closeDialog = useCallback((value: DashboardDialogResolveValue): void => {
    const resolve = dialogResolverRef.current;
    dialogResolverRef.current = null;
    setDialogState(null);
    setDialogInputValue('');
    setDialogInputError('');
    resolve?.(value);
  }, []);

  const openConfirmDialog = useCallback((dialog: DashboardActionConfirmDialog): Promise<boolean> => (
    new Promise<boolean>((resolve) => {
      if (dialogResolverRef.current) {
        dialogResolverRef.current(false);
      }
      dialogResolverRef.current = (value) => {
        resolve(Boolean(value));
      };
      setDialogInputValue('');
      setDialogInputError('');
      setDialogState({
        kind: 'confirm',
        title: dialog.title,
        message: dialog.message,
        confirmLabel: dialog.confirmLabel,
        cancelLabel: dialog.cancelLabel,
        tone: dialog.tone,
      });
    })
  ), []);

  const openPromptDialog = useCallback((options: OpenPromptDialogOptions): Promise<string | null> => (
    new Promise<string | null>((resolve) => {
      if (dialogResolverRef.current) {
        dialogResolverRef.current(null);
      }
      dialogResolverRef.current = (value) => {
        resolve(typeof value === 'string' ? value : null);
      };
      setDialogInputValue(options.defaultValue || '');
      setDialogInputError('');
      setDialogState({
        kind: 'prompt',
        ...options,
      });
    })
  ), []);

  const handleDialogConfirm = useCallback((): void => {
    if (!dialogState) return;
    if (dialogState.kind === 'confirm') {
      const requiredValue = dialogState.requireMatchText?.trim();
      if (requiredValue) {
        const enteredValue = dialogInputValue.trim();
        if (enteredValue !== requiredValue) {
          setDialogInputError(
            dialogState.requireMatchValidationMessage || `Type ${requiredValue} exactly to continue.`,
          );
          return;
        }
      }
      closeDialog(true);
      return;
    }
    const nextValue = dialogInputValue.trim();
    if (dialogState.requireNonEmpty && !nextValue) {
      setDialogInputError(dialogState.validationMessage || 'This field is required.');
      return;
    }
    closeDialog(nextValue);
  }, [closeDialog, dialogInputValue, dialogState]);

  useEffect(() => () => {
    if (dialogResolverRef.current) {
      dialogResolverRef.current(null);
      dialogResolverRef.current = null;
    }
  }, []);

  return {
    dialogState,
    dialogInputValue,
    dialogInputError,
    setDialogInputValue,
    setDialogInputError,
    closeDialog,
    openConfirmDialog,
    openPromptDialog,
    handleDialogConfirm,
  };
}
