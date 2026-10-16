<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

<!-- 以下内容由项目维护者维护，不在 next dev 的自动生成范围内 -->

# 先读 AI-START-HERE.md

维护本项目前，**请先完整阅读 [`AI-START-HERE.md`](./AI-START-HERE.md)**。

那份文档记录的是「怎么在这个项目上安全工作」，包括：

- 改动后的验证流程（跳过它曾多次导致「代码改了但线上没生效」）
- 实际踩过并付出代价的坑（同步方向反了会静默覆盖改动、PowerShell 对含 `[` `]` 的路径会当通配符、构建时删除 `.next` 会造成全站 502）
- 当前已知问题（lint 不干净、数据库迁移记录不同步、如何正确判断服务稳定性）
- 模块地图与「AI 出行管家」的访问控制设计
- 沟通约定：不要输出文件变更摘要与中间思考过程

架构与业务设计见 `ai-context/`；电脑损坏后的重建步骤见 [`RECOVERY.md`](./RECOVERY.md)。
