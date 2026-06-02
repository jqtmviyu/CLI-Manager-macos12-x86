# Terminal Runtime Monitoring Contracts

> Executable contracts for terminal tab runtime status events that cross the Rust PTY boundary and the React/Zustand UI boundary.

---

## Scenario: CLI hook settings installation status

### 1. Scope / Trigger

- Trigger: hook installation spans Rust file writes, user-level Claude/Codex config files, local hook bridge environment variables, and React settings status display.
- This is a cross-layer contract because Rust mutates external CLI config while frontend renders install completeness from backend status fields.

### 2. Signatures

- Tauri hook settings commands:

```rust
pub async fn hook_settings_get_status(
    selected_dir: Option<String>,
    codex_selected_dir: Option<String>,
) -> Result<HookSettingsStatus, String>

pub async fn hook_settings_install_codex(
    selected_dir: Option<String>,
    codex_selected_dir: Option<String>,
) -> Result<HookSettingsStatus, String>
```

- Status response fields:

```ts
interface ToolHookSettingsStatus {
  configDir: string | null;
  hooksDir: string | null;
  configPath: string | null;
  featureConfigPath: string | null;
  status: "directoryMissing" | "notInstalled" | "partialInstalled" | "installed";
  runningHookInstalled: boolean;
  attentionHookInstalled: boolean;
  stopHookInstalled: boolean;
  failureHookInstalled: boolean;
  hooksFeatureInstalled: boolean;
}
```

### 3. Contracts

- Codex install writes only user-level config:

| File | Required write | Contract |
|---|---|---|
| `~/.codex/hooks.json` | Yes | Register `UserPromptSubmit`, `PermissionRequest`, and `Stop` commands. |
| `~/.codex/hooks/notify-cli-manager-codex-attention.ps1` | Yes | Sends `source="codex"` and event `UserPromptSubmit` or `PermissionRequest`. |
| `~/.codex/hooks/notify-cli-manager-codex-finished.ps1` | Yes | Sends `source="codex"` and event `Stop`. |
| `~/.codex/config.toml` | Yes | Ensure `[features] hooks = true`. |
| `<project>/.codex/hooks.json` | No | Must not be modified by one-click install. |

- Codex status is `installed` only when all of these are true:
  - attention script exists;
  - finished script exists;
  - `UserPromptSubmit` command is registered exactly;
  - `PermissionRequest` command is registered exactly;
  - `Stop` command is registered exactly;
  - `[features] hooks = true` is present in `config.toml`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `codex_selected_dir` is empty | Resolve `~/.codex`, creating it only during install. |
| `hooks.json` is missing or empty | Treat as `{}` and create the `hooks` object. |
| `hooks.json` root is not an object | Return an error; do not overwrite unrelated content. |
| `config.toml` lacks `[features]` | Append `[features]` and `hooks = true`. |
| `config.toml` has `[features] hooks = false` | Replace only that line with `hooks = true`. |
| `config.toml` cannot be read or written | Return an error and report partial install through status. |
| Codex TUI has not approved hooks | Config may show installed; user still needs Codex `/hooks` approval outside this app. |

### 5. Good/Base/Bad Cases

- Good: clicking install writes user-level Codex hook scripts, registers all three hook events, enables `[features].hooks`, and the settings page shows every row as installed.
- Base: user has only old `PermissionRequest` and `Stop` hooks; status is partial until `UserPromptSubmit` and `[features].hooks` are added.
- Bad: modifying a project-level `.codex/hooks.json` would surprise users and must not happen.

### 6. Tests Required

- Rust assertions:
  - `set_toml_feature_hooks` appends `[features] hooks = true` when missing.
  - `set_toml_feature_hooks` replaces an existing `hooks` key only inside `[features]`.
  - Codex status returns `installed` only when `hooksFeatureInstalled` and all hook commands are true.
- Frontend assertions:
  - Codex settings page renders `config.toml` and `[features].hooks` status.
  - Missing `hooksFeatureInstalled` never displays Codex status as fully installed.

### 7. Wrong vs Correct

#### Wrong

```rust
// Only checks hooks.json, so config.toml can be missing while UI says installed.
let installed = running_hook && attention_hook && stop_hook;
```

#### Correct

```rust
let installed = running_hook && attention_hook && stop_hook && hooks_feature_installed;
```

## Scenario: Shell runtime status markers for terminal tabs

### 1. Scope / Trigger

- Trigger: terminal tab runtime status spans Rust PTY creation, shell environment variables, PowerShell/pwsh session injection, xterm output parsing, and Zustand tab status state.
- This is a cross-layer contract because Rust emits terminal output, frontend strips protocol markers, and UI renders the resulting status.
- MVP scope: PowerShell / pwsh only. bash / zsh may be added later but must use the same event contract.

### 2. Signatures

- Tauri command signature remains stable:

```rust
pub async fn pty_create(
    session_id: String,
    cwd: Option<String>,
    shell: Option<String>,
    env_vars: Option<HashMap<String, String>>,
    state: State<'_, AppState>,
) -> Result<String, String>
```

- PTY manager contract:

```rust
pub fn create(
    &self,
    session_id: &str,
    cwd: Option<&str>,
    shell: Option<&str>,
    env_vars: Option<HashMap<String, String>>,
) -> Result<(), String>
```

- Frontend runtime event payload:

```ts
export type ShellRuntimeEventName = "command_started" | "command_finished" | "prompt_shown";

export interface ShellRuntimePayload {
  sessionId: string;
  event: ShellRuntimeEventName;
  exitCode?: number | null;
  timestamp?: string | null;
}
```

### 3. Contracts

- Environment keys:

| Key | Required | Owner | Contract |
|---|---:|---|---|
| `CLI_MANAGER_TAB_ID` | Yes | Rust `pty_create` | Must equal the frontend session id for the PTY. |
| `CLI_MANAGER_SHELL_RUNTIME_MONITORING` | Optional | Frontend `terminalStore` | Value `"1"` enables shell runtime monitoring for a new PTY. Missing or any other value disables injection. |

- Private OSC marker format:

```text
ESC ] 777 ; cli-manager ; session=<sessionId> ; event=<eventName> [ ; exit=<number> ] BEL
```

- Event fields:

| Field | Type | Required | Contract |
|---|---|---:|---|
| `session` | string | Yes | Must identify the originating terminal session. |
| `event` | enum | Yes | One of `command_started`, `command_finished`, `prompt_shown`. |
| `exit` | number | Only for `command_finished` | `0` means completed; non-zero means failed. |

- Status mapping:

| Source event | Tab state | Label |
|---|---|---|
| `command_started` | `running` | `运行中` |
| `command_finished` with `exit=0` | `done` | `已完成` |
| `command_finished` with non-zero `exit` | `failed` | `异常退出` |
| `prompt_shown` | no state change | no UI label change |

- Combined status priority:

```text
attention > failed > running > done > none
```

Hook-driven `attention` must win over shell runtime state until the user activates the tab and clears the hook source.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Monitoring setting is disabled | New PTY must not receive `CLI_MANAGER_SHELL_RUNTIME_MONITORING=1`; frontend must ignore shell runtime events for that shell. |
| Shell is not PowerShell / pwsh | Do not inject PowerShell prompt wrapper. Preserve the normal shell launch path. |
| OSC marker is split across output chunks | Buffer until `BEL`, then parse and strip before writing to xterm. |
| OSC marker remains unterminated beyond the safety limit | Drop the buffered private marker fragment instead of writing it to xterm. |
| Unknown event name | Ignore the marker and do not update status. |
| Invalid or missing `exit` on `command_finished` | Treat as failure only when the parsed number is finite and non-zero; otherwise do not invent success. |
| Hook and shell state conflict | Resolve by priority, never by last-write-wins alone. |

### 5. Good/Base/Bad Cases

- Good: PowerShell emits `command_finished;exit=0`; frontend strips the marker and tab shows `已完成` with the updated timestamp.
- Base: Monitoring is disabled; PowerShell starts normally and tab state only changes from hook events or direct UI actions.
- Bad: An unterminated OSC marker appears in terminal output; the parser must not leak `]777;cli-manager` text into xterm.

### 6. Tests Required

- TypeScript status reducer assertions:
  - `attention` beats `failed`, `running`, and `done`.
  - `failed` beats `running` and `done`.
  - Clearing hook source reveals the remaining shell status if present.
- xterm parsing assertions:
  - Complete private OSC markers are stripped from visible output.
  - Split markers across chunks are reconstructed.
  - Over-limit unterminated fragments are dropped.
- Rust boundary assertions when feasible:
  - PowerShell / pwsh with monitoring enabled includes `-NoExit -Command` and the prompt wrapper.
  - Non-PowerShell shells keep their normal argument list.
  - `pty_create` always injects `CLI_MANAGER_TAB_ID`.

### 7. Wrong vs Correct

#### Wrong

```ts
// Last write wins: a background shell completion can hide a pending approval.
tabNotifications[sessionId] = shellStatus;
```

#### Correct

```ts
// Keep per-source state, then resolve by explicit priority.
const candidates = [state.hook ?? "none", state.shell ?? "none"];
const visible = candidates.reduce(
  (current, next) => (TAB_STATUS_PRIORITY[next] > TAB_STATUS_PRIORITY[current] ? next : current),
  "none"
);
```

#### Wrong

```rust
// Modifies user profile or requires persistent shell configuration.
// This leaks application behavior outside the PTY session.
```

#### Correct

```rust
// Inject only into this PTY session.
vec!["-NoLogo".to_string(), "-NoExit".to_string(), "-Command".to_string(), script]
```
