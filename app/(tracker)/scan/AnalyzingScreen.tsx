"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Full-screen takeover while a meal is analysed. The server answers in one request, so the steps below
 * narrate the work rather than report real progress: they advance on a timer and the last one waits.
 * Everything animates transform/opacity only, so it stays smooth on phones; reduced motion gets a calm fade.
 */

const PHOTO_STEPS = ["Looking at your plate", "Spotting every food", "Estimating portions", "Crunching the macros"];
const TEXT_STEPS = ["Searching the dish library", "Matching the closest dishes", "Scaling your portion", "Finalising the macros"];
const STEP_MS = 2300;

const FOODS = ["🍛", "🥗", "🍳", "🍜", "🥑", "🍗", "🍕", "🥭", "🍣", "🥐"];

/** Fixed positions so the sparkle field is the same on every render (no random values during render). */
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.45,
}));

const subscribe = () => () => {};

export default function AnalyzingScreen({ preview, name, onCancel }: { preview: string | null; name: string; onCancel: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const mounted = useSyncExternalStore(subscribe, () => true, () => false); // portals need document, which the server doesn't have
  const steps = preview ? PHOTO_STEPS : TEXT_STEPS;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, [steps.length]);

  // Keep the page behind from scrolling under the overlay
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={steps[step]}
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Backdrop preview={preview} reduce={reduce} />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-[env(safe-area-inset-top)]">
        {preview ? <PhotoStage preview={preview} reduce={reduce} /> : <OrbStage reduce={reduce} name={name} />}

        <div className="grid w-full max-w-sm justify-items-center gap-4 text-center">
          <div className="grid h-20 content-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={step}
                className="font-heading text-3xl tracking-wide sm:text-4xl"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14, filter: "blur(6px)" }}
                transition={{ duration: 0.35 }}
              >
                {steps[step]}
                <Dots reduce={reduce} />
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex w-48 gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.span
                  className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-primary to-chart-4"
                  initial={false}
                  animate={{ scaleX: i < step ? 1 : i === step ? 1 : 0, opacity: i === step ? [0.5, 1, 0.5] : 1 }}
                  transition={i === step && !reduce ? { opacity: { duration: 1.2, repeat: Infinity }, scaleX: { duration: 0.5 } } : { duration: 0.5 }}
                />
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Usually just a few seconds</p>
        </div>
      </div>

      <div className="relative z-10 grid place-items-center pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <Button variant="ghost" className="h-11 rounded-full px-5 text-muted-foreground" onClick={onCancel}>
          <X /> Cancel
        </Button>
      </div>
    </motion.div>,
    document.body,
  );
}

/** Drifting colour, sparkles and (for photos) the meal itself, blurred. */
function Backdrop({ preview, reduce }: { preview: string | null; reduce: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL
        <img src={preview} alt="" className="absolute inset-0 size-full scale-125 object-cover opacity-30 blur-3xl" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent,var(--background)_75%)]" />
      <div className="absolute -top-[15%] -left-[20%] size-[75vmax] max-w-[60rem] animate-drift rounded-full bg-primary/15 blur-3xl will-change-transform motion-reduce:animate-none sm:size-[40rem]" />
      <div
        className="absolute -right-[25%] -bottom-[10%] size-[70vmax] max-w-[55rem] animate-drift rounded-full bg-chart-4/15 blur-3xl will-change-transform motion-reduce:animate-none sm:size-[36rem]"
        style={{ animationDirection: "alternate-reverse", animationDuration: "15s" }}
      />
      <div className="absolute top-[40%] left-[35%] size-[45vmax] max-w-[35rem] animate-drift rounded-full bg-chart-3/10 blur-3xl will-change-transform motion-reduce:animate-none sm:size-[24rem]" style={{ animationDuration: "18s" }} />
      {!reduce &&
        SPARKS.map((s, i) => (
          <i
            key={i}
            className="absolute animate-twinkle rounded-full bg-white"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          />
        ))}
    </div>
  );
}

/** The photo in a viewfinder: a laser sweeps it, corners pulse and reticles ping where a detector would look. */
function PhotoStage({ preview, reduce }: { preview: string; reduce: boolean }) {
  const corner = "absolute size-9 border-[3px] border-primary";
  return (
    <motion.div
      className="relative aspect-[4/5] w-[min(78vw,22rem)] overflow-hidden rounded-[2rem] shadow-[0_0_80px_rgb(198_255_0/0.18)] ring-1 ring-white/15"
      style={{ maxHeight: "50dvh" }}
      initial={reduce ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img src={preview} alt="" className="size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
      {/* Faint grid */}
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgb(255_255_255/0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:2.25rem_2.25rem] [mask-image:radial-gradient(closest-side,black,transparent)]" />

      {!reduce && (
        <div className="absolute inset-x-0 top-0 h-[34%] animate-laser will-change-transform">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/35" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary shadow-[0_0_28px_8px_rgb(198_255_0/0.75)]" />
        </div>
      )}

      <div className={cn("absolute inset-[7%]", !reduce && "animate-pulse")}>
        <i className={`${corner} top-0 left-0 rounded-tl-2xl border-r-0 border-b-0`} />
        <i className={`${corner} top-0 right-0 rounded-tr-2xl border-b-0 border-l-0`} />
        <i className={`${corner} bottom-0 left-0 rounded-bl-2xl border-t-0 border-r-0`} />
        <i className={`${corner} right-0 bottom-0 rounded-br-2xl border-t-0 border-l-0`} />
      </div>

      {!reduce &&
        [
          { left: "32%", top: "38%", delay: 0 },
          { left: "66%", top: "52%", delay: 0.9 },
          { left: "44%", top: "70%", delay: 1.7 },
        ].map((p, i) => (
          <span key={i} className="absolute size-12 -translate-x-1/2 -translate-y-1/2" style={{ left: p.left, top: p.top }}>
            <i className="absolute inset-0 animate-sonar rounded-full border-2 border-primary" style={{ animationDelay: `${p.delay}s` }} />
            <i className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_3px_rgb(198_255_0/0.8)]" />
          </span>
        ))}
    </motion.div>
  );
}

/** Text lookups: sonar rings and food orbiting a glowing core, with the dish name beneath. */
function OrbStage({ reduce, name }: { reduce: boolean; name: string }) {
  const rings = [
    { radius: "33%", seconds: 16, foods: FOODS.slice(0, 4), reverse: false },
    { radius: "47%", seconds: 24, foods: FOODS.slice(4), reverse: true },
  ];
  return (
    <div className="grid justify-items-center gap-6">
      <div className="relative size-[min(76vw,19rem)]" style={{ maxHeight: "44dvh", maxWidth: "44dvh" }}>
        {!reduce &&
          [0, 0.93, 1.86].map((d) => (
            <i key={d} className="absolute inset-[22%] animate-sonar rounded-full border border-primary/60" style={{ animationDelay: `${d}s` }} />
          ))}

        {rings.map((ring) => (
          <div key={ring.radius} className="absolute inset-0 grid place-items-center">
            <div className="absolute rounded-full border border-dashed border-white/10" style={{ inset: `calc(50% - ${ring.radius})` }} />
            <div
              className={cn("absolute inset-0", !reduce && "animate-orbit will-change-transform")}
              style={{ animationDuration: `${ring.seconds}s`, animationDirection: ring.reverse ? "reverse" : "normal" }}
            >
              {ring.foods.map((food, i) => {
                const angle = (i / ring.foods.length) * Math.PI * 2;
                return (
                  <span
                    key={food}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${50 + Math.cos(angle) * parseFloat(ring.radius)}%`, top: `${50 + Math.sin(angle) * parseFloat(ring.radius)}%` }}
                  >
                    {/* Turn against the ring so every emoji stays upright */}
                    <span
                      className={cn("block text-3xl drop-shadow-[0_4px_12px_rgb(0_0_0/0.5)]", !reduce && "animate-orbit-rev")}
                      style={{ animationDuration: `${ring.seconds}s`, animationDirection: ring.reverse ? "reverse" : "normal" }}
                    >
                      {food}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        <motion.div
          className="absolute inset-[34%] grid place-items-center rounded-full bg-gradient-to-br from-primary via-[#4dffb0] to-chart-4 shadow-[0_0_70px_rgb(198_255_0/0.5)]"
          animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="size-1/2 text-primary-foreground" strokeWidth={2.2} />
        </motion.div>
      </div>

      {name && (
        <p className="max-w-[80vw] truncate rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
          “{name}”
        </p>
      )}
    </div>
  );
}

/** Three dots that bounce in turn after the status text. */
function Dots({ reduce }: { reduce: boolean }) {
  return (
    <span aria-hidden className="ml-1 inline-flex gap-0.5 align-baseline">
      {[0, 1, 2].map((i) => (
        <motion.i
          key={i}
          className="inline-block text-primary not-italic"
          animate={reduce ? undefined : { opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        >
          .
        </motion.i>
      ))}
    </span>
  );
}
