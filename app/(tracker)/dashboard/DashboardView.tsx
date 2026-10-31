"use client";

import { Camera, ChevronLeft, ChevronRight, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogRange, useMeals, useProfile, useSignedUrls, useWeights } from "@/lib/hooks";
import { dayRange, fmt, sumNutrients } from "@/lib/nutrition";
import { MEAL_TYPES, type ActivityLog, type Meal, type WaterLog } from "@/lib/types";
import { ActivityCard, WaterCard, WeightCard } from "../_components/BodyCards";
import { ActivitySheet, WeightSheet } from "../_components/LogSheets";
import MacroBar from "../_components/MacroBar";
import MealSheet from "../_components/MealSheet";
import NutrientGrid from "../_components/NutrientGrid";
import { Page, PageHeader, SectionTitle } from "../_components/Page";
import Ring from "../_components/Ring";
import { GreetingSkeleton, MacrosCardSkeleton, MealRowSkeleton, RingCardSkeleton } from "../_components/Skeletons";

export default function DashboardView() {
  const [date, setDate] = useState(() => new Date());
  const { start, end } = useMemo(() => dayRange(date), [date]);
  const { profile, loading: profileLoading, reload: reloadProfile } = useProfile();
  const { meals, loading, error, setMeals } = useMeals(start, end);
  const activities = useLogRange<ActivityLog>("activity_logs", "performed_at", start, end);
  const water = useLogRange<WaterLog>("water_logs", "logged_at", start, end);
  const { weights, loading: weightsLoading, reload: reloadWeights } = useWeights(2);
  const [sheet, setSheet] = useState<"activity" | "weight" | null>(null);
  const urls = useSignedUrls(meals.map((m) => m.image_path));
  const [openId, setOpenId] = useState<string | null>(null);

  // Totals and goals need both the day's meals and the profile
  const booting = loading || profileLoading;
  const totals = useMemo(() => sumNutrients(meals), [meals]);
  const burned = activities.rows.reduce((s, a) => s + Number(a.calories_burned), 0);
  const open = meals.find((m) => m.id === openId) ?? null;
  const isToday = dayRange(new Date()).start === start;

  const shift = (days: number) =>
    setDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + days);
      return n;
    });

  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  return (
    <Page>
      <PageHeader
        eyebrow={profileLoading ? <GreetingSkeleton /> : `${greeting}${profile?.display_name ? `, ${profile.display_name}` : ""}`}
        title={isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
      >
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon-lg" className="size-11 rounded-xl" onClick={() => shift(-1)} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          {!isToday && (
            <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => setDate(new Date())}>
              Today
            </Button>
          )}
          <Button variant="outline" size="icon-lg" className="size-11 rounded-xl" onClick={() => shift(1)} disabled={isToday} aria-label="Next day">
            <ChevronRight />
          </Button>
        </div>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {booting ? (
          <RingCardSkeleton />
        ) : (
        <Card className="items-center justify-center gap-4 rounded-3xl py-8">
          <Ring value={totals.calories} goal={profile?.calorie_goal ?? 2000} />
          <div className="flex gap-6 text-center text-sm">
            <div>
              <b className="block font-heading text-2xl font-normal text-chart-4">{fmt(burned)}</b>
              <span className="text-muted-foreground">burned</span>
            </div>
            <div>
              <b className="block font-heading text-2xl font-normal">{fmt(totals.calories - burned)}</b>
              <span className="text-muted-foreground">net kcal</span>
            </div>
          </div>
        </Card>
        )}
        {booting ? (
          <MacrosCardSkeleton />
        ) : (
        <Card className="rounded-3xl">
          <CardContent className="grid gap-4">
            <SectionTitle>Macros</SectionTitle>
            <div className="grid gap-3">
              <MacroBar label="Protein" value={totals.protein_g} goal={profile?.protein_goal_g} macro="protein" />
              <MacroBar label="Carbs" value={totals.carbs_g} goal={profile?.carbs_goal_g} macro="carbs" />
              <MacroBar label="Fat" value={totals.fat_g} goal={profile?.fat_goal_g} macro="fat" />
            </div>
            <NutrientGrid totals={totals} />
          </CardContent>
        </Card>
        )}
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {MEAL_TYPES.map((t) => {
          const list = meals.filter((m) => m.meal_type === t.value);
          const kcal = list.reduce((s, m) => s + Number(m.calories), 0);
          return (
            <div key={t.value} className="grid content-start gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="font-bold">
                  {t.icon} {t.label}
                </h2>
                {loading ? <Skeleton className="h-4 w-16 self-center rounded" /> : <span className="text-sm text-muted-foreground">{fmt(kcal)} kcal</span>}
              </div>
              {loading ? (
                <MealRowSkeleton />
              ) : list.length ? (
                <ul className="grid gap-2">
                  {list.map((m) => (
                    <MealRow key={m.id} meal={m} url={m.image_path ? urls[m.image_path] : undefined} onOpen={() => setOpenId(m.id)} />
                  ))}
                </ul>
              ) : (
                <Link
                  href={`/scan?type=${t.value}`}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="size-4" /> Add {t.label.toLowerCase()}
                </Link>
              )}
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActivityCard
          activities={activities.rows}
          loading={activities.loading}
          onAdd={() => setSheet("activity")}
          onDeleted={(id) => activities.setRows((rs) => rs.filter((r) => r.id !== id))}
        />
        <WaterCard
          logs={water.rows}
          loading={water.loading || profileLoading}
          goal={profile?.water_goal_ml ?? 2500}
          day={date}
          onAdded={(row) => water.setRows((rs) => [row, ...rs])}
          onRemoved={(id) => water.setRows((rs) => rs.filter((r) => r.id !== id))}
        />
        <WeightCard weights={weights} loading={weightsLoading} onAdd={() => setSheet("weight")} />
      </section>

      <ActivitySheet
        open={sheet === "activity"}
        onOpenChange={(o) => setSheet(o ? "activity" : null)}
        day={date}
        weightKg={profile?.weight_kg}
        onSaved={(row) => activities.setRows((rs) => [row, ...rs])}
      />
      <WeightSheet
        open={sheet === "weight"}
        onOpenChange={(o) => setSheet(o ? "weight" : null)}
        day={date}
        lastWeight={weights[0]?.weight_kg ?? profile?.weight_kg}
        onSaved={() => {
          reloadWeights();
          reloadProfile();
        }}
      />

      <Button asChild size="xl" className="fixed right-8 bottom-8 z-40 hidden shadow-[0_10px_40px_rgb(198_255_0/0.35)] lg:inline-flex">
        <Link href="/scan">
          <Camera /> Log meal
        </Link>
      </Button>

      <MealSheet
        meal={open}
        imageUrl={open?.image_path ? urls[open.image_path] : undefined}
        onClose={() => setOpenId(null)}
        onChange={(u) => setMeals((ms) => ms.map((m) => (m.id === u.id ? u : m)))}
        onDelete={(id) => setMeals((ms) => ms.filter((m) => m.id !== id))}
      />
    </Page>
  );
}

function MealRow({ meal, url, onOpen }: { meal: Meal; url?: string; onOpen: () => void }) {
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3.5 rounded-2xl border bg-card p-2.5 text-left transition-colors hover:border-primary/40"
      >
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {url ? <img src={url} alt="" className="size-full object-cover" /> : <UtensilsCrossed className="size-5 text-muted-foreground" />}
        </span>
        <span className="grid min-w-0 flex-1">
          <b className="truncate">{meal.name}</b>
          <small className="text-xs text-muted-foreground">
            P {fmt(meal.protein_g)}g · C {fmt(meal.carbs_g)}g · F {fmt(meal.fat_g)}g
          </small>
        </span>
        <span className="text-right font-heading text-2xl leading-none">
          {fmt(meal.calories)}
          <small className="block font-sans text-[0.7rem] text-muted-foreground">kcal</small>
        </span>
      </button>
    </li>
  );
}
