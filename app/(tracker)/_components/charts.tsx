"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ────────────────────────── Calories bar chart ────────────────────────── */

export type CalPoint = {
  key: string;
  axis: string;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  burned: number;
};

/**
 * Bars with a goal line. Bars within reach of the goal are lime to teal, bars well over it turn amber to pink.
 * One bar is always selected (the latest by default) and its numbers sit in the panel below, so the chart never has an empty "tap a bar" state.
 */
/** Which axis labels fit without touching. With 60 bars on a phone, a label is wider than ten bars, so most are skipped. */
function visibleLabels(labels: string[], width: number) {
  const slot = width / Math.max(labels.length, 1);
  const labelPx = Math.max(...labels.map((l) => l.length), 1) * 6.2 + 18; // text-[0.65rem] with room around it
  const step = Math.max(1, Math.ceil(labelPx / slot));
  const shown = new Set<number>();
  // Start at the first bar where a label fits inside the chart, so the left edge isn't left empty
  const first = Math.max(0, Math.ceil(labelPx / 2 / slot - 0.5));
  for (let i = first; i < labels.length; i += step) {
    const centre = (i + 0.5) * slot;
    if (labels[i] && centre >= labelPx / 2 && centre <= width - labelPx / 2) shown.add(i); // fully inside the chart
  }
  return shown;
}

export function CaloriesChart({ points, goal }: { points: CalPoint[]; goal: number }) {
  const reduce = useReducedMotion() ?? false;
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const labelAt = visibleLabels(points.map((p) => p.axis), width);
  const max = Math.max(goal * 1.25, ...points.map((p) => p.kcal)) || 1;
  const latest = (() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].kcal > 0) return i;
    return Math.max(points.length - 1, 0);
  })();
  const active = hover ?? latest;
  const p = points[active];

  return (
    <div className="min-w-0" onMouseLeave={() => setHover(null)}>
      <div ref={plot} className="relative flex h-56 items-end gap-0.5 border-b lg:h-72">
        {[0.25, 0.5, 0.75].map((g) => (
          <i key={g} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-foreground/5" style={{ bottom: `${g * 100}%` }} />
        ))}
        <div className="pointer-events-none absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-foreground/40" style={{ top: `${(1 - goal / max) * 100}%` }}>
          <span className="absolute -top-5 right-0 rounded-full bg-card px-2 text-xs text-muted-foreground">Goal {fmt(goal)}</span>
        </div>
        {points.map((pt, i) => {
          const over = pt.kcal > goal * 1.1;
          return (
            <button
              key={pt.key}
              className="group flex h-full min-w-0 flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${pt.title}: ${fmt(pt.kcal)} kcal`}
            >
              <motion.span
                className={cn(
                  "block min-h-0.5 w-full max-w-7 origin-bottom rounded-t-md bg-gradient-to-t opacity-70 transition-opacity group-hover:opacity-100",
                  over ? "from-chart-2 to-chart-3" : "from-primary/50 to-primary",
                  active === i && "opacity-100 shadow-[0_0_18px_rgb(var(--primary-rgb)/0.35)] ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  active === i && over && "shadow-[0_0_18px_rgb(var(--chart-3-rgb)/0.4)]",
                )}
                style={{ height: `${(pt.kcal / max) * 100}%` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.012, 0.5) }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {points.map((pt, i) => (
          <span key={pt.key} className="min-w-0 flex-1 overflow-visible text-center text-[0.65rem] whitespace-nowrap text-muted-foreground">
            {labelAt.has(i) ? pt.axis : ""}
          </span>
        ))}
      </div>
      <PointPanel point={p} goal={goal} />
    </div>
  );
}

/** Fixed height, so moving between bars never shifts the page. */
export const POINT_PANEL_HEIGHT = "h-[5.5rem]";

function PointPanel({ point, goal }: { point?: CalPoint; goal: number }) {
  if (!point) return <div className={cn("mt-3", POINT_PANEL_HEIGHT)} />;
  const pct = goal ? Math.round((point.kcal / goal) * 100) : 0;
  const cells = [
    { label: "Protein", value: `${fmt(point.protein)}g`, dot: "bg-protein" },
    { label: "Carbs", value: `${fmt(point.carbs)}g`, dot: "bg-carbs" },
    { label: "Fat", value: `${fmt(point.fat)}g`, dot: "bg-fat" },
    { label: "Burned", value: fmt(point.burned), dot: "bg-chart-4" },
  ];
  return (
    <div className={cn("mt-3 grid content-between", POINT_PANEL_HEIGHT)} aria-live="polite">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold">{point.title}</span>
        <span className="shrink-0 text-muted-foreground">
          <b className="font-heading text-lg font-normal text-foreground">{fmt(point.kcal)}</b> kcal · {pct}% of goal
        </span>
      </p>
      <div className="grid grid-cols-4 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl bg-muted/60 px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
              <i className={cn("size-1.5 rounded-full", c.dot)} />
              {c.label}
            </span>
            <b className="text-sm">{c.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── Weight line ───────────────────────────── */

export type WeightPoint = { key: string; value: number; title: string };

/** Smooth path through the points (Catmull-Rom converted to cubic curves). */
function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Weight over time: a glowing curve over a soft gradient, drawn left to right. `slots` is the number of buckets on the x axis. */
export function WeightLine({ points, slots, kind }: { points: (WeightPoint & { slot: number })[]; slots: number; kind: "day" | "week" | "month" }) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = 200;
  const ws = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...ws) - 1);
  const hi = Math.ceil(Math.max(...ws) + 1);
  const x = (slot: number) => (slots === 1 ? W / 2 : (slot / (slots - 1)) * W);
  const y = (w: number) => H - ((w - lo) / (hi - lo)) * H;
  const xy = points.map((p) => ({ x: x(p.slot), y: y(p.value) }));
  const line = smooth(xy);
  const area = xy.length > 1 ? `${line} L${xy[xy.length - 1].x},${H} L${xy[0].x},${H} Z` : "";
  const active = hover ?? points.length - 1;
  const cur = points[active];
  const prev = points[active - 1];
  const delta = cur && prev ? cur.value - prev.value : null;

  return (
    <div onMouseLeave={() => setHover(null)}>
      <div className="relative">
        <motion.div
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-48 w-full overflow-visible" role="img" aria-label="Weight trend">
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-4)" stopOpacity="0.32" />
                <stop offset="1" stopColor="var(--chart-4)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--foreground)" strokeOpacity="0.07" vectorEffect="non-scaling-stroke" />
            ))}
            {area && <path d={area} fill={`url(#${id}-fill)`} />}
            <path
              d={line}
              fill="none"
              stroke="var(--color-chart-4)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="[filter:drop-shadow(0_0_6px_rgb(var(--chart-4-rgb)/0.55))]"
            />
          </svg>
        </motion.div>
        {points.map((p, k) => (
          <button
            key={p.key}
            className={cn(
              "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-chart-4 transition-transform",
              points.length > 45 && k !== active && "opacity-0",
              k === active && "z-10 scale-[1.9] shadow-[0_0_14px_3px_rgb(var(--chart-4-rgb)/0.6)]",
            )}
            style={{ left: `${(xy[k].x / W) * 100}%`, top: `${(xy[k].y / H) * 100}%` }}
            onMouseEnter={() => setHover(k)}
            onFocus={() => setHover(k)}
            onClick={() => setHover(k)}
            aria-label={`${p.title}: ${fmt(p.value, 1)} kg`}
          />
        ))}
        <span className="pointer-events-none absolute top-0 left-0 text-xs text-muted-foreground">{hi} kg</span>
        <span className="pointer-events-none absolute bottom-0 left-0 text-xs text-muted-foreground">{lo} kg</span>
      </div>
      <p className="mt-3 flex min-h-6 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        {cur && (
          <>
            <span className="truncate">{cur.title}</span>
            <b className="font-heading text-lg font-normal text-foreground">{fmt(cur.value, 1)} kg</b>
            {kind !== "day" && <span>(avg)</span>}
            {delta !== null && delta !== 0 && (
              <span className={cn("font-semibold", delta < 0 ? "text-primary" : "text-carbs")}>
                {delta > 0 ? "+" : ""}
                {fmt(delta, 1)}
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/* ─────────────────────────────── Donut ─────────────────────────────── */

export type Slice = { label: string; value: number; color: string };

/** Share of calories from protein, carbs and fat, as a donut that fills in once. */
export function Donut({ slices, centre, caption, className }: { slices: Slice[]; centre: string; caption: string; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 44;
  const C = 2 * Math.PI * R;
  const GAP = 0.012; // gap between slices, as a fraction of the circle
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((sum, x) => sum + x.value / total, 0));

  return (
    <div className={cn("relative size-36 shrink-0", className)}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="14" className="stroke-muted" />
        {slices.map((s, i) => {
          if (!s.value) return null;
          const len = Math.max(s.value / total - GAP, 0) * C;
          return (
            <motion.circle
              key={s.label}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              stroke={s.color}
              initial={reduce ? false : { strokeDasharray: `0 ${C}`, strokeDashoffset: -starts[i] * C }}
              animate={{ strokeDasharray: `${len} ${C}`, strokeDashoffset: -starts[i] * C }}
              transition={{ duration: 0.9, ease: EASE, delay: i * 0.12 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <b className="font-heading text-2xl font-normal min-[440px]:text-3xl">{centre}</b>
        <small className="text-[0.65rem] text-muted-foreground min-[440px]:text-xs">{caption}</small>
      </div>
    </div>
  );
}

/* ───────────────────────────── Mini bars ───────────────────────────── */

/** A compact row of bars for a series (burned calories, water). The tallest is brightest. */
export function MiniBars({ values, className, from, to }: { values: number[]; className?: string; from: string; to: string }) {
  const reduce = useReducedMotion() ?? false;
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex h-14 items-end gap-px", className)} aria-hidden>
      {values.map((v, i) => (
        <motion.i
          key={i}
          className={cn("block min-h-px flex-1 origin-bottom rounded-t-[2px] bg-gradient-to-t", from, to, v === max ? "opacity-100" : "opacity-60")}
          style={{ height: `${(v / max) * 100}%` }}
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: Math.min(i * 0.01, 0.4) }}
        />
      ))}
    </div>
  );
}

/** Tiny trend line with an end dot, for cards. Needs at least two values. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  if (values.length < 2) return null;
  const W = 100;
  const H = 40;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * (W - 6) + 3, y: H - 5 - ((v - lo) / span) * (H - 10) }));
  const line = smooth(pts);
  const end = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chart-4)" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--chart-4)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${end.x},${H} L${pts[0].x},${H} Z`} fill={`url(#${id})`} />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--color-chart-4)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <circle cx={end.x} cy={end.y} r="3" fill="var(--foreground)" />
    </svg>
  );
}
