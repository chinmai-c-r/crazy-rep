import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { CalendarCheck, Dumbbell, Flame, Scale, Target, Trophy, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { flatTile } from "@/lib/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleStatus, useStepsEnabled } from "@/lib/hooks";
import { MEAL_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GRID, NUTRIENT_ROWS, tileSpan } from "./NutrientGrid";
import { Page, PageHeader, SectionTitle } from "./Page";
import { MealSectionHeader } from "./MealParts";
import ScrambleText from "./ScrambleText";
import ShimmerText from "./ShimmerText";
import { RingStats } from "./Ring";
import { Highlight, StatTile, type Accent } from "./StatTile";

/*
 * Every block below mirrors the box model of the real component it stands in for
 * (same wrappers, paddings, line heights and control heights), so content replaces it without a layout shift.
 * Static text (titles, labels) is rendered for real; only data-driven values are skeletons.
 */

/** Skeleton for a line of text: pass the line height as `h-*` (text-xs 16px = h-4, text-sm 20px = h-5). */
const Line = ({ className }: { className?: string }) => <Skeleton className={cn("rounded", className)} />;

/* ---------- Dashboard ---------- */

/** A bright arc that circles a track, like the real ring waiting for its number. `size` is the viewBox side, `stroke` its stroke width. */
function CometRing({ size, stroke, seconds = 2.4, delay = 0 }: { size: number; stroke: number; seconds?: number; delay?: number }) {
  const id = useId();
  const c = size / 2;
  const r = c - stroke / 2;
  const arc = { cx: c, cy: c, r, fill: "none", strokeLinecap: "round" as const, strokeDasharray: `${r * 1.5} ${r * 8}` };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="relative size-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="0.55" stopColor="var(--mid)" />
          <stop offset="1" stopColor="var(--chart-4)" />
        </linearGradient>
        <filter id={`${id}-b`} filterUnits="userSpaceOnUse" x={-size / 3} y={-size / 3} width={size * 1.66} height={size * 1.66}>
          <feGaussianBlur stdDeviation={stroke * 0.5} />
        </filter>
      </defs>
      <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
      <g className="origin-center animate-spin motion-reduce:animate-none" style={{ animationDuration: `${seconds}s`, animationDelay: `${delay}s` }}>
        <circle {...arc} strokeWidth={stroke * 1.35} stroke={`url(#${id}-g)`} filter={`url(#${id}-b)`} opacity="0.7" />
        <circle {...arc} strokeWidth={stroke} stroke={`url(#${id}-g)`} />
      </g>
    </svg>
  );
}

export function RingCardSkeleton() {
  const showSteps = useStepsEnabled(); // same column count as the real card
  const beside = Boolean(useGoogleStatus()?.connected); // and the same room for the sleep summary
  return (
    <Card className="relative items-center justify-center gap-4 rounded-3xl py-8">
      <div className="flex w-full items-center justify-center gap-3 px-4 sm:gap-6">
        <div className={cn("relative shrink-0", beside ? "size-40 sm:size-52" : "size-48 sm:size-52")} aria-hidden>
          {/* A halo that breathes behind the ring, like the static one on the real card */}
          <div className="absolute inset-4 animate-pulse rounded-full bg-primary/15 blur-2xl motion-reduce:animate-none" />
          <CometRing size={120} stroke={10} />
          {/* The same three lines as the real ring, as scrambling text */}
          <div className="absolute inset-0 grid place-content-center text-center">
            <b className={cn("font-heading font-normal", beside ? "text-4xl sm:text-5xl" : "text-5xl")}>
              <ScrambleText pattern="888" seed={1} />
            </b>
            <small className="text-xs">
              <ScrambleText pattern="of 8,888 kcal" seed={2} />
            </small>
            <span className="mt-1 text-sm font-semibold">
              <ScrambleText pattern="8,888 left" seed={3} />
            </span>
          </div>
        </div>
        {beside && (
          <div className="grid min-w-0 flex-1 content-center gap-2 p-2" aria-hidden>
            <Skeleton className="h-3.5 w-14 rounded" />
            <Skeleton className="h-9 w-24 rounded" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        )}
      </div>
      <RingStats loading showSteps={showSteps} />
    </Card>
  );
}

const MACROS = [
  { label: "Protein", dot: "bg-protein" },
  { label: "Carbs", dot: "bg-carbs" },
  { label: "Fat", dot: "bg-fat" },
];

export function MacrosCardSkeleton() {
  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-4">
        <SectionTitle>Macros</SectionTitle>
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {MACROS.map((m, i) => (
            <div key={m.label} className="grid justify-items-center gap-2">
              <div className="relative size-20">
                <CometRing size={80} stroke={8} seconds={2.2} delay={-i * 0.55} />
                <div className="absolute inset-0 grid place-content-center text-center">
                  <b className="font-heading text-xl leading-none font-normal">
                    <ScrambleText pattern="88" seed={10 + i} />
                    <small className="ml-px font-sans text-[0.6rem]">%</small>
                  </b>
                </div>
              </div>
              <div className="grid justify-items-center">
                <span className="flex items-center gap-1.5 text-sm">
                  <i className={cn("size-2 rounded-full", m.dot)} />
                  {m.label}
                </span>
                <span className="text-xs">
                  <b className="font-semibold">
                    <ScrambleText pattern="88g" seed={30 + i} />
                  </b>{" "}
                  / <ScrambleText pattern="888g" seed={40 + i} />
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className={cn("grid gap-2", GRID)}>
          {NUTRIENT_ROWS.map((r, i) => (
            <div key={r.key} className={cn("relative grid gap-0.5 overflow-hidden rounded-xl bg-muted/60 p-3", flatTile, tileSpan(i))}>
              {/* Same pieces as a loaded cell, all moving: the emoji floats, the label shimmers, and the bar has a light running along it */}
              <span aria-hidden className="pointer-events-none absolute -top-1 -right-1 animate-float text-3xl opacity-[0.18] motion-reduce:animate-none" style={{ ["--tilt" as string]: "12deg", animationDelay: `${i * 0.5}s` }}>
                {r.emoji}
              </span>
              <span className="relative text-xs font-semibold">
                <ShimmerText delay={i * 0.2}>{r.label}</ShimmerText>
              </span>
              <b className="relative text-lg leading-tight">
                <ScrambleText pattern={r.unit === "g" ? "8.8" : "888"} seed={50 + i} />
                <small className="ml-0.5 text-xs font-semibold text-foreground/65">{r.unit}</small>
              </b>
              <span className="relative text-xs font-semibold text-foreground/75">
                <ScrambleText pattern="88%" seed={60 + i} /> DV
              </span>
              <span className="relative mt-1 block h-1 overflow-hidden rounded-full bg-foreground/10">
                <span className="absolute inset-y-0 left-0 w-2/5 animate-bar-slide rounded-full bg-gradient-to-r from-primary/10 via-primary to-primary/10 motion-reduce:animate-none" style={{ animationDelay: `${i * 0.18}s` }} />
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Same box as a MealRow: 10px padding around a 56px thumbnail, plus the 1px border. */
export function MealRowSkeleton({ icon }: { icon?: string }) {
  return (
    <div className="flex w-full items-center gap-3.5 rounded-2xl border bg-card p-2.5">
      <span className="relative size-14 shrink-0">
        <Skeleton className="size-full rounded-xl" />
        {icon && (
          <span aria-hidden className="absolute inset-0 grid animate-bob place-items-center text-2xl opacity-45 motion-reduce:animate-none">
            {icon}
          </span>
        )}
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <Line className="h-4 w-3/5 max-w-40" />
        <Line className="h-3 w-4/5 max-w-52" />
      </div>
      <div className="grid justify-items-end gap-1.5">
        <Line className="h-6 w-10" />
        <Line className="h-3 w-7" />
      </div>
    </div>
  );
}

export function MealSectionsSkeleton() {
  return (
    <section className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      {MEAL_TYPES.map((t) => (
        <div key={t.value} className="grid content-start gap-2">
          <MealSectionHeader icon={t.icon} label={t.label} loading />
          <MealRowSkeleton icon={t.icon} />
        </div>
      ))}
    </section>
  );
}

/** Title block of PageHeader with a placeholder for the data-driven eyebrow. */
export function GreetingSkeleton() {
  return <Line className="inline-block h-5 w-44 align-top" />;
}

export function DashboardSkeleton() {
  return (
    <Page>
      <PageHeader eyebrow={<GreetingSkeleton />} title="Today">
        <div className="flex gap-1.5" aria-hidden>
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="size-11 rounded-xl" />
        </div>
      </PageHeader>
      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <RingCardSkeleton />
        <MacrosCardSkeleton />
      </section>
      <MealSectionsSkeleton />
      <section className="grid gap-4 lg:grid-cols-3">
        <TrackerCardSkeleton title="Activity" right={<Line className="h-5 w-24" />}>
          <Skeleton className="h-11 rounded-full" />
        </TrackerCardSkeleton>
        <TrackerCardSkeleton title="Water" right={<Line className="h-5 w-24" />}>
          <Line className="h-10 w-28" />
          <Skeleton className="h-2.5 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-full" />
            <Skeleton className="h-10 flex-1 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </TrackerCardSkeleton>
        <TrackerCardSkeleton title="Weight" right={<span className="text-sm text-muted-foreground">Trend →</span>}>
          <div className="flex items-center justify-between gap-3">
            <div className="grid h-14 content-between">
              <Line className="h-9 w-36" />
              <Line className="h-3 w-28" />
            </div>
            <Skeleton className="h-10 w-24 shrink-0 rounded-md" />
          </div>
          <Skeleton className="h-11 rounded-full" />
        </TrackerCardSkeleton>
      </section>
    </Page>
  );
}

function TrackerCardSkeleton({ title, right, children }: { title: string; right: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>{title}</SectionTitle>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/* ---------- History ---------- */

/** Keeps the period column in view while the table scrolls sideways on a phone. */
export const STICKY = "sticky left-0 z-10 bg-card shadow-[8px_0_8px_-8px_rgb(0_0_0/0.6)]";

const BAR_HEIGHTS = [38, 62, 48, 80, 55, 70, 42, 66, 52, 76, 45, 60];

const TILES: { label: string; icon: LucideIcon; accent: Accent }[] = [
  { label: "Avg calories / day", icon: Flame, accent: "lime" },
  { label: "Avg protein / day", icon: Dumbbell, accent: "cyan" },
  { label: "Days logged", icon: CalendarCheck, accent: "orange" },
  { label: "Weight change", icon: Scale, accent: "pink" },
];

export function TileRowSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map((t) => (
        <StatTile key={t.label} {...t} loading />
      ))}
    </section>
  );
}

const HIGHLIGHTS: { label: string; icon: LucideIcon; accent: Accent }[] = [
  { label: "On target", icon: Target, accent: "lime" },
  { label: "Peak intake", icon: Trophy, accent: "orange" },
  { label: "Meals", icon: UtensilsCrossed, accent: "pink" },
];

export function HighlightsSkeleton() {
  return (
    <section className="grid grid-cols-3 gap-3">
      {HIGHLIGHTS.map((h) => (
        <Highlight key={h.label} {...h} loading />
      ))}
    </section>
  );
}

/** Same stack as CaloriesChart: plot (h-56, lg:h-72) with a bottom border, axis row, then the 5.5rem detail panel. */
export function BarChartSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex h-56 items-end gap-0.5 border-b lg:h-72">
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center">
            <Skeleton className="w-full max-w-7 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 h-[15.6px]" />
      <div className="mt-3 grid h-[5.5rem] content-between">
        <div className="flex items-baseline justify-between">
          <Line className="h-5 w-28" />
          <Line className="h-5 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[2.9rem] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Same stack as WeightLine: h-48 plot, then the one-line readout. */
export function WeightChartSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-48 rounded-2xl" />
      <div className="mt-3 min-h-6" />
    </div>
  );
}

/** Donut (size-36) beside three legend rows. */
export function DonutSkeleton() {
  return (
    <div className="flex items-center gap-5" aria-hidden>
      <div className="relative size-36 shrink-0">
        <Skeleton className="size-full rounded-full" />
        {/* The donut's stroke is 14/120 of its width */}
        <div className="absolute inset-[11.667%] rounded-full bg-card" />
      </div>
      <ul className="grid min-w-0 flex-1 gap-3">
        {MACROS.map((m) => (
          <li key={m.label} className="flex items-center gap-2.5 text-sm">
            <i className={cn("size-2.5 shrink-0 rounded-full", m.dot)} />
            <span className="flex-1">{m.label}</span>
            <span className="grid justify-items-end gap-0.5">
              <Line className="h-4 w-8" />
              <Line className="h-4 w-16" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Value (36px), caption (16px) and a 56px strip of bars, with the card's 12px gaps. */
export function MiniCardSkeleton() {
  return (
    <>
      <Line className="h-9 w-24" />
      <Line className="h-4 w-28" />
      <Skeleton className="h-14 rounded-md" />
    </>
  );
}

const TABLE_WIDTHS = ["w-14", "w-6", "w-10", "w-10", "w-10", "w-8", "w-10", "w-14", "w-10", "w-14"];

/** Body rows only: header cells are static and stay real. A cell is p-2 around a 20px line, plus a 1px row border. */
export function TableRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="border-b last:border-0" aria-hidden>
      {TABLE_WIDTHS.map((w, c) => (
        <td key={c} className={cn("p-2 align-middle", c === 0 && STICKY)}>
          <Line className={cn("h-5 before:hidden animate-pulse", w)} />
        </td>
      ))}
    </tr>
  ));
}

const TABLE_HEADS = ["Period", "Days", "kcal", "Protein", "Carbs", "Fat", "Burned", "Active", "Water", "Weight"];

export function HistorySkeleton() {
  return (
    <Page>
      <PageHeader eyebrow="Your trends" title="History">
        <Skeleton className="h-11 w-[14.5rem] rounded-full" aria-hidden />
      </PageHeader>
      <TileRowSkeleton />
      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Calories vs goal</SectionTitle>
          <BarChartSkeleton />
        </CardContent>
      </Card>
      <HighlightsSkeleton />
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardContent className="grid content-start gap-4">
            <SectionTitle>Macro balance</SectionTitle>
            <DonutSkeleton />
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="grid content-start gap-4">
            <div className="flex min-h-6 items-center justify-between">
              <SectionTitle>Weight trend</SectionTitle>
            </div>
            <WeightChartSkeleton />
          </CardContent>
        </Card>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:gap-4">
        {["Burned", "Water"].map((t) => (
          <Card key={t} className="rounded-3xl">
            <CardContent className="grid content-start gap-3">
              <SectionTitle>{t}</SectionTitle>
              <MiniCardSkeleton />
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Breakdown</SectionTitle>
          <div className="relative w-full overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b">
                  {TABLE_HEADS.map((h, i) => (
                    <th key={h} className={cn("h-10 px-2 text-left align-middle text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase", i === 0 && STICKY)}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableRowsSkeleton />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}

/* ---------- Coach ---------- */

/** One assistant bubble and one user bubble, using the real bubble shapes (rounded-3xl, tail corner, px-4 py-3, 22.75px lines). */
export function ChatBubblesSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="flex">
        <div className="w-[88%] max-w-md rounded-3xl rounded-bl-lg border bg-card px-4 py-3">
          <div className="grid gap-[9.75px] py-[3.5px]">
            <Line className="h-3 w-full" />
            <Line className="h-3 w-5/6" />
            <Line className="h-3 w-2/3" />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-[60%] max-w-xs rounded-3xl rounded-br-lg bg-muted px-4 py-3">
          <div className="py-[5.375px]">
            <Line className="h-3 w-full bg-foreground/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoachSkeleton() {
  return (
    <Page narrow className="min-h-[calc(100dvh-6rem)] grid-rows-[auto_1fr_auto] lg:min-h-dvh">
      <PageHeader eyebrow="Ask about your meals, activity and weight" title="Coach">
        <div className="flex gap-1.5" aria-hidden>
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      </PageHeader>
      <section className="grid content-start gap-4">
        <ChatBubblesSkeleton />
      </section>
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] grid gap-1.5 lg:bottom-4" aria-hidden>
        <div className="flex items-end gap-2 rounded-3xl border bg-card/95 p-2">
          <div className="flex min-h-11 flex-1 items-center px-3.5 text-base text-muted-foreground md:text-sm">Ask your coach…</div>
          <Skeleton className="size-11 shrink-0 rounded-full" />
        </div>
      </div>
    </Page>
  );
}

/* ---------- Profile ---------- */

function FieldSkeleton({ label, className, radius = "rounded-xl", hint, choices }: { label: string; className?: string; radius?: string; hint?: boolean; choices?: number }) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <FieldLabel>{label}</FieldLabel>
      {choices ? (
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: choices }, (_, i) => (
            <Skeleton key={i} className={cn("h-11 w-full", radius)} />
          ))}
        </div>
      ) : (
        <Skeleton className={cn("h-11 w-full", radius)} />
      )}
      {hint && <Line className="h-4 w-56 max-w-full" />}
    </div>
  );
}

/** Mirrors the profile page: header, hero card, the tab bar, then the Body tab's two cards. */
export function ProfileSkeleton() {
  return (
    <Page narrow>
      <PageHeader title="Profile" />

      <div className="grid gap-3 rounded-3xl border bg-card p-4" aria-hidden>
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="grid min-w-0 gap-1.5">
            <Line className="h-8 w-40 max-w-full" />
            <Line className="h-4 w-48 max-w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-[26px] w-24 rounded-full" />
          <Skeleton className="h-[26px] w-24 rounded-full" />
          <Skeleton className="h-[26px] w-28 rounded-full" />
        </div>
      </div>

      <div className="-mx-4 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" aria-hidden>
        <Skeleton className="h-[66px] w-full rounded-2xl" />
      </div>

      <div className="grid gap-5">
        <Card className="rounded-3xl">
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <SectionTitle>About you</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <FieldSkeleton label="Display name" className="col-span-2" />
              <FieldSkeleton label="Sex" className="col-span-2 sm:col-span-1" />
              <FieldSkeleton label="Age" />
              <FieldSkeleton label="Height (cm)" />
              <FieldSkeleton label="Weight (kg)" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <SectionTitle>Activity and goal</SectionTitle>
            <FieldSkeleton label="Activity level" />
            <FieldSkeleton label="Goal" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <SectionTitle>Diet</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl" />
              ))}
            </div>
            <Line className="h-4 w-56 max-w-full" />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

/* ---------- Scan / generic ---------- */

/** Mirrors DetailsStage: meal type row (42px), name card (176px), details toggle (48px), photo tiles (112px), submit button (56px). */
export function ScanSkeleton() {
  return (
    <Page narrow>
      <PageHeader title="Log a meal" />
      <div className="grid gap-5" aria-hidden>
        <Skeleton className="h-[42px] rounded-full" />
        <Skeleton className="h-[176px] rounded-[1.75rem]" />
        <Skeleton className="h-12 rounded-2xl" />
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Add a photo</SectionTitle>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">Optional</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        </section>
        <div className="pt-6 pb-1">
          <Skeleton className="h-14 rounded-full" />
        </div>
      </div>
    </Page>
  );
}

export function GenericSkeleton() {
  return (
    <Page narrow>
      <div className="grid gap-2" aria-hidden>
        <Line className="h-10 w-48 sm:h-12" />
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </Page>
  );
}
