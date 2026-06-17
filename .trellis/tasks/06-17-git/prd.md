# 统一终端侧边面板并优化 Git 变更体验

## Goal

优化内部终端右侧面板体验：将 `实时统计` 与 `Git 变更` 合并为统一 Tab 侧边面板，支持宽度拖拽调整；让 `Git 变更` 滚动条样式与 `实时统计` 一致，并为 Git 文件树增加一键全部展开/全部收起能力。

## Requirements

* **滚动条统一**：Git 变更面板出现滚动条时，复用 `实时统计` 的 `.ui-thin-scroll` 视觉样式（细滚动条、半透明 thumb、hover 加深）。
* **P1：统一 Tab 面板**：终端右侧只呈现一个侧边面板，顶部提供 `实时统计` / `Git 变更` Tab 切换，避免两个 290px 面板同时挤占终端空间。
* **P2：面板宽度可调**：统一侧边面板左侧提供拖拽调整宽度，默认 290px，限制在合理区间内，并尽量持久化用户选择。
* **Git 文件树展开/收起**：Git 变更面板内增加一键 `全部展开` / `全部收起` 操作，作用于文件夹节点；不是收起整个右侧面板。
* **响应式不倒退**：小窗口下仍保持只显示一个侧边面板，不再因为同时打开两个面板而互斥关闭。
* **多任务并行约束**：只修改本任务必要的前端终端/Git 面板文件；避免触碰已有其他任务改动的 Rust、model pricing、SettingsModal 等文件。

## Acceptance Criteria

* [ ] Git 变更内容超过高度时，滚动条宽度、颜色、圆角、hover 效果与实时统计一致。
* [ ] 终端工具栏的 `实时统计` 和 `Git 变更` 入口能打开同一个右侧面板，并切换到对应 Tab。
* [ ] 统一侧边面板顶部显示 `实时统计` / `Git 变更` Tab，点击后内容正确切换。
* [ ] 侧边面板可拖拽调整宽度，宽度有最小/最大限制，拖拽过程不误触内部内容。
* [ ] Git 变更面板提供 `全部展开` / `全部收起` 控制，文件夹树状态按预期变化。
* [ ] 刷新、筛选、空状态、点击文件打开 diff 等既有 Git 功能不回退。
* [ ] 实时统计 Hook 检查、刷新、会话卡片等既有功能不回退。

## Definition of Done

* 遵循 React/TypeScript 规则：最小 state、Hooks 顶层调用、props/state 不原地突变。
* 变更范围控制在终端侧边面板相关前端文件。
* 执行或说明静态检查范围；按项目规范，运行时 UI 验收由用户手动确认，除非用户明确要求我启动桌面应用。
* 最终报告清楚列出改动文件和未触碰的并行任务区域。

## Technical Approach

* 新增/抽取一个统一终端侧边面板容器，负责：打开状态、当前 Tab、宽度拖拽、宽度持久化、顶部 Tab UI。
* `TerminalTabs` 保留两个工具栏入口：点击 `实时统计` 打开统一侧边面板并激活 stats；点击 `Git 变更` 打开统一侧边面板并激活 git。若当前 Tab 已激活且面板已打开，再次点击关闭。
* `TerminalStatsPanel` 和 `GitChangesPanel` 改为可嵌入统一容器的内容组件，避免自身再各自声明固定 290px 侧栏宽度和边框。
* `GitChangesTree` / `GitTreeNode` 增加可控折叠集合，支持父组件触发全部展开/收起。
* 宽度持久化优先采用低冲突的前端本地持久化方案，避免改动当前已有其他任务正在修改的 `settingsStore.ts`。

## Decision (ADR-lite)

**Context**: 原有实时统计与 Git 变更是两个独立右侧面板，同时打开时占用过大，并且 Git 面板滚动区域与实时统计滚动方式存在视觉差异。用户确认 Git 的“展开/收起”指文件树全部展开/收起，同时要求旧 PRD 中 P1/P2 继续完成。

**Decision**: 本任务采用统一右侧 Tab 面板 + 可拖拽宽度 + Git 文件树全展开/全收起。为降低多任务并行冲突，宽度持久化不改动已被其他任务修改的全局 settings store，优先使用组件内 localStorage key。

**Consequences**: 改动集中在终端/Git 前端组件，冲突面较小；后续若需要把宽度纳入统一设置同步，可再迁移到 `settingsStore` 并加 migrator。

## Out of Scope

* 不新增 Git 文件操作（暂存、撤销、丢弃等）。
* 不改后端 Git 命令与数据获取逻辑。
* 不改 Rust、model pricing、SettingsModal 等其他并行任务文件。
* 不启动桌面应用做运行时 UI 验证，除非用户另行要求。

## Technical Notes

* Relevant code files:
  * `src/components/TerminalTabs.tsx`
  * `src/components/terminal/TerminalStatsPanel.tsx`
  * `src/components/git/GitChangesPanel.tsx`
  * `src/components/git/GitChangesTree.tsx`
  * `src/components/git/GitTreeNode.tsx`
  * possible new `src/components/terminal/TerminalSidePanel.tsx`
* Existing scrollbar class:
  * `src/App.css` `.ui-thin-scroll`
* Existing terminal panel render location:
  * `TerminalTabs.tsx` renders stats/git panels after the terminal content area.
* Applicable specs:
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
