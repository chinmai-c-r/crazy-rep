"use client";

import { CalendarCheck, Dumbbell, Flame, Scale, Target, Trophy, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile, useSummary } from "@/lib/hooks";
import { fmt } from "@/lib/nutrition";
import type { SummaryRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CaloriesChart, Donut, MiniBars, WeightLine, type CalPoint } from "../_components/charts";
import { toLocalDate } from "../_components/LogSheets";
import { Page, PageHeader, SectionTitle } from "../_components/Page";
import {
  BarChartSkeleton,
  DonutSkeleton,
  HighlightsSkeleton,
  MiniCardSkeleton,
  STICKY,
  TableRowsSkeleton,
  TileRowSkeleton,
  WeightChartSkeleton,
} from "../_components/Skeletons";
import { Highlight, StatTile } from "../_components/StatTile";

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

const UNIT = { day: "days", week: "weeks", month: "months" } as const;

const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export default function HistoryView() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { days, bucket } = RANGES[range];
  const { profile, loading: profileLoading } = useProfile();
  const goal = profile?.calorie_goal ?? 2000;

  const { start, end } = useMemo(() => {
    const today = new Date();
    const first = new Date(today);
    first.setDate(today.getDate() - (days - 1));
    return { start: toLocalDate(first), end: toLocalDate(today) };
  }, [days]);
  const { rows, loading, error } = useSummary(start, end, bucket);
  const pending = loading || profileLoading;
  const unit = bucket === "day" ? "" : " (avg per logged day)";

  const view = useMemo(() => {
    const sum = (k: keyof SummaryRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const logged = rows.reduce((s, r) => s + r.days_logged, 0);
    const avgKcal = logged ? sum("calories") / logged : 0;
    const avgProtein = logged ? sum("protein_g") / logged : 0;
    const weighed = rows.map((r, slot) => ({ r, slot })).filter((p) => p.r.avg_weight_kg !== null);
    const weightChange = weighed.length > 1 ? weighed[weighed.length - 1].r.avg_weight_kg! - weighed[0].r.avg_weight_kg! : null;

    const active = rows.filter((r) => r.days_logged > 0);
    const onTarget = active.filter((r) => {
      const v = perDay(r, r.calories, bucket);
      return v >= goal * 0.85 && v <= goal * 1.1;
    }).length;
    const peak = active.reduce<SummaryRow | null>((best, r) => (!best || perDay(r, r.calories, bucket) > perDay(best, best.calories, bucket) ? r : best), null);

    const kcalFrom = { protein: sum("protein_g") * 4, carbs: sum("carbs_g") * 4, fat: sum("fat_g") * 9 };
    const kcalTotal = kcalFrom.protein + kcalFrom.carbs + kcalFrom.fat || 1;

    const points: CalPoint[] = rows.map((r, i) => ({
      key: r.bucket,
      axis: axisLabel(r.bucket, bucket, i, rows.length),
      title: periodLabel(r.bucket, bucket),
      kcal: perDay(r, r.calories, bucket),
      protein: perDay(r, r.protein_g, bucket),
      carbs: perDay(r, r.carbs_g, bucket),
      fat: perDay(r, r.fat_g, bucket),
      burned: r.burned_kcal,
    }));

    return {
      logged,
      avgKcal,
      avgProtein,
      weightChange,
      weighed,
      onTarget,
      activeCount: active.length,
      peak,
      points,
      meals: sum("meals"),
      burned: sum("burned_kcal"),
      activeMin: sum("active_min"),
      water: sum("water_ml"),
      avgMacroGrams: { protein: avgProtein, carbs: logged ? sum("carbs_g") / logged : 0, fat: logged ? sum("fat_g") / logged : 0 },
      macroPct: { protein: kcalFrom.protein / kcalTotal, carbs: kcalFrom.carbs / kcalTotal, fat: kcalFrom.fat / kcalTotal },
    };
  }, [rows, bucket, goal]);

  const kcalDelta = view.avgKcal - goal;
  const proteinGoal = profile?.protein_goal_g;
  const firstW = view.weighed[0]?.r.avg_weight_kg;
  const lastW = view.weighed[view.weighed.length - 1]?.r.avg_weight_kg;

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

      {pending ? (
        <TileRowSkeleton />
      ) : (
        <section className="grid animate-in grid-cols-2 gap-3 duration-500 fade-in slide-in-from-bottom-2 sm:grid-cols-4">
          <StatTile
            label="Avg calories / day"
            icon={Flame}
            accent="lime"
            value={fmt(view.avgKcal)}
            unit="kcal"
            sub={
              view.logged ? (
                <span className={cn("font-semibold", Math.abs(kcalDelta) <= goal * 0.1 ? "text-primary" : kcalDelta > 0 ? "text-chart-3" : "text-muted-foreground")}>
                  {kcalDelta > 0 ? "+" : ""}
                  {fmt(kcalDelta)} vs goal
                </span>
              ) : (
                "Nothing logged yet"
              )
            }
          />
          <StatTile
            label="Avg protein / day"
            icon={Dumbbell}
            accent="cyan"
            value={fmt(view.avgProtein)}
            unit="g"
            sub={proteinGoal ? `${fmt((view.avgProtein / proteinGoal) * 100)}% of ${fmt(proteinGoal)}g goal` : "Set a goal in Profile"}
          />
          <StatTile
            label="Days logged"
            icon={CalendarCheck}
            accent="orange"
            value={fmt(view.logged)}
            unit={`/ ${days}`}
            sub={
              <span className="flex h-4 items-center">
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-gradient-to-r from-chart-2 to-primary" style={{ width: `${Math.min((view.logged / days) * 100, 100)}%` }} />
                </span>
              </span>
            }
          />
          <StatTile
            label="Weight change"
            icon={Scale}
            accent="pink"
            value={view.weightChange === null ? "—" : `${view.weightChange > 0 ? "+" : ""}${fmt(view.weightChange, 1)}`}
            unit={view.weightChange === null ? "" : "kg"}
            sub={firstW != null && lastW != null && view.weighed.length > 1 ? `${fmt(firstW, 1)} → ${fmt(lastW, 1)} kg` : "Log two weigh-ins to see change"}
          />
        </section>
      )}

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Calories vs goal{unit}</SectionTitle>
          {pending ? <BarChartSkeleton /> : <CaloriesChart goal={goal} points={view.points} />}
        </CardContent>
      </Card>

      {pending ? (
        <HighlightsSkeleton />
      ) : (
        <section className="grid animate-in grid-cols-3 gap-3 duration-500 fade-in slide-in-from-bottom-2">
          <Highlight
            label="On target"
            icon={Target}
            accent="lime"
            value={view.activeCount ? `${view.onTarget}/${view.activeCount}` : "—"}
            sub={view.activeCount ? `${UNIT[bucket]} near goal` : "No data yet"}
          />
          <Highlight
            label="Peak intake"
            icon={Trophy}
            accent="orange"
            value={view.peak ? fmt(perDay(view.peak, view.peak.calories, bucket)) : "—"}
            sub={view.peak ? periodLabel(view.peak.bucket, bucket).replace("Week of ", "") : "No data yet"}
          />
          <Highlight
            label="Meals"
            icon={UtensilsCrossed}
            accent="pink"
            value={fmt(view.meals)}
            sub={view.logged ? `${fmt(view.meals / view.logged, 1)} per day` : "No data yet"}
          />
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardContent className="grid content-start gap-4">
            <SectionTitle>Macro balance</SectionTitle>
            {pending ? (
              <DonutSkeleton />
            ) : view.logged === 0 ? (
              <p className="text-sm text-muted-foreground">Log a few meals to see how your calories split between protein, carbs and fat.</p>
            ) : (
              <div className="flex items-center gap-5 animate-in duration-500 fade-in">
                <Donut
                  centre={fmt(view.avgKcal)}
                  caption="kcal / day"
                  slices={[
                    { label: "Protein", value: view.macroPct.protein, color: "var(--color-protein)" },
                    { label: "Carbs", value: view.macroPct.carbs, color: "var(--color-carbs)" },
                    { label: "Fat", value: view.macroPct.fat, color: "var(--color-fat)" },
                  ]}
                />
                <ul className="grid min-w-0 flex-1 gap-3">
                  {(
                    [
                      ["Protein", "protein", "bg-protein"],
                      ["Carbs", "carbs", "bg-carbs"],
                      ["Fat", "fat", "bg-fat"],
                    ] as const
                  ).map(([label, key, dot]) => (
                    <li key={key} className="flex items-center gap-2.5 text-sm">
                      <i className={cn("size-2.5 shrink-0 rounded-full", dot)} />
                      <span className="flex-1">{label}</span>
                      <span className="text-right">
                        <b className="block leading-tight">{Math.round(view.macroPct[key] * 100)}%</b>
                        <small className="text-xs text-muted-foreground">{fmt(view.avgMacroGrams[key])}g / day</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="grid content-start gap-4">
            <div className="flex min-h-6 items-center justify-between">
              <SectionTitle>Weight trend</SectionTitle>
              {!pending && view.weightChange !== null && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    view.weightChange <= 0 ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2",
                  )}
                >
                  {view.weightChange > 0 ? "+" : ""}
                  {fmt(view.weightChange, 1)} kg
                </span>
              )}
            </div>
            {pending ? (
              <WeightChartSkeleton />
            ) : view.weighed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No weigh-ins in this range. Log your weight from the Today screen.</p>
            ) : (
              <WeightLine
                kind={bucket}
                slots={rows.length}
                points={view.weighed.map(({ r, slot }) => ({ key: r.bucket, slot, value: r.avg_weight_kg!, title: periodLabel(r.bucket, bucket) }))}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:gap-4">
        <Card className="rounded-3xl">
          <CardContent className="grid content-start gap-3">
            <SectionTitle>Burned</SectionTitle>
            {pending ? (
              <MiniCardSkeleton />
            ) : (
              <>
                <b className="font-heading text-3xl font-normal text-chart-2">
                  {fmt(view.burned)} <small className="font-sans text-xs text-muted-foreground">kcal</small>
                </b>
                <span className="h-4 text-xs leading-4 text-muted-foreground">{view.activeMin ? `${hours(view.activeMin)} active` : "No activity logged"}</span>
                <MiniBars values={rows.map((r) => r.burned_kcal)} from="from-chart-2/40" to="to-chart-2" />
              </>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="grid content-start gap-3">
            <SectionTitle>Water</SectionTitle>
            {pending ? (
              <MiniCardSkeleton />
            ) : (
              <>
                <b className="font-heading text-3xl font-normal text-chart-4">
                  {fmt(view.water / 1000, 1)} <small className="font-sans text-xs text-muted-foreground">L</small>
                </b>
                <span className="h-4 text-xs leading-4 text-muted-foreground">{view.water ? `about ${fmt(view.water / days)} ml a day` : "No water logged"}</span>
                <MiniBars values={rows.map((r) => r.water_ml)} from="from-chart-4/40" to="to-chart-4" />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Breakdown{unit}</SectionTitle>
          <Table>
            <TableHeader>
              <TableRow>
                {["Period", "Days", "kcal", "Protein", "Carbs", "Fat", "Burned", "Active", "Water", "Weight"].map((h, i) => (
                  <TableHead key={h} className={cn("text-xs tracking-wider text-muted-foreground uppercase", i === 0 && STICKY)}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending && <TableRowsSkeleton />}
              {!pending &&
                [...rows].reverse().map((r) => {
                  const empty = !r.days_logged && !r.burned_kcal && r.avg_weight_kg === null && !r.water_ml;
                  const over = perDay(r, r.calories, bucket) > goal * 1.1;
                  return (
                    <TableRow key={r.bucket} className={cn(empty && "text-muted-foreground/50")}>
                      <TableCell className={STICKY}>{periodLabel(r.bucket, bucket)}</TableCell>
                      <TableCell>{r.days_logged}</TableCell>
                      <TableCell className={cn("font-semibold", over && "text-chart-3")}>{fmt(perDay(r, r.calories, bucket))}</TableCell>
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
