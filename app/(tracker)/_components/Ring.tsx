"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { Flame, Footprints, Gauge, UtensilsCrossed } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import ScrambleText from "./ScrambleText";
import ShimmerText from "./ShimmerText";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const DURATION = 1.4;

/** Counts from the previous value to the new one, so numbers roll instead of jumping. */
export function useRolling(target: number, reduce: boolean, duration = DURATION) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(from.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [target, reduce, duration]);
  return reduce ? target : shown;
}

const GRADIENTS = {
  ok: ["var(--primary)", "var(--mid)", "var(--chart-4)"],
  over: ["var(--warn)", "var(--chart-2)", "var(--chart-3)"],
};

/** `compact` shrinks it on phones so something can sit beside it (the sleep summary). */
export default function Ring({ value, goal, compact }: { value: number; goal: number; compact?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  const hasValue = value > 0;
  const fill = Math.min(pct, 1);
  const rolling = useRolling(value, reduce);
  const [c0, c1, c2] = over ? GRADIENTS.over : GRADIENTS.ok;
  const remaining = Math.round(goal - rolling);

  const arc = {
    cx: 60,
    cy: 60,
    r: 52,
    fill: "none",
    strokeLinecap: "round" as const,
    initial: { pathLength: 0, opacity: 0 },
    transition: { duration: reduce ? 0 : DURATION, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <div className={cn("relative", compact ? "size-40 sm:size-52" : "size-48 sm:size-52")}>
      {/* Soft halo behind the ring */}
      <div aria-hidden className={cn("absolute inset-4 rounded-full blur-2xl", over ? "bg-destructive/15" : "bg-primary/10")} />

      <svg viewBox="0 0 120 120" className="relative size-full overflow-visible" aria-hidden>
        <defs>
          {/* Declared in the rotated space below: x runs up the screen, so the colour shifts top to bottom */}
          <linearGradient id={`${id}-grad`} gradientUnits="userSpaceOnUse" x1="112" y1="0" x2="8" y2="0">
            <stop offset="0" stopColor={c0} />
            <stop offset="0.55" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          {/* A fixed region covering the whole ring, so the glow is never cut off at the arc's own bounding box */}
          <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x="-30" y="-30" width="180" height="180">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        <g className="origin-center -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
          {/* Dotted inner track that turns very slowly */}
          <g className="origin-center animate-[spin_90s_linear_infinite] motion-reduce:animate-none">
            <circle cx="60" cy="60" r="41" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 3.35" className="text-foreground/20" />
          </g>

          {/* Opacity goes through animate (not style): framer ignores later changes to a plain style value */}
          <motion.circle
            {...arc}
            strokeWidth="14"
            stroke={`url(#${id}-grad)`}
            filter={`url(#${id}-glow)`}
            animate={{ pathLength: fill, opacity: !hasValue ? 0 : over && !reduce ? [0.4, 0.8, 0.4] : 0.6 }}
            transition={{
              pathLength: arc.transition,
              opacity: over && !reduce && hasValue ? { duration: 2.4, repeat: Infinity } : { duration: reduce ? 0 : 0.4 },
            }}
          />
          <motion.circle
            {...arc}
            strokeWidth="10"
            stroke={`url(#${id}-grad)`}
            animate={{ pathLength: fill, opacity: hasValue ? 1 : 0 }}
            transition={{ pathLength: arc.transition, opacity: { duration: reduce ? 0 : 0.3 } }}
          />

          {/* Bright head at the end of the arc */}
          <motion.g
            style={{ transformOrigin: "60px 60px" }}
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: fill * 360, opacity: hasValue ? 1 : 0 }}
            transition={{ rotate: arc.transition, opacity: { duration: reduce ? 0 : 0.3 } }}
          >
            <circle cx="112" cy="60" r="5.5" fill="var(--foreground)" opacity="0.28" />
            <circle cx="112" cy="60" r="2.4" fill="var(--foreground)" />
          </motion.g>
        </g>
      </svg>

      <div className="absolute inset-0 grid place-content-center text-center">
        <b className={cn("font-heading font-normal", compact ? "text-4xl sm:text-5xl" : "text-5xl")}>{fmt(Math.round(rolling))}</b>
        <small className="text-xs text-muted-foreground">of {fmt(goal)} kcal</small>
        <span className={cn("mt-1 text-sm font-semibold", over ? "text-destructive" : "text-primary")}>
          {over ? `${fmt(-remaining)} over` : `${fmt(remaining)} left`}
        </span>
      </div>
    </div>
  );
}

const STATS = [
  { key: "burned", label: "burned", icon: Flame, color: "text-chart-4", anim: "origin-bottom animate-flicker" },
  { key: "net", label: "net kcal", icon: Gauge, color: "text-foreground", anim: "animate-swing" },
  { key: "meals", label: "meals", icon: UtensilsCrossed, color: "text-primary", anim: "animate-wiggle" },
] as const;

const STEPS_STAT = { key: "steps", label: "steps", icon: Footprints, color: "text-chart-3", anim: "animate-wiggle" } as const;

/** 8,412 steps read as "8.4k" so four numbers fit side by side on a phone. */
const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Burned, net and meal count under the ring. The loading state shares this markup so both are the same size. */
export function RingStats({
  burned = 0,
  net = 0,
  meals = 0,
  steps,
  showSteps,
  loading,
}: {
  burned?: number;
  net?: number;
  meals?: number;
  /** Steps for the day from Google Health, or null when there are none yet */
  steps?: number | null;
  /** Whether to show the steps column at all (Google Health connected) */
  showSteps?: boolean;
  loading?: boolean;
}) {
  const values = { burned, net, meals, steps: steps ?? 0 };
  const stats = showSteps ? [...STATS, STEPS_STAT] : STATS;
  return (
    <div className={cn("grid w-full px-4 text-center text-sm [&>*+*]:border-l", showSteps ? "grid-cols-4 px-2" : "grid-cols-3")}>
      {stats.map(({ key, label, icon: Icon, color, anim }, i) => (
        <div key={key} className="grid justify-items-center">
          <b className={cn("flex items-center gap-1.5 font-heading text-2xl font-normal", color)}>
            <Icon className={cn("size-4", loading && `${anim} motion-reduce:animate-none`)} style={loading ? { animationDelay: `${i * 0.2}s` } : undefined} aria-hidden />
            {loading ? <ScrambleText pattern="888" seed={20 + i} /> : key === "steps" ? (steps == null ? "–" : compact(steps)) : fmt(values[key])}
          </b>
          <span className="font-semibold text-foreground/70">{loading ? <ShimmerText delay={i * 0.25}>{label}</ShimmerText> : label}</span>
        </div>
      ))}
    </div>
  );
}
