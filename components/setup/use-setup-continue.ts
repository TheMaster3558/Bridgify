"use client";
import { useCallback, useEffect, useRef } from "react";

export type ContinueStateChange = (ready: boolean, proceed: () => void) => void;

// Header navigation and the step's primary button must use the same action.
export function useSetupContinue(
  ready: boolean,
  action: () => void,
  onChange?: ContinueStateChange,
) {
  const latest = useRef({ ready, action });
  useEffect(() => {
    latest.current = { ready, action };
  });
  const proceed = useCallback(() => {
    if (latest.current.ready) latest.current.action();
  }, []);
  useEffect(() => {
    onChange?.(ready, proceed);
  }, [ready, proceed, onChange]);
}
