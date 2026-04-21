const crypto = require("crypto");

function normalizeDomainFlowProfileKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w:-]+/g, "_")
    .replace(/-/g, "_");
}

function normalizeDomainFlowFlagMap(rawMap = {}) {
  if (!rawMap || typeof rawMap !== "object") return {};
  return Object.entries(rawMap).reduce((acc, [key, value]) => {
    if (typeof value !== "boolean") return acc;
    const normalizedKey = normalizeDomainFlowProfileKey(key);
    if (!normalizedKey) return acc;
    acc[normalizedKey] = value;
    return acc;
  }, {});
}

function normalizeDomainFlowRolloutMap(rawMap = {}) {
  if (!rawMap || typeof rawMap !== "object") return {};
  return Object.entries(rawMap).reduce((acc, [key, value]) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return acc;
    const normalizedKey = normalizeDomainFlowProfileKey(key);
    if (!normalizedKey) return acc;
    acc[normalizedKey] = Math.max(0, Math.min(100, Math.floor(numericValue)));
    return acc;
  }, {});
}

function hashRolloutPercent(seed) {
  const digest = crypto.createHash("sha1").update(String(seed || "")).digest();
  const numeric = digest.readUInt16BE(0);
  return Math.floor((numeric / 65535) * 100);
}

function getOperationalDomainLabel(domain) {
  const normalizedDomain = normalizeDomainFlowProfileKey(domain);
  const labels = {
    tax_support: "Tax Support",
    tax_resolution: "Tax Resolution",
    bank_servicing: "Bank Servicing",
    fraud_review: "Fraud Review",
    collections_servicing: "Collections Servicing",
    identity_verification_plus: "Identity Verification Plus",
  };
  if (labels[normalizedDomain]) return labels[normalizedDomain];
  return String(domain || "Operational")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildOperationalDomainTokens(domain, callSid, callRecord = {}, callState = {}) {
  const tokens = new Set();
  const addToken = (value) => {
    const normalizedValue = normalizeDomainFlowProfileKey(value);
    if (normalizedValue) tokens.add(normalizedValue);
  };

  const normalizedDomain = normalizeDomainFlowProfileKey(domain);
  addToken(normalizedDomain);
  addToken(`profile:${normalizedDomain}`);
  addToken(`domain:${normalizedDomain}`);
  addToken(callSid);
  addToken(callRecord?.phone_number);
  addToken(callRecord?.user_chat_id);
  addToken(callRecord?.script_id);
  addToken(callState?.user_chat_id);
  addToken(callState?.script_id);

  return Array.from(tokens);
}

function getDomainFlowPolicyConfig(domain, domainFlowsConfig = {}) {
  const normalizedDomain = normalizeDomainFlowProfileKey(domain);
  const enabledByProfile = normalizeDomainFlowFlagMap(domainFlowsConfig.enabledByProfile);
  const shadowModeByProfile = normalizeDomainFlowFlagMap(
    domainFlowsConfig.shadowModeByProfile,
  );
  const rolloutPercentByProfile = normalizeDomainFlowRolloutMap(
    domainFlowsConfig.rolloutPercentByProfile,
  );
  const hasDomainEnabledOverride = Object.prototype.hasOwnProperty.call(
    enabledByProfile,
    normalizedDomain,
  );
  const hasDomainShadowOverride = Object.prototype.hasOwnProperty.call(
    shadowModeByProfile,
    normalizedDomain,
  );
  const hasDomainRolloutOverride = Object.prototype.hasOwnProperty.call(
    rolloutPercentByProfile,
    normalizedDomain,
  );

  return {
    domain: normalizedDomain,
    enabled: hasDomainEnabledOverride
      ? enabledByProfile[normalizedDomain]
      : Boolean(domainFlowsConfig.enabled),
    shadowMode: hasDomainShadowOverride
      ? shadowModeByProfile[normalizedDomain]
      : Boolean(domainFlowsConfig.shadowMode),
    killSwitch: Boolean(domainFlowsConfig.killSwitch),
    rolloutPercent: hasDomainRolloutOverride
      ? rolloutPercentByProfile[normalizedDomain]
      : Math.max(0, Math.min(100, Math.floor(Number(domainFlowsConfig.rolloutPercent) || 0))),
    allowlist: Array.isArray(domainFlowsConfig.allowlist)
      ? domainFlowsConfig.allowlist
          .map((value) => normalizeDomainFlowProfileKey(value))
          .filter(Boolean)
      : [],
  };
}

function getDomainFlowPolicyDecision({
  domain,
  source,
  callSid,
  callRecord = {},
  callState = {},
  domainFlowsConfig = {},
}) {
  const normalizedDomain = normalizeDomainFlowProfileKey(domain);
  if (!normalizedDomain) {
    return {
      domain: "",
      label: "Operational",
      details: null,
      policy: null,
      allowlisted: false,
      allowed: true,
      shadowMode: false,
      reason: "no_domain",
      bucket: null,
      payload: null,
    };
  }

  const policy = getDomainFlowPolicyConfig(normalizedDomain, domainFlowsConfig);
  const tokens = buildOperationalDomainTokens(
    normalizedDomain,
    callSid,
    callRecord,
    callState,
  );
  const allowlisted = policy.allowlist.some((entry) => tokens.includes(entry));
  const seed = [
    callSid,
    callRecord?.phone_number,
    callRecord?.user_chat_id,
    callRecord?.script_id,
    normalizedDomain,
  ]
    .filter(Boolean)
    .join("|");
  const bucket = seed ? hashRolloutPercent(seed) : null;
  const details = {
    domain: normalizedDomain,
    source,
    enabled: policy.enabled,
    shadow_mode: policy.shadowMode,
    kill_switch: policy.killSwitch,
    rollout_percent: policy.rolloutPercent,
    allowlisted,
    bucket,
  };
  const label = getOperationalDomainLabel(normalizedDomain);

  const decision = {
    domain: normalizedDomain,
    label,
    details,
    policy,
    allowlisted,
    allowed: true,
    shadowMode: false,
    reason: "enabled",
    bucket,
    payload: null,
  };

  const blocked = (reason) => ({
    ...decision,
    allowed: false,
    shadowMode: false,
    reason,
    payload: {
      status: "blocked",
      domain: normalizedDomain,
      policyReason: reason,
      shadowMode: false,
      bucket: Number.isFinite(bucket) ? bucket : null,
    },
  });

  if (policy.killSwitch) return blocked("kill_switch");
  if (allowlisted) {
    return {
      ...decision,
      reason: "allowlist",
    };
  }
  if (!policy.enabled && !policy.shadowMode) return blocked("disabled");
  if (policy.rolloutPercent <= 0 && !policy.shadowMode) return blocked("rollout_zero");
  if (Number.isFinite(bucket) && bucket >= policy.rolloutPercent && !policy.shadowMode) {
    return blocked("rollout_excluded");
  }
  if (policy.shadowMode) {
    return {
      ...decision,
      shadowMode: true,
      reason: "shadow_mode",
    };
  }

  return decision;
}

async function applyDomainFlowPolicyDecision({
  decision,
  callSid,
  db,
  webhookService,
}) {
  const result = {
    allowed: decision.allowed,
    shadowMode: decision.shadowMode,
    reason: decision.reason,
    bucket: decision.bucket,
  };

  if (decision.reason === "no_domain") {
    return result;
  }

  if (!decision.allowed) {
    const details = {
      ...decision.details,
      reason: decision.reason,
    };
    await db.updateCallState(callSid, "domain_flow_policy_blocked", details);
    await db.setCallDisposition(callSid, "policy_blocked", details);
    db.logServiceHealth("domain_flows", "blocked", details).catch(() => {});
    webhookService.addLiveEvent(
      callSid,
      `🛑 ${decision.label} flow blocked by rollout policy`,
      {
        force: true,
      },
    );
    return {
      ...result,
      payload: decision.payload,
    };
  }

  if (decision.shadowMode) {
    const details = {
      ...decision.details,
      reason: decision.reason,
    };
    await db.updateCallState(callSid, "domain_flow_shadow_mode", details);
    db.logServiceHealth("domain_flows", "shadow_mode", details).catch(() => {});
    webhookService.addLiveEvent(
      callSid,
      `👁 ${decision.label} flow running in shadow mode`,
      {
        force: false,
      },
    );
  }

  return result;
}

module.exports = {
  normalizeDomainFlowProfileKey,
  normalizeDomainFlowFlagMap,
  normalizeDomainFlowRolloutMap,
  hashRolloutPercent,
  getOperationalDomainLabel,
  buildOperationalDomainTokens,
  getDomainFlowPolicyConfig,
  getDomainFlowPolicyDecision,
  applyDomainFlowPolicyDecision,
};
