import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import Footer from "@/components/Footer";
import { SITE_ALLOW_INDEX } from "@/lib/site-indexing";

export const metadata: Metadata = {
  title: {
    default: "AI Insight Daily · AI 产业资讯与智能分析",
    template: "%s",
  },
  description:
    "基于公开信息自动采集与 AI 分析的 AI 产业资讯平台，提供新闻、事件、实体与趋势的结构化视图。",
  applicationName: "AI Insight Daily",
  authors: [{ name: "AI Insight Daily" }],
  /**
   * 当前不向搜索引擎公开。
   *
   * 原因：尚未完成 ICP 备案，运营主体与合规状态未定。
   * 收录不可逆（缓存、镜像、存档会长期留存），而 noindex 是请求，
   * 随时可撤销 —— 因此先选保守一侧，保留选择权。
   *
   * 想公开时：删掉这三行，并删除 app/robots.ts 与 next.config.ts 里的
   * X-Robots-Tag 头即可。
   */
  robots: SITE_ALLOW_INDEX
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  // 站内内容是 AI 生成的聚合分析，明确告知抓取方
  other: {
    "ai-content": "generated",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className="
bg-black
text-white
"
      >
        <Navbar />

        <PageViewTracker />

        {children}

        <Footer />
      </body>
    </html>
  );
}
