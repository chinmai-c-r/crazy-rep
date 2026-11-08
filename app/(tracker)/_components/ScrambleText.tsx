"use client";

import { useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/* One shared clock drives every scrambling number, so a screenful of them costs a single timer. */
let tick = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  timer ??= setInterval(() => {
    tick++;
    listeners.forEach((l) => l());
  }, 240); // calm enough to read as "loading", not as flicker
  return () => {
    listeners.delete(onChange);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** A repeatable pseudo-random digit, so the first render on the server and in the browser match exactly. */
function digit(seed: number, i: number, t: number) {
  let h = Math.imul(seed + 1, 374761393) ^ Math.imul(i + 7, 668265263) ^ Math.imul(t + 13, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 10;
}

/**
 * A stand-in for a number that is still loading: every digit in `pattern` keeps changing, greyed out so it plainly
 * isn't real data. Decorative only (hidden from screen readers); with reduced motion it shows dashes.
 */
export default function ScrambleText({ pattern, seed = 0, className }: { pattern: string; seed?: number; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const t = useSyncExternalStore(subscribe, () => tick, () => 0);
  const text = [...pattern].map((ch, i) => (/\d/.test(ch) ? (reduce ? "–" : String(digit(seed, i, t))) : ch)).join("");
  return (
    <span
      aria-hidden
      className={cn(
        "tabular-nums text-muted-foreground opacity-60",
        className,
      )}
    >
      {text}
    </span>
  );
}
