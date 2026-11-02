import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Dumbbell, Flame, Scale, Target, Trophy, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { MEAL_TYPES } from "@/lib/types";
import { THEMES } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { NUTRIENT_ROWS } from "./NutrientGrid";
import { Page, PageHeader, SectionTitle } from "./Page";
import { MealSectionHeader } from "./MealParts";
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

export function RingCardSkeleton() {
  return (
    <Card className="relative items-center justify-center gap-4 rounded-3xl py-8">
      <div className="relative size-48 sm:size-52" aria-hidden>
        <Skeleton className="size-full rounded-full" />
        {/* The ring's stroke is 10/120 of its width */}
        <div className="absolute inset-[8.333%] rounded-full bg-card" />
        <div className="absolute inset-0 grid place-content-center justify-items-center">
          <Line className="h-12 w-24" />
          <Line className="mt-1 h-4 w-20" />
          <Line className="mt-1 h-5 w-16" />
        </div>
      </div>
      <RingStats loading />
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
          {MACROS.map((m) => (
            <div key={m.label} className="grid justify-items-center gap-2">
              <div className="relative size-20">
                <Skeleton className="size-full rounded-full" />
                {/* The ring's stroke is 8/80 of its width */}
                <div className="absolute inset-[10%] rounded-full bg-card" />
              </div>
              <div className="grid justify-items-center">
                <span className="flex items-center gap-1.5 text-sm">
                  <i className={cn("size-2 rounded-full", m.dot)} />
                  {m.label}
                </span>
                <Line className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NUTRIENT_ROWS.map((r) => (
            <div key={r.key} className="grid gap-0.5 rounded-xl bg-muted/60 p-3">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <Line className="h-[22.5px] w-14 bg-foreground/10" />
              <Line className="h-4 w-10 bg-foreground/10" />
              <Line className="mt-1 h-1 w-full rounded-full bg-foreground/10" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Same box as a MealRow: 10px padding around a 56px thumbnail, plus the 1px border. */
export function MealRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-3.5 rounded-2xl border bg-card p-2.5">
      <Skeleton className="size-14 shrink-0 rounded-xl" />
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
          <MealRowSkeleton />
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
          <Line className={cn("h-5", w)} />
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

const ABOUT_FIELDS: { label: string; wide?: boolean }[] = [
  { label: "Display name", wide: true },
  { label: "Sex" },
  { label: "Age" },
  { label: "Height (cm)" },
  { label: "Weight (kg)" },
  { label: "Activity level", wide: true },
  { label: "Goal", wide: true },
];
const TARGET_FIELDS = ["Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Water (ml)"];

function FieldSkeleton({ label, className, radius = "rounded-xl" }: { label: string; className?: string; radius?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <FieldLabel>{label}</FieldLabel>
      <Skeleton className={cn("h-11 w-full", radius)} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <Page narrow>
      <PageHeader title="Profile and goals" />

      <Card className="rounded-3xl">
        <CardContent className="flex items-center gap-4" aria-hidden>
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="grid min-w-0 gap-1">
            <Line className="h-7 w-32" />
            <Line className="h-6 w-52 max-w-full" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card className="rounded-3xl">
          <CardContent className="grid gap-5">
            <SectionTitle>About you</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ABOUT_FIELDS.map((f) => (
                <FieldSkeleton key={f.label} label={f.label} className={f.wide ? "sm:col-span-2" : undefined} />
              ))}
            </div>
            <Line className="h-5 w-3/4" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="grid gap-5">
            <SectionTitle>Daily targets</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              {TARGET_FIELDS.map((l) => (
                <FieldSkeleton key={l} label={l} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Skeleton className="h-12 w-full rounded-full" />
      </div>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Appearance</SectionTitle>
          <p className="text-sm text-muted-foreground">Pick a look. It is saved on this device.</p>
          {/* The same groups as the picker. Each tile is 10px padding around a 56px preview and a 36px label, plus the border */}
          {[
            { label: "Dark", count: THEMES.filter((t) => t.dark).length },
            { label: "Light", count: THEMES.filter((t) => !t.dark).length },
          ].map((g) => (
            <div key={g.label} className="grid gap-3" aria-hidden>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g.label}</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: g.count }, (_, i) => (
                  <Skeleton key={i} className="h-[122px] rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-transparent">
        <CardContent className="grid gap-4">
          <SectionTitle>Account</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden>
            <Skeleton className="h-8 w-[6.75rem] rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-[9.25rem] rounded-full" />
          </div>
        </CardContent>
      </Card>
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
