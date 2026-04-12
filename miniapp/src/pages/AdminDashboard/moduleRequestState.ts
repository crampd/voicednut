export type ModuleRequestStatus = 'idle' | 'loading' | 'busy';

type BuildModuleRequestStateParams = {
  busyAction?: string;
  secondaryBusyAction?: string;
  loading?: boolean;
  loadingLabel?: string;
};

export type ModuleRequestState = {
  status: ModuleRequestStatus;
  isBusy: boolean;
  isLoading: boolean;
  activeActionLabel: string;
};

type BuildBasicRequestStateParams = {
  busyAction?: string;
  secondaryBusyAction?: string;
  loading?: boolean;
};

type BuildProviderRequestStateParams = BuildBasicRequestStateParams & {
  providerPreflightBusy?: string;
};

function normalizeActionLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/[._/\-:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export function buildModuleRequestState(params: BuildModuleRequestStateParams): ModuleRequestState {
  const {
    busyAction = '',
    secondaryBusyAction = '',
    loading = false,
    loadingLabel = 'Loading',
  } = params;
  const normalizedBusyAction = normalizeActionLabel(busyAction);
  const normalizedSecondaryBusyAction = normalizeActionLabel(secondaryBusyAction);
  const isBusy = normalizedBusyAction.length > 0 || normalizedSecondaryBusyAction.length > 0;

  if (isBusy) {
    return {
      status: 'busy',
      isBusy: true,
      isLoading: false,
      activeActionLabel: normalizedBusyAction || normalizedSecondaryBusyAction,
    };
  }

  if (loading) {
    return {
      status: 'loading',
      isBusy: false,
      isLoading: true,
      activeActionLabel: loadingLabel,
    };
  }

  return {
    status: 'idle',
    isBusy: false,
    isLoading: false,
    activeActionLabel: '',
  };
}

export function buildSmsRequestState(params: BuildBasicRequestStateParams): ModuleRequestState {
  return buildModuleRequestState({
    busyAction: params.busyAction,
    secondaryBusyAction: params.secondaryBusyAction,
    loading: params.loading,
  });
}

export function buildMailerRequestState(params: BuildBasicRequestStateParams): ModuleRequestState {
  return buildModuleRequestState({
    busyAction: params.busyAction,
    secondaryBusyAction: params.secondaryBusyAction,
    loading: params.loading,
  });
}

export function buildProviderRequestState(params: BuildProviderRequestStateParams): ModuleRequestState {
  return buildModuleRequestState({
    busyAction: params.busyAction,
    secondaryBusyAction: params.providerPreflightBusy,
    loading: params.loading,
  });
}
