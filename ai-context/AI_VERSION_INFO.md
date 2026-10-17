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
