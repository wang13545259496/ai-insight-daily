# AI Insight Daily 部署说明

> 版本：V2.0（2026-10-16 核实重写）
> V1.0 写于 2026-10-05，当时站点尚未接入 Cloudflare 隧道，
> 本文档经过两轮修正：①「nginx 作用：域名解析、HTTPS」不实；
> ② nginx 实际不在链路上，已于 2026-10-17 停用。

---

## 一、服务器环境

| 项 | 值 |
| --- | --- |
| 运行环境 | Windows + WSL2 Ubuntu（发行版 Ubuntu 26.04） |
| Linux 用户 | `administrator` |
| 项目路径 | `/home/administrator/projects/ai-insight-daily` |
| 公网域名 | https://aibiliai.com |

### 运行时版本（实测于 2026-10-16）

| 组件 | 版本 |
| --- | --- |
| Node.js | v22.23.3 |
| npm | 10.9.9 |
| Next.js | 16.3.5 |
| React | 19.2.8 |
| Prisma Client | 6.19.3 |
| PM2 | 7.0.4 |
| cloudflared | 2026.10.0 |

---

## 二、网络架构

**这是 V1.0 遗漏的关键部分。**

```
浏览器
  │  HTTPS
  ▼
Cloudflare 边缘  ← 证书由 Cloudflare 提供，自动续期
  │  加密隧道（cloudflared 主动外连，无需公网 IP、不开放入站端口）
  ▼
cloudflared（本机常驻进程）
  │
  ▼
Next.js  0.0.0.0:3000
  │
  ▼
Prisma ORM
  │
  ▼
SQLite  prisma/dev.db
```

### 各层职责（易混淆，务必分清）

| 层 | 职责 | 不负责什么 |
| --- | --- | --- |
| **Cloudflare** | DNS 解析、HTTPS 证书、HTTP→HTTPS 跳转 | 不管应用逻辑 |
| **cloudflared** | 建立隧道，把公网请求转到本机 3000 | 不处理业务 |
| **Next.js** | 应用本身（同时承担 HTTP 服务） | — |

### 隧道回源到 3000，不经过 nginx

隧道 ingress 的实际配置（从 cloudflared 日志读取）：

```json
{"hostname":"aibiliai.com","service":"http://127.0.0.1:3000"}
```

即请求直接交给 Next.js，**本机不设反向代理**。

> **历史说明**：早期曾用 nginx 监听 80 反代到 3000，文档也据此写过
> 「隧道回源到本机 80」。但实际隧道配置指向 3000，nginx 从未处理过
> 真实流量 —— 2026-10-17 实测其访问日志中非 127.0.0.1 的请求为 0 条，
> 已停用。

因此：

- 服务器**不需要**公网 IP，**不需要**开放任何入站端口
- 本机不需要配置 HTTPS 证书（由 Cloudflare 边缘提供）
- 隧道由 cloudflared **主动向 Cloudflare 建立**出站连接

> 验证：`ss -tlnp | grep :3000` 应看到 `0.0.0.0:3000`（Next.js）。
> `0.0.0.0` 表示同时监听局域网，因此手机等设备可通过
> `http://<本机IP>:3000` 访问，无需端口转发。

### 隧道是唯一的对外通路

**cloudflared 停止 = 网站立即下线**（实际发生过一次）。
排查网站打不开时，`systemctl status cloudflared` 是必查项。

---

## 三、Web 服务：Next.js（本机无反向代理）

**nginx 已于 2026-10-17 停用。**

停用理由：隧道 ingress 指向 `http://127.0.0.1:3000`，请求从未经过 nginx。
实测其访问日志中非 `127.0.0.1` 的请求为 0 条 —— 它一直在空转，
却因文档写着「隧道回源到 80」而被误认为在链路上。

原配置保留在 `/etc/nginx/sites-available/ai-insight-daily`，未删除，
需要时可 `sudo systemctl start nginx` 临时启用。

**Next.js 监听**：

```bash
ss -tlnp | grep :3000
# 0.0.0.0:3000  ← 同时监听局域网，手机可直接访问 http://<本机IP>:3000
```

**没有代理层超时**：过去 nginx 的 `proxy_read_timeout 60s` 曾是行程生成
（40-60 秒）的隐患。现在请求直连 Next.js，约束只剩两端：

- Next.js 自身不设请求超时（长任务可跑完）
- Cloudflare 免费版对源站的响应上限约 100 秒

> 若未来出现长任务接近 100 秒，需要考虑改为异步任务 + 轮询，
> 而不是依赖超时配置。

---

### 隧道参数（2026-10-17 实测修正）

隧道必须以 IPv4 + HTTP/2 运行，否则会反复断开。详见
[`AI_TROUBLESHOOTING_GUIDE.md`](./AI_TROUBLESHOOTING_GUIDE.md)。

```ini
# /etc/systemd/system/cloudflared-ipv4.service
ExecStart=/usr/bin/cloudflared --no-autoupdate \
  --edge-ip-version 4 \
  --edge-bind-address 0.0.0.0 \
  --protocol http2 \
  tunnel run --token-file /etc/cloudflared/token
```

管理命令：

```bash
bash scripts/manage-cloudflared.sh status     # 查状态与协议
sudo bash scripts/manage-cloudflared.sh install    # 安装/更新
sudo bash scripts/manage-cloudflared.sh rollback   # 切回原服务
```

---

## 四、应用管理：PM2

| 项 | 值 |
| --- | --- |
| 进程名 | `ai-insight-daily` |
| 启动命令 | `npm start`（即 `next start -H 0.0.0.0`） |
| 运行目录 | `/home/administrator/projects/ai-insight-daily` |

```bash
pm2 list
pm2 logs ai-insight-daily
pm2 logs ai-insight-daily --err --lines 30
pm2 restart ai-insight-daily --update-env
pm2 describe ai-insight-daily
```

### `--update-env` 不能省

修改 `.env.local` 或 `.env.production` 后，**必须**加 `--update-env`，
否则 PM2 会沿用启动时捕获的旧环境变量，改动不生效。

```bash
# ✓ 正确
pm2 restart ai-insight-daily --update-env

# ✗ 改了环境变量却不生效
pm2 restart ai-insight-daily
```

### 判断服务是否稳定

看 `pm2 describe` 的这三个字段：

| 字段 | 含义 |
| --- | --- |
| `restarts` | 累计重启次数。**部署或手动重启也会计入**，数值本身不代表有问题 |
| `unstable restarts` | 异常重启次数。**这个才是崩溃信号**，应保持 0 |
| `uptime` | 本次运行时长。只有几十秒说明刚重启过 |

> 不要把 `restarts` 数值偏高误判为崩溃循环 —— 正常部署也会累加。

---

## 五、构建部署流程

```bash
cd ~/projects/ai-insight-daily

# 1. 安装依赖（用 ci 而非 install，严格按 package-lock.json）
npm ci

# 2. 构建
npm run build

# 3. 重启
pm2 restart ai-insight-daily --update-env
```

### 构建时不要删除 `.next`

```bash
# ✗ 服务运行中删除构建目录 → 全站 502，直到构建完成
rm -rf .next && npm run build

# ✓ 直接构建（Next 会增量更新），成功后再重启
npm run build && pm2 restart ai-insight-daily --update-env
```

### 数据库结构变更

本项目用 **Prisma Migrate** 管理表结构（`prisma/migrations/`，数据库内有
`_prisma_migrations` 表记录已应用项）。

```bash
npx prisma migrate dev --name 描述      # 开发时生成并应用迁移
npx prisma migrate deploy               # 部署时应用待执行迁移
npx prisma migrate status               # 查看状态

# ✗ 危险：db push 在检测到结构漂移时可能删除列
npx prisma db push
```

---

## 六、开机自启

三层都要正常，缺一层则重启电脑后网站起不来。

| 层 | 机制 | 检查命令 |
| --- | --- | --- |
| **WSL** | `/etc/wsl.conf` 设 `systemd=true` | 无需操作 |
| **PM2** | systemd 服务 `pm2-administrator` 执行 `pm2 resurrect` | `systemctl is-enabled pm2-administrator` |
| **cloudflared** | systemd 服务 | `systemctl is-enabled cloudflared` |

**PM2 的自启依赖 `~/.pm2/dump.pm2`**（进程快照）。
新增或重命名进程后必须执行 `pm2 save`，否则重启后不会恢复。

自启配置命令（换机器时用）：

```bash
pm2 startup systemd -u administrator --hp /home/administrator
# 复制该命令输出的 sudo 行并执行
pm2 save
```

---

## 七、定时任务

```bash
crontab -l
```

| 时间 | 任务 | 脚本 |
| --- | --- | --- |
| 每小时整点 | 新闻采集（陈旧 >6 小时才真跑） | `scripts/news-pipeline-scheduler.sh` |
| 每小时 15 分 | 健康检查（状态变化才告警） | `scripts/health-monitor.sh` |
| `0 23 * * *` | 数据库异地备份（陈旧 >20 小时才真跑） | `scripts/db-backup-scheduler.sh` |
| `@reboot` | 上述三项各补跑一次（错峰 120/180/240 秒） | — |

**一键安装**：

```bash
bash scripts/install-cron.sh
```

该脚本幂等（用 BEGIN/END 标记包裹自己管理的区块，重装时整块替换），
区块外的其它 cron 任务原样保留。备份在 `~/.crontab.before-install`。

### 为什么不用固定时间点

**cron 不会补跑错过的任务，而这台机器不是 24 小时开机。**

实际教训：

| 教训 | 后果 |
| --- | --- |
| 原 `0 3 * * *` 备份 | 10 天里只成功执行过 1 次 |
| 原 `0 2 * * *` 采集 | `logs/daily-cron.log` 从未生成，内容停在 47 小时前 |

**因此所有定时任务都采用同一模式**：

```
定时触发（每小时） + 陈旧度判断（超过 N 小时才真跑） + @reboot 补跑
```

这样无论触发多少次，实际执行频率都稳定在设定值，
且机器什么时候开机都能补上。

### 三个调度脚本

**`news-pipeline-scheduler.sh`** —— 新闻采集

- 阈值 6 小时（新闻对新鲜度敏感，但每次会消耗 DeepSeek 额度）
- 用 `flock` 防止并发（管线一次约 90 秒，避免重复抓取）
- 先探测本地 `:3000` 是否就绪，未就绪则跳过（不告警，交给健康监控）

**`health-monitor.sh`** —— 健康检查

检查五项：本地应用、域名（**强制 IPv4**）、隧道服务、磁盘、内存。

**只在状态变化时告警**：正常→故障立即推送；故障→正常发恢复通知；
持续故障不重复推送（否则每小时一条，很快被无视）。

> 域名检查必须加 `-4`：Cloudflare 的 AAAA 记录在当前网络不可达，
> 不加会因 IPv6 超时而误判故障。

**`db-backup-scheduler.sh`** —— 数据库备份，阈值 20 小时。

### 告警渠道

**当前已配置：Server 酱**（微信推送）。密钥在 `.env.local` 的
`SERVERCHAN_KEY`，该文件未被 git 跟踪。

配置与管理用脚本，不要手工编辑 `.env.local`：

```bash
bash scripts/set-alert-channel.sh status                          # 查看（密钥打码）
bash scripts/set-alert-channel.sh serverchan SCTxxxxx             # Server 酱
bash scripts/set-alert-channel.sh telegram 123:ABC chatid         # Telegram
bash scripts/set-alert-channel.sh webhook https://example.com/h   # 通用 webhook
bash scripts/set-alert-channel.sh test                            # 发一条测试
bash scripts/set-alert-channel.sh clear                           # 清空
```

脚本幂等：同一渠道重复设置会覆盖而非追加；`clear` 会连被注释掉的
同名行一起清掉，避免「注释里的旧密钥」与「生效的新密钥」并存。

**全链路已验证**（2026-10-17）：模拟域名不可达后，
`health-monitor.sh` 判定故障并推送「站点异常」，
恢复后推送「站点已恢复」，两次均收到。

> 三种渠道都**不配也能运行** —— 只写 `logs/alert.log`。
> 这是刻意设计：不把「没配告警」变成「监控脚本报错」的二次噪音。

### AI 用量与成本报告

每天 22:30 自动推送到微信（Server 酱），也可随时手动跑：

```bash
bash scripts/ai-usage-report.sh            # 今天
bash scripts/ai-usage-report.sh 2026-10-17 # 指定日期
bash scripts/ai-usage-report.sh --week     # 最近 7 天
```

#### 三个数据源，各有盲区

这是读懂报告的关键。三项指标来自不同地方，**不能混着看**：

| 指标 | 来源 | 盲区 |
| --- | --- | --- |
| 入库新闻、完成分析 | **数据库** | 无 |
| 采集轮次 | `logs/news-pipeline.log` | 只覆盖脚本触发的轮次；手动调 API 或日志被清时会漏 |
| AI 调用、token、成本 | `logs/ai-usage.log` | 只从 2026-10-17 加记录之后才有效 |

因此报告里每项都标了来源。**入库量与分析量信数据库，不要信日志。**

#### 怎么看这份报告

**核心健康指标：`AI 调用次数 ≈ 完成分析条数`。**

每条新闻分析恰好调一次 AI。如果两者相差很大：

- **分析数 ≫ 调用数** —— 有用量没被记录（日志启用前、或日志被清过）。
  此时成本数字偏低，真实成本要按分析条数估。
  报告会自动打出警告，不会让你误读。
- **调用数 ≫ 分析数** —— 说明有重复分析（同一批新闻被反复跑），
  值得查是不是调度或状态判断出了问题。

#### 成本怎么算

按官方定价**逐条计算**，不是平均值：

- 区分时段：高峰（工作日 9:00–12:00、14:00–18:00）是空闲时段的 2 倍
- 系统提示词 1021 tokens 按**缓存命中**计价（比未命中便宜 50 倍）
- 其余输入与输出按未命中计价

`deepseek-flash` 定价（元/百万 tokens）：

| 项 | 空闲 | 高峰 |
| --- | --- | --- |
| 输入（缓存命中） | 0.02 | 0.04 |
| 输入（未命中） | 1.0 | 2.0 |
| 输出 | 4.0 | 8.0 |

实测：单条新闻约 **¥0.005–0.006**，日均 90 条约 **¥0.5/天**，
每月约 **¥17**。

#### 用余额做交叉验证

报告的估算成本是**模型**，余额变化是**事实**。二者对不上时以余额为准：

```bash
# 查余额
curl -s https://api.deepseek.com/user/balance \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

若估算成本明显低于余额实际下降，说明有用量没记录到
（典型原因：日志被清、或统计逻辑漏了某条调用路径）。

#### 开启思考模式会让成本翻数倍

`deepseek-flash` **默认开启思考模式**，实测同一条素材：

| | 输出 token | 耗时 |
| --- | --- | --- |
| 思考模式 | 4408（推理 3029 + 正文 1379） | 21.3 秒 |
| 非思考模式 | 1152（纯正文） | 6.4 秒 |

本项目的新闻分析是「按提示词输出固定 JSON」的结构化抽取，不依赖深度推理，
**已在 `lib/ai-summary.ts` 中显式关闭**（`thinking: { type: "disabled" }`）。

用量日志里的 `reason` 字段记录推理 token 数 —— 若它长期不为 0，
说明开关失效了（SDK 升级、或 DeepSeek 改了参数名），成本会悄悄涨。

### 日志位置

| 文件 | 内容 |
| --- | --- |
| `logs/news-pipeline.log` | 每次采集的时间、导入数、耗时 |
| `logs/health-monitor.log` | 每次检查的结果与状态变化 |
| `logs/alert.log` | 所有告警（即使推送成功也记录） |
| `logs/db-backup.log` | 数据库备份 |
| `logs/ai-usage.log` | 每次 AI 调用的 token 用量（JSONL，成本统计的数据源） |
| `logs/daily-report.log` | 每日报告的生成与推送记录 |

---

## 七之二、搜索引擎收录开关

**当前状态：不收录。**

原因是尚未完成 ICP 备案，运营主体与合规状态未定。
而搜索引擎收录**不可逆** —— 缓存、第三方镜像、Wayback 存档会长期留存，
即使事后删除也不一定撤得回来；`noindex` 只是请求，随时可撤。
所以先选保守一侧，把选择权保留下来。

### 开关在哪

单一常量：`lib/site-indexing.ts`

```ts
export const SITE_ALLOW_INDEX = false;
```

改成 `true` 后：

```bash
npm run build && pm2 restart ai-insight-daily
```

三处会一起变化：

| 位置 | 效果 |
| --- | --- |
| `app/robots.ts` | `robots.txt` 的 `Allow` / `Disallow` |
| `app/layout.tsx` | 页面 `<meta name="robots">` |
| `next.config.ts` | `X-Robots-Tag` 响应头 |

### 为什么要三层叠加

| 层 | 覆盖 | 弱点 |
| --- | --- | --- |
| `robots.txt` | 全站 | 只是请求，可被无视 |
| `<meta name="robots">` | HTML 页面 | 对 PDF / 图片等资源无效 |
| `X-Robots-Tag` 头 | **任意资源** | 无 |

响应头优先级高于 meta，且对非 HTML 资源同样生效 ——
所以 PDF、图片这类被直接链接的资源也受控。

### 为什么用常量而不是环境变量

最初写成 `SITE_ALLOW_INDEX` 环境变量，实测出问题：

- `robots.txt` 是静态路由，构建时就把值烤进去
- 首页是动态渲染，`metadata` 在**请求时**读 `process.env`

于是「重新构建但 PM2 进程环境里还留着旧变量」时，
`robots.txt` 已经变回 `Disallow`，页面 meta 却还是 `index, follow` —— 半状态。
更麻烦的是 PM2 的 `--update-env` 清不掉它内部状态里的变量，
排查时很容易误判成代码没生效。

常量会被打包成字面量，构建期与运行期必然一致，没有这个缝隙。
改常量必须重新构建，这一步无法省略，也就不存在「改了没生效」。

### 已验证

两个方向都实测过（本地 + 经 Cloudflare）：

```
false → robots: Disallow: / ｜ meta: noindex, nofollow, nocache ｜ header: 有
true  → robots: Allow: /     ｜ meta: index, follow             ｜ header: 无
```

来回切换后恢复正常，页面在两种状态下都能正常访问。

### 这不是保密

`noindex` 只是请求搜索引擎不要收录，**不是访问控制**。
知道域名的人照样能访问。要真正私密需要鉴权（如 Cloudflare Access）。

---

## 八、注意事项

**不要随意修改**：隧道服务配置、PM2 配置、生产环境变量。修改前先备份。

**改完必须验证**：本项目发生过多次「代码正确但线上未生效」，原因包括构建失败、
服务未重启、环境变量未更新。验证方式是用 `curl` 实际请求页面或接口，
检查响应内容是否包含新改动 —— 不要只看构建日志。

**安全要点**：

- `.env.local` 含全部密钥，**已被 git 忽略**，不进仓库
- 旅行模块口令存于 `TRAVEL_PASSWORD`，未设置时该模块完全公开
- 站点已启用 Always Use HTTPS，`COOKIE_SECURE` 应为 `1`

---

## 九、相关文档

| 文档 | 内容 |
| --- | --- |
| `RECOVERY.md`（项目根目录） | 电脑损坏后在新机器上重建站点的完整步骤 |
| `AI-START-HERE.md`（项目根目录） | 改动流程、验证要求、当前已知问题 |
| `ai-context/AI_TROUBLESHOOTING_GUIDE.md` | 故障排查手册（含实测案例） |
| `ai-context/ARCHITECTURE.md` | 技术架构与数据流 |
