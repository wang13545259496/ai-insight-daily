"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (
      pathname.startsWith("/api") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/_next")
    ) {
      return;
    }

    const controller = new AbortController();

    const payload = {
      path: pathname,
      referrer:
        typeof document !== "undefined"
          ? document.referrer || null
          : null,
    };

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      // Analytics failure must never affect page rendering.
    });

    return () => {
      controller.abort();
    };
  }, [pathname]);

  return null;
}
