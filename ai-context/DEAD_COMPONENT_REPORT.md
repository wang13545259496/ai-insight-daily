# 剩余无引用组件的处置建议

> 分析时间：2026-10-17
> 分析对象：20 个未被使用但尚未删除的组件，共约 2300 行

## 判定依据

不看组件名，而看四件事：

1. **是否调接口** —— 20 个全部不调接口，都是纯展示组件
2. **是否被同名的新组件替代** —— 最有力的证据
3. **依赖的数据字段是否还存在** —— 引用已删除的字段说明是残留
4. **最后修改时间** —— 多数停在 2026-10-03 的 V7.4.8.12 发布，此后再没动过

## 结论：建议全部删除（分三档风险）

### 第一档：有明确的活体替代者（7 个，1094 行）

| 组件 | 行数 | 被谁替代 | 证据 |
| --- | --- | --- | --- |
| `Header` | 223 | `Navbar` | Header 导航项为「首页/AI资讯/AI模型…」，Navbar 有 11 项含实体库、预测、出行管家，是完整新版 |
| `AIIndexChart` | 207 | `AIIndexCard` | data-center 页实际 import 的是 `AIIndexCard` |
| `AIIndexRefresh` | 173 | 同上 | 与 AIIndexChart 配套的旧版 |
| `ReportCard` | 196 | `app/daily/page.tsx` | 日报页自实现 367 行，未用此组件 |
| `RecommendNews` | 152 | — | 依赖 `recommendScore` 字段，schema 中**不存在**，全项目仅它自己使用 |
| `Container` | 29 | 内联写法 | 内容只有 `max-w-7xl mx-auto px-6`，页面已内联 48 处 |
| `Tag` | 34 | 内联写法 | 34 行徽章，已被内联 `rounded-full px-` 替代 |

### 第二档：旧版首页的模块（4 个，513 行）

| 组件 | 行数 | 说明 |
| --- | --- | --- |
| `HomeDirections` | 152 | 当前首页只 import 了 `NewsTitle` 一个组件 |
| `HomeStats` | 140 | 同上 |
| `HomeLinks` | 128 | 同上 |
| `HomeSearch` | 93 | 同上 |

首页已被重写为自包含的单页（`app/page.tsx` 800+ 行），这些模块无家可归。

### 第三档：疑似被同类新件替代（9 个，约 700 行）

| 组件 | 行数 | 疑似替代者 |
| --- | --- | --- |
| `BusinessCard` | 203 | business 页自实现 |
| `InvestmentRadar` | 171 | investment 页自实现（1000+ 行） |
| `TrendCard` | 150 | `TrendChart`（活体） |
| `OpportunityMapCard` | 132 | opportunity-map 页自实现（962 行） |
| `IndexTrend` | 127 | `AIIndexCard` / `TrendChart` |
| `DashboardStats` | 107 | `AgentDashboardStats`（活体） |
| `IndexDetailCard` | 91 | `AIIndexCard` |
| `EcosystemCard` | 89 | — |
| `IndustryTrendChart` | 55 | `TrendChart`（活体） |

## 建议

**全部删除，但分三次提交**，每次独立构建验证，出问题容易定位。

**唯一值得保留的可能性**：如果「AI 指数」是要做的功能，`IndexTrend`、
`IndexDetailCard`、`AIIndexChart` 可以作为参考实现保留在 `docs/` 或
git 历史里 —— 但 git 本来就保留着，不必占着源码目录。

## 为什么倾向全删

1. **没有任何一个被引用**（三重验证：import / 路径 / JSX 标签）
2. **多数有活体替代者** —— 不是"没做完"，是"做完了新版忘删旧版"
3. **占着源码目录会误导** —— 后来者看到一个 `Header.tsx` 会以为它是导航，
   实际导航是 `Navbar.tsx`。这类误导比多几行代码代价更大。
4. **git 历史完整保留** —— 真需要时可以 `git show <commit>:components/X.tsx` 取回

## 删除前仍需的验证

每档删除后都要跑：

```bash
npx tsc --noEmit
npm run build
# 10 个主要页面 + 详情页 HTTP 200
npx tsx --test lib/agents/travel/*.test.ts lib/ranking/*.test.ts lib/*.test.ts
```
