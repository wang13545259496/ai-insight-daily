# 迁移完成记录

> 完成时间：2026-10-18 11:00
> 状态：**已完成，网站已运行在阿里云东京**

原计划文档：[`MIGRATION_TO_CLOUD.md`](./MIGRATION_TO_CLOUD.md)
购买指南：[`TENCENT_CLOUD_PURCHASE.md`](./TENCENT_CLOUD_PURCHASE.md)

---

## 现在的架构

```
用户手机/浏览器
      │  DNS: A 记录 → 43.133.176.111（灰云，不经 Cloudflare）
      ▼
┌─────────────────────────────────────────┐
│  腾讯云轻量 · 东京                        │
│  Ubuntu 26.04 / 2核2G / 40GB             │
│                                          │
│  nginx :80 / :443                        │
│      │ 反向代理                           │
│      ▼                                   │
│  Next.js :3000（PM2 守护）                │
│      │                                   │
│  SQLite prisma/dev.db                    │
│                                          │
│  cron：采集/健康检查/备份/日报            │
└─────────────────────────────────────────┘
```

**与家用电脑完全脱钩。电脑关机、断电、重装都不影响网站。**

---

## 关键参数

| 项 | 值 |
| --- | --- |
| 公网 IP | `43.133.176.111` |
| 地域 | 东京 |
| 系统 | Ubuntu 26.04 LTS（与本地 WSL 同版本） |
| 登录 | `ssh ubuntu@43.133.176.111`（密钥登录，root 不可用） |
| 应用目录 | `/home/ubuntu/ai-insight-daily` |
| 进程管理 | PM2，进程名 `ai-insight-daily` |
| Web 服务 | nginx 1.28.3 |
| 证书 | Let's Encrypt，到期 2027-01-16，自动续期 |
| 时区 | Asia/Shanghai |
| 费用 | ¥288/年（约 ¥24/月） |

---

## 速度对比

| 场景 | 迁移前 | 迁移后 |
| --- | --- | --- |
| 国内访问首页 | 3.5–5.6 秒 | **0.4–0.5 秒** |
| RSS 采集（OpenAI） | 1.4 秒 | **0.1 秒** |
| RSS 采集（TechCrunch） | 2.2 秒 | **0.03 秒** |
| RSS 源健康度 | 偶尔超时 | **22/22 全部 100 分** |

---

## 日常维护

### 查看状态

```bash
ssh ubuntu@43.133.176.111
pm2 status                    # 应用状态
pm2 logs ai-insight-daily --lines 50 --nostream   # 日志
sudo systemctl status nginx   # Web 服务
crontab -l                    # 定时任务
```

### 更新代码

```bash
# 本地改完、提交、推送
git push

# 服务器拉取并重建
ssh ubuntu@43.133.176.111 "cd ~/ai-insight-daily && git pull && npm ci && npx prisma generate && npm run build && pm2 restart ai-insight-daily"
```

> 首次迁移用的是 rsync 通道（服务器上还没配 git）。若要走 `git pull`，
> 需先在服务器 `git clone` 一次并配好 GitHub 的部署密钥。

### 查看数据

```bash
ssh ubuntu@43.133.176.111 "sqlite3 ~/ai-insight-daily/prisma/dev.db 'SELECT COUNT(*) FROM News;'"
```

### 重启服务

```bash
ssh ubuntu@43.133.176.111 "pm2 restart ai-insight-daily"
ssh ubuntu@43.133.176.111 "sudo systemctl restart nginx"
```

---

## 自动运行的任务

迁移后全部在服务器上，无需人工干预：

| 任务 | 时间 | cron 表达式 |
| --- | --- | --- |
| 新闻采集 + AI 分析 | 每小时 | `0 * * * *` |
| 健康检查 + 告警 | 每小时 | `15 * * * *` |
| 数据库备份（推 GitHub） | 每天 23:00 | `0 23 * * *` |
| 日报推微信 | 每天 22:30 | `30 22 * * *` |
| 开机补跑 | 重启后 | `@reboot` |

---

## 迁移过程中发现并修掉的问题

### 1. 脚本路径硬编码（会导致静默失效）

11 个脚本把项目路径写死为 `$HOME/projects/ai-insight-daily`。
服务器上项目在 `/home/ubuntu/ai-insight-daily`，脚本找不到 `.env.local`
就**静默退出**——cron 配好了但采集根本不跑，且没有任何报错。

改成从脚本自身位置推导：

```bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
```

### 2. 防火墙 443 规则未保存

第一次添加 HTTPS 规则后列表里没有它，导致 HTTP 跳转 HTTPS 后整站不可用。
重新添加并确认「来源」为「全部IPv4地址」后解决。

**教训**：改完防火墙要回列表确认规则真的存在。

### 3. 证书申请失败一次

第一次同时申请 `aibiliai.com` 和 `www.aibiliai.com`，但 www 的 DNS 记录已被删除，
Let's Encrypt 验证失败。改为只申请主域名后成功。

### 4. 本地 PM2 被 systemd 复活

`pm2 delete` 后进程又出现了（systemd 的 pm2-administrator 服务按 dump 恢复）。
用 `pm2 save --force` 写入空列表后彻底解决。

---

## nginx 配置说明

配置文件：`/etc/nginx/sites-available/ai-insight-daily`

**80 和 443 都直接服务，不做强制跳转。**

原因：迁移时 443 曾被防火墙拦住，如果 80 跳 443，整站就不可用。
两个端口都服务意味着**任何一条路能通，站就能访问**。

代价是访问 `http://` 时不会自动升级到加密连接。日常请用 `https://aibiliai.com`。

配置要点：

```nginx
proxy_read_timeout 600s;   # 采集接口可能跑几分钟
proxy_buffering off;       # 流式响应不被缓冲
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## 回退到家用电脑的方法

本地环境**完整保留**（代码、数据库、node_modules 都没删）：

```bash
# 1. 本地恢复
crontab /tmp/premigrate-20261018-104818/crontab.txt
cd ~/projects/ai-insight-daily && pm2 start npm --name ai-insight-daily -- start
sudo systemctl enable --now cloudflared-ipv4

# 2. Cloudflare 把 DNS 改回隧道
#    A 记录 → 删掉
#    CNAME → ai-insight-daily.cfargotunnel.com，开橙云
```

隧道 `ai-insight-daily` 在 Cloudflare 上**保留未删**，随时可切回。

---

## SSH 加固（已完成）

初始密码较弱（站内信自动生成的 13 位），已改为**仅密钥登录**。

### 改动

新建 `/etc/ssh/sshd_config.d/10-hardening.conf`：

```
PasswordAuthentication no
PermitEmptyPasswords no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
MaxAuthTries 4
LoginGraceTime 30
```

### 为什么文件名是 10- 而不是 99-

**sshd 对同一关键字「首个匹配生效」**，后面的被忽略。

而 `Include /etc/ssh/sshd_config.d/*.conf` 位于主配置第 24 行，
早于主配置自身的设置；drop-in 之间按**文件名排序**读入。
cloud-init 写的是 `50-cloud-init.conf`（`PasswordAuthentication yes`）。

所以必须用排序更靠前的 `10-` 才能覆盖它。若写成 `99-hardening.conf`，
会因为 50 先被读到而**完全失效**，而且不报错。

`sshd -T` 可以验证实际生效值，不能靠猜：

```bash
sudo sshd -T | grep -iE '^(passwordauthentication|permitrootlogin)'
```

### 加固后状态

| 项 | 结果 |
| --- | --- |
| 密钥登录（ubuntu） | ✓ 正常，sudo 可用 |
| 密码登录 | ✗ `Permission denied (publickey)` |
| root 登录 | ✗ 被拒绝 |
| 支持的认证方式 | 仅 publickey |

Windows 与 WSL 两侧的密钥登录均已验证。

### 万一锁死的恢复方法

腾讯云控制台 → 实例 → **登录**（OrcaTerm 网页终端）不依赖 sshd：

```bash
sudo rm /etc/ssh/sshd_config.d/10-hardening.conf
sudo systemctl restart ssh
```

---

## GitHub 接入（已完成）

服务器已接上 GitHub，代码更新走 `git pull`，不再需要 rsync 传文件。

### 配置

服务器生成了独立密钥 `~/.ssh/id_ed25519_github`，作为 **Deploy Key**
添加到仓库（已勾选 Allow write access）。

`~/.ssh/config` 指定该密钥用于 github.com：

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github
    IdentitiesOnly yes
```

**为什么必须勾 write access**：`backup-db-to-github.sh` 每天 23:00
往 `db-backup` 分支推数据库备份。只读密钥会让备份静默失败。

### 目录转仓库的做法

原本是 rsync 部署的普通目录，转成 git 仓库时：

```bash
git init -b main
git remote add origin git@github.com:.../ai-insight-daily.git
git fetch origin main          # 只下载对象，不碰工作区
git reset --hard origin/main   # 对齐
```

**风险在于 `reset --hard` 会覆盖工作区**。所以先在 fetch 后用
`git check-ignore` 逐个确认敏感文件会被忽略，并记录它们的 md5：

```
.env.local / .env.production / prisma/dev.db / node_modules / .next / logs
```

reset 后重新比对 md5，确认一个字节都没变。实测全部一致。

### 日常更新代码

```bash
# 本地提交并推送
git push

# 服务器拉取、重建、重启、健康检查（失败自动回滚）
ssh ubuntu@43.133.176.111 "cd ~/ai-insight-daily && bash scripts/deploy-server.sh"
```

`scripts/deploy-server.sh` 会做：git pull → 按需 npm ci → prisma generate
→ build → pm2 restart → 5 次健康检查 → 失败自动回滚到上一个 commit。

### 验证结果

| 项 | 结果 |
| --- | --- |
| SSH 认证 | ✓ `Hi wang13545259496/ai-insight-daily!` |
| `git ls-remote` | ✓ 返回 HEAD |
| `git pull` | ✓ 拉下了 db-backup 分支与全部 tag |
| `git push --dry-run` | ✓ Everything up-to-date（写权限有效） |
| 备份脚本端到端 | ✓ 快照 10.8MB → 压缩 3.8MB → 推送成功 |
| 敏感文件 | ✓ md5 全部未变 |
| 应用 | ✓ reset 后 HTTP 200 |

---

## 密钥管理与故障恢复

### 服务器上有两把钥匙

| 密钥 | 指纹 | 存在哪 |
| --- | --- | --- |
| 主密钥 | `SHA256:lttkVvDA9Sqy6js62A2AtfwZDfXZdTD3smneUJOguk0` | 本机 `~/.ssh/id_ed25519` |
| 备用密钥 | `SHA256:sGpAkTxPX+wLTnPEm0FaB05roRmY4brUwu+ZPUK00iY` | 本机已删，加密后异地保存 |

两个公钥都在服务器的 `~/.ssh/authorized_keys` 里，**任一个都能登录**。

### 备用密钥怎么存的

私钥用 AES-256-CBC + PBKDF2 20 万轮加密，文件放网盘/U盘；
**解密口令单独记**（人脑 / 纸上 / 密码管理器），不与文件同处。

> 文件和口令放一起等于没加密——拿到文件的人同时拿到钥匙。

本机（WSL）的明文备用私钥已用 `shred` 删除，只留加密文件。

### 为什么「在线重置密码」没有意义

腾讯云控制台提供「在线重置密码」（通过 TAT 自动化助手在实例内
执行 `chpasswd`，无需关机）。但**本服务器已设置
`PasswordAuthentication no`**，改密码也不会让 SSH 可用。

真正该准备的不是密码，而是：

1. **备用密钥**（已做）
2. **TAT 执行命令**（不依赖 SSH、不依赖密码、不依赖对外端口）

### TAT 兜底：连密钥都进不去时

```
腾讯云控制台 → 轻量应用服务器 → 实例 → 更多 → 执行命令
```

这个通道走云厂商的 agent（`/usr/local/qcloud/tat_agent/tat_agent`），
只有云控制台能断，是最可靠的最后一道门。

常用恢复命令：

```bash
# SSH 配置改坏了
sudo rm -f /etc/ssh/sshd_config.d/10-hardening.conf
sudo systemctl restart ssh

# 重新装公钥
echo 'ssh-ed25519 AAAA...' >> /home/ubuntu/.ssh/authorized_keys

# 应用挂了
pm2 restart ai-insight-daily
```

### 实测记录

```
主密钥登录          ✓
备用密钥登录        ✓（装公钥后立即验证）
加密文件解密        ✓ 与原文件逐字节一致
清理后主密钥仍可用  ✓
服务器 authorized_keys 2 个密钥 ✓
```

---

## 遗留事项

| 项 | 说明 | 优先级 |
| --- | --- | --- |
| ~~SSH 密码强度~~ | ~~建议改密钥登录~~ | ✅ **已完成** |
| `www.aibiliai.com` | DNS 记录已删，无法访问 www | 低 |
| 本地 WSL 网络 | Clash 开启时 WSL 镜像网络失效，关掉 Clash 或用 `wsl --shutdown` 重启可恢复 | 低 |
| ~~服务器未配 git~~ | ~~配 GitHub 部署密钥~~ | ✅ **已完成** |

---

## 迁移耗时

| 阶段 | 时间 |
| --- | --- |
| 服务器初始化 | 约 3 分钟 |
| 传代码 + 依赖 | 约 4 分钟 |
| 传数据 + 构建 | 约 3 分钟 |
| 配 nginx + 证书 | 约 10 分钟（含排查 443） |
| **合计** | **约 1 小时**（跨两次会话） |
