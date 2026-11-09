"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { foodEmoji } from "@/lib/food-emoji";
import { fmt } from "@/lib/nutrition";
import type { FoodItem } from "@/lib/types";
import { flatRow } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * One typed-in dish ("paneer gravy") that came back as several items, folded into a single card so you can see what belongs to it.
 * Closed, it shows the dish, its total and what's inside; open, the parts (children) slide out under a connecting line.
 */
export default function ItemGroup({
  name,
  items,
  defaultOpen = false,
  onRemove,
  removeDisabled,
  children,
}: {
  name: string;
  items: FoodItem[];
  defaultOpen?: boolean;
  /** Takes the whole dish out of the meal. */
  onRemove?: () => void;
  removeDisabled?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  const [open, setOpen] = useState(defaultOpen);
  const kcal = items.reduce((s, it) => s + it.calories, 0);
  const grams = items.reduce((s, it) => s + it.grams, 0);

  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-muted/30 to-transparent",
        flatRow,
      )}
    >
      <div className="flex items-center gap-1 pr-2 max-sm:pr-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-sm:px-0"
        >
          {/* Overlapping emoji of what's inside */}
          <span className="flex shrink-0 -space-x-3" aria-hidden>
            {items.slice(0, 3).map((it, i) => (
              <span
                key={i}
                className="grid size-9 place-items-center rounded-full border-2 border-card bg-card text-lg shadow-sm sm:size-10 sm:text-xl"
                style={{ zIndex: 3 - i }}
              >
                {foodEmoji(it.name)}
              </span>
            ))}
          </span>
          <span className="grid min-w-0 flex-1">
            <b className="truncate">{name}</b>
            <small className="truncate text-xs text-muted-foreground">
              <span className="font-semibold text-primary">{items.length} items</span>
              {" · "}
              {open ? `${fmt(grams)}g in total` : items.map((it) => it.name).join(", ")}
            </small>
          </span>
          <span className="text-right font-heading text-xl leading-none whitespace-nowrap">
            {fmt(Math.round(kcal))}
            <small className="block font-sans text-[0.65rem] text-muted-foreground">kcal</small>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
        </button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label={`Remove ${name} and its ${items.length} items`}
            onClick={onRemove}
            disabled={removeDisabled}
          >
            <X />
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="parts"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {/* The line down the side ties every part back to the dish */}
            <ul className="relative grid gap-2 pb-3 pl-6 pr-3 max-sm:pr-0 before:absolute before:inset-y-1 before:left-[1.35rem] before:w-px before:rounded-full before:bg-gradient-to-b before:from-primary/50 before:to-transparent">
              {children}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
