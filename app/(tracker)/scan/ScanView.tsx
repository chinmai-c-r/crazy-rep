"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Camera, Check, Database, ImageUp, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TextareaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { compressImage } from "@/lib/image";
import { fmt, guessMealType, scaleNutrients, sumNutrients } from "@/lib/nutrition";
import { analyzeResponseSchema, mealDetailsSchema, mealWriteSchema, type AnalysisSource } from "@/lib/schemas";

type Provider = "ai" | "usda" | "indb" | "ifct";
const PROVIDER_LABEL: Record<Exclude<Provider, "ai">, { badge: string; credit: string }> = {
  usda: { badge: "USDA food data", credit: "USDA FoodData Central" },
  indb: { badge: "Indian food data", credit: "Indian Nutrient Databank (INDB)" },
  ifct: { badge: "Indian food data", credit: "Indian Food Composition Tables 2017 (ICMR-NIN)" },
};
import { createClient } from "@/lib/supabase/client";
import { MEAL_TYPES, type Analysis, type FoodItem, type MealType } from "@/lib/types";
import { MealTypePicker, Stepper } from "../_components/Controls";
import { FoodItemList, Insights } from "../_components/FoodItems";
import MacroBar from "../_components/MacroBar";
import NutrientGrid from "../_components/NutrientGrid";
import { Page, PageHeader, SectionTitle } from "../_components/Page";

type Stage = "details" | "analyzing" | "result";
type Details = z.input<typeof mealDetailsSchema>;

const EMPTY: Details = { name: "", portion: "", notes: "" };

export default function ScanView() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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
    const body = new FormData();
    if (blob) body.append("image", blob, "meal.jpg");
    body.append("name", details.name);
    if (details.portion) body.append("portion", details.portion);
    if (details.notes) body.append("notes", details.notes);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
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
      setError((e as Error).message);
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
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return router.replace("/login?next=/scan");

    let path: string | null = null;
    if (blob) {
      const candidate = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage.from("meal-images").upload(candidate, blob, { contentType: "image/jpeg" });
      if (!upload.error) path = candidate;
    }

    const { error } = await supabase.from("meals").insert({
      ...parsed.data,
      image_path: path,
      health_score: analysis.health_score,
      confidence: analysis.confidence,
      items,
      notes: analysis.insights.join("\n") || null,
    });

    if (error) {
      setSaving(false);
      if (path) await supabase.storage.from("meal-images").remove([path]);
      return toast.error(error.message);
    }
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
      <PageHeader eyebrow="AI calorie estimator" title="Log a meal">
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
        <form onSubmit={analyze} noValidate className="grid gap-5 sm:grid-cols-[1.1fr_1fr]">
          <PhotoPicker
            preview={preview}
            onCamera={() => cameraRef.current?.click()}
            onGallery={() => galleryRef.current?.click()}
            onRemove={removePhoto}
            onDrop={onFile}
          />

          <FieldGroup className="content-start gap-4">
            <TextField
              control={form.control}
              name="name"
              label={<>Meal name <span className="text-primary">*</span></>}
              placeholder="e.g. Chicken biryani"
              maxLength={120}
              autoFocus
              description="Required, at least 3 letters. We estimate nutrition from the name, even without a photo."
            />
            <TextField
              control={form.control}
              name="portion"
              label={<>Portion or quantity <Optional /></>}
              placeholder="e.g. 1 large plate, 2 rotis, 250 g"
              maxLength={120}
            />
            <TextareaField
              control={form.control}
              name="notes"
              label={<>Notes <Optional /></>}
              placeholder="e.g. cooked in ghee, extra cheese, diet coke"
              maxLength={300}
              rows={2}
            />
            <Button type="submit" size="xl" className="w-full">
              <Sparkles /> {blob ? "Analyse photo" : "Estimate from name"}
            </Button>
            {!blob && (
              <p className="text-xs text-muted-foreground">Tip: add a portion or a photo for a more accurate estimate.</p>
            )}
          </FieldGroup>
        </form>
      )}

      {stage === "analyzing" && (
        <div className="grid gap-5 sm:grid-cols-[1.1fr_1fr]">
          {preview ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={preview} alt="Your meal" className="size-full object-cover" />
              <ScanOverlay />
            </div>
          ) : null}
          <Card className={preview ? "rounded-3xl border-0 bg-transparent" : "rounded-3xl sm:col-span-2"}>
            <CardContent className="grid justify-items-center gap-4 py-10 text-center text-muted-foreground">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p>{preview ? "Identifying foods and estimating portions…" : `Estimating nutrition for “${form.getValues("name")}”…`}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stage === "result" && analysis && (
        <motion.div className="grid gap-4" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl">
            <CardContent className={preview ? "grid gap-5 sm:grid-cols-[240px_1fr]" : "grid gap-5"}>
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img src={preview} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
              )}
              <div className="grid content-start gap-3">
                <div className="flex flex-wrap gap-2">
                  <SourceBadge source={source} provider={provider} />
                  <Badge className="bg-primary/15 text-primary">
                    <Check /> {Math.round(analysis.confidence * 100)}% confidence
                  </Badge>
                  <Badge variant="secondary">Health score {analysis.health_score}/10</Badge>
                </div>
                <TextField control={form.control} name="name" label="Meal name" maxLength={120} className="max-w-md" />
                <p className="font-heading text-6xl leading-none text-primary">
                  {fmt(totals.calories)}
                  <small className="ml-2 font-sans text-base text-muted-foreground">kcal</small>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <MealTypePicker value={mealType} onChange={setMealType} />
                  <Stepper value={servings} onChange={setServings} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl">
              <CardContent className="grid gap-4">
                <SectionTitle>Macros</SectionTitle>
                <MacroSplit protein={totals.protein_g} carbs={totals.carbs_g} fat={totals.fat_g} />
                <div className="grid gap-3">
                  <MacroBar label="Protein" value={totals.protein_g} macro="protein" />
                  <MacroBar label="Carbs" value={totals.carbs_g} macro="carbs" />
                  <MacroBar label="Fat" value={totals.fat_g} macro="fat" />
                </div>
                <SectionTitle>Other nutrients</SectionTitle>
                <NutrientGrid totals={totals} />
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardContent className="grid gap-4">
                <SectionTitle>
                  Detected items <span className="font-normal tracking-normal normal-case">(per serving)</span>
                </SectionTitle>
                <FoodItemList items={items} onRemove={(i) => setItems((xs) => xs.filter((_, j) => j !== i))} />
                {analysis.insights.length > 0 && (
                  <>
                    <SectionTitle>AI insights</SectionTitle>
                    <Insights insights={analysis.insights} />
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  {provider !== "ai"
                    ? `Source: ${PROVIDER_LABEL[provider].credit}. Adjust servings to match what you ate.`
                    : preview
                      ? "Estimates from a photo. Adjust servings or remove items for better accuracy."
                      : "Estimated from the meal name. Add a photo next time for better accuracy."}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex gap-3 rounded-full bg-background/85 p-2 backdrop-blur-lg lg:bottom-4">
            <Button variant="outline" size="xl" className="flex-1" onClick={reset} disabled={saving}>
              Discard
            </Button>
            <Button size="xl" className="flex-1" onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Log this meal
            </Button>
          </div>
        </motion.div>
      )}
    </Page>
  );
}

function Optional() {
  return <span className="font-normal text-muted-foreground">(optional)</span>;
}

function SourceBadge({ source, provider }: { source: AnalysisSource; provider: Provider }) {
  if (provider !== "ai")
    return (
      <Badge variant="secondary">
        <Database /> {PROVIDER_LABEL[provider].badge}
      </Badge>
    );
  if (source === "photo")
    return (
      <Badge variant="secondary">
        <Camera /> From your photo
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <Sparkles /> Estimated from name
    </Badge>
  );
}

function PhotoPicker({
  preview,
  onCamera,
  onGallery,
  onRemove,
  onDrop,
}: {
  preview: string | null;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
  onDrop: (file: File | undefined) => void;
}) {
  if (preview)
    return (
      <div className="grid content-start gap-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={preview} alt="Your meal" className="size-full object-cover" />
          <Badge className="absolute top-3 left-3 bg-background/80 text-foreground backdrop-blur">
            <Check className="text-primary" /> Photo added · better accuracy
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={onGallery}>
            <ImageUp /> Change
          </Button>
          <Button type="button" variant="ghost" className="flex-1 rounded-full text-muted-foreground" onClick={onRemove}>
            <Trash2 /> Remove photo
          </Button>
        </div>
      </div>
    );

  return (
    <div
      className="grid content-center justify-items-center gap-3 rounded-3xl border-2 border-dashed border-primary/30 bg-[radial-gradient(circle_at_50%_0,rgb(198_255_0/0.08),transparent_60%)] bg-card px-5 py-8 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="grid size-16 animate-bob place-items-center rounded-2xl bg-primary/10 text-primary">
        <Camera className="size-8" />
      </div>
      <h2 className="font-heading text-2xl tracking-wide">
        Add a photo <span className="font-sans text-sm font-normal tracking-normal text-muted-foreground">(optional)</span>
      </h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        A photo improves accuracy: the AI can see the actual portion, sides and sauces.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" className="rounded-full" onClick={onCamera}>
          <Camera /> Take photo
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={onGallery}>
          <ImageUp /> Gallery
        </Button>
      </div>
    </div>
  );
}

function ScanOverlay() {
  const corner = "absolute size-9 border-4 border-primary";
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-[14%]">
        <i className={`${corner} top-0 left-0 rounded-tl-xl border-r-0 border-b-0`} />
        <i className={`${corner} top-0 right-0 rounded-tr-xl border-b-0 border-l-0`} />
        <i className={`${corner} bottom-0 left-0 rounded-bl-xl border-t-0 border-r-0`} />
        <i className={`${corner} right-0 bottom-0 rounded-br-xl border-t-0 border-l-0`} />
      </div>
      <div className="absolute inset-x-[10%] h-0.5 animate-scan-beam bg-primary shadow-[0_0_24px_6px_rgb(198_255_0/0.7)]" />
    </div>
  );
}

function MacroSplit({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const kcal = protein * 4 + carbs * 4 + fat * 9 || 1;
  const parts = [
    { label: "Protein", pct: (protein * 4) / kcal, color: "bg-protein" },
    { label: "Carbs", pct: (carbs * 4) / kcal, color: "bg-carbs" },
    { label: "Fat", pct: (fat * 9) / kcal, color: "bg-fat" },
  ];
  return (
    <div className="grid gap-2.5">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <span key={p.label} className={p.color} style={{ width: `${p.pct * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <i className={`size-2.5 rounded-sm ${p.color}`} /> {p.label} {Math.round(p.pct * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
