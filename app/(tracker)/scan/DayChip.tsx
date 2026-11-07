"use client";

import { CalendarDays } from "lucide-react";
import { dayLabel, localDay } from "@/lib/day";
import { cn } from "@/lib/utils";

/** Which day the meal is for. Tapping opens the phone's own date picker (an invisible date input sits over the chip). */
export default function DayChip({ day, onChange, disabled }: { day: string; onChange: (day: string) => void; disabled?: boolean }) {
  const today = localDay(new Date());
  const past = day !== today;
  return (
    <label
      className={cn(
        "relative inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors",
        past ? "border-primary/50 bg-primary/10 text-primary" : "bg-card/60 text-muted-foreground",
        disabled ? "opacity-50" : "cursor-pointer active:scale-[0.98]",
      )}
    >
      <CalendarDays className="size-4" aria-hidden />
      <span>Logging for {dayLabel(day)}</span>
      <input
        type="date"
        value={day}
        max={today}
        disabled={disabled}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Day this meal is for"
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
      />
    </label>
  );
}
