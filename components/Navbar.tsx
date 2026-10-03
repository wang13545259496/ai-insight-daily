"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    name: "首页",
    href: "/",
  },

  {
    name: "新闻",
    href: "/news",
  },

  {
    name: "事件",
    href: "/events",
  },

  {
    name: "产业",
    href: "/industry",
  },

  {
    name: "Agent",
    href: "/agent",
  },

  {
    name: "模型",
    href: "/models",
  },

  {
    name: "机会",
    href: "/opportunity-map",
  },

  {
    name: "投资",
    href: "/investment",
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
