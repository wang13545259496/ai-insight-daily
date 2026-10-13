"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    name: "首页",
    href: "/",
  },

  {
    name: "AI资讯",
    href: "/news",
  },

  {
    name: "事件中心",
    href: "/events",
  },

  {
    name: "产业趋势",
    href: "/industry",
  },

  {
    name: "Agent生态",
    href: "/agent",
  },

  {
    name: "模型生态",
    href: "/models",
  },

  {
    name: "机会地图",
    href: "/opportunity-map",
  },

  {
    name: "投资观察",
    href: "/investment",
  },

  {
    name: "预测",
    href: "/trend/predict",
  },

  {
    name: "旅行规划",
    href: "/travel",
  },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="
flex
items-center
justify-between
px-10
py-5
border-b
border-gray-800
bg-black
text-white
"
    >
      <Link
        href="/"

        className="
text-2xl
font-bold
tracking-wide
whitespace-nowrap
"
      >
        AI Insight Daily
      </Link>

      <div
        className="
flex
items-center
gap-7
"
      >
        {navItems.map((item) => (
          <Link
            key={item.href}

            href={item.href}

            className={`
text-sm
transition
whitespace-nowrap
${pathname === item.href ? "text-white font-bold" : "text-gray-400"}
hover:text-white
`}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
