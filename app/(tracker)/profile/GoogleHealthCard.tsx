"use client";

import { Loader2, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SectionTitle } from "../_components/Page";

const RESULTS: Record<string, [kind: "success" | "error", message: string]> = {
  connected: ["success", "Google Health connected."],
  denied: ["error", "Google Health wasn't connected. Allow nutrition access to sync meals."],
  unavailable: ["error", "Google Health sync isn't set up on this server."],
  error: ["error", "Could not connect Google Health. Please try again."],
};

type Status = { configured: boolean; connected: boolean; steps?: boolean };

export default function GoogleHealthCard() {
  const queryClient = useQueryClient();
  const { data: status = null } = useQuery({
    queryKey: ["google-health-status"],
    queryFn: async (): Promise<Status | null> => {
      const r = await fetch("/api/google-health");
      return r.ok ? r.json() : null;
    },
  });
  const setStatus = (s: Status) => queryClient.setQueryData(["google-health-status"], s);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = RESULTS[params.get("google_health") ?? ""];
    if (result) {
      toast[result[0]](result[1]);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function disconnect() {
    setBusy(true);
    const res = await fetch("/api/google-health", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast.error("Could not disconnect. Please try again.");
    setStatus({ configured: true, connected: false, steps: false });
    void queryClient.invalidateQueries({ queryKey: ["steps"] });
    void queryClient.invalidateQueries({ queryKey: ["log", "activity_logs"] });
    toast.success("Google Health disconnected. Meals already synced stay in Google Health.");
  }

  // Hidden until we know, and when the server has no Google credentials
  if (!status?.configured) return null;

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-4">
        <SectionTitle>Google Health</SectionTitle>
        <p className="text-muted-foreground">
          {status.connected
            ? status.steps
              ? "Connected. Meals you log here are mirrored to Google Health, and your steps and workouts come back from it."
              : "Connected. Meals you log, edit or delete here are mirrored to Google Health."
            : "Send your logged meals to the Google Health app and bring your steps and workouts back. Open Google Health on your phone and link your Google Account first."}
        </p>
        {status.connected && !status.steps && (
          <p className="text-sm text-muted-foreground">
            Want your steps and workouts too? <a href="/api/google-health/connect" className="underline underline-offset-4">Reconnect</a> and allow activity access.
          </p>
        )}
        {status.connected && <PastMeals />}
        <div>
          {status.connected ? (
            <Button variant="outline" className="rounded-full" onClick={disconnect} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Disconnect
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <a href="/api/google-health/connect">Connect Google Health</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "All time", value: "all" },
] as const;

/** Sends meals logged before Google Health was connected. Only meals not yet sent are included, so nothing is sent twice. */
function PastMeals() {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const days = range === "all" ? null : Number(range);

  const { data: pending, refetch } = useQuery({
    queryKey: ["google-health-pending", range],
    queryFn: async (): Promise<number | null> => {
      const r = await fetch(`/api/google-health/backfill?days=${range}`);
      return r.ok ? ((await r.json()) as { pending: number }).pending : null;
    },
  });

  async function run() {
    const total = pending ?? 0;
    let sent = 0;
    setProgress({ sent, total });
    try {
      for (;;) {
        const res = await fetch("/api/google-health/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        });
        const json = (await res.json().catch(() => ({}))) as { sent?: number; failed?: number; pending?: number; error?: string };
        if (!res.ok) return toast.error(json.error ?? "Could not sync past meals.");
        sent += json.sent ?? 0;
        setProgress({ sent, total });
        // Stop when done, or when a round sent nothing (the rest keep failing; trying again later is safe)
        if (!json.pending || !json.sent) {
          if (json.failed) toast.error(`${sent} sent. ${json.pending} couldn't be sent. Try again later.`);
          else toast.success(`${sent} past ${sent === 1 ? "meal" : "meals"} sent to Google Health.`);
          return;
        }
      }
    } catch {
      toast.error("Could not sync past meals.");
    } finally {
      setProgress(null);
      void refetch();
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Send past meals</p>
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={progress !== null}
            onClick={() => setRange(r.value)}
            className={cn("h-9 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-50", range === r.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className="rounded-full" onClick={run} disabled={progress !== null || !pending}>
          {progress ? <Loader2 className="animate-spin" /> : <Upload />}{" "}
          {progress ? `Sending ${progress.sent}/${progress.total}` : pending ? `Send ${pending} ${pending === 1 ? "meal" : "meals"}` : "Nothing to send"}
        </Button>
        <span className="text-xs text-muted-foreground">Meals already in Google Health are skipped.</span>
      </div>
    </div>
  );
}
