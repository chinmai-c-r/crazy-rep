"use client";

import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnline } from "@/lib/offline";
import { localDay, parseDay } from "@/lib/day";
import { useLogRange, useMeals, useProfile, useSignedUrls, useWeights } from "@/lib/hooks";
import { dayRange, sumNutrients } from "@/lib/nutrition";
import { MEAL_TYPES, type ActivityLog, type WaterLog } from "@/lib/types";
import { OfflineNote } from "../_components/OfflineBanner";
import { ActivityCard, WaterCard, WeightCard } from "../_components/BodyCards";
import { ActivitySheet, WeightSheet } from "../_components/LogSheets";
import MacroRings from "../_components/MacroRings";
import { EmptyMeal, MealRow, MealSectionHeader } from "../_components/MealParts";
import MealSheet from "../_components/MealSheet";
import NutrientGrid from "../_components/NutrientGrid";
import { Page, PageHeader, SectionTitle } from "../_components/Page";
import Ring, { RingStats } from "../_components/Ring";
import { GreetingSkeleton, MacrosCardSkeleton, MealRowSkeleton, RingCardSkeleton } from "../_components/Skeletons";

/** Cards rise a little as they replace their skeleton. No fade: fading from transparent would flash blank. */
const ENTER = "animate-in slide-in-from-bottom-2 fill-mode-both duration-500";

export default function DashboardView() {
  const [date, setDate] = useState(() => parseDay(new URLSearchParams(window.location.search).get("date")) ?? new Date());
  // Coming back from logging a meal for an earlier day (?date=2026-11-06): show that day. Runs on every visit, since this page is kept alive.
  useLayoutEffect(() => {
    const linked = parseDay(new URLSearchParams(window.location.search).get("date"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL on every visit
    if (linked) setDate(linked);
  }, []);
  const { start, end } = useMemo(() => dayRange(date), [date]);
  const { profile, loading: profileLoading, reload: reloadProfile } = useProfile();
  const online = useOnline();
  const { meals, loading, unavailable, error, setMeals } = useMeals(start, end);
  const activities = useLogRange<ActivityLog>("activity_logs", "performed_at", start, end);
  const water = useLogRange<WaterLog>("water_logs", "logged_at", start, end);
  const { weights, loading: weightsLoading, reload: reloadWeights } = useWeights(14);
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
          <Button variant="outline" size="icon-lg" className="size-11 rounded-xl" onClick={() => shift(-1)} aria-label="Previous day" disabled={!online}>
            <ChevronLeft />
          </Button>
          {!isToday && (
            <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => setDate(new Date())} disabled={!online}>
              Today
            </Button>
          )}
          <Button variant="outline" size="icon-lg" className="size-11 rounded-xl" onClick={() => shift(1)} disabled={isToday || !online} aria-label="Next day">
            <ChevronRight />
          </Button>
        </div>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {booting ? (
          <RingCardSkeleton />
        ) : (
        <Card className={`relative items-center justify-center gap-4 rounded-3xl py-8 ${ENTER}`}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-20 h-64 bg-[radial-gradient(closest-side,rgb(var(--primary-rgb)/0.09),transparent)]" />
          <Ring value={totals.calories} goal={profile?.calorie_goal ?? 2000} />
          <RingStats burned={burned} net={totals.calories - burned} meals={meals.length} />
        </Card>
        )}
        {booting ? (
          <MacrosCardSkeleton />
        ) : (
        <Card className={`rounded-3xl ${ENTER}`} style={{ animationDelay: "80ms" }}>
          <CardContent className="grid gap-4">
            <SectionTitle>Macros</SectionTitle>
            <MacroRings totals={totals} goals={{ protein: profile?.protein_goal_g, carbs: profile?.carbs_goal_g, fat: profile?.fat_goal_g }} />
            <NutrientGrid totals={totals} />
          </CardContent>
        </Card>
        )}
      </section>

      {unavailable && <OfflineNote>This day isn&apos;t saved on your device. Connect to the internet to see it.</OfflineNote>}

      {error && online && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {MEAL_TYPES.map((t) => {
          const list = meals.filter((m) => m.meal_type === t.value);
          const kcal = list.reduce((s, m) => s + Number(m.calories), 0);
          return (
            <div key={t.value} className={`grid content-start gap-2 ${ENTER}`} style={{ animationDelay: `${160 + MEAL_TYPES.indexOf(t) * 60}ms` }}>
              <MealSectionHeader icon={t.icon} label={t.label} kcal={kcal} loading={loading} />
              {loading ? (
                <MealRowSkeleton icon={t.icon} />
              ) : list.length ? (
                <ul className="grid gap-2">
                  {list.map((m, i) => (
                    <MealRow key={m.id} meal={m} index={i} url={m.image_path ? urls[m.image_path] : undefined} onOpen={() => setOpenId(m.id)} />
                  ))}
                </ul>
              ) : (
                <EmptyMeal href={`/scan?type=${t.value}${isToday ? "" : `&date=${localDay(date)}`}`} icon={t.icon} label={t.label} disabled={!online} />
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

      {online && (
        <Button asChild size="xl" className="fixed right-8 bottom-8 z-40 hidden shadow-[0_10px_40px_rgb(var(--primary-rgb)/0.35)] lg:inline-flex">
          <Link href={isToday ? "/scan" : `/scan?date=${localDay(date)}`}>
            <Camera /> Log meal
          </Link>
        </Button>
      )}

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
