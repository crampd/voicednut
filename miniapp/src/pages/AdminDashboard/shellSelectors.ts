import type { CallScriptRow, ProviderMatrixRow, SmsRouteSimulationRow } from './types';

type ToIntFn = (value: unknown, fallback?: number) => number;
type SelectorParams = Record<string, unknown>;

function areSelectorParamsEqual(prev: SelectorParams, next: SelectorParams): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!Object.is(prev[key], next[key])) return false;
  }
  return true;
}

function createMemoizedSelector<Params extends SelectorParams, Result>(
  selector: (params: Params) => Result,
): (params: Params) => Result {
  let hasCachedResult = false;
  let cachedParams = {} as Params;
  let cachedResult = {} as Result;

  return (params: Params): Result => {
    if (hasCachedResult && areSelectorParamsEqual(cachedParams, params)) {
      return cachedResult;
    }
    const nextResult = selector(params);
    cachedParams = params;
    cachedResult = nextResult;
    hasCachedResult = true;
    return nextResult;
  };
}

export function selectCallScriptById(params: {
  callScripts: CallScriptRow[];
  selectedCallScriptId: number;
  toInt: ToIntFn;
}): CallScriptRow | null {
  const { callScripts, selectedCallScriptId, toInt } = params;
  return callScripts.find((script) => toInt(script.id) === selectedCallScriptId) || null;
}

export function selectSmsRouteSimulationRows(params: {
  providerMatrixRows: ProviderMatrixRow[];
}): SmsRouteSimulationRow[] {
  const { providerMatrixRows } = params;
  return providerMatrixRows
    .filter((row) => row.channel === 'sms')
    .map((row) => ({
      provider: row.provider,
      ready: row.ready,
      degraded: row.degraded,
      parityGapCount: row.parityGapCount,
    }));
}

export const selectCallScriptByIdMemoized = createMemoizedSelector(selectCallScriptById);
export const selectSmsRouteSimulationRowsMemoized =
  createMemoizedSelector(selectSmsRouteSimulationRows);
