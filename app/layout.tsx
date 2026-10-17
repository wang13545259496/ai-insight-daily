import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "AI Insight Daily · AI 产业资讯与智能分析",
    template: "%s",
  },
  description:
    "基于公开信息自动采集与 AI 分析的 AI 产业资讯平台，提供新闻、事件、实体与趋势的结构化视图。",
  applicationName: "AI Insight Daily",
  authors: [{ name: "AI Insight Daily" }],
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
