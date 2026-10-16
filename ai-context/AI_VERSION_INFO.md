# AI Insight Daily 交接包版本信息

> 版本：V2.0（2026-10-16 重写为紧凑版并加入自动更新标记）
>
> V1.0 为 266 行但仅约 1100 字符，信息密度过低。
> 本次压缩，并让「对应 commit」与「更新时间」可由脚本自动写入。

---

## 当前版本

| 项 | 值 |
| --- | --- |
| 交接包名称 | AI-HANDOVER |
| 版本 | v2.0 |
| 状态 | Ready |

<!-- AUTO-UPDATE-START -->
| 项目 commit | 07c0a93 |
| commit 日期 | 2026-10-16 |
| 本文档更新于 | 2026-10-16 19:12:14 |
<!-- AUTO-UPDATE-END -->

> 上面这个区块由 `scripts/update-version-info.sh` 自动写入，**请勿手动编辑**。
> 运行 `bash scripts/update-version-info.sh --check` 可以查看文档落后代码多少。

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
| 技术架构 | ARCHITECTURE、DEPLOYMENT、DATABASE_SCHEMA、CODE_MAP |
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

```bash
# 1. 重新生成交接包（会自动写入当前 commit）
bash update-ai-handover.sh

# 2. 更新本文档的版本标记
bash scripts/update-version-info.sh
```

> **为什么不建 CHANGELOG.md**：
> 它与 git 提交历史功能重叠，维护成本大于收益。
> 查阅变更请用 `git log --oneline`，本文件只记录「交接包对应哪个 commit」。
