# AI Insight Daily 部署说明

> 版本：V2.0（2026-10-16 核实重写）
> V1.0 写于 2026-10-05，当时站点尚未接入 Cloudflare 隧道，
> 文中「nginx 作用：域名解析、HTTPS」与实际不符，已更正。

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
| nginx | 1.28.3 |
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
nginx  127.0.0.1:80
  │  仅反向代理
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
| **cloudflared** | 建立隧道，把公网请求转到本机 80 | 不处理业务 |
| **nginx** | 反向代理到 3000 | **不做 HTTPS，不解析域名** |
| **Next.js** | 应用本身 | — |

### 为什么 nginx 只监听 80

站点通过 Cloudflare 隧道对外，**隧道回源目标是本机 80 端口**。
因此：

- nginx **不需要**监听 443，**不需要**配置证书
- 服务器**不需要**公网 IP，**不需要**开放任何入站端口
- 隧道由 cloudflared **主动向 Cloudflare 建立**出站连接

> 验证：`ss -tlnp | grep -E ':(80|443)'` 只会看到 80，没有 443。

### 隧道是唯一的对外通路

**cloudflared 停止 = 网站立即下线**（实际发生过一次）。
排查网站打不开时，`systemctl status cloudflared` 是必查项。

---

## 三、Web 服务：nginx

**站点配置**：`/etc/nginx/sites-available/ai-insight-daily`（已软链到 `sites-enabled/`）

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name aibiliai.com www.aibiliai.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
```

**常用命令**：

```bash
sudo nginx -t                      # 测试配置语法（改完必跑）
sudo systemctl restart nginx
sudo systemctl status nginx
```

> `proxy_read_timeout 60s` 是个需要留意的值：生成行程需要 40-60 秒，
> 若未来耗时继续增长，可能触发 nginx 超时。

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
| **nginx** | systemd 服务 | `systemctl is-enabled nginx` |
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

| 时间 | 任务 |
| --- | --- |
| `0 2 * * *` | 调用 `/api/cron/daily` 抓取资讯（Bearer 鉴权） |
| `0 23 * * *` | 数据库异地备份（调度脚本自行判断是否真的需要跑） |
| `@reboot` | 开机补跑备份 |

### 这台机器不是 24 小时开机

**cron 不会补跑错过的任务。** 凌晨时段机器常处于关机状态。

实际后果：原 `0 3 * * *` 的备份任务在 10 天里只成功执行过 1 次。

**新增定时任务前，先确认目标时间点机器是否在运行。**
需要「必定执行」的任务，应改用「定时触发 + 判断上次执行时间」的模式
（参考 `scripts/db-backup-scheduler.sh`）。

---

## 八、注意事项

**不要随意修改**：nginx 配置、PM2 配置、生产环境变量。修改前先备份。

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
