"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ProjectDraft } from "@/lib/projects/draft";
import { parseStoredProjects, PROJECTS_EVENT, PROJECTS_KEY, type StoreResult } from "@/lib/projects/storage";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PROJECTS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PROJECTS_EVENT, onChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(PROJECTS_KEY) ?? "";
}

function getServerSnapshot() {
  return "";
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useProjectList(): StoreResult<ProjectDraft[]> {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => parseStoredProjects(raw), [raw]);
}
