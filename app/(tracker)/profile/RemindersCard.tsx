"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { keys, useUser } from "@/lib/hooks";
import { useOnline } from "@/lib/offline";
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  VAPID_PUBLIC_KEY,
  type PushSupport,
} from "@/lib/push";
import {
  DEFAULT_REMINDER_TIMES,
  hhmm,
  REMINDER_LABELS,
  REMINDER_MEALS,
  type ReminderMeal,
  type ReminderSettings,
} from "@/lib/reminders";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SectionTitle } from "../_components/Page";

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const FRESH: ReminderSettings = {
  enabled: false,
  timezone: "UTC",
  breakfast_at: DEFAULT_REMINDER_TIMES.breakfast,
  lunch_at: DEFAULT_REMINDER_TIMES.lunch,
  dinner_at: DEFAULT_REMINDER_TIMES.dinner,
  last_sent: {},
};

type Device = { support: PushSupport; subscribed: boolean; blocked: boolean };

/** Meal reminders: a switch, the time for each meal, and a test button. Changes save by themselves. */
export default function RemindersCard() {
  // Without keys on the server there's nothing to offer
  if (!VAPID_PUBLIC_KEY) return null;
  return <Reminders />;
}

function Reminders() {
  const qc = useQueryClient();
  const online = useOnline();
  const { userId } = useUser();
  const [device, setDevice] = useState<Device | null>(null);
  const [busy, setBusy] = useState<"toggle" | "test" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: settings = FRESH } = useQuery({
    queryKey: keys.reminders,
    queryFn: async (): Promise<ReminderSettings> => {
      const { data, error } = await createClient()
        .from("reminder_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            ...FRESH,
            ...data,
            breakfast_at: hhmm(data.breakfast_at),
            lunch_at: hhmm(data.lunch_at),
            dinner_at: hhmm(data.dinner_at),
          }
        : FRESH;
    },
  });

  // What this device can do and has done (a phone can be signed in while another already has reminders on)
  useEffect(() => {
    let live = true;
    void (async () => {
      const support = pushSupport();
      const sub = support === "ok" ? await currentSubscription() : null;
      if (live)
        setDevice({
          support,
          subscribed: Boolean(sub),
          blocked: support === "ok" && Notification.permission === "denied",
        });
    })();
    return () => {
      live = false;
    };
  }, []);

  const write = useCallback(
    async (next: ReminderSettings) => {
      if (!userId) return;
      const { last_sent: _kept, ...fields } = next;
      void _kept; // the server owns last_sent
      const { error } = await createClient()
        .from("reminder_settings")
        .upsert(
          { user_id: userId, ...fields, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) toast.error(`Couldn't save reminders: ${error.message}`);
    },
    [userId],
  );

  /** Updates the screen at once and saves after a short pause, so dragging through times sends one request. */
  const change = useCallback(
    (patch: Partial<ReminderSettings>, now = false) => {
      const next = {
        ...(qc.getQueryData<ReminderSettings>(keys.reminders) ?? FRESH),
        ...patch,
      };
      qc.setQueryData(keys.reminders, next);
      clearTimeout(timer.current);
      if (now) return void write(next);
      timer.current = setTimeout(() => void write(next), 600);
    },
    [qc, write],
  );

  // Save a pending change if the page is left
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      const pending = qc.getQueryData<ReminderSettings>(keys.reminders);
      if (pending) void write(pending);
    },
    [qc, write],
  );

  const on = Boolean(device?.subscribed && settings.enabled);

  // Travelling: keep reminders on local time
  useEffect(() => {
    if (on && online && settings.timezone !== timezone())
      change({ timezone: timezone() }, true);
  }, [on, online, settings.timezone, change]);

  async function toggle(next: boolean) {
    setBusy("toggle");
    try {
      if (next) {
        const result = await enablePush();
        if (result === "denied") {
          setDevice((d) => d && { ...d, blocked: true });
          return toast.error(
            "Notifications are blocked. Allow them for Crazy Rep in your phone's settings.",
          );
        }
        if (result === "no-worker")
          return toast.error(
            "Reminders work in the installed app. Open it from your home screen.",
          );
        if (result === "failed")
          return toast.error("Couldn't turn reminders on. Please try again.");
        setDevice((d) => d && { ...d, subscribed: true });
        change({ enabled: true, timezone: timezone() }, true);
        toast.success("Reminders are on");
      } else {
        await disablePush();
        setDevice((d) => d && { ...d, subscribed: false });
        change({ enabled: false }, true);
      }
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return toast.error(json.error ?? "Couldn't send the test.");
      toast.success("Test sent. It should arrive in a moment.");
    } catch {
      toast.error("Couldn't send the test.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="grid gap-1">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>Meal reminders</SectionTitle>
            {device?.support === "ok" && !device.blocked && (
              <Switch
                checked={on}
                onChange={toggle}
                disabled={!online || busy !== null}
                label="Meal reminders"
                busy={busy === "toggle"}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            A nudge at meal times, so logging becomes a habit. Skipped if you&apos;ve already logged that meal.
          </p>
        </div>

        {device === null ? null : device.support === "needs-install" ? (
          <Note>
            On iPhone, reminders need the app on your Home Screen. Tap Share,
            then Add to Home Screen, and open Crazy Rep from there.
          </Note>
        ) : device.support === "unsupported" ? (
          <Note>
            This browser can&apos;t show notifications. Try the installed app on
            your phone.
          </Note>
        ) : device.blocked ? (
          <Note>
            Notifications are blocked for Crazy Rep. Allow them in your
            phone&apos;s settings, then come back and turn reminders on.
          </Note>
        ) : !online ? (
          <Note>Connect to the internet to change reminders.</Note>
        ) : null}

        {on && (
          <>
            <ul className="grid gap-2">
              {REMINDER_MEALS.map((meal) => (
                <MealRow
                  key={meal}
                  meal={meal}
                  time={settings[`${meal}_at`]}
                  disabled={!online}
                  onChange={(t) =>
                    change({ [`${meal}_at`]: t } as Partial<ReminderSettings>)
                  }
                />
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Reminders may arrive with a slight delay.
            </p>
            <div>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={test}
                disabled={!online || busy !== null}
              >
                {busy === "test" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Send />
                )}{" "}
                Send a test
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MealRow({
  meal,
  time,
  disabled,
  onChange,
}: {
  meal: ReminderMeal;
  time: string | null;
  disabled: boolean;
  onChange: (t: string | null) => void;
}) {
  const { label, icon } = REMINDER_LABELS[meal];
  return (
    // One line on every phone: icon, name, time, switch. Only a very narrow screen (under 340px) drops the time under the name.
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 rounded-2xl border bg-muted/30 px-3 py-2.5 min-[340px]:grid-cols-[auto_minmax(0,1fr)_auto_auto] max-sm:rounded-none max-sm:border-0 max-sm:border-t max-sm:bg-transparent max-sm:px-0 max-sm:first:border-t-0">
      <span aria-hidden className="text-xl">
        {icon}
      </span>
      <span className={cn("min-w-0 truncate font-medium", !time && "text-muted-foreground")}>{label}</span>
      <input
        type="time"
        value={time ?? DEFAULT_REMINDER_TIMES[meal]}
        disabled={disabled || !time}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label={`${label} reminder time`}
        className={cn(
          // Sized to its content so the clock icon sits next to the time instead of at the far edge of a wide box
          "col-span-2 col-start-2 row-start-2 h-10 w-[6.6rem] justify-self-start rounded-xl border bg-background/60 px-2.5 text-[0.95rem] tabular-nums outline-none focus-visible:border-primary disabled:opacity-40",
          "min-[340px]:col-span-1 min-[340px]:col-start-auto min-[340px]:row-start-auto",
          "[&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:opacity-70",
        )}
      />
      <span className="col-start-3 row-start-1 min-[340px]:col-start-auto min-[340px]:row-start-auto">
        <Switch
          checked={Boolean(time)}
          onChange={(v) => onChange(v ? DEFAULT_REMINDER_TIMES[meal] : null)}
          disabled={disabled}
          label={`${label} reminder`}
        />
      </span>
    </li>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
      <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
  busy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-primary bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 grid size-6 place-items-center rounded-full bg-background shadow transition-transform",
          checked && "translate-x-5",
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : checked ? (
          <Bell className="size-3.5 text-primary" />
        ) : null}
      </span>
    </button>
  );
}
