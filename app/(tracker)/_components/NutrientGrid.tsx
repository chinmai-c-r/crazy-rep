"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fmt } from "@/lib/nutrition";
import type { Nutrients } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Daily reference values (FDA) for the secondary nutrients. */
export const NUTRIENT_ROWS: { key: keyof Nutrients; label: string; unit: string; daily: number; emoji: string; limit?: boolean }[] = [
  { key: "fiber_g", label: "Fiber", unit: "g", daily: 28, emoji: "🌾" },
  { key: "sugar_g", label: "Sugar", unit: "g", daily: 50, emoji: "🍬", limit: true },
  { key: "saturated_fat_g", label: "Sat. fat", unit: "g", daily: 20, emoji: "🧈", limit: true },
  { key: "sodium_mg", label: "Sodium", unit: "mg", daily: 2300, emoji: "🧂", limit: true },
  { key: "cholesterol_mg", label: "Cholesterol", unit: "mg", daily: 300, emoji: "🥚", limit: true },
];

export default function NutrientGrid({ totals, className }: { totals: Nutrients; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-5", className)}>
      {NUTRIENT_ROWS.map((r, i) => {
        const v = Number(totals[r.key]) || 0;
        const pct = Math.round((v / r.daily) * 100);
        const warn = r.limit && pct > 100;
        return (
          <motion.div
            key={r.key}
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.07 }}
            className={cn("relative grid gap-0.5 overflow-hidden rounded-xl p-3", warn ? "bg-carbs/10 ring-1 ring-carbs/40" : "bg-muted/60")}
          >
            {/* A faint emoji watermark; it takes no space, so the cell keeps its size */}
            <span aria-hidden className="pointer-events-none absolute -top-1 -right-1 rotate-12 text-3xl opacity-[0.12]">
              {r.emoji}
            </span>
            <span className="relative text-xs font-semibold text-foreground/75">{r.label}</span>
            <b className="relative text-lg leading-tight">
              {fmt(v, r.unit === "g" ? 1 : 0)}
              <small className="ml-0.5 text-xs font-semibold text-foreground/65">{r.unit}</small>
            </b>
            <span className={cn("relative text-xs font-semibold text-foreground/75", warn && "text-carbs")}>{pct}% DV</span>
            <span className="relative mt-1 block h-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.span
                className={cn("block h-full origin-left rounded-full", warn ? "bg-gradient-to-r from-carbs to-chart-3" : "bg-gradient-to-r from-primary/60 to-primary")}
                style={{ width: `${Math.min(pct, 100)}%` }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.35 + i * 0.07 }}
              />
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
