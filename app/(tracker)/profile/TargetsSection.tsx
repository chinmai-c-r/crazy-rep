"use client";

import { Minus, Plus, Sparkles } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import type { WeightPlan } from "@/lib/weight-plan";
import WeightPlanSummary from "../_components/WeightPlanSummary";
import { SectionTitle } from "../_components/Page";
import NumberField, { type ProfileControl } from "./NumberField";

type Recommended = { bmr: number; tdee: number; calorie_goal: number } | null;

/** Daily targets: a big calorie control, where the macros put those calories, and the rest of the numbers. */
export default function TargetsSection({
  control,
  calc,
  onApply,
  weightPlan,
  target,
  onSafer,
}: {
  control: ProfileControl;
  calc: Recommended;
  onApply: () => void;
  weightPlan: WeightPlan | null;
  target: number | null;
  onSafer: (rate: number) => void;
}) {
  const [kcal, protein, carbs, fat] = useWatch({ control, name: ["calorie_goal", "protein_goal_g", "carbs_goal_g", "fat_goal_g"] });
  const goal = Number(kcal) || 0;

  // Calories from each macro, and how far their total is from the calorie goal
  const parts = [
    { key: "Protein", kcal: (Number(protein) || 0) * 4, bar: "bg-protein", dot: "bg-protein" },
    { key: "Carbs", kcal: (Number(carbs) || 0) * 4, bar: "bg-carbs", dot: "bg-carbs" },
    { key: "Fat", kcal: (Number(fat) || 0) * 9, bar: "bg-fat", dot: "bg-fat" },
  ];
  const total = parts.reduce((s, p) => s + p.kcal, 0);
  const gap = goal ? total - goal : 0;
  const off = goal > 0 && Math.abs(gap) > goal * 0.1;

  return (
    <>
      {calc ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
          <p className="min-w-0 text-sm">
            <span className="block font-semibold">Suggested: {fmt(calc.calorie_goal)} kcal</span>
            <span className="text-xs text-muted-foreground">You burn about {fmt(calc.tdee)} a day</span>
          </p>
          <Button type="button" size="sm" className="shrink-0 rounded-full" onClick={onApply}>
            <Sparkles /> Use
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Fill in sex, age, height and weight on the Body tab to get suggested targets.</p>
      )}

      {/* Re-checked against the calories typed here, so an over-aggressive number is flagged as soon as it's entered */}
      {weightPlan && target && <WeightPlanSummary plan={weightPlan} target={target} onSafer={onSafer} />}

      <Card className="rounded-3xl">
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <SectionTitle>Daily calories</SectionTitle>
          <Controller
            control={control}
            name="calorie_goal"
            render={({ field, fieldState }) => {
              const bump = (d: number) => field.onChange(String(Math.min(10000, Math.max(800, (Number(field.value) || 2000) + d))));
              return (
                <div className="grid justify-items-center gap-1">
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" size="icon-lg" className="size-12 rounded-full" onClick={() => bump(-50)} aria-label="50 fewer calories">
                      <Minus />
                    </Button>
                    <input
                      id="calorie_goal"
                      type="number"
                      inputMode="numeric"
                      value={(field.value as string | number | null) ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Calories per day"
                      aria-invalid={fieldState.invalid}
                      className={cn("w-36 bg-transparent text-center font-heading text-6xl text-primary tabular-nums outline-none", fieldState.invalid && "text-destructive")}
                    />
                    <Button type="button" variant="secondary" size="icon-lg" className="size-12 rounded-full" onClick={() => bump(50)} aria-label="50 more calories">
                      <Plus />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">kcal a day</span>
                  <FieldError errors={[fieldState.error]} />
                </div>
              );
            }}
          />

          {/* Where the macro grams put those calories */}
          <div className="grid gap-2" aria-label="Macro split">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
              {parts.map((p) => (
                <i key={p.key} className={cn("block h-full transition-[width] duration-500", p.bar)} style={{ width: `${total ? (p.kcal / total) * 100 : 0}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              {parts.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-1.5">
                  <i className={cn("size-1.5 rounded-full", p.dot)} />
                  {p.key} {total ? Math.round((p.kcal / total) * 100) : 0}%
                </span>
              ))}
            </div>
            <p className={cn("text-xs", off ? "text-warn" : "text-muted-foreground")}>
              {off
                ? `Your macros add up to ${fmt(total)} kcal, ${fmt(Math.abs(gap))} ${gap > 0 ? "above" : "below"} your calorie goal.`
                : total
                  ? `Your macros add up to ${fmt(total)} kcal.`
                  : "Set your macros below."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <SectionTitle>Macros and water</SectionTitle>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <NumberField control={control} name="protein_goal_g" label="Protein (g)" />
            <NumberField control={control} name="carbs_goal_g" label="Carbs (g)" />
            <NumberField control={control} name="fat_goal_g" label="Fat (g)" />
            <NumberField control={control} name="water_goal_ml" label="Water (ml)" />
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  );
}
