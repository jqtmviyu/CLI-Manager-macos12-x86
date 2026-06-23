# 修复分屏后原 Tab 历史输出丢失

## Goal

修复手动分屏或 CLI Hook 自动识别 sub-agent 后触发自动分屏时，原有 Tab/终端面板的历史输出内容丢失问题，确保分屏只改变布局，不重置原终端会话的显示缓冲与会话绑定。

## What I already know

* 用户反馈：执行分屏后，原来的 tab 中历史输出内容会丢失。
* 触发路径包括：手动分屏、自动识别到 sub-agent hook 后进行自动分屏。
* 项目终端布局由 `src/stores/terminalPaneTree.ts` 管理，终端核心状态由 `src/stores/terminalStore.ts` 管理。
* `SplitTerminalView` 递归渲染 pane 树；分屏本身会引入新的 split node 和 pane leaf。
* 需要重点排查 xterm buffer、React remount、sessionId 绑定、pane leaf/sessionIds 是否被重建或错误移动。

## Assumptions (temporary)

* 原 PTY 后端会话未丢失，问题更可能出在前端 xterm 实例/DOM remount 导致 scrollback buffer 重建。
* 手动分屏与 sub-agent 自动分屏共享某些 pane tree 或渲染路径，因此应优先找共同路径。

## Requirements

* 分屏操作不得清空或重建原 session 的可见终端历史输出。
* 手动分屏与 sub-agent hook 自动分屏都要覆盖。
* 修复应尽量保持现有 pane tree、Tab 状态、hook 通知状态行为不变。
* 分屏/取消分屏/拖拽调整比例仍应保持现有 UX。
* 本任务只允许修改本问题相关前端文件和 `.trellis/tasks/06-23-tab/*`；不得提交、删除或整理其他并行任务文件。

## Acceptance Criteria (evolving)

* [ ] 在已有终端输出若干历史内容后执行手动分屏，原 pane 中历史内容仍可见且可滚动。
* [ ] sub-agent hook 自动分屏创建只读转录面板后，父 terminal tab 的历史内容仍可见且可滚动。
* [ ] 分屏后新建 pane/session 正常显示，不影响 active session/pane 切换。
* [ ] 分屏比例拖拽调整仍正常工作。
* [ ] 前端类型检查 `npx tsc --noEmit` 通过（如本轮执行验证）。

## Definition of Done (team quality bar)

* Tests added/updated where practical, or manual verification path documented if UI/xterm behavior不适合单测。
* Typecheck/build validation considered.
* 不主动提交 git commit，除非用户明确要求。

## Out of Scope (explicit)

* 不重做终端分屏整体架构。
* 不改变 CLI Hook 协议或后端 PTY 生命周期，除非定位证明必须。
* 不新增大规模终端历史持久化能力。

## Technical Approach

采用扁平绝对定位 split 渲染：从 pane tree 计算每个 leaf 的矩形区域和每条 divider 的矩形区域，所有 `PaneLeafView` 作为同一父容器下以 `pane.id` 为 key 的稳定子节点渲染。分屏/调整比例只改变 style 中的位置与尺寸，不改变原 leaf 的 React 父路径，从而避免 `XTermTerminal` 被卸载并丢失 xterm scrollback。

## Decision (ADR-lite)

**Context**: xterm scrollback 存在于 `XTermTerminal` 组件实例内。当前递归嵌套渲染会在 leaf 被 split 包裹时改变 React 父路径，导致原终端组件卸载/重建。

**Decision**: 改造 `SplitTerminalView` 为扁平布局渲染，保持 pane leaf 组件身份稳定。

**Consequences**: 需要在 `SplitTerminalView` 内计算 split geometry；但无需改后端 PTY、无需引入 xterm 序列化依赖，也不会改变 store 的 pane tree 数据结构。

## Technical Notes

* `src/components/SplitTerminalView.tsx`：当前递归渲染 split tree，leaf 通过外部 `renderLeaf` 渲染；本任务主要改这里。
* `src/stores/terminalPaneTree.ts`：`splitPaneLeaf()` 保留原 leaf 对象作为 first，将新 session 放入 second；逻辑本身不会移除原 session。
* `src/components/TerminalTabs.tsx`：`PaneLeafView` 使用 `key={pane.id}`，但递归父路径改变仍会触发 remount；扁平布局可避免父路径变化。
* GitNexus impact：`SplitTerminalView` 未命中独立符号；`PaneLeafView` / `XTermTerminal` / `splitPaneLeaf` / `openSubagentTranscript` 上游风险均为 LOW。`splitPaneLeaf` 仅影响手动 split 和 sub-agent transcript split。
