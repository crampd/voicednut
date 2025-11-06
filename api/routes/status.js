const axios = require('axios');
const {
  formatSummary,
  decryptDigits,
  getStageDefinition,
  normalizeStage,
  isSensitiveStage,
} = require('../utils/dtmf');

function parseDtmfMetadata(metadata) {
  if (!metadata) {
    return {};
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }
  try {
    return JSON.parse(metadata);
  } catch (error) {
    console.warn('Failed to parse DTMF metadata payload:', error.message);
    return { raw: metadata };
  }
}

function parseCallMetadata(metadata) {
  if (!metadata) {
    return null;
  }
  if (typeof metadata === 'object') {
    return metadata;
  }
  try {
    return JSON.parse(metadata);
  } catch (error) {
    console.warn('Failed to parse call metadata payload:', error.message);
    return null;
  }
}

const HUMAN_AMD_VALUES = new Set(['human', 'person', 'live', 'positive_human']);
const MACHINE_AMD_VALUES = new Set(['machine', 'machine_start', 'fax', 'positive_machine', 'unknown_machine', 'answering_machine', 'automated']);

function maskPhoneNumber(phone = '') {
  if (!phone) {
    return 'Unknown';
  }
  const trimmed = phone.toString().trim();
  if (trimmed.length <= 6) {
    return trimmed;
  }
  const prefix = trimmed.slice(0, 2);
  const suffix = trimmed.slice(-4);
  const maskLength = Math.max(1, trimmed.length - (prefix.length + suffix.length));
  return `${prefix}${'•'.repeat(maskLength)}${suffix}`;
}

function formatDurationShort(seconds = 0) {
  const total = Number(seconds) || 0;
  if (total <= 0) {
    return '0s';
  }
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function formatAnsweredLabel(value) {
  if (!value) {
    return 'unknown';
  }
  const normalized = value.toString().trim().toLowerCase();
  if (HUMAN_AMD_VALUES.has(normalized)) {
    return 'human';
  }
  if (MACHINE_AMD_VALUES.has(normalized)) {
    return 'machine';
  }
  return normalized.replace(/_/g, ' ') || 'unknown';
}

function formatDtmfEntries(entries = []) {
  const revealRaw = true;
  return entries.map((entry) => {
    const stageKey = normalizeStage(entry.stage_key || 'generic');
    const metadata = parseDtmfMetadata(entry.metadata);
    const stageDefinition = getStageDefinition(stageKey);
    const decrypted = entry.encrypted_digits ? decryptDigits(entry.encrypted_digits) : null;
    const rawDigits = revealRaw ? decrypted : null;
    const label = metadata.stage_label || stageDefinition.label || stageKey || 'Entry';
    return {
      id: entry.id,
      call_sid: entry.call_sid,
      stage_key: stageKey,
      label,
      digits: rawDigits || entry.masked_digits,
      raw_digits: rawDigits || null,
      masked_digits: entry.masked_digits,
      received_at: entry.received_at,
      compliance_mode: entry.compliance_mode,
      provider: entry.provider,
      metadata,
    };
  });
}

function sanitizeTelegramText(message = '') {
  const raw = message == null ? '' : String(message);
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?/gi, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildTelegramMessage(lines = []) {
  return lines.filter(Boolean).join('\n');
}

function isSensitiveDtmf(entries = []) {
  return entries.some((entry) => isSensitiveStage(entry.stage_key));
}

class EnhancedWebhookService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.db = null;
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    this.processInterval = 3000; // Check every 3 seconds for faster updates
    this.activeCallStatus = new Map(); // Track call status to avoid duplicates
    this.callTimestamps = new Map(); // Track call timing for better status management
    this.statusOrder = ['queued', 'initiated', 'ringing', 'in-progress', 'answered', 'completed', 'busy', 'no-answer', 'failed', 'canceled'];
  }

  start(database) {
    this.db = database;
    
    if (!this.telegramBotToken) {
      console.warn('TELEGRAM_BOT_TOKEN not configured. Enhanced webhook service disabled.'.yellow);
      return;
    }

    if (this.isRunning) {
      console.log('Enhanced webhook service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting enhanced webhook service with no-answer detection...'.green);
    
    // Start processing notifications
    this.interval = setInterval(() => {
      this.processNotifications();
    }, this.processInterval);

    // Process immediately
    this.processNotifications();
    
    // Cleanup old call data every 30 minutes
    setInterval(() => {
      this.cleanupOldCallData();
    }, 30 * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.activeCallStatus.clear();
    this.callTimestamps.clear();
    console.log('Enhanced webhook service stopped'.yellow);
  }

  // Track call progression and prevent out-of-order status updates
  shouldSendStatus(call_sid, newStatus) {
    const currentStatusInfo = this.activeCallStatus.get(call_sid);
    
    if (!currentStatusInfo) {
      // First status for this call
      this.activeCallStatus.set(call_sid, {
        lastStatus: newStatus,
        timestamp: new Date(),
        statusHistory: [newStatus]
      });
      return true;
    }

    const { lastStatus, statusHistory } = currentStatusInfo;
    
    // Don't send duplicate status
    if (lastStatus === newStatus) {
      console.log(`⏭️ Skipping duplicate status ${newStatus} for call ${call_sid}`.gray);
      return false;
    }

    // Check if this is a valid status progression
    const currentIndex = this.statusOrder.indexOf(lastStatus);
    const newIndex = this.statusOrder.indexOf(newStatus);

    // Allow backwards progression for failure states
    const failureStates = ['busy', 'no-answer', 'failed', 'canceled'];
    const isFailureTransition = failureStates.includes(newStatus);
    
    // Allow progression if moving forward or transitioning to failure state
    if (newIndex > currentIndex || isFailureTransition) {
      // Update status tracking
      currentStatusInfo.lastStatus = newStatus;
      currentStatusInfo.timestamp = new Date();
      currentStatusInfo.statusHistory.push(newStatus);
      this.activeCallStatus.set(call_sid, currentStatusInfo);
      return true;
    }

    console.log(`⏭️ Skipping out-of-order status ${newStatus} (current: ${lastStatus}) for call ${call_sid}`.gray);
    return false;
  }

  async processNotifications() {
    if (!this.db || !this.telegramBotToken) return;

    if (!this.db.isInitialized) {
      return;
    }

    try {
      const notifications = await this.db.getEnhancedPendingWebhookNotifications(50);
      
      if (notifications.length === 0) return;

      for (const notification of notifications) {
        try {
          await this.sendNotification(notification);
          // Small delay between notifications to prevent rate limiting
          await this.delay(150);
        } catch (error) {
          console.error(`❌ Failed to send notification ${notification.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Error processing notifications:', error);
    }
  }

  // Enhanced call status update with proper no-answer detection
  async sendCallStatusUpdate(call_sid, status, telegram_chat_id, additionalData = {}) {
    try {
      // Check if we should send this status
      if (!this.shouldSendStatus(call_sid, status)) {
        return true; // Return success to mark notification as processed
      }

      const normalizedStatus = status.toLowerCase();
      let message = '';
      let emoji = '';
      let allowTranscript = additionalData.sensitive_dtmf ? false : true;
      
      // Track call timing for duration calculations
      if (!this.callTimestamps.has(call_sid)) {
        this.callTimestamps.set(call_sid, { started: new Date() });
      }
      const callTiming = this.callTimestamps.get(call_sid);

      switch (normalizedStatus) {
        case 'queued':
        case 'initiated':
          emoji = '📞';
          message = 'Initiating call...';
          callTiming.initiated = new Date();
          break;
          
        case 'ringing':
          emoji = '🔔';
          message = 'Ringing...';
          callTiming.ringing = new Date();
          // Calculate time to ring
          if (callTiming.initiated) {
            const ringDelay = ((new Date() - callTiming.initiated) / 1000).toFixed(1);
            if (ringDelay > 2) {
              message += ` (${ringDelay}s)`;
            }
          }
          break;
          
        case 'in-progress':
        case 'answered':
          emoji = '☎️';
          message = 'In progress';
          callTiming.answered = new Date();
          // Calculate ring duration
          if (callTiming.ringing) {
            const ringDuration = ((new Date() - callTiming.ringing) / 1000).toFixed(0);
            message += ` (rang ${ringDuration}s)`;
          }
          break;
          
        case 'completed':
          emoji = '🏁';
          callTiming.completed = new Date();
          
          // Calculate call duration - be more careful about actual vs ring time
          let duration = '';
          const actualDuration = additionalData.duration;
          
          if (actualDuration && actualDuration > 3) {
            const minutes = Math.floor(actualDuration / 60);
            const seconds = actualDuration % 60;
            duration = ` (${minutes}:${String(seconds).padStart(2, '0')})`;
          } else if (callTiming.answered) {
            const totalTime = ((new Date() - callTiming.answered) / 1000).toFixed(0);
            if (totalTime > 3) {
              const minutes = Math.floor(totalTime / 60);
              const seconds = totalTime % 60;
              duration = ` (~${minutes}:${String(seconds).padStart(2, '0')})`;
            }
          }
          
          message = `Call completed${duration}`;
          break;
          
        case 'busy':
          emoji = '📵';
          message = 'Line busy';
          // Calculate time before busy signal
          if (callTiming.ringing || callTiming.initiated) {
            const busyTime = callTiming.ringing || callTiming.initiated;
            const timeBeforeBusy = ((new Date() - busyTime) / 1000).toFixed(0);
            if (timeBeforeBusy > 1) {
              message += ` (${timeBeforeBusy}s)`;
            }
          }
          break;
          
        case 'no-answer':
        case 'no_answer':
          emoji = '❌';
          message = 'No answer. The call attempt was completed with no response.';
          
          // Enhanced no-answer timing calculation
          let ringTime = 0;
          
          if (additionalData.ring_duration) {
            // Use ring duration from database if available
            ringTime = additionalData.ring_duration;
            console.log(`📞 Using database ring duration: ${ringTime}s`.cyan);
          } else if (callTiming.ringing) {
            // Calculate from our timing data
            ringTime = Math.round((new Date() - callTiming.ringing) / 1000);
            console.log(`📞 Calculated ring duration: ${ringTime}s`.cyan);
          } else if (callTiming.initiated) {
            // Fall back to total time since call started
            ringTime = Math.round((new Date() - callTiming.initiated) / 1000);
            console.log(`📞 Using total call time: ${ringTime}s`.cyan);
          }
          
          if (ringTime > 0) {
            message += ` (rang ${ringTime}s)`;
          }
          
          allowTranscript = false;
          console.log(`📞 No-answer notification: ${message}`.yellow);
          break;
          
        case 'failed':
          emoji = '❌';
          message = 'Call failed';
          if (additionalData.error || additionalData.error_message) {
            const errorMsg = additionalData.error || additionalData.error_message;
            message += ` (${errorMsg})`;
          }
          break;
          
        case 'canceled':
          emoji = '🚫';
          message = 'Call canceled';
          break;
          
        default:
          emoji = '📱';
          message = `Call ${status}`;
      }

      const fullMessage = `${emoji} ${message}`;
      
      const isTerminal = ['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(normalizedStatus);
      const followUpKeyboard = isTerminal ? this.buildCallFollowUpKeyboard(call_sid, normalizedStatus, { allowTranscript }) : null;

      let messageText = fullMessage;
      if (followUpKeyboard) {
        messageText += '\n\n⚡ Quick actions:';
      }

      await this.sendTelegramMessage(telegram_chat_id, messageText, 'HTML', followUpKeyboard);
      console.log(`✅ Sent enhanced status update: ${normalizedStatus} for call ${call_sid}`.green);
      
      // Log notification metric
      if (this.db && this.db.logNotificationMetric) {
        await this.db.logNotificationMetric(`call_${normalizedStatus}`, true);
      }

      // Schedule cleanup for terminal states
      if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(normalizedStatus)) {
        setTimeout(() => {
          this.cleanupCallData(call_sid);
        }, 5 * 60 * 1000); // Cleanup after 5 minutes
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to send enhanced call status update:', error);
      
      // Log failed notification metric
      if (this.db && this.db.logNotificationMetric) {
        await this.db.logNotificationMetric(`call_${status.toLowerCase()}`, false);
      }
      
      return false;
    }
  }

  // Enhanced transcript sending with better formatting
  async sendCallTranscript(call_sid, telegram_chat_id) {
    try {
      const callDetails = await this.db.getCall(call_sid);
      const transcripts = await this.db.getCallTranscripts(call_sid);
      const dtmfEntries = await this.db.getCallDtmfEntries(call_sid);
      const formattedDtmf = formatDtmfEntries(dtmfEntries);
      const dtmfSummary = dtmfEntries.length ? formatSummary(dtmfEntries) : { summaryLines: [], containsRaw: false };
      
      if (!callDetails || !transcripts || transcripts.length === 0) {
        await this.sendTelegramMessage(telegram_chat_id, buildTelegramMessage([
          '📋 No transcript available for this call'
        ]));
        return true;
      }

      const lines = [];
      lines.push('📋 Call Transcript');
      lines.push('');
      lines.push(`Phone: ${callDetails.phone_number || 'Unknown'}`);

      if (callDetails.duration && callDetails.duration > 0) {
        const minutes = Math.floor(callDetails.duration / 60);
        const seconds = callDetails.duration % 60;
        lines.push(`Duration: ${minutes}:${String(seconds).padStart(2, '0')}`);
      }

      if (callDetails.started_at) {
        const startTime = new Date(callDetails.started_at).toLocaleTimeString();
        lines.push(`Time: ${startTime}`);
      }

      lines.push(`Messages: ${transcripts.length}`);

      if (callDetails.status) {
        const statusEmoji = this.getStatusEmoji(callDetails.status);
        lines.push(`Status: ${statusEmoji} ${callDetails.status}`);
      }

      if (formattedDtmf.length > 0) {
        const latestEntry = formattedDtmf[formattedDtmf.length - 1];
        const timestamp = latestEntry?.received_at ? new Date(latestEntry.received_at).toLocaleTimeString() : null;
        const metadata = latestEntry?.metadata || {};
        const providerLabel = (metadata.source || latestEntry?.provider || 'unknown').toString().toUpperCase();

        lines.push('');
        lines.push('Keypad Entries:');
        dtmfSummary.summaryLines.forEach((line) => lines.push(`• ${line}`));

        const notes = [];
        notes.push(`Entries captured: ${formattedDtmf.length}`);
        if (timestamp) {
          notes.push(`Last updated ${timestamp}`);
        }
        if (providerLabel) {
          notes.push(`Source: ${providerLabel}`);
        }
        lines.push(notes.join(' • '));
        lines.push(
          dtmfSummary.containsRaw
            ? '🚧 Dev compliance mode — raw digits displayed.'
            : 'Digits masked per active compliance policy.'
        );
      }

      lines.push('');
      lines.push('Conversation:');

      const maxMessages = 12;
      for (let i = 0; i < Math.min(transcripts.length, maxMessages); i++) {
        const entry = transcripts[i];
        const speakerLabel = entry.speaker === 'user' ? '👤 Customer' : '🤖 AI';
        const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : null;
        const messageText = entry.clean_message || entry.message || entry.raw_message || '';
        const body = messageText.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
        lines.push(timestamp ? `${speakerLabel} (${timestamp}):` : `${speakerLabel}:`);
        lines.push(body);
      }

      if (transcripts.length > maxMessages) {
        lines.push(`… and ${transcripts.length - maxMessages} more messages`);
        lines.push(`Use /transcript ${call_sid} for full details.`);
      }

      if (callDetails.call_summary) {
        lines.push('');
        lines.push('Summary:');
        lines.push(callDetails.call_summary);
      }

      const messageText = buildTelegramMessage(lines);

      if (messageText.length > 4000) {
        const chunks = this.splitMessage(messageText, 3900);
        for (let i = 0; i < chunks.length; i++) {
          await this.sendTelegramMessage(telegram_chat_id, chunks[i]);
          if (i < chunks.length - 1) {
            await this.delay(1500);
          }
        }
      } else {
        await this.sendTelegramMessage(telegram_chat_id, messageText);
      }

      console.log(`✅ Sent enhanced transcript for call ${call_sid}`.green);

      if (this.db && this.db.logNotificationMetric) {
        await this.db.logNotificationMetric('call_transcript', true);
      }

      return true;

    } catch (error) {
      console.error('❌ Failed to send enhanced call transcript:', error);

      if (this.db && this.db.logNotificationMetric) {
        await this.db.logNotificationMetric('call_transcript', false);
      }

      try {
        await this.sendTelegramMessage(telegram_chat_id, '❌ Error retrieving call transcript');
      } catch (fallbackError) {
        console.error('Failed to send error message:', fallbackError);
      }

      return false;
    }
  }

  async sendCallInputNotification(call_sid, telegram_chat_id) {
    try {
      const entries = await this.db.getCallDtmfEntries(call_sid);

      if (!entries || entries.length === 0) {
        await this.sendTelegramMessage(
          telegram_chat_id,
          buildTelegramMessage(['🔢 Keypad entry notification received but no digits were captured.'])
        );
        return true;
      }

      const formattedEntries = formatDtmfEntries(entries);
      const { summaryLines, containsRaw } = formatSummary(entries);
      const latestEntry = formattedEntries[formattedEntries.length - 1];
      const timestamp = latestEntry?.received_at ? new Date(latestEntry.received_at).toLocaleTimeString() : null;
      const metadata = latestEntry?.metadata || {};
      const sourceLabel = (metadata.source || latestEntry?.provider || 'unknown').toString().toUpperCase();

      const lines = [];
      lines.push(containsRaw ? '⚠️ Keypad Summary' : '🔢 Keypad Summary');
      lines.push('');

      if (summaryLines.length > 0) {
        summaryLines.forEach((line) => lines.push(line));
      } else {
        lines.push('No keypad digits recorded.');
      }

      if (timestamp || sourceLabel) {
        const metaSegments = [];
        if (timestamp) {
          metaSegments.push(`Last updated ${timestamp}`);
        }
        if (sourceLabel) {
          metaSegments.push(`Source: ${sourceLabel}`);
        }
        if (metaSegments.length) {
          lines.push('');
          lines.push(metaSegments.join(' • '));
        }
      }

      lines.push('');
      lines.push(
        containsRaw
          ? '🚧 Dev compliance mode — raw digits displayed. Handle with care.'
          : 'Digits masked per active compliance policy.'
      );

      await this.sendTelegramMessage(telegram_chat_id, buildTelegramMessage(lines));

      if (this.db && this.db.logNotificationMetric) {
        await this.db.logNotificationMetric('call_input_dtmf', true);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to send keypad input notification:', error);
      if (this.db && this.db.logNotificationMetric) {
        await this.db.logNotificationMetric('call_input_dtmf', false);
      }
      try {
        await this.sendTelegramMessage(telegram_chat_id, '❌ Error delivering keypad entry details');
      } catch (fallbackError) {
        console.error('Failed to send fallback keypad message:', fallbackError);
      }
      return false;
    }
  }

  async sendCallInputSummary(call_sid, telegram_chat_id) {
    try {
      const [inputs, callDetails, dtmfEntries] = await Promise.all([
        this.db.getCallInputs(call_sid),
        this.db.getCall(call_sid),
        this.db.getCallDtmfEntries(call_sid),
      ]);

      const hasInputs = Array.isArray(inputs) && inputs.length > 0;
      const hasDtmfEntries = Array.isArray(dtmfEntries) && dtmfEntries.length > 0;

      if (!hasInputs && !hasDtmfEntries) {
        await this.sendTelegramMessage(
          telegram_chat_id,
          buildTelegramMessage(['🔢 No keypad inputs were collected for this call.'])
        );
        return true;
      }

      const metadata = parseCallMetadata(callDetails?.metadata_json) || {};
      const sequence = Array.isArray(metadata?.input_sequence) ? metadata.input_sequence : [];

      const lines = ['📥 Call Input Summary', ''];

      if (hasInputs) {
        inputs.forEach((input) => {
          const stepConfig = sequence[input.step - 1] || {};
          const label = stepConfig.label || `Step ${input.step}`;
          lines.push(`${label}: ${input.value}`);
        });
      } else {
        const { summaryLines, containsRaw } = formatSummary(dtmfEntries);
        if (summaryLines.length > 0) {
          summaryLines.forEach((line) => lines.push(line));
        } else {
          lines.push('No keypad digits recorded.');
        }
        lines.push('');
        lines.push(
          containsRaw
            ? '🚧 Dev compliance mode — raw digits displayed. Handle with care.'
            : 'Digits masked per active compliance policy.'
        );
      }

      await this.sendTelegramMessage(telegram_chat_id, buildTelegramMessage(lines));
      return true;
    } catch (error) {
      console.error('❌ Failed to send call input summary:', error);
      try {
        await this.sendTelegramMessage(telegram_chat_id, '❌ Error delivering call input summary');
      } catch (fallbackError) {
        console.error('Failed to send fallback summary message:', fallbackError);
      }
      return false;
    }
  }

  async getLatestInputPreview(call_sid, call) {
    if (call?.latest_input_preview) {
      return call.latest_input_preview;
    }
    const entries = await this.db.getCallDtmfEntries(call_sid);
    if (!entries.length) {
      return null;
    }
    const latest = entries[entries.length - 1];
    return decryptDigits(latest.encrypted_digits) || latest.masked_digits || null;
  }

  async buildInputDetails(call_sid) {
    const entries = await this.db.getCallDtmfEntries(call_sid);
    const lines = [];

    entries.forEach((entry) => {
      const metadata = parseDtmfMetadata(entry.metadata);
      const label = metadata.stage_label || entry.stage_key || 'Entry';
      const rawDigits = decryptDigits(entry.encrypted_digits) || entry.masked_digits || '';
      if (rawDigits) {
        lines.push(`${label}: ${rawDigits}`);
      }
    });

    if (lines.length === 0) {
      const callInputs = await this.db.getCallInputs(call_sid);
      callInputs.forEach((input) => {
        if (input.value) {
          lines.push(`Step ${input.step}: ${input.value}`);
        }
      });
    }

    if (!lines.length) {
      return null;
    }

    return {
      text: lines.join('\n'),
      multiline: lines.length > 1,
    };
  }

  async buildTranscriptPreview(call_sid, call) {
    if (call?.call_summary) {
      return call.call_summary.slice(0, 200);
    }

    const transcripts = await this.db.getCallTranscripts(call_sid);
    if (!transcripts.length) {
      return null;
    }

    const preview = transcripts
      .slice(0, 4)
      .map((entry) => entry.clean_message || entry.message || entry.raw_message || '')
      .filter(Boolean)
      .join(' ')
      .trim();

    return preview.slice(0, 220);
  }

  async sendCallOutcomeSummary(call_sid, telegram_chat_id) {
    try {
      const call = await this.db.getCall(call_sid);
      if (!call) {
        return true;
      }

      const maskedNumber = maskPhoneNumber(call.phone_number);
      const durationText = formatDurationShort(call.duration);
      const answeredLabel = formatAnsweredLabel(call.answered_by || call.amd_status);
      const outcome = (call.final_outcome || '').toUpperCase();
      const lines = [];

      if (call.call_type === 'collect_input') {
        const inputDetails = await this.buildInputDetails(call_sid);
        if (outcome === 'ANSWERED_WITH_INPUT') {
          lines.push('✅ Call completed — input captured');
          lines.push(`To: ${maskedNumber}`);
          lines.push(`Answered by: ${answeredLabel}`);
          if (inputDetails?.multiline) {
            lines.push('Input:');
            lines.push(inputDetails.text);
          } else if (inputDetails) {
            lines.push(`Input: ${inputDetails.text}`);
          } else {
            const fallbackValue = (await this.getLatestInputPreview(call_sid, call)) || 'Captured';
            lines.push(`Input: ${fallbackValue}`);
          }
          lines.push(`Duration: ${durationText}`);
        } else if (['ANSWERED_NO_INPUT_HUMAN', 'ANSWERED_NO_INPUT_MACHINE'].includes(outcome)) {
          lines.push('⚠️ Call completed — no input received');
          lines.push(`To: ${maskedNumber}`);
          lines.push(`Answered by: ${answeredLabel}`);
          lines.push(`Duration: ${durationText}`);
        } else if (outcome === 'NO_ANSWER') {
          lines.push('❌ No answer');
          lines.push(`To: ${maskedNumber}`);
          lines.push('Attempts: 1');
        } else if (outcome === 'BUSY') {
          lines.push('⚠️ Line busy');
          lines.push(`To: ${maskedNumber}`);
          lines.push(`Duration: ${durationText}`);
        } else if (outcome === 'FAILED') {
          lines.push('❌ Call failed');
          lines.push(`To: ${maskedNumber}`);
          if (call.error_message) {
            lines.push(`Reason: ${call.error_message}`);
          }
        } else if (outcome === 'CANCELED') {
          lines.push('🚫 Call canceled');
          lines.push(`To: ${maskedNumber}`);
        } else {
          lines.push('📞 Call update');
          lines.push(`To: ${maskedNumber}`);
          lines.push(`Outcome: ${outcome || 'unknown'}`);
        }
      } else {
        if (['ANSWERED_WITH_INPUT', 'ANSWERED_NO_INPUT_HUMAN', 'ANSWERED_NO_INPUT_MACHINE'].includes(outcome)) {
          lines.push('📞 Service call completed');
          lines.push(`Answered by: ${answeredLabel}`);
          lines.push(`Duration: ${durationText}`);
          const transcriptPreview = await this.buildTranscriptPreview(call_sid, call);
          if (transcriptPreview) {
            lines.push(`Transcript: "${transcriptPreview}"`);
          }
        } else if (outcome === 'NO_ANSWER') {
          lines.push('❌ No answer');
          lines.push(`To: ${maskedNumber}`);
          lines.push('Attempts: 1');
        } else if (outcome === 'BUSY') {
          lines.push('⚠️ Line busy');
          lines.push(`To: ${maskedNumber}`);
          lines.push(`Duration: ${durationText}`);
        } else if (outcome === 'FAILED') {
          lines.push('❌ Call failed');
          lines.push(`To: ${maskedNumber}`);
          if (call.error_message) {
            lines.push(`Reason: ${call.error_message}`);
          }
        } else if (outcome === 'CANCELED') {
          lines.push('🚫 Call canceled');
          lines.push(`To: ${maskedNumber}`);
        } else {
          lines.push('📞 Call update');
          lines.push(`To: ${maskedNumber}`);
          lines.push(`Outcome: ${outcome || 'unknown'}`);
        }
      }

      if (!lines.length) {
        lines.push('📞 Call update unavailable.');
      }

      await this.sendTelegramMessage(telegram_chat_id, buildTelegramMessage(lines));

      const statusForUpdate = call.status || call.twilio_status || 'completed';
      await this.db.updateCallStatus(call_sid, statusForUpdate, {
        outcome_notified_at: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to send call outcome summary:', error);
      return false;
    }
  }

  async sendCallAmdUpdate(call_sid, telegram_chat_id) {
    try {
      const call = await this.db.getCall(call_sid);
      if (!call?.amd_status) {
        return true;
      }

      const label = formatAnsweredLabel(call.amd_status);
      const emoji = label === 'human' ? '🙂' : '🤖';
      const lines = [`${emoji} Answer detection update`, `Answered by: ${label}`];

      if (call.amd_confidence) {
        const confidencePercent = Number(call.amd_confidence) * 100;
        if (Number.isFinite(confidencePercent)) {
          lines.push(`Confidence: ${confidencePercent.toFixed(1)}%`);
        }
      }

      await this.sendTelegramMessage(telegram_chat_id, buildTelegramMessage(lines));
      return true;
    } catch (error) {
      console.error('❌ Failed to send AMD update notification:', error);
      return false;
    }
  }

  // Process individual notification with enhanced error handling
  async sendNotification(notification) {
    const { id, call_sid, notification_type, telegram_chat_id, phone_number } = notification;

    try {
      let success = false;

      switch (notification_type) {
        case 'call_initiated':
        case 'call_queued':
          success = await this.sendCallStatusUpdate(call_sid, 'initiated', telegram_chat_id);
          break;
        case 'call_ringing':
          success = await this.sendCallStatusUpdate(call_sid, 'ringing', telegram_chat_id);
          break;
        case 'call_answered':
        case 'call_in_progress':
          success = await this.sendCallStatusUpdate(call_sid, 'answered', telegram_chat_id);
          break;
        case 'call_completed': {
          const [callDetails, dtmfEntries] = await Promise.all([
            this.db.getCall(call_sid),
            this.db.getCallDtmfEntries(call_sid),
          ]);
          success = await this.sendCallStatusUpdate(call_sid, 'completed', telegram_chat_id, { 
            duration: callDetails?.duration,
            sensitive_dtmf: isSensitiveDtmf(dtmfEntries),
          });
          break;
        }
        case 'call_input_dtmf':
        case 'call_dtmf_captured':
          success = await this.sendCallInputNotification(call_sid, telegram_chat_id);
          break;
        case 'call_amd_update':
          success = await this.sendCallAmdUpdate(call_sid, telegram_chat_id);
          break;
        case 'call_outcome_summary':
          success = await this.sendCallOutcomeSummary(call_sid, telegram_chat_id);
          break;
        case 'call_failed':
          const failedCall = await this.db.getCall(call_sid);
          success = await this.sendCallStatusUpdate(call_sid, 'failed', telegram_chat_id, { 
            error_message: failedCall?.error_message 
          });
          break;
        case 'call_busy':
          success = await this.sendCallStatusUpdate(call_sid, 'busy', telegram_chat_id);
          break;
        case 'call_no_answer':
        case 'call_no-answer':
          const noAnswerCall = await this.db.getCall(call_sid);
          success = await this.sendCallStatusUpdate(call_sid, 'no-answer', telegram_chat_id, {
            ring_duration: noAnswerCall?.ring_duration
          });
          break;
        case 'call_canceled':
          success = await this.sendCallStatusUpdate(call_sid, 'canceled', telegram_chat_id);
          break;
        default:
          console.warn(`⚠️ Unknown notification type: ${notification_type}`.yellow);
          success = await this.sendCallStatusUpdate(call_sid, notification_type.replace('call_', ''), telegram_chat_id);
      }

      if (success) {
        await this.db.updateEnhancedWebhookNotification(id, 'sent', null, null);
        console.log(`✅ Processed enhanced notification ${id} (${notification_type})`.green);
      } else {
        throw new Error('Failed to send notification');
      }

    } catch (error) {
      console.error(`❌ Failed to send notification ${id}:`, error.message);
      await this.db.updateEnhancedWebhookNotification(id, 'failed', error.message, null);
      
      // For critical failures, try to send error notification to user
      if (['call_failed'].includes(notification_type)) {
        try {
          await this.sendTelegramMessage(telegram_chat_id, `❌ Error processing ${notification_type.replace('_', ' ')}`);
        } catch (errorNotificationError) {
          console.error('Failed to send error notification:', errorNotificationError);
        }
      }
    }
  }

  // Enhanced Telegram message sending with markdown support
  async sendTelegramMessage(chatId, message, parseMode = 'HTML', replyMarkup = null) {
    const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
    const sanitizedText = sanitizeTelegramText(message);
    const payload = {
      chat_id: chatId,
      text: sanitizedText,
      disable_web_page_preview: true
    };

    let resolvedParseMode = null;
    if (parseMode === false || parseMode === null) {
      resolvedParseMode = null;
    } else if (parseMode === true) {
      resolvedParseMode = 'Markdown';
    } else if (typeof parseMode === 'string' && parseMode.trim().length > 0) {
      resolvedParseMode = parseMode;
    } else {
      resolvedParseMode = 'HTML';
    }

    if (resolvedParseMode) {
      payload.parse_mode = resolvedParseMode;
    }

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await axios.post(url, payload, {
      timeout: 15000, // Longer timeout for better reliability
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description || 'Unknown error'}`);
    }

    return response.data;
  }

  // Debug method for troubleshooting
  async sendDebugInfo(call_sid, telegram_chat_id, webhookData) {
    try {
      const debugMessage = buildTelegramMessage([
        `🔍 Debug Info for Call ${call_sid.slice(-6)}`,
        '',
        `Status: ${webhookData.CallStatus}`,
        `Duration: ${webhookData.Duration || 'N/A'}`,
        `AnsweredBy: ${webhookData.AnsweredBy || 'N/A'}`,
        `CallDuration: ${webhookData.CallDuration || 'N/A'}`,
        `DialDuration: ${webhookData.DialCallDuration || 'N/A'}`,
        `Error: ${webhookData.ErrorCode || 'None'}`,
        `From: ${webhookData.From || 'N/A'}`,
        `To: ${webhookData.To || 'N/A'}`
      ]);

        await this.sendTelegramMessage(telegram_chat_id, debugMessage);
      return true;
    } catch (error) {
      console.error('Failed to send debug info:', error);
      return false;
    }
  }

  // Utility methods
  getStatusEmoji(status) {
    const statusEmojis = {
      'completed': '✅',
      'failed': '❌',
      'busy': '📵',
      'no-answer': '❌',
      'canceled': '🚫',
      'answered': '📞',
      'ringing': '🔔',
      'initiated': '📞'
    };
    return statusEmojis[status] || '📱';
  }

  buildCallFollowUpKeyboard(callSid, status, options = {}) {
    if (!callSid) return null;

    const sid = String(callSid);
    const base = `FOLLOWUP_CALL:${sid}:`;

    const allowTranscriptButton = options.allowTranscript !== false;

    const rows = [
      [
        { text: '📝 Send recap', callback_data: `${base}recap` },
        { text: '⏰ Schedule follow-up', callback_data: `${base}schedule` }
      ],
      [
        { text: '👤 Reassign to agent', callback_data: `${base}reassign` }
      ]
    ];

    // Offer transcript view only when call actually connected/completed
    if (allowTranscriptButton && (status === 'completed' || status === 'answered')) {
      rows[1].unshift({ text: '📋 View transcript', callback_data: `${base}transcript` });
    }

    return {
      inline_keyboard: rows
    };
  }

  splitMessage(message, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If a single line is too long, split it
        if (line.length > maxLength) {
          let remainingLine = line;
          while (remainingLine.length > maxLength) {
            let splitIndex = remainingLine.lastIndexOf(' ', maxLength);
            if (splitIndex === -1) splitIndex = maxLength;
            
            chunks.push(remainingLine.substring(0, splitIndex));
            remainingLine = remainingLine.substring(splitIndex).trim();
          }
          if (remainingLine) {
            currentChunk = remainingLine + '\n';
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clean up old call data to prevent memory leaks
  cleanupOldCallData() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const callsToCleanup = [];

    for (const [callSid, statusInfo] of this.activeCallStatus.entries()) {
      if (statusInfo.timestamp < oneHourAgo) {
        callsToCleanup.push(callSid);
      }
    }

    for (const callSid of callsToCleanup) {
      this.cleanupCallData(callSid);
    }

    if (callsToCleanup.length > 0) {
      console.log(`🧹 Cleaned up ${callsToCleanup.length} old call records`.gray);
    }
  }

  cleanupCallData(callSid) {
    this.activeCallStatus.delete(callSid);
    this.callTimestamps.delete(callSid);
  }

  // Enhanced immediate status update with better error handling
  async sendImmediateStatus(call_sid, status, telegram_chat_id) {
    try {
      return await this.sendCallStatusUpdate(call_sid, status, telegram_chat_id);
    } catch (error) {
      console.error(`❌ Failed to send immediate status for ${call_sid}:`, error);
      // Try to send a generic notification
      try {
        await this.sendTelegramMessage(telegram_chat_id, `📱 Call ${call_sid.slice(-6)} status: ${status}`);
        return true;
      } catch (fallbackError) {
        console.error(`❌ Fallback notification also failed:`, fallbackError);
        return false;
      }
    }
  }

  // Enhanced health check
  async healthCheck() {
    if (!this.telegramBotToken) {
      return { status: 'disabled', reason: 'No Telegram bot token configured' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.telegramBotToken}/getMe`;
      const response = await axios.get(url, { timeout: 8000 });
      
      if (response.data.ok) {
        return {
          status: 'healthy',
          bot_info: {
            username: response.data.result.username,
            first_name: response.data.result.first_name,
            id: response.data.result.id
          },
          is_running: this.isRunning,
          active_calls: this.activeCallStatus.size,
          tracked_calls: this.callTimestamps.size,
          process_interval: this.processInterval,
          enhanced_features: true
        };
      } else {
        return { status: 'error', reason: 'Telegram API returned error' };
      }
    } catch (error) {
      return { 
        status: 'error', 
        reason: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  }

  // Get call status statistics
  getCallStatusStats() {
    const stats = {
      total_tracked_calls: this.activeCallStatus.size,
      status_breakdown: {},
      average_call_age_minutes: 0,
      enhanced_tracking: true
    };

    let totalAge = 0;
    for (const [callSid, statusInfo] of this.activeCallStatus.entries()) {
      const status = statusInfo.lastStatus;
      stats.status_breakdown[status] = (stats.status_breakdown[status] || 0) + 1;
      
      const ageMinutes = (new Date() - statusInfo.timestamp) / (1000 * 60);
      totalAge += ageMinutes;
    }

    if (this.activeCallStatus.size > 0) {
      stats.average_call_age_minutes = (totalAge / this.activeCallStatus.size).toFixed(1);
    }

    return stats;
  }

  // Method for testing notifications
  async testNotification(call_sid, status, telegram_chat_id) {
    console.log(`🧪 Testing notification: ${status} for call ${call_sid}`.blue);
    
    try {
      const success = await this.sendCallStatusUpdate(call_sid, status, telegram_chat_id);
      console.log(`🧪 Test result: ${success ? 'SUCCESS' : 'FAILED'}`.cyan);
      return success;
    } catch (error) {
      console.error(`🧪 Test failed:`, error);
      return false;
    }
  }

  // Get notification performance metrics
  getNotificationMetrics() {
    return {
      service_uptime: this.isRunning,
      process_interval_ms: this.processInterval,
      active_call_tracking: this.activeCallStatus.size,
      call_timestamps_tracked: this.callTimestamps.size,
      telegram_bot_configured: !!this.telegramBotToken,
      enhanced_features_enabled: true
    };
  }
}

// Export singleton instance
const enhancedWebhookService = new EnhancedWebhookService();
module.exports = { webhookService: enhancedWebhookService };
