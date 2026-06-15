# 修复 Codex 未识别安装目录仍可安装 Hook

## Goal

修复 Hook 设置页中 Codex CLI 在未识别/未选择有效配置目录时仍然可以安装 Hook 的问题，避免应用在用户未确认 Codex 安装位置的情况下自动创建或写入 `~/.codex`。

## What I already know

* 用户反馈：Codex 未识别到安装目录时仍可以安装 hook。
* 前端 `HookSettingsPage` 中 Codex 安装按钮当前只按 `loading || codexWorking` 禁用，未像 Claude 一样结合 `directoryMissing` 状态禁用。
* 后端 `hook_settings_install_codex` 调用 `resolve_codex_dir(codex_selected_dir, true)`，会在默认 `~/.codex` 不存在时自动创建目录并继续安装。
* `hook_settings_get_status` 使用 `resolve_codex_dir(codex_selected_dir, false)`，当默认目录不存在且未选择目录时会返回 `directoryMissing`。

## Requirements

* Codex 配置目录未识别/未选择时，前端“安装 Codex Hook”按钮应禁用。
* 后端安装命令也必须防守：未识别/未选择有效 Codex 配置目录时拒绝安装，不自动创建默认 `~/.codex`。
* 用户手动选择一个已存在的 Codex 配置目录后，仍可安装/删除 Hook。
* 保持现有 Hook 状态展示、脚本写入、`hooks.json` 与 `config.toml` 写入逻辑不变。

## Acceptance Criteria

* [ ] 默认 `~/.codex` 不存在且未手动选择 Codex 目录时，状态为 `directoryMissing`，安装按钮不可点击。
* [ ] 直接调用 `hook_settings_install_codex` 且目录未识别时返回明确错误，不创建 `~/.codex`。
* [ ] 选择不存在的 Codex 目录时刷新/安装仍报“选择的 Codex 配置目录不存在”。
* [ ] 选择已存在的 Codex 目录或默认 `~/.codex` 已存在时，安装逻辑保持原行为。

## Definition of Done

* 前端与后端双层防护完成。
* Rust 相关单元测试补充或更新。
* 至少运行相关后端测试；如未运行需说明。
* 不提交 git commit，除非用户明确要求。

## Technical Approach

最小修复：

1. 前端在 Codex 安装按钮上复用 `codexStatus === "directoryMissing"` 禁用条件，与删除按钮和 Claude 安装按钮保持一致。
2. 后端 `hook_settings_install_codex` 改为不创建目录地解析 Codex 目录；没有可用目录时返回“请先选择 Codex 配置目录”。
3. 保留 `resolve_codex_dir(..., true)` 的能力给未来显式创建场景，但本安装入口不使用自动创建。
4. 补充针对 `resolve_codex_dir(None, true/false)` 或安装入口行为的测试，锁定“不自动创建默认目录”的安装语义。

## Decision (ADR-lite)

**Context**: Hook 安装属于用户级配置文件写入，未识别安装目录时自动创建默认目录会让 UI 状态与实际写盘行为不一致。  
**Decision**: 安装入口改为必须已有可识别 Codex 配置目录或用户手动选择有效目录；不在安装时自动创建默认目录。  
**Consequences**: 行为更保守，需要用户先安装/初始化 Codex 或选择现有目录；避免误写用户目录。

## Out of Scope

* 不调整 Codex Hook 脚本内容与事件协议。
* 不新增自动探测 Codex 可执行文件安装位置。
* 不改 Claude Hook 行为。
* 不改历史/统计读取 Codex 目录逻辑。

## Technical Notes

* Frontend: `src/components/settings/pages/HookSettingsPage.tsx`
* Backend: `src-tauri/src/commands/hook_settings.rs`
* Spec: `.trellis/spec/guides/tauri-user-file-security-checklist.md` 强调用户路径/配置写入需要保守防护。
