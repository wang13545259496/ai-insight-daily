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

6. **一旦要更新文档，就把所有该更新的地方一次更新完，不要逐个询问。**

   维护者的原话：「以后更新整个需要更新的地方全部更新一遍，不要问」。

   这意味着每次改动后，主动检查并同步下面这些位置，而不是等被问：

   | 位置 | 何时需要更新 |
   | --- | --- |
   | `ai-context/AI_VERSION_INFO.md` | 任何重大改动；含「本轮变更」概要 |
   | `AI-HANDOVER.zip` | 与上一条同步（**先更新标记，再打包**） |
   | `ai-context/DATABASE_SCHEMA.md` | 表结构或数据量变化 |
   | `ai-context/ARCHITECTURE.md` | 拓扑、技术栈、数据流变化 |
   | `ai-context/DEPLOYMENT.md` | 部署方式、端口、服务变化 |
   | `ai-context/CODE_MAP.md` | 新增路由、目录、脚本 |
   | `ai-context/FEATURES.md` | 新增功能 |
   | `ai-context/AI_TASK_QUEUE.md` | 任务完成或新增 |
   | `ai-context/AI_TROUBLESHOOTING_GUIDE.md` | 排查出新的故障模式 |
   | `AI-START-HERE.md` | 入口信息、当前状态 |
   | `RECOVERY.md` | 重建步骤受影响时 |
   | `ai-context/CURRENT_STATUS.md` | 当前状态叙述（**手写，勿用脚本覆盖**） |
   | `ai-context/AI_HEALTH_REPORT.md` | 用 `daily-ai-maintenance.sh` 重新生成 |
   | `ai-context/AI_STATUS_AUTO.md` | 用 `generate-ai-status.sh` 重新生成 |

   **顺序不能反**：先更新文档内容 → 再更新版本标记 → 最后打包。
   打包会把当时的文件内容固化进 ZIP，顺序错了包内就是旧内容。
   （2026-10-17 踩过：ZIP 里标记比仓库文件旧一天。）

   **脚本文档不手改**：`AI_HEALTH_REPORT.md` 与 `AI_STATUS_AUTO.md`
   由脚本生成，手改会被下次运行覆盖。

7. **未经维护者明确许可，不得开启搜索引擎收录。**

   `lib/site-indexing.ts` 里的 `SITE_ALLOW_INDEX` 必须保持 `false`。

   这**不是**一个待优化的技术默认值，而是维护者基于合规状态做的决定：
   本站尚未完成 ICP 备案，运营主体未定。

   为什么这条要写成硬规则：
   搜索引擎收录**不可逆** —— 缓存、第三方镜像、Wayback 存档会长期留存。
   而 `noindex` 只是请求，随时可撤。所以当前选择保留选择权。

   **不要因为以下理由擅自改成 true：**
   - 「网站没人访问，开了收录才有流量」
   - 「加个 sitemap 能提升 SEO」
   - 「noindex 让站点显得不完整」

   流量与 SEO 是维护者已经权衡过并**暂时放弃**的收益。
   想改变这一点，必须先由维护者明确表态，再动代码。

   改法（维护者同意后）：把常量改成 `true`，
   `npm run build && pm2 restart ai-insight-daily`。
   三处会同步变化，详见 `ai-context/DEPLOYMENT.md` 的「搜索引擎收录开关」。

   **注意：`noindex` 不是保密。** 它只请求搜索引擎不收录，
   不阻止任何人直接访问。要真正私密需要鉴权。

8. **发现死文件直接删，不用问。**

   维护者的原话：「这种没用的文件留着也没用，直接处理，不用问我。」

   上一次清理删了 32 个死组件，但漏了 30 个（8878 行）——
   因为只扫了 `components/`，没扫备份文件和 `app/` 下的非路由文件。
   所以这条规则要和「怎么判断」一起执行。

   ## 算死文件的

   - **版本备份**：`*.bak`、`*.backup.*`、`*-backup.*`、`*.orig`、`*.old`
     （内容是过去某轮的临时快照，git 历史里都有）
   - **无引用的组件**：全项目搜不到 import

   ## 判断方法（必须做，别靠文件名猜）

   ```bash
   # 用不带扩展名的模块名搜，因为 import 写的是 @/components/Foo
   grep -rIl --include='*.tsx' --include='*.ts' "Foo" app components lib
   ```

   **踩过**：第一遍用 `grep "CategoryFilter.tsx"` 搜，结果 0 命中，
   差点把在用的组件当成死文件。正确的搜法是搜模块名 `CategoryFilter`，
   不带 `.tsx`。

   ## 注意：`app/` 下不是 `page.tsx` 的文件 ≠ 死文件

   Next 只把 `page` / `layout` / `route` / `loading` / `error` /
   `not-found` / `template` / `default` / `global-error` 当路由约定，
   但普通组件可以放在 `app/` 里被 `page.tsx` 引用。例如：

   ```
   app/components/IndustryLayerList.tsx   ← 被 app/page.tsx 引用，不能删
   app/startup/StartupClient.tsx          ← 被 app/startup/page.tsx 引用
   ```

   ## 删之前必须确认

   - `git ls-files --error-unmatch <file>` 通过（在 git 里，删了能恢复）
   - 不是被 `dynamic import()` 或字符串拼出来的模块

   ## 删之后必须验证

   `npx tsc --noEmit` + `npm run build` + 全站抽查页面 200 + 跑测试。
   少一个步骤都可能把「删对了文件但改坏了引用」放过去。

## 遇到问题时

读 `ai-context/AI_TROUBLESHOOTING_GUIDE.md`（含实测案例）。

## 需要重建站点时

读 [`RECOVERY.md`](./RECOVERY.md)。

## 全部文档的索引入口

`ai-context/AI_MASTER_INDEX.md` 是交接文档体系的总索引。
