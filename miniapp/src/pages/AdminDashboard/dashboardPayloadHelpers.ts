import type { ActionRequestMeta } from '@/hooks/admin-dashboard/useDashboardActions';
import type { DashboardApiError } from '@/services/admin-dashboard/dashboardApiClient';
import { asRecord, toText } from '@/services/admin-dashboard/dashboardPrimitives';
import { inferMiniAppErrorCodeFromMessage } from '@/services/admin-dashboard/dashboardSessionErrors';

import type { DashboardModule } from '@/pages/AdminDashboard/dashboardShellConfig';
import type {
  AuditRow,
  CallLogRow,
  CallScriptRow,
  DlqCallRow,
  DlqEmailRow,
  EmailJob,
  IncidentRow,
  OpsQaSummary,
  RunbookRow,
  UserRow,
} from '@/pages/AdminDashboard/types';

const ACTION_REQUEST_TIMEOUT_MS = 15000;

type OpsQaTrendPoint = {
  bucket: string;
  total: number;
  passed: number;
  passRate: number;
  avgScore: number | null;
};

type OpsQaLowScoreCall = {
  callSid: string;
  profile: string;
  status: string;
  score: number | null;
  passed: boolean;
  shadowMode: boolean;
  evaluatedAt: string;
};

function asRecordList<T extends object>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asRecord(entry) as T);
}

export function createActionRequestMeta(action: string, moduleId: DashboardModule): ActionRequestMeta {
  const nonce = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  const actionId = `${action}:${ts}:${nonce}`;
  return {
    action_id: actionId,
    request_id: actionId,
    idempotency_key: actionId,
    requested_at: new Date(ts).toISOString(),
    request_timeout_ms: ACTION_REQUEST_TIMEOUT_MS,
    source: 'miniapp_admin_console',
    ui_module: moduleId,
  };
}

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toText(entry, ''))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function asDlqCallRows(value: unknown): DlqCallRow[] {
  return asRecordList<DlqCallRow>(value);
}

export function asDlqEmailRows(value: unknown): DlqEmailRow[] {
  return asRecordList<DlqEmailRow>(value);
}

export function asEmailJobs(value: unknown): EmailJob[] {
  return asRecordList<EmailJob>(value);
}

export function asCallLogRows(value: unknown): CallLogRow[] {
  return asRecordList<CallLogRow>(value);
}

export function asCallScripts(value: unknown): CallScriptRow[] {
  return asRecordList<CallScriptRow>(value);
}

export function asMiniAppUsers(value: unknown): UserRow[] {
  return asRecordList<UserRow>(value);
}

export function asAuditRows(value: unknown): AuditRow[] {
  return asRecordList<AuditRow>(value);
}

export function asIncidentRows(value: unknown): IncidentRow[] {
  return asRecordList<IncidentRow>(value);
}

export function asRunbooks(value: unknown): RunbookRow[] {
  return asRecordList<RunbookRow>(value);
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function getDashboardErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const directCode = toText((error as DashboardApiError).code, '').trim();
  if (directCode) return directCode;
  return inferMiniAppErrorCodeFromMessage(error.message || '');
}

export function asOpsQaSummary(value: unknown): OpsQaSummary | null {
  const payload = asRecord(value);
  if (Object.keys(payload).length === 0) return null;

  const totals = asRecord(payload.totals);
  const total = Math.max(0, Math.floor(toFiniteNumber(totals.total, 0)));
  const passed = Math.max(0, Math.floor(toFiniteNumber(totals.passed, 0)));
  const passRateRaw = toFiniteNumber(totals.pass_rate, NaN);
  const passRate = Number.isFinite(passRateRaw)
    ? Number(Math.max(0, Math.min(100, passRateRaw)).toFixed(2))
    : total > 0
      ? Number(((passed / total) * 100).toFixed(2))
      : 0;
  const avgScoreRaw = toFiniteNumber(totals.avg_score, NaN);
  const avgScore = Number.isFinite(avgScoreRaw)
    ? Number(Math.max(0, Math.min(100, avgScoreRaw)).toFixed(2))
    : null;

  const topFindings = Array.isArray(payload.top_findings)
    ? payload.top_findings
      .map((entry) => {
        const finding = toText(asRecord(entry).finding, '').trim();
        const count = Math.max(0, Math.floor(toFiniteNumber(asRecord(entry).count, 0)));
        return finding ? { finding, count } : null;
      })
      .filter((entry): entry is { finding: string; count: number } => entry !== null)
      .slice(0, 8)
    : [];

  const profileBreakdown = Array.isArray(payload.profile_breakdown)
    ? payload.profile_breakdown
      .map((entry) => {
        const row = asRecord(entry);
        const profile = toText(row.profile, 'general');
        const rowTotal = Math.max(0, Math.floor(toFiniteNumber(row.total, 0)));
        const rowPassed = Math.max(0, Math.floor(toFiniteNumber(row.passed, 0)));
        const rowPassRateRaw = toFiniteNumber(row.pass_rate, NaN);
        const rowPassRate = Number.isFinite(rowPassRateRaw)
          ? Number(Math.max(0, Math.min(100, rowPassRateRaw)).toFixed(2))
          : rowTotal > 0
            ? Number(((rowPassed / rowTotal) * 100).toFixed(2))
            : 0;
        const rowAvgScoreRaw = toFiniteNumber(row.avg_score, NaN);
        const rowAvgScore = Number.isFinite(rowAvgScoreRaw)
          ? Number(Math.max(0, Math.min(100, rowAvgScoreRaw)).toFixed(2))
          : null;
        return {
          profile,
          total: rowTotal,
          passed: rowPassed,
          passRate: rowPassRate,
          avgScore: rowAvgScore,
        };
      })
      .slice(0, 8)
    : [];

  const trendSeries = Array.isArray(payload.trend_series)
    ? payload.trend_series
      .map((entry) => {
        const row = asRecord(entry);
        const bucket = toText(row.bucket, '').trim();
        if (!bucket) return null;
        const rowTotal = Math.max(0, Math.floor(toFiniteNumber(row.total, 0)));
        const rowPassed = Math.max(0, Math.floor(toFiniteNumber(row.passed, 0)));
        const rowPassRateRaw = toFiniteNumber(row.pass_rate, NaN);
        const rowPassRate = Number.isFinite(rowPassRateRaw)
          ? Number(Math.max(0, Math.min(100, rowPassRateRaw)).toFixed(2))
          : rowTotal > 0
            ? Number(((rowPassed / rowTotal) * 100).toFixed(2))
            : 0;
        const rowAvgScoreRaw = toFiniteNumber(row.avg_score, NaN);
        const rowAvgScore = Number.isFinite(rowAvgScoreRaw)
          ? Number(Math.max(0, Math.min(100, rowAvgScoreRaw)).toFixed(2))
          : null;
        return {
          bucket,
          total: rowTotal,
          passed: rowPassed,
          passRate: rowPassRate,
          avgScore: rowAvgScore,
        };
      })
      .filter((entry): entry is OpsQaTrendPoint => entry !== null)
      .slice(-14)
    : [];

  const profileThresholds: Record<string, number> = {};
  const thresholdPayload = asRecord(payload.profile_thresholds);
  for (const [rawProfile, rawThreshold] of Object.entries(thresholdPayload)) {
    const profile = toText(rawProfile, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w-]+/g, '_');
    const threshold = toFiniteNumber(rawThreshold, NaN);
    if (!profile || !Number.isFinite(threshold)) continue;
    profileThresholds[profile] = Number(Math.max(0, Math.min(100, threshold)).toFixed(2));
  }
  if (!Object.prototype.hasOwnProperty.call(profileThresholds, 'default')) {
    profileThresholds.default = 70;
  }

  const lowScoreCalls = Array.isArray(payload.low_score_calls)
    ? payload.low_score_calls
      .map((entry) => {
        const row = asRecord(entry);
        const callSid = toText(row.call_sid, '').trim();
        if (!callSid) return null;
        const scoreRaw = toFiniteNumber(row.score, NaN);
        return {
          callSid,
          profile: toText(row.profile, 'general'),
          status: toText(row.status, 'unknown'),
          score: Number.isFinite(scoreRaw)
            ? Number(Math.max(0, Math.min(100, scoreRaw)).toFixed(2))
            : null,
          passed: row.passed === true,
          shadowMode: row.shadow_mode === true,
          evaluatedAt: toText(row.evaluated_at, ''),
        };
      })
      .filter((entry): entry is OpsQaLowScoreCall => entry !== null)
      .slice(0, 10)
    : [];

  return {
    windowHours: Math.max(1, Math.floor(toFiniteNumber(payload.window_hours, 24 * 7))),
    total,
    passed,
    passRate,
    avgScore,
    scored: Math.max(0, Math.floor(toFiniteNumber(totals.scored, 0))),
    insufficientTranscript: Math.max(0, Math.floor(toFiniteNumber(totals.insufficient_transcript, 0))),
    skipped: Math.max(0, Math.floor(toFiniteNumber(totals.skipped, 0))),
    trendBucket: toText(payload.trend_bucket, 'day'),
    trendSeries,
    topFindings,
    profileBreakdown,
    profileThresholds,
    lowScoreCalls,
    updatedAt: toText(payload.updated_at, ''),
  };
}
