"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { fmtSleep, movingAverage, scoreLabel, SLEEP_GOAL_MIN, type Night } from "@/lib/sleep";
import { cn } from "@/lib/utils";
import { visibleLabels } from "./charts";
import { STAGES } from "./SleepViews";

const EASE = [0.16, 1, 0.3, 1] as const;
type Bucket = "day" | "week" | "month";

const label = (day: string, bucket: Bucket, count: number) => {
  const d = new Date(`${day}T00:00`);
  if (bucket === "day") return count <= 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : `${d.getDate()}`;
  if (bucket === "week") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
};
const title = (day: string, bucket: Bucket) => {
  const d = new Date(`${day}T00:00`);
  if (bucket === "day") return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (bucket === "week") return `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const stageMin = (n: Night, key: (typeof STAGES)[number]["key"]) => (key === "awake" ? n.awake : (n[key] ?? 0));
const staged = (n: Night) => (n.deep ?? 0) + (n.light ?? 0) + (n.rem ?? 0) > 0;

/**
 * Sleep as stacked bars (deep, light, REM, awake) with a goal line and a glowing seven-night average that rides over them.
 * One bar is always selected (the latest, or whichever you tap) and its numbers sit underneath.
 */
export default function SleepChart({ nights, bucket }: { nights: Night[]; bucket: Bucket }) {
  const reduce = useReducedMotion() ?? false;
  const [picked, setPicked] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = (n: Night) => (staged(n) ? STAGES.reduce((s, st) => s + stageMin(n, st.key), 0) : n.asleep + n.awake);
  const max = Math.max(SLEEP_GOAL_MIN * 1.25, ...nights.map(total));
  const index = Math.min(picked ?? nights.length - 1, nights.length - 1);
  const sel = nights[index];
  const shown = visibleLabels(nights.map((n) => label(n.day, bucket, nights.length)), width);
  const avg = movingAverage(nights.map((n) => n.asleep), bucket === "day" ? 7 : 3);
  const line = avg.map((v, i) => `${((i + 0.5) / nights.length) * 100},${100 - (v / max) * 100}`).join(" ");

  return (
    <div className="grid gap-3">
      <div ref={plot} className="relative h-44">
        <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-foreground/25" style={{ bottom: `${(SLEEP_GOAL_MIN / max) * 100}%` }}>
          <span className="absolute -top-4 left-0 text-[0.6rem] text-muted-foreground">8h goal</span>
        </div>

        <div className="absolute inset-0 flex items-end gap-[3px]">
          {nights.map((n, i) => {
            const on = i === index;
            return (
              <button
                key={n.day}
                type="button"
                onClick={() => setPicked(i)}
                aria-label={`${title(n.day, bucket)}: ${fmtSleep(n.asleep)} asleep`}
                aria-pressed={on}
                className="group flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
              >
                <motion.span
                  className={cn("flex w-full origin-bottom flex-col-reverse overflow-hidden rounded-t-md transition-opacity", on ? "opacity-100 shadow-[0_0_16px_-2px] shadow-chart-4/50" : "opacity-60 group-hover:opacity-90 group-focus-visible:opacity-90")}
                  style={{ height: `${(total(n) / max) * 100}%` }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.8, ease: EASE, delay: Math.min(i * 0.015, 0.5) }}
                >
                  {staged(n) ? (
                    STAGES.map((st) => <i key={st.key} className={st.bar} style={{ height: `${(stageMin(n, st.key) / total(n)) * 100}%` }} />)
                  ) : (
                    <>
                      <i className="bg-chart-4/55" style={{ height: `${(n.asleep / total(n)) * 100}%` }} />
                      <i className="bg-chart-2" style={{ height: `${(n.awake / total(n)) * 100}%` }} />
                    </>
                  )}
                </motion.span>
              </button>
            );
          })}
        </div>

        {nights.length >= 3 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="sleep-avg" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="var(--chart-4)" />
                <stop offset="1" stopColor="var(--primary)" />
              </linearGradient>
            </defs>
            <motion.polyline
              points={line}
              fill="none"
              stroke="url(#sleep-avg)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="drop-shadow-[0_0_6px_var(--chart-4)]"
              // Fades in: animating its length breaks a non-scaling stroke into dashes
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, ease: EASE, delay: 0.5 }}
            />
          </svg>
        )}
      </div>

      <div className="flex gap-[3px]" aria-hidden>
        {nights.map((n, i) => (
          <span key={n.day} className="min-w-0 flex-1 text-center text-[0.65rem] text-muted-foreground">
            {shown.has(i) ? label(n.day, bucket, nights.length) : ""}
          </span>
        ))}
      </div>

      {sel && (
        <div className={cn("grid gap-2 rounded-2xl bg-muted/50 p-3 max-sm:rounded-none max-sm:bg-transparent max-sm:p-0")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{title(sel.day, bucket)}</span>
            <span className="rounded-full bg-chart-4/15 px-2 py-0.5 text-xs font-semibold text-chart-4">
              {sel.score} · {scoreLabel(sel.score)}
            </span>
          </div>
          <p className="flex items-baseline gap-2">
            <b className="font-heading text-3xl leading-none font-normal">{fmtSleep(sel.asleep)}</b>
            <span className="text-xs text-muted-foreground">
              asleep{bucket === "day" ? ` · ${clock(sel.start)} – ${clock(sel.end)}` : " on average"}
            </span>
          </p>
          {staged(sel) && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {STAGES.map((st) => (
                <li key={st.key} className="flex items-center gap-1.5">
                  <i className={cn("size-2 rounded-full", st.bar)} aria-hidden /> {st.label} <b className="text-foreground">{fmtSleep(stageMin(sel, st.key))}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
