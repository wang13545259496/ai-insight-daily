# AI Insight Daily AI故障排查手册 V1.0


## 使用目的


当系统出现异常：

按照：

现象

↓

定位

↓

修复

↓

记录


流程处理。



================================

# 一、网站无法访问


## 现象


首页打不开。

502错误。

页面超时。



## 排查顺序


第一：

检查PM2


命令：

pm2 status



确认：

ai-insight-daily 是否运行。



---


第二：

查看日志


命令：

pm2 logs ai-insight-daily



查看：

启动错误。

运行异常。



---


第三：

检查端口


确认：

Next.js服务是否监听。



---


第四：

检查Nginx


确认：

配置。

代理。

HTTPS。



================================

# 一之二、网站间歇性打不开（2026-10-17 排查记录）

> **⚠️ 本节描述的是迁移前（家用电脑 + Cloudflare 隧道）的架构。**
>
> 2026-10-18 已迁移到阿里云东京，直连 A 记录、不经 Cloudflare 代理，
> 本节的问题 A 和问题 B 都不再存在。保留此节是因为排查思路仍有参考价值。
>
> 现在的架构见 [`MIGRATION_COMPLETED.md`](./MIGRATION_COMPLETED.md)。

## 现象

- 有时能开、有时打不开，无明显规律
- `http://127.0.0.1:3000` 一直正常
- 换设备、换网络表现不同

## 结论：两个独立问题叠加，都已定位

### 问题 A：隧道协议导致反复断连（已修复）

**症状**：隧道日志里 `Connection terminated` 频率极高
（修复前实测 10 分钟内 14 次，约每 40 秒一次）。

**根因**：cloudflared 默认走 IPv6 + QUIC/UDP。

```
--edge-ip-version 4          边缘地址解析为 IPv4
--edge-bind-address 0.0.0.0  套接字绑 IPv4（否则源地址是 [::]）
--protocol http2             用 TCP 替代 UDP/QUIC
```

三个都要加。缺第一个会报 `network is unreachable`；
缺第二个会出现 `write udp [::]:43260->198.41.x.x:7844` 这类错；
缺第三个在国内网络下 UDP 常被 QoS。

**修复后**：连续 27 分钟零错误，4 条连接未重连。

服务定义见 `/etc/systemd/system/cloudflared-ipv4.service`，
管理脚本 `scripts/manage-cloudflared.sh`（status / install / rollback）。

### 问题 B：访客侧 IPv6 到 Cloudflare 边缘不可达（**无法修复**）

**症状**：`dig AAAA aibiliai.com` 有记录，但 IPv6 连不上。

```
2606:4700:3031::6815:23f   TCP 443 不通
2606:4700:3033::ac43:80d6   TCP 443 不通
```

**影响实测**（Node 内置 https，含 RFC 8305 Happy Eyeballs，与浏览器一致）：

```
浏览器行为（双栈并行）   19/20 成功  1 次超时   平均 2.36s
强制 IPv4（基线）        20/20 成功  0 次失败   平均 1.89s
```

即：**约 5% 请求失败，平均慢 0.47 秒。**

> ⚠️ 用 curl 测会得到"20% 失败"的结论，那是错的 ——
> curl 不做 Happy Eyeballs，先等 IPv6 满超时才试 IPv4。
> 判断真实访客体验必须用 Node/浏览器，不能用 curl。

**为什么修不了**：Cloudflare 免费版不给关闭 IPv6。三条路都试过：

| 路径 | 结果 |
| --- | --- |
| 后台「IPv6 兼容性」开关 | 存在但禁用（Enterprise 专属） |
| API `PATCH /zones/{id}/settings/ipv6` | Enterprise 专属 |
| API 记录级 `settings.ipv4_only` | 报错 9227：`The IPv4 Only and IPv6 Only settings are not available to this zone` |

官方文档明确标注该功能仅 Enterprise 可自定义。

**决定：接受现状。** 理由：影响仅 5% 失败 + 慢 0.5 秒，
浏览器失败后会自动重试；为这个升级 Enterprise 不划算。

## 排查顺序（下次照这个走）

```bash
# 1. 应用本身是否正常
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
# 200 = 应用没问题，问题在隧道或 DNS

# 2. 隧道是否在断连（关键指标）
journalctl -u cloudflared-ipv4 --since '10 min ago' --no-pager | grep -c 'Connection terminated'
# 接近 0 正常；每秒几次说明协议参数丢了

# 3. 隧道协议与 IP 版本
journalctl -u cloudflared-ipv4 -n 50 --no-pager | grep 'Registered tunnel'
# 要看到 protocol=http2 且 ip=198.41.x / 104.x（IPv4）

# 4. 是否 IPv6 问题
curl -4 -s -o /dev/null -w 'v4: %{http_code}\n' https://aibiliai.com/
curl -6 -s -o /dev/null -m 8 -w 'v6: %{http_code}\n' https://aibiliai.com/
# v4=200 且 v6=000 → 就是问题 B，无解，属已知现象
```

## 二次排查时不要做的事

- **不要用 curl 的失败率推断访客体验**（它没有 Happy Eyeballs）
- **不要去看 nginx**（已于 2026-10-17 停用，不在链路上）
- **不要以为「服务 active」就代表参数生效** ——
  `systemctl start` 对运行中的服务是空操作，
  必须核对 `ps aux | grep cloudflared` 的实际命令行

---

# 一之三、改了 DNS 后本地打不开（本机 / 路由器 DNS 缓存）

## 现象

改完 Cloudflare 的 DNS 记录（换 IP、加子域名、删记录）后：

- **公网 DNS 解析已经正确**
- 但**本机**打不开，报错有三种形态

| 报错 | 场景 |
| --- | --- |
| Cloudflare `Error 1016 · Origin DNS error` | 记录已删，但请求仍发往 Cloudflare |
| Cloudflare `Error 522` | 换 IP 后本机仍访问旧的 Cloudflare 地址 |
| 浏览器「找不到网站」 | 加了记录但本机还认为域名不存在 |

## 根因：DNS 负缓存

本机用的是路由器 DNS（`192.168.1.1`），它缓存了旧结果。

DNS 不只有正缓存，还有**负缓存** —— 查询一个不存在的域名，
解析器会把「不存在」这个结论缓存一段时间，长度由域名的 SOA 记录决定
（常见 300–1800 秒）。

于是出现「公网已生效、本机没生效」。

## 排查顺序

```bash
# 1. 公共 DNS —— 确认记录在权威 DNS 已生效
dig +short A www.aibiliai.com @8.8.8.8
dig +short A www.aibiliai.com @223.5.5.5

# 2. 路由器 DNS —— 看是不是它没更新
dig +short A www.aibiliai.com @192.168.1.1
```

Windows 上等价：

```powershell
ipconfig /flushdns                                   # 清本机缓存
Resolve-DnsName www.aibiliai.com -Server 8.8.8.8     # 公共 DNS
Resolve-DnsName www.aibiliai.com -Server 192.168.1.1 # 路由器 DNS
```

## 判断口诀

> 公共 DNS 对、路由器 DNS 错 → 等一会儿，或换 DNS
> 两者都错 → 记录没生效或配错了，回去检查 Cloudflare

## 解决

| 方法 | 生效速度 | 说明 |
| --- | --- | --- |
| 等 | 5–30 分钟 | 负缓存 TTL 到期自动恢复 |
| 把本机 DNS 改成 `223.5.5.5` | 立刻 | 绕过路由器缓存 |
| 重启路由器 | 立刻 | 清空路由器缓存，会短暂断网 |

**`ipconfig /flushdns` 只能清 Windows 自己的缓存，清不了路由器那一层。**

## 2026-10-18 实测记录（加 www 子域名）

```
8.8.8.8        → 43.133.176.111   ✓
223.5.5.5      → 43.133.176.111   ✓
119.29.29.29   → 43.133.176.111   ✓
192.168.1.1    → 无记录            ✗  ← 路由器负缓存
```

用 `curl --resolve` 绕过 DNS 强制指向服务器，证明服务器侧完全正常：

```bash
curl --resolve www.aibiliai.com:443:43.133.176.111 https://www.aibiliai.com/
# → HTTP 200，证书验证通过
```

**结论**：nginx、证书、应用都没问题，纯粹是本地缓存。

## 同一类现象的另一个实例

把 `aibiliai.com` 的 A 记录从 Cloudflare 改成服务器 IP 后，
浏览器仍报 `Error 522`（Cloudflare 连不上源站）——
因为本机缓存还指向 Cloudflare 的 `104.21.x` / `172.67.x`。

`ipconfig /flushdns` 后立刻正常。

## 教训

**改完 DNS 先 `ipconfig /flushdns`，再判断是否真的没生效。**

不加这一步，很容易把「缓存没更新」误判成「服务器配错了」，
然后去改一堆本来正确的东西。

---

# 旅行规划：行程内容变成「首选景区」「景区周边」这类占位描述

## 现象

生成行程后，返回的内容是：

```
08:30  早餐与出发准备        地点：酒店或周边小店
09:30  三亚核心景点游览       地点：首选景区
12:30  当地特色午餐          地点：景区周边
14:00  深度体验或博物馆       地点：市区
```

标题和地点全是占位词，没有一个真实地名。用户拿到的等于一份空方案。

## 一句话结论

**思考模式没关，推理把 `max_tokens` 全吃光了，模型返回空内容，
系统降级到确定性模板。**

## 排查过程

### 1. 先确认是 AI 还是模板

方案内容里有 `首选景区`、`景区周边` 这类词 —— 这两个词在
`lib/agents/travel/itinerary.ts` 的模板里，而
`lib/agents/travel/prompt.ts` 第 56 行明确禁止模型使用它们。
所以**一定是模板兜底**，不是模型输出。

### 2. 查模型为什么失败

PM2 错误日志：

```
[travel] 模型返回空内容 { attempt: 1, model: 'deepseek-flash' }
[travel] 模型返回空内容 { attempt: 2, model: 'deepseek-flash' }
```

### 3. 看 AI 用量日志，找到真正原因

```
{"in":3480,"out":8000,"reason":8000}
```

`reason: 8000` = 推理 token 占满全部输出预算 → 正文 0 token。

### 4. 为什么以前是好的

方案 49 及以前的 `model` 字段是 `deepseek-chat`，全部成功；
50/51 是 `deepseek-flash`，全部失败。

`deepseek-flash` 默认开启思考模式，而
`lib/agents/travel/ai.ts` 没有传 `thinking: { type: "disabled" }`。
`lib/ai-summary.ts` 早就处理过同一个问题，唯独旅行模块漏了。

## 修复

`lib/agents/travel/ai.ts` 加上 `THINKING_DISABLED` 并展开进请求。

实测同一提示词：

| | 耗时 | 输出 tokens | 推理 tokens | 正文 |
| --- | --- | --- | --- | --- |
| 开思考 | 18.9s | 3891 | 3143 | 有（短提示词时） |
| **关思考** | **3.5s** | **655** | **0** | 完整 JSON |

短提示词下思考还能剩下正文；生产环境提示词 3500 token，
推理直接顶到 8000 上限，正文就空了。

修复后线上实测：

```
{"in":3468,"out":2143,"reason":0}
generatedByAI: true
```

行程内容：

```
三亚兴安长峰大酒店(万象汇店)
琼禧小馆·海南菜
蜈支洲岛旅游风景区
阿俊糟粕醋抱罗粉
亚龙湾热带天堂森林公园
```

## 排查口诀

> **日志说「返回空内容」时，先看 `reasoning_tokens`，不要先怀疑提示词。**
>
> `reasoning_tokens` 接近 `max_tokens` → 思考模式没关
> `reasoning_tokens` 很小 → 模型真的没话说，回去看提示词与输入内容

## 防止再犯

`lib/agents/travel/ai.ts` 里「模型返回空内容」的日志现在带上
`finish_reason` 与完整 `usage`，下次出现能直接从日志判断方向，
不用再去翻用量日志反推。

## 同类风险点

所有调用模型的地方都必须显式关思考（结构化输出用不上深度推理，
开着等于把输出预算烧在思考上）：

| 文件 | 状态 |
| --- | --- |
| `lib/ai-summary.ts` | ✅ 已关 |
| `lib/agents/travel/ai.ts` | ✅ 已关（本次修复） |
| `scripts/extractEntities.ts` | ⚠️ 未关 |
| `scripts/backfillTitleZh.ts` | ⚠️ 未关 |
| `scripts/backfillEventTitleZh.ts` | ⚠️ 未关 |

后三个是一次性回填脚本，不常跑，暂未处理 —— 但**下次跑之前要先加上**，
否则可能静默产出空结果。

---

# 实体库：核心模型显示「暂无说明」

## 现象

实体库页面上，GPT、Claude、Gemini 三个模型的说明显示为「暂无说明」。
而它们恰恰是全站关联新闻最多的实体：

```
GPT      283 篇新闻   2 个事件
Claude    28 篇新闻   2 个事件
Gemini    16 篇新闻   3 个事件
```

同页的 GPT-6、Gemini 4 Argon、Frontier 都有正常说明。

## 根因

`scripts/extractEntities.ts` 从 **IndustryHotspot 的关键词**播种实体时写死：

```ts
seeds.push({ name: k, type: "model", aliases: [], description: "" });
```

两处错误：

| 字段 | 问题 |
| --- | --- |
| `description` | 写死空字符串 |
| `type` | 一律 `model` —— NVIDIA 是公司却标成模型 |

更关键的是：AI 提取入库时遇到已存在实体会因唯一约束**跳过**
（`catch { // 已存在则跳过 }`），所以这些空说明不会被后续流程自动补上。

热点关键词去重后 20 个，过滤掉「大模型 / LLM / GPU / 芯片 / 算力」这类
宽泛词，剩下的恰好就是 GPT、Claude、Gemini、NVIDIA 四个 ——
**受影响的正是最需要说明的那几个**。

## 修复

**数据侧**（已有备份）：

```
GPT      → OpenAI 的生成式预训练模型系列，ChatGPT 的底层模型
Claude   → Anthropic 的对话模型系列，以长上下文与安全性见长
Gemini   → 谷歌的多模态大模型系列，覆盖搜索与云服务场景
```

**NVIDIA 还多了一条脏数据**：

```
#536  company(candidate)  18 篇新闻  1 个事件  别名 |英伟达|NVIDIA|  有说明  ← 正确
#7    model(active)        0 篇新闻  0 个事件  无别名   无说明           ← 空壳
```

`#7` 是早期把「NVIDIA」当模型播种的产物。标 `merged`
（项目既有的合并方式，现有 11 条先例），页面只剩正确那条。

**代码侧**：加 `KNOWN_ENTITIES` 字典，播种时查表拿类型与说明。
字典里没有的新词仍然播种（可能是新出现的模型名），但会打一条告警：

```
[entities] 种子「xxx」没有预置说明，页面会显示「暂无说明」；建议补进 KNOWN_ENTITIES
```

避免又静默产生一批空说明。

## 为什么不交给模型生成

这几个名字固定、含义明确。人工写比让模型从新闻里猜可靠 ——
模型容易把「GPT」理解成某个具体版本（如 GPT-5），写出一句过时的说明。

## 验证

```
页面「暂无说明」出现次数: 0
说明为空的实体:            0 条（修复前 4 条）
可见的 NVIDIA:             1 条（修复前 2 条）
```

## 同名实体的类型冲突（已处理）

排查说明缺失问题时顺带发现：11 组同名实体被标成了不同类型，
列表页会各显示一次（AWS 既是 company 又是 product）。

### 规律

11 组**全部**符合同一个模式 —— 一组有新闻关联，另一组是 0 新闻 0 事件的空壳：

| 名称 | 保留（有新闻） | 空壳（0 新闻） |
| --- | --- | --- |
| Codex | #279 product（121） | #825 model |
| GitHub | #86 company（29） | #514 product |
| Sora | #897 product（16） | #907 model |
| OpenAI Academy | #621 product（14） | #841 company |
| AWS | #703 company（7） | #881 product |
| Facebook | #235 product（5） | #1104 company |
| Instagram | #237 product（4） | #1236 company |
| Axios | #840 product（3） | #876 company |
| ArtCraft | #63 product（2） | #302 company |
| GPT-Live | #276 model（6） | #715 product |

### 成因

数据库唯一约束是 `(name, type)`，而 AI 提取对同一个名字在不同批里
给出了不同的 type，于是各建了一条。空壳那条没有任何关联数据。

### 处理

**数据侧**：保留有数据的那条，空壳标 `merged` 并把 `mergedIntoId`
指向保留项 —— 这是项目既有约定（原有 11 条 merged 都这么做）。
因为空壳没有任何关联，不需要迁移 `NewsEntity` / `EventEntity`。

**代码侧**：`scripts/extractEntities.ts` 的实体索引从 `${name}||${type}`
改成按 `name` 唯一，同名一律复用已有实体，不再新建空壳。
模型给的类型与已存冲突时累加计数、收尾报告，但不为此分裂实体。

代价是失去「同名不同类型」的能力（schema 注释里举的
「Apple 公司 vs Apple 产品线」）。对 OpenAI / GPT-6 / Sora
这类专名可以接受。

### 结果

```
重名组数    0（处理前 11）
可见实体    1491（处理前 1500）
merged      22 条，全部有有效 mergedIntoId
说明为空    0 条
```

### 教训

> 唯一约束用 `(name, type)` 时，模型对 type 的摇摆会直接变成重复数据。
> 判定实体身份的是**名字**，type 是属性 —— 把属性放进唯一键里，
> 等于把「模型的分类分歧」变成了「两个不同的实体」。

---

# 二、PM2服务异常


## 现象


服务停止。

自动重启。

启动失败。



排查：


查看状态：

pm2 status



查看日志：

pm2 logs



检查：

环境变量。

Node版本。

依赖。



恢复：


pm2 restart ai-insight-daily



================================

# 三、数据库异常


## 现象


页面无数据。

接口报错。

Prisma错误。



排查：


检查：

prisma/schema.prisma


检查：

数据库文件。


检查：

migration状态。



命令：


npx prisma migrate status



必要时：

npx prisma generate



================================

# 四、新闻采集异常


## 现象


没有新新闻。

新闻数量异常。



排查：


检查：

采集日志。


来源状态。


RSS是否变化。



确认：

是否被网站限制。

是否解析规则失效。



================================

# 五、AI分析失败


## 现象


新闻没有分析结果。

AI任务失败。



排查：


检查：

API Key。


模型接口。


调用日志。



确认：

请求格式。

返回格式。

错误原因。



================================

# 六、数据质量异常


## 现象


出现：

重复新闻。

营销内容。

错误来源。



排查：


检查：

来源规则。


过滤逻辑。


duplicateHash。



不要：

直接批量删除数据。



================================

# 七、构建失败


## 现象


npm run build失败。



排查：


检查：

错误文件。


TypeScript错误。


依赖问题。



流程：


修复代码。


重新build。


确认通过。



================================

# 八、部署失败


## 现象


更新代码后网站异常。



排查：


检查：

Git状态。


依赖。


数据库。


构建。


PM2。



恢复：

回滚版本。



================================

# 九、日志位置


主要日志：


PM2日志。


应用日志。


系统日志。



排查原则：

先看最近错误。



================================

# 十、AI排查规则


AI必须：


先收集现象。


再定位原因。


最后修改。



禁止：


看到错误立即重构。


没有日志直接猜测。



================================

# 十一、故障记录模板


编号：

日期：

问题：

现象：

原因：

解决：

影响：

预防措施：



================================

# 最终目标


建立：

快速发现。

快速定位。

快速恢复。


的AI维护体系。




================================

# 旅行规划：通勤时间过长或跨区


现象：


生成的方案中，某一天出现明显不合理的通勤，
例如同一天内「景区 → 餐厅」需要 100 分钟以上。


先区分两种原因：


## 原因一：模型把不同片区的活动排在同一天


判断：

告警中出现「距离当日其他活动约 N 公里」或「实际通勤 N 分钟」。


处理：

系统会自动带着具体问题重排一次。若重排后仍超标，
说明提示词约束已到极限，此时：


1. 重新生成一次（模型有随机性）
2. 或在表单的「补充要求」里写明区域限制，
   例如「所有活动安排在市区，不要去海棠湾」


## 原因二：地图接口数据失真


判断：

通勤段显示为公交，且距离超过 60 公里、耗时超过 120 分钟。
典型场景是海岛类景点（如蜈支洲岛），路网数据中位于海上。


处理：

系统已自动丢弃超过 120 分钟的公交方案，这类段不会展示。
若仍看到异常数值，检查 amap.ts 中 IMPLAUSIBLE_TRANSIT_MINUTES 阈值。


## 排查步骤


1. 确认 Key 与配额


   npx tsx --env-file=.env.local scripts/travel/check-amap.ts


2. 查看活动是否拿到坐标

   若某活动无 coordinates，说明地理编码失败。常见原因：

   模型输出的 location 不是可检索的地名。
   提示词已要求填写真实地点名（如「南山文化旅游区」），
   但模型偶尔仍会写「景区周边」这类描述。


3. 查看当日通勤段

   通勤段只在「相邻且双方都有坐标」时生成。
   中间活动定位失败会断开链条，这是预期行为，
   目的是避免把不相邻的地点配对计算。


## 相关配置


MAX_COMMUTE_MINUTES           60    单段通勤上限

MAX_DAY_RADIUS_KM             30    当天活动离散半径上限

DRIVE_FALLBACK_MINUTES        45    补查驾车方案的阈值

IMPLAUSIBLE_TRANSIT_MINUTES  120    公交方案失真阈值

SAME_POINT_THRESHOLD_METERS   50    近于此距离视为同一点，不规划通勤

================================

# 旅行规划：高德接口的两个隐蔽陷阱


这两个坑都实际踩过，且症状具有误导性，特此记录。


## 陷阱一：地理编码解析到别的省份


现象：

行程里出现完全错误的通勤，或地址显示为其他省份城市。


实例（实测）：


「长江索道新华路站」+ city=重庆   -> 贵州省安顺市关岭县索大道

「南山泉水鸡一条街」+ city=重庆   -> 辽宁省丹东市宽甸县南山一条街

「山城第三步道」   + city=重庆   -> 河南省鹤壁市山城区


原因：

高德 geocode/geo 的 city 参数传「城市名」时，限定并不严格。
它会把地点名当成外地的同名路名去匹配。


为什么这比「解析失败」更危险：

解析失败只会缺一条通勤；
解析错误会生成一段看起来完全合理的假通勤，
用户在页面上看不出任何异常，会按错误信息安排行程。


正确做法：


1. 用 adcode 而非城市名做限定。
   高德先做一次城市地理编码拿到 adcode，后续所有地点查询
   都传 adcode。实测同一批地点用 adcode 后全部落在本市。

2. 对返回结果做 adcode 前缀校验。
   adcode 前两位是省级编码，与目的地不一致的结果直接丢弃并记日志。


对应实现：

lib/agents/travel/amap.ts 的 geocodePlace(city, name, adcode)
日志关键字：地理编码结果不在目标城市，已丢弃


## 陷阱二：高德单 Key QPS 限制被并发打爆


现象：

大批活动报告「未能在地图上定位」，比例高达 80% 以上。


实例（实测）：

并发 5 时，26 个活动只有 4 个拿到坐标。
错误码 10021 CUQPS_HAS_EXCEEDED_THE_LIMIT，
连串行发出的测试请求也被拒绝。


原因：

高德对单 Key 有 QPS 上限。并发请求超过上限后，
超限的请求返回 10021，而代码把异常 catch 成 null，
于是被误判为「该地点不存在」。


正确做法：


1. 并发降到 2（地理编码）与 2（通勤查询）。

2. 对 10021 做退避重试（600ms、1500ms），
   限流是暂时的，不该当成数据缺失。


对应实现：

lib/agents/travel/amap.ts 的 amapGet 内置退避重试，
常量 GEOCODE_CONCURRENCY / COMMUTE_CONCURRENCY /
RATE_LIMIT_BACKOFF_MS / AMAP_QPS_EXCEEDED


## 排查顺序建议


1. 先看命中率。低于 70% 优先怀疑 QPS 限流。

2. 再看地址字段。出现外地城市名即为地理编码越界。

3. 两个都可能同时发生：限流会掩盖越界问题，
   修好限流后才看得到真实的越界比例。

================================

# 旅行规划：有打车费却没有坐标与通勤


现象：

方案里 mapTaxiCost 大于 0、预算里也有「含市内打车约 N 元」，
但所有活动的 coordinates 为空、通勤段为 0。


为什么这个组合必然意味着 bug：

打车费只能由驾车通勤段累加得出。
既然有打车费，就说明通勤计算成功过，
那坐标与通勤段不可能同时为空——
两个数据来自同一次地图增强，必须同进同退。


根因（实际踩过）：

预算需要重算时，误用模型的原始草稿重建了整个行程：

  base.itinerary = finalizeItinerary(draft.days, base.budget, dates, query)

draft.days 是模型的原始输出，**不含任何地图数据**。
这一步把刚补好的 coordinates / address /
commuteFromPrevious / commuteLegs 全部覆盖掉了。
mapTaxiCost 是独立字段，所以幸存下来，形成上述矛盾组合。


正确做法：

预算变化时只重新分配金额，不要重建行程：

  base.itinerary = repriceItinerary(base.itinerary, base.budget)

对应实现：

lib/agents/travel/itinerary.ts 的 repriceItinerary
它只改 estimatedCost，其余字段原样保留。


## 通用教训


凡是「重建行程」的赋值在本模块里都是危险操作：
finalizeItinerary 的输入是模型草稿，调用它等于丢弃地图增强结果。
需要调整金额时用 repriceItinerary，
需要补齐天数时用 fillMissingDays，
两者都不会覆盖已有字段。


## 排查方法


生产日志已内置三阶段计数快照，直接对比即可定位：


  [travel] 地图阶段后 { activities, withCoords, legs, taxi, enriched }
  [travel] 重排后     { ... }
  [travel] 返回前     { ... }


判断规则：


1. 三个阶段的 withCoords 与 legs 应保持一致；
   若「地图阶段后」正常而「返回前」为 0，说明中途被覆盖。

2. taxi > 0 但 legs = 0 即为状态污染，一定是覆盖问题。

3. 若「地图阶段后」就是 0，问题在地图增强本身，
   转见「地理编码解析到别的省份」与「QPS 被并发打爆」两节。

================================

# 旅行规划：和风天气的两个坑


## 坑一：不传 lang 会返回当地语言


现象：

中文页面里出现外文天气描述。


实例（实测）：


东京：白天「晴れ」／夜间「曇り」

巴黎：白天「Averses」／夜间「Clair」


原因：

和风天气默认按**查询地点的当地语言**返回天气描述，
必须在请求里显式指定语言。


为什么这个坑隐蔽：


1. 接口返回 200、数据结构完全正常、温度风力都对，
   只有描述文字是外文——不像报错，容易当成正常。

2. 日语里的汉字（如「晴」）与中文形似，
   不细看会以为本来就是中文。


正确做法：

请求带上 lang=zh：


  /weather/v1/daily/{lat}/{lon}?days=10&localTime=true&lang=zh


对应实现：

lib/agents/travel/weather.ts 的 fetchQWeather
注意 localTime=true 同样重要：不加会按 UTC 取日期，
跨时区时可能把行程日期算错一天。


## 坑二：诊断脚本与主代码用了不同的接口


现象：

诊断脚本全部通过，但页面功能异常。


原因：

诊断脚本用的是旧版接口（/v7/weather/7d，按 LocationID 查询），
主代码用的是新版接口（/weather/v1/daily，按经纬度查询）。
两个接口都能返回数据，所以脚本通过——
但它验证的**不是**功能实际走的代码路径。


正确做法：

诊断脚本必须与主代码使用**同一个接口、同一组参数**。
否则诊断结论没有意义。


判断方法：

打开诊断脚本，搜索请求路径，
与 lib/agents/travel/ 下对应模块的请求路径逐字比对。


## 附带发现：和风接口改版记录


| 功能 | 旧接口（已废弃） | 新接口 |
|---|---|---|
| 逐日预报 | /v7/weather/7d?location={id} | /weather/v1/daily/{lat}/{lon} |
| 天气预警 | /v7/warning/now?location={id} | /weatheralert/v1/current/{lat}/{lon} |

旧接口返回 403，错误信息为
`Deprecated —— This API has been deprecated`。
注意这不是权限问题，开权限也解决不了，必须换接口。

预警接口返回 Security Restriction 则确实是权限问题，
需在控制台凭据里勾选「天气预警」。
