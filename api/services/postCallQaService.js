const crypto = require("crypto");

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

const DEFAULT_RUBRIC_WEIGHTS = Object.freeze({
  compliance: 0.35,
  resolution: 0.3,
  empathy: 0.2,
  clarity: 0.15,
});

const DEFAULT_PROFILE_THRESHOLDS = Object.freeze({
  collections: 78,
  support: 72,
  sales: 74,
  verification: 80,
  general: 70,
});

const PROFILE_ALIAS_MAP = Object.freeze({
  collection: "collections",
  payment_collection: "collections",
  customer_support: "support",
  customer_service: "support",
  helpdesk: "support",
  lead_gen: "sales",
  lead_generation: "sales",
  identity_verification: "verification",
  otp: "verification",
});

function normalizeProfileKey(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^\w-]+/g, "_");
  if (!normalized) return "";
  return PROFILE_ALIAS_MAP[normalized] || normalized;
}

function parseMaybeJsonObject(raw) {
  const source = normalizeText(raw);
  if (!source) return {};
  if (!(source.startsWith("{") && source.endsWith("}"))) return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function resolveCallProfile(call = {}) {
  const directCandidates = [
    call?.call_profile,
    call?.conversation_profile,
    call?.purpose,
    call?.profile,
    call?.flow_type,
  ];
  for (const candidate of directCandidates) {
    const profile = normalizeProfileKey(candidate);
    if (profile) return profile;
  }

  const businessContext = parseMaybeJsonObject(call?.business_context);
  const businessCandidates = [
    businessContext.call_profile,
    businessContext.conversation_profile,
    businessContext.purpose,
    businessContext.profile,
  ];
  for (const candidate of businessCandidates) {
    const profile = normalizeProfileKey(candidate);
    if (profile) return profile;
  }

  const aiAnalysis = parseMaybeJsonObject(call?.ai_analysis);
  const adaptationContext =
    aiAnalysis?.adaptation && typeof aiAnalysis.adaptation === "object"
      ? aiAnalysis.adaptation.businessContext
      : null;
  if (adaptationContext && typeof adaptationContext === "object") {
    const adaptationCandidates = [
      adaptationContext.call_profile,
      adaptationContext.conversation_profile,
      adaptationContext.purpose,
      adaptationContext.profile,
    ];
    for (const candidate of adaptationCandidates) {
      const profile = normalizeProfileKey(candidate);
      if (profile) return profile;
    }
  }

  return "general";
}

function normalizeRubricWeights(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const merged = {
    ...DEFAULT_RUBRIC_WEIGHTS,
    ...source,
  };
  const safe = {};
  let total = 0;
  for (const key of Object.keys(DEFAULT_RUBRIC_WEIGHTS)) {
    const weight = Math.max(0, toFiniteNumber(merged[key], 0));
    safe[key] = weight;
    total += weight;
  }
  if (total <= 0) {
    return { ...DEFAULT_RUBRIC_WEIGHTS };
  }
  for (const key of Object.keys(safe)) {
    safe[key] = Number((safe[key] / total).toFixed(4));
  }
  return safe;
}

function normalizeProfileThresholds(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = { ...DEFAULT_PROFILE_THRESHOLDS };
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeProfileKey(rawKey);
    if (!key) continue;
    const numeric = Math.max(0, Math.min(100, Math.floor(toFiniteNumber(rawValue, NaN))));
    if (!Number.isFinite(numeric)) continue;
    normalized[key] = numeric;
  }
  return normalized;
}

function normalizePostCallQaConfig(rawConfig = {}) {
  const cfg = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const rolloutPercent = Math.max(
    0,
    Math.min(100, Math.floor(toFiniteNumber(cfg.rolloutPercent, 0))),
  );
  const minTurns = Math.max(2, Math.floor(toFiniteNumber(cfg.minTurns, 4)));
  const minScore = Math.max(0, Math.min(100, Math.floor(toFiniteNumber(cfg.minScore, 70))));
  return {
    enabled: cfg.enabled === true,
    shadowMode: cfg.shadowMode !== false,
    killSwitch: cfg.killSwitch === true,
    rolloutPercent,
    allowlist: normalizeList(cfg.allowlist).map((entry) => entry.toLowerCase()),
    minTurns,
    minScore,
    version: normalizeText(cfg.version) || "post_call_qa_v1",
    rubricWeights: normalizeRubricWeights(cfg.rubricWeights || {}),
    profileThresholds: normalizeProfileThresholds(cfg.profileThresholds || {}),
  };
}

function hashPercent(seed) {
  const digest = crypto.createHash("sha1").update(String(seed || "")).digest();
  const numeric = digest.readUInt16BE(0);
  return Math.floor((numeric / 65535) * 100);
}

function buildEligibilityTokens(callSid, call = {}) {
  const tokens = new Set();
  const add = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized) tokens.add(normalized);
  };
  add(callSid);
  add(call?.phone_number);
  add(call?.user_chat_id);
  add(call?.script_id);
  return tokens;
}

function decidePostCallQaEligibility({ callSid, call = {}, config = {} }) {
  const cfg = normalizePostCallQaConfig(config);
  if (cfg.killSwitch) {
    return { eligible: false, reason: "kill_switch", config: cfg };
  }
  if (!cfg.enabled && !cfg.shadowMode) {
    return { eligible: false, reason: "disabled", config: cfg };
  }

  const tokens = buildEligibilityTokens(callSid, call);
  const allowlisted =
    cfg.allowlist.length > 0
      ? cfg.allowlist.some((entry) => tokens.has(entry))
      : false;
  if (allowlisted) {
    return { eligible: true, reason: "allowlist", config: cfg };
  }
  if (cfg.rolloutPercent <= 0) {
    return { eligible: false, reason: "rollout_zero", config: cfg };
  }
  const bucket = hashPercent(callSid);
  if (bucket >= cfg.rolloutPercent) {
    return { eligible: false, reason: "rollout_excluded", bucket, config: cfg };
  }
  return { eligible: true, reason: "rollout_included", bucket, config: cfg };
}

function toWords(message) {
  return normalizeText(message)
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
}

function countQuestionMarks(message) {
  return (String(message || "").match(/\?/g) || []).length;
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(toFiniteNumber(score, 0))));
}

function scoreCompliance({ profile, aiCombined }) {
  let score = 100;
  const findings = [];
  const recommendations = [];
  const highRiskPhrases = [
    /\bguaranteed\b/gi,
    /\blegal action\b/gi,
    /\blawsuit\b/gi,
    /\barrest\b/gi,
    /\bimmediately pay or\b/gi,
  ];
  const riskHits = highRiskPhrases.reduce(
    (sum, pattern) => sum + (aiCombined.match(pattern) || []).length,
    0,
  );
  if (riskHits > 0) {
    score -= Math.min(45, riskHits * 15);
    findings.push("risky_compliance_language");
    recommendations.push("remove_threatening_or_guaranteed_outcomes");
  }

  if (profile === "collections") {
    const collectionKeywords = /\b(balance|payment|due|amount|settle)\b/i;
    if (!collectionKeywords.test(aiCombined)) {
      score -= 12;
      findings.push("collections_context_missing");
      recommendations.push("include_balance_or_payment_context");
    }
  }

  return { score: clampScore(score), findings, recommendations };
}

function scoreResolution({
  totalTurns,
  userQuestions,
  aiQuestions,
  closingPresent,
  aiCombined,
}) {
  let score = 100;
  const findings = [];
  const recommendations = [];
  const unansweredQuestions = Math.max(0, userQuestions - aiQuestions);

  if (totalTurns < 6) {
    score -= 10;
    findings.push("short_conversation");
    recommendations.push("review_opening_and_follow_up_prompts");
  }
  if (unansweredQuestions > 1) {
    score -= 12;
    findings.push("unanswered_user_questions");
    recommendations.push("improve_question_resolution_rate");
  }
  if (!closingPresent) {
    score -= 8;
    findings.push("missing_call_closure");
    recommendations.push("add_clear_closing_language");
  }
  const actionSignals =
    (aiCombined.match(/\b(next step|follow up|confirm|scheduled|completed|resolved)\b/gi) || [])
      .length;
  if (actionSignals === 0) {
    score -= 10;
    findings.push("weak_resolution_signals");
    recommendations.push("state_clear_next_step_or_resolution");
  } else {
    score = Math.min(100, score + Math.min(6, actionSignals * 2));
  }

  return {
    score: clampScore(score),
    findings,
    recommendations,
    unansweredQuestions,
  };
}

function scoreEmpathy({ aiCombined, userCombined }) {
  let score = 100;
  const findings = [];
  const recommendations = [];
  const courtesyHits = [
    /\bplease\b/g,
    /\bthank you\b/g,
    /\bthanks\b/g,
    /\bi understand\b/g,
    /\bglad to help\b/g,
    /\bsorry\b/g,
  ].reduce((sum, pattern) => sum + (aiCombined.match(pattern) || []).length, 0);
  const userFrustrationSignals = (
    userCombined.match(/\b(frustrated|angry|upset|annoyed|terrible|bad)\b/gi) || []
  ).length;
  const aiEmpathySignals = (
    aiCombined.match(/\b(i understand|sorry|apologize|that sounds|i can help)\b/gi) || []
  ).length;

  if (courtesyHits === 0) {
    score -= 15;
    findings.push("low_courtesy_signals");
    recommendations.push("add_politeness_and_empathy_phrasing");
  } else {
    score = Math.min(100, score + Math.min(8, courtesyHits));
  }
  if (userFrustrationSignals > 0 && aiEmpathySignals === 0) {
    score -= 18;
    findings.push("missed_empathy_on_frustration");
    recommendations.push("acknowledge_customer_emotion_before_guidance");
  }

  return {
    score: clampScore(score),
    findings,
    recommendations,
    courtesyHits,
  };
}

function scoreClarity({ avgAiWords }) {
  let score = 100;
  const findings = [];
  const recommendations = [];
  if (avgAiWords > 34) {
    score -= 14;
    findings.push("long_ai_responses");
    recommendations.push("reduce_average_ai_response_length");
  }
  if (avgAiWords > 0 && avgAiWords < 4) {
    score -= 10;
    findings.push("overly_brief_ai_responses");
    recommendations.push("improve_ai_response_substance");
  }
  if (avgAiWords >= 6 && avgAiWords <= 26) {
    score = Math.min(100, score + 5);
  }
  return {
    score: clampScore(score),
    findings,
    recommendations,
  };
}

function evaluatePostCallQuality({
  callSid,
  call = {},
  transcripts = [],
  durationSeconds = 0,
  config = {},
}) {
  const cfg = normalizePostCallQaConfig(config);
  const profile = resolveCallProfile(call);
  const profileThreshold = Number.isFinite(Number(cfg.profileThresholds?.[profile]))
    ? Number(cfg.profileThresholds[profile])
    : cfg.minScore;
  const entries = Array.isArray(transcripts) ? transcripts : [];
  const normalized = entries
    .map((entry) => ({
      speaker: normalizeText(entry?.speaker).toLowerCase(),
      message: normalizeText(entry?.message),
    }))
    .filter((entry) => entry.message && (entry.speaker === "ai" || entry.speaker === "user"));
  const userTurns = normalized.filter((entry) => entry.speaker === "user");
  const aiTurns = normalized.filter((entry) => entry.speaker === "ai");
  const totalTurns = normalized.length;

  if (totalTurns < cfg.minTurns) {
    return {
      call_sid: callSid,
      status: "insufficient_transcript",
      score: null,
      passed: false,
      profile,
      version: cfg.version,
      shadow_mode: cfg.shadowMode === true,
      metrics: {
        total_turns: totalTurns,
        user_turns: userTurns.length,
        ai_turns: aiTurns.length,
        duration_seconds: Math.max(0, Math.floor(toFiniteNumber(durationSeconds, 0))),
        threshold_score: profileThreshold,
        rubric_weights: cfg.rubricWeights,
      },
      findings: ["insufficient_turns"],
      recommendations: ["collect_more_turns_before_scoring"],
    };
  }

  const aiWordCounts = aiTurns.map((entry) => toWords(entry.message).length).filter(Boolean);
  const avgAiWords = aiWordCounts.length
    ? aiWordCounts.reduce((sum, count) => sum + count, 0) / aiWordCounts.length
    : 0;

  const userQuestions = userTurns.reduce(
    (sum, entry) => sum + countQuestionMarks(entry.message),
    0,
  );
  const aiQuestions = aiTurns.reduce(
    (sum, entry) => sum + countQuestionMarks(entry.message),
    0,
  );
  const unansweredQuestions = Math.max(0, userQuestions - aiQuestions);

  const aiCombined = aiTurns.map((entry) => entry.message.toLowerCase()).join(" ");
  const userCombined = userTurns.map((entry) => entry.message.toLowerCase()).join(" ");
  const closingPresent = /\b(anything else|have a (great|good) day|goodbye|take care)\b/i.test(
    aiCombined,
  );

  const compliance = scoreCompliance({ profile, aiCombined });
  const resolution = scoreResolution({
    totalTurns,
    userQuestions,
    aiQuestions,
    closingPresent,
    aiCombined,
  });
  const empathy = scoreEmpathy({ aiCombined, userCombined });
  const clarity = scoreClarity({ avgAiWords });

  const weightedScore =
    compliance.score * cfg.rubricWeights.compliance +
    resolution.score * cfg.rubricWeights.resolution +
    empathy.score * cfg.rubricWeights.empathy +
    clarity.score * cfg.rubricWeights.clarity;

  const findings = new Set([
    ...compliance.findings,
    ...resolution.findings,
    ...empathy.findings,
    ...clarity.findings,
  ]);
  const recommendations = new Set([
    ...compliance.recommendations,
    ...resolution.recommendations,
    ...empathy.recommendations,
    ...clarity.recommendations,
  ]);

  if (userTurns.length === 0 || aiTurns.length === 0) {
    findings.add("one_sided_conversation");
    recommendations.add("verify_media_stream_and_turn_detection");
  }

  const score = clampScore(weightedScore);

  return {
    call_sid: callSid,
    status: "scored",
    score,
    passed: score >= profileThreshold,
    profile,
    version: cfg.version,
    shadow_mode: cfg.shadowMode === true,
    metrics: {
      total_turns: totalTurns,
      user_turns: userTurns.length,
      ai_turns: aiTurns.length,
      avg_ai_words_per_turn: Number(avgAiWords.toFixed(2)),
      user_question_marks: userQuestions,
      ai_question_marks: aiQuestions,
      unanswered_user_questions: unansweredQuestions,
      courtesy_signals: empathy.courtesyHits,
      closing_present: closingPresent,
      duration_seconds: Math.max(0, Math.floor(toFiniteNumber(durationSeconds, 0))),
      min_score_threshold: cfg.minScore,
      threshold_score: profileThreshold,
      component_scores: {
        compliance: compliance.score,
        resolution: resolution.score,
        empathy: empathy.score,
        clarity: clarity.score,
      },
      rubric_weights: cfg.rubricWeights,
      profile,
    },
    findings: Array.from(findings),
    recommendations: Array.from(recommendations),
  };
}

async function runPostCallQaEvaluation({
  callSid,
  call = {},
  transcripts = [],
  durationSeconds = 0,
  config = {},
  db = null,
  logger = console,
  force = false,
}) {
  const effectiveConfig = config?.postCallQa || config || {};
  const decision = force
    ? {
        eligible: true,
        reason: "manual_force",
        config: normalizePostCallQaConfig(effectiveConfig),
      }
    : decidePostCallQaEligibility({
        callSid,
        call,
        config: effectiveConfig,
      });

  if (!decision.eligible) {
    return {
      call_sid: callSid,
      status: "skipped",
      reason: decision.reason,
      shadow_mode: decision.config.shadowMode === true,
      persisted: false,
    };
  }

  const report = evaluatePostCallQuality({
    callSid,
    call,
    transcripts,
    durationSeconds,
    config: decision.config,
  });

  if (db && typeof db.upsertCallQualityReport === "function") {
    try {
      await db.upsertCallQualityReport(report);
      return { ...report, persisted: true, evaluation_reason: decision.reason };
    } catch (error) {
      logger?.error?.("post_call_qa_persist_failed", {
        call_sid: callSid,
        error: error?.message || "persist_failed",
      });
      return {
        ...report,
        persisted: false,
        persist_error: error?.message || "persist_failed",
        evaluation_reason: decision.reason,
      };
    }
  }

  return { ...report, persisted: false, evaluation_reason: decision.reason };
}

module.exports = {
  normalizePostCallQaConfig,
  decidePostCallQaEligibility,
  evaluatePostCallQuality,
  runPostCallQaEvaluation,
  resolveCallProfile,
};
