import type { MetadataRoute } from "next";

import { SITE_ALLOW_INDEX } from "@/lib/site-indexing";

/**
 * robots.txt —— 当前策略：全部禁止抓取。
 *
 * ## 为什么禁止
 *
 * 本站尚未完成 ICP 备案，内容为对公开来源的摘要改写。
 * 在运营主体与合规状态明确之前，不主动向搜索引擎公开 ——
 * 这是维护者的决定。
 *
 * ## 为什么这个决定是可逆的
 *
 * 搜索引擎收录是**不可逆**的：缓存、第三方镜像、Wayback 存档
 * 会长期留存，即使事后删除 sitemap 也撤不回来。
 * 而 noindex / Disallow 只是「请求不要收录」，随时可以撤销。
 *
 * 所以当前状态选择「先不公开」，把选择权保留下来：
 * 想公开时删掉本文件与 layout.tsx 里的 robots 字段即可，不需要回滚任何历史。
 *
 * ## 注意：这不是保密
 *
 * robots.txt 只是请求，不是访问控制。知道域名的人照样能访问。
 * 若要真正的私密，需要 Cloudflare Access 之类的鉴权。
 *
 * ## 关于 Cloudflare 的默认 robots.txt
 *
 * 此前本站 /robots.txt 返回的是 Cloudflare 托管的一段「内容信号」说明，
 * 24 行全是注释、没有任何指令 —— 形同虚设，爬虫默认全部允许。
 * 现在由应用自身返回明确指令，Cloudflare 会透传。
 */
export default function robots(): MetadataRoute.Robots {
  // 开关集中在 lib/site-indexing.ts，默认不允许收录。
  if (SITE_ALLOW_INDEX) {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
