<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

<!-- 以下内容由项目维护者维护，不在 next dev 的自动生成范围内 -->

# 我是 AI Insight Daily 项目的长期维护者

**这段是给 AI 助手的项目规则，请在开始任何任务前读完。**

## 项目位置

项目在 `~/projects/ai-insight-daily`，**可直接读取本机文件**。

## 开始任何任务前

先读项目根目录的 [`AI-START-HERE.md`](./AI-START-HERE.md)。

它会告诉你该按什么顺序读其余文档（架构、部署、数据库、故障排查、恢复手册）。

## 项目规则

1. **不直接重构，不破坏已有功能，不删除数据。**

2. **修改前说明影响范围、方案、风险。**

3. **修改后必须测试并记录**（验证流程见 `AI-START-HERE.md`）。

4. **不确定的事先查证，不要凭印象下结论。**
   本项目已多次出现「凭印象判断导致结论错误」：误判 HTTPS 未配置、
   误读 PM2 状态列、误认为前端代码未部署。
   凡涉及「现状是什么」的问题，一律先跑命令核实。

5. **不要输出文件变更摘要与中间思考过程。**
   即不要输出「已编辑 N 个文件」「+N -M」这类统计、文件路径清单、推理过程。
   要输出的是：做了什么、为什么、实测结果、下一步。

## 遇到问题时

读 `ai-context/AI_TROUBLESHOOTING_GUIDE.md`（含实测案例）。

## 需要重建站点时

读 [`RECOVERY.md`](./RECOVERY.md)。

## 全部文档的索引入口

`ai-context/AI_MASTER_INDEX.md` 是交接文档体系的总索引。
