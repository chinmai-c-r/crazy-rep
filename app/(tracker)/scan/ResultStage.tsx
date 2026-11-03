"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Camera,
  Check,
  Database,
  Lightbulb,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/hooks";
import { DIET_OPTIONS, dietConflict, dietOf } from "@/lib/diet";
import { foodEmoji } from "@/lib/food-emoji";
import { fmt } from "@/lib/nutrition";
import type { AnalysisSource, mealDetailsSchema } from "@/lib/schemas";
import type { Analysis, FoodItem, MealType, Nutrients } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Donut } from "../_components/charts";
import AddItem from "../_components/AddItem";
import ItemStepper from "../_components/ItemStepper";
import NutrientGrid from "../_components/NutrientGrid";
import { SectionTitle } from "../_components/Page";
import { useRolling } from "../_components/Ring";
import { MealTypeRow } from "./DetailsStage";

type Form = UseFormReturn<
  z.input<typeof mealDetailsSchema>,
  unknown,
  z.output<typeof mealDetailsSchema>
>;
type Provider = "ai" | "usda" | "indb" | "ifct";

const EASE = [0.16, 1, 0.3, 1] as const;
const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {}
};

/* ─────────────────────────────── Celebration ─────────────────────────────── */

const COLORS = [
  "var(--primary)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
];
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  angle: (i / 26) * Math.PI * 2 + (i % 3) * 0.12,
  dist: 90 + ((i * 37) % 80),
  size: 5 + (i % 4) * 2,
  color: COLORS[i % COLORS.length],
  delay: (i % 6) * 0.025,
  round: i % 3 !== 0,
}));

/** One burst of confetti when the result lands. Fixed particles (no random values during render). */
function Burst() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/3 z-20"
    >
      {PARTICLES.map((p, i) => (
        <motion.i
          key={i}
          className={cn(
            "absolute block",
            p.round ? "rounded-full" : "rounded-[2px]",
          )}
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 10px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist + 24,
            opacity: 0,
            scale: 1,
            rotate: 240,
          }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.35 + p.delay }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────── Hero ──────────────────────────────────── */

function SourceChip({
  source,
  provider,
  badge,
}: {
  source: AnalysisSource;
  provider: Provider;
  badge?: string;
}) {
  const Icon =
    provider !== "ai" ? Database : source === "photo" ? Camera : Sparkles;
  // Shorter wording on a phone so the three chips share one line
  const [short, long] =
    provider !== "ai"
      ? [badge, badge]
      : source === "photo"
        ? ["From photo", "From your photo"]
        : ["From name", "Estimated from name"];
  return (
    <Chip>
      <Icon className="size-3.5" />
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </Chip>
  );
}

const Chip = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex h-7 items-center gap-1.5 rounded-full bg-card/70 px-3 text-xs font-semibold backdrop-blur-md ring-1 ring-foreground/10",
      className,
    )}
  >
    {children}
  </span>
);

/** Health score as a little ring with the score inside. */
function ScoreChip({ score }: { score: number }) {
  const C = 2 * Math.PI * 8;
  return (
    <Chip className="pl-1.5">
      <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="3"
          className="stroke-foreground/15"
        />
        <motion.circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={
            score >= 7
              ? "stroke-primary"
              : score >= 4
                ? "stroke-chart-2"
                : "stroke-chart-3"
          }
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 10) }}
          transition={{ duration: 1, ease: EASE, delay: 0.5 }}
        />
      </svg>
      <span className="hidden min-[400px]:inline">Health </span>
      {score}/10
    </Chip>
  );
}

/** A compact pill (38px tall) beside its label, instead of a full-width bar. */
function ServingsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const step = (d: number) => {
    buzz();
    onChange(Math.min(20, Math.max(0.25, Math.round((value + d) * 4) / 4)));
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">Servings</span>
      <div
        className="inline-flex items-center rounded-full border bg-muted/40 p-0.5"
        role="group"
        aria-label="Servings"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="size-8 rounded-full active:scale-90"
          onClick={() => step(value > 1 ? -0.5 : -0.25)}
          aria-label="Fewer servings"
        >
          <Minus className="size-4" />
        </Button>
        <span className="grid min-w-14 place-items-center overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.b
              key={value}
              className="font-heading text-xl leading-none font-normal"
              initial={{ y: 12, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -12, opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {value}×
            </motion.b>
          </AnimatePresence>
        </span>
        <Button
          type="button"
          size="icon-sm"
          className="size-8 rounded-full shadow-[0_4px_12px_-3px_rgb(var(--primary-rgb)/0.6)] active:scale-90"
          onClick={() => step(value >= 1 ? 0.5 : 0.25)}
          aria-label="More servings"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Macros and items ─────────────────────────────── */

function MacroRow({
  label,
  grams,
  share,
  dot,
  bar,
}: {
  label: string;
  grams: number;
  share: number;
  dot: string;
  bar: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const shown = useRolling(grams, reduce, 0.7);
  return (
    <li className="grid gap-1.5">
      <div className="flex items-center gap-2.5 text-sm">
        <i className={cn("size-2.5 rounded-full", dot)} />
        <span className="flex-1">{label}</span>
        <b>{fmt(shown, 1)}g</b>
        <span className="w-8 text-right text-xs text-muted-foreground">
          {Math.round(share * 100)}%
        </span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.span
          className={cn(
            "block h-full origin-left rounded-full bg-gradient-to-r",
            bar,
          )}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1, width: `${Math.max(share * 100, 2)}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </span>
    </li>
  );
}

function ItemCard({
  item,
  share,
  index,
  onRemove,
  last,
  flag,
  qty,
  onStep,
}: {
  item: FoodItem;
  share: number;
  index: number;
  onRemove: () => void;
  last: boolean;
  flag?: string;
  qty: { label: string; canDown: boolean };
  onStep: (dir: 1 | -1) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const kcal = useRolling(item.calories, reduce, 0.6); // rolls to the new number when the quantity changes
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.25 } }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 26,
        delay: index * 0.07,
      }}
      className="relative overflow-hidden rounded-2xl border bg-muted/40 p-3"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-card text-2xl shadow-inner"
          aria-hidden
        >
          {foodEmoji(item.name)}
        </span>
        <div className="grid min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <b className="truncate">{item.name}</b>
            {flag && (
              <span className="shrink-0 rounded-full bg-chart-2/15 px-2 py-px text-[0.65rem] font-semibold text-chart-2">
                {flag}
              </span>
            )}
          </span>
          <small className="truncate text-xs text-muted-foreground">
            {item.portion} · {fmt(item.grams)}g
          </small>
          <small className="mt-0.5 flex items-center gap-2.5 text-[0.7rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-protein" />
              {fmt(item.protein_g)}g
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-carbs" />
              {fmt(item.carbs_g)}g
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-fat" />
              {fmt(item.fat_g)}g
            </span>
          </small>
        </div>
        <span className="text-right font-heading text-xl leading-none whitespace-nowrap">
          {fmt(Math.round(kcal))}
          <small className="block font-sans text-[0.65rem] text-muted-foreground">
            kcal
          </small>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label={`Remove ${item.name}`}
          onClick={() => {
            buzz();
            onRemove();
          }}
          disabled={last}
        >
          <X />
        </Button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Quantity</span>
        <ItemStepper
          name={item.name}
          label={qty.label}
          canDown={qty.canDown}
          onStep={onStep}
        />
      </div>
      {/* This item's share of the meal */}
      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-foreground/5">
        <motion.span
          className="block h-full rounded-full bg-gradient-to-r from-primary/60 to-chart-4"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(share * 100, 3)}%` }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.3 + index * 0.07 }}
        />
      </span>
    </motion.li>
  );
}

/* ──────────────────────────────────── Stage ──────────────────────────────────── */

export type ResultProps = {
  form: Form;
  analysis: Analysis;
  source: AnalysisSource;
  provider: Provider;
  providerLabel?: { badge: string; credit: string };
  preview: string | null;
  totals: Nutrients;
  items: FoodItem[];
  /** One per item: a stable id (so cards keep their identity as quantities change), the quantity shown, and whether it can go lower. */
  itemMeta: { id: string; label: string; canDown: boolean }[];
  onStepItem: (index: number, dir: 1 | -1) => void;
  onRemoveItem: (index: number) => void;
  /** Items the person typed in because they weren't detected. */
  onAddItems: (items: FoodItem[]) => void;
  servings: number;
  onServings: (v: number) => void;
  mealType: MealType;
  onMealType: (v: MealType) => void;
  saving: boolean;
  /** No connection: the meal can't be saved until it's back. */
  offline?: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export default function ResultStage(p: ResultProps) {
  const reduce = useReducedMotion() ?? false;
  const { profile } = useProfile();
  const goal = profile?.calorie_goal ?? 2000;
  // Anything in this meal the diet rules out (words like "chicken" or "egg"), found in the detected items and the name
  const diet = dietOf(profile);
  const dietNoun = DIET_OPTIONS.find((d) => d.id === diet)?.noun ?? diet;
  const typedName = useWatch({ control: p.form.control, name: "name" }) ?? "";
  const conflicts = [
    ...new Set(
      [
        ...p.items.map((it) => dietConflict(diet, it.name)),
        dietConflict(diet, typedName),
      ].filter((w): w is string => Boolean(w)),
    ),
  ];
  const kcal = useRolling(p.totals.calories, reduce);
  const goalPct = Math.round((p.totals.calories / goal) * 100);
  const [burst, setBurst] = useState(!reduce);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(false), 2200);
    return () => clearTimeout(t);
  }, [burst]);

  const kcalFrom = {
    protein: p.totals.protein_g * 4,
    carbs: p.totals.carbs_g * 4,
    fat: p.totals.fat_g * 9,
  };
  const kcalSum = kcalFrom.protein + kcalFrom.carbs + kcalFrom.fat || 1;
  const share = {
    protein: kcalFrom.protein / kcalSum,
    carbs: kcalFrom.carbs / kcalSum,
    fat: kcalFrom.fat / kcalSum,
  };
  const itemTotal = p.items.reduce((s, it) => s + it.calories, 0) || 1;

  const rise = (i: number) =>
    ({
      initial: reduce ? false : { opacity: 0, y: 28 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.6, ease: EASE, delay: 0.1 + i * 0.1 },
    }) as const;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {/* Hero */}
      <motion.section
        {...rise(0)}
        className="relative overflow-hidden rounded-[2rem] border bg-card"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(var(--primary-rgb)/0.16),transparent_55%),radial-gradient(90%_80%_at_100%_100%,rgb(var(--chart-4-rgb)/0.13),transparent_60%)]"
        />
        {burst && <Burst />}

        {p.preview ? (
          <div className="relative aspect-[16/9] overflow-hidden">
            <motion.img
              initial={reduce ? false : { scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.4, ease: EASE }}
              src={p.preview}
              alt="Your meal"
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-black/30" />
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              <SourceChip
                source={p.source}
                provider={p.provider}
                badge={p.providerLabel?.badge}
              />
              <Chip className="text-primary">
                <Check className="size-3.5" />{" "}
                {Math.round(p.analysis.confidence * 100)}%
                <span className="hidden sm:inline"> sure</span>
              </Chip>
              <ScoreChip score={p.analysis.health_score} />
            </div>
          </div>
        ) : (
          <div className="relative flex flex-wrap gap-2 px-5 pt-5">
            <SourceChip
              source={p.source}
              provider={p.provider}
              badge={p.providerLabel?.badge}
            />
            <Chip className="text-primary">
              <Check className="size-3.5" />{" "}
              {Math.round(p.analysis.confidence * 100)}%
              <span className="hidden sm:inline"> sure</span>
            </Chip>
            <ScoreChip score={p.analysis.health_score} />
          </div>
        )}

        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-4 p-5 pt-3">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="bg-gradient-to-r from-primary via-mid to-chart-4 bg-clip-text font-heading text-7xl leading-none text-transparent [filter:drop-shadow(0_0_24px_rgb(var(--primary-rgb)/0.35))]">
                {fmt(Math.round(kcal))}
              </span>
              <span className="text-base text-muted-foreground">kcal</span>
            </p>
            <div className="mt-3 grid gap-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{goalPct}% of your daily goal</span>
                <span>{fmt(goal)} kcal</span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className={cn(
                    "block h-full rounded-full bg-gradient-to-r",
                    goalPct > 100
                      ? "from-chart-2 to-chart-3"
                      : "from-primary to-chart-4",
                  )}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.min(goalPct, 100)}%` }}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.4 }}
                />
              </span>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {conflicts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div
                  role="status"
                  className="flex gap-3 rounded-2xl border border-chart-2/30 bg-chart-2/10 p-3 text-sm"
                >
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-chart-2"
                    aria-hidden
                  />
                  <p className="leading-snug">
                    Heads up: this has <b>{conflicts.join(" and ")}</b>, which{" "}
                    {conflicts.length > 1 ? "aren't" : "isn't"} {dietNoun}. You
                    can change your diet in{" "}
                    <Link
                      href="/profile"
                      className="font-semibold text-chart-2 underline underline-offset-2"
                    >
                      Profile
                    </Link>
                    .
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <TextField
            control={p.form.control}
            name="name"
            label="Meal name"
            maxLength={120}
          />
          <MealTypeRow value={p.mealType} onChange={p.onMealType} />
          <ServingsStepper value={p.servings} onChange={p.onServings} />
        </div>
      </motion.section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Macros */}
        <motion.section
          {...rise(1)}
          className="min-w-0 rounded-[2rem] border bg-card p-5"
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <SectionTitle>Macros</SectionTitle>
            <div className="flex flex-col items-center gap-5 min-[385px]:flex-row">
              <Donut
                className="size-28 min-[440px]:size-36"
                centre={`${fmt(p.totals.protein_g + p.totals.carbs_g + p.totals.fat_g)}g`}
                caption="macros"
                slices={[
                  {
                    label: "Protein",
                    value: share.protein,
                    color: "var(--color-protein)",
                  },
                  {
                    label: "Carbs",
                    value: share.carbs,
                    color: "var(--color-carbs)",
                  },
                  { label: "Fat", value: share.fat, color: "var(--color-fat)" },
                ]}
              />
              <ul className="grid w-full min-w-0 flex-1 gap-3">
                <MacroRow
                  label="Protein"
                  grams={p.totals.protein_g}
                  share={share.protein}
                  dot="bg-protein"
                  bar="from-protein/40 to-protein"
                />
                <MacroRow
                  label="Carbs"
                  grams={p.totals.carbs_g}
                  share={share.carbs}
                  dot="bg-carbs"
                  bar="from-carbs/40 to-carbs"
                />
                <MacroRow
                  label="Fat"
                  grams={p.totals.fat_g}
                  share={share.fat}
                  dot="bg-fat"
                  bar="from-fat/40 to-fat"
                />
              </ul>
            </div>
            <SectionTitle>Other nutrients</SectionTitle>
            <NutrientGrid
              totals={p.totals}
              className="grid-cols-[repeat(auto-fit,minmax(6.25rem,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(6.25rem,1fr))]"
            />
          </div>
        </motion.section>

        {/* Items and insights */}
        <motion.section
          {...rise(2)}
          className="min-w-0 rounded-[2rem] border bg-card p-5"
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <SectionTitle>
              Detected items{" "}
              <span className="font-normal tracking-normal normal-case">
                (per serving)
              </span>
            </SectionTitle>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              <AnimatePresence mode="popLayout" initial>
                {p.items.map((it, i) => (
                  <ItemCard
                    key={p.itemMeta[i]?.id ?? `${it.name}-${i}`}
                    qty={p.itemMeta[i] ?? { label: "1", canDown: false }}
                    onStep={(dir) => p.onStepItem(i, dir)}
                    item={it}
                    index={i}
                    share={it.calories / itemTotal}
                    last={p.items.length === 1}
                    flag={
                      dietConflict(diet, it.name)
                        ? diet === "vegan"
                          ? "Not vegan"
                          : "Not veg"
                        : undefined
                    }
                    onRemove={() => p.onRemoveItem(i)}
                  />
                ))}
              </AnimatePresence>
            </ul>

            <AddItem onAdd={p.onAddItems} />

            {p.analysis.insights.length > 0 && (
              <>
                <SectionTitle>AI insights</SectionTitle>
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  {p.analysis.insights.map((n, i) => (
                    <motion.li
                      key={n}
                      initial={reduce ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        ease: EASE,
                        delay: 0.5 + i * 0.12,
                      }}
                      className="flex gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-3 text-sm"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <Lightbulb className="size-4" />
                      </span>
                      <span className="self-center leading-snug">{n}</span>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {p.provider !== "ai" && p.providerLabel
                ? `Source: ${p.providerLabel.credit}. Adjust servings to match what you ate.`
                : p.preview
                  ? "Estimates from a photo. Adjust servings or remove items for better accuracy."
                  : ""}
            </p>
          </div>
        </motion.section>
      </div>

      {/* Stays above the tab bar; the blur has its own layer so it never clips the buttons' shadows */}
      <motion.div
        {...rise(3)}
        className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 px-4 pt-6 pb-5 sm:-mx-6 sm:px-6 lg:bottom-4"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]"
        />
        <div className="relative flex gap-3">
          <Button
            variant="outline"
            className="h-14 flex-[0.8] rounded-full border-foreground/10 bg-secondary text-base shadow-[0_10px_16px_-6px_rgb(0_0_0/0.65),0_3px_6px_-2px_rgb(0_0_0/0.45)] hover:bg-secondary"
            onClick={p.onDiscard}
            disabled={p.saving}
          >
            Discard
          </Button>
          <Button
            className="relative h-14 flex-[1.5] overflow-hidden rounded-full bg-gradient-to-r from-primary via-mid to-chart-4 text-base font-semibold text-primary-foreground shadow-[0_10px_22px_-8px_rgb(var(--primary-rgb)/0.6),0_4px_10px_-3px_rgb(0_0_0/0.45)] transition-transform active:scale-[0.98]"
            onClick={p.onSave}
            disabled={p.saving || p.offline}
          >
            {!p.saving && !reduce && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-shimmer bg-white/50 blur-md"
              />
            )}
            {p.saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles className={cn(!reduce && "animate-twinkle")} />
            )}
            {p.saving ? "Logging…" : p.offline ? "Offline" : "Log this meal"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
