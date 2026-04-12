import type { DashboardVm } from './types';

function pickVm<K extends keyof DashboardVm>(
  vm: DashboardVm,
  keys: readonly K[],
): Pick<DashboardVm, K> {
  const selected = {} as Pick<DashboardVm, K>;
  keys.forEach((key) => {
    selected[key] = vm[key];
  });
  return selected;
}

function createMemoizedVmSelector<K extends keyof DashboardVm>(keys: readonly K[]) {
  const cache = new WeakMap<DashboardVm, Pick<DashboardVm, K>>();
  return (vm: DashboardVm): Pick<DashboardVm, K> => {
    const cached = cache.get(vm);
    if (cached) {
      return cached;
    }
    const selected = pickVm(vm, keys);
    cache.set(vm, selected);
    return selected;
  };
}

const OPS_VM_KEYS = [
  'isFeatureEnabled',
  'isDashboardDegraded',
  'syncModeLabel',
  'streamModeLabel',
  'streamLastEventLabel',
  'streamFailureCount',
  'pollFailureCount',
  'bridgeHardFailures',
  'bridgeSoftFailures',
  'sloErrorBudgetPercent',
  'sloP95ActionLatencyMs',
  'pollFreshnessLabel',
  'degradedCauses',
  'lastPollLabel',
  'lastSuccessfulPollLabel',
  'nextPollLabel',
  'callCompleted',
  'callTotal',
  'callFailed',
  'callFailureRate',
  'callSuccessRate',
  'queueBacklogTotal',
  'opsQaSummary',
  'providerReadinessTotals',
  'providerReadinessPercent',
  'textBar',
  'runtimeEffectiveMode',
  'runtimeModeOverride',
  'runtimeCanaryEffective',
  'runtimeCanaryOverrideLabel',
  'runtimeIsCircuitOpen',
  'runtimeForcedLegacyUntil',
  'runtimeActiveTotal',
  'runtimeActiveLegacy',
  'runtimeActiveVoiceAgent',
  'busyAction',
  'enableRuntimeMaintenance',
  'disableRuntimeMaintenance',
  'refreshRuntimeStatus',
  'runtimeCanaryInput',
  'setRuntimeCanaryInput',
  'applyRuntimeCanary',
  'clearRuntimeCanary',
  'activityLog',
  'formatTime',
  'renderProviderSection',
  'smsTotalRecipients',
  'smsSuccess',
  'smsFailed',
  'smsProcessedPercent',
  'emailTotalRecipients',
  'emailSent',
  'emailFailed',
  'emailDelivered',
  'emailBounced',
  'emailComplained',
  'emailSuppressed',
  'emailProcessedPercent',
  'emailDeliveredPercent',
  'callLogs',
  'callLogsTotal',
  'toText',
  'toInt',
  'emailJobs',
  'dlqPayload',
  'callDlq',
  'emailDlq',
  'runAction',
  'invokeAction',
  'hasMeaningfulData',
  'loading',
] as const satisfies readonly (keyof DashboardVm)[];

const SMS_VM_KEYS = [
  'hasCapability',
  'smsRecipientsInput',
  'setSmsRecipientsInput',
  'handleRecipientsFile',
  'smsProviderInput',
  'setSmsProviderInput',
  'smsMessageInput',
  'setSmsMessageInput',
  'smsScheduleAt',
  'setSmsScheduleAt',
  'busyAction',
  'sendSmsFromConsole',
  'smsRecipientsParsed',
  'smsInvalidRecipients',
  'smsDuplicateCount',
  'smsSegmentEstimate',
  'smsCostPerSegment',
  'setSmsCostPerSegment',
  'smsEstimatedCost',
  'smsDryRunMode',
  'setSmsDryRunMode',
  'smsValidationCategories',
  'smsRouteSimulationRows',
  'smsTotalRecipients',
  'smsSuccess',
  'smsFailed',
  'smsProcessedPercent',
  'textBar',
  'invokeAction',
  'loading',
] as const satisfies readonly (keyof DashboardVm)[];

const MAILER_VM_KEYS = [
  'mailerRecipientsInput',
  'setMailerRecipientsInput',
  'handleRecipientsFile',
  'mailerTemplateIdInput',
  'setMailerTemplateIdInput',
  'mailerSubjectInput',
  'setMailerSubjectInput',
  'mailerHtmlInput',
  'setMailerHtmlInput',
  'mailerTextInput',
  'setMailerTextInput',
  'mailerVariablesInput',
  'setMailerVariablesInput',
  'mailerScheduleAt',
  'setMailerScheduleAt',
  'busyAction',
  'sendMailerFromConsole',
  'mailerRecipientsParsed',
  'mailerInvalidRecipients',
  'mailerDuplicateCount',
  'mailerVariableKeys',
  'mailerTemplatePreviewSubject',
  'mailerTemplatePreviewBody',
  'mailerTemplatePreviewError',
  'mailerDomainHealthStatus',
  'mailerDomainHealthDetail',
  'mailerTrendBars',
  'emailTotalRecipients',
  'emailSent',
  'emailFailed',
  'emailDelivered',
  'emailBounced',
  'emailComplained',
  'emailSuppressed',
  'emailProcessedPercent',
  'emailDeliveredPercent',
  'emailBouncePercent',
  'emailComplaintPercent',
  'textBar',
  'emailJobs',
  'toText',
  'toInt',
  'invokeAction',
  'loading',
] as const satisfies readonly (keyof DashboardVm)[];

const PROVIDER_VM_KEYS = [
  'providerReadinessTotals',
  'providerDegradedCount',
  'providerReadinessPercent',
  'textBar',
  'busyAction',
  'providerPreflightBusy',
  'preflightActiveProviders',
  'loading',
  'handleRefresh',
  'providerMatrixRows',
  'providerCurrentByChannel',
  'providerSupportedByChannel',
  'providerSwitchPlanByChannel',
  'setProviderSwitchTarget',
  'simulateProviderSwitchPlan',
  'confirmProviderSwitchPlan',
  'applyProviderSwitchPlan',
  'resetProviderSwitchPlan',
  'renderProviderSection',
] as const satisfies readonly (keyof DashboardVm)[];

const SCRIPT_STUDIO_VM_KEYS = [
  'scriptFlowFilter',
  'setScriptFlowFilter',
  'refreshCallScriptsModule',
  'callScriptsTotal',
  'callScripts',
  'toInt',
  'toText',
  'selectedCallScriptId',
  'setSelectedCallScriptId',
  'selectedCallScript',
  'selectedCallScriptLifecycleState',
  'selectedCallScriptLifecycle',
  'formatTime',
  'scriptNameInput',
  'setScriptNameInput',
  'scriptDefaultProfileInput',
  'setScriptDefaultProfileInput',
  'scriptDescriptionInput',
  'setScriptDescriptionInput',
  'scriptPromptInput',
  'setScriptPromptInput',
  'scriptFirstMessageInput',
  'setScriptFirstMessageInput',
  'scriptObjectiveTagsInput',
  'setScriptObjectiveTagsInput',
  'busyAction',
  'saveCallScriptDraft',
  'submitCallScriptForReview',
  'scriptReviewNoteInput',
  'setScriptReviewNoteInput',
  'reviewCallScript',
  'promoteCallScriptLive',
  'scriptSimulationVariablesInput',
  'setScriptSimulationVariablesInput',
  'simulateCallScript',
  'scriptSimulationResult',
  'asRecord',
  'runAction',
  'invokeAction',
] as const satisfies readonly (keyof DashboardVm)[];

const USERS_ROLE_VM_KEYS = [
  'isFeatureEnabled',
  'userSearch',
  'setUserSearch',
  'userSortBy',
  'setUserSortBy',
  'userSortDir',
  'setUserSortDir',
  'refreshUsersModule',
  'usersPayload',
  'usersRows',
  'roleReasonTemplates',
  'toInt',
  'toText',
  'formatTime',
  'handleApplyUserRole',
] as const satisfies readonly (keyof DashboardVm)[];

const AUDIT_INCIDENTS_VM_KEYS = [
  'refreshAuditModule',
  'hasCapability',
  'isFeatureEnabled',
  'runbookAction',
  'incidentsPayload',
  'incidentRows',
  'toInt',
  'toText',
  'asRecord',
  'formatTime',
  'runbookRows',
  'busyAction',
  'auditRows',
] as const satisfies readonly (keyof DashboardVm)[];

export type OpsPageVm = Pick<DashboardVm, typeof OPS_VM_KEYS[number]>;
export type SmsPageVm = Pick<DashboardVm, typeof SMS_VM_KEYS[number]>;
export type MailerPageVm = Pick<DashboardVm, typeof MAILER_VM_KEYS[number]>;
export type ProviderPageVm = Pick<DashboardVm, typeof PROVIDER_VM_KEYS[number]>;
export type ScriptStudioPageVm = Pick<DashboardVm, typeof SCRIPT_STUDIO_VM_KEYS[number]>;
export type UsersRolePageVm = Pick<DashboardVm, typeof USERS_ROLE_VM_KEYS[number]>;
export type AuditIncidentsPageVm = Pick<DashboardVm, typeof AUDIT_INCIDENTS_VM_KEYS[number]>;

const selectOpsPageVmMemoized = createMemoizedVmSelector(OPS_VM_KEYS);
const selectSmsPageVmMemoized = createMemoizedVmSelector(SMS_VM_KEYS);
const selectMailerPageVmMemoized = createMemoizedVmSelector(MAILER_VM_KEYS);
const selectProviderPageVmMemoized = createMemoizedVmSelector(PROVIDER_VM_KEYS);
const selectScriptStudioPageVmMemoized = createMemoizedVmSelector(SCRIPT_STUDIO_VM_KEYS);
const selectUsersRolePageVmMemoized = createMemoizedVmSelector(USERS_ROLE_VM_KEYS);
const selectAuditIncidentsPageVmMemoized = createMemoizedVmSelector(AUDIT_INCIDENTS_VM_KEYS);

export function selectOpsPageVm(vm: DashboardVm): OpsPageVm {
  return selectOpsPageVmMemoized(vm);
}

export function selectSmsPageVm(vm: DashboardVm): SmsPageVm {
  return selectSmsPageVmMemoized(vm);
}

export function selectMailerPageVm(vm: DashboardVm): MailerPageVm {
  return selectMailerPageVmMemoized(vm);
}

export function selectProviderPageVm(vm: DashboardVm): ProviderPageVm {
  return selectProviderPageVmMemoized(vm);
}

export function selectScriptStudioPageVm(vm: DashboardVm): ScriptStudioPageVm {
  return selectScriptStudioPageVmMemoized(vm);
}

export function selectUsersRolePageVm(vm: DashboardVm): UsersRolePageVm {
  return selectUsersRolePageVmMemoized(vm);
}

export function selectAuditIncidentsPageVm(vm: DashboardVm): AuditIncidentsPageVm {
  return selectAuditIncidentsPageVmMemoized(vm);
}
