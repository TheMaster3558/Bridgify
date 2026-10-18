"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SidebarCounts } from "@/lib/dashboard/sidebar-counts";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

// Keeps the sidebar badges current. The layout passes fresh server counts on
// load and on every router.refresh() (which all task/decision/project changes
// call); on top of that we refetch on navigation, tab focus and a slow poll for
// work created in the background by iMessage automation.
export function useSidebarCounts(
  initial: SidebarCounts | null,
  pathname: string,
) {
  const [counts, setCounts] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (initial && initial !== seen) {
    setSeen(initial);
    setCounts(initial);
  }
  const request = useRef(0);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    const id = ++request.current;
    try {
      const response = await fetch("/api/v1/sidebar-counts", {
        cache: "no-store",
      });
      if (!response.ok || id !== request.current) return;
      const body = await response.json();
      if (id === request.current && body?.data) setCounts(body.data);
    } catch {
      // Keep the last known counts.
    }
  }, []);

  useEffect(() => {
    // Refetch whenever the page changes; the layout itself doesn't re-render
    // on client navigation.
    const kick = setTimeout(() => void refresh(), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const poll = setInterval(() => void refresh(), POLL_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(kick);
      clearInterval(poll);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, refresh]);

  return counts;
}

export function NavCount({
  count,
  active,
  alert = false,
}: {
  count: number | undefined;
  active: boolean;
  alert?: boolean;
}) {
  if (!count) return null;
  return (
    <span
      key={count}
      aria-hidden
      className={cn(
        "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums duration-200 animate-in fade-in zoom-in-75",
        active
          ? "bg-white/20 text-white ring-1 ring-white/30 ring-inset"
          : alert
            ? "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_1px_2px_rgba(225,29,72,0.35)]"
            : "bg-card text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:bg-neutral-700 dark:text-neutral-200 dark:ring-white/10",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
