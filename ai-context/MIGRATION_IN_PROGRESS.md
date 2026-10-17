# 迁移进行中 — 交接状态

> 最后更新：2026-10-18 01:00
> 状态：**80% 完成，暂停中**。服务器已可用，域名未切换。

---

## 已完成

### 服务器

| 项 | 值 |
| --- | --- |
| 公网 IP | `43.133.176.111` |
| 地域 | 东京（腾讯云轻量，¥288/年） |
| 系统 | Ubuntu 26.04 LTS（与本地 WSL 同版本） |
| 规格 | 2 核 / 1962 MB / 40GB SSD / 已有 2G swap |
| 用户 | `ubuntu`（免密钥登录已配；`root` 不可用） |
| SSH 密钥 | 本地 `~/.ssh/id_ed25519` 已装到服务器 |
| 应用目录 | `/home/ubuntu/ai-insight-daily` |
| 时区 | Asia/Shanghai（系统自带） |

已装：Node v22.23.3、npm 10.9.9、PM2 7.0.4、git 2.53.0、sqlite 3.46.1
（版本与本地 WSL 完全一致）

### 应用

| 项 | 状态 |
| --- | --- |
| 代码 | 747 文件 / 33MB（rsync 传输） |
| 依赖 | `npm ci` 507 包，27 秒 |
| 数据库 | 1794 条，五张表条数与本机一致 |
| 配置 | `.env.local`（11 个变量）、`.env.production`（6 个），权限 600 |
| 构建 | 82 秒，BUILD_ID `xfz3b5MKcP6lfyuqCdl8M` |
| 服务 | PM2 online，内存 68MB |
| 本机 HTTP | `/` 200 0.41s、`/news` 200 0.16s |

### RSS 采集（迁移最大收益）

22 个源全部健康，0 警告 0 失败：

```
OpenAI     101ms   （家里 1.4s）
TechCrunch  30ms   （家里 2.2s）
arXiv       11ms   （家里 400ms）
MIT News    13ms
NVIDIA      43ms
```

此前在家里经常超时的 Google DeepMind、BAIR Blog、The Gradient，
在服务器上全部 100 分。

### 脚本改造

11 个脚本原来把项目路径写死为 `$HOME/projects/ai-insight-daily`，
在服务器上（`/home/ubuntu/ai-insight-daily`）会导致脚本静默退出。

改为从脚本自身位置推导：

```bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
```

已改：news-pipeline-scheduler / health-monitor / daily-report /
db-backup-scheduler / alert / backup-db / backup-db-to-github /
ai-usage-report / set-alert-channel / install-cron / server-health。

---

## 当前运行状态（重要）

| 位置 | 状态 | 原因 |
| --- | --- | --- |
| **本地 WSL** | **运行中**（crontab 8 条、PM2、网站 200） | 域名仍指向家里，必须继续跑 |
| **服务器** | PM2 运行中，**crontab 已停** | 防止两边同时采集、AI 费用翻倍 |

服务器的 cron 备份在 `~/crontab-server-backup-20261018.txt`。

---

## 待办（明天）

### 1. 开端口（需要用户在腾讯云控制台操作）

控制台 → 轻量应用服务器 → 实例 → 防火墙 → 添加：

| 应用类型 | 协议 | 端口 |
| --- | --- | --- |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

### 2. 配 nginx + 证书

```bash
# 服务器上
sudo apt install -y nginx certbot python3-certbot-nginx
# 反代 :443 → 127.0.0.1:3000
# certbot 申请 aibiliai.com 证书
```

### 3. 切换域名

Cloudflare DNS → `aibiliai.com` 的 A 记录改为 `43.133.176.111`，
**代理关闭（灰云）** —— 直连速度最快（约 50–100ms，对比现在 3.5s）。

> 若直连被干扰，可改回橙云（Cloudflare 代理）作为备选。

### 4. 重新同步数据库

本地跑了一夜会采集新数据，服务器上的库会落后。
上传前先停本地 cron，再传库。

### 5. 验证后停用本地

```bash
bash scripts/migration/05-decommission-local.sh --dry-run
bash scripts/migration/05-decommission-local.sh --apply
```

### 6. 恢复服务器 cron

```bash
ssh ubuntu@43.133.176.111 "crontab ~/crontab-server-backup-20261018.txt"
```

---

## 明天第一句话

跟 AI 说：

> 继续迁移。服务器 43.133.176.111，用户 ubuntu，代码在
> /home/ubuntu/ai-insight-daily。端口已开，接着配 nginx 和域名。

---

## 风险与回退

**任何时候都能回到家用电脑模式**：

- 本地代码、数据库、node_modules 全部保留
- 本地 crontab 备份在 `.migration/crontab.txt`
- 域名只要改回原来的 Cloudflare 隧道配置即可

服务器那 ¥288 就算白花，损失有限。

---

## 已知问题

| 问题 | 影响 | 处理 |
| --- | --- | --- |
| 外网访问不到 3000 端口 | 无法直连测试 | 明天开 80/443 后由 nginx 转发 |
| `root` 用户 SSH 不可用 | 只能用 ubuntu + sudo | 无需处理，sudo 免密码已配 |
| MIT News AI 源报错 `Attribute without value` | 该源本轮 0 条 | RSS 本身格式问题，本地也一样，非迁移引入 |
| 服务器 db 落后本地 | 明天需重新同步 | 已列入待办第 4 项 |
