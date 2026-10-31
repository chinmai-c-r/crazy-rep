"use client";

import { motion } from "framer-motion";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export default function Ring({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  const remaining = Math.round(goal - value);

  return (
    <div className="relative size-48 sm:size-52">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={cn(over ? "stroke-destructive" : "stroke-primary", "drop-shadow-[0_0_8px_rgb(198_255_0/0.5)]")}
          style={{ opacity: value > 0 ? 1 : 0 }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.min(pct, 1) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <b className="font-heading text-5xl font-normal">{fmt(value)}</b>
        <small className="text-xs text-muted-foreground">of {fmt(goal)} kcal</small>
        <span className={cn("mt-1 text-sm font-semibold", over ? "text-destructive" : "text-primary")}>
          {over ? `${fmt(-remaining)} over` : `${fmt(remaining)} left`}
        </span>
      </div>
    </div>
  );
}
