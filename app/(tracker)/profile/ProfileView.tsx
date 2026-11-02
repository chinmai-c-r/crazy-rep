"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CloudOff, Loader2, LogOut, Mail, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { TextField } from "@/components/form-fields";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DIET, DIET_OPTIONS } from "@/lib/diet";
import { useProfile, useUser } from "@/lib/hooks";
import { clearOfflineData, useOnline } from "@/lib/offline";
import { disablePush } from "@/lib/push";
import { ACTIVITY_LABELS, calculateGoals } from "@/lib/nutrition";
import { activitySchema, goalSchema, profileSchema, sexSchema, type ProfileInput, type ProfileValues } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { OfflineNote } from "../_components/OfflineBanner";
import { ProfileSkeleton } from "../_components/Skeletons";
import { Page, PageHeader, SectionTitle } from "../_components/Page";
import { useAutosaveProfile, type SaveStatus } from "./useAutosaveProfile";
import GoogleHealthCard from "./GoogleHealthCard";
import RemindersCard from "./RemindersCard";
import ThemePicker from "./ThemePicker";

const GOAL_LABELS = { lose: "Lose fat", maintain: "Maintain", gain: "Build muscle" } as const;
const SEX_LABELS = { male: "Male", female: "Female" } as const;

export default function ProfileView() {
  const { profile, loading, unavailable } = useProfile();
  if (loading) return <ProfileSkeleton />;
  if (!profile)
    return (
      <Page>
        {unavailable ? (
          <OfflineNote>Your profile isn&apos;t saved on this device yet. Connect to the internet to load it.</OfflineNote>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>Could not load your profile.</AlertDescription>
          </Alert>
        )}
      </Page>
    );
  return <ProfileForm initial={profile} />;
}

function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { email } = useUser();
  const online = useOnline();

  const fields: Partial<Profile> = { ...initial };
  delete fields.id; // not an editable field
  const form = useForm<ProfileInput, unknown, ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: { ...fields, display_name: fields.display_name ?? "", water_goal_ml: fields.water_goal_ml ?? 2500, diet: fields.diet ?? DEFAULT_DIET },
  });
  const { control, setValue } = form;
  const autosave = useAutosaveProfile(form, initial);

  const [sex, age, height, weight, activity, goal] = useWatch({
    control,
    name: ["sex", "age", "height_cm", "weight_kg", "activity_level", "goal"],
  });
  const body = profileSchema.pick({ sex: true, age: true, height_cm: true, weight_kg: true }).safeParse({ sex, age, height_cm: height, weight_kg: weight });
  const calc =
    body.success && body.data.sex && body.data.age && body.data.height_cm && body.data.weight_kg
      ? calculateGoals({
          sex: body.data.sex,
          age: body.data.age,
          height_cm: body.data.height_cm,
          weight_kg: body.data.weight_kg,
          activity_level: activity as ProfileValues["activity_level"],
          goal: goal as ProfileValues["goal"],
        })
      : null;

  function applyTargets() {
    if (!calc) return;
    for (const k of ["calorie_goal", "protein_goal_g", "carbs_goal_g", "fat_goal_g"] as const) {
      setValue(k, calc[k], { shouldDirty: true, shouldValidate: true });
    }
    toast.success("Recommended targets applied");
  }

  async function signOut() {
    await disablePush(); // this phone stops getting this account's reminders
    await createClient().auth.signOut();
    clearOfflineData(queryClient);
    router.replace("/login");
    router.refresh();
  }

  return (
    <Page narrow>
      <PageHeader title="Profile and goals">
        <SaveIndicator status={autosave.status} onRetry={autosave.retry} />
      </PageHeader>

      <Card className="rounded-3xl">
        <CardContent className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary font-heading text-2xl text-primary-foreground uppercase" aria-hidden>
            {(initial.display_name || email || "?").charAt(0)}
          </span>
          <div className="min-w-0">
            {initial.display_name && <p className="truncate text-lg font-semibold">{initial.display_name}</p>}
            <p className="flex items-center gap-2 text-base break-all text-muted-foreground sm:text-lg">
              <Mail className="size-4 shrink-0" aria-hidden />
              {email ?? "…"}
            </p>
          </div>
        </CardContent>
      </Card>

      {!online && <OfflineNote>You&apos;re offline, so your profile is read-only. Reconnect to change it. You can still pick a theme.</OfflineNote>}

      <form onSubmit={(e) => e.preventDefault()} noValidate className="grid gap-5">
        {/* A disabled fieldset turns off every field and button inside it */}
        <fieldset disabled={!online} className="grid min-w-0 gap-5 disabled:opacity-70">
        <Card className="rounded-3xl">
          <CardContent className="grid gap-5">
            <SectionTitle>About you</SectionTitle>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField control={control} name="display_name" label="Display name" className="sm:col-span-2" autoComplete="nickname" />
              <Controller
                control={control}
                name="sex"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="sex">Sex</FieldLabel>
                    <Select value={(field.value as string) ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="sex" className="w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {sexSchema.options.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SEX_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <NumberField control={control} name="age" label="Age" />
              <NumberField control={control} name="height_cm" label="Height (cm)" decimal />
              <NumberField control={control} name="weight_kg" label="Weight (kg)" decimal />
              <Controller
                control={control}
                name="activity_level"
                render={({ field }) => (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="activity">Activity level</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="activity" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activitySchema.options.map((a) => (
                          <SelectItem key={a} value={a}>
                            {ACTIVITY_LABELS[a]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="goal"
                render={({ field }) => (
                  <Field className="sm:col-span-2">
                    <FieldLabel>Goal</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="w-full"
                    >
                      {goalSchema.options.map((g) => (
                        <ToggleGroupItem
                          key={g}
                          value={g}
                          className="h-11 flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          {GOAL_LABELS[g]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="diet"
                render={({ field }) => (
                  <Field className="sm:col-span-2">
                    <FieldLabel>Diet</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={String(field.value ?? DEFAULT_DIET)}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="grid w-full grid-cols-2 sm:grid-cols-4"
                      aria-label="Diet"
                    >
                      {DIET_OPTIONS.map((d) => (
                        <ToggleGroupItem
                          key={d.id}
                          value={d.id}
                          className="h-11 min-w-0 gap-1.5 px-2 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          <span aria-hidden>{d.emoji}</span> {d.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <p className="h-4 text-xs text-muted-foreground">{DIET_OPTIONS.find((d) => d.id === field.value)?.hint}</p>
                  </Field>
                )}
              />
            </FieldGroup>

            {calc ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm">
                  BMR <b className="text-primary">{calc.bmr}</b> · Maintenance <b className="text-primary">{calc.tdee}</b> kcal/day
                </p>
                <Button type="button" className="rounded-full" onClick={applyTargets}>
                  Use recommended targets
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Fill in sex, age, height and weight to get recommended targets.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="grid gap-5">
            <SectionTitle>Daily targets</SectionTitle>
            <FieldGroup className="grid grid-cols-2 gap-4">
              <NumberField control={control} name="calorie_goal" label="Calories (kcal)" />
              <NumberField control={control} name="protein_goal_g" label="Protein (g)" />
              <NumberField control={control} name="carbs_goal_g" label="Carbs (g)" />
              <NumberField control={control} name="fat_goal_g" label="Fat (g)" />
              <NumberField control={control} name="water_goal_ml" label="Water (ml)" />
            </FieldGroup>
          </CardContent>
        </Card>

        </fieldset>
      </form>

      <GoogleHealthCard />

      <RemindersCard />

      <ThemePicker />

      <Card className="rounded-3xl bg-transparent">
        <CardContent className="grid gap-4">
          <SectionTitle>Account</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" className="rounded-full" onClick={signOut} disabled={!online}>
              <LogOut /> Sign out
            </Button>
            <Button asChild variant="link">
              <Link href="/privacy">Privacy policy</Link>
            </Button>
            <DeleteAccount />
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}

/** Where the automatic save is at, in a small pill beside the title. */
function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <div aria-live="polite" className="h-8 text-sm">
      {status === "saving" && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…
        </span>
      )}
      {status === "saved" && (
        <span className="inline-flex items-center gap-1.5 text-primary animate-in fade-in">
          <Check className="size-3.5" aria-hidden /> Saved
        </span>
      )}
      {status === "invalid" && <span className="text-warn">Fix the highlighted fields to save</span>}
      {status === "error" && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 text-destructive underline-offset-2 hover:underline">
          <CloudOff className="size-3.5" aria-hidden /> Not saved. Tap to retry
        </button>
      )}
    </div>
  );
}

function NumberField({
  control,
  name,
  label,
  decimal,
}: {
  control: ReturnType<typeof useForm<ProfileInput, unknown, ProfileValues>>["control"];
  name: keyof ProfileInput;
  label: string;
  decimal?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            type="number"
            inputMode={decimal ? "decimal" : "numeric"}
            step={decimal ? "0.1" : "1"}
            aria-invalid={fieldState.invalid}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={(field.value as string | number | null) ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

function DeleteAccount() {
  const router = useRouter();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      return toast.error((await res.json()).error ?? "Could not delete account.");
    }
    await createClient().auth.signOut();
    clearOfflineData(queryClient);
    toast.success("Your account has been deleted");
    router.replace("/");
  }

  return (
    <AlertDialog onOpenChange={() => setTyped("")}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="rounded-full" disabled={!online}>
          <Trash2 /> Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account, all meals and photos. Type <b>DELETE</b> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={typed !== "DELETE" || busy} onClick={confirm}>
            {busy && <Loader2 className="animate-spin" />}
            Delete forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
