"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CloudOff, Loader2, LogOut, Palette, ShieldUser, Target, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useFormState, useWatch } from "react-hook-form";
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
import { DEFAULT_DIET, DIET_OPTIONS } from "@/lib/diet";
import { useProfile, useUser } from "@/lib/hooks";
import { ACTIVITY_LABELS, calculateGoals } from "@/lib/nutrition";
import { clearOfflineData, useOnline } from "@/lib/offline";
import { disablePush } from "@/lib/push";
import { activitySchema, profileSchema, sexSchema, type ProfileInput, type ProfileValues } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Goal, Profile } from "@/lib/types";
import { assessPlan, recommendedRate, suggestedTarget } from "@/lib/weight-plan";
import { OfflineNote } from "../_components/OfflineBanner";
import { Page, PageHeader, SectionTitle } from "../_components/Page";
import { ProfileSkeleton } from "../_components/Skeletons";
import GoogleHealthCard from "./GoogleHealthCard";
import { SEX_LABELS } from "./labels";
import NumberField from "./NumberField";
import ProfileHero from "./ProfileHero";
import { TabBar, TabPanels, type ProfileTab } from "./ProfileTabs";
import RemindersCard from "./RemindersCard";
import TargetsSection from "./TargetsSection";
import WeightGoalCard from "./WeightGoalCard";
import ThemePicker from "./ThemePicker";
import { useAutosaveProfile, type SaveStatus } from "./useAutosaveProfile";

type TabId = "body" | "targets" | "prefs" | "account";

/** Which tab each form field lives on, so a tab can flag a field that needs fixing. */
const FIELD_TAB: Partial<Record<keyof ProfileInput, TabId>> = {
  display_name: "body",
  sex: "body",
  age: "body",
  height_cm: "body",
  weight_kg: "body",
  activity_level: "body",
  goal: "body",
  target_weight_kg: "body",
  weekly_rate_kg: "body",
  calorie_goal: "targets",
  protein_goal_g: "targets",
  carbs_goal_g: "targets",
  fat_goal_g: "targets",
  water_goal_ml: "targets",
  diet: "body",
};

const TAB_IDS: TabId[] = ["body", "targets", "prefs", "account"];

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
  const { errors } = useFormState({ control });

  // The open tab lives in the address (?tab=targets) so a reload or a shared link lands in the same place
  const [tab, setTab] = useState<TabId>(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TAB_IDS.includes(t as TabId) ? (t as TabId) : "body";
  });
  const [dir, setDir] = useState<1 | -1>(1);
  const open = (next: string) => {
    setDir(TAB_IDS.indexOf(next as TabId) >= TAB_IDS.indexOf(tab) ? 1 : -1);
    setTab(next as TabId);
    window.history.replaceState(null, "", next === "body" ? window.location.pathname : `?tab=${next}`);
    window.scrollTo({ top: Math.min(window.scrollY, 160), behavior: "instant" });
  };

  const bad = new Set(Object.keys(errors).map((k) => FIELD_TAB[k as keyof ProfileInput]));
  const tabs: ProfileTab[] = [
    { id: "body", label: "Body", icon: User, alert: bad.has("body") },
    { id: "targets", label: "Targets", icon: Target, alert: bad.has("targets") },
    { id: "prefs", label: "Prefs", icon: Palette, alert: false },
    { id: "account", label: "Account", icon: ShieldUser },
  ];

  const [sex, age, height, weight, activity, goal, targetRaw, paceRaw, calorieGoal] = useWatch({
    control,
    name: ["sex", "age", "height_cm", "weight_kg", "activity_level", "goal", "target_weight_kg", "weekly_rate_kg", "calorie_goal"],
  });
  const losingOrGaining = goal === "lose" || goal === "gain";
  const target = Number(targetRaw) || null;
  /** The pace chosen, or the one we'd recommend for this body */
  const rate = losingOrGaining ? (Number(paceRaw) || recommendedRate(goal, Number(weight) || 70)) : null;
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
          weekly_rate_kg: rate,
        })
      : null;
  const weightPlan =
    calc && body.success && body.data.sex && body.data.height_cm && body.data.weight_kg && losingOrGaining
      ? assessPlan({
          goal,
          sex: body.data.sex,
          height_cm: body.data.height_cm,
          weight_kg: body.data.weight_kg,
          target_kg: target,
          tdee: calc.tdee,
          bmr: calc.bmr,
          calories: Number(calorieGoal) || calc.calorie_goal,
          requestedRate: rate,
        })
      : null;

  function applyTargets() {
    if (!calc) return;
    for (const k of ["calorie_goal", "protein_goal_g", "carbs_goal_g", "fat_goal_g"] as const) {
      setValue(k, calc[k], { shouldDirty: true, shouldValidate: true });
    }
    toast.success("Suggested targets applied");
  }

  /** Refills calories and macros for a goal and pace, so the plan and the daily targets never disagree */
  function refill(nextGoal: Goal, nextRate: number | null) {
    if (!body.success || !body.data.sex || !body.data.age || !body.data.height_cm || !body.data.weight_kg) return;
    const next = calculateGoals({ sex: body.data.sex, age: body.data.age, height_cm: body.data.height_cm, weight_kg: body.data.weight_kg, activity_level: activity as ProfileValues["activity_level"], goal: nextGoal, weekly_rate_kg: nextRate });
    for (const k of ["calorie_goal", "protein_goal_g", "carbs_goal_g", "fat_goal_g"] as const) setValue(k, next[k], { shouldDirty: true, shouldValidate: true });
  }

  /** A new pace (or a safer one) updates the daily targets to match */
  function changePace(next: number) {
    setValue("weekly_rate_kg", String(next), { shouldDirty: true, shouldValidate: true });
    refill(goal, next);
    toast.success("Daily targets updated for this pace");
  }

  /** A new goal brings a fitting pace and target, and the daily targets follow */
  function changeGoal(next: Goal) {
    setValue("goal", next, { shouldDirty: true, shouldValidate: true });
    const w = Number(weight) || 0;
    const h = Number(height) || 0;
    const nextRate = next === "maintain" ? null : recommendedRate(next, w || 70);
    setValue("weekly_rate_kg", nextRate === null ? "" : String(nextRate), { shouldDirty: true, shouldValidate: true });
    // Keep a target that still points the right way; otherwise suggest one
    const wrongSide = !target || (next === "lose" && target >= w - 0.5) || (next === "gain" && target <= w + 0.5);
    if (next !== "maintain" && w && h && wrongSide) setValue("target_weight_kg", String(suggestedTarget(next, w, h)), { shouldDirty: true, shouldValidate: true });
    refill(next, nextRate);
    toast.success("Daily targets updated for your new goal");
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
      <PageHeader title="Profile">
        <SaveIndicator status={autosave.status} onRetry={autosave.retry} />
      </PageHeader>

      <ProfileHero control={control} savedName={initial.display_name} email={email} />

      {!online && <OfflineNote>You&apos;re offline, so your profile is read-only. Reconnect to change it. You can still pick a theme.</OfflineNote>}

      <TabBar tabs={tabs} active={tab} onChange={open} />

      <form onSubmit={(e) => e.preventDefault()} noValidate className="min-w-0">
        <TabPanels active={tab} dir={dir}>
          {tab === "body" && (
            // A disabled fieldset turns off every field and button inside it
            <fieldset disabled={!online} className="grid min-w-0 gap-5 disabled:opacity-70">
              <Card className="rounded-3xl">
                <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5">
                  <SectionTitle>About you</SectionTitle>
                  <FieldGroup className="grid grid-cols-2 gap-4">
                    <TextField control={control} name="display_name" label="Display name" className="col-span-2" autoComplete="nickname" />
                    <Controller
                      control={control}
                      name="sex"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid} className="col-span-2">
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
                    <div className="col-span-2 grid grid-cols-3 items-end gap-3">
                      <NumberField control={control} name="age" label="Age" />
                      <NumberField control={control} name="height_cm" label="Height (cm)" decimal />
                      <NumberField control={control} name="weight_kg" label="Current weight (kg)" decimal />
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="rounded-3xl">
                <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-5">
                  <SectionTitle>Activity</SectionTitle>
                  <Controller
                    control={control}
                    name="activity_level"
                    render={({ field }) => (
                      <Field>
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
                </CardContent>
              </Card>
              <Card className="rounded-3xl">
                <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
                  <SectionTitle>Diet</SectionTitle>
                  <Controller
                    control={control}
                    name="diet"
                    render={({ field }) => (
                      <Field>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          value={String(field.value ?? DEFAULT_DIET)}
                          onValueChange={(v) => v && field.onChange(v)}
                          className="grid w-full grid-cols-2 sm:grid-cols-4"
                          aria-label="Diet"
                        >
                          {DIET_OPTIONS.map((d) => (
                            <ToggleGroupItem key={d.id} value={d.id} className="h-11 min-w-0 gap-1.5 px-2 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                              <span aria-hidden>{d.emoji}</span> {d.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        <p className="min-h-4 text-xs text-muted-foreground">{DIET_OPTIONS.find((d) => d.id === field.value)?.hint}</p>
                      </Field>
                    )}
                  />
                </CardContent>
              </Card>
            </fieldset>
          )}

          {tab === "targets" && (
            <fieldset disabled={!online} className="grid min-w-0 gap-5 disabled:opacity-70">
              <WeightGoalCard control={control} goal={goal as Goal} rate={rate} heightCm={body.success ? body.data.height_cm : null} onGoal={changeGoal} onPace={changePace} />
              <TargetsSection control={control} calc={calc} onApply={applyTargets} weightPlan={weightPlan} target={target} onSafer={changePace} />
            </fieldset>
          )}

          {tab === "prefs" && (
            <>
              <RemindersCard />
              <ThemePicker />
            </>
          )}

          {tab === "account" && (
            <>
              <GoogleHealthCard />
              <Card className="rounded-3xl bg-transparent">
                <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
                  <SectionTitle>Account</SectionTitle>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="button" variant="outline" className="rounded-full" onClick={signOut} disabled={!online}>
                      <LogOut /> Sign out
                    </Button>
                    <Button asChild variant="link">
                      <Link href="/privacy">Privacy policy</Link>
                    </Button>
                    <DeleteAccount />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabPanels>
      </form>
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
