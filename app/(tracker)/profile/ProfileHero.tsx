"use client";

import { Mail } from "lucide-react";
import { useWatch } from "react-hook-form";
import { DIET_OPTIONS } from "@/lib/diet";
import { fmt } from "@/lib/nutrition";
import type { ProfileControl } from "./NumberField";
import { GOAL_EMOJI, GOAL_LABELS } from "./labels";

/** Who this is and what they're aiming for, at a glance. The chips follow the form as it's edited. */
export default function ProfileHero({ control, savedName, email }: { control: ProfileControl; savedName: string | null; email: string | null }) {
  const [name, goal, diet, kcal] = useWatch({ control, name: ["display_name", "goal", "diet", "calorie_goal"] });
  const shown = String(name || savedName || email || "?").trim();
  const dietOption = DIET_OPTIONS.find((d) => d.id === diet);
  const calories = Number(kcal);

  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card p-4">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-full bg-chart-4/10 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-chart-4 p-[3px]" aria-hidden>
          <span className="grid size-full place-items-center rounded-full bg-card font-heading text-3xl text-primary uppercase">{shown.charAt(0)}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-3xl leading-tight tracking-wide">{shown === email ? "Your profile" : shown}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{email ?? "…"}</span>
          </p>
        </div>
      </div>
      <div className="relative mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        {goal && (
          <span className="rounded-full border bg-background/50 px-2.5 py-1">
            {GOAL_EMOJI[goal as keyof typeof GOAL_EMOJI]} {GOAL_LABELS[goal as keyof typeof GOAL_LABELS]}
          </span>
        )}
        {dietOption && (
          <span className="rounded-full border bg-background/50 px-2.5 py-1">
            {dietOption.emoji} {dietOption.label}
          </span>
        )}
        {calories > 0 && <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">{fmt(calories)} kcal a day</span>}
      </div>
    </section>
  );
}
