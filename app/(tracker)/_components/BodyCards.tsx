"use client";

import { Droplet, Footprints, Plus, Scale, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { activityIcon, activityLabel } from "@/lib/activities";
import { fmt } from "@/lib/nutrition";
import { useOnline } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import { flatRow } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { ActivityLog, WaterLog, WeightLog } from "@/lib/types";
import { Sparkline } from "./charts";
import { SectionTitle } from "./Page";

/** The day's movement outside recorded workouts, imported from Google Health as one entry. */
const daily = (a: ActivityLog) => Boolean(a.google_health_id?.startsWith("daily-active-"));

export function ActivityCard({
  activities,
  loading,
  steps,
  fromGoogle,
  onAdd,
  onDeleted,
}: {
  activities: ActivityLog[];
  loading?: boolean;
  /** Steps for the day from Google Health, when connected */
  steps?: number | null;
  /** Activity comes from Google Health: it's shown, not logged or edited here */
  fromGoogle?: boolean;
  onAdd: () => void;
  onDeleted: (id: string) => void;
}) {
  const online = useOnline();
  const burned = activities.reduce((s, a) => s + Number(a.calories_burned), 0);
  const minutes = activities.filter((a) => !daily(a)).reduce((s, a) => s + a.duration_min, 0);

  async function remove(a: ActivityLog) {
    const { error } = await createClient().from("activity_logs").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    onDeleted(a.id);
    toast.success(`${activityLabel(a.activity)} removed`);
  }

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Activity</SectionTitle>
          {loading ? (
            <Skeleton className="h-5 w-24 rounded" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {fmt(burned)} kcal · {minutes} min
            </span>
          )}
        </div>
        {fromGoogle && (
          <div className="grid gap-1.5">
            <div className="flex items-end justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Footprints className="size-4 text-chart-3" aria-hidden /> Steps
              </span>
              <span className="text-sm text-muted-foreground">
                <b className="font-heading text-2xl font-normal text-foreground">{steps == null ? "–" : fmt(steps)}</b> / {fmt(STEP_GOAL)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuenow={steps ?? 0} aria-valuemax={STEP_GOAL} aria-label="Steps today">
              <div className="h-full rounded-full bg-gradient-to-r from-chart-3 to-chart-2 transition-[width] duration-700" style={{ width: `${Math.min(100, ((steps ?? 0) / STEP_GOAL) * 100)}%` }} />
            </div>
          </div>
        )}
        {activities.length > 0 && (
          <ul className="grid gap-2">
            {activities.map((a) => (
              <li key={a.id} className={cn("flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5", flatRow)}>
                <span className="text-xl">{daily(a) ? "🔥" : activityIcon(a.activity)}</span>
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-sm">{daily(a) ? "Daily activity" : activityLabel(a.activity)}</b>
                  <small className="text-xs text-muted-foreground capitalize">
                    {daily(a) ? "From Google Health" : `${a.duration_min} min · ${a.intensity}`}
                    {a.distance_km ? ` · ${a.distance_km} km` : ""}
                  </small>
                </span>
                <span className="text-sm font-bold whitespace-nowrap">{fmt(a.calories_burned)} kcal</span>
                {!fromGoogle && (
                  <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => remove(a)} disabled={!online} aria-label="Remove activity">
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {fromGoogle ? (
          activities.length === 0 && <p className="text-sm text-muted-foreground">No workouts or activity yet today. It syncs from Google Health when you open the app.</p>
        ) : (
          <Button variant="outline" className="h-11 rounded-full border-dashed" onClick={onAdd} disabled={loading || !online}>
            <Plus /> Log activity
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function WaterCard({
  logs,
  loading,
  goal,
  day,
  onAdded,
  onRemoved,
}: {
  logs: WaterLog[];
  loading?: boolean;
  goal: number;
  day: Date;
  onAdded: (row: WaterLog) => void;
  onRemoved: (id: string) => void;
}) {
  const online = useOnline();
  const total = logs.reduce((s, l) => s + l.ml, 0);

  // Both actions update the screen first and the server after, rolling back with a message if it fails
  async function add(ml: number) {
    const now = new Date();
    const at = new Date(day);
    at.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    const temp: WaterLog = { id: `pending-${crypto.randomUUID()}`, logged_at: at.toISOString(), ml };
    onAdded(temp);
    const { data, error } = await createClient().from("water_logs").insert({ ml, logged_at: temp.logged_at }).select().single();
    onRemoved(temp.id);
    if (error) return toast.error(error.message);
    onAdded(data as WaterLog);
  }

  async function undo() {
    const last = logs[0];
    if (!last || last.id.startsWith("pending-")) return; // still saving: nothing on the server to remove yet
    onRemoved(last.id);
    const { error } = await createClient().from("water_logs").delete().eq("id", last.id);
    if (error) {
      onAdded(last);
      toast.error(error.message);
    }
  }

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Water</SectionTitle>
          {loading ? <Skeleton className="h-5 w-24 rounded" /> : <span className="text-sm text-muted-foreground">goal {fmt(goal)} ml</span>}
        </div>
        <p className={cn("flex gap-2", loading ? "items-center" : "items-baseline")}>
          <Droplet className="size-5 self-center text-chart-4" />
          {loading ? <Skeleton className="h-10 w-20 rounded" /> : <b className="font-heading text-4xl font-normal">{fmt(total)}</b>}
          <span className="text-sm text-muted-foreground">ml</span>
        </p>
        <div className="flex h-2.5 gap-1" role="progressbar" aria-label="Water goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.round((total / goal) * 100), 100)}>
          {Array.from({ length: 10 }, (_, i) => {
            const fill = Math.min(Math.max((total / goal) * 10 - i, 0), 1);
            return (
              <span key={i} className="relative flex-1 overflow-hidden rounded-full bg-muted">
                <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-chart-4/60 to-chart-4 transition-[width] duration-700" style={{ width: `${fill * 100}%` }} />
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => add(250)} disabled={loading || !online}>
            +250 ml
          </Button>
          <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => add(500)} disabled={loading || !online}>
            +500 ml
          </Button>
          <Button variant="ghost" size="icon-lg" className="size-10 rounded-full" onClick={undo} disabled={!logs.length || !online || logs[0].id.startsWith("pending-")} aria-label="Undo last water entry">
            <Undo2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeightCard({ weights, loading, onAdd }: { weights: WeightLog[]; loading?: boolean; onAdd: () => void }) {
  const online = useOnline();
  const [latest, previous] = weights;
  const delta = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : null;
  const trend = [...weights].reverse().map((w) => Number(w.weight_kg));

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Weight</SectionTitle>
          <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">
            Trend →
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-between gap-3">
            <div className="grid h-14 content-between">
              <Skeleton className="h-9 w-36 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <Skeleton className="h-10 w-24 shrink-0 rounded-md" />
          </div>
        ) : latest ? (
          <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2">
              <Scale className="size-5 self-center text-muted-foreground" />
              <b className="font-heading text-4xl font-normal">{fmt(latest.weight_kg, 1)}</b>
              <span className="text-sm text-muted-foreground">kg</span>
              {delta !== null && Math.abs(delta) >= 0.05 && (
                <span className={delta < 0 ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-carbs"}>
                  {delta > 0 ? "+" : ""}
                  {fmt(delta, 1)} kg
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(`${latest.logged_on}T00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {previous ? ` · vs ${new Date(`${previous.logged_on}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
            </p>
          </div>
          {trend.length >= 3 && <Sparkline values={trend} className="h-10 w-24 shrink-0" />}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No weigh-ins yet. Log one to see your trend.</p>
        )}
        <Button variant="outline" className="h-11 rounded-full border-dashed" onClick={onAdd} disabled={loading || !online}>
          <Plus /> Log weight
        </Button>
      </CardContent>
    </Card>
  );
}

const STEP_GOAL = 10_000;
