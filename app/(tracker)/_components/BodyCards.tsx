"use client";

import { Droplet, Plus, Scale, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { activityIcon, activityLabel } from "@/lib/activities";
import { fmt } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, WaterLog, WeightLog } from "@/lib/types";
import { SectionTitle } from "./Page";

export function ActivityCard({
  activities,
  onAdd,
  onDeleted,
}: {
  activities: ActivityLog[];
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
          <span className="text-sm text-muted-foreground">
            {fmt(burned)} kcal · {minutes} min
          </span>
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
        <Button variant="outline" className="h-11 rounded-full border-dashed" onClick={onAdd}>
          <Plus /> Log activity
        </Button>
      </CardContent>
    </Card>
  );
}

export function WaterCard({
  logs,
  goal,
  day,
  onAdded,
  onRemoved,
}: {
  logs: WaterLog[];
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
          <span className="text-sm text-muted-foreground">goal {fmt(goal)} ml</span>
        </div>
        <p className="flex items-baseline gap-2">
          <Droplet className="size-5 self-center text-chart-4" />
          <b className="font-heading text-4xl font-normal">{fmt(total)}</b>
          <span className="text-sm text-muted-foreground">ml</span>
        </p>
        <Progress value={Math.min((total / goal) * 100, 100)} className="h-2.5 *:data-[slot=progress-indicator]:bg-chart-4" />
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => add(250)}>
            +250 ml
          </Button>
          <Button variant="secondary" className="h-10 flex-1 rounded-full" onClick={() => add(500)}>
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

export function WeightCard({ weights, onAdd }: { weights: WeightLog[]; onAdd: () => void }) {
  const [latest, previous] = weights;
  const delta = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : null;

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Weight</SectionTitle>
          <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">
            Trend →
          </Link>
        </div>
        {latest ? (
          <div>
            <p className="flex items-baseline gap-2">
              <Scale className="size-5 self-center text-muted-foreground" />
              <b className="font-heading text-4xl font-normal">{fmt(latest.weight_kg, 1)}</b>
              <span className="text-sm text-muted-foreground">kg</span>
              {delta !== null && delta !== 0 && (
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
        ) : (
          <p className="text-sm text-muted-foreground">No weigh-ins yet. Log one to see your trend.</p>
        )}
        <Button variant="outline" className="h-11 rounded-full border-dashed" onClick={onAdd}>
          <Plus /> Log weight
        </Button>
      </CardContent>
    </Card>
  );
}
