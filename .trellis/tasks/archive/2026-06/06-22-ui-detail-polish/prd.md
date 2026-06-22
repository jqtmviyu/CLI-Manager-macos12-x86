# 优化侧边栏、历史与统计布局细节

## Goal

完成 5 项现有桌面 UI 的细节打磨，让历史、侧边栏、实时统计和 Git 变更区域更紧凑、更一致，并减少历史工作区内重复入口。

## What I already know

* 用户要求删除会话历史内的统计按钮。
* 用户要求侧边栏按钮添加悬浮效果，并把侧边栏宽度再窄一点。
* 用户要求历史记录来源使用项目树结构，和分屏的项目树类似。
* 用户要求实时统计和 Git 变更面板宽度再窄一点。
* 用户要求 Git 变更的「全部 / 修改 / 新增 / 删除」四个筛选按钮水平居中排布。
* 项目为 React 19 + TypeScript + Tauri 2，前端唯一静态校验是 `npx tsc --noEmit`。

## Requirements

* 移除历史详情区中的会话统计面板触发按钮和对应侧栏展示入口。
* 保持侧边栏原有功能不变，增强按钮 hover 反馈并缩窄侧边栏视觉宽度。
* 将历史来源/项目过滤区域改成接近项目树/分屏树的层级选择体验。
* 缩窄实时统计侧栏和 Git 变更侧栏的默认/固定宽度。
* Git 变更状态筛选按钮在可用宽度内居中排列。

## Acceptance Criteria

* [ ] 历史工作区不再显示“统计”按钮，也不会打开会话统计侧栏。
* [ ] 侧边栏按钮 hover 时有明显背景/颜色反馈，原有点击行为不变。
* [ ] 侧边栏整体宽度比当前更窄，内容不明显溢出。
* [ ] 历史记录筛选来源/项目区域呈树形结构，并可继续筛选项目。
* [ ] 实时统计与 Git 变更面板宽度比当前更窄。
* [ ] Git 变更四个筛选按钮水平居中，不再贴左排列。

## Definition of Done

* 修改范围集中在前端 UI 组件。
* TypeScript 类型保持正确。
* 不主动提交 git commit。
* 记录无法执行的验证或工具限制。

## Out of Scope

* 不调整后端历史解析、Git 后端逻辑或数据库 schema。
* 不新增前端测试框架、格式化器或依赖。
* 不改变用户已有数据结构和同步行为。

## Technical Notes

* 初步涉及 `src/components/HistoryWorkspace.tsx`、`src/components/history/HistoryListPane.tsx`、`src/components/history/SessionDetailPane.tsx`、`src/components/history/SessionStatsPanel.tsx`、`src/components/sidebar/index.tsx`、`src/components/stats/CcusageStatsPanel.tsx`、`src/components/git/GitChangesPanel.tsx`。
* 项目要求编辑符号前运行 GitNexus impact；当前会优先尝试可用 GitNexus CLI/MCP，若工具缺失则记录限制。
