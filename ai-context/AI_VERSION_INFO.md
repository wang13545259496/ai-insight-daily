# AI Insight Daily 交接包版本信息

> 版本：V3.0（2026-10-17）
>
> V1.0 为 266 行但仅约 1100 字符，信息密度过低；
> V2.0 压缩为紧凑版并加入自动更新标记；
> V3.0 因数据库结构、部署方式、AI 体系同时发生重大变化而升级。

---

## 当前版本

| 项 | 值 |
| --- | --- |
| 交接包名称 | AI-HANDOVER |
| 版本 | v3.0 |
| 状态 | Ready |

<!-- AUTO-UPDATE-START -->
| 代码状态日期 | 2026-10-17 |
| 当时最新提交 | 142fd90 |
| 本记录更新于 | 2026-10-17 13:37:56 |
<!-- AUTO-UPDATE-END -->

> 上面这个区块由 `scripts/update-version-info.sh` 自动写入，**请勿手动编辑**。
> 运行 `bash scripts/update-version-info.sh --check` 可以查看文档落后代码多少。

---

## 本轮变更（2026-10-17）

> 这是 git log 的**补充**，不是替代。本地开发请用 `git log --oneline` 查完整历史；
> 此处供无法访问仓库的场景（如纯网页会话上传交接包）快速了解现状。

### 数据库结构

新增实体关联三表，表数 15 → 18：

| 表 | 说明 | 记录数 |
| --- | --- | --- |
| `Entity` | 公司 / 模型 / 产品 / 人物 | 1502（已归并 11） |
| `NewsEntity` | 新闻 ↔ 实体 | 5448 |
| `EventEntity` | 事件 ↔ 实体 | 176 |

### AI 分析能力（TASK-002 已完成）

- **提示词改进**：`impact` 字段原 87% 以「对AI产业而言，…」开头（所有来源一致，
  说明是提示词问题）。改为禁止公式化句式、要求趋势判断带历史对照。
  实测 317 条样本，公式化比例 **79% → 0%**。
- **实体体系**：从新闻正文抽取 1502 个实体，建立双向关联，
  新增 `/entities` 与 `/entities/[id]` 页面。

### 部署方式

| 项 | 变更 |
| --- | --- |
| nginx | **已停用**。查证发现它从未在链路上（隧道直连 `127.0.0.1:3000`），文档此前写「隧道回源到 80」是错的 |
| 隧道 | 改为 `--edge-ip-version 4 --edge-bind-address 0.0.0.0 --protocol http2`。原走 IPv6+QUIC，实测每 40 秒断连一次 |
| 服务单元 | 新增 `cloudflared-ipv4.service`，原 `cloudflared.service` 保留可回滚 |

### 数据质量

| 项 | 结果 |
| --- | --- |
| 中文标题 | 1491 / 1668（非 arXiv 缺失 0） |
| arXiv 元信息清洗 | 60 条 |
| 未分析补跑 | 69 条，pending 归零 |
| 公式化 impact 重写 | 1134 → 57（剩余全是 arXiv，按约定跳过） |
| `publishedAt` 缺失 | 21 → 0 |

### 界面

- 新闻详情页：深色改白底黑字（原 `text-gray-600` 对比度仅 3.4:1），
  容器加宽、正文限 68ch、评分移入粘性侧栏
- 未分析的新闻不再把原始正文冒充成 AI 分析结论

### 文档全量同步

维护者要求「以后更新就把所有该更新的地方一次改完，不要逐个问」，
已写入 `AGENTS.md` 规则 6，并列出 14 个需要同步的位置。

本轮据此做了一次全库同步（12 份文件）：

| 文档 | 更新内容 |
| --- | --- |
| `AGENTS.md` | 新增规则 6：文档全量更新 + 同步位置清单 + 顺序要求 |
| `AI-START-HERE.md` | 新增坑 7/8/9；加入「当前形态」摘要 |
| `CODE_MAP.md` | 补 `app/entities` 路由 |
| `FEATURES.md` | 补实体库功能 |
| `CURRENT_STATUS.md` | 更新日期；已知问题补 IPv6 无解说明 |
| `PROJECT_STATUS_SNAPSHOT.md` | 更新日期与 commit |
| `TODO.md` | 第二阶段标记完成 |
| `DATABASE.md` | 加指向完整版 `DATABASE_SCHEMA.md` |
| `AI_MASTER_INDEX.md` | 索引加入 `AI_STATUS_AUTO.md` |
| `AI_HEALTH_REPORT.md` | 脚本重新生成 |
| `AI_STATUS_AUTO.md` | 新文件，脚本生成 |
| `generate-ai-status.sh` | 改为输出独立文件，不再覆盖手写文档 |

**顺带修掉一个隐患**：`generate-ai-status.sh` 原先直接覆盖
`CURRENT_STATUS.md`，一次运行就把 344 行手写内容压成 99 行机械快照。
已改为输出独立的 `AI_STATUS_AUTO.md`，两者分工写进索引。

### 内容自动化与监控（P0）

上线前盘查发现两个阻塞项，已修复。

**问题 1：内容不会自动更新**

实测：最新新闻停在 47 小时前，近 24 小时 0 条，`logs/daily-cron.log` 从未生成。

根因：cron 定在 `0 2 * * *`，而这台机器不是 24 小时开机 ——
**cron 不补跑错过的任务**。管线本身没问题（手动触发 200，导入 93 条）。

修法：照搬既有的 `db-backup-scheduler.sh` 模式 ——
`scripts/news-pipeline-scheduler.sh`，每小时检查陈旧度（>6 小时才真跑），
`@reboot` 补跑，`flock` 防并发。

**问题 2：没有告警**

站点挂了没人知道。新增两个脚本：

| 脚本 | 作用 |
| --- | --- |
| `scripts/health-monitor.sh` | 检查本地应用 / 域名 / 隧道 / 磁盘 / 内存 |
| `scripts/alert.sh` | 分发告警，支持 Server酱 / Telegram / 通用 webhook |

关键设计：**只在状态变化时告警**。正常→故障立即推送，
故障→正常发恢复通知，持续故障不重复推送（否则每小时一条会很快被无视）。

四种状态转换均已实测通过。

告警渠道用 `scripts/set-alert-channel.sh` 配置（幂等，密钥打码显示）。
**当前已配置 Server 酱（微信推送）并完成全链路验证**：
模拟域名不可达 → 收到「站点异常」；恢复 → 收到「站点已恢复」。

未配置渠道时也能运行（只写 `logs/alert.log`）——
刻意设计，避免把「没配告警」变成「监控脚本报错」的二次噪音。

**crontab 变更**（6 条）：

```
0 * * * *     news-pipeline-scheduler.sh
@reboot+180   news-pipeline-scheduler.sh
15 * * * *    health-monitor.sh
@reboot+240   health-monitor.sh
0 23 * * *    db-backup-scheduler.sh
@reboot+120   db-backup-scheduler.sh
```

同时移除了原先 `0 2 * * *` 直接调 `/api/cron/daily` 的条目
（固定时间点 + 无陈旧度判断，正是问题根源）。

### 全站对比度整改

维护者要求把页脚的对比度标准推广到全站。

**难点：站内有两套主题，而且同一页面内还混用。**

| 颜色 | 黑底 | 白底 |
| --- | --- | --- |
| gray-400 | 8.27 AAA | **2.54 ✗** |
| gray-500 | **4.34 ✗** | 4.83 AA |
| gray-600 | **2.78 ✗** | 7.56 AAA |
| gray-700 | **2.04 ✗** | 10.31 AAA |

同一个类在一套主题合格、在另一套不合格。更麻烦的是首页是白底但首屏是
`bg-black` 的 hero 区 —— 那里 `text-gray-400` 反而是正确的（8.27），
改成 gray-600 会变成 2.78，把好的改坏。

**因此不能按文件整体替换。** 新增 `scripts/audit-contrast.py`：

用 `<section>` / `<div>` 标签栈跟踪每处文字所处的背景，
再决定往哪个方向调整（深层 500/600/700 → 400；浅层 400 → 600）。
支持 `--dry-run` 预演，且跳过注释行 ——
`Footer.tsx` 的注释里写着「初版用了 text-gray-500（4.34:1）…」，
那是记录改动原因的，不能被替换。

**结果**：60 个文件、378 处。

**跨主题组件单独处理**：`NewsTitle` 用在 10 个页面（多数浅色），
固定颜色总有一边不达标。改用 `opacity-70` 继承父级颜色，
黑底白字 10.02:1、白底黑字 8.45:1，两边都达 AAA。

> 试过 `text-current/70`，但实测 Tailwind v4 不支持给 `currentColor`
> 加透明度修饰符，构建后不生成任何 CSS 规则。

**最终核对**：脚本再跑一遍，剩余需改 0 处。

### 最小合规包

上线前盘查发现两个合规缺口，已补齐。

**发现：网站原本没有页脚。**
`components/Footer.tsx` 存在但是**死代码** —— 全站没有任何地方引用它，
`app/layout.tsx` 里既没有 import 也没有渲染。因此站内没有版权声明、
没有免责说明、没有任何政策页入口。

**做了什么：**

| 项 | 内容 |
| --- | --- |
| `components/Footer.tsx` | 重写并接入 `layout.tsx`；含 AI 生成内容说明、信息来源说明、合规页链接、版权与主体性质声明 |
| `app/about/page.tsx` | 关于本站：内容生成流程、局限、来源与版权、联系方式、免责声明 |
| `app/privacy/page.tsx` | 隐私说明：收集什么、不收集什么、第三方、用户权利 |
| `app/news/[id]/page.tsx` | AI 分析内容之前加显式标识「AI 生成 · 未经人工编辑审核」；三处章节标题补「AI生成」注记 |
| `app/layout.tsx` | metadata 补齐（title 模板、description、applicationName、`ai-content: generated`） |

**隐私页写的都是实测事实，不是模板套话**：

- 收集：页面路径、来源页面、设备类型、访问时间
- **不收集**：IP 地址、追踪 Cookie、身份信息；不嵌入第三方广告或追踪脚本
- 这些是从 `PageView` 模型字段核实后写的，不是假设

**关于「AI 生成内容标识」**：
这是国内自 2025-09-01 起施行的要求，也是本次盘查中
唯一一条「有明确规定 + 明确没做 + 成本极低」的项。

**页脚配色的修正**：初版用了 `text-gray-500`（4.34:1）与 `text-gray-600`（2.78:1），
维护者反馈对比度太低。实测确认后者明显低于 WCAG AA 要求的 4.5:1，
已整体提亮到 `text-gray-200`（14.31:1）与 `text-gray-300`（14.25:1），全部达 AAA。

**联系方式**：`/about` 与页脚统一为 `w13545259496@qq.com`。

**注意**：本合规包覆盖的是**技术侧与文本侧**。
ICP 备案、运营主体资格等属于需要个案判断的事项，未涉及。

### 死代码清理（已完成）

盘查发现 64 个组件里有 32 个未被使用。**已全部删除，合计 2651 行**，
分三轮提交、每轮独立构建验证。

**判定方法**：不看组件名，而看**组件里的中文文案是否出现在构建产物中**。
若组件被任何页面引用，文案必然打进 `.next/static/chunks/*.js`。
只 grep 组件名不可靠 —— `Header` 在产物里出现 3 次，
那是 `AgentDashboardHeader` 的子串。

**删除清单（20 个组件 + 此前 12 个 = 32 个）**

| 批次 | 组件 | 行数 |
| --- | --- | --- |
| 早前 | LiveNews、NewsCard | 853 |
| 一 | Header、AIIndexChart、AIIndexRefresh、ReportCard、RecommendNews、Container、Tag | 1007 |
| 二 | HomeDirections、HomeStats、HomeLinks、HomeSearch | 509 |
| 三 | BusinessCard、InvestmentRadar、TrendCard、OpportunityMapCard、IndexTrend、DashboardStats、IndexDetailCard、EcosystemCard、IndustryTrendChart | 1116 |

**这些不是「没做完」，是「做完了新版忘删旧版」**，例如：

- `Header`(222 行) 是旧导航，现行导航是 `Navbar`（11 项，含实体库、预测、出行管家）
- `AIIndexChart` 被 `AIIndexCard` 替代 —— data-center 页实际 import 的是后者
- `RecommendNews` 依赖 `recommendScore` 字段，该字段在 schema 中不存在
- `Container` 只有 `max-w-7xl mx-auto px-6`，页面已内联 48 处
- 四个 `Home*` 组件属于旧首页，当前首页只 import `NewsTitle`

**每轮的验证流程**（`scripts/delete-component-batch.sh` 固化）：

```
删除前三重验证（import / 路径引用 / JSX 标签）
  → tsc
  → 构建
  → 12 个页面 HTTP 200
  → 460 项测试
  → 提交
```

任一步失败即中止且不提交。三轮全部一次通过。

组件数 64 → 32。明细见 `ai-context/DEAD_COMPONENT_REPORT.md`。

### 新闻详情页的重复区块

维护者反馈「商业机会和商业方向的内容重复」。核实后发现比反馈的更严重 ——
**整个「AI智能分析」区块的三张卡都是前面内容的二次呈现**。

页面原本有 7 个分析区块，但数据库里只有 4 个字段：

| 页面区块 | 数据来源 | 问题 |
| --- | --- | --- |
| 核心判断 | `insight` | — |
| 产业影响 | `impact` | — |
| 商业机会 | `businessOpportunity` | — |
| 投资判断 | `investmentView` | — |
| 产业价值 | `insight` 拆句重排 | 与核心判断同源 |
| **商业方向** | `businessOpportunity` | **逐字相同** |
| 关注风险 | `investmentView` 摘句 | 与投资判断末句相同 |

查两个函数的实现确认了这一点：

- `buildIndustryValue()` 把 `insight` 拆成句子、把含「产业/市场/成本」
  的那句提前再拼回去 —— 是同一段文字重排
- `extractRisk()` 用正则从 `investmentView` 里原样摘出含「风险」的那句

**这是结构性重复，改措辞治不好**：4 个字段展示 7 次，必然重复。

处理：删除整个「AI智能分析」区块，页面变成 4 个区块与 4 个字段一一对应。
同时清掉因此失效的代码：

- `buildIndustryValue` / `extractRisk` 之外的本地 `ResearchCard` 组件
- `components/ResearchCard.tsx`（204 行的独立文件，从未被任何文件导入，
  与页面内的同名函数只是巧合）

**保留了一处**：侧栏的「关注风险」卡片仍用 `riskContent`。
它不是重复区块，而是有意的信息层级设计（注释写明
「读者决策前最需要先看到的一条」），从投资判断里拎出风险那句单独强调。

验证方式：剥离 `<script>` 后统计字段原文在 DOM 中的出现次数 ——
`businessOpportunity` 从 2 次降为 1 次。
（原始 HTML 里出现 2 次是正常的：一次渲染结果、一次 Next.js 的 RSC payload。）

> 删除时踩过一次：第一版把 `riskContent` 一起删了，导致侧栏引用未定义变量。
> 靠 tsc 之外的残留检查（grep 关键字计数）发现并恢复。

### AI 用量与成本统计

维护者要求「统计一天跑了多少轮、导入多少条、花了多少钱」。
此前做不到 —— **项目完全不记录 token 用量**，只能靠估算，
而实测估算误差可达 5 倍（我按字段长度估 491 tokens，
实际输出 1152~4408）。

补了两样东西。

**1. 用量记录（lib/ai-summary.ts）**

每次 AI 调用追加一行 JSON 到 `logs/ai-usage.log`：

```json
{"t":"2026-10-17T09:24:50.807Z","model":"deepseek-flash","in":1280,"out":1285,"reason":0}
```

选 JSONL 而非纯文本：将来可能加字段（比如 newsId），JSONL 不影响已有解析。
选独立文件而非数据库：日志是运维数据，不该污染业务库，出问题时能直接 tail。
写失败用 try/catch 吞掉 —— 统计是次要功能，不能因为它让新闻分析失败。

**2. 报告脚本（scripts/ai-usage-report.sh）**

```bash
bash scripts/ai-usage-report.sh            # 今天
bash scripts/ai-usage-report.sh 2026-10-17 # 指定日期
bash scripts/ai-usage-report.sh --week     # 最近 7 天
```

输出采集轮次、导入量、分析量、输入/输出 token、估算成本、当前余额。

成本按官方定价**逐条计算**并区分时段 ——
高峰（工作日 9-12、14-18）是空闲的两倍。
系统提示词 1021 tokens 按缓存命中计价（便宜 50 倍），其余按未命中。

**3. 每日推送（scripts/daily-report.sh）**

22:30 推送当天报告到微信，`@reboot` 补发昨天漏掉的。
用 `~/.last-daily-report` 记录已发送日期，同一天不重复推送。
推送内容截取 8 行关键数字 —— 完整报告约 20 行，Server 酱正文有长度限制。

**4. 三个数据源的盲区（重要）**

首版报告只用日志，结果「完成分析 30 条」和「AI 调用 1 次」并排放着，
读起来像「30 条分析只花了 1 次调用」。实际是日志不完整。

| 指标 | 来源 | 盲区 |
| --- | --- | --- |
| 入库、分析 | **数据库** | 无 |
| 采集轮次 | `news-pipeline.log` | 只覆盖脚本触发的轮次 |
| AI 调用、token | `ai-usage.log` | 只从加记录之后才有效 |

入库与分析已改为查数据库，报表会标注每项来源，
并在分析量明显多于调用数时打出警告。

**5. 看报告的核心指标**

`AI 调用次数 ≈ 完成分析条数`（每条新闻恰好调一次 AI）。

- 分析数 ≫ 调用数 → 有用量没记录，成本被低估
- 调用数 ≫ 分析数 → 有重复分析，值得查调度或状态判断

读法与定价细节见 `DEPLOYMENT.md` 的「AI 用量与成本报告」一节。

### 搜索引擎收录：已关闭

在运营主体与合规状态明确之前，不向搜索引擎公开。

**为什么选这一侧**：收录不可逆 —— 缓存、镜像、Wayback 存档长期留存，
即使事后删 sitemap 也不一定撤得回来；而 `noindex` 只是请求，随时可撤。
当前未备案，选择保留选择权。

**三层叠加**（各有弱点，缺一不可）：

| 层 | 覆盖 | 弱点 |
| --- | --- | --- |
| `robots.txt` | 全站 | 只是请求，可被无视 |
| `<meta name="robots">` | HTML 页面 | 对 PDF / 图片无效 |
| `X-Robots-Tag` 头 | 任意资源 | 无 |

**开关**：`lib/site-indexing.ts` 的 `SITE_ALLOW_INDEX` 常量，
改成 `true` 后重新构建即可，三处一起变。

**踩到的坑**：最初用环境变量做开关，结果 `robots.txt`（静态路由，
构建时定值）与首页 meta（动态渲染，请求时读 `process.env`）不同步 ——
重新构建但 PM2 进程里残留旧变量时，出现「robots 已 Disallow、
meta 仍 index, follow」的半状态。改用常量后消失，
因为字面量在构建期就固定了。

顺带清掉了 PM2 内部状态里残留的 `SITE_ALLOW_INDEX=true` ——
`pm2 restart --update-env` 清不掉它，需要 `pm2 delete` + `pm2 start`。

### 采集源审计与清理

体检查出 35 个源里有 16 个**从未产出过内容**。逐项探测后的结论：

**根因**：这 16 个源的 `type` 是 `watch`，而采集器的取源条件是

```
enabled = true AND type IN ('rss','sitemap') AND rssUrl IS NOT NULL
```

`watch` 不在其中，所以它们从未参与采集 —— 只是占位记录。

**同时发现 13 条垃圾新闻**：2026-10-07/08 初始化时，这些源被当成网页抓取，
把官网首页的 `<title>` 当新闻导入了。例如：

```
[微博AI]     "微博-随时随地发现新鲜事"
[智谱AI]     "Z.ai - Inspiring AGI to Benefit Humanity"
[百度智能云]  "千帆大模型平台-企业级一站式大模型开发应用平台"
```

已全部删除，连带清理 58 条挂在它们上面的实体关联。

## 探测结果

**有可用 RSS（3 个，已启用）**

| 源 | 地址 | 说明 |
| --- | --- | --- |
| NVIDIA | `developer.nvidia.com/blog/feed/` | `blogs.nvidia.com` 从本机不可达，改用开发者博客 |
| Meta | `engineering.fb.com/category/ai-research/feed/` | `ai.meta.com` 不可达；用 **AI 分类 feed**，全量 feed 中 AI 仅占 12% |
| Anthropic | `rsshub.rssforever.com/anthropic/news` | 官方无 RSS（`/rss.xml` 全 404），只能走 RSSHub |

> **Anthropic 是外部依赖**：RSSHub 公共实例下线则此源中断。实测 7/8 成功。

**无任何 feed（10 个，已停用）**

智谱、月之暗面、MiniMax、字节豆包、腾讯混元、百度智能云、腾讯AI、
华为盘古、知乎AI话题、微博AI。

这些站的 `/rss` 全部返回 SPA 空壳或 404 —— 它们是前端渲染的单页应用，
HTML 里没有文章内容，页面解析也救不了。RSSHub 对应路由均返回 503。

**收尾又停用 5 个**：3 个与已有 sitemap 源重复（DeepSeek、通义、阶跃星辰），
2 个 sitemap 结构不合适、累计产出 0（DeepSeek 官方博客、通义 Qwen 博客）。

**最终：19 个源参与采集（16 RSS + 3 sitemap），16 个停用。**

## 一个需要记住的判断

**国产厂商的内容其实已经有覆盖，只是来自媒体转述而非官方源。**

| 厂商 | 关联新闻 | 主要来源 |
| --- | --- | --- |
| DeepSeek | 37 条 | InfoQ、量子位、OSChina |
| Qwen | 11 条 | arXiv、InfoQ |
| 豆包 | 8 条 | 量子位 |
| 阶跃星辰 | 7 条 | 量子位 |

所以补官方源的价值是「更快、更权威」，不是「有没有内容」。
在拿不到官方 RSS 的前提下，靠媒体源覆盖是可接受的现状。

## 两个已知的接入特性

**`MAX_ITEMS_PER_SOURCE = 30`**：单源单次最多取 30 条。
NVIDIA 首次接入时正好灌入 30 条（9-23 到 10-16 的历史积压），
这是设计如此 —— 防止首次接入时一次灌入上千条。之后只会增量。

**`RECENT_DAYS = 30`**：只保留近 30 天。Meta 的 AI 分类 feed 首次接入
产出 0，因为最新一篇是 2026-09-02，超出窗口。源是好的，只是发文频率低。

### 首页按「每天扫一眼」重构

维护者说明用法是「每天扫一眼有没有值得关注的新动态」，据此重构首页。

## 改动

**1. 「最新产业情报」提到最前，条数 6 → 20**

原来首页首屏是 6 个事件卡，占两屏，每张只露出 1 条新闻。
事件是聚合概念，要点进去才知道发生了什么；而按时间排的新闻流
才直接回答「今天新增了什么」。

过去 24 小时日均新增约 25 条，20 条是一屏能扫完、又不会漏太多动态的量。

**2. 「自上次访问以来」的 NEW 标记**

`components/NewSinceLastVisit.tsx`，用 localStorage 记住上次访问时间，
比它新的条目打红色 NEW。

首次访问不标任何 NEW（否则满屏 NEW 毫无意义），只记录基线；
第二次访问起才有效。

实现上的两个要点：

  · 20 个 badge 共用一次 localStorage 读取（模块级缓存），
    否则 20 次读取 + 写入时序问题会让标记全部失效
  · 新基线的写入放在独立的 RememberVisit，用 useEffect 保证在渲染之后执行

选 localStorage 而非 Cookie：Cookie 方案要改中间件（全局生效，风险大），
localStorage 只在客户端读，不碰服务端逻辑。代价是标记在 hydration 后
才出现（约一帧）。

**3. 导航栏移动端**

11 个导航项全是 whitespace-nowrap，375px 下横向溢出，**实测只能看到前 4 项，
后面 7 个入口点不到** —— 这不是美观问题，是功能缺失。

改为 <lg 隐藏平铺导航、显示汉堡按钮，展开后两列网格。
断点取 lg(1024px) 而非 md：8 项以上的横向导航在 768-1024 之间仍然会挤。

菜单支持点链接关闭、Esc 关闭、点遮罩关闭，展开时锁定背景滚动。

## 过程中踩的两个坑

**插入位置算错劈开了 JSX**：搬移区块时用
`fidx + len('<main className="...">')` 定位，但源串带 4 个空格缩进，
长度差 4，插入点落进 class 属性内部，把 `<main>` 标签劈成两半。
改为「从 `<main` 出发找第一个 `>`」定位，不依赖字符数。

**验证菜单展开时发现 effect 会立即重置**：临时把 `useState(false)` 改成
`true` 来截图，结果菜单仍是关闭的 —— 「路由变化时关闭」的 useEffect
在挂载时也会执行。这次验证没成功，但暴露了该 effect 的行为；
第二次验证时同时禁用它，确认菜单渲染正常。

## 验证方式的变化

首次用 Windows 端 Edge 的无头模式从 WSL 截图：

```bash
"/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --window-size=375,900 --screenshot=out.png URL
```

这比自己推理 DOM 可靠得多 —— 导航栏溢出就是靠它发现的。
静态分析曾让我把「断点数量少」误判成「没做响应式」，
实际 `md:grid-cols` 用了 101 处。

### 移动端两处修复（截图验证后）

维护者要求处理三处移动端问题。**截图后只有一处是真的。**

## 实际修了什么

**1. 投资雷达 6 列表格 —— 确实坏了**

375px 下 6 列放不下，主体名被 truncate 成 `Proac...`。

改为横向滚动（`overflow-x-auto` + `min-w-[600px]`），
并加一行 `lg:hidden` 的「← 左右滑动查看五维评分 →」提示，
否则用户不知道可以滑。

保留表格而不是改成卡片：这张表的价值就在「横向对比五个维度」，
拆成卡片会失去这个语义。

**2. 小字号 56 处**

全站 `text-[9px]` / `text-[10px]` / `text-[11px]` 共 56 处，
手机上偏小。改为小屏放大、`sm` 以上恢复原值：

```
text-[9px]  → text-[11px] sm:text-[9px]
text-[10px] → text-[12px] sm:text-[10px]
text-[11px] → text-[12px] sm:text-[11px]
```

替换时用占位符中转。直接替换会让 `text-[10px]` 的结果里
再出现 `text-[11px]`，被后续规则二次命中，形成嵌套。

## 静态分析高估的三处（截图后放弃）

| 项 | 静态分析判断 | 截图实际 |
| --- | --- | --- |
| events 4 列统计（24H/72H/热度/新闻） | 会挤 | 正常，数字短反而省纵向空间 |
| trend 3 列（HEAT/7D NEWS/GROWTH） | 会挤 | 正常 |
| industry 3 列卡片 | 会挤 | 正常，只是变长 |
| privacy 表格 | 无横向滚动 | 正常，两列换行正确 |

**教训**：数「无响应式前缀的 grid-cols」只能说明写法不统一，
不能说明渲染结果坏。列数不是判断标准 —— 内容长度才是。
4 列纯数字比 2 列长文本更舒服。

判断移动端是否真有问题，必须看渲染结果。本项目现在有截图能力
（见 DEPLOYMENT.md 的「UI 改动的视觉验证」），应当先用它。

## 顺带发现

`app/page.v7-final-backup.tsx` 是 787 行的 旧版首页备份，
**不是路由**（文件名不是 page.tsx），全项目 0 处引用。
未删除，留给维护者决定。

### 死文件清理第二轮：30 个文件 / 8878 行

上一轮清理删了 32 个死组件，但只扫了 `components/`，
漏掉了备份文件和 `app/` 下的非路由文件。

维护者明确要求：「这种没用的文件留着也没用，直接处理，不用问我。」
已写入 `AGENTS.md` 规则 8。

## 删了什么

**4 个无引用的 `.tsx`（1418 行）**

```
app/page.v7-final-backup.tsx                  787  旧版首页快照，非路由
app/opportunity-map/OpportunityMapClient.tsx  389
app/industry/IndustryCharts.tsx               182
app/components/CategoryFilter.tsx              60
```

**26 个版本备份（7460 行）**

`*.bak` / `*.backup.v748xxx.ts` / `page.tsx.backup_2026xxxx` /
`prisma/schema.backup.v748121`。

其中 `collectNews.backup.*` 有 9 个版本、`webFetcher.backup.*` 4 个、
`eventCluster.backup.*` 3 个 —— 都是过去某轮调试留下的临时快照，
内容在 git 历史里，删除不丢任何东西。

## 判断方法上的一个坑

第一遍用 `grep "CategoryFilter.tsx"` 搜引用，命中 0，
差点把在用的组件当死文件删掉。

**import 里写的是 `@/app/components/CategoryFilter`，不带 `.tsx`。**
正确搜法是搜模块名本身。

改用模块名重查后，从 7 个「疑似死文件」里救回 3 个：

```
app/components/IndustryLayerList.tsx   ← 被 app/page.tsx 引用
app/startup/StartupClient.tsx          ← 被 app/startup/page.tsx 引用
app/startup-discovery/StartupSearch.tsx ← 被同目录 page.tsx 引用
```

## 另一个认知纠正

**`app/` 下不是 `page.tsx` 的文件不等于死文件。**
Next 只把 page/layout/route/loading/error/not-found/template/default/
global-error 当作路由约定，但普通组件可以放在 `app/` 里被路由引用。

判断依据必须是「有没有被 import」，不是「名字符不符合约定」。

### 显式 AI 内容标识

依据《人工智能生成合成内容标识办法》（国信办通字〔2025〕2 号，2025-09-01 施行）。

## 法规要求

**第四条（显式标识）**：文本内容需

> 在文本的起始、末尾或者中间适当位置添加文字提示……**或者
> 在交互场景界面、文字周边添加显著的提示标识**

**第五条（隐式标识）**：在文件元数据中添加生成合成内容属性信息、
服务提供者名称或编码、内容编号。

## 实施

新增 `components/AiContentLabel.tsx`，两个导出：

| 组件 | 用途 |
| --- | --- |
| `AiGeneratedBadge` | 小徽标，列表页摘要旁 |
| `AiDisclosure` | 完整披露块，详情页 AI 分析内容之前 |

接入三处：

| 位置 | 改动 |
| --- | --- |
| `/news/[id]` | 原有标识块改为 `isAnalyzed &&` 条件渲染 |
| `/`（首页） | 摘要上方加徽标 + 「摘要由 AI 整理，未经人工审核」 |
| `/news`（列表） | 同上，用逐条的 `isAnalyzed` |

meta 从 1 项扩到 3 项：

```html
<meta name="ai-content" content="generated" />
<meta name="ai-content-generator" content="DeepSeek（deepseek-flash）" />
<meta name="ai-content-disclosure" content="https://aibiliai.com/about" />
```

## 一个必须修的逻辑漏洞

详情页原有的「AI 生成」标识块是**无条件渲染**的。

未分析的记录（`analysisStatus = 'pending'`）下面显示的是
「原始抓取内容，未经整理」和 `PENDING_ANALYSIS_TEXT` 占位文案，
上面却写着「以下内容由人工智能模型生成」—— **这是虚假声明**，
比不标更糟。

改为 `isAnalyzed && (...)`。当前 pending 记录恰好是 0，
所以这个漏洞还没在实际页面上暴露，但一旦采集与分析脱节就会出现。

## 刻意不标的：事件摘要

`NewsEvent.summary` 看着像 AI 写的，实际是模板字符串：

```
围绕"{标题}"形成的AI产业事件。系统将持续聚合相关来源并跟踪后续发展。
```

`app/page.tsx:95` 还有一条硬编码的
「近期出现新增动态，产业影响正在持续扩散。」

**机器生成 ≠ AI 生成。** 标成 AI 同样是虚假声明，所以事件页不加标识。

## 验证

```
首页       「AI 生成」×21  摘要说明×19
新闻列表   「AI 生成」×62  摘要说明×60
新闻详情   「AI 生成」×2   完整声明×1
meta 三项全部输出
构建通过、460 项测试通过
```

截图确认：详情页标识位于「核心判断」之前，正文区块（本站整理）
未被误标。

### 已知无解问题

**访客侧 IPv6 到 Cloudflare 边缘不可达**，失败率约 5%、平均慢 0.47 秒。
Cloudflare 免费版三条路全部走不通（后台开关、zone 级 API、记录级 `ipv4_only`，
后者返回错误码 9227）。决定接受现状，详见 `AI_TROUBLESHOOTING_GUIDE.md`。

---

## 技术环境

| 组件 | 版本 |
| --- | --- |
| Node.js | v22.23.3 |
| npm | 10.9.9 |
| Next.js | 16.3.5 |
| Prisma Client | 6.19.3 |
| 数据库 | SQLite（prisma/dev.db） |
| 运行方式 | PM2 + Next.js |

---

## 项目定位

**AI Insight Daily** —— AI 产业智能分析平台，不是普通新闻网站。

当前阶段：V7 AI产业驾驶舱。

发展路线：V7 产业驾驶舱 → V8 AI产业知识库 → V9 AI Agent生态 → V10 产业智能操作系统。

---

## 交接包用途

供无法直接访问代码仓库的场景使用（例如在纯网页会话中上传），
让新的 AI 助手能理解项目。

适用于 DeepSeek、ChatGPT、Claude、Gemini 等。

---

## 包含内容

| 类别 | 内容 |
| --- | --- |
| 项目理解 | PROJECT_MEMORY、PROJECT_OVERVIEW、PROJECT_STATUS_SNAPSHOT、CURRENT_STATUS |
| 工作规则 | AI_START_PROMPT、AI_STARTUP_CHECKLIST、DEVELOPMENT_RULES、AI_SECURITY_RULES |
| 技术架构 | ARCHITECTURE、DEPLOYMENT、DATABASE_SCHEMA（含实体三表 14b-14d）、CODE_MAP |
| 故障排查 | AI_TROUBLESHOOTING_GUIDE（含实测案例） |
| 运维 | AI_BACKUP_STRATEGY、AI_BACKUP_RECOVERY、AI_PRODUCTION_CHECKLIST |
| 项目根目录 | AI-START-HERE.md（维护入口）、RECOVERY.md（重建手册） |
| 运维脚本 | scripts/ 下的备份与部署脚本 |

---

## AI 读取建议

**第一份读 [`AI-START-HERE.md`](../AI-START-HERE.md)**（项目根目录），
它内含一份指引表，说明按什么顺序读其余文档。

若只能读包内文件，读 `ai-context/AI_MASTER_INDEX.md`。

**遇到故障**读 `ai-context/AI_TROUBLESHOOTING_GUIDE.md`。

**需要重建站点**读 `RECOVERY.md`。

---

## 更新规则

以下情况升级版本号：

| 情况 | 版本 |
| --- | --- |
| 小修改（文档修订、bug 修复） | v2.x |
| 重大升级（架构变化、数据库结构变化、部署方式变化、AI 体系变化） | v3.0 |

**每次重大开发后应做的事**：

**顺序很重要 —— 先更新标记，再生成包**：

```bash
# 1. 先更新本文档的版本标记
bash scripts/update-version-info.sh

# 2. 再重新生成交接包
bash update-ai-handover.sh
```

> **为什么顺序不能反**：`update-ai-handover.sh` 会把当时的
> `AI_VERSION_INFO.md` 打进 ZIP。若先生成包再改标记，
> 包里的标记就是旧日期与旧 commit —— 而 ZIP 正是交接包使用者
> 唯一会看的东西，记录错了等于没记录。
>
> 2026-10-17 踩过这个坑：仓库文件记录 2026-10-17 / 142fd90，
> ZIP 内却是 2026-10-16 / ff9e254。

**生成后自检**：

```bash
# 确认 ZIP 内的标记与仓库文件一致
unzip -p AI-HANDOVER.zip "AI-HANDOVER/ai-context/AI_VERSION_INFO.md" \
  | sed -n '/AUTO-UPDATE-START/,/AUTO-UPDATE-END/p'
```

> **为什么不建 CHANGELOG.md**：
> 逐条变更与 git 提交历史功能重叠，维护成本大于收益 ——
> 查完整历史请用 `git log --oneline`。
>
> 但上面的「本轮变更」一节日的是**另一件事**：
> 交接包的使用场景往往拿不到仓库（纯网页会话上传 zip），
> 那时没有 git log 可查。因此这里保留**当前这一轮**的概要，
> 只覆盖最近一次重大开发，不做长期演进记录。
> 下一轮重大开发时，本节应整体替换而不是追加。
