"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Minus, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/LogoMark";
import { DEFAULT_DIET, DIET_OPTIONS } from "@/lib/diet";
import { useProfile } from "@/lib/hooks";
import { calculateGoals } from "@/lib/nutrition";
import { useOnline } from "@/lib/offline";
import { BODY_SUGGESTION, isProfileComplete, macrosFor, waterGoalFor } from "@/lib/profile";
import { profileSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLevel, Diet, Goal, Sex } from "@/lib/types";
import { cn } from "@/lib/utils";
import ClientOnly from "../(tracker)/_components/ClientOnly";
import { OfflineNote } from "../(tracker)/_components/OfflineBanner";
import Providers from "../(tracker)/_components/Providers";

const STEPS = ["goal", "sex", "body", "activity", "diet", "plan"] as const;
type Step = (typeof STEPS)[number];

const GOALS: { id: Goal; emoji: string; label: string; hint: string }[] = [
  { id: "lose", emoji: "🔥", label: "Lose fat", hint: "Eat a little less than you burn" },
  { id: "maintain", emoji: "⚖️", label: "Stay where I am", hint: "Match what you burn" },
  { id: "gain", emoji: "💪", label: "Build muscle", hint: "Eat a little more and train" },
];

const SEXES: { id: Sex; emoji: string; label: string }[] = [
  { id: "male", emoji: "♂️", label: "Male" },
  { id: "female", emoji: "♀️", label: "Female" },
];

const ACTIVITIES: { id: ActivityLevel; emoji: string; label: string; hint: string }[] = [
  { id: "sedentary", emoji: "🪑", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { id: "light", emoji: "🚶", label: "Lightly active", hint: "Workouts 1–3 days a week" },
  { id: "moderate", emoji: "🏃", label: "Moderately active", hint: "Workouts 3–5 days a week" },
  { id: "active", emoji: "🏋️", label: "Very active", hint: "Workouts 6–7 days a week" },
  { id: "very_active", emoji: "⚡", label: "Athlete", hint: "Hard training every day" },
];

const BODY_FIELDS = [
  { key: "age", label: "Age", unit: "years", min: 10, max: 120, step: 1 },
  { key: "height_cm", label: "Height", unit: "cm", min: 80, max: 260, step: 1 },
  { key: "weight_kg", label: "Weight", unit: "kg", min: 25, max: 400, step: 1 },
] as const;
type Body = Record<(typeof BODY_FIELDS)[number]["key"], number | "">;

const PLAN_NOTE: Record<Goal, string> = {
  lose: "500 kcal under what you burn, about 0.5 kg a week",
  maintain: "About what you burn each day",
  gain: "300 kcal over what you burn, with plenty of protein",
};

export default function OnboardingView() {
  return (
    <Providers>
      <ClientOnly>
        <Onboarding />
      </ClientOnly>
    </Providers>
  );
}

function Onboarding() {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const online = useOnline();
  const { profile, loading, setProfile } = useProfile();

  const [step, setStep] = useState<Step>("goal");
  const [dir, setDir] = useState<1 | -1>(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [body, setBody] = useState<Body>({ age: "", height_cm: "", weight_kg: "" });
  const bodyTouched = useRef(false);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [diet, setDiet] = useState<Diet>(DEFAULT_DIET);
  const [calories, setCalories] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const done = useRef(false);
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(advance.current), []);

  // Someone who already finished has no reason to be here
  useEffect(() => {
    if (profile && isProfileComplete(profile) && !done.current) router.replace("/dashboard");
  }, [profile, router]);

  const index = STEPS.indexOf(step);
  const go = (to: Step) => {
    setDir(STEPS.indexOf(to) >= index ? 1 : -1);
    setStep(to);
  };
  /** Picking an option moves on by itself after a beat, so most steps are a single tap. */
  const pick = (set: () => void, next: Step) => {
    set();
    clearTimeout(advance.current);
    advance.current = setTimeout(() => go(next), reduce ? 0 : 220);
  };

  const age = Number(body.age);
  const height = Number(body.height_cm);
  const weight = Number(body.weight_kg);
  const bodyOk = BODY_FIELDS.every((f) => body[f.key] !== "" && Number(body[f.key]) >= f.min && Number(body[f.key]) <= f.max);

  const plan =
    sex && goal && activity && bodyOk
      ? (() => {
          const base = calculateGoals({ sex, age, height_cm: height, weight_kg: weight, activity_level: activity, goal });
          const kcal = calories ?? base.calorie_goal;
          return { ...base, calorie_goal: kcal, ...macrosFor(kcal, base.protein_goal_g), water_goal_ml: waterGoalFor(weight) };
        })()
      : null;

  async function save() {
    if (!plan || !profile || !sex || !goal || !activity || saving) return;
    const parsed = profileSchema.safeParse({
      display_name: profile.display_name ?? "",
      sex,
      age,
      height_cm: height,
      weight_kg: weight,
      activity_level: activity,
      goal,
      diet,
      calorie_goal: plan.calorie_goal,
      protein_goal_g: plan.protein_goal_g,
      carbs_goal_g: plan.carbs_goal_g,
      fat_goal_g: plan.fat_goal_g,
      water_goal_ml: plan.water_goal_ml,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);

    setSaving(true);
    const { diet: chosenDiet, ...rest } = parsed.data;
    const fields: Partial<typeof rest> = { ...rest };
    delete fields.display_name; // the name is already set from signup
    const { data, error } = await createClient()
      .from("profiles")
      // A profile read before the diet migration ran has no diet column; leave it out so saving still works
      .update({ ...fields, ...("diet" in profile ? { diet: chosenDiet } : {}) })
      .eq("id", profile.id)
      .select()
      .single();
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    done.current = true;
    setProfile(data);
    toast.success("You're all set. Let's log your first meal.");
    router.replace("/scan");
  }

  const slide = reduce
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, x: 36 * dir },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -36 * dir },
      };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="grid gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-lg"
            className={cn("-ml-2 size-10 rounded-full", index === 0 && "invisible")}
            onClick={() => go(STEPS[index - 1])}
            aria-label="Back"
          >
            <ArrowLeft />
          </Button>
          <span className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LogoMark className="size-6" />
            </span>
            CRAZY <span className="-ml-1.5 text-primary">REP</span>
          </span>
          <span className="w-8 text-right text-xs font-semibold text-muted-foreground tabular-nums">
            {index + 1}/{STEPS.length}
          </span>
        </div>
        <div className="flex gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
          {STEPS.map((s, i) => (
            <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full bg-gradient-to-r from-primary to-chart-4 transition-transform duration-500 origin-left", i <= index ? "scale-x-100" : "scale-x-0")} />
            </span>
          ))}
        </div>
      </header>

      {!online && <OfflineNote className="mt-4">You&apos;re offline. Please connect to the internet to finish setting up.</OfflineNote>}

      <main className="flex flex-1 flex-col py-6">
        {loading ? (
          <div className="grid gap-3" aria-busy>
            <div className="h-9 w-3/4 animate-pulse rounded-lg bg-muted" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...slide} transition={{ duration: 0.22, ease: "easeOut" }} className="flex flex-1 flex-col gap-6">
              {step === "goal" && (
                <>
                  <Heading title="What's your goal?" sub="Takes about 30 seconds. We'll set your daily targets for you." />
                  <Options>
                    {GOALS.map((o) => (
                      <Option key={o.id} {...o} selected={goal === o.id} onSelect={() => pick(() => setGoal(o.id), "sex")} />
                    ))}
                  </Options>
                </>
              )}

              {step === "sex" && (
                <>
                  <Heading title="Are you male or female?" sub="Only used to estimate how many calories you burn." />
                  <Options cols={2}>
                    {SEXES.map((o) => (
                      <Option
                        key={o.id}
                        {...o}
                        big
                        selected={sex === o.id}
                        onSelect={() =>
                          pick(() => {
                            setSex(o.id);
                            // Start from typical numbers, so most people only nudge them. Never overwrite what they typed.
                            if (!bodyTouched.current) setBody(BODY_SUGGESTION[o.id]);
                          }, "body")
                        }
                      />
                    ))}
                  </Options>
                </>
              )}

              {step === "body" && (
                <>
                  <Heading title="A few quick numbers" sub="We've started you off with typical values. Adjust them, or tap Continue. Roughly is fine." />
                  <div className="grid gap-3">
                    {BODY_FIELDS.map((f) => (
                      <NumberRow
                        key={f.key}
                        label={f.label}
                        unit={f.unit}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={body[f.key]}
                        onChange={(v) => {
                          bodyTouched.current = true;
                          setBody((b) => ({ ...b, [f.key]: v }));
                        }}
                      />
                    ))}
                  </div>
                  <Button size="xl" className="mt-auto w-full" disabled={!bodyOk} onClick={() => go("activity")}>
                    Continue
                  </Button>
                </>
              )}

              {step === "activity" && (
                <>
                  <Heading title="How active are you?" sub="Think of a typical week. Pick the closest." />
                  <Options>
                    {ACTIVITIES.map((o) => (
                      <Option key={o.id} {...o} compact selected={activity === o.id} onSelect={() => pick(() => setActivity(o.id), "diet")} />
                    ))}
                  </Options>
                </>
              )}

              {step === "diet" && (
                <>
                  <Heading title="What do you eat?" sub="So the coach and meal ideas suit you. You can change it any time." />
                  <Options cols={2}>
                    {DIET_OPTIONS.map((o) => (
                      <Option
                        key={o.id}
                        id={o.id}
                        emoji={o.emoji}
                        label={o.label}
                        hint={o.hint}
                        big
                        selected={diet === o.id}
                        onSelect={() => pick(() => setDiet(o.id), "plan")}
                      />
                    ))}
                  </Options>
                </>
              )}

              {step === "plan" && plan && goal && (
                <>
                  <Heading title="Your daily plan" sub="Built from your answers. Nudge the calories if you like." />
                  <div className="grid justify-items-center gap-3 rounded-3xl border bg-card p-6 text-center">
                    <div className="flex items-center gap-4">
                      <Button variant="secondary" size="icon-lg" className="size-11 rounded-full" onClick={() => setCalories(Math.max(1200, plan.calorie_goal - 50))} aria-label="50 fewer calories">
                        <Minus />
                      </Button>
                      <p className="min-w-36 font-heading text-6xl leading-none text-primary tabular-nums">{plan.calorie_goal.toLocaleString()}</p>
                      <Button variant="secondary" size="icon-lg" className="size-11 rounded-full" onClick={() => setCalories(Math.min(6000, plan.calorie_goal + 50))} aria-label="50 more calories">
                        <Plus />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">calories a day</p>
                    <p className="text-xs text-muted-foreground">
                      You burn about {plan.tdee.toLocaleString()} a day. {PLAN_NOTE[goal]}.
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Protein", value: `${plan.protein_goal_g}g`, dot: "bg-protein" },
                      { label: "Carbs", value: `${plan.carbs_goal_g}g`, dot: "bg-carbs" },
                      { label: "Fat", value: `${plan.fat_goal_g}g`, dot: "bg-fat" },
                      { label: "Water", value: `${plan.water_goal_ml / 1000}L`, dot: "bg-chart-4" },
                    ].map((m) => (
                      <div key={m.label} className="grid gap-0.5 rounded-2xl border bg-card/60 px-1 py-3">
                        <b className="font-heading text-2xl font-normal">{m.value}</b>
                        <span className="flex items-center justify-center gap-1.5 text-[0.7rem] text-muted-foreground">
                          <i className={cn("size-1.5 rounded-full", m.dot)} />
                          {m.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button size="xl" className="mt-auto w-full" onClick={save} disabled={saving || !online || !profile}>
                    {saving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    Start tracking
                  </Button>
                  <p className="-mt-3 text-center text-xs text-muted-foreground">You can fine-tune all of this later in Profile.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="grid gap-1.5">
      <h1 className="font-heading text-4xl leading-tight tracking-wide">{title}</h1>
      <p className="text-muted-foreground">{sub}</p>
    </div>
  );
}

function Options({ cols = 1, children }: { cols?: 1 | 2; children: React.ReactNode }) {
  return (
    <div role="radiogroup" className={cn("grid gap-3", cols === 2 && "grid-cols-2")}>
      {children}
    </div>
  );
}

function Option({
  emoji,
  label,
  hint,
  selected,
  onSelect,
  big,
  compact,
}: {
  id?: string;
  emoji: string;
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
  big?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex items-center gap-4 rounded-2xl border bg-card px-4 text-left transition-all duration-200 active:scale-[0.98]",
        big ? "min-h-32 flex-col justify-center gap-2 px-3 py-4 text-center" : compact ? "min-h-16 py-3" : "min-h-20 py-4",
        selected ? "border-primary bg-primary/10 shadow-[0_8px_28px_-12px_rgb(var(--primary-rgb)/0.55)]" : "hover:border-primary/40",
      )}
    >
      <span className={cn("shrink-0", big ? "text-4xl" : "text-3xl")} aria-hidden>
        {emoji}
      </span>
      <span className="grid min-w-0">
        <b className="text-base">{label}</b>
        {hint && <small className="text-xs text-muted-foreground">{hint}</small>}
      </span>
      {selected && (
        <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}

function NumberRow({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, (Number(value) || min) + d)));
  const invalid = value !== "" && (Number(value) < min || Number(value) > max);
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3", invalid && "border-destructive")}>
      <div className="grid">
        <b>{label}</b>
        <small className="text-xs text-muted-foreground">{invalid ? `Between ${min} and ${max}` : unit}</small>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="icon-lg" className="size-11 rounded-full" onClick={() => bump(-step)} aria-label={`Lower ${label.toLowerCase()}`}>
          <Minus />
        </Button>
        <input
          className="h-11 w-20 rounded-xl border bg-background/60 text-center font-heading text-3xl tabular-nums outline-none focus-visible:border-primary"
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`${label} in ${unit}`}
        />
        <Button type="button" variant="secondary" size="icon-lg" className="size-11 rounded-full" onClick={() => bump(step)} aria-label={`Raise ${label.toLowerCase()}`}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}
