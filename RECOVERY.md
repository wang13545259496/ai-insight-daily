# 灾难恢复手册

> 适用场景：**当前这台电脑彻底坏了**（硬盘损坏、无法开机等），需要在**一台新电脑**上把 aibiliai.com 重新跑起来。
>
> 本文档中的命令均已实测。数据库恢复流程做过完整演练，数据比对一致。

---

## 零、先搞清楚：什么丢了，什么没丢

| 内容 | 状态 | 恢复来源 |
| --- | --- | --- |
| **代码** | ✅ 在 GitHub | `git clone` |
| **数据库** | ✅ 已异地备份 | GitHub 的 `db-backup` 分支 |
| **域名 / DNS** | ✅ 在 Cloudflare 账户 | 无需操作 |
| **API Key** | ✅ 在各服务商后台 | 重新获取 |
| **环境变量文件** | ❌ 随电脑丢失 | **需提前备份**，见 [第一步](#第一步提前准备你只有一次机会) |
| **隧道凭据** | ❌ 随电脑丢失 | Cloudflare 后台重新生成 |

**预计耗时**：熟练的话 1-2 小时；第一次做约 3 小时。

---

## 第一步（提前准备，你只有一次机会）

**这一节必须在电脑还好的时候做完**，否则电脑一坏就来不及了。

### 1.1 把环境变量单独存一份到手机或密码管理器

当前 `.env.local` 里有 9 个变量（**值在电脑上，请现在就抄走**）：

```
DEEPSEEK_API_KEY        ← DeepSeek 后台可重新获取
CRON_SECRET             ← 自定义，丢了重新生成一个即可
AMAP_WEB_KEY            ← 高德开放平台可重新获取
QWEATHER_KEY            ← 和风天气后台可重新获取
QWEATHER_HOST           ← 和风天气后台可查到
ROLLINGGO_API_KEY       ← RollingGo 后台可重新获取
VARIFLIGHT_API_KEY      ← 飞常准后台可重新获取
TRAVEL_PASSWORD         ← ★ 自定义，丢了只能换新的（旅行模块口令）
COOKIE_SECURE           ← 固定值 1
```

**只有 `TRAVEL_PASSWORD` 是真正无法找回的**——它没有任何服务商记录。其余都能重新生成。

> 查看当前值：`cat ~/projects/ai-insight-daily/.env.local`

### 1.2 记下 Cloudflare 隧道信息

```
隧道名称：在 Cloudflare 后台 → Zero Trust → Networks → Tunnels 查看
公网主机名：aibiliai.com（与隧道绑定）
```

隧道 token **不需要抄**——新机器上重新生成一个即可，旧的作废不影响。

### 1.3 确认 GitHub 的 SSH 密钥有备份

```bash
# 当前密钥的位置
ls -la ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.pub
```

**私钥 `id_ed25519` 不要放 GitHub**（那是给这台机器认证用的）。如果你没有别处的备份，新机器上重新生成一对，加到 GitHub 账户即可：

```bash
ssh-keygen -t ed25519 -C "你的邮箱"
cat ~/.ssh/id_ed25519.pub   # 把输出添加到 GitHub → Settings → SSH keys
```

---

## 第二步：在新电脑上装好基础环境

### 2.1 安装 WSL2 + Ubuntu

在 **Windows PowerShell（管理员）** 中：

```powershell
wsl --install -d Ubuntu
```

装完重启，按提示设置 Linux 用户名（**建议仍用 `administrator`**，这样本文档的命令可以直接复制，无需改动路径）。

> 验证：`wsl -d Ubuntu` 能进入 Linux 终端。

### 2.2 安装运行时

在 **WSL 终端**里执行：

```bash
# Node.js 22（项目要求 Node 22.x，原机器用的是 v22.23.3）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 必需工具：git（拉代码）、sqlite3（备份/恢复数据库）、rsync
sudo apt-get install -y git sqlite3 rsync

# PM2 进程管理器（原机器 v7.0.4）
sudo npm install -g pm2

# cloudflared（Cloudflare 隧道客户端）
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

**验证版本**（原机器上的版本，不必完全一致）：

```bash
node -v            # v22.x
pm2 -v             # 7.x
sqlite3 --version  # 3.x
cloudflared --version
```

---

## 第三步：拉取代码

```bash
mkdir -p ~/projects
cd ~/projects
git clone git@github.com:wang13545259496/ai-insight-daily.git
cd ai-insight-daily
```

> 如果提示权限被拒，说明新机器的 SSH 密钥还没加到 GitHub，见 [1.3](#13-确认-github-的-ssh-密钥有备份)。

### 3.1 安装依赖

```bash
cd ~/projects/ai-insight-daily
npm ci
```

> 用 `npm ci` 而不是 `npm install`：前者严格按 `package-lock.json` 安装，版本一致。

---

## 第四步：恢复数据库 ★ 关键步骤

备份在同一个仓库的 `db-backup` 分支上（与 `main` 完全隔离的孤儿分支）。

```bash
cd ~/projects/ai-insight-daily

# 1. 获取备份分支
git fetch origin db-backup

# 2. 查看备份文件（记下文件名）
git ls-tree -r --name-only origin/db-backup

# 3. 恢复（把下面的文件名替换成上一步看到的）
mkdir -p prisma
git show origin/db-backup:dev_2026-10-16_09-37-59.db.gz | gunzip > prisma/dev.db

# 4. 验证恢复结果
sqlite3 prisma/dev.db "PRAGMA integrity_check;"      # 应输出 ok
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM News;"   # 应输出数字，不是 0
```

**预期结果**（截至 2026-10-16 的备份）：

```
integrity_check   ok
表数量            15
TripPlan          24 条
News              1668 条
DailyReport       10 条
Source            35 条
Investment        3 条
```

> **实测记录**：该流程在隔离目录演练通过，恢复后的数据量与生产库逐表比对一致。

### 4.1 如果这次备份太旧

`db-backup` 分支**只保留最新一份**（避免仓库无限膨胀）。但如果最新的那份有问题，可以从分支的提交历史里找回上一份：

```bash
git log origin/db-backup --oneline          # 查看历史提交
git show <某个提交哈希>:dev_xxx.db.gz | gunzip > prisma/dev.db
```

> 分支采用 amend + 强制推送，正常情况下只显示 1 个提交。历史版本仍可通过 `git reflog` 或 GitHub 网页端的提交历史找回。

---

## 第五步：配置环境变量

**这一步要在构建之前做**——构建时需要读环境变量。

```bash
cd ~/projects/ai-insight-daily
nano .env.local
```

粘贴第一步抄好的 9 个变量（下面是格式示例，**值填你自己的**）：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxx
CRON_SECRET=xxxxxxxx
AMAP_WEB_KEY=xxxxxxxx
QWEATHER_KEY=xxxxxxxx
QWEATHER_HOST=xxxxxxxx
ROLLINGGO_API_KEY=xxxxxxxx
VARIFLIGHT_API_KEY=xxxxxxxx
TRAVEL_PASSWORD=你的口令
COOKIE_SECURE=1
```

同时创建 `.env.production`（构建与 Prisma 命令会读它）：

```bash
cp .env.local .env.production
```

> 原机器的 `.env.production` 里还有一个 `DATABASE_URL`，例如：
> ```
> DATABASE_URL="file:/home/administrator/projects/ai-insight-daily/prisma/dev.db"
> ```
> 用绝对路径可以避免 Prisma 在不同工作目录下找错库文件。建议一并写上。

> **注意 `COOKIE_SECURE`**：表示 Cookie 带 `Secure` 标志。站点走 HTTPS 时必须是 `1`；**如果还没配 HTTPS 就填 `0`**，否则会「登录后仍被要求登录」。

保存退出：`Ctrl+O` → 回车 → `Ctrl+X`。

---

## 第六步：补齐数据库结构并构建

```bash
cd ~/projects/ai-insight-daily

# 1. 生成 Prisma Client（按 schema 生成类型与查询接口）
npx prisma generate

# 2. 应用迁移，把表结构补齐到代码要求的状态
npx prisma migrate deploy

# 3. 确认结构已同步
npx prisma migrate status

# 4. 构建
npm run build
```

### 关于 `migrate deploy`（不是 `db push`）

本项目用 **Prisma Migrate** 管理表结构（`prisma/migrations/` 下有 9 个迁移，数据库里有 `_prisma_migrations` 表记录已应用项）。

**恢复时必须用 `migrate deploy`**：它只应用尚未执行的迁移，幂等且不会删数据。
**不要用 `db push`**——它在检测到结构漂移时可能删除列，是破坏性操作。

迁移文件都是可重复执行的（例如 `CREATE INDEX IF NOT EXISTS`），重复跑没有副作用。

> **已知情况**：`migrate status` 会提示有一条迁移 `20261014120000_add_event_industry_score` 未记录。
> 这是**迁移记录与实际结构不同步**——数据库里其实已经有 `industryScore` 字段了（历史遗留）。
> 执行 `migrate deploy` 会补上这条记录，因为 SQL 里是 `ALTER TABLE ... ADD COLUMN`，
> **如果字段已存在会报错**。遇到了就跳过，不影响使用；功能本身是正常的。

### 关于 `npm ci` 时的一条报错

安装依赖时会出现：

```
! Unknown command "skills"
```

这是 `package.json` 的 `postinstall` 脚本 `prisma skills sync || exit 0` 造成的——
Prisma 没有 `skills` 这个子命令。脚本末尾的 `|| exit 0` 让安装继续成功，**可以忽略**。

---

## 第七步：不需要反向代理

**本项目不用 nginx。** 隧道直接把请求交给 Next.js。

早期版本曾配置 nginx 监听 80 反代到 3000，文档也据此写过
「隧道回源到本机 80」。但实际隧道配置指向 `http://127.0.0.1:3000`，
**请求从未经过 nginx** —— 2026-10-17 实测其访问日志中非 `127.0.0.1`
的请求为 0 条，已停用。

所以新机器上**不要安装也不要配置 nginx**。

只需确认 Next.js 监听在所有网卡上：

```bash
ss -tlnp | grep :3000
# 期望：0.0.0.0:3000
# 若是 127.0.0.1:3000，局域网设备将无法访问（但隧道仍正常）
```

> `0.0.0.0` 是 Next.js 的默认值。若见 `127.0.0.1`，
> 检查 `package.json` 的 start 脚本是否带了 `-H 127.0.0.1`。

---

## 第八步：创建 Cloudflare 隧道

**这一步要在 Cloudflare 网页后台操作**：

1. 登录 https://one.dash.cloudflare.com/
2. 左侧 **Networks → Tunnels** → **Create a tunnel**
3. 选择 **Cloudflared**，起个名字（如 `ai-insight`）
4. 在 **Public Hostname** 标签页添加：
   ```
   Subdomain: （留空）
   Domain:    aibiliai.com
   Path:      （留空）
   Type:      HTTP
   URL:       localhost:3000
   ```
   再添加一条 `www` 的，或按需配置
5. 复制页面给出的 **token**（一长串 `eyJ...`）

回到 WSL 配置服务：

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/token          # 粘贴上一步复制的 token
sudo chmod 600 /etc/cloudflared/token

# 注册服务（先用官方方式生成基础单元）
sudo cloudflared service install $(sudo cat /etc/cloudflared/token)
```

**然后必须改为 IPv4 + HTTP/2**，否则隧道会反复断开：

```bash
sudo tee /etc/systemd/system/cloudflared-ipv4.service > /dev/null <<'UNIT'
[Unit]
Description=Cloudflare Tunnel client (IPv4 forced)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
TimeoutStartSec=30
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate --edge-ip-version 4 --edge-bind-address 0.0.0.0 --protocol http2 tunnel run --token-file /etc/cloudflared/token
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl disable --now cloudflared      # 停掉官方那个，只跑一个
sudo systemctl enable --now cloudflared-ipv4
systemctl status cloudflared-ipv4 --no-pager
```

**为什么必须加这三个参数**（2026-10-17 实测）：

| 参数 | 作用 | 不加会怎样 |
| --- | --- | --- |
| `--edge-ip-version 4` | 边缘地址解析为 IPv4 | 走 IPv6，实测频繁 `network is unreachable` |
| `--edge-bind-address 0.0.0.0` | 套接字绑 IPv4 | 源地址是 `[::]`，向 IPv4 目标写入报错 |
| `--protocol http2` | 用 TCP 而非 UDP/QUIC | 国内网络 UDP 常被 QoS，实测每 40 秒断一次 |

验证（关键看 `protocol=http2` 且 `ip=198.41.x` 或 `104.x`）：

```bash
journalctl -u cloudflared-ipv4 -n 30 --no-pager | grep -E 'Initial protocol|Registered tunnel'
```

> **如果旧隧道还在 Cloudflare 后台**：可以直接复用（不需要新建），但 token 需重新生成——旧 token 在旧机器上，已随电脑丢失。

---

## 第九步：启动应用并设置开机自启

```bash
cd ~/projects/ai-insight-daily

# 启动
pm2 start npm --name ai-insight-daily -- start

# 确认在线
pm2 list
pm2 logs ai-insight-daily --lines 20      # 看有无报错

# 设置开机自启（关键：否则重启电脑后网站不会自己起来）
pm2 startup systemd -u administrator --hp /home/administrator
# ↑ 该命令会输出一行 sudo 命令，复制执行它
pm2 save
```

---

## 第十步：验证

按顺序逐项确认：

```bash
# 1. 应用本身
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
# 期望 200

# 2. 隧道服务与协议
systemctl is-active cloudflared-ipv4
# 期望 active
journalctl -u cloudflared-ipv4 -n 30 --no-pager | grep -E 'Initial protocol|Registered tunnel'
# 期望：Initial protocol http2，且 ip=IPv4（不是 2606:4700:）

# 3. 局域网可访问（可选，验证监听地址）
curl -s -o /dev/null -w '%{http_code}\n' http://$(hostname -I | awk '{print $1}'):3000/
# 期望 200

# 4. 经公网域名（最关键的验证）
curl -s -o /dev/null -w '%{http_code}\n' https://aibiliai.com/
# 期望 200

# 5. HTTP 是否跳 HTTPS
curl -s -o /dev/null -w '%{http_code} → %{redirect_url}\n' http://aibiliai.com/
# 期望 301 → https://aibiliai.com/

# 6. 旅行模块需要口令
curl -s -o /dev/null -w '%{http_code}\n' https://aibiliai.com/agent-travel/login
# 期望 200

# 7. 数据是否恢复
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM News;"
```

全部通过后，**在浏览器里实际打开一次** https://aibiliai.com ，并用口令登录旅行模块确认功能正常。

---

## 第十一步：恢复自动备份（重要，别跳过）

新机器上备份任务不会自己回来，需要重新配置：

```bash
cd ~/projects/ai-insight-daily

# 脚本已在仓库中，直接赋予执行权限
chmod +x scripts/backup-db-to-github.sh scripts/db-backup-scheduler.sh

# 立即备份一次，验证能用
bash scripts/backup-db-to-github.sh

# 配置定时任务
crontab -e
```

在打开的编辑器里加上：

```cron
# 数据库异地备份：23:00 触发（活跃时段），开机时补跑
0 23 * * * /home/administrator/projects/ai-insight-daily/scripts/db-backup-scheduler.sh
@reboot sleep 120 && /home/administrator/projects/ai-insight-daily/scripts/db-backup-scheduler.sh

# 每日抓取任务（原机器上就有）
0 2 * * * CRON_SECRET=$(grep "^CRON_SECRET=" /home/administrator/projects/ai-insight-daily/.env.production | cut -d= -f2- | tr -d "\r") && curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily >> /home/administrator/projects/ai-insight-daily/logs/daily-cron.log 2>&1
```

验证：

```bash
crontab -l                                          # 确认已写入
bash scripts/db-backup-scheduler.sh                 # 手动跑一次
tail -5 logs/db-backup.log                          # 看日志
```

---

## 附：常见问题

### 网站打不开，但 `localhost:3000` 正常

说明问题在隧道（本机没有反向代理，不必查 nginx），按顺序查：

```bash
systemctl status cloudflared-ipv4
journalctl -u cloudflared-ipv4 -n 30 --no-pager
```

**重点看两件事**：

```bash
# 1. 协议是否为 http2、IP 是否为 IPv4
journalctl -u cloudflared-ipv4 -n 50 --no-pager | grep 'Registered tunnel'

# 2. 近期是否频繁断连
journalctl -u cloudflared-ipv4 --since '10 min ago' --no-pager | grep -c 'Connection terminated'
```

若 `Connection terminated` 次数偏高，先确认三个参数还在
（`ps aux | grep cloudflared`），这是 2026-10-17 排查出的根因。

**最可能的原因**：DNS 解析异常。原机器上遇到过一次——WSL 的虚拟网卡没初始化，导致 cloudflared 连不上 Cloudflare 边缘。检查：

```bash
ls /sys/class/net/          # 应看到 eth0，只有 lo/docker0 说明网卡没起来
ip route show default       # 应有默认路由
```

修复：在 **Windows PowerShell** 里执行 `wsl --shutdown`，等 10 秒后重新打开 WSL。

### 登录后仍被要求登录

`COOKIE_SECURE` 设置不对。站点走 HTTPS 时应为 `1`；如果本地用 HTTP 调试，改成 `0` 并重启。

### 数据库恢复后表结构不对

备份来自旧版本代码。执行：

```bash
npx prisma db push
```

### 构建报类型错误

先清掉残留的构建缓存再构建：

```bash
rm -rf .next
npm run build
```

> 生产环境注意：`rm -rf .next` 会让正在运行的服务短暂 502。应先停服或用「不删除直接构建」的方式。

---

## 附：需要记住的关键信息

| 项 | 值 |
| --- | --- |
| 代码仓库 | `git@github.com:wang13545259496/ai-insight-daily.git` |
| 备份分支 | `db-backup`（孤儿分支，只存最新一份数据库快照） |
| 域名 | aibiliai.com |
| 应用端口 | 3000（Next.js） |
| 隧道回源 | `http://127.0.0.1:3000`（直连 Next.js，无反向代理） |
| WSL 发行版 | Ubuntu，用户 `administrator` |
| 项目路径 | `~/projects/ai-insight-daily` |
| PM2 进程名 | `ai-insight-daily` |
| 旅行模块口令 | **见第一步，需自行保存** |
