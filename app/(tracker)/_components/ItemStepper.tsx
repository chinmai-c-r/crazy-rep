"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {}
};

/** A quantity pill for one detected item: whole numbers for things you count (dosas), halves for measures (a cup). */
export default function ItemStepper({ name, label, canDown, onStep }: { name: string; label: string; canDown: boolean; onStep: (dir: 1 | -1) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border bg-background/40 p-0.5" role="group" aria-label={`${name} quantity`}>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className="size-7 rounded-full active:scale-90"
        onClick={() => {
          buzz();
          onStep(-1);
        }}
        disabled={!canDown}
        aria-label={`Fewer ${name}`}
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="grid min-w-11 place-items-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.b
            key={label}
            className="font-heading text-lg leading-none font-normal"
            initial={{ y: 10, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {label}
          </motion.b>
        </AnimatePresence>
      </span>
      <Button
        type="button"
        size="icon-sm"
        className="size-7 rounded-full shadow-[0_4px_12px_-3px_rgb(var(--primary-rgb)/0.6)] active:scale-90"
        onClick={() => {
          buzz();
          onStep(1);
        }}
        aria-label={`More ${name}`}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
