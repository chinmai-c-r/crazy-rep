"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "../_components/Page";

const RESULTS: Record<string, [kind: "success" | "error", message: string]> = {
  connected: ["success", "Google Health connected. New meals will sync automatically."],
  denied: ["error", "Google Health wasn't connected. Allow nutrition access to sync meals."],
  unavailable: ["error", "Google Health sync isn't set up on this server."],
  error: ["error", "Could not connect Google Health. Please try again."],
};

type Status = { configured: boolean; connected: boolean };

export default function GoogleHealthCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = RESULTS[params.get("google_health") ?? ""];
    if (result) {
      toast[result[0]](result[1]);
      window.history.replaceState(null, "", window.location.pathname);
    }
    fetch("/api/google-health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function disconnect() {
    setBusy(true);
    const res = await fetch("/api/google-health", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast.error("Could not disconnect. Please try again.");
    setStatus({ configured: true, connected: false });
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
            ? "Connected. Meals you log, edit or delete here are mirrored to Google Health."
            : "Send your logged meals to the Google Health app. Open Google Health on your phone and link your Google Account first."}
        </p>
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
