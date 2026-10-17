# AI Insight Daily AI交接文档总索引 V2.0

## 项目名称

AI Insight Daily

## 文档用途

本目录用于：

AI助手。

开发人员。

未来维护者。

快速理解并维护项目。

## V2.0 修订说明（2026-10-16）

V1.0 索引了 24 份文档，但目录内实际有 49 份 ——
未被索引的部分包含几份**最重要的**：故障排查手册、数据库结构说明、
启动检查表、任务队列。按 V1.0 的读取顺序，新会话会读到已过时的
DEPLOYMENT.md（当时仅 666 字符），却永远不知道故障手册的存在。

本次补齐索引，并调整接管流程的读取顺序。

## MIGRATION_TO_CLOUD.md

**迁移到阿里云香港**（已就绪，未执行）

解决「电脑关机时网站仍可访问」。选阿里云轻量香港：免备案、支付宝付款、
国际 RSS 采集畅通、代码零改动。

含 9 个脚本：预检、服务器初始化、rsync/git 双通道部署、数据迁移、
9 项全链路验证、本地停用、回滚。

关键约束：迁移后**必须停掉本地 cron**，否则两边同时采集，
AI 费用翻倍且数据库不一致。

================================
# 第一优先级：项目理解

## PROJECT_MEMORY.md
项目历史。核心目标。重大背景。

## PROJECT_OVERVIEW.md
项目定位。主要功能。当前状态。

## AI_PROJECT_ONBOARDING.md
新AI接手流程。

## PROJECT_STATUS_SNAPSHOT.md
项目状态快照（含环境与数据量）。

## CURRENT_STATUS.md
当前阶段与已完成能力。**手写**，含叙述性内容
（核心功能、AI 能力、优化方向、已知问题、接手提示）。

## AI_STATUS_AUTO.md
机器生成的现状快照：Git 状态、环境版本、数据库状态、PM2 状态。
由 `generate-ai-status.sh` 生成，**手改会被覆盖**。

> 两份的分工：要「理解项目在做什么」读 CURRENT_STATUS；
> 要「快速确认当前 commit / 版本 / 运行状态」读 AI_STATUS_AUTO。
>
> 历史教训：`generate-ai-status.sh` 原先直接覆盖 CURRENT_STATUS.md，
> 一次运行就把 344 行手写内容压成 99 行机械快照。
> 2026-10-17 已改为输出独立文件。

================================
# 第二优先级：AI工作规则

## DEVELOPMENT_RULES.md
开发规范。

## AI_SECURITY_RULES.md
安全和权限。

## AI_DECISION_LOG.md
重大决策记录（含历史技术选型的理由）。

## AI_CONTEXT_LOADING_ORDER.md
AI上下文读取顺序。

## AI_START_PROMPT.md
接管启动提示词。要求先只读、再输出项目理解报告。

## AI_STARTUP_CHECKLIST.md
接管启动检查表。规定新会话必须完成的初始化步骤。

## AI_TASK_QUEUE.md
任务队列。接手后应优先查看当前最高优先级任务。

================================
# 第三优先级：技术架构

## ARCHITECTURE.md
系统结构。技术栈。部署拓扑。数据流。外部依赖。
已于 2026-10-16 重写 —— V1.0 仅约 360 字符，且部署链路遗漏 Cloudflare 隧道。

## DEPLOYMENT.md
部署方式。构建流程。开机自启。定时任务。
已于 2026-10-16 重写 —— V1.0 误写「nginx 负责 HTTPS」，实际 HTTPS 在 Cloudflare 侧。

## DATABASE_SCHEMA.md
数据库设计。18 张表的结构与字段（含实体关联三表，见第 14b-14d 节）。
含出行管家的访问控制与导出设计（这两部分不入库）、数据量基线。

## DATABASE.md
数据库设计要点（简版，详细内容见 DATABASE_SCHEMA.md）。

## FEATURES.md
功能说明。

## CODE_MAP.md
代码位置索引。

================================
# 第四优先级：故障排查

## AI_TROUBLESHOOTING_GUIDE.md
故障排查手册。**遇到问题优先读这份。**

含 11 类故障的排查流程，以及多个实测案例：

高德单 Key QPS 限流（并发 5 时 26 个活动仅 4 个拿到坐标，错误码 10021）。

地理编码越界（地址被解析到别的省份）。

「有打车费却没有坐标与通勤」的完整根因分析。

和风天气接口的两个坑及改版记录。

通勤时间过长或跨区的两类原因。

================================
# 第五优先级：数据体系

## AI_DATA_GOVERNANCE.md
数据质量规则。

## KNOWLEDGE_BASE_DESIGN.md
知识库设计。

## AI_KNOWLEDGE_UPDATE_POLICY.md
知识更新策略。

================================
# 第六优先级：AI智能体系

## AGENT_SYSTEM_DESIGN.md
Agent架构。

## AI_PROMPT_LIBRARY.md
AI提示词库。

## AI_EVALUATION_STANDARD.md
AI输出评价。

## AI_API_INTEGRATION.md
模型接入规范。

================================
# 第七优先级：自动化运营

## AI_AUTOMATION_WORKFLOW.md
自动化流程。

## AI_MONITORING_STANDARD.md
运行监控。

## AI_COST_MANAGEMENT.md
成本控制。

## AI_BACKUP_STRATEGY.md
备份策略（内容、位置、周期）。

## AI_BACKUP_RECOVERY.md
备份与恢复规范。

## AI_TESTING_STANDARD.md
测试规范。

## AI_RELEASE_PROCESS.md
发布流程。

## AI_PRODUCTION_CHECKLIST.md
生产环境检查清单。

## AI_CHANGE_MANAGEMENT.md
变更管理。

## AI_HEALTH_REPORT.md
项目健康度报告。由 `daily-ai-maintenance.sh` 生成，**手改会被覆盖**。

================================
# 项目根目录的两份必读文档

以下两份不在 ai-context 目录，而在项目根目录。

## AI-START-HERE.md
**新会话应先读这份。**
改动流程与验证要求。本项目验证过的坑。当前已知问题。沟通约定。

## RECOVERY.md
**电脑损坏后在新机器上重建站点的完整步骤。**
含数据库恢复（已在隔离环境演练验证）、Cloudflare 隧道重建（含 IPv4 + HTTP2 参数）。

================================
# AI接管标准流程

第一步：
读取 AI-START-HERE.md（项目根目录）。

第二步：
读取本文件。

第三步：
读取 AI_CONTEXT_LOADING_ORDER.md。

第四步：
读取 PROJECT_MEMORY.md 与 CURRENT_STATUS.md。

第五步：
理解架构、数据库、部署 ——
读取 ARCHITECTURE.md、DATABASE_SCHEMA.md、DEPLOYMENT.md。

第六步：
读取 AI_STARTUP_CHECKLIST.md，按其要求完成初始化。

第七步：
读取 AI_TASK_QUEUE.md，确认当前任务。

遇到问题时：
读取 AI_TROUBLESHOOTING_GUIDE.md。

需要重建站点时：
读取 RECOVERY.md。

================================
# 当前项目核心方向

AI Insight Daily：

不是普通新闻网站。

目标：

AI产业智能分析平台。

发展路线：

V7 AI产业驾驶舱

↓

V8 AI产业知识库

↓

V9 AI Agent生态

↓

V10 AI产业智能操作系统

================================
# AI协作原则

AI必须：

理解后修改。

修改后测试。

重要变化记录。

禁止：

不了解项目直接重构。

================================
# 文档维护约定

**文档的价值取决于它与代码是否同步 —— 过时的文档比没有文档更危险。**

改动若涉及以下任一项，请顺手更新对应文档，并在标题下标注核实日期：

部署方式或网络链路变化 → DEPLOYMENT.md、ARCHITECTURE.md

新增或修改数据表 → DATABASE_SCHEMA.md

新增模块或访问控制 → ARCHITECTURE.md、DATABASE_SCHEMA.md

踩到新的坑并解决 → AI_TROUBLESHOOTING_GUIDE.md

================================
# 版本信息

文档版本：

V2.0

最后更新：

2026-10-16
