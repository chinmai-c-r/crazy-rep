"use client";

import { Loader2, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dietOf, itemIdeasFor } from "@/lib/diet";
import { useProfile } from "@/lib/hooks";
import { useOnline } from "@/lib/offline";
import { addItemSchema, foodItemSchema, type FoodItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import Typewriter from "./Typewriter";

/**
 * "Missing something?" Type one item the way you'd say it ("2 rotis", "1 cup rice", "paneer 100g")
 * and it's looked up like the meal name: saved results, then USDA, then AI. Found items are handed to onAdd.
 */
export default function AddItem({ onAdd, className }: { onAdd: (items: FoodItem[]) => void; className?: string }) {
  const online = useOnline();
  const reduce = useReducedMotion() ?? false;
  const { profile } = useProfile();
  const ideas = useMemo(() => itemIdeasFor(dietOf(profile)), [profile]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = addItemSchema.safeParse({ text });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Type an item");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze/item", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const json = (await res.json().catch(() => ({}))) as { items?: unknown[]; error?: string };
      if (!res.ok) throw new Error(json.error || "We couldn't find that item.");
      const items = (json.items ?? []).map((it) => foodItemSchema.parse(it));
      if (!items.length) throw new Error("We couldn't find that item.");
      onAdd(items);
      setText("");
      toast.success(`Added ${items.map((i) => i.name).join(", ")}`);
      input.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    // minmax(0, 1fr): a single auto column would stretch to the input's own width and push the page sideways on phones
    <form onSubmit={submit} className={cn("grid grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border border-dashed bg-muted/20 p-3", className)}>
      <label htmlFor="add-item" className="text-sm font-semibold">
        Missing something?
      </label>
      <div className="relative h-11">
        <input
          id="add-item"
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          disabled={busy || !online}
          maxLength={120}
          enterKeyHint="done"
          autoComplete="off"
          placeholder={online ? undefined : "Connect to the internet to add items"}
          aria-label="Add an item"
          aria-invalid={error ? true : undefined}
          aria-describedby="add-item-help"
          className="size-full rounded-xl border bg-background/60 px-3.5 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary disabled:opacity-60"
        />
        {/* Example items typed out one after another, like the meal name box */}
        {!text && online && <Typewriter reduce={reduce} ideas={ideas} className="px-3.5" />}
      </div>
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy || !online || text.trim().length < 2}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        Add item
      </Button>
      <p id="add-item-help" role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {busy ? "Looking it up…" : (error ?? "Type it the way you'd say it, with an amount if you like.")}
      </p>
    </form>
  );
}
