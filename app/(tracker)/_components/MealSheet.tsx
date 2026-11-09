"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { syncMeal } from "@/lib/google-health-client";
import { isEdited, itemOf, mergeInsights, quantityOf, stepEntry, toEntries, type AddedInsights, type ItemEntry } from "@/lib/item-qty";
import { fmt, sumNutrients } from "@/lib/nutrition";
import { useOnline } from "@/lib/offline";
import { mealWriteSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { NUTRIENT_KEYS, type Meal, type MealType, type Nutrients } from "@/lib/types";
import { MealTypePicker, Stepper } from "./Controls";
import PlacePicker, { rememberPlace } from "./PlacePicker";
import AddItem from "./AddItem";
import { EditableItemList, Insights } from "./FoodItems";
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
  const [place, setPlace] = useState(meal.place ?? "");
  const [busy, setBusy] = useState(false); // saving
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false); // an item is being looked up
  const [addedInsights, setAddedInsights] = useState<AddedInsights>([]);
  const online = useOnline();

  // Each detected item can be raised or lowered. Items are per serving; the saved nutrients include the saved servings.
  const [entries, setEntries] = useState<ItemEntry[]>(() => toEntries(meal.items ?? [], () => crypto.randomUUID()));
  const savedIds = useRef(new Set(entries.map((e) => e.id))); // dishes already in the meal start folded; ones added now start open
  const items = useMemo(() => entries.map(itemOf), [entries]);
  const itemMeta = useMemo(() => entries.map(quantityOf), [entries]);
  const itemsEdited = entries.some(isEdited) || entries.length !== (meal.items?.length ?? 0);

  // Per serving as saved, plus whatever the item changes added or took away (so anything that wasn't an item is kept),
  // then times the servings now chosen. With no item changes this is the saved nutrients scaled by servings.
  const shown = useMemo(() => {
    const was = sumNutrients(meal.items ?? []);
    const now = sumNutrients(items);
    const out = {} as Nutrients;
    for (const k of NUTRIENT_KEYS) out[k] = Math.round(((Number(meal[k]) || 0) / Number(meal.servings) + (now[k] - was[k])) * servings * 10) / 10;
    return out;
  }, [meal, items, servings]);
  // The saved insights plus those of items added here that are still in the meal
  const savedInsights = useMemo(() => (meal.notes ?? "").split("\n").filter(Boolean), [meal.notes]);
  const insights = useMemo(() => mergeInsights(savedInsights, addedInsights, entries), [savedInsights, addedInsights, entries]);
  const insightsEdited = insights.length !== savedInsights.length;
  const dirty = servings !== Number(meal.servings) || mealType !== meal.meal_type || place.trim() !== (meal.place ?? "") || itemsEdited || insightsEdited;

  async function save() {
    const parsed = mealWriteSchema.safeParse({ ...shown, name: meal.name, servings, meal_type: mealType, place });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    setBusy(true);
    const { data, error } = await createClient()
      .from("meals")
      .update({ ...parsed.data, ...(itemsEdited ? { items } : {}), ...(insightsEdited ? { notes: insights.join("\n") || null } : {}) })
      .eq("id", meal.id)
      .select()
      .single();
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    rememberPlace(place);
    await syncMeal(meal.id, "upsert");
    setBusy(false);
    toast.success("Meal updated");
    onChange(data as Meal);
    onClose();
  }

  async function remove() {
    setDeleting(true);
    // Before the row goes: the Google Health entry id lives on it (the server only reads it and finishes the Google side afterwards)
    await syncMeal(meal.id, "delete");
    const supabase = createClient();
    const { error } = await supabase.from("meals").delete().eq("id", meal.id);
    if (error) {
      setDeleting(false);
      return toast.error(error.message);
    }
    // The photo can go on its own; nobody needs to wait for it
    if (meal.image_path) void supabase.storage.from("meal-images").remove([meal.image_path]);
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
            {meal.place ? <Badge variant="secondary">📍 {meal.place}</Badge> : null}
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
          <fieldset disabled={!online} className="contents">
            <MealTypePicker value={mealType} onChange={setMealType} />
          </fieldset>
          <fieldset disabled={!online} className="contents">
            <Stepper value={servings} onChange={setServings} />
          </fieldset>
        </div>

        <fieldset disabled={!online} className="contents">
          <PlacePicker value={place} onChange={setPlace} />
        </fieldset>

        <div className="grid gap-3">
          <MacroBar label="Protein" value={shown.protein_g} macro="protein" />
          <MacroBar label="Carbs" value={shown.carbs_g} macro="carbs" />
          <MacroBar label="Fat" value={shown.fat_g} macro="fat" />
        </div>
        <NutrientGrid totals={shown} />

        <section className="grid gap-3">
          <SectionTitle>
            {items.length > 0 ? "Detected items" : "Items"} <span className="font-normal tracking-normal normal-case">(per serving)</span>
          </SectionTitle>
          {items.length > 0 && (
            <EditableItemList
              disabled={!online}
              openGroup={(i) => !savedIds.current.has(entries[i]?.id)}
              items={items}
              meta={itemMeta}
              onStep={(i, dir) => setEntries((xs) => xs.map((e, j) => (j === i ? stepEntry(e, dir) : e)))}
              canRemove={() => true}
              // Any item can be taken out, including ones the meal was saved with; the totals follow and Save keeps the change
              onRemove={(i) => setEntries((xs) => xs.filter((_, j) => j !== i))}
            />
          )}
          <AddItem
            onBusyChange={setAdding}
            onAdd={(more, insights) => {
              const added = toEntries(more, () => crypto.randomUUID());
              setEntries((xs) => [...xs, ...added]);
              if (insights.length) setAddedInsights((xs) => [...xs, { ids: added.map((e) => e.id), insights }]);
            }}
          />
        </section>

        {insights.length > 0 && (
          <section className="grid gap-3">
            <SectionTitle>AI insights</SectionTitle>
            <Insights insights={insights} />
          </section>
        )}
      </div>

      <DrawerFooter className="flex-row gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="xl" className="flex-1" disabled={busy || deleting || !online}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} {deleting ? "Deleting…" : "Delete"}
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
        <Button size="xl" className="flex-1" onClick={save} disabled={busy || deleting || adding || !dirty || !online}>
          {busy && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </DrawerFooter>
    </>
  );
}
