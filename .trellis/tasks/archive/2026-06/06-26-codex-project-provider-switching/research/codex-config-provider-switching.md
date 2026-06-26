# Codex CLI provider switching research

## Sources

- OpenAI Codex Configuration Reference: https://developers.openai.com/codex/config-reference
- OpenAI Codex Advanced Configuration: https://developers.openai.com/codex/config-advanced
- OpenAI Codex repo config docs: https://github.com/openai/codex/blob/main/docs/config.md

## Findings

- Codex user-level configuration lives under `CODEX_HOME`, defaulting to `~/.codex`.
- User config file: `~/.codex/config.toml`.
- Named profile config files live next to the user config as `$CODEX_HOME/<profile-name>.config.toml`.
- `codex --profile <profile-name>` loads `~/.codex/config.toml`, then overlays `~/.codex/<profile-name>.config.toml`.
- Profiles should use top-level config keys directly, not legacy `[profiles.<name>]` tables.
- Codex supports CLI one-off config overrides with `-c` / `--config`; values are parsed as TOML.
- Codex project config files live at `<repo>/.codex/config.toml` and can be nested. Codex walks from project root to cwd and loads matching project configs.
- Project config loading requires project trust. If the project is untrusted, Codex ignores project `.codex/` layers, including project config, project hooks, and project-local rules.
- Project-local `.codex/config.toml` cannot override provider/auth/profile routing keys. Codex ignores and warns on these keys in project-local config: `openai_base_url`, `chatgpt_base_url`, `apps_mcp_product_sku`, `model_provider`, `model_providers`, `notify`, `profile`, `profiles`, `experimental_realtime_ws_base_url`, and `otel`.
- Custom provider TOML shape:

```toml
model = "gpt-5.4"
model_provider = "proxy"

[model_providers.proxy]
name = "OpenAI using LLM proxy"
base_url = "http://proxy.example.com"
env_key = "OPENAI_API_KEY"
```

- If only the built-in OpenAI provider base URL needs redirecting, user/profile config can set:

```toml
openai_base_url = "https://us.api.openai.com/v1"
```

## Implications for CLI-Manager

- Do not implement Codex project-level provider switching by writing `<project>/.codex/config.toml`; provider/auth/profile keys are intentionally ignored there.
- Preferred implementation: store the user's per-project selected cc-switch `app_type = "codex"` provider in CLI-Manager's project metadata, generate/update `$CODEX_HOME/cli-manager-<provider-id>.config.toml`, and launch Codex with `--profile cli-manager-<provider-id>`.
- Secret values should not be written into profile files or command lines. The profile should reference an env var via `env_key`, and CLI-Manager should inject the actual value into PTY `envVars` before starting Codex.
- `--config` can be a fallback for ephemeral overrides, but profile files are easier to inspect and align with Codex's official model.
- Per-project `CODEX_HOME` would work technically but would split auth/history/hooks/cache and would require broader changes to hook settings, history, and ccusage. It is not recommended for MVP.
