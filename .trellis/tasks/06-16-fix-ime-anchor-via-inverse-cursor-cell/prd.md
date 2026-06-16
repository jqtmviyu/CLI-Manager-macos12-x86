# fix-ime-anchor-via-inverse-cursor-cell

> 重开自归档任务 `archive/2026-06/06-15-fix-claude-code-ime-drift`（五方案全否、2026-06-16 放弃）。
> 用户 2026-06-16 明确要求重开：当前纯结构锚点把 IME 候选框死钉在输入框最后一行末尾，不跟随光标。
> 关联记忆 `[[ime-anchor-freeze-on-composition]]`、`[[feedback-manual-ui-verification]]`。

## Goal

让 Claude Code / Codex 内嵌终端里中文 IME 候选框**跟随用户真实视觉 caret**（行内移动、多行续行都跟），同时**不被流式重绘动画甩飞**。

## 核心思路转变（与归档任务的根本区别）

归档任务的铁律：**TUI 硬件光标（`buffer.cursorX/Y`）不指向底部输入框**——Claude Code 把硬件光标甩到 spinner/状态/尾行，输入框里的视觉光标是它**自己用反色（inverse / CSI 7m）画的字符块**。

五条死方案都在「硬件光标」和「纯结构」之间二选一，都没用过那个**反色光标块本身**：

| 信号 | 跟随真实 caret | 抗动画甩飞 | 状态 |
|------|:---:|:---:|------|
| 硬件光标（原生/采样/续行） | ✅ | ❌ 被甩飞 | 方案 1/2/5 全否 |
| 纯结构锚 boxBottom | ❌ 死钉一处 | ✅ | 方案 4，当前代码 |
| **输入框内 inverse cell** | ✅ 它就是视觉 caret | ✅ 只在框内扫、框外不干扰 | **本任务** |

`@xterm/xterm` 的 `IBufferCell.isInverse(): number` 确认存在（`node_modules/@xterm/xterm/typings/xterm.d.ts:1716`），反色 cell 在 buffer 里读得到。

## What I already know

* 能控制的只有 IME 锚点 DOM（`.xterm-helper-textarea` / `.composition-view`），硬件光标不可约束。
* 现有 `resolveCompositionAnchorCell`（`src/components/XTermTerminal.tsx:788`）已能纯结构识别底部输入框：向上找 `> ` promptRow → 向下找横线 `─` 下边框 → `boxBottom`。这套**结构识别复用**，只换最后的锚点选择（`:866-873`）。
* compositionstart 时 buffer 可信：拼音未转发给 PTY，TUI 不因本次按键重绘（归档任务已确立）。
* `IBufferCell` 还提供 `getBgColor()/getBgColorMode()/isBgDefault()`，用于在 dump 里区分「反色」与「背景色块」两种可能的光标画法。

## 验证优先（铁律：理论必须先被运行日志证实）

归档任务的惨痛教训是 Correction 2/3/4 一个个被真实 buffer dump 推翻。**本任务不先写成品，先取数据。**

### Phase A — 诊断（research）

在 `resolveCompositionAnchorCell` 命中输入框后，加临时 `logInfo("[ime-inv]", …)`，dump：
- promptRow / ruleRow / boxBottom / 硬件 cursor x,y；
- 框内 `[promptRow, boxBottom]` 每行：行号、文本、以及每个非空 cell 的 `x / chars / isInverse / bgColorMode / bgColor`。

用户跑 Claude Code，在 **① 单行行首 ② 单行行中 ③ 单行末尾 ④ 多行续行 ⑤ 刚 Shift+Enter 空续行** 分别开始中文输入，贴回日志。

确认项：
- 框内是否恒有且仅有一个 inverse cell？它的 x 是否就是视觉 caret 列？
- 还是用 bg 色块画的（isInverse=0 但 bg 非默认）？
- 光标是否会闪烁导致 compositionstart 时采不到？

诊断结论写入 `research/inverse-cursor-dump.md`。

### Phase B — 实现（据确认的信号）

改 `resolveCompositionAnchorCell` 锚点选择：命中输入框后，在 `[promptRow, boxBottom]` 内扫描光标 cell（判据按 Phase A 确认：inverse 或 bg 色块），锚到该 cell；**扫不到则回落现有 boxBottom 逻辑**（不退步）。普通 shell 单行 + 硬件光标在该行的精确光标分支保留。删除临时 dump。

## Requirements

* 仅改 `src/components/XTermTerminal.tsx` 的 `resolveCompositionAnchorCell` 一个函数 + 临时 dump。
* 不新增依赖、不改后端 PTY、不改配置、不做无关重构。
* 不改候选框定位/冻结/scroll 锁等其余 IME 机制（`applyCompositionAnchorFix` 等保持原样）。
* 输入框结构识别（promptRow / 横线下边框 / boxBottom）复用，不重写。

## Acceptance Criteria

* [x] Phase A（Claude Code）：dump 证实框内 caret 判据 `isInverse() !== 0`（反色 SPACE `67108864`，bg 默认）。落 `research/inverse-cursor-dump.md`。
* [x] Phase B（Claude Code）：`resolveCompositionAnchorCell` 用框内反色 cell 作主锚点，扫不到回落 boxBottom。已提交 caeb890。
* [x] Phase A2（Codex）：dump 证实 Codex 无 `─` 边框（`ruleFound:false`）、不画反色（`firstInverse:null`）、硬件光标精准跟随。见 research「Codex 实测」节。
* [x] Phase B2（Codex）：反色落空 + 无边框 + `cursor.y>=promptRow` → 直接信硬件光标 `return cursor`。
* [x] 临时 `[ime-inv]` dump 已删除，无残留（grep 确认）。
* [x] `npx tsc --noEmit` 通过。
* [x] 人工验证：Claude Code 单行行内移动 + 多行续行，候选框跟随真实 caret（用户「彻底解决」）。
* [x] 人工验证：Codex 行首/行中/行尾/多行续行/空续行，候选框跟随真实 caret（用户「彻底解决」）。
* [x] 人工验证：普通 shell 输入/回车/粘贴/中文结束行为正常，不回退任一已否方案的症状。

## Out of Scope

* 不重写候选框定位/冻结算法本身。
* 不调整 UI 样式或终端布局，不改 Rust PTY。
* 不启动桌面应用做自动 UI 验证（运行态 IME 只能人工验收）。

## 归档任务的五条死方案（勿重蹈）

1. 静默采样停泊光标判可信度 → 仍采到重绘中途光标。
2. 光标落续行→信任光标 → 多行时光标压根不在续行。
3. 臆测竖边框 `│` 包裹输入框 → 实测无竖边框（横线 `─` 上下包围 + 空格缩进续行）。
4. 纯结构锚 boxBottom → 候选框死钉最后一行（**当前代码、本任务要替换的现状**）。
5. 回退 xterm 原生 IME（跟随硬件光标）→ 流式动画期随光标漂移，用户验证不行。

## Technical Notes

* 相关文件：`src/components/XTermTerminal.tsx`。
* 输入框真实结构（Correction 4 实测）：横线 `─` 上边框 / `> ` 首行 / 2 空格缩进续行（无竖边框）/ 横线 `─` 下边框。
* 参考 spec：`.trellis/spec/frontend/component-guidelines.md`、`quality-guidelines.md`、`type-safety.md`。

## Codex 续修（2026-06-16，Phase A2/B2）

dump 实测推翻"套用 Claude Code 反色法"的预设（教训：别把一个 TUI 的结论套到另一个）：

* Codex（v0.140.0）**无 `─` 边框**（`ruleFound:false`）→ 现有结构识别把 `boxBottom` 算到终端最后一行。
* Codex **不画反色 caret**（`firstInverse:null`）→ 反色扫描对它无效。
* 但 Codex **硬件光标精准跟在真实 caret 上**（`{2,14}/{2,15}/{2,16}/{9,15}`，从不甩飞）——与 Claude Code「光标被甩飞」的铁律相反。
* 卡底成因：反色落空 → 结构兜底把下方状态行 `gpt-5.5 xhigh…` 当框内容 → 判定多行 → 锚 `boxBottom`=屏幕最底。

修复（`XTermTerminal.tsx:875-884`）：反色扫描落空后，若 `ruleRow >= terminal.rows`（无边框）且 `cursor.y >= promptRow`，直接 `return cursor`。三类 TUI 分流：**Claude Code=反色 cell / Codex+普通 shell=硬件光标 / 带框丢帧=结构兜底**。
