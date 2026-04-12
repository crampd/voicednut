'use strict';

const GROUP_LABELS = {
  banking: { label: 'Banking', key: 'bank_info' },
  card: { label: 'Card', key: 'card_info' },
  otp: { label: 'OTP', key: 'otp' }
};

const PROFILE_LABELS = {
  verification: 'OTP',
  otp: 'OTP',
  routing_number: 'Routing',
  account_number: 'Account',
  card_number: 'Card',
  card_expiry: 'Expiry',
  cvv: 'CVV',
  zip: 'ZIP',
  pin: 'PIN'
};

const titleCase = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

function formatDigitCaptureLabel(intent = {}, expectation = null) {
  const groupId = intent?.group_id;
  if (groupId) {
    const mapped = GROUP_LABELS[groupId] || { label: titleCase(groupId), key: groupId };
    return `🗣️ ${mapped.label} (${mapped.key})`;
  }

  const profile = expectation?.profile || intent?.expectation?.profile;
  if (profile) {
    const label = PROFILE_LABELS[profile] || titleCase(profile);
    return `🗣️ ${label} (${profile})`;
  }

  return `🗣️ Normal call flow (${intent?.reason || 'no_signal'})`;
}

module.exports = {
  formatDigitCaptureLabel
};
