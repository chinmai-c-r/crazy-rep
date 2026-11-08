"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Moon } from "lucide-react";
import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { averageOf, fmtDelta, fmtSleep, scoreLabel, SLEEP_GOAL_MIN, type Night } from "@/lib/sleep";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** The four stages, in the order they're drawn: colours match the History chart. */
export const STAGES = [
  { key: "deep", label: "Deep", bar: "bg-chart-4", text: "text-chart-4" },
  { key: "light", label: "Light", bar: "bg-chart-4/40", text: "text-chart-4/70" },
  { key: "rem", label: "REM", bar: "bg-chart-3", text: "text-chart-3" },
  { key: "awake", label: "Awake", bar: "bg-chart-2", text: "text-chart-2" },
] as const;

const minutesIn = (n: Night, key: (typeof STAGES)[number]["key"]) => (key === "awake" ? n.awake : (n[key] ?? 0));
const hasStages = (n: Night) => (n.deep ?? 0) + (n.light ?? 0) + (n.rem ?? 0) > 0;
const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00`).toLocaleDateString(undefined, opts);
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** One night as a bar split into its stages. */
export function StageBar({ night, className }: { night: Night; className?: string }) {
  const total = STAGES.reduce((s, st) => s + minutesIn(night, st.key), 0) || 1;
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-full bg-foreground/10", className)} role="img" aria-label="Sleep stages">
      {STAGES.map((st) => (
        <span key={st.key} className={st.bar} style={{ width: `${(minutesIn(night, st.key) / total) * 100}%` }} />
      ))}
    </div>
  );
}

/** The sleep summary while it loads, the same shape as the real one so nothing moves when the numbers arrive. */
export function SleepPeekSkeleton() {
  return (
    <div className="grid min-w-0 flex-1 content-center gap-2 p-2 sm:p-3" aria-hidden>
      <Skeleton className="h-3.5 w-14 rounded" />
      <Skeleton className="h-9 w-24 rounded" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
  );
}

/** A ring that fills to the score, with the number inside. */
export function ScoreRing({ score, size = 112 }: { score: number; size?: number }) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div aria-hidden className="absolute inset-3 rounded-full bg-chart-4/15 blur-xl" />
      <svg viewBox="0 0 100 100" className="relative size-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--chart-3)" />
            <stop offset="1" stopColor="var(--chart-4)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-foreground/10" />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke={`url(#${id}-g)`}
          initial={{ pathLength: reduce ? score / 100 : 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: reduce ? 0 : 1.4, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <b className="font-heading text-3xl leading-none font-normal">{score}</b>
        <small className="text-[0.65rem] text-muted-foreground">of 100</small>
      </div>
    </div>
  );
}

/**
 * The sleep summary that sits beside the calorie ring: last night's time asleep, its stages and how it compares. Tapping it opens the details.
 * Without the permission or without a night yet it says so instead.
 */
export function SleepPeek({
  nights,
  day,
  access,
  problem,
  loading,
  onOpen,
}: {
  nights: Night[];
  day: string;
  access: boolean;
  problem?: string;
  /** The data is still on its way: show the placeholder, not "no sleep yet" */
  loading?: boolean;
  onOpen: () => void;
}) {
  const night = nights.find((n) => n.day === day);
  const before = nights.filter((n) => n.day < day).slice(-7);
  const avg = averageOf(before, (n) => n.asleep);

  const head = (
    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      <Moon className="size-3.5 text-chart-4" aria-hidden /> Sleep
    </span>
  );

  if (!access) {
    return (
      <div className="grid min-w-0 flex-1 content-center gap-1.5">
        {head}
        <p className="text-xs text-muted-foreground">
          <a href="/api/google-health/connect" className="underline underline-offset-4">
            Reconnect Google Health
          </a>{" "}
          and allow sleep to see it here.
        </p>
      </div>
    );
  }
  if (!night && loading) return <SleepPeekSkeleton />;
  if (!night) {
    return (
      <div className="grid min-w-0 flex-1 content-center gap-1.5">
        {head}
        <p className="text-xs text-muted-foreground">{problem ? `Couldn't read sleep: ${problem}` : "No sleep for this day yet. It shows up after your watch syncs."}</p>
      </div>
    );
  }

  const delta = avg === null ? null : night.asleep - avg;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open sleep details"
      className="group grid min-w-0 flex-1 content-center gap-2 rounded-2xl p-2 text-left transition-colors hover:bg-foreground/5 active:scale-[0.98] sm:p-3"
    >
      <span className="flex items-center justify-between gap-1">
        {head}
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <b className="font-heading text-3xl leading-none font-normal sm:text-4xl">{fmtSleep(night.asleep)}</b>
      {hasStages(night) && <StageBar night={night} />}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className="rounded-full bg-chart-4/15 px-2 py-0.5 font-semibold whitespace-nowrap text-chart-4">
          {night.score} · {scoreLabel(night.score)}
        </span>
        {delta !== null && delta !== 0 && (
          <span className={cn("font-semibold", delta > 0 ? "text-primary" : "text-chart-2")}>{fmtDelta(delta)} vs usual</span>
        )}
      </span>
    </button>
  );
}

/** Everything about a night: the score, the stages against your usual, naps and the last week side by side. */
export function SleepSheet({ open, onOpenChange, nights, day }: { open: boolean; onOpenChange: (open: boolean) => void; nights: Night[]; day: string }) {
  const night = nights.find((n) => n.day === day);
  const before = nights.filter((n) => n.day < day).slice(-7);
  const week = night ? [...before, night] : before;
  const avgAsleep = averageOf(before, (n) => n.asleep);
  const max = Math.max(SLEEP_GOAL_MIN * 1.15, ...week.map((n) => n.asleep));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Sleep</DrawerTitle>
          <DrawerDescription>{dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}</DrawerDescription>
        </DrawerHeader>
        {open && night && (
          <div className="grid gap-6 overflow-y-auto px-4 pb-8">
            {/* The night in one look */}
            <section className="flex items-center gap-5">
              <ScoreRing score={night.score} />
              <div className="grid min-w-0 gap-1">
                <p className="text-sm font-semibold text-chart-4">{scoreLabel(night.score)} night</p>
                <b className="font-heading text-4xl leading-none font-normal">{fmtSleep(night.asleep)}</b>
                <p className="text-sm text-muted-foreground">
                  {clock(night.start)} – {clock(night.end)} · {fmtSleep(night.inBed)} in bed
                </p>
                {avgAsleep !== null && (
                  <p className="text-sm">
                    {night.asleep === avgAsleep ? "Same as" : `${fmtSleep(Math.abs(night.asleep - avgAsleep))} ${night.asleep > avgAsleep ? "more" : "less"} than`} your last {before.length}-night average
                  </p>
                )}
              </div>
            </section>

            {/* Stages against your usual */}
            {hasStages(night) && (
              <section className="grid gap-3">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Stages</h3>
                <StageBar night={night} className="h-3" />
                <ul className="grid gap-2.5">
                  {STAGES.map((st) => {
                    const mins = minutesIn(night, st.key);
                    const usual = averageOf(before, (n) => (st.key === "awake" ? n.awake : n[st.key]));
                    const share = Math.round((mins / (night.inBed || 1)) * 100);
                    return (
                      <li key={st.key} className="flex items-center gap-3 text-sm">
                        <i className={cn("size-2.5 shrink-0 rounded-full", st.bar)} aria-hidden />
                        <span className="w-14 shrink-0">{st.label}</span>
                        <b className="w-16 shrink-0 tabular-nums">{fmtSleep(mins)}</b>
                        <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{share}%</span>
                        {usual !== null && mins !== usual && (
                          <span className={cn("ml-auto text-xs font-semibold tabular-nums", st.key === "awake" ? (mins > usual ? "text-chart-2" : "text-primary") : mins > usual ? "text-primary" : "text-chart-2")}>
                            {fmtDelta(mins - usual)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {night.napMin > 0 && <p className="text-sm text-muted-foreground">Plus {fmtSleep(night.napMin)} of naps that day.</p>}

            {/* The last week side by side */}
            {week.length > 1 && (
              <section className="grid gap-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Compared with the nights before</h3>
                  {avgAsleep !== null && <span className="text-xs text-muted-foreground">avg {fmtSleep(avgAsleep)}</span>}
                </div>
                <div className="relative flex h-32 items-end gap-2">
                  <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-foreground/25" style={{ bottom: `${(SLEEP_GOAL_MIN / max) * 100}%` }}>
                    <span className="absolute -top-4 right-0 text-[0.6rem] text-muted-foreground">8h</span>
                  </div>
                  {week.map((n, i) => {
                    const current = n.day === day;
                    return (
                      <div key={n.day} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                        <span className={cn("text-[0.6rem] whitespace-nowrap tabular-nums", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{fmtSleep(n.asleep)}</span>
                        <motion.div
                          className={cn("w-full origin-bottom rounded-t-lg", current ? "bg-gradient-to-t from-chart-3 to-chart-4 shadow-[0_0_18px_-2px] shadow-chart-4/60" : "bg-chart-4/35")}
                          style={{ height: `${(n.asleep / max) * 78}%` }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }}
                        />
                        <span className={cn("text-[0.65rem]", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{dayLabel(n.day, { weekday: "narrow" })}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <p className="text-xs text-muted-foreground">The score is Crazy Rep&apos;s own estimate. How long you slept sets the ceiling (about 8 hours for 100), and how much of your time in bed you were asleep and your deep and REM share decide how much of it you get. It isn&apos;t a medical measure.</p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
