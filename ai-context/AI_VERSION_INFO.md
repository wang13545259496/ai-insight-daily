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
