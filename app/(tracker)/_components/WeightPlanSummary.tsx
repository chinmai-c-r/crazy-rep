"use client";

import { AlertTriangle, CalendarCheck, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { durationText, finishOn, type Level, type WeightPlan } from "@/lib/weight-plan";
import { cn } from "@/lib/utils";

const TONE: Record<Level, { box: string; icon: typeof CheckCircle2; text: string }> = {
  ok: { box: "border-primary/25 bg-primary/5", icon: CheckCircle2, text: "text-primary" },
  caution: { box: "border-warn/40 bg-warn/10", icon: AlertTriangle, text: "text-warn" },
  danger: { box: "border-destructive/40 bg-destructive/10", icon: ShieldAlert, text: "text-destructive" },
};

/** How long the goal takes at this pace, and a plain warning when the plan is too aggressive. */
export default function WeightPlanSummary({
  plan,
  target,
  onSafer,
}: {
  plan: WeightPlan;
  target: number;
  /** Switches to the gentler pace; the button shows only when there is one */
  onSafer?: (rate: number) => void;
}) {
  const duration = durationText(plan);
  return (
    <div className="grid gap-3">
      {duration && plan.weeks !== null && (
        <div className="flex items-center gap-4 rounded-2xl border bg-card px-4 py-3">
          <CalendarCheck className="size-7 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 text-sm">
            <b className="block font-heading text-2xl leading-tight font-normal">{duration}</b>
            <span className="text-muted-foreground">
              to reach {target} kg by {finishOn(plan.weeks)}, at about {plan.rate.toFixed(2).replace(/0$/, "")} kg a week
            </span>
          </p>
        </div>
      )}
      {plan.notes.map((n) => {
        const tone = TONE[n.level];
        const Icon = tone.icon;
        return (
          <p key={n.text} role={n.level === "ok" ? undefined : "alert"} className={cn("flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm", tone.box)}>
            <Icon className={cn("mt-0.5 size-4 shrink-0", tone.text)} aria-hidden />
            <span>{n.text}</span>
          </p>
        );
      })}
      {plan.saferRate !== null && onSafer && (
        <Button type="button" variant="outline" className="rounded-full" onClick={() => onSafer(plan.saferRate!)}>
          Switch to a safer pace ({plan.saferRate} kg a week)
        </Button>
      )}
    </div>
  );
}
