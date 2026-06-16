# 供应商设置页优化

## 背景

当前供应商设置页（`ProviderSettingsPage.tsx`）已实现 cc-switch 数据库只读解析、供应商列表/详情展示、按 app_type 筛选等核心能力。经代码审查与用户体验分析，发现以下可优化点：

1. **空态与错误反馈**不够友好，首次使用门槛较高
2. **数据库路径配置区**信息层级不清晰
3. **列表与详情布局**响应式不佳，宽屏浪费空间
4. **交互便捷性**不足（缺少快捷复制、键盘导航等）
5. **性能**在大数据集下有优化空间

## 目标

提升供应商设置页的易用性、视觉层级与交互效率，降低新手使用门槛，提高高频操作便捷性。

## 优化清单

### P0：高优先级（必须实施）

#### 1. 空态体验优化
**现状**：首次打开或数据库路径错误时，页面几乎空白，用户不知道如何开始。

**优化**：
- 数据库未连接时显示引导卡片：
  - 说明 cc-switch 作用
  - 提供官网链接（`https://github.com/your-org/cc-switch`）
  - 引导步骤：安装 cc-switch → 配置供应商 → 回到此页刷新
- 错误提示改用醒目样式（红色边框 + 图标）

**交付物**：
- 新增 `<EmptyStateCard />` 组件
- 修改 `error` 展示样式

#### 2. 数据库路径卡片优化
**现状**：路径、按钮、说明混在一起，信息层级不清晰。

**优化**：
- 顶部显示连接状态徽标（已连接/未连接）
- 路径展示用独立代码块背景区分
- 按钮右对齐，"使用默认路径"文案改为更明确的"重置为默认"
- 说明文案精简，强调"只读、脱敏"

**交付物**：
- 重构数据库配置卡片布局
- 更新按钮文案与排列

#### 3. 供应商详情面板增强
**现状**：BASE_URL、环境变量等关键信息无快捷复制入口。

**优化**：
- BASE_URL 行右侧添加复制按钮（点击复制 URL，toast 提示"已复制"）
- 环境变量每行右侧添加复制按钮（复制 `KEY=VALUE` 格式）
- `configParseError` 为 true 时，在详情面板顶部显示明确错误说明（而不只是徽标）

**交付物**：
- 新增 `<CopyButton />` 微组件（可复用）
- 详情面板新增错误说明区块

### P1：中优先级（建议实施）

#### 4. 列表布局响应式优化
**现状**：左侧列表固定 360px，宽屏下浪费空间；列表项高度略大。

**优化**：
- 列表宽度改为 `min-w-[280px] max-w-[400px] w-[30%]`（响应式）
- 列表项 padding 从 `px-3 py-2.5` 改为 `px-2.5 py-2`
- 列表项卡片间距从 `space-y-1.5` 改为 `space-y-1`

**交付物**：
- 修改列表容器与列表项样式

#### 5. 搜索范围扩展
**现状**：搜索只匹配 name/baseUrl/category/model，用户无法按官网、备注搜索。

**优化**：
- 搜索范围扩展到 `websiteUrl`、`notes`
- 无结果时显示："未找到匹配「xxx」的供应商，已搜索：名称、BASE_URL、分类、模型、官网、备注"

**交付物**：
- 修改 `visibleProviders` 筛选逻辑
- 更新无结果提示文案

#### 6. 性能优化：按 appType 预分组
**现状**：每次切换 appType 或搜索都重新 filter 全量 providers。

**优化**：
```tsx
// 按 appType 预分组，避免每次 filter
const providersByType = useMemo(() => {
  return (data?.providers ?? []).reduce((acc, p) => {
    if (!acc[p.appType]) acc[p.appType] = [];
    acc[p.appType].push(p);
    return acc;
  }, {} as Record<string, CcSwitchProvider[]>);
}, [data]);

const visibleProviders = useMemo(() => {
  const list = providersByType[appTypeFilter] ?? [];
  const keyword = searchValue.trim().toLowerCase();
  if (!keyword) return list;
  return list.filter(/* 搜索逻辑 */);
}, [providersByType, appTypeFilter, searchValue]);
```

**交付物**：
- 新增 `providersByType` memo
- 重构 `visibleProviders` 计算逻辑

### P2：低优先级（有余力实施）

#### 7. 刷新成功反馈
**现状**：点击"刷新"按钮后无成功提示，用户不确定是否刷新完成。

**优化**：
- 刷新成功后 toast 提示"已刷新，共 X 个供应商"

#### 8. 供应商数量提示
**优化**：
- 在筛选器下方显示"共 X 个供应商"（当前 appType）

#### 9. 环境变量折叠显示
**现状**：环境变量很多时（>10 个）占用大量空间。

**优化**：
- 默认显示前 5 个 + "展开全部（还有 N 个）"按钮
- 展开后显示全部 + "收起"按钮

## 非目标

- **不做**：虚拟滚动（当前供应商数量 < 100，性能瓶颈不在此）
- **不做**：键盘导航（当前交互足够简洁，优先级不高）
- **不做**：分类筛选组件替换（SegmentedControl 目前够用）

## 技术约束

- 保持现有组件结构，避免大规模重构
- 复用 Mantine + Tailwind 现有组件，不引入新依赖
- 后端 `ccswitch.rs` 不修改，仅前端优化

## 验收标准

### P0 验收
- [ ] 数据库未连接时显示引导卡片，含 cc-switch 官网链接
- [ ] 错误提示样式醒目（红色边框 + 图标）
- [ ] 数据库路径卡片显示连接状态徽标
- [ ] BASE_URL 与环境变量每行有复制按钮，点击复制成功并 toast 提示
- [ ] `configParseError` 供应商在详情面板顶部显示错误说明

### P1 验收
- [ ] 列表宽度响应式，宽屏下占比合理（约 30%）
- [ ] 列表项高度降低，一屏可显示更多供应商
- [ ] 搜索可匹配官网、备注字段
- [ ] 搜索无结果时提示已搜索的字段范围
- [ ] 切换 appType 或搜索时无明显卡顿（100 个供应商以内）

### P2 验收
- [ ] 刷新成功后 toast 提示"已刷新，共 X 个供应商"
- [ ] 筛选器下方显示"共 X 个供应商"
- [ ] 环境变量 >5 个时支持折叠/展开

## 实施顺序

1. **第一批**（P0-1、P0-2）：空态引导 + 数据库路径卡片优化
2. **第二批**（P0-3）：复制按钮 + 错误说明
3. **第三批**（P1-4、P1-5）：列表布局优化 + 搜索扩展
4. **第四批**（P1-6）：性能优化（预分组）
5. **第五批**（P2，可选）：刷新反馈 + 数量提示 + 环境变量折叠

## 开发工时估算

- P0：2-3 小时
- P1：1.5-2 小时
- P2：1 小时
- **总计**：4.5-6 小时

## 附录

### 相关文件
- `src/components/settings/pages/ProviderSettingsPage.tsx`
- `src/components/ProviderSwitchModal.tsx`（供应商切换弹窗，复制按钮组件可复用）
- `src-tauri/src/commands/ccswitch.rs`（后端实现参考，本次不修改）

### UI 参考
- 复制按钮：参考 `lucide-react` 的 `Copy` 图标 + Mantine `ActionIcon`
- 连接状态徽标：Mantine `Badge` 组件，绿色"已连接" / 灰色"未连接"
- 错误提示：红色边框 + `AlertTriangle` 图标
