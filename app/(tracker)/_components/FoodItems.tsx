import { Lightbulb, X } from "lucide-react";
import ItemGroup from "./ItemGroup";
import ItemStepper from "./ItemStepper";
import { groupRuns } from "@/lib/item-qty";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/nutrition";
import { flatRow } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { FoodItem } from "@/lib/types";

export function FoodItemList({ items, onRemove }: { items: FoodItem[]; onRemove?: (index: number) => void }) {
  return (
    <ul className="grid gap-2">
      {items.map((it, i) => (
        <li key={i} className={cn("flex items-center gap-3 rounded-xl bg-muted/60 px-3.5 py-3", flatRow)}>
          <div className="grid min-w-0 flex-1">
            <b className="truncate">{it.name}</b>
            <small className="text-xs text-muted-foreground">
              {it.portion} · {fmt(it.grams)}g · P {fmt(it.protein_g)} C {fmt(it.carbs_g)} F {fmt(it.fat_g)}
            </small>
          </div>
          <span className="font-bold whitespace-nowrap">{fmt(it.calories)} kcal</span>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${it.name}`}
              onClick={() => onRemove(i)}
              disabled={items.length === 1}
            >
              <X />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Detected items of a logged meal, each with a quantity stepper. `meta[i]` is the quantity shown and whether it can go lower. */
export function EditableItemList({ items, meta, onStep, onRemove, canRemove, disabled, openGroup }: { disabled?: boolean; onRemove?: (index: number) => void; canRemove?: (index: number) => boolean; items: FoodItem[]; meta: { label: string; canDown: boolean }[]; onStep: (index: number, dir: 1 | -1) => void; /** Whether the dish that starts at this index opens by default (new ones do, saved ones start folded). */ openGroup?: (index: number) => boolean }) {
  const row = (it: FoodItem, i: number) => (
    <li key={i} className={cn("grid gap-2.5 rounded-xl bg-muted/60 px-3.5 py-3", flatRow)}>
      <div className="flex items-center gap-3">
        <div className="grid min-w-0 flex-1">
          <b className="truncate">{it.name}</b>
          <small className="text-xs text-muted-foreground">
            {it.portion} · {fmt(it.grams)}g · P {fmt(it.protein_g)} C {fmt(it.carbs_g)} F {fmt(it.fat_g)}
          </small>
        </div>
        <span className="font-bold whitespace-nowrap">{fmt(it.calories)} kcal</span>
        {onRemove && canRemove?.(i) && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${it.name}`}
            onClick={() => onRemove(i)}
            disabled={disabled}
          >
            <X />
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Quantity</span>
        <ItemStepper disabled={disabled} name={it.name} label={meta[i]?.label ?? "1"} canDown={meta[i]?.canDown ?? false} onStep={(dir) => onStep(i, dir)} />
      </div>
    </li>
  );

  return (
    <ul className="grid gap-2">
      {groupRuns(items).map((run) => {
        if (!run.group || run.indexes.length < 2) return run.indexes.map((i) => row(items[i], i));
        return (
          <ItemGroup
            key={`group-${run.indexes[0]}`}
            name={run.group}
            items={run.indexes.map((i) => items[i])}
            defaultOpen={openGroup?.(run.indexes[0]) ?? false}
            // Last one first, so the earlier positions don't shift while they go
            onRemove={onRemove && run.indexes.every((i) => canRemove?.(i)) ? () => [...run.indexes].reverse().forEach((i) => onRemove(i)) : undefined}
            removeDisabled={disabled}
          >
            {run.indexes.map((i) => row(items[i], i))}
          </ItemGroup>
        );
      })}
    </ul>
  );
}

export function Insights({ insights }: { insights: string[] }) {
  return (
    <ul className="grid gap-2">
      {insights.map((n) => (
        <li key={n} className="flex gap-2 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
          {n}
        </li>
      ))}
    </ul>
  );
}
