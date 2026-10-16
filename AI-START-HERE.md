# AI 维护入口

> **新会话请先读完这份文件**，再动手改任何东西。
>
> 本文档只写**别处没有的内容**：在这个项目上工作的方式、当前真实状态、
> 以及过去付出过代价的错误。项目是什么、怎么部署、架构如何，
> 请看下面的指引表，本文不重复。

---

## 零、该读哪些文档

**按这个顺序读，不要跳。** 前四份是理解项目，第五份是本文档。

| # | 文档 | 读它是为了知道 |
| --- | --- | --- |
| 1 | [`ai-context/AI_MASTER_INDEX.md`](./ai-context/AI_MASTER_INDEX.md) | 交接文档体系的全貌与索引 |
| 2 | [`ai-context/ARCHITECTURE.md`](./ai-context/ARCHITECTURE.md) | 技术栈、部署拓扑、数据流、外部依赖 |
| 3 | [`ai-context/DEPLOYMENT.md`](./ai-context/DEPLOYMENT.md) | 运维操作、构建流程、开机自启、定时任务 |
| 4 | [`ai-context/DATABASE_SCHEMA.md`](./ai-context/DATABASE_SCHEMA.md) | 15 张表的结构与数据量基线 |
| 5 | **本文档** | 工作方式、当前状态、历史教训 |

**遇到故障时**另读 [`ai-context/AI_TROUBLESHOOTING_GUIDE.md`](./ai-context/AI_TROUBLESHOOTING_GUIDE.md)
—— 那份手册包含实测案例（高德 QPS 限流的复现数据、地理编码越界、
天气接口改版等），是排查问题的第一手材料。

**电脑损坏需要重建时**读 [`RECOVERY.md`](./RECOVERY.md)。

---

## 一、改动的标准流程

**这个项目有一套必须遵守的验证流程。** 跳过它曾多次导致
「代码改了但线上没生效」或「线上被打挂」。

### 第 0 步：动手前先说明影响范围

**在写任何代码之前**，先说清楚：

```
影响范围   会动哪些文件、哪些模块、是否涉及数据库
方案       打算怎么做、为什么这么选
风险       可能破坏什么、有无回滚方式
```

**这一步不是形式。** 本项目有若干不可逆操作（数据库结构变更、
路径改名影响已分享的链接、删除 `.next` 造成全站 502 窗口），
先说出来才能在被叫停时避免损失。

> 维护者明确要求过这条，是与其他 AI 协作时保留下来的一条规则。

### 第 1-6 步：改动与验证

```bash
cd ~/projects/ai-insight-daily

# 1. 改代码

# 2. 类型检查（最快暴露问题）
npx tsc --noEmit

# 3. 跑测试
npx tsx --test lib/agents/travel/*.test.ts lib/ranking/*.test.ts lib/*.test.ts
# 当前 460 项全通过

# 4. 构建（约 48 秒）
npm run build

# 5. 重启（改了环境变量必须加 --update-env）
pm2 restart ai-insight-daily --update-env

# 6. ★ 实测验证
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

### 第 6 步为什么不能省

**「代码正确」不等于「线上生效」。** 本项目实际发生过：

- 源码与构建产物都有新代码，但服务跑的是旧版本
- 构建失败而服务仍在跑旧版本 —— 用户看到旧行为，而 `tsc` 已通过
- 改了文案但被反向同步覆盖，线上显示旧文案

**验证方法**：用 `curl` 实际请求页面或接口，检查响应内容里有没有新东西。
不要只看构建日志。

### 构建时不要删除 `.next`

```bash
# ✗ 服务运行中删除构建目录 → 全站 502，直到构建完成
rm -rf .next && npm run build

# ✓ 直接构建（Next 会增量更新），成功后再重启
npm run build && pm2 restart ai-insight-daily --update-env
```

### 提交前

```bash
git status --short          # 确认没有意外文件
git add -A && git commit    # 提交信息写清「为什么」而不只是「做了什么」
git push origin main
```

---

## 二、这个项目上验证过的坑

**以下每一条都实际发生过，不是理论风险。**
运行时故障（如接口报错、数据异常）见 `AI_TROUBLESHOOTING_GUIDE.md`；
这里只列**与「怎么改代码」有关**的坑。

### 1. 同步方向（代价最大，发生过三次）

编辑器工作区与项目目录**是两份拷贝**。同步方向反了会**静默覆盖对方的改动**。

```
规则：改文件前先确认改的是哪一份
     同步后必须验证目标文件内容（行数或 grep 关键字），不能只看 cp 成功
```

> 若新机器上只有一份拷贝，此问题自动消失。

### 2. 路径含 `[` `]` 时不能用 PowerShell 文件命令

Next.js 动态路由目录（如 `app/api/travel/[id]/`）会被 PowerShell 当成**通配符**，
`Copy-Item` 会静默创建目录但不复制文件，症状是接口 404。

```
解决：用 WSL 的 cp
```

### 3. 不要在命令行内联复杂引号

含中文、正则、嵌套引号的一行命令会反复失败
（`unexpected EOF`、`syntax error near unexpected token`）。
**写成 `.sh` 文件再执行**，稳定得多。

### 4. Shell heredoc 同样不可靠

`cat > file <<EOF` 在多层引号包裹下会被外壳提前吃掉。
**用文件写入工具，不要用 heredoc。**

### 5. 改路径后要检查模板字符串

把 `/travel` 改为 `/agent-travel` 时，第一轮搜索用的是 `"/travel`（带引号），
**漏掉了反引号模板字符串** `` href={`/travel/${id}`} ``。

后果：链接能用，但每次访问多走一次 308 跳转。

```
教训：搜索路径引用时，要同时覆盖 "/xxx、'/xxx、`/xxx 三种形式
```

### 6. 改完要测「异常路径」，不能只测正常路径

- 鉴权要分别测**未登录 / 无效 Cookie / 有效 Cookie** 三种状态
- 取图逻辑要检查**实际嵌进去几张图**，而不是「代码写了要取图」
- 改路径要确认**旧路径仍可用**（重定向）**且站内链接指向新路径**
- 涉及数据隐藏时，要 grep 响应内容确认**没有泄漏**，而不是只看页面显示

---

## 三、当前状态与已知问题

> 以下状态实测于 2026-10-16。数据量基线见 `DATABASE_SCHEMA.md`。

### 测试

```bash
npx tsx --test lib/agents/travel/*.test.ts lib/ranking/*.test.ts lib/*.test.ts
# 460 项通过，约 1-2 秒
```

测试用 Node 内置的 `node:test` 加 `tsx`。
**项目没有 `npm test` 脚本** —— 这是可以改进的地方。

### lint 不干净（长期存在）

```bash
npm run lint
# 88 个问题（61 errors, 27 warnings）
```

**这些是历史遗留，不是新引入的。** 改动时不要把 lint 通过当作门槛，
但**不要增加新的 lint 错误**。

### 数据库迁移记录有一处不同步

`npx prisma migrate status` 会提示 `20261014120000_add_event_industry_score` 未应用，
但**字段实际已存在**，功能正常。

执行 `migrate deploy` 时若因字段已存在而报错，跳过即可。

### `package.json` 的 postinstall 有无效命令

```json
"postinstall": "prisma skills sync || exit 0"
```

Prisma 没有 `skills` 子命令，安装时会打印 `! Unknown command "skills"`，
被末尾的 `|| exit 0` 掩盖。**可以忽略**，但值得清理。

### 判断服务是否稳定：看 unstable restarts，不是 restarts

```bash
pm2 describe ai-insight-daily | grep -E 'restarts|uptime'
```

| 字段 | 含义 |
| --- | --- |
| `restarts` | 累计重启。**部署与手动重启也会计入**，数值高不代表有问题 |
| `unstable restarts` | **异常重启，这才是崩溃信号**，应保持 0 |
| `uptime` | 本次运行时长，只有几十秒说明刚重启过 |

> 我曾把 `restarts` 数值偏高误判为崩溃循环，实际那些是正常部署累加的。

### 机器不是 24 小时开机

**cron 不补跑错过的任务。** 凌晨时段机器常处于关机状态。

实际后果：原定 `0 3 * * *` 的数据库备份在 10 天里只成功执行过 1 次。

**新增定时任务前，先确认目标时间点机器是否在运行。**
需要「必定执行」的任务，改用「定时触发 + 判断上次执行时间」的模式
（参考 `scripts/db-backup-scheduler.sh`）。

---

## 四、数据库变更规则

**本项目用 Prisma Migrate，不是 `db push`。**

```bash
npx prisma migrate dev --name 描述      # 开发：生成并应用迁移
npx prisma migrate deploy               # 部署：应用待执行迁移
npx prisma migrate status               # 查看状态

# ✗ 危险：检测到结构漂移时可能删除列
npx prisma db push
```

数据库里有 `_prisma_migrations` 表记录已应用项，
迁移文件在 `prisma/migrations/`（当前 9 个），且都写成可重复执行的形式
（例如 `CREATE INDEX IF NOT EXISTS`）。

---

## 五、几条设计约定

### 金额由确定性算法计算，AI 只编排内容

出行管家的预算、票价、里程都来自代码计算或接口查询，
**模型不参与数值计算** —— 避免幻觉产生不可信的价格。

### 新增接口若消耗模型或外部配额，先校验权限

不要在开始输出后才检查授权。生成行程要消耗模型与地图配额，
必须在做任何工作之前拦截。

### Next.js 16 的约定与旧版不同

`middleware` 已更名为 `proxy`（文件名与导出名都要改）。
**写这类代码前先读 `node_modules/next/dist/docs/` 里的文档，不要凭记忆写。**

### 出行管家的访问控制是三层结构

```
页面公开                  任何人都能看表单
生成与读取接口需登录       401 + code: TRAVEL_AUTH_REQUIRED
历史方案列表仅登录可见     服务端按登录态决定是否查库
```

第三条最容易被做错：**若照常查询再用 CSS 隐藏，行程记录已随 HTML 下发，
等于没有保护。** 详见 `DATABASE_SCHEMA.md` 的「旅行模块：不入库的部分」。

---

## 六、维护任务速查

```bash
# 服务状态
pm2 list && pm2 logs ai-insight-daily --lines 30
pm2 describe ai-insight-daily | grep -E 'restarts|uptime'

# 重启（改了环境变量必须加 --update-env）
pm2 restart ai-insight-daily --update-env

# 数据库
npx prisma studio                    # 可视化查看
npx prisma migrate status            # 迁移状态
sqlite3 prisma/dev.db ".tables"      # 表清单

# 备份
bash scripts/backup-db-to-github.sh  # 手动备份到 GitHub
tail -20 logs/db-backup.log          # 备份日志

# 隧道（网站打不开时必查）
systemctl status cloudflared
journalctl -u cloudflared -n 30 --no-pager

# 定时任务
crontab -l
```

---

## 七、沟通约定

维护者有明确的偏好，请遵守。

**不要输出：**

- 文件变更摘要（`已编辑 N 个文件`、`+N -M` 这类统计）
- 文件路径清单
- 中间思考过程
- 冗长的验证脚本命令原文

**要输出：**

- 做了什么、为什么这么做
- 实测结果与数据
- 下一步该做什么
- **犯的错误如实说明**，不要掩盖或轻描淡写

**验证要求：**

- 说「已完成」之前，必须实际测过
- 涉及安全或数据的改动，要分别测正常与异常路径
- 发现自己判断错了，要主动更正之前的结论

---

## 八、这个项目的文档体系说明

`ai-context/` 下约二十份文档写于 2026-10-11 前后，覆盖项目理解、
治理规范与故障排查。它们**大部分仍然准确且价值很高**，
尤其是故障排查手册里的实测案例。

但其中**部分内容会因为项目演进而过时**。已知已修正的：

| 文档 | 原问题 | 状态 |
| --- | --- | --- |
| `DEPLOYMENT.md` | 写「nginx 作用：域名解析、HTTPS」，实际 HTTPS 与 DNS 都在 Cloudflare 侧；部署链路漏了隧道 | V2.0 已更正 |
| `ARCHITECTURE.md` | 全文约 360 字符，是个骨架；部署拓扑缺隧道层 | V2.0 已重写 |
| `DATABASE_SCHEMA.md` | 未记录出行管家的访问控制与导出设计 | 已补充 |

**维护这些文档时的建议**：改动若涉及部署方式、外部依赖或模块新增，
顺手更新对应文档，并在标题下标注核实日期。

### 文档同步的自动化

交接包相关的版本标记**不需要手工维护**，有两个脚本：

```bash
# 查看文档记录的 commit 落后代码多少（只读，不修改）
bash scripts/update-version-info.sh --check

# 更新标记到当前 commit
bash scripts/update-version-info.sh

# 重新生成交接包（会写入当前 commit 与文件清单）
bash update-ai-handover.sh
```

**什么时候跑**：完成一次较大的开发并提交之后。

`--check` 的退出码非 0 表示落后，可以放进提交前的检查里。

### 交接包的内容规则

`update-ai-handover.sh` 按规则收集，不是硬编码清单：

| 来源 | 收集方式 |
| --- | --- |
| `ai-context/` | 整个目录 |
| 根目录文档 | 自动收集所有 `*.md` |
| 根目录脚本 | 自动收集所有 `*.sh` |
| `scripts/` | `*.sh` 全部，加备份/恢复相关的 `*.ts` |
| 核心文件 | `package.json`、`package-lock.json`、`prisma/schema.prisma`、`next.config.ts`、`tsconfig.json` |

**所以新增根目录文档或脚本会自动被包进去**，不需要改脚本。

> `AI-HANDOVER/` 是暂存目录，每次重建，已加入 `.gitignore`
> 并从版本控制移除。**有交付价值的是 `AI-HANDOVER.zip`**，
> 它仍在版本控制中。

### 为什么不建 CHANGELOG.md

`ai-context/AI_CHANGELOG_TEMPLATE.md` 提供了模板，但实际从未建立
`CHANGELOG.md`。这是**有意为之**：它与 git 提交历史功能重叠，
维护成本大于收益。

查阅变更请用 `git log --oneline`；
`AI_VERSION_INFO.md` 只负责记录「交接包对应哪个 commit」。
文档的价值取决于它是否与代码同步 —— 过时的文档比没有文档更危险。
