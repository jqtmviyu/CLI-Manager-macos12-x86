# cc-switch Integration Contracts

> Executable contracts for reading the external cc-switch SQLite db and writing
> per-project `.claude/settings.json`. Implementation: `src-tauri/src/commands/ccswitch.rs`.

---

## Scenario: Reading an external tool's SQLite database

### 1. Scope / Trigger

- Trigger: any Tauri command that reads a SQLite file owned by another application
  (here: `~/.cc-switch/cc-switch.db`).

### 2. Signatures

```rust
#[tauri::command]
pub async fn ccswitch_list_providers(
    app: tauri::AppHandle,
    db_path: Option<String>,        // JS 侧传 dbPath（camelCase 自动映射）
) -> Result<CcSwitchProvidersResponse, String>
```

### 3. Contracts

- **Dependency**: use the `sqlx` 0.8 already present in the dependency tree via
  `tauri-plugin-sql` (`default-features = false, features = ["runtime-tokio", "sqlite"]`).
  **Never add `rusqlite`** — `libsqlite3-sys` is a `links = "sqlite3"` crate, two versions
  cannot coexist; the build breaks or pins us to fragile version coupling.
- **Open mode**: `SqliteConnectOptions::new().filename(path).read_only(true)` +
  `SqliteConnection::connect_with`. `create_if_missing` stays default (false) so a typo'd
  path can never create an empty db file.
- **Path resolution**: `None`/blank → default under `app.path().home_dir()`; custom path
  must pass extension allowlist (`.db`) and `is_file()` before any I/O.
- **Secret masking happens in Rust**: env keys containing
  `token|key|secret|auth|password` (case-insensitive) are masked
  (`first 4 + … + last 4`, or `***` if ≤12 chars) before the payload crosses to the
  WebView. Plaintext credentials must never reach the frontend.

### 4. Validation & Error Matrix

| Condition | Error (stable string) |
|-----------|----------------------|
| Path extension is not `.db` | `unsupported_format` |
| File does not exist | `db_not_found` |
| Cannot resolve home dir | `home_dir_unavailable: <err>` |
| SQLite open failure | `db_open_failed: <err>` |
| Query/decode failure | `db_query_failed: <err>` |

### 5. Good/Base/Bad Cases

- Good: no `dbPath` arg → default path resolved, providers returned with masked env.
- Base: custom `dbPath` to a moved db file → `db_not_found`, frontend shows mapped hint.
- Bad: opening read-write or with `create_if_missing(true)` → may create/lock another
  app's database file; forbidden.

### 6. Tests Required

- Unit: `is_secret_env_key` accepts/rejects known key names (`ANTHROPIC_AUTH_TOKEN` vs
  `ANTHROPIC_BASE_URL`).
- Unit: `mask_secret` keeps only edges, handles short/empty strings.
- Unit: settings_config parse failure → provider still listed with `configParseError: true`.

### 7. Wrong vs Correct

#### Wrong
```toml
rusqlite = { version = "0.32", features = ["bundled"] }  # links 冲突 / 重复原生 sqlite
```
#### Correct
```toml
sqlx = { version = "0.8", default-features = false, features = ["runtime-tokio", "sqlite"] }
```

---

## Scenario: Writing provider env into `<project>/.claude/settings.json`

### 1. Scope / Trigger

- Trigger: switching a claude project's API provider (`ccswitch_apply_provider`); any
  future command that rewrites a user-owned JSON config must follow the same posture.

### 2. Signatures

```rust
#[tauri::command]
pub async fn ccswitch_get_project_provider(
    app: tauri::AppHandle,
    project_path: String,
    db_path: Option<String>,
) -> Result<CcSwitchProjectProvider, String>
// { matchedProviderId, hasSettingsFile, baseUrl,
//   localOverrideKeys }  // settings.local.json 中 ANTHROPIC_ 前缀 key 名（只 key 名不含值）

#[tauri::command]
pub async fn ccswitch_apply_provider(
    app: tauri::AppHandle,
    project_path: String,
    provider_id: String,
    db_path: Option<String>,
) -> Result<(), String>                        // unit：不向前端回传任何 env 内容

#[tauri::command]
pub async fn ccswitch_reset_project_provider(
    project_path: String,                      // 无 db_path：恢复全局不读 cc-switch.db
) -> Result<(), String>
// 删除项目 settings.json 的整个 env 字段（用户拍板，含用户自有 key）；
// 删后顶层为空对象 → 删除 settings.json 文件本身（.claude/ 目录保留）；
// 文件不存在 = no-op 成功；损坏 JSON → settings_parse_failed 不动文件

#[tauri::command]
pub async fn ccswitch_probe_projects(
    app: tauri::AppHandle,
    project_paths: Vec<String>,
    db_path: Option<String>,
) -> Result<Vec<CcSwitchProjectBadge>, String>
// 每项 { path, hasOverride, providerName }；单项路径缺失/损坏 JSON 容错为
// hasOverride=false，绝不让整批失败；db 缺失 → db_not_found（前端静默清徽标）
```

### 3. Contracts

- **env replacement rule** (pure fn `replace_anthropic_env` / `merge_settings_text`):
  1. remove every existing env key with prefix `ANTHROPIC_` (clears previous provider
     residue, e.g. stale model mappings);
  2. insert **all** keys from the provider's `settings_config.env` (overwrite on collision);
  3. top-level fields other than `env` (hooks/permissions/...) stay untouched;
  4. only the provider's `env` section is taken — never its `hooks` or other fields.
- **Match rule** (`provider_matches_project_env`): `ANTHROPIC_BASE_URL` equal AND
  (`ANTHROPIC_AUTH_TOKEN` OR `ANTHROPIC_API_KEY`) equal. Comparison runs in Rust only.
- **Atomic write**: serialize with `to_string_pretty`, write `settings.json.tmp` in the
  same directory, then `fs::rename` over the target; clean up tmp on rename failure.
  `create_dir_all` for `.claude/` first.

### 4. Validation & Error Matrix

| Condition | Error (stable string) | File touched? |
|-----------|----------------------|---------------|
| `project_path` is not an existing dir | `project_not_found` | no |
| provider id not in db (app_type='claude') | `provider_not_found` | no |
| provider settings_config invalid / no env object | `provider_config_invalid` | no |
| existing settings.json is invalid JSON / non-object root | `settings_parse_failed` | **no — file left as-is** |
| tmp write / rename failure | `settings_write_failed: <err>` | original intact |

### 5. Good/Base/Bad Cases

- Good: project with user env `HTTP_PROXY` + old provider's `ANTHROPIC_*` → after apply,
  `HTTP_PROXY` survives, all `ANTHROPIC_*` come from the new provider, `hooks` unchanged.
- Base: no `.claude/` or no settings.json → both created, result contains only provider env.
- Bad: corrupted settings.json silently replaced with `{}` — forbidden; must error and
  leave the file byte-identical.

### 6. Tests Required (all in `ccswitch.rs::tests`, run `cargo test ccswitch`)

- residue cleanup + user-key preservation (assert `HTTP_PROXY` survives, stale
  `ANTHROPIC_DEFAULT_*` gone);
- top-level fields untouched (assert `hooks` deep-equal before/after);
- env missing / env non-object → rebuilt as object;
- invalid JSON & non-object root → `Err("settings_parse_failed")`;
- match rule: AUTH_TOKEN path, API_KEY path, and negative case.

### 7. Wrong vs Correct

#### Wrong
```rust
// 整文件替换为 provider 的 settings_config —— 会抹掉项目自有 hooks/permissions
fs::write(settings_path, provider_settings_config)?;
```
#### Correct
```rust
let merged = merge_settings_text(existing.as_deref(), &provider_env)?; // 只替换 env 段
write_atomic(&settings_path, &merged)?;
```

---

## Scenario: Codex project provider switching via generated profiles

### 1. Scope / Trigger

- Trigger: switching a project whose configured CLI tool is exactly `codex` to a
  cc-switch provider with `app_type = 'codex'`.
- This is cross-layer: frontend project metadata selects a provider, backend reads
  cc-switch and writes a Codex profile, and PTY launch injects secret env vars.

### 2. Signatures

```rust
#[tauri::command]
pub async fn ccswitch_prepare_codex_provider(
    app: tauri::AppHandle,
    provider_id: String,
    db_path: Option<String>,
    codex_config_dir: Option<String>,
) -> Result<CcSwitchCodexProviderProfile, String>
// { providerId, providerName, profileName }

pub struct CodexProviderLaunchConfig {
    pub provider_id: String,
    pub db_path: Option<String>,
    pub codex_config_dir: Option<String>,
}

pub(crate) async fn apply_codex_provider_launch_env(
    app: &tauri::AppHandle,
    launch_config: Option<CodexProviderLaunchConfig>,
    env_vars: &mut HashMap<String, String>,
) -> Result<(), String>
```

Database migration:

```sql
ALTER TABLE projects ADD COLUMN provider_overrides TEXT NOT NULL DEFAULT '{}';
```

Frontend project override shape:

```json
{
  "codex": {
    "providerId": "<cc-switch provider id>",
    "providerName": "<display name or null>",
    "profileName": "cli-manager-<slug>-<hash>"
  }
}
```

### 3. Contracts

- **Eligibility**: Codex provider switching is enabled only when
  `project.cli_tool.trim().toLowerCase() === "codex"`. Do not enable it for
  wrapper commands or any value that merely contains `codex`.
- **Provider filtering**: the provider switch modal filters by the active adapter:
  Claude projects show only `appType === "claude"`; exact Codex projects show
  only `appType === "codex"`.
- **Do not write project-local Codex provider config**: never write
  `model_provider`, `model_providers`, `openai_base_url`, `profile`, or auth keys
  into `<project>/.codex/config.toml`; Codex ignores these keys in project-local
  config and emits warnings.
- **Profile location**: generated profiles are written under `CODEX_HOME` when
  set, otherwise under `~/.codex`; if the app passes a custom Codex config dir,
  PTY launch must also inject `CODEX_HOME=<that dir>` so `codex --profile` can
  find the generated profile.
- **Provider input shapes**: cc-switch Codex providers may not be shaped like
  Claude `settings_config.env`. The parser must accept both env-style and
  Codex/config-style shapes:
  - env object keys such as `OPENAI_BASE_URL`, `OPENAI_API_BASE`, `CODEX_BASE_URL`,
    `*_BASE_URL`, `*_API_BASE`, `*_ENDPOINT`, `OPENAI_MODEL`, `CODEX_MODEL`,
    `*_MODEL`, `OPENAI_API_KEY`, `CODEX_API_KEY`, `*_API_KEY`, `*_TOKEN`;
  - top-level equivalents such as `openai_base_url`, `base_url`, `api_base`,
    `endpoint`, `model`, `api_key`, `auth_token`, `token`;
  - auth object equivalents such as `settings_config.auth.OPENAI_API_KEY` or
    `settings_config.auth.api_key`;
  - a TOML string stored in `settings_config.config`, including top-level
    `model_provider`, `model`, and `[model_providers.<id>]` tables;
  - Codex-style provider tables such as `model_providers.<id>.base_url` and
    `model_provider = "<id>"`;
  - lowercase and hyphenated variants by normalizing key names before matching.
- **Profile content**: generated TOML includes non-secret provider routing only,
  for example:

```toml
# Generated by CLI-Manager. Do not put secrets in this file.
model = "gpt-5.4"
model_provider = "cli_manager"

[model_providers.cli_manager]
name = "Provider Name"
base_url = "https://proxy.example.com/v1"
env_key = "CLI_MANAGER_CODEX_PROVIDER_<hash>_API_KEY"
```

- **Secret handling**: API keys/tokens from cc-switch stay in Rust. They must not
  be returned to WebView, written to the generated profile, written to project
  files, or embedded in the startup command. PTY env injection is the only place
  the plaintext secret is applied.
- **Launch command**: for exact Codex projects with empty `startup_cmd`, the
  generated startup command appends `--profile <profileName>` and preserves
  `--no-alt-screen`. If `startup_cmd` is non-empty, do not rewrite it; surface a
  UI warning that the user must manually add `--profile <profileName>`.
- **Reset**: resetting Codex to global removes the `codex` object from
  `provider_overrides`; it does not delete generated profile files in MVP.
- **Claude compatibility**: Claude switching remains `.claude/settings.json` env
  replacement via `ANTHROPIC_*` rules from the previous scenario.

### 4. Validation & Error Matrix

| Condition | Error / behavior |
|-----------|------------------|
| provider id not in cc-switch with `app_type = 'codex'` | `provider_not_found` |
| provider `settings_config` invalid / no object-shaped config | `provider_config_invalid` |
| no base URL-like value in env/top-level/config TOML/model provider table (`OPENAI_BASE_URL`, `openai_base_url`, `base_url`, `*_BASE_URL`, `*_API_BASE`, `*_ENDPOINT`) | `provider_config_invalid: missing_codex_base_url` |
| no API key/token-like value in env/auth/top-level config (`OPENAI_API_KEY`, `api_key`, `*_API_KEY`, `*_TOKEN`) | `provider_config_invalid: missing_codex_api_key` |
| generated profile write/rename fails | `profile_write_failed: <err>` |
| custom `startup_cmd` exists | no command rewrite; UI warning only |
| cc-switch db missing/invalid | same `db_not_found` / `unsupported_format` contracts as provider listing |

### 5. Good/Base/Bad Cases

- Good: exact `cli_tool = "codex"`, empty `startup_cmd`, selected provider has
  base URL + API key in any supported cc-switch shape → backend writes profile
  without the key, terminal launches `codex --profile cli-manager-... --no-alt-screen`,
  and PTY env contains the generated env key with the secret.
- Base: exact `cli_tool = "codex"`, provider uses Codex-style `model_providers`
  table plus top-level `api_key` → parser resolves the selected provider table,
  writes only non-secret route/model fields to the generated profile, and keeps
  `api_key` only in Rust-side launch env.
- Base: provider stores `auth.OPENAI_API_KEY` plus a TOML string in
  `config = 'model_provider = "custom"\nmodel = "gpt-5.5"\n[model_providers.custom]\nbase_url = "..."'`
  → parser reads the secret from `auth`, route/model from TOML, and writes a
  generated profile. If the TOML lacks `base_url`, the user must complete the
  endpoint in cc-switch; no manual Codex profile file is required.
- Base: exact `cli_tool = "codex"`, custom `startup_cmd` → provider override is
  stored and profile is generated, but startup command is not modified; modal
  warns to add `--profile` manually.
- Bad: writing provider settings into `<project>/.codex/config.toml` or storing
  `OPENAI_API_KEY` in `provider_overrides` / generated TOML — forbidden.

### 6. Tests Required

- Rust unit: generated Codex profile contains `base_url`, `model_provider`,
  `env_key`, and optional `model`, but does **not** contain the secret value.
- Rust unit: env-style provider, top-level `openai_base_url` + `api_key`,
  `auth.OPENAI_API_KEY` + `config` TOML string, and Codex-style
  `model_providers.<id>.base_url` shapes all parse successfully.
- Rust unit: lowercase/hyphenated key variants parse via normalized matching.
- Rust unit: missing base URL returns `provider_config_invalid: missing_codex_base_url`.
- Rust unit: missing secret returns `provider_config_invalid: missing_codex_api_key`.
- Rust/command check: `ccswitch_prepare_codex_provider` returns provider/profile
  metadata only; no plaintext env values cross the Tauri boundary.
- TypeScript helper: exact `codex` is eligible; wrapper commands containing
  `codex` are not.
- TypeScript helper: empty `startup_cmd` appends `--profile` + `--no-alt-screen`;
  custom `startup_cmd` returns unchanged.
- UI check: provider list is filtered by adapter app type.

### 7. Wrong vs Correct

#### Wrong
```toml
# <project>/.codex/config.toml -- Codex ignores these project-local keys
model_provider = "proxy"

[model_providers.proxy]
base_url = "https://proxy.example.com/v1"
env_key = "OPENAI_API_KEY"
```

#### Correct
```toml
# $CODEX_HOME/cli-manager-provider.config.toml
model_provider = "cli_manager"

[model_providers.cli_manager]
base_url = "https://proxy.example.com/v1"
env_key = "CLI_MANAGER_CODEX_PROVIDER_<hash>_API_KEY"
```

```typescript
// Empty startup_cmd only; exact codex only
resolveProjectStartupCommand(project) // "codex --profile cli-manager-... --no-alt-screen"
```
