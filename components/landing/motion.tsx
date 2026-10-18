import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* One rAF-throttled scroll/resize listener shared by every scroll effect. */

const subscribers = new Set<() => void>();
let ticking = false;

function flush() {
  ticking = false;
  subscribers.forEach((fn) => fn());
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(flush);
}

export function subscribeScroll(fn: () => void) {
  if (subscribers.size === 0) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }
  subscribers.add(fn);
  fn();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
  };
}

/**
 * Writes `--p` (0 → 1) on the element as it scrolls through the viewport.
 * p = 0 when the element's top sits at `start` × viewport height,
 * p = 1 when its bottom reaches `end` × viewport height.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  { start = 0.9, end = 0.55 }: { start?: number; end?: number } = {},
  onProgress?: (p: number) => void,
) {
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.setProperty("--p", "1");
      callback.current?.(1);
      return;
    }
    return subscribeScroll(() => {
      const vh = window.innerHeight;
      const box = el.getBoundingClientRect();
      const span = vh * start - vh * end + box.height;
      const p = Math.min(1, Math.max(0, (vh * start - box.top) / span));
      el.style.setProperty("--p", p.toFixed(4));
      callback.current?.(p);
    });
  }, [ref, start, end]);
}

/** Moves children vertically at a fraction of the scroll speed. */
export function Parallax({ children, speed, className = "" }: { children: ReactNode; speed: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return subscribeScroll(() => {
      const y = Math.min(window.scrollY, window.innerHeight * 1.5);
      el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
    });
  }, [speed]);
  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}

export function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return subscribeScroll(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? (window.scrollY / max).toFixed(4) : 0})`;
    });
  }, []);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]" aria-hidden="true">
      <div ref={ref} className="h-full origin-left bg-gradient-to-r from-brand-light to-brand" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}

export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => subscribeScroll(() => setScrolled(window.scrollY > threshold)), [threshold]);
  return scrolled;
}

/** Fires once when the element first enters the viewport. */
export function useInView<T extends HTMLElement>(ref: RefObject<T | null>, threshold = 0.3) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return inView;
}

export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    setShown(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const begin = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - begin) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

/** Gentle idle float plus mouse parallax (needs `useHeroDrift` on an ancestor). */
export function useHeroDrift(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = root.getBoundingClientRect();
      root.style.setProperty("--px", ((event.clientX - box.left) / box.width - 0.5).toFixed(3));
      root.style.setProperty("--py", ((event.clientY - box.top) / box.height - 0.5).toFixed(3));
    };
    const onLeave = () => {
      root.style.setProperty("--px", "0");
      root.style.setProperty("--py", "0");
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [ref]);
}

export function Drift({
  children,
  amp = "-10px",
  shift = "16px",
  duration = "8s",
  delay = "0s",
  className = "",
}: {
  children: ReactNode;
  amp?: string;
  shift?: string;
  duration?: string;
  delay?: string;
  className?: string;
}) {
  const style = {
    "--amp": amp,
    "--shift": shift,
    animationDuration: duration,
    animationDelay: delay,
  } as CSSProperties;

  return (
    <div className={`drift ${className}`} style={style}>
      <div className="parallax">{children}</div>
    </div>
  );
}

type From = "up" | "left" | "right" | "scale" | "down";

export function Reveal({
  children,
  className = "",
  delay = 0,
  from = "up",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: From;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      // Reveal state depends on the viewer's motion setting, which only exists after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("in");
      return;
    }

    setState("wait");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setState("in");
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const motion = state === "idle" ? "" : "reveal";
  const shown = state === "in" ? "is-in" : "";

  return (
    <Tag
      ref={ref}
      data-from={from}
      className={`${motion} ${shown} ${className}`.trim()}
      style={state === "in" ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
