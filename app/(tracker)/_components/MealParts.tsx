import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { foodEmoji } from "@/lib/food-emoji";
import { fmt } from "@/lib/nutrition";
import type { Meal } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A soft colour per meal type, behind its icon tile. */
const TINTS: Record<string, string> = {
  Breakfast: "from-chart-2/35",
  Lunch: "from-primary/30",
  Dinner: "from-chart-3/35",
  Snack: "from-chart-4/30",
};

/** Section title for a meal type: icon tile on the left, the section's kcal on the right (32px tall in both states). */
export function MealSectionHeader({ icon, label, kcal, loading }: { icon: string; label: string; kcal?: number; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="flex items-center gap-2.5 font-bold">
        <span className={cn("grid size-8 place-items-center rounded-xl bg-gradient-to-br to-transparent text-base ring-1 ring-foreground/10", TINTS[label] ?? "from-muted")} aria-hidden>
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

/** A meal. Still 78px tall: the photo (or food emoji) sets the height, and the macro strip fits beside it. */
export function MealRow({ meal, url, index = 0, onOpen }: { meal: Meal; url?: string; index?: number; onOpen: () => void }) {
  const split = Number(meal.protein_g) * 4 + Number(meal.carbs_g) * 4 + Number(meal.fat_g) * 9 || 1;
  const share = (kcal: number) => `${Math.max((kcal / split) * 100, 2)}%`;
  return (
    <li className="animate-in duration-500 fade-in slide-in-from-left-4 fill-mode-both" style={{ animationDelay: `${index * 70}ms` }}>
      <button
        onClick={onOpen}
        className="group flex w-full items-center gap-3.5 rounded-2xl border bg-card p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-14px_rgb(var(--primary-rgb)/0.4)] active:scale-[0.99]"
      >
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-muted to-card text-3xl ring-1 ring-foreground/5">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {url ? <img src={url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <span className="transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6">{foodEmoji(meal.name)}</span>}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="truncate">{meal.name}</b>
          <small className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Macro dot="bg-protein" value={meal.protein_g} />
            <Macro dot="bg-carbs" value={meal.carbs_g} />
            <Macro dot="bg-fat" value={meal.fat_g} />
          </small>
          {/* Where this meal's calories come from */}
          <span className="mt-1 flex h-1 gap-px overflow-hidden rounded-full" aria-hidden>
            <i className="bg-protein" style={{ width: share(Number(meal.protein_g) * 4) }} />
            <i className="bg-carbs" style={{ width: share(Number(meal.carbs_g) * 4) }} />
            <i className="bg-fat" style={{ width: share(Number(meal.fat_g) * 9) }} />
          </span>
        </span>
        <span className="text-right font-heading text-2xl leading-none">
          <span className="bg-gradient-to-r from-primary to-chart-4 bg-clip-text text-transparent">{fmt(meal.calories)}</span>
          <small className="block font-sans text-[0.7rem] text-muted-foreground">kcal</small>
        </span>
      </button>
    </li>
  );
}

/** The empty meal slot: the same height as a meal row (78px), so nothing jumps when meals load. */
export function EmptyMeal({ href, icon, label, disabled }: { href: string; icon: string; label: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="flex h-[78px] items-center gap-3.5 rounded-2xl border border-dashed p-2.5 opacity-60" aria-disabled>
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-muted/60 text-2xl" aria-hidden>
          {icon}
        </span>
        <span className="grid">
          <b>No {label.toLowerCase()} logged</b>
          <small className="text-xs text-muted-foreground">Logging needs a connection</small>
        </span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="group relative flex h-[78px] items-center gap-3.5 overflow-hidden rounded-2xl border border-dashed p-2.5 transition-all duration-300 hover:border-primary hover:bg-primary/5 hover:shadow-[0_12px_30px_-16px_rgb(var(--primary-rgb)/0.4)] active:scale-[0.99]"
    >
      <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-4 animate-float text-6xl opacity-[0.08] motion-reduce:animate-none">
        {icon}
      </span>
      <span className="relative grid size-14 shrink-0 place-items-center rounded-xl bg-muted/60">
        <i className="absolute inset-2 animate-sonar rounded-full border border-primary/50 motion-reduce:animate-none" />
        <span className="relative grid size-9 place-items-center rounded-full bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-90">
          <Plus className="size-5" />
        </span>
      </span>
      <span className="relative grid">
        <b>Add {label.toLowerCase()}</b>
        <small className="text-xs text-muted-foreground">Snap a photo or type it</small>
      </span>
      <ChevronRight className="relative ml-auto mr-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}
