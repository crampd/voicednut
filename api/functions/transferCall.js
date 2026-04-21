const ESCALATION_OUTCOME_ALIASES = Object.freeze({
  callback: 'callback',
  call_back: 'callback',
  review_case: 'review_case',
  review: 'review_case',
  case_review: 'review_case',
  route_to_agent: 'review_case',
  transfer: 'review_case',
  transfercall: 'review_case',
  transfer_call: 'review_case',
  handoff: 'review_case',
  specialist: 'review_case',
  secure_follow_up: 'secure_follow_up',
  securefollowup: 'secure_follow_up',
  follow_up: 'secure_follow_up',
  followup: 'secure_follow_up',
  followup_sms: 'secure_follow_up',
  sms: 'secure_follow_up',
  email: 'secure_follow_up',
});

function normalizeEscalationOutcome(value, fallback = 'review_case') {
  const normalized = String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return fallback;
  return ESCALATION_OUTCOME_ALIASES[normalized] || fallback;
}

const transferCall = async function (call = {}) {
  const requestedAction =
    call.action ||
    call.outcome ||
    call.escalation ||
    call.intent ||
    call.type ||
    'review_case';
  const action = normalizeEscalationOutcome(requestedAction, 'review_case');
  console.warn('transferCall compatibility shim invoked; live transfer disabled', {
    callSid: call.callSid || null,
    requestedAction,
    normalizedAction: action,
  });

  if (action === 'callback') {
    return 'Live transfer is unavailable. Tell the customer a callback has been requested and close the call politely.';
  }
  if (action === 'secure_follow_up') {
    return 'Live transfer is unavailable. Tell the customer a secure follow-up has been requested and close the call politely.';
  }
  return 'Live transfer is unavailable. Tell the customer their case will be reviewed and close the call politely.';
};

module.exports = transferCall;
