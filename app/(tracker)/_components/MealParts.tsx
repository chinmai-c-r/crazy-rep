import { UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmt } from "@/lib/nutrition";
import type { Meal, MealType } from "@/lib/types";

/** Section title for a meal type: icon tile on the left, the section's kcal on the right (32px tall in both states). */
export function MealSectionHeader({ icon, label, kcal, loading }: { icon: string; label: string; kcal?: number; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="flex items-center gap-2.5 font-bold">
        <span className="grid size-8 place-items-center rounded-xl bg-muted text-base" aria-hidden>
          {icon}
        </span>
        {label}
      </h2>
      {loading ? (
        <Skeleton className="h-5 w-16 rounded-full" />
      ) : (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{fmt(kcal ?? 0)} kcal</span>
      )}
    </div>
  );
}

const Macro = ({ dot, value }: { dot: string; value: number }) => (
  <span className="inline-flex items-center gap-1">
    <i className={`size-1.5 rounded-full ${dot}`} />
    {fmt(value)}g
  </span>
);

export function MealRow({ meal, url, onOpen }: { meal: Meal; url?: string; onOpen: () => void }) {
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3.5 rounded-2xl border bg-card p-2.5 text-left transition-all hover:border-primary/40 active:scale-[0.99]"
      >
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {url ? <img src={url} alt="" className="size-full object-cover" /> : <UtensilsCrossed className="size-5 text-muted-foreground" />}
        </span>
        <span className="grid min-w-0 flex-1">
          <b className="truncate">{meal.name}</b>
          <small className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Macro dot="bg-protein" value={meal.protein_g} />
            <Macro dot="bg-carbs" value={meal.carbs_g} />
            <Macro dot="bg-fat" value={meal.fat_g} />
          </small>
        </span>
        <span className="text-right font-heading text-2xl leading-none">
          {fmt(meal.calories)}
          <small className="block font-sans text-[0.7rem] text-muted-foreground">kcal</small>
        </span>
      </button>
    </li>
  );
}

export type { MealType };
