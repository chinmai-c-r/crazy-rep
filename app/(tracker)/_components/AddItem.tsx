"use client";

import { Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/lib/offline";
import { addItemSchema, foodItemSchema, type FoodItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * "Missing something?" Type one item the way you'd say it ("2 rotis", "1 cup rice", "paneer 100g")
 * and it's looked up like the meal name: saved results, then USDA, then AI. Found items are handed to onAdd.
 */
export default function AddItem({ onAdd, className }: { onAdd: (items: FoodItem[]) => void; className?: string }) {
  const online = useOnline();
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
    <form onSubmit={submit} className={cn("grid gap-2 rounded-2xl border border-dashed bg-muted/20 p-3", className)}>
      <label htmlFor="add-item" className="text-sm font-semibold">
        Missing something?
      </label>
      <div className="flex gap-2">
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
          placeholder={online ? "e.g. 2 rotis, 1 cup rice, paneer 100g" : "Connect to the internet to add items"}
          aria-invalid={error ? true : undefined}
          aria-describedby="add-item-help"
          className="h-11 min-w-0 flex-1 rounded-xl border bg-background/60 px-3.5 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary disabled:opacity-60"
        />
        <Button type="submit" className="h-11 shrink-0 rounded-xl px-4" disabled={busy || !online || text.trim().length < 2}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>
      <p id="add-item-help" role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {busy ? "Looking it up…" : (error ?? "Type it the way you'd say it, with an amount if you like.")}
      </p>
    </form>
  );
}
