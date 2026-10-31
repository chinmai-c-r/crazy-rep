"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { TextareaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACTIVITIES, ACTIVITY_IDS, activityDef, caloriesBurned, DEFAULT_WEIGHT_KG, INTENSITIES, type ActivityId, type Intensity } from "@/lib/activities";
import {
  activityLogSchema,
  weightLogSchema,
  type ActivityLogInput,
  type ActivityLogValues,
  type WeightLogInput,
  type WeightLogValues,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, WeightLog } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DDTHH:mm" in local time, for datetime-local inputs. */
export const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** "YYYY-MM-DD" in local time. */
export const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The selected day at the current time of day (so logging "yesterday" lands on yesterday). */
function atNow(day: Date) {
  const now = new Date();
  const d = new Date(day);
  d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return d;
}

const toggleItem = "h-10 rounded-full! border px-3 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

// ─── Activity ───────────────────────────────────────────────

export function ActivitySheet({
  open,
  onOpenChange,
  day,
  weightKg,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  weightKg: number | null | undefined;
  onSaved: (row: ActivityLog) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-2xl">
        {open && <ActivityForm day={day} weightKg={weightKg} onSaved={onSaved} onDone={() => onOpenChange(false)} />}
      </DrawerContent>
    </Drawer>
  );
}

function ActivityForm({
  day,
  weightKg,
  onSaved,
  onDone,
}: {
  day: Date;
  weightKg: number | null | undefined;
  onSaved: (row: ActivityLog) => void;
  onDone: () => void;
}) {
  const form = useForm<ActivityLogInput, unknown, ActivityLogValues>({
    resolver: zodResolver(activityLogSchema),
    defaultValues: {
      activity: "walking",
      intensity: "moderate",
      duration_min: 30,
      calories_burned: caloriesBurned("walking", "moderate", 30, weightKg),
      distance_km: "",
      steps: "",
      performed_at: toLocalInput(atNow(day)),
      notes: "",
    },
  });
  const { control, setValue, formState } = form;
  const [caloriesEdited, setCaloriesEdited] = useState(false);
  const [activity, intensity, duration] = useWatch({ control, name: ["activity", "intensity", "duration_min"] });

  // Keep the estimate in sync until the user types their own number (e.g. from a watch).
  useEffect(() => {
    const minutes = Number(duration);
    if (!caloriesEdited && minutes > 0) {
      setValue("calories_burned", caloriesBurned(activity as ActivityId, intensity as Intensity, minutes, weightKg));
    }
  }, [activity, intensity, duration, caloriesEdited, weightKg, setValue]);

  const def = activityDef(activity as ActivityId);

  const onSubmit = form.handleSubmit(async (v) => {
    const { data, error } = await createClient()
      .from("activity_logs")
      .insert({
        ...v,
        performed_at: new Date(v.performed_at).toISOString(),
        distance_km: def.distance ? v.distance_km : null,
        notes: v.notes || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success(`${def.label} logged · ${v.calories_burned} kcal`);
    onSaved(data as ActivityLog);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
      <DrawerHeader className="text-left">
        <DrawerTitle className="font-heading text-3xl font-normal tracking-wide">Log activity</DrawerTitle>
        <DrawerDescription>
          Calories are estimated from exercise intensity (MET) and your weight
          {weightKg ? ` (${weightKg} kg)` : ` (default ${DEFAULT_WEIGHT_KG} kg; add yours in Profile)`}.
        </DrawerDescription>
      </DrawerHeader>

      <FieldGroup className="gap-4 overflow-y-auto px-4 pb-2 sm:px-6">
        <Controller
          control={control}
          name="activity"
          render={({ field }) => (
            <Field>
              <FieldLabel>Activity</FieldLabel>
              <ToggleGroup type="single" variant="outline" value={field.value} onValueChange={(v) => v && field.onChange(v)} className="flex-wrap justify-start">
                {ACTIVITY_IDS.map((id) => (
                  <ToggleGroupItem key={id} value={id} className={toggleItem}>
                    {ACTIVITIES[id].icon} {ACTIVITIES[id].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}
        />
        <Controller
          control={control}
          name="intensity"
          render={({ field }) => (
            <Field>
              <FieldLabel>Intensity</FieldLabel>
              <ToggleGroup type="single" variant="outline" value={field.value} onValueChange={(v) => v && field.onChange(v)} className="w-full">
                {INTENSITIES.map((i) => (
                  <ToggleGroupItem key={i} value={i} className={`${toggleItem} flex-1 capitalize`}>
                    {i}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField control={control} name="duration_min" label="Duration (min)" type="number" inputMode="numeric" min={1} />
          <Controller
            control={control}
            name="calories_burned"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="calories_burned">Calories burned</FieldLabel>
                <input
                  id="calories_burned"
                  type="number"
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-input bg-input/30 px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={(field.value as number | string) ?? ""}
                  onChange={(e) => {
                    setCaloriesEdited(true);
                    field.onChange(e.target.value);
                  }}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>{caloriesEdited ? "Your number" : "Auto-estimated · editable"}</FieldDescription>
              </Field>
            )}
          />
        </div>
        {def.distance && (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              control={control}
              name="distance_km"
              label={<>Distance (km) <Optional /></>}
              type="number"
              inputMode="decimal"
              step="0.01"
            />
            <TextField control={control} name="steps" label={<>Steps <Optional /></>} type="number" inputMode="numeric" />
          </div>
        )}
        <TextField control={control} name="performed_at" label="When" type="datetime-local" />
        <TextareaField control={control} name="notes" label={<>Notes <Optional /></>} rows={2} maxLength={300} />
      </FieldGroup>

      <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button type="submit" size="xl" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          Save activity
        </Button>
      </DrawerFooter>
    </form>
  );
}

// ─── Weight ─────────────────────────────────────────────────

export function WeightSheet({
  open,
  onOpenChange,
  day,
  lastWeight,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  lastWeight: number | null | undefined;
  onSaved: (row: WeightLog) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-xl">
        {open && <WeightForm day={day} lastWeight={lastWeight} onSaved={onSaved} onDone={() => onOpenChange(false)} />}
      </DrawerContent>
    </Drawer>
  );
}

function WeightForm({
  day,
  lastWeight,
  onSaved,
  onDone,
}: {
  day: Date;
  lastWeight: number | null | undefined;
  onSaved: (row: WeightLog) => void;
  onDone: () => void;
}) {
  const form = useForm<WeightLogInput, unknown, WeightLogValues>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: { logged_on: toLocalDate(day), weight_kg: lastWeight ?? "", body_fat_pct: "", notes: "" },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    const { data: auth } = await createClient().auth.getUser();
    const { data, error } = await createClient()
      .from("weight_logs")
      .upsert({ ...v, user_id: auth.user?.id, notes: v.notes || null }, { onConflict: "user_id,logged_on" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success(`Weight saved · ${v.weight_kg} kg`);
    onSaved(data as WeightLog);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
      <DrawerHeader className="text-left">
        <DrawerTitle className="font-heading text-3xl font-normal tracking-wide">Log weight</DrawerTitle>
        <DrawerDescription>One entry per day; logging again on the same day updates it.</DrawerDescription>
      </DrawerHeader>
      <FieldGroup className="gap-4 overflow-y-auto px-4 pb-2 sm:px-6">
        <div className="grid grid-cols-2 gap-4">
          <TextField control={form.control} name="weight_kg" label="Weight (kg)" type="number" inputMode="decimal" step="0.1" autoFocus />
          <TextField control={form.control} name="logged_on" label="Date" type="date" max={toLocalDate(new Date())} />
        </div>
        <TextField
          control={form.control}
          name="body_fat_pct"
          label={<>Body fat % <Optional /></>}
          type="number"
          inputMode="decimal"
          step="0.1"
        />
        <TextareaField control={form.control} name="notes" label={<>Notes <Optional /></>} rows={2} maxLength={300} />
      </FieldGroup>
      <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button type="submit" size="xl" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Save weight
        </Button>
      </DrawerFooter>
    </form>
  );
}

function Optional() {
  return <span className="font-normal text-muted-foreground">(optional)</span>;
}
