"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { currentTheme, DEFAULT_THEME, setTheme, subscribeTheme, THEMES, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SectionTitle } from "../_components/Page";

/** A tiny picture of the app in a theme's colours: its page, a card, a gradient bar and a ring. */
function Preview({ theme }: { theme: (typeof THEMES)[number] }) {
  return (
    <span className="relative block h-14 overflow-hidden rounded-xl ring-1 ring-foreground/10" style={{ background: theme.bg }} aria-hidden>
      <span className="absolute inset-x-2 top-2 bottom-2 rounded-lg" style={{ background: theme.card }} />
      <span className="absolute top-4 left-4 h-2 w-9 rounded-full" style={{ background: `linear-gradient(90deg, ${theme.from}, ${theme.to})` }} />
      <span className="absolute top-8 left-4 h-1.5 w-12 rounded-full opacity-40" style={{ background: theme.from }} />
      <span
        className="absolute top-1/2 right-4 size-7 -translate-y-1/2 rounded-full"
        style={{ background: `conic-gradient(from 210deg, ${theme.from}, ${theme.to}, ${theme.from})`, maskImage: "radial-gradient(circle, transparent 52%, #000 54%)", WebkitMaskImage: "radial-gradient(circle, transparent 52%, #000 54%)" }}
      />
    </span>
  );
}

const GROUPS = [
  { label: "Dark", themes: THEMES.filter((t) => t.dark) },
  { label: "Light", themes: THEMES.filter((t) => !t.dark) },
];

export default function ThemePicker() {
  const active = useSyncExternalStore(subscribeTheme, currentTheme, () => DEFAULT_THEME);

  function pick(id: ThemeId, name: string) {
    if (id === active) return;
    try {
      navigator.vibrate?.(8);
    } catch {}
    setTheme(id);
    toast.success(`${name} theme on`);
  }

  return (
    <Card className="rounded-3xl">
      <CardContent className="grid gap-4">
        <SectionTitle>Appearance</SectionTitle>
        <p className="text-sm text-muted-foreground">Pick a look. It is saved on this device.</p>
        {GROUPS.map((group) => (
          <div key={group.label} role="radiogroup" aria-label={`${group.label} themes`} className="grid gap-3">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group.label}</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.themes.map((t) => {
                const on = t.id === active;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pick(t.id, t.name)}
                    className={cn("relative grid gap-2 rounded-2xl border p-2.5 text-left transition-transform duration-200 active:scale-[0.97]", !on && "hover:border-primary/40")}
                  >
                    {on && <motion.span layoutId="theme-ring" className="pointer-events-none absolute -inset-px rounded-2xl ring-2 ring-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <Preview theme={t} />
                    <span className="grid">
                      <span className="flex h-5 items-center gap-1.5 text-sm font-semibold">
                        {t.name}
                        {on && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3" strokeWidth={3} />
                          </motion.span>
                        )}
                        {t.id === DEFAULT_THEME && <span className="ml-auto rounded-full bg-muted px-1.5 py-px text-[0.6rem] font-medium text-muted-foreground">Default</span>}
                      </span>
                      <span className="h-4 truncate text-xs text-muted-foreground">{t.tagline}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
