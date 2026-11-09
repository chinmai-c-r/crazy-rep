"use client";

import { Controller } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { goalSchema } from "@/lib/schemas";
import type { Goal } from "@/lib/types";
import { healthyRange, PACES } from "@/lib/weight-plan";
import { SectionTitle } from "../_components/Page";
import { GOAL_LABELS } from "./labels";
import NumberField, { type ProfileControl } from "./NumberField";

const ON = "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

/**
 * Where you're heading and how fast: goal, target weight and pace in one place.
 * Changing the goal or the pace refills the daily targets below, so the two always agree.
 */
export default function WeightGoalCard({
  control,
  goal,
  rate,
  heightCm,
  onGoal,
  onPace,
}: {
  control: ProfileControl;
  goal: Goal;
  rate: number | null;
  heightCm: number | null;
  onGoal: (g: Goal) => void;
  onPace: (rate: number) => void;
}) {
  const paces = goal === "maintain" ? null : PACES[goal];
  return (
    <Card className="rounded-3xl">
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <SectionTitle>Weight goal</SectionTitle>

        <Field>
          <FieldLabel>Goal</FieldLabel>
          <ToggleGroup type="single" variant="outline" value={goal} onValueChange={(v) => v && v !== goal && onGoal(v as Goal)} className="w-full">
            {goalSchema.options.map((g) => (
              <ToggleGroupItem key={g} value={g} className={`h-11 flex-1 px-1 text-sm ${ON}`}>
                {GOAL_LABELS[g]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {!paces ? (
          <p className="text-sm text-muted-foreground">You&apos;re set to maintain your weight. Choose Lose fat or Build muscle to set a target and see how long it takes.</p>
        ) : (
          <>
            <div className="grid gap-1.5">
              <NumberField control={control} name="target_weight_kg" label="Target weight (kg)" decimal />
              {heightCm && (
                <p className="text-xs text-muted-foreground">
                  Healthy for your height: {healthyRange(heightCm).min}–{healthyRange(heightCm).max} kg
                </p>
              )}
            </div>
            <Controller
              control={control}
              name="weekly_rate_kg"
              render={() => (
                <Field>
                  <FieldLabel>How fast?</FieldLabel>
                  <ToggleGroup type="single" variant="outline" value={String(rate)} onValueChange={(v) => v && onPace(Number(v))} className="w-full flex-wrap">
                    {paces.map((p) => (
                      <ToggleGroupItem key={p.rate} value={String(p.rate)} className={`h-auto min-w-24 flex-1 flex-col gap-0 px-1 py-2 text-sm ${ON}`}>
                        <span>{p.label}</span>
                        <small className="text-[0.7rem] opacity-75">{p.rate} kg/wk</small>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="text-xs text-muted-foreground">{paces.find((p) => p.rate === rate)?.hint}</p>
                </Field>
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
