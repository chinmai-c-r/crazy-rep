"use client";

import { Droplet, Plus, Scale, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { activityIcon, activityLabel } from "@/lib/activities";
import { fmt } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ActivityLog, WaterLog, WeightLog } from "@/lib/types";
import { Sparkline } from "./charts";
import { SectionTitle } from "./Page";

export function ActivityCard({
  activities,
  loading,
  onAdd,
  onDeleted,
}: {
  activities: ActivityLog[];
  loading?: boolean;
  onAdd: () => void;
  onDeleted: (id: string) => void;
}) {
  const burned = activities.reduce((s, a) => s + Number(a.calories_burned), 0);
  const minutes = activities.reduce((s, a) => s + a.duration_min, 0);

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
        {activities.length > 0 && (
          <ul className="grid gap-2">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                <span className="text-xl">{activityIcon(a.activity)}</span>
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-sm">{activityLabel(a.activity)}</b>
                  <small className="text-xs text-muted-foreground capitalize">
                    {a.duration_min} min · {a.intensity}
                    {a.distance_km ? ` · ${a.distance_km} km` : ""}
                  </small>
                </span>
                <span className="text-sm font-bold whitespace-nowrap">{fmt(a.calories_burned)} kcal</span>
                <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => remove(a)} aria-label="Remove activity">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="h-11 rounded-full border-dashed" onClick={onAdd} disabled={loading}>
          <Plus /> Log activity
        </Button>
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
  const total = logs.reduce((s, l) => s + l.ml, 0);

  async function add(ml: number) {
    const now = new Date();
    const at = new Date(day);
    at.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    const { data, error } = await createClient().from("water_logs").insert({ ml, logged_at: at.toISOString() }).select().single();
    if (error) return toast.error(error.message);
    onAdded(data as WaterLog);
  }

  async function undo() {
    const last = logs[0];
    if (!last) return;
    const { error } = await createClient().from("water_logs").delete().eq("id", last.id);
    if (error) return toast.error(error.message);
    onRemoved(last.id);
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
          <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => add(250)} disabled={loading}>
            +250 ml
          </Button>
          <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => add(500)} disabled={loading}>
            +500 ml
          </Button>
          <Button variant="ghost" size="icon-lg" className="size-10 rounded-full" onClick={undo} disabled={!logs.length} aria-label="Undo last water entry">
            <Undo2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeightCard({ weights, loading, onAdd }: { weights: WeightLog[]; loading?: boolean; onAdd: () => void }) {
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
        <Button variant="outline" className="h-11 rounded-full border-dashed" onClick={onAdd} disabled={loading}>
          <Plus /> Log weight
        </Button>
      </CardContent>
    </Card>
  );
}
