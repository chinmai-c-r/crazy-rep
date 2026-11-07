"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, localDay } from "@/lib/day";
import { foodEmoji } from "@/lib/food-emoji";
import { useDishHistory, useMealSearch } from "@/lib/hooks";
import { usualMealType, type Dish } from "@/lib/meal-search";
import { fmt } from "@/lib/nutrition";
import { useOnline } from "@/lib/offline";
import { MEAL_TYPES, type MealType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OfflineNote } from "../_components/OfflineBanner";
import { SectionTitle } from "../_components/Page";
import Typewriter from "../_components/Typewriter";

const MIN_LENGTH = 2;
const FALLBACK_IDEAS = ["paneer", "masala dosa", "dal rice", "biryani", "oats", "banana"];
const MEAL_ICON = Object.fromEntries(MEAL_TYPES.map((t) => [t.value, t.icon])) as Record<MealType, string>;

type Sort = "match" | "most" | "latest";
const SORTS: { id: Sort; label: string }[] = [
  { id: "match", label: "Best match" },
  { id: "most", label: "Most eaten" },
  { id: "latest", label: "Latest" },
];

/** Follows a value, a moment late, so searching waits for a pause in typing. */
function useDebounced<T>(value: T, ms: number) {
  const [later, setLater] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setLater(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return later;
}

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

/** Search what you've eaten, by name. Before anything is typed it shows your habits instead of a blank box. */
export default function MealSearch() {
  const online = useOnline();
  const reduce = useReducedMotion() ?? false;
  const [text, setText] = useState("");
  const [sort, setSort] = useState<Sort>("match");
  const [type, setType] = useState<MealType | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const q = useDebounced(text.trim(), 350);
  const searching = q.length >= MIN_LENGTH;
  const overviewQuery = useMealSearch("");
  const search = useMealSearch(q, searching && online);
  const overview = overviewQuery.data?.mode === "overview" ? overviewQuery.data : null;
  const result = search.data?.mode === "search" && search.data.q === q ? search.data : null;

  // Example searches taken from the person's own food
  const ideas = useMemo(() => (overview?.top.length ? overview.top.slice(0, 6).map((d) => d.name.toLowerCase()) : FALLBACK_IDEAS), [overview]);

  const hits = useMemo(() => {
    if (!result) return [];
    const list = type === "all" ? result.hits : result.hits.filter((h) => h[type] > 0);
    if (sort === "most") return [...list].sort((a, b) => b.times - a.times);
    if (sort === "latest") return [...list].sort((a, b) => b.last_at.localeCompare(a.last_at));
    return list;
  }, [result, type, sort]);

  const pending = searching && !result && !search.error;
  const typing = text.trim() !== q || (searching && search.fetching);
  const nothingLogged = overview && overview.total.meals === 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* The search box */}
      <div className="relative h-14 rounded-2xl border bg-card transition-colors focus-within:border-primary">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(null);
          }}
          disabled={!online}
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          aria-label="Search the meals you've eaten"
          placeholder={online ? undefined : "Search needs a connection"}
          className="size-full rounded-2xl bg-transparent pr-12 pl-12 text-lg outline-none disabled:opacity-60"
        />
        {!text && online && <Typewriter reduce={reduce} ideas={ideas} className="pl-12 text-lg" />}
        <div className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center">
          {typing && text ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />
          ) : text ? (
            <button type="button" onClick={() => setText("")} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {!online && <OfflineNote>Searching needs a connection. Here are your most eaten dishes, saved on this phone.</OfflineNote>}

      {/* Nothing typed yet: your habits */}
      {!searching && (
        <Overview
          overview={overview}
          loading={overviewQuery.loading}
          empty={Boolean(nothingLogged)}
          onPick={(dish) => {
            setText(dish.name);
            setOpen(dish.name_key);
          }}
        />
      )}

      {/* Typed something */}
      {searching && (
        <>
          {result && result.hits.length > 0 && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <b className="text-foreground">{hits.length}</b> {hits.length === 1 ? "dish" : "dishes"} for “{q}”
                </p>
                {result.hits.some((h) => h.via === "similar") && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <Sparkles className="size-3" aria-hidden /> includes similar dishes
                  </span>
                )}
              </div>
              <Chips
                label="Show only"
                options={[{ id: "all", label: "Any meal" }, ...MEAL_TYPES.map((t) => ({ id: t.value, label: `${t.icon} ${t.label}` }))]}
                value={type}
                onChange={(v) => setType(v as MealType | "all")}
              />
              <Chips label="Sort by" options={SORTS} value={sort} onChange={(v) => setSort(v as Sort)} />
            </div>
          )}

          {pending && (
            <ul className="grid gap-2" aria-busy aria-label="Searching">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[84px] rounded-2xl" />
              ))}
            </ul>
          )}

          {search.error && online && <p className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">{search.error}</p>}

          {result && hits.length > 0 && (
            <ul className="grid gap-2">
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
                    <DishCard dish={hit} query={q} similar={hit.via === "similar"} open={open === hit.name_key} onToggle={() => setOpen(open === hit.name_key ? null : hit.name_key)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {result && result.hits.length > 0 && hits.length === 0 && (
            <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">None of these were eaten as {MEAL_TYPES.find((t) => t.value === type)?.label.toLowerCase()}. Try “Any meal”.</p>
          )}

          {result && result.hits.length === 0 && (
            <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-muted text-2xl" aria-hidden>
                🔎
              </span>
              <div className="grid gap-1">
                <p className="font-semibold">Nothing like “{q}” yet</p>
                <p className="text-sm text-muted-foreground">Try a shorter word, or log it now and it will be here next time.</p>
              </div>
              <Link href={`/scan?name=${encodeURIComponent(q)}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> Log “{q}”
              </Link>
            </div>
          )}

          {result?.semantic === "learning" && <p className="text-center text-xs text-muted-foreground">Still learning your meals. Similar dishes will show up more as you search.</p>}
        </>
      )}
    </div>
  );
}

/** A row of small choices (filter or sort). Scrolls sideways on a narrow screen. */
function Chips({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Before a search: how much you've logged, what you eat most, and what you ate lately. */
function Overview({ overview, loading, empty, onPick }: { overview: { top: Dish[]; recent: Dish[]; total: { dishes: number; meals: number } } | null; loading: boolean; empty: boolean; onPick: (dish: Dish) => void }) {
  if (loading && !overview) {
    return (
      <div className="grid gap-2" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (empty || !overview) {
    return (
      <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed px-6 py-12 text-center">
        <span className="text-4xl" aria-hidden>
          🍽️
        </span>
        <div className="grid gap-1">
          <p className="font-semibold">Your food will be searchable here</p>
          <p className="text-sm text-muted-foreground">Log a meal and you can find it again by name.</p>
        </div>
        <Link href="/scan" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          <Plus className="size-4" /> Log a meal
        </Link>
      </div>
    );
  }

  const most = Math.max(...overview.top.map((d) => d.times), 1);
  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        You&apos;ve logged <b className="text-foreground">{overview.total.meals.toLocaleString()}</b> {overview.total.meals === 1 ? "meal" : "meals"} across <b className="text-foreground">{overview.total.dishes.toLocaleString()}</b>{" "}
        {overview.total.dishes === 1 ? "dish" : "dishes"}. Search any of them by name.
      </p>

      <section className="grid gap-2">
        <SectionTitle>Eaten most</SectionTitle>
        <ol className="grid gap-1.5">
          {overview.top.map((d, i) => (
            <li key={d.name_key}>
              <button type="button" onClick={() => onPick(d)} className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-card px-3.5 py-3 text-left transition-transform active:scale-[0.99]">
                {/* The bar behind the row shows how it compares with your top dish */}
                <span aria-hidden className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${(d.times / most) * 100}%` }} />
                <span className="relative w-5 text-center font-heading text-lg text-muted-foreground">{i + 1}</span>
                <span className="relative text-xl" aria-hidden>
                  {foodEmoji(d.name)}
                </span>
                <span className="relative min-w-0 flex-1 truncate font-semibold">{d.name}</span>
                <span className="relative text-sm font-bold whitespace-nowrap text-primary">{d.times}×</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-2">
        <SectionTitle>Eaten lately</SectionTitle>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {overview.recent.map((d) => (
            <button key={d.name_key} type="button" onClick={() => onPick(d)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-sm whitespace-nowrap">
              <span aria-hidden>{foodEmoji(d.name)}</span>
              {d.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** One dish. Tap it to see the last times you ate it and to log it again. */
function DishCard({ dish, query, similar, open, onToggle }: { dish: Dish; query: string; similar: boolean; open: boolean; onToggle: () => void }) {
  const usual = usualMealType(dish);
  const types = MEAL_TYPES.filter((t) => dish[t.value] > 0);
  const { times, loading } = useDishHistory(dish.name_key, open);

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card transition-colors", open && "border-primary/50")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted/60 text-2xl" aria-hidden>
          {foodEmoji(dish.name)}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
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
          <span className="truncate text-xs text-muted-foreground">
            {dish.times}× · last {whenInline(dish.last_at)}
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
            <div className="grid gap-3 border-t px-3.5 pt-3 pb-3.5">
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
              <ul className="grid gap-1">
                {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 rounded-xl" />)}
                {times.map((t) => (
                  <li key={t.id}>
                    <Link href={`/dashboard?date=${localDay(new Date(t.eaten_at))}`} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                      <span aria-hidden>{MEAL_ICON[t.meal_type as MealType] ?? "🍽️"}</span>
                      <span className="flex-1">{when(t.eaten_at)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(t.eaten_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                      <b>{fmt(t.calories)} kcal</b>
                    </Link>
                  </li>
                ))}
              </ul>
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
