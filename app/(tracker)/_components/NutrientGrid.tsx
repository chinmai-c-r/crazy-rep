import { fmt } from "@/lib/nutrition";
import type { Nutrients } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Daily reference values (FDA) for the secondary nutrients. */
const ROWS: { key: keyof Nutrients; label: string; unit: string; daily: number; limit?: boolean }[] = [
  { key: "fiber_g", label: "Fiber", unit: "g", daily: 28 },
  { key: "sugar_g", label: "Sugar", unit: "g", daily: 50, limit: true },
  { key: "saturated_fat_g", label: "Sat. fat", unit: "g", daily: 20, limit: true },
  { key: "sodium_mg", label: "Sodium", unit: "mg", daily: 2300, limit: true },
  { key: "cholesterol_mg", label: "Cholesterol", unit: "mg", daily: 300, limit: true },
];

export default function NutrientGrid({ totals }: { totals: Nutrients }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {ROWS.map((r) => {
        const v = Number(totals[r.key]) || 0;
        const pct = Math.round((v / r.daily) * 100);
        const warn = r.limit && pct > 100;
        return (
          <div key={r.key} className="grid gap-0.5 rounded-xl bg-muted/60 p-3">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <b className="text-lg leading-tight">
              {fmt(v, r.unit === "g" ? 1 : 0)}
              <small className="ml-0.5 text-xs font-normal text-muted-foreground">{r.unit}</small>
            </b>
            <span className={cn("text-xs text-muted-foreground", warn && "font-semibold text-carbs")}>{pct}% DV</span>
          </div>
        );
      })}
    </div>
  );
}
