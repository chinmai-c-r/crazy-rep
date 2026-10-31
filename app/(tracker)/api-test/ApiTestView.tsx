"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FlaskConical, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TextareaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/lib/hooks";
import { fmt } from "@/lib/nutrition";
import { mealDetailsSchema, type Analysis } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "../_components/ClientOnly";
import { useFlag } from "../_components/Flags";
import { Page, PageHeader, SectionTitle } from "../_components/Page";

type VectorCandidate = { name: string; source: string; similarity: number | null; verdict: string };
type UsdaCandidate = { fdcId: number; description: string; dataType: string; kcalPer100g: number | null; score: number | null; verdict: string };

type Result = {
  appWouldUse: string;
  tookMs: number;
  exact: { source: string | null; calories: number } | null;
  vector: { candidates: VectorCandidate[]; match: { analysis: Analysis; matchedName: string; similarity: number | null; exact?: boolean } | null; reason?: string };
  usda: {
    keyInUse: string;
    skipped: string | null;
    http: { status: number; latencyMs: number; totalHits: number | null; rateLimit: { limit: string | null; remaining: string | null } } | null;
    candidates: UsdaCandidate[];
    match: Analysis | null;
  };
};

const EXAMPLES = [
  { name: "Chole" },
  { name: "Paneer butter masala", portion: "2 bowls" },
  { name: "Chiken biriyani", portion: "1 plate" },
  { name: "Masala chai", portion: "1 cup" },
  { name: "Banana" },
  { name: "Boiled egg", portion: "2" },
];

export default function ApiTestView() {
  const { userId } = useUser();
  const isAdmin = useFlag("admin-users");
  if (!userId) return <PageSkeleton />;
  if (!isAdmin)
    return (
      <Page narrow>
        <Alert>
          <Lock className="size-4" />
          <AlertDescription>This page is only available to administrators.</AlertDescription>
        </Alert>
      </Page>
    );
  return <Tester />;
}

function Tester() {
  const [result, setResult] = useState<Result | null>(null);
  const form = useForm<z.input<typeof mealDetailsSchema>, unknown, z.output<typeof mealDetailsSchema>>({
    resolver: zodResolver(mealDetailsSchema),
    defaultValues: { name: "", portion: "", notes: "" },
  });

  const run = form.handleSubmit(async (values) => {
    const res = await fetch("/api/admin/food-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const json = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    if (!res.ok) return toast.error(json.error ?? "Test failed");
    setResult(json as Result);
  });

  return (
    <Page>
      <PageHeader eyebrow="Admin · developer tools" title="API testing" />

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4">
          <SectionTitle>Meal lookup</SectionTitle>
          <form onSubmit={run} noValidate>
            <FieldGroup className="grid gap-4 sm:grid-cols-3">
              <TextField control={form.control} name="name" label="Meal name" placeholder="e.g. Chole" />
              <TextField control={form.control} name="portion" label="Portion (optional)" placeholder="e.g. 2, 1 bowl, 150 g" />
              <TextareaField control={form.control} name="notes" label="Notes (optional)" rows={1} placeholder="Notes skip similar matches and USDA" />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                <Button type="submit" className="rounded-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                  Run test
                </Button>
                <span className="text-xs text-muted-foreground">Try:</span>
                {EXAMPLES.map((ex) => (
                  <Button
                    key={ex.name + (ex.portion ?? "")}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      form.reset({ name: ex.name, portion: ex.portion ?? "", notes: "" });
                      run();
                    }}
                  >
                    {ex.name}
                    {ex.portion ? ` · ${ex.portion}` : ""}
                  </Button>
                ))}
              </div>
            </FieldGroup>
          </form>
          <p className="text-xs text-muted-foreground">
            Runs every step (exact saved result → similar saved result → USDA) live. Never calls the AI and never writes anything.
          </p>
        </CardContent>
      </Card>

      {result && <ResultView r={result} />}
    </Page>
  );
}

function ResultView({ r }: { r: Result }) {
  const picked = r.vector.match?.analysis ?? r.usda.match;
  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="App would use" value={r.appWouldUse} tone={r.appWouldUse.startsWith("AI") ? "warn" : "good"} />
        <Stat label="Lookup time" value={`${fmt(r.tookMs)} ms`} />
        <Stat label="USDA HTTP" value={r.usda.http ? `${r.usda.http.status} · ${fmt(r.usda.http.latencyMs)} ms` : "—"} tone={r.usda.http ? (r.usda.http.status === 200 ? "good" : "bad") : undefined} />
        <Stat label="USDA quota left" value={r.usda.http?.rateLimit.remaining ? `${r.usda.http.rateLimit.remaining} / ${r.usda.http.rateLimit.limit}` : "—"} />
      </section>

      {r.exact && (
        <Alert>
          <AlertDescription>
            Exact saved result exists ({r.exact.source ?? "unknown source"} · {fmt(r.exact.calories)} kcal). The app returns it instantly.
          </AlertDescription>
        </Alert>
      )}

      {picked && !r.exact && (
        <Card className="rounded-3xl">
          <CardContent className="grid gap-2">
            <SectionTitle>Picked result</SectionTitle>
            <p className="font-semibold">
              {picked.items[0]?.name} <span className="font-normal text-muted-foreground">· {picked.items[0]?.portion} · {fmt(picked.items[0]?.grams)} g</span>
            </p>
            <p className="font-heading text-5xl leading-none text-primary">
              {fmt(picked.totals.calories)}
              <small className="ml-2 font-sans text-base text-muted-foreground">kcal</small>
            </p>
            <p className="text-sm text-muted-foreground">
              P {fmt(picked.totals.protein_g, 1)} g · C {fmt(picked.totals.carbs_g, 1)} g · F {fmt(picked.totals.fat_g, 1)} g · fiber {fmt(picked.totals.fiber_g, 1)} g · sodium{" "}
              {fmt(picked.totals.sodium_mg)} mg
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Similar saved results (vector + text search)</SectionTitle>
            {r.vector.reason && <Badge variant="secondary">{r.vector.reason}</Badge>}
          </div>
          {r.vector.candidates.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {["Name", "Source", "Similarity", "Verdict"].map((h) => (
                    <TableHead key={h} className="text-xs tracking-wider text-muted-foreground uppercase">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.vector.candidates.map((c, i) => (
                  <TableRow key={`${c.name}-${i}`}>
                    <TableCell className="max-w-80 whitespace-normal">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.source}</TableCell>
                    <TableCell>{c.similarity === null ? "text match" : c.similarity.toFixed(3)}</TableCell>
                    <TableCell className={cn("text-xs whitespace-normal", c.verdict.startsWith("ok") ? "text-primary" : "text-muted-foreground")}>{c.verdict}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No saved results to compare yet. Run npm run cache:enrich to fill the cache.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>USDA FoodData Central</SectionTitle>
            <Badge variant="secondary">Key: {r.usda.keyInUse}</Badge>
          </div>
          {r.usda.skipped && <p className="text-sm text-muted-foreground">{r.usda.skipped}</p>}
          {r.usda.candidates.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {["Description", "Type", "kcal/100g", "Score", "Verdict"].map((h) => (
                    <TableHead key={h} className="text-xs tracking-wider text-muted-foreground uppercase">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.usda.candidates.map((c) => (
                  <TableRow key={c.fdcId}>
                    <TableCell className="max-w-72 whitespace-normal">
                      <a href={`https://fdc.nal.usda.gov/food-details/${c.fdcId}/nutrients`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                        {c.description}
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.dataType}</TableCell>
                    <TableCell>{c.kcalPer100g ?? "—"}</TableCell>
                    <TableCell>{c.score ?? "—"}</TableCell>
                    <TableCell className={cn("max-w-64 text-xs whitespace-normal", c.verdict.startsWith("ok") ? "text-primary" : "text-muted-foreground")}>{c.verdict}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !r.usda.skipped && <p className="text-sm text-muted-foreground">USDA returned no foods for this query.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <Card className="gap-1 rounded-2xl px-4 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <b className={cn("text-sm sm:text-base", tone === "good" && "text-primary", tone === "bad" && "text-destructive", tone === "warn" && "text-carbs")}>{value}</b>
    </Card>
  );
}
