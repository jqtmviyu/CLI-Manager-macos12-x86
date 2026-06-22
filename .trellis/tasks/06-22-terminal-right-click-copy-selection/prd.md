# terminal-right-click-copy-selection

## Goal

终端区域右键行为改为：有选中文字时右键直接复制并且不弹出右键菜单；没有选中文字时仍弹出终端右键菜单。

## What I already know

- 用户明确要求：终端中选中文字后，右键直接复制；不再弹出右键菜单。
- 用户明确要求：如果没有选中文字，仍弹出右键菜单。
- 现有终端组件是 `src/components/XTermTerminal.tsx`。
- `src/main.tsx` 已全局禁用 WebView 默认右键菜单，组件自定义 `contextmenu` 不受影响。
- 现有 `XTermTerminal` 已有 `copyTextToClipboard()`、Ctrl+C 选中复制、菜单复制、菜单粘贴、全选等逻辑。
- 现有终端右键监听在 `XTermTerminal` 的 `contextmenu` 事件中统一 `preventDefault()` 后打开自定义菜单。

## Requirements

- 终端有选区时，右键触发复制当前选中文本。
- 终端有选区时，不显示终端右键菜单。
- 终端无选区时，保持现有右键菜单行为。
- 不新增依赖，不改后端，不引入新的全局状态。

## Acceptance Criteria

- [ ] 选中终端文本后右键：文本写入剪贴板。
- [ ] 选中终端文本后右键：不出现终端右键菜单。
- [ ] 未选中终端文本时右键：仍出现现有终端右键菜单。
- [ ] Ctrl+C 选中复制、Ctrl+V 粘贴、菜单粘贴/全选等现有行为不被破坏。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- TypeScript 类型检查通过。
- 手工验收清单列出给用户，由用户在 Tauri 桌面运行态验证。
- 不启动 CLI-Manager 桌面应用做 AI 运行态验证（遵守项目规范）。

## Technical Approach

在 `src/components/XTermTerminal.tsx` 的 `contextmenu` 事件处理器中优先判断 `terminal.hasSelection()`：

- 有选区：阻止默认右键事件，直接复用现有复制逻辑复制 selection，清除选区并聚焦终端，不调用 `setMenuState()`。
- 无选区：继续走现有 `setMenuState()` 打开菜单。

## Decision (ADR-lite)

**Context**: 当前右键菜单即使有选区也会弹出，用户希望更接近终端常见交互：选区右键即复制。

**Decision**: 做最小前端局部改动，仅调整 `XTermTerminal` 的右键事件分支。

**Consequences**: 有选区时用户不能通过右键菜单访问“粘贴/全选/关闭终端/分屏”等菜单项；需先取消选区后右键打开菜单。这符合用户本次明确要求。

## Out of Scope

- 不新增设置项控制右键行为。
- 不调整右键菜单样式。
- 不调整全局 WebView 右键禁用策略。
- 不改 xterm 选择、复制、粘贴底层实现。

## Technical Notes

- Trellis package context: single-repo，相关 spec layer 为 `frontend`。
- 已读规范：`.trellis/spec/frontend/index.md`、`component-guidelines.md`、`state-management.md`、`quality-guidelines.md`、`.trellis/spec/guides/index.md`。
- GitNexus impact: `XTermTerminal` upstream 风险 LOW，direct callers 0，affected processes 0。
- 相关文件：
  - `src/components/XTermTerminal.tsx`
  - `src/main.tsx`
