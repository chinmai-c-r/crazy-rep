"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const PLACE_MAX = 40;
export const PLACES = [
  { label: "Home", icon: "🏠" },
  { label: "Office", icon: "🏢" },
  { label: "Restaurant", icon: "🍽️" },
] as const;

const RECENT_KEY = "meal-places";
const isPreset = (v: string) => PLACES.some((p) => p.label.toLowerCase() === v.trim().toLowerCase());

const readRecent = (): string[] => {
  try {
    const xs: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
};

/** Remembers a typed place (not Home/Office/Restaurant) so it's one tap next time. */
export function rememberPlace(place: string) {
  const p = place.trim();
  if (!p || isPreset(p)) return;
  try {
    const next = [p, ...readRecent().filter((x) => x.toLowerCase() !== p.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/**
 * Where the meal was eaten: Home, Office or Restaurant in one tap, or "Other" to type any name.
 * Places typed before come back as chips. Tap the chosen one again to clear it.
 */
export default function PlacePicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const [other, setOther] = useState(() => value !== "" && !isPreset(value));
  // Read once: this list only changes when a meal is saved
  const [recent] = useState(() => (typeof window === "undefined" ? [] : readRecent()));
  const preset = PLACES.find((p) => p.label.toLowerCase() === value.trim().toLowerCase());
  const typing = other && !preset;
  const input = useRef<HTMLInputElement>(null);

  const pill = (on: boolean) =>
    cn(
      // Phones: four equal tiles, icon over name. Wider screens: one slim line of pills
      "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[0.7rem] font-semibold transition-[background-color,color,box-shadow] duration-300 active:scale-95 sm:h-8 sm:flex-none sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0 sm:text-xs",
      on ? "bg-primary text-primary-foreground shadow-[0_6px_22px_rgb(var(--primary-rgb)/0.35)]" : "text-muted-foreground hover:bg-foreground/5",
    );

  return (
    <div className={cn("grid gap-2", className)}>
      <div role="radiogroup" aria-label="Where did you eat" className="grid grid-cols-4 gap-1 rounded-2xl border bg-muted/40 p-1 backdrop-blur sm:flex sm:rounded-full">
        <span className="hidden flex-none items-center pl-2 text-muted-foreground sm:flex" aria-hidden>
          <MapPin className="size-3.5" />
        </span>
        {PLACES.map((p) => {
          const on = preset?.label === p.label;
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setOther(false);
                onChange(on ? "" : p.label);
              }}
              className={pill(on)}
            >
              <motion.span className="text-xl leading-none sm:text-base" animate={on && !reduce ? { scale: [1, 1.3, 1], rotate: [0, -12, 0] } : { scale: 1 }} transition={{ duration: 0.45 }}>
                {p.icon}
              </motion.span>
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={typing}
          onClick={() => {
            if (typing && value === "") return setOther(false);
            if (preset) onChange("");
            setOther(true);
            // Only when Other is tapped: showing a saved custom place must not pop the keyboard
            if (value === "" || preset) requestAnimationFrame(() => input.current?.focus());
          }}
          className={pill(typing)}
        >
          <Pencil className="size-5 sm:size-3.5" />
          Other
        </button>
      </div>

      <AnimatePresence initial={false}>
        {typing && (
          <motion.div
            key="other"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 p-0.5">
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                maxLength={PLACE_MAX}
                ref={input}
                // The keyboard now covers the lower part of the drawer instead of squeezing it, so bring the box into view once it's up
                onFocus={(e) => {
                  const el = e.currentTarget;
                  setTimeout(() => el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }), 300);
                }}
                // When the keyboard goes down, phones can leave the page scrolled up by its height, which shows as a gap under the drawer
                onBlur={() => setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 50)}
                autoComplete="off"
                enterKeyHint="done"
                aria-label="Place name"
                placeholder="Mom's house, Cafe Coffee Day, Flight…"
                className="h-12 w-full rounded-xl border bg-background/60 px-3.5 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary"
              />
              {recent.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onChange(r)}
                      className={cn("rounded-full border px-2.5 py-1 text-xs", r.toLowerCase() === value.trim().toLowerCase() ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-foreground/5")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
