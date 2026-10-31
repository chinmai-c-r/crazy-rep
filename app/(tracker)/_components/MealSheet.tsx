"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { fmt, scaleNutrients } from "@/lib/nutrition";
import { mealWriteSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Meal, MealType } from "@/lib/types";
import { MealTypePicker, Stepper } from "./Controls";
import { FoodItemList, Insights } from "./FoodItems";
import MacroBar from "./MacroBar";
import NutrientGrid from "./NutrientGrid";
import { SectionTitle } from "./Page";

type Props = {
  meal: Meal | null;
  imageUrl?: string;
  onClose: () => void;
  onChange: (meal: Meal) => void;
  onDelete: (id: string) => void;
};

export default function MealSheet({ meal, imageUrl, onClose, onChange, onDelete }: Props) {
  return (
    <Drawer open={!!meal} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-2xl">
        {meal && <Body key={meal.id} meal={meal} imageUrl={imageUrl} onClose={onClose} onChange={onChange} onDelete={onDelete} />}
      </DrawerContent>
    </Drawer>
  );
}

function Body({ meal, imageUrl, onClose, onChange, onDelete }: Props & { meal: Meal }) {
  const [servings, setServings] = useState(Number(meal.servings));
  const [mealType, setMealType] = useState<MealType>(meal.meal_type);
  const [busy, setBusy] = useState(false);

  // Stored nutrients already include the saved servings; rescale relative to that.
  const shown = scaleNutrients(meal, servings / Number(meal.servings));
  const dirty = servings !== Number(meal.servings) || mealType !== meal.meal_type;

  async function save() {
    const parsed = mealWriteSchema.safeParse({ ...shown, name: meal.name, servings, meal_type: mealType });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    setBusy(true);
    const { data, error } = await createClient().from("meals").update(parsed.data).eq("id", meal.id).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Meal updated");
    onChange(data as Meal);
    onClose();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("meals").delete().eq("id", meal.id);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    if (meal.image_path) await supabase.storage.from("meal-images").remove([meal.image_path]);
    toast.success("Meal deleted");
    onDelete(meal.id);
    onClose();
  }

  return (
    <>
      <div className="grid gap-5 overflow-y-auto px-4 pb-2 sm:px-6">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={imageUrl} alt={meal.name} className="mt-2 max-h-64 w-full rounded-2xl object-cover" />
        )}
        <DrawerHeader className="p-0 text-left">
          <DrawerTitle className="font-heading text-3xl font-normal tracking-wide">{meal.name}</DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-2">
            {new Date(meal.eaten_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
            {meal.health_score ? <Badge variant="secondary">Health score {meal.health_score}/10</Badge> : null}
            {meal.source === "usda" ? <Badge variant="secondary">USDA FoodData Central</Badge> : null}
            {meal.source === "text" || meal.source === "cache" ? <Badge variant="secondary">Estimated from name</Badge> : null}
          </DrawerDescription>
        </DrawerHeader>

        <p className="font-heading text-6xl leading-none text-primary">
          {fmt(shown.calories)}
          <small className="ml-2 font-sans text-base text-muted-foreground">kcal</small>
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <MealTypePicker value={mealType} onChange={setMealType} />
          <Stepper value={servings} onChange={setServings} />
        </div>

        <div className="grid gap-3">
          <MacroBar label="Protein" value={shown.protein_g} macro="protein" />
          <MacroBar label="Carbs" value={shown.carbs_g} macro="carbs" />
          <MacroBar label="Fat" value={shown.fat_g} macro="fat" />
        </div>
        <NutrientGrid totals={shown} />

        {meal.items?.length > 0 && (
          <section className="grid gap-3">
            <SectionTitle>
              Detected items <span className="font-normal tracking-normal normal-case">(per serving)</span>
            </SectionTitle>
            <FoodItemList items={meal.items} />
          </section>
        )}

        {meal.notes && (
          <section className="grid gap-3">
            <SectionTitle>AI insights</SectionTitle>
            <Insights insights={meal.notes.split("\n")} />
          </section>
        )}
      </div>

      <DrawerFooter className="flex-row gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="xl" className="flex-1" disabled={busy}>
              <Trash2 /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this meal?</AlertDialogTitle>
              <AlertDialogDescription>&ldquo;{meal.name}&rdquo; and its photo will be removed permanently.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={remove}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button size="xl" className="flex-1" onClick={save} disabled={busy || !dirty}>
          {busy && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </DrawerFooter>
    </>
  );
}
