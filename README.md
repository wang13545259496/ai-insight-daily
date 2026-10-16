# 数据库备份

本分支由 `scripts/backup-db-to-github.sh` 自动维护，**请勿手动修改**。

## 最近一次备份

| 项 | 值 |
| --- | --- |
| 时间 | 2026-10-24_23-00-01 |
| 文件 | `dev_2026-10-24_23-00-01.db.gz` |
| 压缩后 | 5011 KB |
| 原始大小 | 14232 KB |

## 说明

- 内容：`prisma/dev.db` 的一致性快照（SQLite `.backup`，gzip 压缩）
- 分支：与 `main` 无共同历史的孤儿分支，二进制文件不会污染代码历史
- 保留策略：只保留最新一份；旧版本可从本分支的提交历史中找回
- 调度：每天 23:00 触发，开机时补跑（见 `scripts/db-backup-scheduler.sh`）

## 恢复方法

```bash
git fetch origin db-backup
git show origin/db-backup:dev_2026-10-24_23-00-01.db.gz | gunzip > prisma/dev.db
pm2 restart ai-insight-daily
```

## 换新机器时的完整恢复清单

本分支只存数据库。以下内容需要另外准备：

| 项 | 存放位置 |
| --- | --- |
| 代码 | `main` 分支，`git clone` 即可 |
| 数据库 | 本分支，见上方恢复方法 |
| 环境变量 | **需另行保存**：`DEEPSEEK_API_KEY`、`AMAP_WEB_KEY`、
`QWEATHER_KEY`、`QWEATHER_HOST`、`VARIFLIGHT_API_KEY`、
`ROLLINGGO_API_KEY`、`CRON_SECRET`、`TRAVEL_PASSWORD`、`COOKIE_SECURE` |
| 隧道凭据 | Cloudflare 后台重新生成 token |
| nginx 配置 | `server_name` + 反代到 127.0.0.1:3000 |

> 除 `TRAVEL_PASSWORD` 外，其余 Key 都能从对应服务商后台重新获取。
> **`TRAVEL_PASSWORD` 是自定义的，丢了就只能换一个新的。**
