import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { MEAL_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NUTRIENT_ROWS } from "./NutrientGrid";
import { Page, PageHeader, SectionTitle } from "./Page";

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
    <Card className="items-center justify-center gap-4 rounded-3xl py-8">
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
      <div className="flex gap-6 text-center text-sm">
        {["burned", "net kcal"].map((label) => (
          <div key={label} className="grid justify-items-center">
            <Line className="h-8 w-12" />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
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
        <div className="grid gap-3">
          {MACROS.map((m) => (
            <div key={m.label} className="grid gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <i className={cn("size-2.5 rounded-full", m.dot)} />
                  {m.label}
                </span>
                <Line className="h-5 w-20" />
              </div>
              <Skeleton className="h-2.5 rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NUTRIENT_ROWS.map((r) => (
            <div key={r.key} className="grid gap-0.5 rounded-xl bg-muted/60 p-3">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <Line className="h-[22.5px] w-14 bg-foreground/10" />
              <Line className="h-4 w-10 bg-foreground/10" />
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
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-bold">
              {t.icon} {t.label}
            </h2>
            <Line className="h-4 w-16 self-center" />
          </div>
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
          <div className="grid h-14 content-between">
            <Line className="h-9 w-36" />
            <Line className="h-3 w-28" />
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

export function StatTileSkeleton({ label }: { label: string }) {
  return (
    <Card className="gap-1 rounded-2xl px-4 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Line className="h-9 w-20" />
    </Card>
  );
}

const BAR_HEIGHTS = [38, 62, 48, 80, 55, 70, 42, 66, 52, 76, 45, 60];

/** Same stack as BarChart: plot (h-56, lg:h-72) with a bottom border, axis row, hint row. */
export function BarChartSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex h-56 items-end gap-0.5 border-b lg:h-72">
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center">
            <Skeleton className="w-full max-w-7 rounded-t rounded-b-none" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 h-[15.6px]" />
      <div className="mt-3 min-h-6" />
    </div>
  );
}

/** Same stack as WeightChart: h-48 plot, then the hint row. */
export function WeightChartSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-48 rounded-2xl" />
      <div className="mt-3 min-h-6" />
    </div>
  );
}

const TABLE_WIDTHS = ["w-14", "w-6", "w-10", "w-10", "w-10", "w-8", "w-10", "w-14", "w-10", "w-14"];

/** Body rows only: header cells are static and stay real. A cell is p-2 around a 20px line, plus a 1px row border. */
export function TableRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="border-b last:border-0" aria-hidden>
      {TABLE_WIDTHS.map((w, c) => (
        <td key={c} className="p-2 align-middle">
          <Line className={cn("h-5", w)} />
        </td>
      ))}
    </tr>
  ));
}

const HISTORY_TILES = ["Avg calories / day", "Avg protein / day", "Days logged", "Weight change"];
const TABLE_HEADS = ["Period", "Days", "kcal", "Protein", "Carbs", "Fat", "Burned", "Active", "Water", "Weight"];

export function HistorySkeleton() {
  return (
    <Page>
      <PageHeader eyebrow="Your trends" title="History">
        <Skeleton className="h-11 w-[14.5rem] rounded-full" aria-hidden />
      </PageHeader>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HISTORY_TILES.map((l) => (
          <StatTileSkeleton key={l} label={l} />
        ))}
      </section>
      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Calories vs goal</SectionTitle>
          <BarChartSkeleton />
        </CardContent>
      </Card>
      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Weight trend</SectionTitle>
          <WeightChartSkeleton />
        </CardContent>
      </Card>
      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Breakdown</SectionTitle>
          <div className="relative w-full overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b">
                  {TABLE_HEADS.map((h) => (
                    <th key={h} className="h-10 px-2 text-left align-middle text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase">
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

export function ScanSkeleton() {
  return (
    <Page narrow>
      <PageHeader eyebrow="AI calorie estimator" title="Log a meal" />
      <div className="grid gap-5 sm:grid-cols-[1.1fr_1fr]" aria-hidden>
        <Skeleton className="min-h-64 rounded-3xl" />
        <div className="grid content-start gap-4">
          <FieldSkeleton label="Meal name *" />
          <FieldSkeleton label="Portion or quantity" />
          <div className="flex w-full flex-col gap-2">
            <FieldLabel>Notes</FieldLabel>
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-full" />
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
