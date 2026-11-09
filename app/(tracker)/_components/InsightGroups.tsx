"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Lightbulb } from "lucide-react";
import { useState } from "react";
import type { InsightGroup } from "@/lib/item-qty";
import { cn } from "@/lib/utils";

const tile = "flex gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-3 text-sm";

/**
 * AI insights, bunched like the items: what the AI said about the meal as plain cards, then one fold-out card
 * per dish or item that was added ("Paneer gravy · 2 insights"), so you can tell what each remark is about.
 */
export default function InsightGroups({ groups, className }: { groups: InsightGroup[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-2", className)}>
      {groups.map((g) => (g.label ? <Bunch key={g.label} group={g} label={g.label} /> : <Plain key="meal" insights={g.insights} />))}
    </div>
  );
}

function Plain({ insights }: { insights: string[] }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
      {insights.map((n, i) => (
        <motion.li
          key={n}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
          className={tile}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Lightbulb className="size-4" />
          </span>
          <span className="self-center leading-snug">{n}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function Bunch({ group, label }: { group: InsightGroup; label: string }) {
  const reduce = useReducedMotion() ?? false;
  const [open, setOpen] = useState(true);
  const n = group.insights.length;
  return (
    <motion.div
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-w-0 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-muted/30 to-transparent"
    >
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Lightbulb className="size-4" />
        </span>
        <span className="grid min-w-0 flex-1">
          <b className="truncate text-sm">{label}</b>
          <small className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">
              {n} {n === 1 ? "insight" : "insights"}
            </span>
          </small>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="list"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid gap-2 overflow-hidden pr-3 pb-3 pl-7 before:absolute before:inset-y-1 before:left-[1.1rem] before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-primary/60 before:to-transparent"
          >
            {group.insights.map((t) => (
              <li key={t} className="text-sm leading-snug text-muted-foreground">
                {t}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
