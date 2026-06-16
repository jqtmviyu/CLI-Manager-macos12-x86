# Phase A 验证：Claude Code 输入框 caret = 框内反色 cell

> 2026-06-16 实测 dump 结论。验证机制成立，可进入 Phase B 实现。

## 方法

在 `resolveCompositionAnchorCell` 命中输入框后临时 `logInfo("[ime-inv]", …)`，dump 框内 `[promptRow, boxBottom]` 每个 cell 的 `isInverse() / getBgColorMode() / getBgColor() / chars` + 硬件光标。用户在多种 caret 位置开始中文 composition 取样。

## 关键发现

1. **Claude Code 用反色（CSI 7m）画 caret**：`isInverse()` 返回 `67108864`（非 0）。caret 是框内**唯一一个**反色 cell，通常是反色 SPACE（`c:" "`）；若 caret 压在已有字符上，则该字符 cell 带反色。
2. **bg 始终默认**（`bgMode:0, bg:-1`）——不是用背景色块画的，判据只需 `isInverse() !== 0`。
3. **反色 cell 精确跟随真实视觉 caret**，硬件光标完全不可信。

## 样本对比（反色 cell vs 当前 boxBottom 锚点 vs 硬件光标）

| 场景 | 反色 cell | 当前锚点 | 硬件光标 | 当前是否错 |
|------|------|------|------|:--:|
| 单行空 `"> "` | `{2,9}` | `{3,9}` | `{3,9}` | ≈ |
| 单行 `"中文abc"` 末尾 | `{9,9}` | `{114,9}` | `{114,9}` | ❌ 钉最右列 |
| 2 行·空续行 | `{2,11}` | `{13,10}` | `{3,11}` | ❌ 钉首行末 |
| 3 行·空续行 | `{2,12}` | `{3,12}` | `{47,15}` | ≈（硬件光标已在框外 y:15） |
| 多行·caret 在中间行 | `{6,11}` | `{6,12}` | `{114,12}` | ❌ 钉底行，硬件光标错行+最右 |

## 结论 → 实现判据

* 命中输入框 `[promptRow, boxBottom]` 后，扫描第一个 `isInverse() !== 0` 的 cell → 锚 `{x, y}`，即真实 caret。
* 扫不到反色 cell（普通 shell；或重绘半帧丢了）→ 回落现有 `boxBottom`/精确光标逻辑，不退步。
* 全程不依赖硬件光标判断 TUI 输入位置（铁律）。

## Codex 实测（2026-06-16，Phase A2）

同一 dump 手法测 Codex（v0.140.0），结论与 Claude Code **相反**：

| 信号 | Claude Code | Codex |
|------|------|------|
| `─` 边框 `ruleFound` | true | **false（无框）** |
| 反色 caret `firstInverse` | 命中 `67108864` | **null（不画反色）** |
| 硬件光标 | 被甩飞（x:114 / y:15 框外） | **精准跟随**（`{2,14}/{2,15}/{2,16}/{9,15}`，行首/续行/中间行都对）|

* 卡底成因：无边框 → `boxBottom` 膨胀到终端末行；反色落空 → 结构兜底把下方状态行 `gpt-5.5 xhigh…` 当框内容 → 判多行 → 锚 `boxBottom`=屏幕最底。
* 判据：反色落空 + `ruleRow >= rows`（无边框）+ `cursor.y >= promptRow` → 信硬件光标 `return cursor`。
* 「全程不信硬件光标」是 **Claude Code 专属**铁律——Codex/普通 shell 靠终端原生光标显示 caret，光标本就准，分流处理。
