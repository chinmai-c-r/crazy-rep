"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { syncMeal } from "@/lib/google-health-client";
import { compressImage } from "@/lib/image";
import { guessMealType, scaleNutrients, sumNutrients } from "@/lib/nutrition";
import { analyzeResponseSchema, mealDetailsSchema, mealWriteSchema, type AnalysisSource } from "@/lib/schemas";

type Provider = "ai" | "usda" | "indb" | "ifct";
const PROVIDER_LABEL: Record<Exclude<Provider, "ai">, { badge: string; credit: string }> = {
  usda: { badge: "USDA food data", credit: "USDA FoodData Central" },
  indb: { badge: "Indian food data", credit: "Indian Nutrient Databank (INDB)" },
  ifct: { badge: "Indian food data", credit: "Indian Food Composition Tables 2017 (ICMR-NIN)" },
};
import { invalidateRecentDishes, invalidateSummary, useUser } from "@/lib/hooks";
import { createClient } from "@/lib/supabase/client";
import { MEAL_TYPES, type Analysis, type FoodItem, type Meal, type MealType } from "@/lib/types";
import { Page, PageHeader } from "../_components/Page";
import AnalyzingScreen from "./AnalyzingScreen";
import DetailsStage from "./DetailsStage";
import ResultStage from "./ResultStage";

type Stage = "details" | "analyzing" | "result";
type Details = z.input<typeof mealDetailsSchema>;

const EMPTY: Details = { name: "", portion: "", notes: "" };

export default function ScanView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [stage, setStage] = useState<Stage>("details");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Details, unknown, z.output<typeof mealDetailsSchema>>({
    resolver: zodResolver(mealDetailsSchema),
    defaultValues: EMPTY,
    mode: "onTouched",
  });

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [source, setSource] = useState<AnalysisSource>("photo");
  const [provider, setProvider] = useState<Provider>("ai");
  const [items, setItems] = useState<FoodItem[]>([]);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState<MealType>(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    return MEAL_TYPES.some((m) => m.value === t) ? (t as MealType) : guessMealType();
  });
  const [saving, setSaving] = useState(false);
  const saved = useRef(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Next keeps this page alive (hidden) after navigating away, so state survives visits.
  // On each visit, follow ?type= from links like "Add breakfast"; after a meal is saved, start fresh next time.
  useLayoutEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL on every visit
    if (MEAL_TYPES.some((m) => m.value === t)) setMealType(t as MealType);
    return () => {
      if (!saved.current) return;
      saved.current = false;
      reset();
      setServings(1);
      setSaving(false);
      setMealType(guessMealType());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per visit, not per render
  }, []);

  const totals = useMemo(() => scaleNutrients(sumNutrients(items), servings), [items, servings]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    const small = await compressImage(file);
    setBlob(small);
    setPreview(URL.createObjectURL(small));
  }

  function removePhoto() {
    setBlob(null);
    setPreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  const analyze = form.handleSubmit(async (details) => {
    setStage("analyzing");
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const body = new FormData();
    if (blob) body.append("image", blob, "meal.jpg");
    body.append("name", details.name);
    if (details.portion) body.append("portion", details.portion);
    if (details.notes) body.append("notes", details.notes);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body, signal: ctrl.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");
      const { analysis: a, source: src, provider: prov } = analyzeResponseSchema.parse(json);
      if (!a.is_food) {
        setError(
          blob
            ? "We couldn't spot any food in that photo. Try a clearer shot of your plate."
            : "That doesn't look like a food or drink. Try a dish name like “Paneer butter masala”.",
        );
        return setStage("details");
      }
      setAnalysis(a);
      setSource(src);
      setProvider(prov);
      setItems(a.items);
      setServings(1);
      setStage("result");
    } catch (e) {
      // Cancelling isn't an error: just go back to the form
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      setStage("details");
    }
  });

  async function save() {
    if (!analysis) return;
    if (!(await form.trigger("name"))) return;

    const parsed = mealWriteSchema.safeParse({ ...totals, name: form.getValues("name"), meal_type: mealType, servings, source });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);

    setSaving(true);
    const supabase = createClient();
    // The session user is already cached; only hit the auth server if it somehow isn't
    const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return router.replace("/login?next=/scan");

    let path: string | null = null;
    if (blob) {
      const candidate = `${uid}/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage.from("meal-images").upload(candidate, blob, { contentType: "image/jpeg" });
      if (!upload.error) path = candidate;
    }

    const { data: meal, error } = await supabase
      .from("meals")
      .insert({
        ...parsed.data,
        image_path: path,
        health_score: analysis.health_score,
        confidence: analysis.confidence,
        items,
        notes: analysis.insights.join("\n") || null,
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      if (path) await supabase.storage.from("meal-images").remove([path]);
      return toast.error(error.message);
    }
    // Google Health mirroring is best effort and slow (token refresh + Google call): don't make the user wait for it
    void syncMeal(meal.id, "upsert");
    // Put the saved row straight into any cached day it belongs to, so the dashboard shows it without a refetch
    const eaten = new Date(meal.eaten_at).getTime();
    for (const [key, rows] of queryClient.getQueriesData<Meal[]>({ queryKey: ["meals"] })) {
      const [, start, end] = key as [string, string, string];
      if (rows && eaten >= new Date(start).getTime() && eaten < new Date(end).getTime()) {
        queryClient.setQueryData<Meal[]>(key, [meal as Meal, ...rows]);
      }
    }
    void invalidateSummary(queryClient);
    void invalidateRecentDishes(queryClient);
    toast.success("Meal logged");
    saved.current = true;
    router.push("/dashboard");
  }

  function reset() {
    setStage("details");
    removePhoto();
    setAnalysis(null);
    setItems([]);
    setError(null);
    form.reset(EMPTY);
  }

  return (
    <Page narrow>
      <PageHeader title="Log a meal">
        {(stage !== "details" || blob || form.formState.isDirty) && (
          <Button variant="outline" className="rounded-full" onClick={reset} disabled={stage === "analyzing" || saving}>
            <RotateCcw /> Start over
          </Button>
        )}
      </PageHeader>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stage === "details" && (
        <DetailsStage
          form={form}
          mealType={mealType}
          onMealType={setMealType}
          blob={blob}
          onSubmit={analyze}
          preview={preview}
          onCamera={() => cameraRef.current?.click()}
          onGallery={() => galleryRef.current?.click()}
          onRemove={removePhoto}
          onDrop={onFile}
        />
      )}

      <AnimatePresence>
        {stage === "analyzing" && <AnalyzingScreen preview={preview} name={form.getValues("name")} onCancel={() => abortRef.current?.abort()} />}
      </AnimatePresence>

      {stage === "result" && analysis && (
        <ResultStage
          form={form}
          analysis={analysis}
          source={source}
          provider={provider}
          providerLabel={provider !== "ai" ? PROVIDER_LABEL[provider] : undefined}
          preview={preview}
          totals={totals}
          items={items}
          onRemoveItem={(i) => setItems((xs) => xs.filter((_, j) => j !== i))}
          servings={servings}
          onServings={setServings}
          mealType={mealType}
          onMealType={setMealType}
          saving={saving}
          onSave={save}
          onDiscard={reset}
        />
      )}
    </Page>
  );
}

