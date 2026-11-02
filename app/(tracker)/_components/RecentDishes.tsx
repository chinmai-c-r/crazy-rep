"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useRecentDishes } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** One line that scrolls sideways (touch or trackpad), with the scrollbar hidden. py-1/-my-1 keeps focus rings from being clipped. */
const ROW = "-my-1 flex gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Chips for the dishes logged most recently; tap one to fill the meal name. */
export default function RecentDishes({ value, onPick, fallback = [] }: { value: string; onPick: (name: string) => void; fallback?: string[] }) {
  const { dishes: recent, loading } = useRecentDishes();
  // Someone who hasn't logged anything yet gets ideas instead of an empty row
  const dishes = recent.length ? recent : fallback;

  if (loading) {
    return (
      <div className={ROW} aria-hidden>
        {["w-24", "w-32", "w-20", "w-28", "w-24"].map((w, i) => (
          <Skeleton key={i} className={cn("h-8 shrink-0 rounded-full", w)} />
        ))}
      </div>
    );
  }
  if (!dishes.length) return null;

  const typed = value.trim().toLowerCase();
  return (
    <div className={ROW} role="group" aria-label={recent.length ? "Recently logged dishes" : "Meal ideas"}>
      {dishes.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(name)}
          className={cn(
            "h-8 max-w-56 shrink-0 truncate rounded-full border px-3 text-sm whitespace-nowrap transition-colors hover:border-primary/40 active:bg-muted",
            typed === name.toLowerCase() && "border-primary bg-primary/10 text-primary",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
