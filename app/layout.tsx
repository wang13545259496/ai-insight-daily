import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PageViewTracker from "@/components/analytics/PageViewTracker";

export const metadata: Metadata = {
  title: "AI Insight Daily",
  description: "AI资讯与Agent生态平台",
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
      </body>
    </html>
  );
}
