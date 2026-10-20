# 迁移到阿里云香港

从「家用电脑 + WSL + Cloudflare 隧道」迁移到「阿里云轻量香港」，
目标是**电脑关机时网站照常运行**。

> 状态：**迁移已完成**（2026-10-18），网站已运行在阿里云东京。
> 完成记录见 [`MIGRATION_COMPLETED.md`](./MIGRATION_COMPLETED.md)。
>
> 购买步骤见 [`TENCENT_CLOUD_PURCHASE.md`](./TENCENT_CLOUD_PURCHASE.md)（腾讯云轻量香港）。
>
> **2026-10-20 核实**：生产实际为 `ubuntu@43.133.176.111`，
> 应用在 `/home/ubuntu/ai-insight-daily`（**不是本文下面写的 root / `/root/...`**）。
> 部署命令、字体依赖与验证步骤见 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 的「生产部署现状」。
> 本文其余 root 路径属于迁移当时的历史记录，留作参考。
> 触发条件：维护者购买阿里云轻量应用服务器（香港地域）之后。

---

## 一、为什么选阿里云香港

| 项 | 判断 |
| --- | --- |
| 备案 | 香港节点**不需要** ICP 备案 |
| 支付 | 支付宝，不需要境外信用卡 |
| 采集 | 香港出口访问 OpenAI/TechCrunch/arXiv 畅通（这是站点内容的核心） |
| 国内访问 | 香港延迟约 50ms，比美国机房快得多 |
| 代码改动 | **零** —— SQLite、Prisma、cron 全部原样迁移 |

对比过的其它方案：

| 方案 | 放弃原因 |
| --- | --- |
| 国内云（非香港） | 未备案不能用 80/443 绑域名；境外 RSS 采集质量差 |
| RackNerd 等境外小厂 | 需 PayPal，国内访问更慢 |
| Vercel / Cloudflare Pages | 需改写数据库层（SQLite → Postgres），Cron 有频率限制 |
| 树莓派放家里 | 仍是「家里」，停电断网就没了 |

---

## 二、资源需求（实测）

| 项 | 需要 |
| --- | --- |
| 内存 | Next.js 常驻 206MB + cloudflared 40MB ≈ **250MB** |
| 内存（构建时） | 峰值约 1–1.5GB，**1G 机器必须加 swap** |
| 磁盘 | 代码+依赖 1.6GB，数据库 11MB |
| CPU | 1 核够用，2 核构建更快 |

**推荐：2核2G**（构建时不折腾）。1核1G 也能跑，脚本会自动加 2G swap。

---

## 三、迁移前准备（已完成的）

本地执行 `scripts/migration/01-preflight.sh`，产出 `.migration/`：

| 文件 | 内容 |
| --- | --- |
| `dev.db` | 数据库快照（11MB，17 表，10289 行） |
| `env.keys.txt` | 17 个配置变量名（不含值） |
| `crontab.txt` | 8 条定时任务 |
| `migration-manifest.md` | 迁移清单 |

### 配置变量清单

`.env.local`（11 个）：

```
DEEPSEEK_API_KEY  DEEPSEEK_MODEL  CRON_SECRET
AMAP_WEB_KEY      QWEATHER_KEY    QWEATHER_HOST
ROLLINGGO_API_KEY VARIFLIGHT_API_KEY
TRAVEL_PASSWORD   COOKIE_SECURE   SERVERCHAN_KEY
```

`.env.production`（6 个）：

```
DEEPSEEK_API_KEY  DEEPSEEK_MODEL  CRON_SECRET
DATABASE_URL      TRAVEL_PASSWORD COOKIE_SECURE
```

---

## 四、迁移步骤

脚本都在 `scripts/migration/`，按编号顺序执行。

### 步骤 1：本地预检（已完成）

```bash
bash scripts/migration/01-preflight.sh
```

### 步骤 2：服务器初始化

把 `02-server-bootstrap.sh` 传到服务器执行：

```bash
# 本地
scp scripts/migration/02-server-bootstrap.sh root@<IP>:/root/
ssh root@<IP> "bash /root/02-server-bootstrap.sh"
```

它会装：Node 22、PM2、git、rsync、sqlite3、日志轮转、时区、swap。

### 步骤 3：传代码

首次必须用 **rsync 通道**（服务器还是空的，没有 .git）：

```bash
export DEPLOY_SERVER=root@<IP>
bash scripts/migration/deploy-rsync.sh
```

之后服务器上 `git clone` 一次，就能用 git 通道了。

### 步骤 4：传数据

```bash
bash scripts/migration/03-migrate-data.sh
```

它会：
1. **暂停本地 crontab**（避免拷贝到写一半的库）
2. 本地备份数据库
3. 上传数据库并校验条数一致
4. 上传 `.env.local` / `.env.production`，权限设 600
5. 在服务器生成 crontab（路径自动改写）

### 步骤 5：首次构建启动

```bash
ssh root@<IP> "cd /root/ai-insight-daily && npm run build && pm2 start npm --name ai-insight-daily -- start"
```

### 步骤 6：全链路验证

```bash
bash scripts/migration/04-verify.sh
```

检查 9 项：服务状态、8 个页面、数据库条数、AI 分析、配置变量、
定时任务、**采集能否真的抓**、告警通道、功能回归（AI 标识 / 首页结构 / robots）。

**必须全部通过才能继续。**

### 步骤 7：停用本地

```bash
bash scripts/migration/05-decommission-local.sh --dry-run   # 先看
bash scripts/migration/05-decommission-local.sh --apply     # 再执行
```

停：crontab、PM2、cloudflared 服务。
保留：代码、数据库、node_modules（随时可恢复）。

> **为什么必须停**：本地和服务器同时跑 cron，会同时采集、同时调 AI，
> 同一批新闻采两遍，**AI 费用翻倍**，且两边数据库不一致。

---

## 五、迁移后的日常维护

### 三种改动，三条路径

| 类型 | 路径 | 例子 |
| --- | --- | --- |
| **代码** | 本地改 → `git push` → `./deploy.sh` | 加功能、改 UI |
| **数据** | 直接 ssh 在服务器跑脚本 | 清理采集源 |
| **配置** | 直接改服务器 `.env.local` | 换 API key |

**代码走 git（有版本能回滚），数据和配置直接改服务器（不进 git）。**

### 双通道部署

| 通道 | 脚本 | 依赖 | 何时用 |
| --- | --- | --- | --- |
| 主 | `deploy.sh` | GitHub 可访问 | 默认 |
| 备 | `deploy-rsync.sh` | 只需 SSH | GitHub 抽风时 |

**实测（无代理）**：GitHub HTTPS 0.13s 连接、`git ls-remote` 成功、
npm 官方源 1.8s。日常够用，但 GitHub 在国内会波动，所以保留 rsync 通道。

**只要 SSH 通，维护就永远能做。** 终极兜底是阿里云控制台的 Workbench 网页终端。

### 常用命令

```bash
# 部署
export DEPLOY_SERVER=root@<IP>
./deploy.sh

# 回滚一个版本
./rollback.sh

# 看日志
ssh root@<IP> "pm2 logs ai-insight-daily --lines 50 --nostream"

# 看服务状态
ssh root@<IP> "pm2 status"

# 进服务器
ssh root@<IP>
```

### 全自动的部分（不需要人管）

| 任务 | 时间 |
| --- | --- |
| 采集 + AI 分析 | 每小时 |
| 健康检查 + 告警 | 每小时 |
| 数据库备份（推 GitHub） | 23:00 |
| 日报推微信 | 22:30 |
| 开机自恢复 | 重启后 |

---

## 六、本地开发环境保留

**WSL 不删除，作为开发车间。**

| 角色 | 在哪 | 说明 |
| --- | --- | --- |
| 开发 | WSL `~/projects/ai-insight-daily` | 我改代码、跑测试、截图验证 |
| 生产 | 阿里云 `/root/ai-insight-daily` | 只跑，不手改 |

**为什么不在服务器上直接改**：我读写文件靠本地路径工具，远程改要走
heredoc 传输，引号和括号很容易出错（本项目踩过多次）。而且本地能先
`npm run build` 验证、能截图看效果。

### 数据库的坑

迁移后：

- 服务器上的 `dev.db` 是**线上真库**
- WSL 里的 `dev.db` 会**过期**

涉及数据的改动，先从服务器拉快照：

```bash
scp root@<IP>:/root/ai-insight-daily/prisma/dev.db prisma/dev.db
```

日常改动靠单元测试（460 项），不依赖真库。

---

## 七、域名与访问

### 两种接法

| 方式 | 路径 | 速度 | 说明 |
| --- | --- | --- | --- |
| **A. 直接 A 记录** | 手机 → 阿里云香港 IP | 约 50ms | 最快，不需要备案 |
| **B. Cloudflare 隧道** | 手机 → Cloudflare → 隧道 → 服务器 | 慢 | 保持现状，有 DDoS 防护 |

**推荐 A**：香港不需要备案，可以直接绑域名。
实测现在走 Cloudflare 要 3.5–5.6 秒（边缘节点在 LAX/LHR），
直连香港约 50ms。

**保留 B 作为备选**：如果香港 IP 某天被干扰，切回 Cloudflare 隧道。

### SSL 证书

直接 A 记录的话需要自己配证书：

```bash
# Let's Encrypt + certbot，或阿里云免费证书
```

或者：Cloudflare 保持**灰云**（DNS only）模式，流量直连香港，
但仍然需要源站证书。

---

## 八、风险与回归方案

| 风险 | 应对 |
| --- | --- |
| 迁移后发现问题 | 本地环境完整保留，`crontab` 有备份，随时能切回 |
| 服务器欠费/被回收 | 本地 + GitHub 有两份代码，数据库有 GitHub 备份分支 |
| 域名被干扰 | 切回 Cloudflare 隧道 |
| SSH 不通 | 阿里云控制台 Workbench 网页终端 |
| 构建 OOM | 脚本自动加 2G swap；或换 2G 内存机型 |

**任何时候都能回到「家用电脑」模式**，因为本地什么都没删。

---

## 九、检查清单

迁移前：

- [ ] 阿里云轻量应用服务器（香港、Ubuntu 24.04、2核2G）
- [ ] 安全组放行 22
- [ ] 记录公网 IP 与 root 密码
- [ ] 本地 `git status` 干净、已 push

迁移中：

- [ ] 01-preflight 跑过，`.migration/` 有产物
- [ ] 02-server-bootstrap 成功
- [ ] 03-migrate-data 数据库条数一致
- [ ] 首次构建成功
- [ ] 04-verify **全部通过**
- [ ] 微信收到告警测试消息

迁移后：

- [ ] 05-decommission-local 执行
- [ ] 本地 `crontab -l` 为空
- [ ] 本地 `pm2 list` 无 ai-insight-daily
- [ ] 域名指向新服务器（或隧道重绑）
- [ ] 手机能打开
- [ ] 观察 24 小时：采集正常、日报准时、无重复消费
