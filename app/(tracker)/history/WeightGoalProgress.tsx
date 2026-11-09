"use client";

import { Flag, Target, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { durationText } from "@/lib/weight-plan";
import { SectionTitle } from "../_components/Page";

type Status = { tone: string; text: string };

/** Where you are between where you started and where you're going, and whether your pace matches the plan. */
export default function WeightGoalProgress({
  goal,
  startKg,
  currentKg,
  targetKg,
  plannedRate,
  trendRate,
}: {
  goal: "lose" | "gain";
  startKg: number;
  currentKg: number;
  targetKg: number;
  /** The pace chosen in Profile, kg per week */
  plannedRate: number | null;
  /** Change per week over the range on screen, positive when moving toward the goal; null without enough weigh-ins */
  trendRate: number | null;
}) {
  const losing = goal === "lose";
  const total = Math.abs(startKg - targetKg) || 1;
  const done = losing ? startKg - currentKg : currentKg - startKg;
  const progress = Math.min(1, Math.max(0, done / total));
  const toGo = Math.max(0, losing ? currentKg - targetKg : targetKg - currentKg);
  const reached = toGo < 0.1;

  // Weeks left at the pace you're actually keeping, not the planned one
  const weeksLeft = trendRate && trendRate > 0.02 ? toGo / trendRate : null;
  const left = weeksLeft === null ? null : durationText({ weeks: weeksLeft, months: weeksLeft / 4.345 });

  let status: Status | null = null;
  if (reached) status = { tone: "text-primary", text: "You've reached your goal. Nicely done." };
  else if (trendRate !== null && plannedRate) {
    if (trendRate >= plannedRate * 0.8) status = { tone: "text-primary", text: "On track with your plan." };
    else if (trendRate > 0.02) status = { tone: "text-warn", text: `Slower than planned (${fmt(trendRate, 2)} vs ${plannedRate} kg a week).` };
    else status = { tone: "text-destructive", text: losing ? "Your weight isn't coming down in this range." : "Your weight isn't going up in this range." };
  }

  const Trend = losing ? TrendingDown : TrendingUp;
  return (
    <Card className="rounded-3xl">
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <SectionTitle>Weight goal</SectionTitle>
          <Link href="/profile?tab=targets" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Edit goal
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Started", value: startKg, Icon: Flag, tone: "" },
            { label: "Now", value: currentKg, Icon: Trend, tone: "text-primary" },
            { label: "Goal", value: targetKg, Icon: Target, tone: "" },
          ].map(({ label, value, Icon, tone }) => (
            <div key={label} className="grid gap-0.5 rounded-2xl border bg-card/60 px-1 py-3">
              <b className={cn("font-heading text-2xl font-normal", tone)}>{fmt(value, 1)}</b>
              <span className="flex items-center justify-center gap-1 text-[0.7rem] text-muted-foreground">
                <Icon className="size-3" aria-hidden />
                {label} · kg
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-1.5">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progress to goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span className="block h-full rounded-full bg-gradient-to-r from-chart-2 to-primary transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress * 100)}% there</span>
            <span>{reached ? "Goal reached" : `${fmt(toGo, 1)} kg to go`}</span>
          </p>
        </div>

        <div className="grid gap-1 text-sm">
          {status && <p className={cn("font-semibold", status.tone)}>{status.text}</p>}
          {!reached && left && trendRate !== null && (
            <p className="text-muted-foreground">
              At your current pace of {fmt(trendRate, 2)} kg a week, about <b className="text-foreground">{left}</b> to go.
            </p>
          )}
          {!reached && trendRate === null && <p className="text-muted-foreground">Log a few more weigh-ins across at least a week to see your pace and when you&apos;ll get there.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
