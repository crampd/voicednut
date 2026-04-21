# Codex Implementation Prompts for `crampd/voicednut`

This file is a step-by-step prompt pack for Codex to implement the planned enhancements safely and incrementally.

## How to use this file

- Send **one prompt at a time** to Codex.
- Do **not** send the whole file at once.
- Wait for Codex to finish each step before moving to the next one.
- Keep the implementation incremental and reviewable.
- Reuse the current architecture instead of creating a parallel system.

## Important constraints

- Do **not** implement live-agent transfer.
- Replace transfer assumptions with:
  - callback task creation
  - review case creation
  - secure follow-up sending
- Prefer these domain flows:
  - `tax_support`
  - `tax_resolution`
  - `bank_servicing`
  - `fraud_review`
  - `collections_servicing`
  - `identity_verification_plus`
- Do not add deceptive or impersonation-oriented behavior.
- Prefer small, reviewable diffs.
- Do not add new dependencies unless clearly justified.
- Reuse the repo's existing route/service/function/profile/config seams.

## Best practice for Codex

Because OpenAI's Codex guidance says `AGENTS.md` instructions apply to the whole directory tree under that file and must be obeyed for files touched, this roadmap works best when stored in the repository and explicitly referenced in your Codex prompts or linked from repo guidance.

---

# Codex Prompt 0 — Inspect the repo and plan the implementation

```text
You are working in the repository `crampd/voicednut`.

Do not implement features yet.

First, inspect the existing architecture and produce a concrete implementation plan for this enhancement direction:

- no live-agent transfer implementation
- replace transfer assumptions with:
  - callback task creation
  - review case creation
  - secure follow-up sending
- add new domain flows for:
  - tax_support
  - tax_resolution
  - bank_servicing
  - fraud_review
  - collections_servicing
  - identity_verification_plus
- adapt to the existing repo seams rather than inventing a parallel design

Constraints:
- preserve existing architecture and conventions
- match current service/route/function/profile/config patterns
- do not add deceptive impersonation behavior
- do not add live transfer
- prefer small, reviewable diffs
- do not add new dependencies without justification

In this step:
1. read the relevant files
2. identify the best insertion points
3. identify the current transfer assumptions
4. propose the first 5 implementation steps in order
5. do not change code yet unless a tiny harmless prep change is absolutely necessary

Output:
- concise architecture summary
- exact files likely to change first
- risks/blockers
- recommended first implementation step
```

# Codex Prompt 1 — Remove default live-transfer behavior

```text
Implement the first safe foundation change in `crampd/voicednut`.

Goal:
Remove the default live-transfer assumption from the adaptive call function system and replace it with non-transfer escalation primitives.

Required changes:
- stop automatically injecting `transferCall` in the adaptive function generation path
- introduce placeholders or first-class support for:
  - createCallbackTask
  - createReviewCase
  - sendSecureFollowup
- do not implement live transfer anywhere new
- preserve backward compatibility as much as possible
- keep the diff small and focused

Important:
- inspect existing code before editing
- match local conventions
- do not over-design
- if any existing transfer implementation must remain for compatibility, isolate it and stop making it the default
- if you add stubs, make them explicit and safe rather than silently succeeding

Deliverables:
1. code changes
2. explanation of what changed
3. exact files changed
4. exact commands to validate
5. any follow-up needed before next step
```

# Codex Prompt 2 — Add persistence for callback tasks and review cases

```text
Implement the next step in `crampd/voicednut`.

Goal:
Add persistence and service-layer support for:
- callback tasks
- review cases

Constraints:
- no live transfer
- keep backward compatibility
- prefer SQLite-compatible patterns already used in the repo
- keep changes small and reviewable
- do not add new dependencies

Expected scope:
- DB migration or schema extension
- service layer additions
- minimal read/write helpers
- no huge UI yet
- no speculative abstractions

Design intent:
- callback tasks should support:
  - reason
  - preferred window
  - priority
  - status
  - related call sid
  - contact identifier
- review cases should support:
  - case type
  - severity
  - notes
  - status
  - related call sid
  - domain/profile

Deliverables:
1. implement the DB and service layer
2. show exact files changed
3. explain schema additions
4. list validation commands
5. mention any API endpoints still needed next
```

# Codex Prompt 3 — Expose callback and review-case APIs

```text
Implement the next step in `crampd/voicednut`.

Goal:
Expose minimal API routes for callback tasks and review cases using the existing route/service style.

Please add only the minimal useful endpoints needed for operations:
- list callback tasks
- create callback task
- list review cases
- create review case
- update status for callback task or review case if a clean existing pattern supports it

Constraints:
- no live transfer
- keep auth/authorization consistent with existing admin or outbound authorization patterns
- do not redesign the API globally
- keep response shapes clear and consistent
- small diff preferred

Deliverables:
1. code changes
2. exact new endpoints
3. example request/response payloads
4. files changed
5. validation commands
```

# Codex Prompt 4 — Scaffold the new profile packs

```text
Implement the next step in `crampd/voicednut`.

Goal:
Scaffold and validate these new profile packs using the repo's existing profile-pack contract:

- tax_support
- tax_resolution
- bank_servicing
- fraud_review
- collections_servicing
- identity_verification_plus

Requirements:
- follow the strict two-file layout per profile:
  - `<profile-id>.md`
  - `profile.md`
- the primary file must own policy/routing/behavior
- the companion file must explicitly reference the primary file
- the companion file must not override policy authority
- keep the content practical and implementation-oriented
- include safe operational boundaries
- do not add deceptive or impersonation-oriented behavior
- no live transfer assumptions

For each profile pack include:
- purpose
- allowed actions
- blocked actions
- verification expectations
- fallback behavior
- disposition goals
- callback/review case guidance
- secure follow-up guidance

After creating them:
- run or prepare the profile validation step
- report results

Deliverables:
1. scaffolded files
2. summary of each profile pack
3. validation command/output
4. files changed
```

# Codex Prompt 5 — Add new adaptive tool templates

```text
Implement the next step in `crampd/voicednut`.

Goal:
Extend the adaptive function engine with new non-transfer templates for the new domains.

Add support for these tool/function concepts where appropriate:
- verifyIdentity
- createCallbackTask
- createReviewCase
- sendSecureFollowup
- classifyTaxInquiry
- classifyFraudAlert
- capturePromiseToPay
- collectDocumentChecklistStatus
- offerPaymentArrangement
- lookupPolicyAnswer
- scheduleConsultation
- captureDisputeReason

Requirements:
- integrate into the existing adaptive generation path
- do not inject every function blindly; use context/domain-aware selection
- strengthen context detection for:
  - tax
  - refund
  - notice
  - bank
  - account
  - card
  - suspicious transaction
  - fraud
  - collections
  - installment
  - payment due
  - verification
- do not add live transfer
- keep the design grounded in current repo patterns

Deliverables:
1. code changes
2. list of added templates/functions
3. explanation of context detection changes
4. files changed
5. validation commands
```

# Codex Prompt 6 — Add structured call dispositions

```text
Implement the next step in `crampd/voicednut`.

Goal:
Add structured call dispositions for the new domain workflows.

Add persistence and API-safe normalization for dispositions such as:
- tax_refund_status_answered
- tax_missing_docs_followup
- tax_notice_help_requested
- tax_consultation_booked
- tax_resolution_case_created
- bank_servicing_resolved
- bank_secure_followup_sent
- fraud_confirmed_legitimate
- fraud_denied_transaction
- fraud_uncertain_review_required
- collections_payment_link_sent
- collections_promise_to_pay
- collections_hardship_flagged
- collections_dispute_created
- low_confidence_safe_stop
- verification_incomplete
- policy_blocked

Requirements:
- fit into existing call detail/listing/reporting paths
- do not break current call APIs
- keep DB changes minimal and explicit
- preserve normalization patterns already present in call routes

Deliverables:
1. code changes
2. schema/data model changes
3. where dispositions are surfaced in APIs
4. files changed
5. validation commands
```

# Codex Prompt 7 — Implement `tax_support`

```text
Implement the first real domain flow in `crampd/voicednut`:

Domain:
`tax_support`

Goal:
Make this profile operational in the existing system without redesigning the platform.

Supported scenarios should include:
- tax document reminder
- missing information follow-up
- tax consultation scheduling
- notice-help intake
- refund-status style support classification
- secure checklist follow-up
- callback task creation
- review case creation when needed

Constraints:
- no live transfer
- safe, legitimate servicing tone
- profile-driven behavior
- use existing route/service/function/profile seams
- prefer incremental implementation

Focus on:
1. wiring the profile into actual runtime usage
2. hooking the relevant adaptive functions
3. persisting meaningful outcomes
4. using callback/review/follow-up instead of transfer

Deliverables:
1. code changes
2. how `tax_support` now works end to end
3. files changed
4. example request payload to test it
5. validation commands
```

# Codex Prompt 8 — Implement `collections_servicing`

```text
Implement the next domain flow in `crampd/voicednut`:

Domain:
`collections_servicing`

Goal:
Add a practical collections/payment servicing flow using existing platform seams.

Supported scenarios:
- payment reminder
- secure payment link follow-up
- promise-to-pay capture
- hardship flagging
- dispute intake
- callback request
- review case creation where needed

Constraints:
- no live transfer
- do not create deceptive or coercive behavior
- preserve existing payment-related support already in the repo
- use structured dispositions

Focus on:
1. profile behavior
2. adaptive functions
3. persistence of promise-to-pay or hardship/dispute outcomes
4. secure follow-up instead of transfer

Deliverables:
1. code changes
2. end-to-end behavior summary
3. files changed
4. example test payloads
5. validation commands
```

# Codex Prompt 9 — Implement `bank_servicing` and `fraud_review`

```text
Implement the next domain flows in `crampd/voicednut`:

Domains:
- `bank_servicing`
- `fraud_review`

Goal:
Add safe, structured account-servicing and fraud-confirmation flows.

Supported `bank_servicing` scenarios:
- account servicing classification
- payment support
- card/account issue intake
- secure follow-up
- callback/review case creation

Supported `fraud_review` scenarios:
- suspicious transaction confirmation
- classify response as:
  - confirmed legitimate
  - denied transaction
  - uncertain
- create review case where needed
- send secure follow-up

Requirements:
- strong identity-verification gating where appropriate
- no live transfer
- no deceptive authority impersonation
- fail closed on low confidence
- use structured dispositions

Deliverables:
1. code changes
2. how each flow works
3. files changed
4. example test payloads
5. validation commands
```

# Codex Prompt 10 — Add Mini App operations views

```text
Implement the next operational UI step in `crampd/voicednut` Mini App.

Goal:
Add minimal but useful operational views for:
- callback queue
- review cases
- domain analytics / dispositions

Requirements:
- match existing Mini App patterns and architecture
- do not redesign the entire UI
- no browser-test scripts added to the repo
- keep changes reviewable
- prefer pages/components that reflect real backend state already added

Views should support:
- listing callback tasks
- listing review cases
- viewing status/priority/domain
- viewing domain-specific dispositions
- basic filtering if there is already a clean pattern for it

Deliverables:
1. code changes
2. pages/components added
3. backend endpoints consumed
4. files changed
5. exact validation/build commands
```

# Codex Prompt 11 — Add Telegram admin controls

```text
Implement the next bot/admin step in `crampd/voicednut`.

Goal:
Add Telegram bot admin flows for:
- viewing callback tasks
- viewing review cases
- browsing domain stats or recent domain outcomes

Requirements:
- reuse existing guided flow/menu/status patterns in the bot
- do not create a parallel interaction style
- admin-only where appropriate
- no live transfer controls
- small, reviewable diff

Suggested commands or menu actions may include:
- /callbacks
- /reviewcases
- /domainstats

Deliverables:
1. code changes
2. bot flows added
3. files changed
4. example usage
5. validation commands
```

# Codex Prompt 12 — Hardening, QA, and rollout controls

```text
Implement the hardening step for the new domain enhancements in `crampd/voicednut`.

Goal:
Add rollout and QA hardening for the new financial/tax domain flows.

Please add or extend:
- per-domain feature flags
- allowlist/shadow/rollout controls where consistent with current patterns
- per-domain QA thresholds
- low-confidence safe-stop behavior where needed
- clear audit/status visibility

Do not:
- add live transfer
- perform a giant rewrite
- add speculative complexity

Deliverables:
1. code/config changes
2. exact env/config knobs added
3. how rollout is controlled
4. files changed
5. validation commands
6. recommended manual test checklist
```
