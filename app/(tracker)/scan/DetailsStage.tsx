"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, ChevronDown, ImageUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { TextareaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { dietOf, ideasFor } from "@/lib/diet";
import { useProfile } from "@/lib/hooks";
import { mealDetailsSchema } from "@/lib/schemas";
import { MEAL_TYPES, type MealType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionTitle } from "../_components/Page";
import RecentDishes from "../_components/RecentDishes";

type Details = z.input<typeof mealDetailsSchema>;
type Form = UseFormReturn<Details, unknown, z.output<typeof mealDetailsSchema>>;

const EASE = [0.16, 1, 0.3, 1] as const;
const buzz = () => {
  try {
    navigator.vibrate?.(8); // a light tap on phones that support it
  } catch {}
};


const FOODS = [
  { e: "🍛", left: "6%", top: "10%", size: "2.6rem", dur: 8, delay: 0, tilt: "-12deg" },
  { e: "🥑", left: "86%", top: "7%", size: "2.2rem", dur: 9, delay: 1.2, tilt: "10deg" },
  { e: "🍳", left: "90%", top: "38%", size: "2.4rem", dur: 7, delay: 0.6, tilt: "-8deg" },
  { e: "🍜", left: "3%", top: "46%", size: "2.3rem", dur: 10, delay: 2, tilt: "14deg" },
  { e: "🥗", left: "80%", top: "70%", size: "2.5rem", dur: 8.5, delay: 0.3, tilt: "-6deg" },
  { e: "🍕", left: "10%", top: "78%", size: "2.2rem", dur: 9.5, delay: 1.6, tilt: "9deg" },
];

/** Colour that drifts behind the page, with food floating in it. Fixed, so it stays put as the page scrolls. */
function Atmosphere({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[10%] -left-[25%] size-[70vmax] max-w-[50rem] animate-drift rounded-full bg-primary/12 blur-3xl will-change-transform motion-reduce:animate-none" />
      <div className="absolute top-[30%] -right-[30%] size-[60vmax] max-w-[45rem] animate-drift rounded-full bg-chart-4/10 blur-3xl will-change-transform motion-reduce:animate-none" style={{ animationDelay: "-4s", animationDuration: "16s" }} />
      <div className="absolute -bottom-[15%] left-[10%] size-[55vmax] max-w-[40rem] animate-drift rounded-full bg-chart-3/10 blur-3xl will-change-transform motion-reduce:animate-none" style={{ animationDelay: "-8s", animationDuration: "19s" }} />
      {!reduce &&
        FOODS.map((f) => (
          <span
            key={f.e}
            className="absolute animate-float opacity-[0.22] blur-[0.5px] will-change-transform"
            style={{ left: f.left, top: f.top, fontSize: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ["--tilt" as string]: f.tilt }}
          >
            {f.e}
          </span>
        ))}
    </div>
  );
}

/* ─────────────────────────────── Meal type ─────────────────────────────── */

export function MealTypeRow({ value, onChange }: { value: MealType; onChange: (v: MealType) => void }) {
  // One slim line: four pills sized by their text, each an emoji with its name (42px tall)
  return (
    <div role="radiogroup" aria-label="Meal type" className="flex gap-1 rounded-full border bg-muted/40 p-1 backdrop-blur">
      {MEAL_TYPES.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              buzz();
              onChange(t.value);
            }}
            className={cn(
              "flex h-8 min-w-0 flex-auto items-center justify-center gap-1 rounded-full px-1 text-xs font-semibold max-[359px]:text-[0.68rem] max-[330px]:text-[0.6rem] transition-[background-color,color,box-shadow] duration-300 active:scale-95",
              on ? "bg-primary text-primary-foreground shadow-[0_6px_22px_rgb(var(--primary-rgb)/0.35)]" : "text-muted-foreground hover:bg-foreground/5",
            )}
          >
            <motion.span className="text-base leading-none" animate={on ? { scale: [1, 1.3, 1], rotate: [0, -12, 0] } : { scale: 1 }} transition={{ duration: 0.45 }}>
              {t.icon}
            </motion.span>
            <span className="truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────── Name hero ──────────────────────────────── */

/** Types example dishes into the empty field, one after another. */
function Typewriter({ reduce, ideas }: { reduce: boolean; ideas: string[] }) {
  const [s, setS] = useState({ line: 0, chars: 0, deleting: false });
  useEffect(() => {
    if (reduce) return;
    const text = ideas[s.line % ideas.length];
    let delay = s.deleting ? 26 : 62;
    let next = s;
    if (!s.deleting && s.chars === text.length) {
      delay = 1500;
      next = { ...s, deleting: true };
    } else if (s.deleting && s.chars === 0) {
      delay = 300;
      next = { line: (s.line + 1) % ideas.length, chars: 0, deleting: false };
    } else next = { ...s, chars: s.chars + (s.deleting ? -1 : 1) };
    const t = setTimeout(() => setS(next), delay);
    return () => clearTimeout(t);
  }, [s, reduce, ideas]);
  const text = reduce ? ideas[0] : ideas[s.line % ideas.length].slice(0, s.chars);
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center text-muted-foreground/45">
      <span className="truncate">{text}</span>
      {!reduce && <i className="ml-0.5 inline-block h-[1.1em] w-0.5 shrink-0 animate-pulse bg-primary" />}
    </span>
  );
}

function NameHero({ form, reduce }: { form: Form; reduce: boolean }) {
  // Starter dishes that fit the diet in the profile (vegetarian until it says otherwise)
  const { profile } = useProfile();
  const diet = dietOf(profile);
  const ideas = useMemo(() => ideasFor(diet), [diet]);
  const name = useWatch({ control: form.control, name: "name" }) ?? "";
  const ready = useMemo(() => mealDetailsSchema.shape.name.safeParse(name).success, [name]);

  // A real keyboard can start typing straight away; on a phone that would cover the screen before it's seen
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) document.getElementById("name")?.focus();
  }, []);

  return (
    <Controller
      control={form.control}
      name="name"
      render={({ field, fieldState }) => (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <div className="group relative rounded-[1.75rem] p-[1.5px] transition-shadow duration-500 focus-within:shadow-[0_0_70px_rgb(var(--primary-rgb)/0.2)]">
            {/* A bead of light circles the border while you type */}
            <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[inherit] bg-foreground/10">
              <div className="absolute -inset-[150%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_55%,var(--color-primary)_78%,var(--color-chart-4)_92%,transparent_100%)] opacity-50 transition-opacity duration-500 group-focus-within:opacity-100 motion-reduce:animate-none" />
            </div>
            <div className="relative rounded-[calc(1.75rem-1.5px)] bg-card p-5">
              <label htmlFor="name" className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
                <Sparkles className="size-3.5 text-primary" aria-hidden />
                What did you eat?
              </label>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-12 min-w-0 flex-1 font-heading text-[1.7rem] tracking-wide sm:text-3xl">
                  <input
                    {...field}
                    id="name"
                    value={field.value ?? ""}
                    maxLength={120}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    enterKeyHint="go"
                    aria-invalid={fieldState.invalid}
                    className="size-full bg-transparent outline-none"
                  />
                  {!name && <Typewriter reduce={reduce} ideas={ideas} />}
                </div>
                <div className="grid size-8 shrink-0 place-items-center">
                  <AnimatePresence>
                    {ready && (
                      <motion.span
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                        className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_rgb(var(--primary-rgb)/0.6)]"
                      >
                        <Check className="size-4" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="mt-4 border-t border-foreground/5 pt-3">
                <RecentDishes
                  value={name}
                  fallback={ideas}
                  onPick={(picked) => {
                    buzz();
                    form.setValue("name", picked, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                  }}
                />
              </div>
            </div>
          </div>
          <FieldError errors={[fieldState.error]} />
        </div>
      )}
    />
  );
}

/* ───────────────────────────── Portion and notes ───────────────────────────── */

function MoreDetails({ form }: { form: Form }) {
  const [portion, notes] = useWatch({ control: form.control, name: ["portion", "notes"] });
  const filled = Boolean(portion?.trim() || notes?.trim());
  const [open, setOpen] = useState(false);
  const shown = open || filled;

  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-3 rounded-2xl border border-dashed px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground active:scale-[0.99]"
      >
        <Plus className="size-4 text-primary" />
        <span className="flex-1">Add portion or notes</span>
        {filled && <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgb(var(--primary-rgb)/0.8)]" />}
        <ChevronDown className={cn("size-4 transition-transform", shown && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
            <div className="grid gap-4 rounded-3xl border bg-card/80 p-4 backdrop-blur">
              <TextField control={form.control} name="portion" label="Portion or quantity" placeholder="e.g. 1 large plate, 2 rotis, 250 g" maxLength={120} />
              <TextareaField control={form.control} name="notes" label="Notes" placeholder="e.g. cooked in ghee, extra cheese, diet coke" maxLength={300} rows={2} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────── Photo ─────────────────────────────────── */

type PhotoProps = { preview: string | null; onCamera: () => void; onGallery: () => void; onRemove: () => void; onDrop: (file: File | undefined) => void };

function PhotoAdd({ preview, onCamera, onGallery, onRemove, onDrop }: PhotoProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <section
      className="grid gap-3"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onDrop(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex items-center justify-between">
        <SectionTitle>Add a photo</SectionTitle>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">Optional</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative aspect-[16/10] overflow-hidden rounded-3xl ring-1 ring-white/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={preview} alt="Your meal" className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            <motion.span
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold backdrop-blur"
            >
              <Check className="size-3.5 text-primary" /> Photo added · sharper estimate
            </motion.span>
            <div className="absolute inset-x-3 bottom-3 flex gap-2">
              <Button type="button" variant="secondary" className="h-10 flex-1 rounded-full bg-white/15 backdrop-blur hover:bg-white/25" onClick={onGallery}>
                <ImageUp /> Change
              </Button>
              <Button type="button" variant="secondary" className="h-10 flex-1 rounded-full bg-white/15 backdrop-blur hover:bg-white/25" onClick={onRemove}>
                <Trash2 /> Remove
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="tiles" exit={{ opacity: 0, scale: 0.96 }} className={cn("grid grid-cols-2 gap-3 rounded-3xl transition-all", dragging && "ring-2 ring-primary ring-offset-4 ring-offset-background")}>
            <button
              type="button"
              onClick={() => {
                buzz();
                onCamera();
              }}
              className="group relative grid h-28 content-between overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-4 text-left transition-transform active:scale-95"
            >
              <span className="grid size-10 animate-bob place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(var(--primary-rgb)/0.35)] motion-reduce:animate-none">
                <Camera className="size-5" />
              </span>
              <span>
                <b className="block text-sm">Take photo</b>
                <small className="text-xs text-muted-foreground">Sharper estimate</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                buzz();
                onGallery();
              }}
              className="group relative grid h-28 content-between overflow-hidden rounded-3xl border bg-gradient-to-br from-chart-4/15 via-chart-4/5 to-transparent p-4 text-left transition-transform active:scale-95"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-chart-4/20 text-chart-4">
                <ImageUp className="size-5" />
              </span>
              <span>
                <b className="block text-sm">From gallery</b>
                <small className="text-xs text-muted-foreground">Or drop one here</small>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ──────────────────────────────────── Stage ──────────────────────────────────── */

export default function DetailsStage({
  form,
  mealType,
  onMealType,
  blob,
  onSubmit,
  ...photo
}: { form: Form; mealType: MealType; onMealType: (v: MealType) => void; blob: Blob | null; onSubmit: React.FormEventHandler<HTMLFormElement> } & PhotoProps) {
  const reduce = useReducedMotion() ?? false;
  const name = useWatch({ control: form.control, name: "name" }) ?? "";
  const ready = mealDetailsSchema.shape.name.safeParse(name).success;

  const item = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };

  return (
    <motion.form
      onSubmit={onSubmit}
      noValidate
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5"
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
    >
      <Atmosphere reduce={reduce} />
      <motion.div variants={item}>
        <MealTypeRow value={mealType} onChange={onMealType} />
      </motion.div>
      <motion.div variants={item}>
        <NameHero form={form} reduce={reduce} />
      </motion.div>
      <motion.div variants={item}>
        <MoreDetails form={form} />
      </motion.div>
      <motion.div variants={item}>
        <PhotoAdd {...photo} />
      </motion.div>

      {/* Stays above the tab bar while the form scrolls. The soft blur sits on its own layer so it never clips the button's shadow. */}
      <motion.div variants={item} className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 px-4 pt-6 pb-5 sm:-mx-6 sm:px-6 lg:bottom-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]" />
        <Button
          type="submit"
          data-ready={ready}
          className={cn(
            "relative h-14 w-full overflow-hidden rounded-full text-base font-semibold transition-all duration-500 active:scale-[0.98]",
            // Shadows stay within the 16px gutter beside the button (negative spread), so nothing is cut off at the screen edge
            ready
              ? "bg-gradient-to-r from-primary via-mid to-chart-4 text-primary-foreground shadow-[0_10px_22px_-8px_rgb(var(--primary-rgb)/0.6),0_4px_10px_-3px_rgb(0_0_0/0.45)]"
              : "border border-foreground/10 bg-secondary text-muted-foreground shadow-[0_10px_16px_-6px_rgb(0_0_0/0.65),0_3px_6px_-2px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(var(--fg-rgb)/0.07)] hover:bg-secondary",
          )}
        >
          {ready && !reduce && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-shimmer bg-white/50 blur-md" />}
          <Sparkles className={cn("size-5", ready && !reduce && "animate-twinkle")} />
          {blob ? "Analyse photo" : "Estimate from name"}
        </Button>
      </motion.div>
    </motion.form>
  );
}
