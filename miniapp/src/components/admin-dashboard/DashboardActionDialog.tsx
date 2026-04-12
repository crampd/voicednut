import type { RefObject } from 'react';

import { UiButton, UiInput } from '@/components/ui/AdminPrimitives';
import type {
  DashboardDialogState,
  DashboardDialogResolveValue,
} from '@/hooks/admin-dashboard/useDashboardDialog';

type DashboardActionDialogProps = {
  dialogState: DashboardDialogState | null;
  dialogInputValue: string;
  dialogInputError: string;
  setDialogInputValue: (value: string) => void;
  setDialogInputError: (value: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
  actionDialogRef: RefObject<HTMLElement>;
  dialogCancelButtonRef: RefObject<HTMLButtonElement>;
};

export function resolveDashboardDialogDismissValue(
  dialogState: DashboardDialogState,
): DashboardDialogResolveValue {
  return dialogState.kind === 'confirm' ? false : null;
}

export function DashboardActionDialog({
  dialogState,
  dialogInputValue,
  dialogInputError,
  setDialogInputValue,
  setDialogInputError,
  onDismiss,
  onConfirm,
  actionDialogRef,
  dialogCancelButtonRef,
}: DashboardActionDialogProps) {
  if (!dialogState) {
    return null;
  }
  const requiresTextMatch = dialogState.kind === 'confirm' && Boolean(dialogState.requireMatchText);
  const showInput = dialogState.kind === 'prompt' || requiresTextMatch;

  return (
    <div className="va-dialog-overlay" role="presentation" onClick={onDismiss}>
      <section
        ref={actionDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="va-dialog-title"
        aria-describedby="va-dialog-message"
        className={`va-dialog va-dialog-${dialogState.tone || 'default'}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="va-dialog-title">{dialogState.title}</h3>
        <p id="va-dialog-message" className="va-muted">{dialogState.message}</p>
        {showInput ? (
          <div className="va-dialog-input-wrap">
            <UiInput
              autoFocus
              value={dialogInputValue}
              placeholder={dialogState.kind === 'prompt'
                ? (dialogState.placeholder || '')
                : (dialogState.requireMatchPlaceholder || `Type ${dialogState.requireMatchText}`)}
              onChange={(event) => {
                setDialogInputValue(event.target.value);
                setDialogInputError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onConfirm();
                }
              }}
            />
            {requiresTextMatch && dialogState.requireMatchHint ? (
              <p className="va-muted">{dialogState.requireMatchHint}</p>
            ) : null}
            {dialogInputError ? <p className="va-error">{dialogInputError}</p> : null}
          </div>
        ) : null}
        <div className="va-dialog-actions">
          <UiButton
            ref={dialogCancelButtonRef}
            variant="secondary"
            onClick={onDismiss}
          >
            {dialogState.cancelLabel || 'Cancel'}
          </UiButton>
          <UiButton
            variant="primary"
            onClick={onConfirm}
          >
            {dialogState.confirmLabel || 'Confirm'}
          </UiButton>
        </div>
      </section>
    </div>
  );
}
