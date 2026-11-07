"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, localDay } from "@/lib/day";
import { foodEmoji } from "@/lib/food-emoji";
import { useDishHistory, useMealSearch } from "@/lib/hooks";
import { usualMealType, type Dish } from "@/lib/meal-search";
import { fmt } from "@/lib/nutrition";
import { useOnline } from "@/lib/offline";
import { MEAL_TYPES, type MealType } from "@/lib/types";
import { flatRow, flatTile } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { OfflineNote } from "../_components/OfflineBanner";
import { SectionTitle } from "../_components/Page";
import Typewriter from "../_components/Typewriter";

const MIN_LENGTH = 2;
const FALLBACK_IDEAS = ["paneer", "masala dosa", "dal rice", "biryani", "oats", "banana"];
const MEAL_ICON = Object.fromEntries(MEAL_TYPES.map((t) => [t.value, t.icon])) as Record<MealType, string>;

const when = (iso: string) => dayLabel(localDay(new Date(iso)));
/** For the middle of a sentence ("last yesterday", "last Thu 5 Nov"): only "Today" and "Yesterday" drop their capital. */
const whenInline = (iso: string) => when(iso).replace(/^(Today|Yesterday)$/, (w) => w.toLowerCase());
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The name with the words that were searched for picked out. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.map(escapeRe).join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** The words as they're searched: trimmed, one space between words, lower case (so "Curd " and "curd" are the same search). */
const normalise = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Search what you've eaten, by name. Before anything is searched it shows your habits instead of a blank box.
 * Typing searches nothing: a search happens when you press Search (or Enter), because looking for similar dishes costs an AI call.
 */
export default function MealSearch() {
  const online = useOnline();
  const reduce = useReducedMotion() ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  // What was searched for. `similar: false` is for names tapped from a list, which are exact and need no AI.
  const [asked, setAsked] = useState<{ q: string; similar: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Not shown: only used to put the person's own dishes in the example searches
  const overviewQuery = useMealSearch("");
  const search = useMealSearch(asked?.q ?? "", { enabled: Boolean(asked) && online, similar: asked?.similar ?? true });
  const overview = overviewQuery.data?.mode === "overview" ? overviewQuery.data : null;
  const result = asked && search.data?.mode === "search" && search.data.q === asked.q ? search.data : null;

  const typed = normalise(text);
  const canSearch = online && typed.length >= MIN_LENGTH;
  const searching = Boolean(asked) && search.fetching;
  const edited = Boolean(asked) && typed !== asked?.q; // the box was changed after the last search

  function ask(raw: string, similar = true) {
    const q = normalise(raw);
    if (q.length < MIN_LENGTH || !online) return;
    setText(raw.trim());
    setAsked({ q, similar });
    setOpen(null);
    inputRef.current?.blur(); // puts the phone's keyboard away so the results are in view
  }

  function clear() {
    setText("");
    setAsked(null);
    setOpen(null);
    inputRef.current?.focus();
  }

  // Example searches taken from the person's own food
  const ideas = useMemo(() => {
    if (!overview?.top.length) return FALLBACK_IDEAS;
    // The dishes eaten most, with a few of the things inside them mixed in (you can search those too)
    const dishes = overview.top.slice(0, 5).map((d) => d.name.toLowerCase());
    const inside = overview.top.slice(0, 3).flatMap((d) => d.items.filter((i) => i.key !== d.name_key).slice(0, 1).map((i) => i.name.toLowerCase()));
    return [...new Set([...dishes.slice(0, 3), ...inside, ...dishes.slice(3)])];
  }, [overview]);

  const hits = result?.hits ?? [];
  const pending = Boolean(asked) && !result && !search.error;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* The search box and its button. On a phone the button is full width under the box; it never overlaps the text. */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="relative h-14 min-w-0 rounded-2xl border bg-card transition-colors focus-within:border-primary">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value.trim()) {
                setAsked(null); // emptied the box: back to the overview
                setOpen(null);
              }
            }}
            disabled={!online}
            maxLength={80}
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="none"
            aria-label="Search the dishes you've eaten, or what's in them"
            placeholder={online ? undefined : "Search needs a connection"}
            className="size-full rounded-2xl bg-transparent pr-12 pl-12 text-lg outline-none disabled:opacity-60"
          />
          {!text && online && <Typewriter reduce={reduce} ideas={ideas} className="pr-12 pl-12 text-lg" />}
          {text && (
            <button type="button" onClick={clear} className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSearch || searching}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-7 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40 sm:h-14"
        >
          {searching ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* One line that says what to do next */}
      {online && (
        <p className="-mt-1 text-sm text-muted-foreground" aria-live="polite">
          {typed.length >= MIN_LENGTH && (!asked || edited) ? (
            <>
              Press <b className="text-foreground">Search</b> to look for “{text.trim()}”.
            </>
          ) : !asked ? (
            <>Search a dish, like “masala dosa”, or something in it, like “chutney”.</>
          ) : null}
        </p>
      )}

      {!online && <OfflineNote>Searching needs a connection. Connect to the internet and try again.</OfflineNote>}

      {/* Searched */}
      {asked && (
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3 transition-opacity", edited && "opacity-50")}>
          {result && hits.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <b className="text-foreground">{hits.length}</b> {hits.length === 1 ? "dish" : "dishes"} for “{asked.q}”
                </p>
                <button type="button" onClick={clear} className="text-sm font-semibold text-primary">
                  Clear
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tap a dish to see what&apos;s in it and log it again.
                {hits.some((h) => h.via === "similar") && (
                  <span className="ml-1 inline-flex items-center gap-1 text-primary">
                    <Sparkles className="size-3" aria-hidden /> Similar dishes are marked.
                  </span>
                )}
              </p>
            </div>
          )}

          {pending && (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-busy aria-label="Searching">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[84px] rounded-2xl" />
              ))}
            </ul>
          )}

          {search.error && online && <p className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">{search.error}</p>}

          {result && hits.length > 0 && (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {hits.map((hit, i) => (
                  <motion.li
                    key={hit.name_key}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(i * 0.025, 0.2) }}
                  >
                    <DishCard
                      dish={hit}
                      query={asked.q}
                      similar={hit.via === "similar"}
                      inItem={hit.inItem}
                      open={open === hit.name_key}
                      onToggle={() => setOpen(open === hit.name_key ? null : hit.name_key)}
                      onSearch={(name) => ask(name, false)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {result && hits.length === 0 && (
            <div className="grid justify-items-center grid-cols-[minmax(0,1fr)] gap-3 rounded-3xl border border-dashed px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-muted text-2xl" aria-hidden>
                🔎
              </span>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
                <p className="font-semibold">Nothing like “{asked.q}” yet</p>
                <p className="text-sm text-muted-foreground">Try a shorter word, or log it now and it will be here next time.</p>
              </div>
              <Link href={`/scan?name=${encodeURIComponent(asked.q)}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> Log “{asked.q}”
              </Link>
            </div>
          )}

          {result?.semantic === "learning" && <p className="text-center text-xs text-muted-foreground">Still learning your meals. Similar dishes will show up more as you search.</p>}
        </div>
      )}
    </div>
  );
}

/** One dish. Tap it to see what's in it, the last time you ate it, and to log it again. */
function DishCard({ dish, query, similar, inItem, open, onToggle, onSearch }: { dish: Dish; query: string; similar: boolean; inItem?: string; open: boolean; onToggle: () => void; onSearch: (name: string) => void }) {
  const usual = usualMealType(dish);
  const types = MEAL_TYPES.filter((t) => dish[t.value] > 0);
  const { times, loading } = useDishHistory(dish.name_key, open);
  // What's inside: not the dish's own name again (a one-item meal is just itself)
  const inside = dish.items.filter((i) => i.key !== dish.name_key);
  const last = times[0];
  const earlier = times.slice(1);
  const matched = inItem?.toLowerCase();

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card transition-colors", open && "border-primary/50")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted/60 text-2xl" aria-hidden>
          {foodEmoji(dish.name)}
        </span>
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
          <span className="flex items-center gap-2">
            <b className="truncate">
              <Highlight text={dish.name} query={query} />
            </b>
            {similar && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-1.5 py-px text-[0.65rem] font-semibold text-primary">
                <Sparkles className="size-2.5" aria-hidden /> similar
              </span>
            )}
          </span>
          {/* The match was inside the dish: say what, so it's clear why this dish is here */}
          {inItem && (
            <span className="truncate text-xs text-primary">
              contains <b className="font-semibold"><Highlight text={inItem} query={query} /></b>
            </span>
          )}
          <span className="truncate text-xs text-muted-foreground">
            {dish.times}× · last {whenInline(dish.last_at)}
            {inside.length > 0 && ` · ${inside.length} ${inside.length === 1 ? "item" : "items"}`}
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {types.map((t) => (
              <span key={t.value} title={t.label}>
                {t.icon} {dish[t.value]}
              </span>
            ))}
          </span>
        </span>
        <span className="text-right font-heading text-2xl leading-none">
          {fmt(dish.avg_kcal)}
          <small className="block font-sans text-[0.65rem] text-muted-foreground">kcal avg</small>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t px-3.5 pt-3 pb-3.5">
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <i className="mr-1 inline-block size-1.5 rounded-full bg-protein" />P {fmt(dish.avg_protein)}g
                </span>
                <span>
                  <i className="mr-1 inline-block size-1.5 rounded-full bg-carbs" />C {fmt(dish.avg_carbs)}g
                </span>
                <span>
                  <i className="mr-1 inline-block size-1.5 rounded-full bg-fat" />F {fmt(dish.avg_fat)}g
                </span>
                <span>· first logged {whenInline(dish.first_at)}</span>
              </p>

              {/* Everything that has been found inside this dish. Tap one to search for it. */}
              {inside.length > 0 && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  <SectionTitle>What&apos;s in it</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {inside.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onSearch(item.name)}
                        title={`Search “${item.name}”`}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                          item.key === matched || item.name.toLowerCase() === matched ? "border-primary bg-primary/15 text-foreground" : "bg-muted/30 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {item.name}
                        {item.times > 1 && <span className="text-[0.65rem] opacity-70">×{item.times}</span>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* The last time, item by item */}
              {loading && <Skeleton className="h-24 rounded-xl" />}
              {last && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  <Link href={`/dashboard?date=${localDay(new Date(last.eaten_at))}`} className="flex items-center justify-between gap-2">
                    <SectionTitle>Last time · {when(last.eaten_at)}</SectionTitle>
                    <span className="text-xs font-semibold">
                      {MEAL_ICON[last.meal_type as MealType] ?? "🍽️"} {fmt(last.calories)} kcal
                    </span>
                  </Link>
                  {last.items.length > 0 ? (
                    <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
                      {last.items.map((item, i) => (
                        <li key={`${item.name}-${i}`} className={cn("flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm", flatRow)}>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate font-semibold">
                              <Highlight text={item.name} query={query} />
                            </b>
                            {(item.portion || item.grams > 0) && (
                              <small className="block truncate text-xs text-muted-foreground">{[item.portion, item.grams > 0 ? `${fmt(item.grams)} g` : ""].filter(Boolean).join(" · ")}</small>
                            )}
                          </span>
                          <b className="whitespace-nowrap">{fmt(item.calories)} kcal</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No item breakdown was saved for this meal.</p>
                  )}
                </section>
              )}

              {earlier.length > 0 && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  <SectionTitle>Other times</SectionTitle>
                  <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
                    {earlier.map((t) => (
                      <li key={t.id} className="max-sm:border-t max-sm:first:border-t-0">
                        <Link href={`/dashboard?date=${localDay(new Date(t.eaten_at))}`} className={cn("flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm", flatTile)}>
                          <span aria-hidden>{MEAL_ICON[t.meal_type as MealType] ?? "🍽️"}</span>
                          <span className="flex-1">{when(t.eaten_at)}</span>
                          <span className="text-xs text-muted-foreground">{new Date(t.eaten_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                          <b>{fmt(t.calories)} kcal</b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <Link href={`/scan?type=${usual}&name=${encodeURIComponent(dish.name)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> Log again
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
