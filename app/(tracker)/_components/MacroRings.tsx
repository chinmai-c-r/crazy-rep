"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { useRolling } from "./Ring";

const EASE = [0.16, 1, 0.3, 1] as const;

const RINGS = [
  { key: "protein", label: "Protein", dot: "bg-protein", stops: ["var(--protein)", "var(--mid)"] },
  { key: "carbs", label: "Carbs", dot: "bg-carbs", stops: ["var(--warn)", "var(--carbs)"] },
  { key: "fat", label: "Fat", dot: "bg-fat", stops: ["color-mix(in oklab, var(--fat), white 45%)", "var(--fat)"] },
] as const;

function MacroRing({ label, dot, stops, value, goal, delay }: { label: string; dot: string; stops: readonly [string, string]; value: number; goal?: number; delay: number }) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const pct = goal ? value / goal : 0;
  const fill = Math.min(pct, 1);
  const over = goal ? value > goal : false;
  const shownPct = useRolling(Math.round(pct * 100), reduce, 1.2);
  const shownValue = useRolling(value, reduce, 1.2);
  const arc = { cx: 40, cy: 40, r: 32, fill: "none", strokeLinecap: "round" as const };

  return (
    <div className="grid justify-items-center gap-2">
      <div className="relative size-20">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="80" y2="80">
              <stop offset="0" stopColor={stops[0]} />
              <stop offset="1" stopColor={stops[1]} />
            </linearGradient>
            {/* A fixed region around the whole ring, so the glow is never clipped to the arc */}
            <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="120" height="120">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
          </defs>
          <circle {...arc} strokeWidth="8" className="stroke-muted" />
          {fill > 0 && (
            <>
              <motion.circle
                {...arc}
                strokeWidth="11"
                stroke={`url(#${id}-g)`}
                filter={`url(#${id}-glow)`}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={over && !reduce ? { pathLength: fill, opacity: [0.35, 0.8, 0.35] } : { pathLength: fill, opacity: 0.55 }}
                transition={over && !reduce ? { pathLength: { duration: 1.2, ease: EASE, delay }, opacity: { duration: 2.2, repeat: Infinity } } : { duration: 1.2, ease: EASE, delay }}
              />
              <motion.circle {...arc} strokeWidth="8" stroke={`url(#${id}-g)`} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: fill }} transition={{ duration: 1.2, ease: EASE, delay }} />
            </>
          )}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <b className={cn("font-heading text-xl leading-none font-normal", over && "text-destructive")}>
            {goal ? Math.round(shownPct) : fmt(shownValue)}
            <small className="ml-px font-sans text-[0.6rem] text-muted-foreground">{goal ? "%" : "g"}</small>
          </b>
        </div>
      </div>
      <div className="grid justify-items-center">
        <span className="flex items-center gap-1.5 text-sm">
          <i className={cn("size-2 rounded-full", dot)} />
          {label}
        </span>
        <span className="text-xs text-muted-foreground">
          <b className="font-semibold text-foreground">{fmt(shownValue, 1)}g</b>
          {goal ? ` / ${fmt(goal)}g` : ""}
        </span>
      </div>
    </div>
  );
}

/** Three gradient rings that draw in one after another: how much of each macro goal you have eaten. */
export default function MacroRings({ totals, goals }: { totals: { protein_g: number; carbs_g: number; fat_g: number }; goals: { protein?: number | null; carbs?: number | null; fat?: number | null } }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {RINGS.map((r, i) => (
        <MacroRing key={r.key} label={r.label} dot={r.dot} stops={r.stops} value={totals[`${r.key}_g`]} goal={goals[r.key] ?? undefined} delay={0.15 + i * 0.15} />
      ))}
    </div>
  );
}
