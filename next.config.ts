import type { NextConfig } from "next";

import { SITE_ALLOW_INDEX } from "./lib/site-indexing";

/**
 * 安全响应头
 * 说明：这里刻意不启用 Content-Security-Policy。
 * Next.js 会注入内联脚本，直接启用严格 CSP 会导致页面白屏，
 * 如需 CSP 请基于 nonce 方案单独实现。
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  /**
   * 请求搜索引擎不要收录。
   *
   * 与 app/robots.ts、layout.tsx 的 robots meta 三重叠加，因为：
   *   · robots.txt 是请求，可被无视
   *   · meta 只对 HTML 页面生效，对 PDF / 图片等资源无效
   *   · 响应头对任意资源都生效，且优先级高于 meta
   *
   * 撤销方式见 layout.tsx 里 robots 字段的注释。
   */
  ...(SITE_ALLOW_INDEX
    ? []
    : [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]),
];

const nextConfig: NextConfig = {
  // 开发期启用严格模式：帮助提前暴露 effect 清理等问题
  reactStrictMode: true,

  // 关闭 X-Powered-By，减少技术栈指纹泄露
  poweredByHeader: false,

  // 构建时执行 TypeScript 类型检查
  typescript: {
    ignoreBuildErrors: false,
  },

  // 说明：typedRoutes 暂未启用。
  // 开启后会把 <Link href={变量}> 全部判为类型错误，
  // 而项目中有 4 处组件用 string 类型的 href（其中部分实为站外链接，
  // 本就不该用 <Link>）。这属于独立的重构项，见 P1 待办。
  // typedRoutes: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  /**
   * 旧的旅行模块路径跳到新路径。
   *
   * 背景：「旅行规划」改名为「AI 出行管家」，路径由 /travel 改为
   * /agent-travel（沿用站内 /agent-score、/agent-map 的命名规律）。
   * 没有这层跳转，之前分享出去的方案链接与用户书签都会失效。
   *
   * 用 permanent: true（308）：路径变更是永久的，且 308 会保留请求方法。
   * 通配符写法用于覆盖 /travel/41、/travel/login 这类子路径，
   * 文档特别提醒 :path* 前的斜杠不能省，否则会被当作字面量。
   */
  async redirects() {
    return [
      {
        source: "/travel",
        destination: "/agent-travel",
        permanent: true,
      },
      {
        source: "/travel/:path*",
        destination: "/agent-travel/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
