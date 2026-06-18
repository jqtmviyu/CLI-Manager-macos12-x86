# 统一缓存用量展示口径

## Goal

统一 Token 用量相关界面的缓存口径，用户可见文案只使用“缓存命中”和“缓存写入”。

## Requirements

- 将“缓存读”“Cache Read”统一为“缓存命中”。
- 将“缓存写”“写入缓存”“Cache Creation”“Cache Create”统一为“缓存写入”。
- 只修改用户可见文案，不修改字段名、数据结构、计费逻辑或历史数据解析逻辑。

## Acceptance Criteria

- [ ] 实时统计卡片和 tooltip 显示“缓存命中”“缓存写入”。
- [ ] 历史统计 Token 构成显示“缓存命中”“缓存写入”。
- [ ] ccusage Token 构成显示“缓存命中”“缓存写入”。
- [ ] 模型价格设置页缓存价格口径显示“缓存命中”“缓存写入”。
- [ ] TypeScript 检查通过，或明确说明无法验证的原因。

## Definition of Done

- 代码改动最小化。
- 不引入新依赖。
- 不改后端接口和存储字段。

## Technical Approach

直接替换展示层字符串，保留 `cache_read_*`、`cache_creation_*`、`cacheRead*`、`cacheCreation*` 等内部字段名。

## Out of Scope

- 不调整价格计算。
- 不调整历史统计聚合。
- 不重命名 TypeScript/Rust 字段。

## Technical Notes

- 初步定位文件：
  - `src/components/stats/termStatsCards.tsx`
  - `src/components/stats/termStatsUi.tsx`
  - `src/components/stats/StatsPanel.tsx`
  - `src/components/stats/CcusageStatsPanel.tsx`
  - `src/components/settings/pages/ModelPricingSettingsPage.tsx`
