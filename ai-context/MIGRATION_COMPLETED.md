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

## 内容质量优化（2026-10-18）

三项连续改动，都为了减少页面上的「无信息内容」。

### 事件摘要改用 AI 生成

**问题**：60 个事件的摘要 100% 是同一句模板 ——
`围绕"{标题}"形成的AI产业事件。系统将持续聚合相关来源并跟踪后续发展。`
除了复述标题没有任何信息，而它出现在事件列表、详情页和首页卡片上。

**改法**：`lib/ai-summary.ts` 新增 `generateEventSummary()`，
输入事件关联的最近 5 条新闻，输出 2–3 句、120–180 字的客观摘要。

提示词明确禁止：复述标题、写「值得关注」这类空话、预测股价、编造材料里没有的事实。
温度设为 0.1 —— 事件摘要要求高度忠实于材料，不需要发挥。

模型失败时回退旧模板，**不阻塞事件创建**。

**回填**：`scripts/backfillEventSummary.ts`，60 个事件全部重生成，
耗时 71 秒，AI 成本 ¥0.074。

**首页那个更容易被忽略的地方**：改完 summary 字段后，
`/events` 列表和详情页都生效了，但首页「今日重点」卡片显示的
其实是 `getTrendLabel()` 的硬编码文案，不是 summary。
那句模板（「近期出现新增动态，产业影响正在持续扩散」）既重复又无信息，
已改为 `event.summary` + `line-clamp-3`。

> 改文档字段时要顺着「这个字段在哪些页面被渲染」查一遍，
> 否则会以为改完了，而最常看的页面其实用的是另一套文案。

### AI 相关性过滤

**问题**：约 4.7% 的新闻与 AI 无关（融资公告、C# 控件库发布、
猪肾冷冻复活、SSL 证书…），每条还花了约 ¥0.004 的 AI 分析费。

**关键约束**：过滤必须发生在 **调用 AI 之前**。若用模型判定相关性，
每条要先花一次调用才能决定要不要花第二次，等于没省。

**实现**：`lib/news/relevance.ts`，规则版，四类信号任一命中即通过
（技术词 / 海外公司 / 模型产品 / 中文厂商）。

**两轮验证才定稿**：

| 版本 | 拦截率 | 问题 |
| --- | --- | --- |
| 纯关键词 v1 | 7.1% | 误杀「Hybrid-Model Decoding」「开源权重模型」「中国机器人羽毛球」|
| 补词 v2 | 5.2% | arXiv cs.AI/cs.CL 被拦 10 条，全是误杀 |
| **来源豁免 + 词表** | **3.8%** | 无 |

最终对 1799 条真实新闻验证：拦截 68 条，**全部来自 5 个泛科技源**
（OSChina 39%、MIT Technology Review 68%、MIT News AI 36%、
InfoQ 14%、TechCrunch AI 13%），AI 专属源零误杀。

AI 专属源豁免名单（15 个）在 `AI_ONLY_SOURCES`：
arXiv 两个分类、各 AI 实验室官方博客、量子位、Simon Willison。

**实测生产效果**（首次运行）：
`[ingest] 抓取 270｜新增 0｜重复 162｜合并 14｜非AI 23｜空内容 1｜跳过 70｜错误 0`

被拦的 23 条确认都是真无关。

> 被拦的标题单独打日志，**不放进 `errors`** ——
> errors 统计真异常，混进正常过滤会让错误数虚高、掩盖真问题。

### 去掉 HTTP→HTTPS 强制跳转

nginx 的 `return 301` 是 certbot 扩证书时加回来的。
迁移时 443 因防火墙规则丢失导致过整站不可用，所以 80 和 443 都直接服务，
任何一条路通就能访问。代价是访问 `http://` 不自动加密，日常请用 `https://`。

---

## 旅行模块的访客访问（2026-10-18）

### 背景

旅行模块原先只有一个共享口令 `TRAVEL_PASSWORD`。给朋友用之后暴露三个问题：

| 问题 | 后果 |
| --- | --- |
| 口令可无限转发 | 谁在用、转给了谁，完全不知道 |
| 没有身份维度 | `TripPlan` 表没有归属字段，`listPlans` 是全表最新 20 条 —— 朋友之间互相能看到对方的出发地、目的地、日期、预算、人数 |
| 没有限流 | 拿到口令可无限生成，每次约 ¥0.02–0.03（`max_tokens 8000`，是新闻摘要的 5–7 倍） |

### 一次性邀请码

新表 `TravelInvite`，**只存码的 SHA-256，不存明文** ——
数据库泄露时明文码可以直接拿去登录。

消费用带条件的 `updateMany` 而不是「先查再改」：

```sql
UPDATE TravelInvite SET usedAt = now()
WHERE codeHash = ? AND usedAt IS NULL AND expiresAt > now()
```

影响行数为 1 才算抢到。两人同时提交同一个码，只有一个能成功。

码格式 `TRV-XXXX-XXXX`，字符集排除 `0/O`、`1/I/L`；
随机段用**拒绝采样**生成（31 不整除 256，直接取模会让前几个字符概率偏高）。
默认有效期 1 天，未使用也过期。

### 命令行管理

```bash
# 生成（--note 必填，用来记住给谁了）
npx tsx scripts/travel-invite.ts --note "张三" --days 1

# 查看所有码的状态
npx tsx scripts/travel-invite.ts --list

# 撤销未使用的码
npx tsx scripts/travel-invite.ts --revoke TRV-XXXX-XXXX
```

**为什么不做网页后台**：后台本身需要鉴权，而它保护的正是访问凭证 ——
被绕过就等于整个模块的门开了。命令行只对能登录服务器的人可用，不新增攻击面。

### Cookie 带上身份

```
维护者（及改造前的旧会话）  <64 位十六进制>          纯 HMAC
好友                        <grantId>.<签名>          身份 + 该身份签名
```

保留维护者的旧格式，是为了不在上线瞬间把自己踢下线。
签名仍以 `TRAVEL_PASSWORD` 作 HMAC 密钥，服务端**保持无状态**（校验不查库）。

有效期按身份区分：维护者 30 天，好友 1 天。
`proxy.ts` 续期时也必须按身份走 —— 都用默认值会把好友的会话续成 30 天。

### 行程隔离

`TripPlan` 加 `ownerGrant`，列表 / 详情 / 下载三处都校验归属：

| 身份 | 能看到 |
| --- | --- |
| 维护者 | 全部（含 `ownerGrant` 为 `null` 的历史数据） |
| 好友 | 只有自己的 |

越权一律返回 **404 而不是 403** —— 403 等于告诉对方「这个 id 存在，只是你没权限」，
配合自增 id 就能枚举出方案总数。

**指纹也要带上身份**：`fingerprint` 有唯一索引，不加身份会出现两个问题 ——
好友提交与维护者相同的行程时命中维护者的方案（泄露），
或者保存时撞唯一索引存不进去。代价是存量方案会重新生成一次。

### 限流

好友每小时 5 次，维护者不限。滑动窗口，计数在进程内存里
（PM2 单进程 fork 模式，够用）。

**重启会重置**，所以它是防误用、防脚本刷的闸门，不是精确计费系统 ——
真正的成本监控靠 `logs/ai-usage.log`（旅行调用原先完全不记录，现已补上）。

### 登录界面

表单只有一个输入框，提交 `{ credential }`，服务端按**格式**判断：

```
TRV + 8 位  →  邀请码
其它        →  口令
```

不让表单同时发两个字段，是因为服务端看到 `code` 非空就走兑换分支 ——
维护者输入自己口令时会被当成码去查表。
也不让用户选「我是主人还是访客」，既多余又容易选错。

### 踩过的两个坑

**1. 登录接口的改造没进提交**

新版本写在了工作区目录，同步脚本只拷了 `lib/` 下的四个文件，
`app/api/travel/auth/route.ts` 被漏掉。结果服务器拉到的仍是旧接口 ——
用码登录返回旧文案「请输入访问口令」，码重放返回 400 而不是 401。

**只看「部署成功 + tsc 通过」会误以为已上线。**这次是靠端到端验证发现的。

**2. 接口支持了，界面用不了**

修好接口后，端到端测试直接 POST `{code}` 全过。
但表单实际只提交 `{password}` —— 好友在界面上输码必然失败。

**接口测试通过 ≠ 用户能用。**必须从真实入口走一遍。

### 验证结果

线上端到端 15 项全过：

```
维护者输口令           → owner，看到 25 份
好友输码               → friend，看到 0 份
小写无横线也能登录      → 通过（朋友手抄常见）
好友访问维护者方案      → 404
维护者访问自己方案      → 200
码重放                 → 401
错误口令               → 401，提示「口令不正确」而非「码无效」
```

另加 29 项单元测试（旧 Cookie 兼容、篡改签名失效、越权判定边界、
限流用满后拒绝且被拒请求不消耗配额、码归一化等价性）。

### 邀请码管理页（手机上也能用）

命令行只能从电脑操作，而维护者常是临时想给朋友一个码。
新增 `/agent-travel/invites`，仅维护者可见：

  · 填备注 + 选有效期 → 生成 → 大号码显示 + 一键复制
  · 「复制分享文字」直接给出可粘贴到微信的整段话
  · 历史记录：可用 / 已使用 / 已过期，未使用的可撤销
  · 移动优先布局（竖排卡片，不是表格）

入口在旅行主页的登录按钮旁，渲染条件是「是不是 owner」而非
「有没有登录」—— 好友既进不去，看到也只是困惑。

**为什么这不算新增攻击面**：生成码所需的权限与查看全部行程完全相同，
都是 owner。能进这个页面的人本来就能看到所有人的数据。

### 门禁必须在 proxy 层，不能在页面里

第一版把 `redirect()` / `notFound()` 写在页面组件里，结果：

| 访问者 | 期望 | 实际 |
| --- | --- | --- |
| 未登录 | 307 | **200** |
| 好友 | 404 | **200** |
| 维护者 | 200 | 200 |

原因是流式渲染：响应头（200）在页面组件执行到 `redirect()` 之前
就已经发出，状态码改不了了，只有浏览器端在 hydration 后才跳转。

页面里确实没有渲染任何管理内容（有 Cookie 时 21647 字节，
无 Cookie 时 17446 字节的空壳），所以**没有数据泄露**，但：

  · curl 与服务端日志看到 200，掩盖了「其实被拒绝」
  · 搜索引擎可能先拿到一个 200 的空壳
  · 完全依赖 JS

改到 `proxy.ts` 里拦截，渲染之前返回真正的 307 / 404。
页面内的检查保留作纵深防御。

### 验证时踩的测试坑

Cookie 带 `Secure` 标志（`COOKIE_SECURE=1`），而 **curl 在用
`-H` 覆盖 `Host` 头时不会发送 Secure Cookie** —— verbose 里根本看不到
Cookie 请求头。于是「维护者访问管理页」被误判为 307。

真实浏览器在 https 下会正常发送，这是测试工具的行为差异。
改用显式 `-H "Cookie: travel_access=..."` 后准确复现浏览器行为。

> 断言某个返回码之前，先确认这个返回码在当前架构下是否可控。
> 这一轮两次误判都源于此：一次是流式渲染下状态码不可控，
> 一次是测试工具没发 Cookie。

### 又踩了一次「工作区覆盖项目」

同步脚本从工作区整体覆盖 `lib/travel-invite.ts`，把之前**直接加在
项目文件里**的 `looksLikeInviteCode` 冲掉了 —— tsc 立刻报
「没有导出该成员」，构建失败。

根因：从工作区 cp 整文件覆盖，前提是「项目文件没有工作区不知道的改动」。

```
新文件          → 从工作区写入（工作区是唯一来源）
已有文件的改动  → 直接在项目上打补丁，不从工作区覆盖
```

---

### 仍然做不到的

**无法单独吊销某个好友的会话。**

无状态设计下，要立刻切断某人只能改 `TRAVEL_PASSWORD`，
而那会同时踢掉所有人（包括维护者自己）。

一次性码堵住的是「把码转发给别人」这条路；但如果对方导出自己的 Cookie
发给他人，仍然能进 —— 这比转发一句话难得多，日常够用。

要做到能单独踢人，得改成有状态会话（Cookie 带会话 ID，每次请求查库校验），
改动更大且每次访问多一次数据库查询。目前判断不值得。

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
