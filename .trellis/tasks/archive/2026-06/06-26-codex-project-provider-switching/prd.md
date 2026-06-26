# Codex project provider switching

## Goal

Enable CLI-Manager to support per-project provider switching for Codex CLI projects using cc-switch `app_type = "codex"` providers. Because Codex intentionally ignores provider/auth/profile keys in project-local `.codex/config.toml`, CLI-Manager should implement project-level behavior by recording the selected provider in app-managed project metadata, generating a user-level Codex profile file, and launching Codex with `--profile <generated-profile>`.

## What I already know

- User approved the preferred approach: generate/update `~/.codex/cli-manager-<provider-id>.config.toml` and launch project Codex sessions with `--profile cli-manager-<provider-id>`.
- Secrets must not be written into the profile file or command line; prefer PTY `envVars` injection.
- Existing Claude provider switching writes provider env into `<project>/.claude/settings.json` and is hard-coded to `app_type = 'claude'` in `src-tauri/src/commands/ccswitch.rs`.
- Existing provider switch UI is `src/components/ProviderSwitchModal.tsx`; it currently filters providers to `appType === "claude"` and success text says `.claude/settings.json`.
- Existing sidebar only shows “切换供应商” when `project.cli_tool` contains `claude`.
- User clarified that Codex provider switching should only be available when the project setting `cli_tool` is exactly `"codex"` after trimming/lowercasing; do not enable it for arbitrary commands containing `codex`.
- Existing Codex startup command helper appends `--no-alt-screen` when the project CLI command is Codex and the arg is missing.
- Existing terminal session creation supports `envVars` and persists them in session state; `pty_create` receives those env vars and hook env is applied separately.
- cc-switch provider parsing already supports generic env key patterns like `*_BASE_URL` and `*_MODEL`, so Codex provider display can reuse the existing provider list parsing.

## Assumptions (temporary)

- cc-switch Codex providers store provider data in `settings_config.env`, most commonly OpenAI-compatible keys such as `OPENAI_API_KEY`, `OPENAI_BASE_URL` / `OPENAI_API_BASE`, and model keys such as `OPENAI_MODEL`, but implementation should be generic where practical.
- CLI-Manager project metadata can be extended to persist the selected Codex provider id and generated profile name; this is preferable to writing ignored provider keys into project `.codex/config.toml`.
- Project launch commands that are generated from exact `cli_tool = "codex"` should be modified automatically. Custom `startup_cmd` behavior needs one product decision.
- User confirmed Claude switching refactor should be included in the MVP, as a thin behavior-preserving adapter refactor to make future CLI integrations easier.
- Adapter/strategy design is appropriate, but the MVP should keep the abstraction bounded to provider switching and launch preparation rather than redesigning all project/terminal behavior.

## Open Questions

- None blocking. Ready for final confirmation before implementation.

## Requirements (evolving)

- Show project-level provider switching for exact Codex projects in addition to Claude projects: Codex support is enabled only when `project.cli_tool.trim().toLowerCase() === "codex"`.
- Do not enable Codex provider switching for custom wrapper commands, `codex resume ...`, `bunx codex`, `wsl codex`, or any other `cli_tool` value that merely contains `codex`.
- The provider switch modal must filter its provider list according to the project adapter/app type inferred from the project's CLI command: Claude projects show only `appType === "claude"` providers; exact Codex projects show only `appType === "codex"` providers.
- Selecting a Codex provider records a per-project override in CLI-Manager metadata.
- Selecting a Codex provider generates or updates a Codex profile at `$CODEX_HOME/cli-manager-<stable-provider-id>.config.toml`.
- Generated Codex profiles must not contain secret values.
- Generated Codex profiles should point `env_key` at a CLI-Manager-generated env var name; CLI-Manager injects the actual secret into the PTY environment for project Codex launches.
- Launching a Codex project with an override automatically adds `--profile <generated-profile>` while retaining `--no-alt-screen` behavior only when the project has no custom `startup_cmd` and CLI-Manager is generating the Codex startup command from exact `cli_tool = "codex"`.
- If an exact Codex project has a custom `startup_cmd`, CLI-Manager does not rewrite it; the switch UI should indicate that custom startup commands must include `--profile <generated-profile>` manually for the override to affect launches.
- “恢复跟随全局” for Codex removes the project-level override from CLI-Manager metadata and future generated launches use normal global Codex configuration.
- The existing Claude provider switching behavior must remain unchanged while being routed through the new Claude adapter/strategy.
- The MVP includes the Claude adapter refactor, but it must be a thin refactor with tests around existing `.claude/settings.json` behavior rather than a semantic redesign.

## Acceptance Criteria (evolving)

- [ ] Codex project context menu exposes “切换供应商”.
- [ ] Provider switch modal filters providers by the current project CLI adapter: Claude shows Claude providers, exact Codex shows Codex providers.
- [ ] Selecting a Codex provider creates/updates a `$CODEX_HOME/cli-manager-*.config.toml` profile without API keys/tokens/secrets embedded.
- [ ] Starting a Codex project after selecting a provider launches with `--profile <generated-profile>` and still includes `--no-alt-screen` unless already present when `startup_cmd` is empty.
- [ ] Codex projects with custom `startup_cmd` are not rewritten automatically and the UI communicates the manual `--profile` requirement.
- [ ] The selected provider is shown as the active provider in the switch modal and/or project badge equivalent.
- [ ] Resetting to global removes the Codex project override and new launches no longer include the generated profile.
- [ ] Existing Claude provider switching still writes `.claude/settings.json` as before.
- [ ] Provider switching logic is organized behind app-type adapters/strategies so Claude and Codex implementations share the UI/control flow but keep different storage and launch semantics.
- [ ] Frontend typecheck `npx tsc --noEmit` passes, or failures are reported clearly.
- [ ] Rust check/tests relevant to changed backend commands pass, or failures are reported clearly.

## Definition of Done

- Requirements and behavior documented in this PRD.
- Research recorded under `research/`.
- `implement.jsonl` and `check.jsonl` curated with spec/research context before task start.
- Tests added/updated for Rust pure functions and TypeScript helpers where feasible.
- User-facing behavior changes are summarized for manual UI verification.
- No git commit unless explicitly requested.

## Research References

- [`research/codex-config-provider-switching.md`](research/codex-config-provider-switching.md) — Codex provider/auth/profile keys cannot be project-local; profile-based launch is the recommended implementation path.

## Research Notes

### Feasible approaches

**Approach A: Generated Codex profile + launch `--profile` (Chosen)**

- How it works: CLI-Manager stores the selected provider id per project, writes a `$CODEX_HOME/cli-manager-<provider-id>.config.toml` profile without secrets, injects secret env vars into PTY, and appends `--profile` when launching Codex.
- Pros: Matches Codex official config model; avoids ignored project-local provider keys; keeps secrets out of profile/command line.
- Cons: Requires startup command/profile injection plumbing and profile lifecycle handling.

**Approach B: Launch-time `--config` only**

- How it works: no profile file; all non-secret provider config passed as `codex --config ...`, secrets injected through env.
- Pros: No profile files to manage.
- Cons: Long/fragile command quoting across shells; base URL/model visible in process command line; harder to inspect.

**Approach C: Per-project `CODEX_HOME`**

- How it works: each project gets an isolated CODEX_HOME with its own `config.toml`.
- Pros: True isolation and normal Codex user-level semantics.
- Cons: Splits auth/history/hooks/cache; broad impact on hook settings/history/ccusage. Out of scope for MVP.

## Expansion Sweep

### Future evolution

- The provider switching strategy should make it possible to add more app types later without hard-coding Claude-only behavior everywhere.
- Generated profile naming and env key naming should be stable and deterministic so future cleanup/reconciliation is possible.

### Related scenarios

- History resume commands (`codex resume --no-alt-screen ...`) may eventually need the same profile injection if resuming from a project with a Codex provider override.
- Split pane/project launch flows should remain consistent with normal project launch.

### Failure and edge cases

- Missing cc-switch DB or malformed provider config should fail with actionable UI errors without corrupting user Codex config.
- Custom startup commands are intentionally not rewritten in the MVP; UI messaging must prevent users from assuming provider overrides affect those commands automatically.
- Existing generated profile should be overwritten atomically where practical.
- API key/token values should never be written into project files, profile files, logs, or command lines.

## Technical Approach

- Use a bounded adapter/strategy design for provider switching. Each supported CLI app type exposes the same high-level operations (detect support, list/filter providers, probe current project override, apply provider, reset to global, prepare launch command/env), while adapter internals remain tool-specific.
- Start with two adapters:
  - `claude`: preserves current `.claude/settings.json` / `ANTHROPIC_*` behavior.
  - `codex`: exact `cli_tool === "codex"` only; uses generated Codex profiles and launch/env injection.
- Avoid a broad rewrite of terminal/project management. The abstraction should cover provider switching and launch preparation only.
- Extend provider switching from a Claude-only implementation to an app-type-aware implementation, while preserving Claude behavior.
- Add Codex-specific backend support for:
  - resolving Codex config home (`CODEX_HOME` defaulting to `~/.codex` or configured Codex hook dir where appropriate),
  - reading cc-switch `app_type = 'codex'` providers,
  - generating a sanitized Codex profile TOML,
  - storing/reading/resetting per-project Codex provider selection in CLI-Manager project metadata.
- Add frontend support for:
  - showing provider switch entry for Codex projects,
  - filtering modal providers by inferred app type,
  - adapting copy/status text for Claude vs Codex.
- Add launch support for:
  - deriving Codex selected provider/profile for a project,
  - appending `--profile <generated>` to generated Codex launch commands,
  - injecting secret env var values via `envVars` into terminal creation.

## Decision (ADR-lite)

**Context**: Claude can use project-local `.claude/settings.json` env overrides, but Codex ignores provider/auth/profile keys in project-local `.codex/config.toml`.

**Decision**: Implement provider switching through a bounded app-type adapter/strategy layer. Refactor the existing Claude switching path into the Claude adapter without changing its observable behavior, and add a Codex adapter that stores a CLI-Manager-managed project override, generates a user-level Codex profile, and launches exact `cli_tool = "codex"` projects with `--profile`, with secrets injected into PTY env instead of persisted.

**Consequences**: Codex switching aligns with official Codex semantics and avoids ineffective project config writes. The trade-off is that CLI-Manager must own profile generation and startup command injection. The adapter boundary adds some refactor cost now, but prevents the current Claude-specific branching from growing when other CLI tools are added later.

## Out of Scope

- Writing provider/auth/profile keys into project `.codex/config.toml`.
- Per-project `CODEX_HOME` isolation.
- Changing Claude provider switching semantics.
- Broad redesign of cc-switch provider settings UI.
- Full cleanup UI for old generated Codex profile files, unless needed for correctness.

## Technical Notes

- `src-tauri/src/commands/ccswitch.rs` currently hard-codes Claude project switching to `.claude/settings.json`, `app_type = 'claude'`, and `ANTHROPIC_*` env matching/replacement.
- `src/components/ProviderSwitchModal.tsx` currently filters providers to Claude and invokes `ccswitch_get_project_provider`, `ccswitch_apply_provider`, and `ccswitch_reset_project_provider`.
- `src/components/sidebar/index.tsx` currently displays provider switching only for projects whose CLI tool contains `claude`.
- `src/lib/projectStartupCommand.ts` currently appends `--no-alt-screen` for Codex startup commands.
- `src/stores/terminalStore.ts` passes `envVars` to `pty_create`, so Codex secret env injection should fit existing terminal creation mechanics.
- `src-tauri/src/lib.rs` registers cc-switch commands centrally; new backend commands must be registered there.
