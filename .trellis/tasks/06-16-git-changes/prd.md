# Git Changes 文件树面板

## 需求概述

在 CLI-Manager 项目中实现 Git Changes 文件树功能，复用 new-CLI-Manager 的手写递归树组件架构，并与现有实时统计面板保持一致的 UI 风格。

## 功能需求

### 1. Git Changes 数据获取
- **Rust 后端**：新增 `git_get_changes` 命令
  - 执行 `git status --porcelang=v2` 获取工作区变更
  - 解析文件路径、状态（M/A/D/R/U）、增删行数
  - 返回树形结构数据

### 2. 文件树 UI 组件
- **复用架构**：参考 new-CLI-Manager 的 `ProjectTree.tsx` + `TreeNodeItem.tsx`
- **递归渲染**：支持目录折叠/展开、文件列表
- **Git 状态标记**：
  - Modified (M) = 橙色
  - Added (A) = 绿色
  - Deleted (D) = 红色
  - Renamed (R) = 蓝色
  - Untracked (U) = 灰色
- **交互功能**：
  - 点击文件：打开外部编辑器或在终端显示 diff
  - 右键菜单：查看 diff、暂存、撤销更改、忽略文件
  - 键盘导航：ArrowUp/Down/Left/Right、Enter、Space

### 3. UI 集成
- **入口位置**：在侧边栏底部，统计按钮（BarChart3）后增加文件列表按钮（FileText）
- **面板样式**：与 `StatsPanel` 保持一致
  - 使用相同的 Portal + 弹层容器
  - 卡片样式、按钮、间距统一
  - 支持响应式布局

### 4. 设置项
- **新增设置字段**：`gitChangesEnabled: boolean`（默认 `true`）
- **设置入口**：在"通用"设置页新增"显示 Git 变更按钮"开关
- **显隐控制**：
  - 当 `gitChangesEnabled = false` 时隐藏侧边栏按钮
  - 当 `gitChangesEnabled = true` 时显示按钮

### 5. 状态管理
- **新增 Store**：`src/stores/gitStore.ts`
  - `changes: GitFileChange[]` - 变更文件列表
  - `collapsedDirs: Set<string>` - 折叠的目录
  - `loading: boolean` - 加载状态
  - `error: string | null` - 错误信息
  - `fetchChanges(projectPath: string)` - 获取变更
  - `toggleDir(path: string)` - 切换目录折叠状态

## 技术方案

### 文件结构
```
src-tauri/src/commands/
  └── git.rs                      # 新增：Git 命令

src/components/git/
  ├── GitChangesPanel.tsx         # 主面板（仿 StatsPanel）
  ├── GitChangesTree.tsx          # 文件树容器（仿 ProjectTree）
  ├── GitTreeNode.tsx             # 树节点（仿 TreeNodeItem）
  └── GitStatusIcon.tsx           # Git 状态图标

src/stores/
  └── gitStore.ts                 # Git 状态管理

src/lib/
  └── types.ts                    # 新增 GitFileChange 类型
```

### 数据类型
```typescript
// src/lib/types.ts
export interface GitFileChange {
  path: string;
  status: "M" | "A" | "D" | "R" | "U" | "??";
  staged: boolean;
  added: number;
  deleted: number;
}

export interface GitTreeNode {
  type: "file" | "directory";
  name: string;
  path: string;
  children?: GitTreeNode[];
  change?: GitFileChange;
}
```

### Rust 命令
```rust
// src-tauri/src/commands/git.rs
#[tauri::command]
pub fn git_get_changes(project_path: String) -> Result<Vec<GitFileChange>, String>
```

### UI 风格约束
- 按钮图标：使用 `lucide-react` 的 `FileText` 图标
- 面板尺寸：与 StatsPanel 一致（最大宽度 1400px，居中）
- 卡片样式：复用 `<Card>` 组件
- 按钮样式：复用 `<Button>` 组件
- 配色方案：遵循当前主题变量（`--primary`、`--success`、`--danger` 等）

## 验收标准

1. ✅ 侧边栏底部出现"文件列表"按钮（在统计按钮右侧）
2. ✅ 点击按钮打开 Git Changes 面板，显示当前项目的文件变更
3. ✅ 文件树支持目录折叠/展开，Git 状态颜色标记正确
4. ✅ 设置中可以控制按钮显示/隐藏
5. ✅ 无文件变更时显示 Empty State 提示
6. ✅ UI 风格与实时统计面板一致

## 非目标（本期不做）

- ❌ 内联 diff 预览
- ❌ 暂存/提交/推送等 Git 操作
- ❌ 实时监听文件系统变化（首次打开时手动刷新）
- ❌ 多项目同时显示
