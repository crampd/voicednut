# /workspaces/voicednut/AGENTS.md

# Project guidance loaded by Codex for this repository (layered with global ~/.codex/AGENTS.md).

## Working agreements (always)

- Behave like a senior engineer: correctness first, then clarity, then speed.
- Prefer small, reviewable diffs; avoid drive-by formatting changes.
- Preserve public APIs and behavior unless explicitly asked to change them.
- Do not introduce new dependencies without explicit approval.
- When uncertain, ask one targeted question or present 2 options with tradeoffs.

## Execution defaults

- Start by restating intent and constraints.
- Read surrounding code before edits; match local conventions.
- Implement minimal viable changes first, then harden.
- Verify with fastest relevant checks and report outcomes.
- If checks cannot run, state exact commands that should be run.

## Autonomy and persistence

- Default expectation: deliver working code, not only a plan.
- Bias to action with reasonable assumptions; do not stop on clarifications unless blocked by a real safety or contract ambiguity.
- Persist through context gathering, implementation, verification, and refinement within the same turn whenever feasible.
- If progress stalls from repeated rereads or edits without clear forward movement, stop and summarize the blocker instead of thrashing.

## Code implementation

- Optimize for correctness, clarity, and reliability over speed; avoid speculative rewrites and shortcut fixes.
- Preserve intended UX and behavior by default; flag intentional behavior changes explicitly.
- Reuse existing helpers, normalization logic, and shared abstractions before adding new ones.
- Keep type safety intact; avoid unnecessary `any`-style escapes when a guard, helper, or proper type will do.
- Do not add broad catches, silent fallbacks, or success-shaped defaults that hide real failures.
- Cover all relevant surfaces so behavior stays coherent across the app, not only in one touched file.

## Exploration and reading

- Prefer `rg` and `rg --files` for repository search.
- Think first, then batch likely reads together instead of reading files one by one.
- Use `multi_tool_use.parallel` for independent reads, searches, and other parallelizable developer-tool calls.
- Prefer dedicated tools over raw shell when an equivalent tool exists.
- Treat inline `L123:`-style prefixes in copied code as line-number metadata, not source text.

## Editing constraints

- Default to ASCII unless the file already requires non-ASCII content.
- Add brief comments only when they materially improve comprehension of non-obvious logic.
- Use `apply_patch` for manual code edits unless another method is clearly more efficient for generated or bulk mechanical changes.
- Never revert user changes you did not make unless explicitly requested.
- If unexpected local changes appear while you are working and they affect the task, stop and ask how to proceed.
- Never use destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.

## Planning discipline

- Skip formal plans for straightforward tasks.
- Do not make single-step plans.
- If a plan is created, update it after completing a meaningful subtask.
- Do not finish with plan-only output; the deliverable is implemented work or a concrete blocker.
- Before finishing, reconcile prior plan items as done, blocked, or cancelled.

## Codex artifacts

- Do not create or persist a repo-root `.codex/` directory in this repository.
- Store convention fingerprints and Codex local artifacts under `~/.codex/` instead (for example `~/.codex/conventions/`).
- Keep `.github/` GitHub-native. Do not store repository-local Codex metadata there.
- The active Codex configuration sources are this `AGENTS.md`, `~/.codex/config.toml`, and installed skills under `~/.codex/skills/`.

## Integration docs policy (required)

- For Twilio, Vonage, AWS, OpenRouter, Deepgram, and grammY work, use docs-first workflow.
- Use Context7 first for package docs and version compatibility.
- Prefer official provider docs for webhook/auth/payload behavior checks.
- Cross-check provider webhook/auth/payload behavior with official docs before code changes.
- If docs and local code differ, state the mismatch explicitly.

## Refactoring

- Refactor in safe steps: mechanical rename -> extraction -> simplification -> optimization.
- Keep functions named for intent and reduce deeply nested branching.
- Remove dead code only when proven unused (or with approval).

## Review/debug expectations

- For reviews, prioritize bugs, regressions, and edge-case failures over style.
- For debugging, reproduce first, isolate root cause, then patch minimally.
- Always include file references and explain why the issue occurs.

## Preferred MCP/tool usage

- Prefer `fs` for repository inspection/editing.
- Use `openaiDeveloperDocs` for OpenAI/Codex docs and `context7` for third-party docs.
- Use `playwright` when UI/runtime validation is required.
- Prefer connector-first execution paths before falling back to generic shell commands.
- If a tool fails, continue with safe fallback and state limitation briefly.
- Never expose secrets in logs or outputs.

## Browser validation policy (required)

- Do not add, restore, or rely on repo-local Playwright/browser validation scripts or wrappers under `miniapp/scripts` or `miniapp/package.json`.
- Browser/runtime validation for this repository must use the `playwright` skill and MCP Playwright tools only unless the user explicitly requests another path.
- Keep Mini App local validation scripts limited to static checks such as lint, type-check, build, and source-based smoke verification unless the user explicitly requests otherwise.

## Skill routing hints

- Skill or workflow updates -> use `skill-creator`.
- Provider/API docs lookup and integration behavior validation -> use `openai-docs` + Context7.
- Feature implementation/code generation -> use `intent-codegen`.
- Provider integration and adapter development -> use `provider-integration`.
- Miniapp UI/UX enhancement and visual quality improvements -> use `miniapp-ui` with `frontend-skill`.
- Design-to-code implementation from Figma URLs/nodes -> use `figma-implement-design` (and `figma` for MCP setup/troubleshooting).
- Figma code component mapping workflows -> use `figma-code-connect-components`.
- Design-system rule generation for project consistency -> use `figma-create-design-system-rules`.
- Figma canvas read/write actions via JS Plugin API -> use `figma-use` before any `use_figma` tool call.
- Browser-level Mini App validation and interaction checks -> use `playwright`.
- Complex code reading/explanation -> use `legacy-code-reader`.
- Bug/edge-case/code-risk review -> use `bug-risk-analyzer`.
- Repro + root-cause + fix -> use `debug-fix-runbook`.
- Repetitive setup/refactor/test/migration loops -> use `workflow-automation`.
- Repo commit/push/miniapp production deployment in this repository -> use `Deploy`.
- Vercel preview/production deployments -> use `vercel-deploy`.
- Recurring provider drift/docs-sync maintenance -> use `integration-maintenance`.

## Output format (fast + useful)

- Provide a concise plan (3-6 bullets max).
- Then provide a short "What changed" summary:
  - Files touched
  - Key behavior changes
  - Any follow-ups / risks
- Do not paste unified diffs by default.
- Include exact commands to run when relevant.
- For review requests, report findings first by severity with file references, then assumptions, then a short summary.
- Keep file references standalone and clickable using inline-code paths with optional `:line` or `#Lline` suffixes.
- When a named skill is used, follow that skill's required report template exactly.

## Telegram Mini Apps docs sync (required)

- For Telegram Mini App work (`miniapp/**`, `@tma.js/*`, Telegram platform APIs), use docs-first workflow.
- Load official Telegram Mini Apps platform docs first.
- Prioritize platform references: About, Init Data, Settings Button, Back Button, Haptic Feedback.
- Cross-check auth/signature verification against Init Data docs before code changes.
- Use Context7 for `@tma.js` package version compatibility when available.

## Miniapp skill orchestration (required)

- For Mini App enhancement tasks, route by default through this sequence unless task scope requires otherwise:
  1. `intent-codegen` for scoped implementation plan and minimal diff strategy.
  2. `frontend-skill` for UI hierarchy, polish, and interaction quality.
  3. `playwright` for UI/runtime validation on critical flows.
  4. `bug-risk-analyzer` for high-risk paths (auth, admin actions, destructive operations).
- When Figma context exists, add:
  1. `figma` for connection/setup checks.
  2. `figma-implement-design` or `figma-generate-design` for design translation.
  3. `figma-code-connect-components` for component mapping.
  4. `figma-create-design-system-rules` when rule generation is requested.
  5. `figma-use` before any direct `use_figma` write/read action.
- If a relevant installed skill is available and the task matches it, use that skill instead of ad-hoc workflow.

## Complex task orchestration

- Treat a task as complex when it likely changes more than 4 non-test files, crosses layers, affects high-stakes behavior, or asks for a broad audit/refactor.
- For complex tasks, use a small multi-agent workflow: one explorer for codebase mapping, parallel workers with disjoint ownership, and a risk review pass when correctness is sensitive.
- Keep the main thread as the integrator: merge results, run verification, and report rollback/risk clearly.

## Build and Test

See [api/README.md](api/README.md), [bot/README.md](bot/README.md), [miniapp/README.md](miniapp/README.md) for setup and commands.

Key commands:

- API: `npm run setup` (credentials), `npm run dev` (development), `npm run test` (unit tests), `npm run preflight:provider` (validation), `npm run parity:providers` (smoke tests)
- Bot: `npm run dev`
- Miniapp: `npm run dev`, `npm run validate:prod` (lint+build+contracts)

## Architecture

This is a three-service monorepo:

- **API**: Express.js backend handling voice calls, SMS, email, and webhooks via multiple providers (Twilio, AWS Connect, Vonage).
- **Bot**: Telegram bot for administration using grammY.
- **Miniapp**: React TypeScript admin console deployed on Vercel.

See [README.md](README.md) for feature overview and guardrails.

API architecture:

- **Adapters**: Provider-specific implementations (e.g., [api/adapters/AwsConnectAdapter.js](api/adapters/AwsConnectAdapter.js))
- **Routes**: Request handlers (e.g., [api/routes/voiceAgentBridge.js](api/routes/voiceAgentBridge.js))
- **Services**: Business logic (e.g., [api/services/callRoutes.js](api/services/callRoutes.js))
- **Functions**: Tools and features (e.g., [api/functions/DynamicFunctionEngine.js](api/functions/DynamicFunctionEngine.js))
- **DB**: SQLite with tables for calls, SMS, etc.

Provider pattern: All channels (call, sms, email) support multi-provider dispatch at runtime.

## Conventions

- Phone numbers: E.164 format (`^\+[1-9]\d{1,14}$`), log masked with `maskPhoneForLog()` (last 4 digits).
- Status: Kebab-case (e.g., `in-progress`).
- Error codes: Snake_case, descriptive.
- Factory functions for dependency injection.
- Feature flags: `FEATURE_<NAME>_ENABLED`, shadow mode, rollout percent.
- Profile types: Pre-defined schema (dating, creator, etc.).

See [docs/voice-agent-safe-rollout-playbook.md](docs/voice-agent-safe-rollout-playbook.md) for feature flag contracts.

## Common Pitfalls

- Missing `.env`: Run `npm run setup` first.
- Invalid provider credentials: Use `npm run preflight:provider`.
- Vonage DTMF: Enable `VONAGE_DTMF_WEBHOOK_ENABLED=true`.
- SQLite locks: Use `runWithTimeout()`.
- Audio buffering: Ensure ordered chunks.
- Provider timeouts: Tune cooldown settings.

See [api/README.md](api/README.md) for troubleshooting.

## Skills

Use runtime-discovered skills from `~/.codex/config.toml` instead of maintaining a static list in this file. For this repository, prefer:

- `intent-codegen` for implementation.
- `provider-integration` for adding new providers.
- `miniapp-ui` for Mini App UI development.
- `legacy-code-reader` for complex code explanation.
- `bug-risk-analyzer` for risk/code review.
- `debug-fix-runbook` for defect reproduction and verified fixes.
- `workflow-automation` for repetitive setup/test/migration/refactor loops.
