"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
  const option =
    "grid size-8 place-items-center rounded-full text-neutral-500 outline-none transition-colors hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-400";
  const selected =
    "bg-white text-sidebar-foreground shadow-sm dark:bg-neutral-700 dark:text-white";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex w-fit items-center gap-1 rounded-full bg-sidebar-accent p-1"
    >
      <button
        type="button"
        aria-label="Light mode"
        aria-pressed={!dark}
        onClick={() => setTheme("light")}
        className={cn(option, !dark && selected)}
      >
        <Sun aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Dark mode"
        aria-pressed={dark}
        onClick={() => setTheme("dark")}
        className={cn(option, dark && selected)}
      >
        <Moon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
