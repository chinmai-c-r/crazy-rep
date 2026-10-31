"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MEAL_TYPES, type MealType } from "@/lib/types";

export function MealTypePicker({ value, onChange }: { value: MealType; onChange: (v: MealType) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as MealType)}
      variant="outline"
      className="flex-wrap"
      aria-label="Meal type"
    >
      {MEAL_TYPES.map((t) => (
        <ToggleGroupItem
          key={t.value}
          value={t.value}
          className="h-9 rounded-full! border px-3 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {t.icon} {t.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const step = (d: number) => onChange(Math.min(20, Math.max(0.25, Math.round((value + d) * 4) / 4)));
  return (
    <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-1" aria-label="Servings">
      <Button variant="secondary" size="icon" className="rounded-full" onClick={() => step(value > 1 ? -0.5 : -0.25)} aria-label="Fewer servings">
        <Minus />
      </Button>
      <span className="min-w-24 text-center text-sm font-bold">
        {value}× <small className="font-normal text-muted-foreground">serving</small>
      </span>
      <Button variant="secondary" size="icon" className="rounded-full" onClick={() => step(value >= 1 ? 0.5 : 0.25)} aria-label="More servings">
        <Plus />
      </Button>
    </div>
  );
}
