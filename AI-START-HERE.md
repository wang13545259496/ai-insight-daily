# AI 维护入口

> **新会话请先读完这份文件**，再动手改任何东西。
>
> 这份文档记录的是「怎么在这个项目上安全工作」——
> 命令、约定、以及过去踩过并付出代价的坑。
> 架构与业务设计见 `ai-context/` 目录；故障重建见 `RECOVERY.md`。

---

## 一、项目是什么

**AI Insight Daily** —— AI 资讯与 Agent 生态平台。

自托管在**一台 Windows 电脑上的 WSL2 Ubuntu** 里，通过 Cloudflare 隧道对外提供服务。

```
浏览器 ──HTTPS──▶ Cloudflare ──加密隧道──▶ cloudflared
                                              ↓
                                          nginx :80
                                              ↓
                                       Next.js :3000（PM2 管理）
                                              ↓
                                      Prisma ──▶ SQLite
```

| 项 | 值 |
| --- | --- |
| 域名 | aibiliai.com |
| 项目路径 | `~/projects/ai-insight-daily` |
| 代码仓库 | `git@github.com:wang13545259496/ai-insight-daily.git`（私有） |
| 技术栈 | Next.js 16.3.5（App Router）· React 19 · Prisma 6 · SQLite · TypeScript 5.9 |
| Node | v22.x（`next.config.ts` 与依赖按此版本） |
| 进程管理 | PM2，进程名 `ai-insight-daily` |
| 数据库 | `prisma/dev.db`（SQLite，约 8.5 MB） |

### 关键路径

| 用途 | 位置 |
| --- | --- |
| 环境变量 | `~/projects/ai-insight-daily/.env.local`（gitignored，**没有备份**，见 `RECOVERY.md`） |
| nginx 站点配置 | `/etc/nginx/sites-available/ai-insight-daily` |
| 隧道凭据 | `/etc/cloudflared/token`（root 权限） |
| 应用日志 | `pm2 logs ai-insight-daily` |
| 备份日志 | `logs/db-backup.log` |
| 数据库异地备份 | GitHub 的 `db-backup` 分支（孤儿分支） |

---

## 二、改动的工作流程

**这个项目有一套必须遵守的验证流程。** 跳过它曾多次导致「代码改了但线上没生效」或「线上被打挂」。

### 标准循环

```bash
cd ~/projects/ai-insight-daily

# 1. 改代码
# 2. 类型检查（最快暴露问题）
npx tsc --noEmit

# 3. 跑相关测试
npx tsx --test lib/agents/travel/*.test.ts     # 只跑改动相关的
npx tsx --test lib/agents/travel/*.test.ts lib/ranking/*.test.ts lib/*.test.ts   # 跑全部（460 项）

# 4. 构建（约 48 秒）
npm run build

# 5. 重启
pm2 restart ai-insight-daily --update-env

# 6. 实测验证（★ 最容易跳过，也最重要）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

### 第 6 步为什么不能省

**「代码正确」不等于「线上生效」。** 本项目实际发生过：

- 源码和构建产物都有新代码，但服务跑的是旧版本 → 需要重建 + 重启
- 构建失败但服务仍在跑旧版本 → 用户看到的是旧行为，而 `tsc` 已通过
- 改了文案但被反向同步覆盖 → 线上显示旧文案

**验证方式**：改完必须用 `curl` 实际请求页面/接口，检查响应内容里有没有新东西。不要只看构建日志。

### 构建时不要删 `.next`

```bash
# ✗ 错误做法：删除构建目录时服务还在跑，会造成全站 502
rm -rf .next && npm run build

# ✓ 正确做法：直接构建（Next 会增量更新），成功后再重启
npm run build && pm2 restart ai-insight-daily --update-env
```

### 提交前

```bash
git status --short          # 确认没有意外文件
git add -A && git commit    # 提交信息写清「为什么」而不只是「做了什么」
git push origin main
```

---

## 三、这个项目上验证过的坑

**以下每一条都实际发生过，不是理论风险。**

### 1. 同步方向（代价最大）

本项目的编辑器工作区与项目目录**是两份拷贝**。同步方向反了会**静默覆盖对方的改动**——这个错误在本项目上发生过三次。

```
规则：改文件前先确认改的是哪一份
     同步后必须验证目标文件内容（行数/grep 关键字），不能只看 cp 成功
```

### 2. Windows 路径含 `[` `]` 时不能用 PowerShell 文件命令

Next.js 的动态路由目录（`app/api/travel/[id]/`）会被 PowerShell 当成**通配符**，`Copy-Item` 会静默创建目录但不复制文件。症状是接口 404。

```
解决：用 WSL 的 cp，或对路径做转义
```

### 3. 不要在命令行里内联复杂引号

含中文、正则、嵌套引号的一行命令会反复失败（`unexpected EOF`、`syntax error near unexpected token`）。**写成 `.sh` 文件再执行**，稳定得多。

### 4. Shell heredoc 同样不可靠

`cat > file <<EOF` 在多层引号包裹下会被外壳提前吃掉。**用文件写入工具，不要用 heredoc。**

### 5. 高德静态图接口有 QPS 限流

并发请求会返回 `CUQPS_HAS_EXCEEDED_THE_LIMIT`，**且返回体是 JSON 而非图片**。生成多天路线图必须**串行 + 间隔**。

### 6. 改动要真正测出来，不能只看代码

- 取图逻辑要检查「实际嵌进去几张图」，而不是「代码写了要取图」
- 鉴权要分别测「未登录 / 无效 Cookie / 有效 Cookie」三种状态
- 改路径要确认**旧路径仍可用**（重定向）且**站内链接指向新路径**（否则每次访问都多一次跳转）

---

## 四、当前状态与已知问题

### 测试

```bash
npx tsx --test lib/agents/travel/*.test.ts lib/ranking/*.test.ts lib/*.test.ts
# 460 项通过
```

测试用 Node 内置的 `node:test` + `tsx`，**没有 `npm test` 脚本**（这是可以改进的地方）。

### lint 目前不干净

```bash
npm run lint
# 88 个问题（61 errors, 27 warnings）
```

**这些是长期存在的问题，不是新引入的。** 改动时不要把 lint 通过当作门槛，但**不要增加新的 lint 错误**。

### PM2 重启次数偏高

```bash
pm2 list    # 查看 ↺ 列
```

重启次数多通常意味着某个改动导致进程反复崩溃。若发现次数在短时间内快速增长，先看 `pm2 logs ai-insight-daily --err`。

### 数据库与迁移记录有一处不同步

`npx prisma migrate status` 会提示 `20261014120000_add_event_industry_score` 未应用，但**字段实际已存在**，功能正常。执行 `migrate deploy` 时若因字段已存在而报错，跳过即可。

### `package.json` 的 postinstall 有无效命令

```json
"postinstall": "prisma skills sync || exit 0"
```

Prisma 没有 `skills` 子命令，安装时会打印 `! Unknown command "skills"`，被 `|| exit 0` 掩盖。**可以忽略**，但值得清理。

### 数据库结构变更必须用 Migrate

```bash
# ✓ 正确：生成迁移文件并应用
npx prisma migrate dev --name 描述

# ✗ 危险：db push 在检测到结构漂移时可能删列
npx prisma db push
```

---

## 五、模块地图

顶层路由（`app/` 下）：

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 今日重点、产业情报、产业链总览 |
| AI 资讯 | `/news` | 资讯列表与详情 |
| 事件中心 | `/events` | 事件聚类与追踪 |
| 产业趋势 | `/industry` | 产业链、热点、趋势 |
| Agent 生态 | `/agent`、`/agent-score`、`/agent-map`、`/agent-graph` 等 | Agent 相关的一系列页面 |
| 机会地图 | `/opportunity-map` | 商业机会 |
| 投资观察 | `/investment` | 投资标的与评分 |
| **AI 出行管家** | `/agent-travel` | 行程规划（需口令，见下） |
| 后台 | `/admin` | 数据与系统状态 |

### AI 出行管家（原「旅行规划」）的访问控制

这个模块**页面公开、生成需登录**，是刻意的设计：

```
/travel 或 /agent-travel        页面公开，任何人可看表单
历史方案列表                     仅登录者可见（服务端按登录态决定是否查库）
/api/travel/plan（生成）         需登录，返回 401 + code: TRAVEL_AUTH_REQUIRED
/api/travel/plan/:id（读取）     需登录
/api/travel/:id/download         需登录
```

| 项 | 说明 |
| --- | --- |
| 口令 | 环境变量 `TRAVEL_PASSWORD`（未设置则该模块完全公开） |
| 会话 | HMAC 派生令牌存 Cookie，**服务端无 session**，重启不失效 |
| 有效期 | 30 天，**每次访问自动续期**（闲置 30 天才需要重新登录） |
| 拦截位置 | 页面不拦；接口在各自路由内校验（生成是流式响应，Proxy 层难处理） |
| 相关文件 | `proxy.ts`、`lib/travel-access.ts`、`lib/travel-access-server.ts`、`app/agent-travel/`、`components/agent-travel/` |

**注意**：旧路径 `/travel` 通过 `next.config.ts` 的 308 跳转指向 `/agent-travel`。接口路径 `/api/travel/*` **有意未改**（内部实现，无外部收益）。

### 关键约定

- **Next.js 16 把 `middleware` 改名为 `proxy`** —— 文件名与导出名都必须用 `proxy`。写这类代码前先读 `node_modules/next/dist/docs/` 里的文档，**不要凭记忆写**。
- **金额由确定性算法计算，AI 只负责编排内容。** 不要把价格计算交给模型。
- 新增接口若会消耗模型或外部 API 配额，**在动手前先校验权限**，不要等开始输出后才发现未授权。

---

## 六、维护任务速查

```bash
# 服务状态
pm2 list && pm2 logs ai-insight-daily --lines 30

# 重启（改了环境变量必须加 --update-env）
pm2 restart ai-insight-daily --update-env

# 数据库
npx prisma studio                    # 可视化查看
npx prisma migrate status            # 迁移状态
sqlite3 prisma/dev.db ".tables"      # 表清单

# 手动备份数据库到 GitHub
bash scripts/backup-db-to-github.sh

# 检查备份新鲜度
cat ~/.last-db-backup                # 时间戳
tail -20 logs/db-backup.log

# 隧道状态
systemctl status cloudflared
journalctl -u cloudflared -n 30 --no-pager
```

### 定时任务

```bash
crontab -l
```

- `0 23 * * *` —— 数据库异地备份（调度脚本会判断是否真的需要跑）
- `@reboot` —— 开机补跑备份
- `0 2 * * *` —— 每日资讯抓取

> 注意机器不是 24 小时开机，**凌晨的定时任务经常不会执行**（cron 不补跑）。
> 新增定时任务前先确认目标时间点机器是否在运行。

---

## 七、沟通约定

这个项目的维护者有明确的偏好，请遵守：

**不要输出：**
- 文件变更摘要（`已编辑 N 个文件`、`+N -M` 这类统计）
- 文件路径清单
- 中间思考过程
- 冗长的验证脚本命令原文

**要输出：**
- 做了什么、为什么这么做
- 实测结果与数据
- 下一步该做什么
- **犯的错误要如实说明**，不要掩盖或轻描淡写

**验证要求：**
- 说「已完成」之前，必须实际测过
- 涉及安全或数据的改动，要分别测正常与异常路径
- 发现自己判断错了，要主动更正之前的结论

---

## 八、如果需要重建整个站点

见 [`RECOVERY.md`](./RECOVERY.md) —— 电脑损坏后在新机器上从零恢复的完整步骤（含数据库恢复、隧道重建、nginx 配置原文）。
