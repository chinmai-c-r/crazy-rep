"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProfileTab = { id: string; label: string; icon: LucideIcon; /** Something in this tab needs attention. */ alert?: boolean };

/**
 * A sticky bar of tabs with a pill that glides to the active one.
 * Once it reaches the top of the screen it gets a blurred backdrop and clears the phone's status bar.
 */
export function TabBar({ tabs, active, onChange, label = "Profile sections", pillId = "profile-tab-pill" }: { tabs: ProfileTab[]; active: string; onChange: (id: string) => void; label?: string; pillId?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = bar.current;
      if (!el) return;
      // Pinned once it has reached the top (just under the offline banner, if there is one)
      const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--banner-h")) || 0;
      setStuck(el.getBoundingClientRect().top <= banner + 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div
        ref={bar}
        className={cn(
          // -my-2 cancels the bar's own padding, so it sits the same distance from its neighbours as everything else
          "sticky top-[var(--banner-h,0px)] z-30 -mx-4 -my-2 px-4 py-2 transition-[background-color,padding] duration-200 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10",
          stuck && "border-b bg-background/80 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl",
        )}
      >
        <div role="tablist" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-2xl border bg-card/70 p-1 backdrop-blur">
          {tabs.map(({ id, label, icon: Icon, alert }) => {
            const on = id === active;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={on}
                aria-controls={`panel-${id}`}
                onClick={() => onChange(id)}
                className={cn("relative grid h-14 place-content-center justify-items-center gap-0.5 rounded-xl text-[0.7rem] font-semibold transition-colors", on ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {on && (
                  <motion.span
                    layoutId={pillId}
                    className="absolute inset-0 rounded-xl bg-primary/12 ring-1 ring-primary/40 shadow-[0_6px_22px_-10px_rgb(var(--primary-rgb)/0.7)]"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <span className="relative grid justify-items-center gap-0.5">
                  <Icon className="size-5" aria-hidden />
                  {label}
                </span>
                {alert && <i aria-label="Needs attention" className="absolute top-1.5 right-[28%] size-2 rounded-full bg-destructive ring-2 ring-card" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** The content of the active tab, sliding in from the side the tab is on. */
export function TabPanels({ active, dir, children }: { active: string; /** 1 when the new tab is to the right of the old one, -1 when it is to the left. */ dir: 1 | -1; children: React.ReactNode }) {
  const reduce = useReducedMotion() ?? false;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={active}
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        initial={reduce ? false : { opacity: 0, x: 28 * dir }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduce ? undefined : { opacity: 0, x: -28 * dir }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        // min-h: the old tab leaves before the new one arrives, and a page that briefly gets shorter than the screen
        // makes a phone browser show or hide its toolbars, which drags the fixed bottom bar with it
        className="grid min-h-[75dvh] min-w-0 content-start gap-5"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
