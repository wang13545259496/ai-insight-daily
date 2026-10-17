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
