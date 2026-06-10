# fix-flashing-console-windows：消除 Windows 下后台进程闪出的 CMD 窗口

## Goal

CLI-Manager 是 GUI（windows subsystem）应用，但 Rust 端用 `std::process::Command` 静默执行外部命令时**均未设置 `CREATE_NO_WINDOW` creation flag**，导致每次 spawn 都弹出一个控制台窗口并一闪而过。修复所有"静默执行"的进程创建点，保证后台命令不再弹窗。

## 根因诊断（已确认）

用户观察到两类闪窗，对应两个代码位置：

1. **ccusage 统计面板弹出多个 CMD 窗口**（必现）：`src-tauri/src/commands/ccusage.rs:46-63` 的 `command_output()` 在 Windows 下用 `cmd /C <program>` 包装执行，未加 `CREATE_NO_WINDOW`：
   - 打开面板 `ccusage_get_status` → `version_of("bun")` + `version_of("bunx")` → 2 个闪窗；
   - 刷新报告 `ccusage_refresh_report` → 连续 3 次 `bunx ccusage`（daily/session/blocks）→ 3 个闪窗（即用户看到的"几个 cmd 窗口"）；
   - 安装工具 `ccusage_install_tools` → `npm install -g bun` → 1 个闪窗。
2. **内部终端启动偶发闪窗**：`src-tauri/src/shell_resolver.rs:78,103` 解析 Git Bash 路径时 fallback 到 `reg query`（App Paths 4 个 key + Uninstall 4 个 key，最多 8 次 spawn），同样未加 `CREATE_NO_WINDOW`。仅在固定路径与 PATH 查找都未命中时触发，因此"偶尔"出现。

**用户假设的澄清**：闪窗不是 claude / codex CLI 在 PTY 内调用 npm/uv 引起的——内置终端走 ConPTY（portable-pty），其子进程附加到伪控制台，不会另开窗口。闪窗全部来自应用自身在 GUI 进程里直接 spawn 的 `cmd` / `reg`。

**无需修改的点**：`src-tauri/src/commands/shell.rs:85` spawn `wt.exe` 是有意打开外部终端窗口，保持原样。

## Requirements

- 新增一个小 helper（建议放 `shell_resolver.rs` 或独立 `process_util`，二选一以最少改动为准）：构造"静默 Command"，Windows 下统一附加 `creation_flags(0x0800_0000 /* CREATE_NO_WINDOW */)`（通过 `std::os::windows::process::CommandExt`，用 `#[cfg(windows)]` 隔离），非 Windows 平台行为不变。
- `ccusage.rs::command_output` 与 `shell_resolver.rs` 两处 `reg query` 改用该 helper（或各自原地加 cfg 行，若 helper 反而增加复杂度——以最简实现为准）。
- 不改变任何命令的参数、环境变量、输出解析逻辑。

## Acceptance Criteria

- [ ] 打开/刷新 ccusage 统计面板时不再弹出任何控制台窗口，数据正常返回。
- [ ] 新建 Git Bash 内部终端（含 registry fallback 路径）不再闪窗。
- [ ] `open_windows_terminal`（外部终端）行为不变，仍正常弹出 Windows Terminal。
- [ ] `cd src-tauri && cargo check` 通过；现有 `cargo test` 不回归。

## Definition of Done

- cargo check / test 通过；改动范围报告给用户，运行时 UI 验证由用户执行（团队约定：validation scope）。
- 不新增依赖（`CommandExt` 是标准库）。

## Out of Scope

- 不重构 ccusage 的命令编排（3 次串行调用合并等）。
- 不处理 PTY 内 CLI 工具自身的子进程行为（非本应用可控，且 ConPTY 下无此问题）。
- 不引入 tauri-plugin-shell 替换 std::process。

## Decision (ADR-lite)

**Context**：闪窗来源可能被误判为 PTY 内 claude/codex 调用 npm/uv；需确认真实来源并选择修法。
**Decision**：根因是应用自身 spawn `cmd`/`reg` 未设 `CREATE_NO_WINDOW`；用标准库 `CommandExt::creation_flags` 最小修复，不引入插件或重构。
**Consequences**：后台命令彻底静默；后续新增任何静默 spawn 必须复用同一 helper（写入实现注释即可），否则会复发。

## Technical Notes

- 涉及文件：`src-tauri/src/commands/ccusage.rs`、`src-tauri/src/shell_resolver.rs`（helper 若独立成模块则另加一个小文件 + `lib.rs` mod 声明）。
- `CREATE_NO_WINDOW = 0x08000000`；只影响新进程的控制台创建，不影响 stdout/stderr 捕获（`.output()` 仍正常工作）。
- `bunx`/`npm` 是 `.cmd` shim，Windows 下仍需经 `cmd /C` 执行（现有包装保留），只补 creation flag。
