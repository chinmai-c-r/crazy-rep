"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile, useSummary } from "@/lib/hooks";
import { fmt } from "@/lib/nutrition";
import type { SummaryRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toLocalDate } from "../_components/LogSheets";
import { Page, PageHeader, SectionTitle } from "../_components/Page";

type Bucket = "day" | "week" | "month";
const RANGES = {
  "7d": { days: 7, bucket: "day" },
  "30d": { days: 30, bucket: "day" },
  "90d": { days: 90, bucket: "week" },
  "1y": { days: 365, bucket: "week" },
  "5y": { days: 1826, bucket: "month" },
} as const satisfies Record<string, { days: number; bucket: Bucket }>;
type RangeKey = keyof typeof RANGES;

const asDate = (bucket: string) => new Date(`${bucket}T00:00`);

function periodLabel(bucket: string, kind: Bucket) {
  const d = asDate(bucket);
  if (kind === "day") return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (kind === "week") return `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}`;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function axisLabel(bucket: string, kind: Bucket, i: number, count: number) {
  const d = asDate(bucket);
  if (kind === "day") return count <= 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : i % 5 === 0 ? `${d.getDate()}` : "";
  if (kind === "week") return i % (count > 20 ? 8 : 3) === 0 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  return i % 6 === 0 ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : "";
}

/** Average per logged day for week/month buckets; the day's total for day buckets. */
const perDay = (r: SummaryRow, v: number, kind: Bucket) => (kind === "day" ? v : r.days_logged ? v / r.days_logged : 0);

export default function HistoryView() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { days, bucket } = RANGES[range];
  const { profile } = useProfile();
  const goal = profile?.calorie_goal ?? 2000;

  const { start, end } = useMemo(() => {
    const today = new Date();
    const first = new Date(today);
    first.setDate(today.getDate() - (days - 1));
    return { start: toLocalDate(first), end: toLocalDate(today) };
  }, [days]);
  const { rows, loading, error } = useSummary(start, end, bucket);

  const stats = useMemo(() => {
    const logged = rows.reduce((s, r) => s + r.days_logged, 0);
    const sum = (k: keyof SummaryRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const weights = rows.filter((r) => r.avg_weight_kg !== null);
    return {
      logged,
      avgKcal: logged ? sum("calories") / logged : 0,
      avgProtein: logged ? sum("protein_g") / logged : 0,
      burned: sum("burned_kcal"),
      weightChange: weights.length > 1 ? weights[weights.length - 1].avg_weight_kg! - weights[0].avg_weight_kg! : null,
    };
  }, [rows]);

  const unit = bucket === "day" ? "" : " (avg per logged day)";

  return (
    <Page>
      <PageHeader eyebrow="Your trends" title="History">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList className="h-11 rounded-full p-1">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <TabsTrigger key={r} value={r} className="rounded-full px-3 sm:px-4">
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Avg calories / day" value={fmt(stats.avgKcal)} unit="kcal" />
        <Tile label="Avg protein / day" value={fmt(stats.avgProtein)} unit="g" />
        <Tile label="Days logged" value={fmt(stats.logged)} unit={`/ ${days}`} />
        <Tile
          label="Weight change"
          value={stats.weightChange === null ? "—" : `${stats.weightChange > 0 ? "+" : ""}${fmt(stats.weightChange, 1)}`}
          unit={stats.weightChange === null ? "" : "kg"}
        />
      </section>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Calories vs goal{unit}</SectionTitle>
          {loading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <BarChart
              goal={goal}
              points={rows.map((r, i) => ({
                key: r.bucket,
                axis: axisLabel(r.bucket, bucket, i, rows.length),
                value: perDay(r, r.calories, bucket),
                tip: `${periodLabel(r.bucket, bucket)} · ${fmt(perDay(r, r.calories, bucket))} kcal${unit ? "/day" : ""} · P ${fmt(perDay(r, r.protein_g, bucket))}g · burned ${fmt(r.burned_kcal)} kcal`,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Weight trend</SectionTitle>
          {loading ? <Skeleton className="h-48 rounded-2xl" /> : <WeightChart rows={rows} kind={bucket} />}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Breakdown{unit}</SectionTitle>
          <Table>
            <TableHeader>
              <TableRow>
                {["Period", "Days", "kcal", "Protein", "Carbs", "Fat", "Burned", "Active", "Water", "Weight"].map((h) => (
                  <TableHead key={h} className="text-xs tracking-wider text-muted-foreground uppercase">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].reverse().map((r) => {
                const empty = !r.days_logged && !r.burned_kcal && r.avg_weight_kg === null && !r.water_ml;
                return (
                  <TableRow key={r.bucket} className={cn(empty && "text-muted-foreground/50")}>
                    <TableCell>{periodLabel(r.bucket, bucket)}</TableCell>
                    <TableCell>{r.days_logged}</TableCell>
                    <TableCell className="font-semibold">{fmt(perDay(r, r.calories, bucket))}</TableCell>
                    <TableCell>{fmt(perDay(r, r.protein_g, bucket))}g</TableCell>
                    <TableCell>{fmt(perDay(r, r.carbs_g, bucket))}g</TableCell>
                    <TableCell>{fmt(perDay(r, r.fat_g, bucket))}g</TableCell>
                    <TableCell>{fmt(r.burned_kcal)}</TableCell>
                    <TableCell>{r.active_min} min</TableCell>
                    <TableCell>{fmt(r.water_ml / 1000, 1)} L</TableCell>
                    <TableCell>{r.avg_weight_kg === null ? "—" : `${fmt(r.avg_weight_kg, 1)} kg`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Page>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card className="gap-1 rounded-2xl px-4 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className="font-heading text-3xl font-normal">
        {value} <small className="font-sans text-xs text-muted-foreground">{unit}</small>
      </b>
    </Card>
  );
}

type Point = { key: string; axis: string; value: number; tip: string };

function BarChart({ points, goal }: { points: Point[]; goal: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(goal * 1.25, ...points.map((p) => p.value)) || 1;

  return (
    <div onMouseLeave={() => setHover(null)}>
      <div className="relative flex h-56 items-end gap-0.5 border-b lg:h-72">
        <div className="pointer-events-none absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-muted-foreground" style={{ top: `${(1 - goal / max) * 100}%` }}>
          <span className="absolute -top-5 right-0 bg-card px-1 text-xs text-muted-foreground">Goal {fmt(goal)}</span>
        </div>
        {points.map((p, i) => (
          <button
            key={p.key}
            className="flex h-full min-w-0 flex-1 items-end justify-center"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            aria-label={p.tip}
          >
            <span
              className={cn(
                "block min-h-0.5 w-full max-w-7 rounded-t bg-primary opacity-85 transition-opacity",
                hover === i && "opacity-100 ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
              style={{ height: `${(p.value / max) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {points.map((p) => (
          <span key={p.key} className="min-w-0 flex-1 overflow-visible text-center text-[0.65rem] whitespace-nowrap text-muted-foreground">
            {p.axis}
          </span>
        ))}
      </div>
      <p className="mt-3 min-h-6 text-sm text-muted-foreground" aria-live="polite">
        {hover !== null ? points[hover].tip : "Hover or tap a bar for details"}
      </p>
    </div>
  );
}

function WeightChart({ rows, kind }: { rows: SummaryRow[]; kind: Bucket }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = rows.map((r, i) => ({ i, r })).filter((p) => p.r.avg_weight_kg !== null);
  if (pts.length === 0) return <p className="text-sm text-muted-foreground">No weigh-ins in this range. Log your weight from the Today screen.</p>;

  const ws = pts.map((p) => p.r.avg_weight_kg!);
  const lo = Math.floor(Math.min(...ws) - 1);
  const hi = Math.ceil(Math.max(...ws) + 1);
  const W = 1000;
  const H = 200;
  const x = (i: number) => (rows.length === 1 ? W / 2 : (i / (rows.length - 1)) * W);
  const y = (w: number) => H - ((w - lo) / (hi - lo)) * H;
  const h = hover === null ? null : pts[hover];

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-48 w-full overflow-visible" role="img" aria-label="Weight trend">
          <polyline
            fill="none"
            stroke="var(--color-chart-4)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            points={pts.map((p) => `${x(p.i)},${y(p.r.avg_weight_kg!)}`).join(" ")}
          />
        </svg>
        {pts.map((p, k) => (
          <button
            key={p.r.bucket}
            className={cn(
              "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-chart-4 transition-transform",
              hover === k && "scale-150",
            )}
            style={{ left: `${(x(p.i) / W) * 100}%`, top: `${(y(p.r.avg_weight_kg!) / H) * 100}%` }}
            onMouseEnter={() => setHover(k)}
            onFocus={() => setHover(k)}
            onClick={() => setHover(k)}
            aria-label={`${periodLabel(p.r.bucket, kind)}: ${fmt(p.r.avg_weight_kg!, 1)} kg`}
          />
        ))}
        <span className="absolute top-0 left-0 text-xs text-muted-foreground">{hi} kg</span>
        <span className="absolute bottom-0 left-0 text-xs text-muted-foreground">{lo} kg</span>
      </div>
      <p className="mt-3 min-h-6 text-sm text-muted-foreground" aria-live="polite">
        {h ? `${periodLabel(h.r.bucket, kind)} · ${fmt(h.r.avg_weight_kg!, 1)} kg${kind === "day" ? "" : " (average)"}` : "Hover or tap a point for details"}
      </p>
    </div>
  );
}
