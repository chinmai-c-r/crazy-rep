/**
 * Colour themes. The choice lives in localStorage (no account needed) and is applied as data-theme on <html>,
 * where app/globals.css swaps the colour variables. A tiny inline script applies it before first paint.
 */
export type ThemeId = "neon" | "black" | "graphite" | "slate" | "charcoal" | "carbon" | "steel" | "ash" | "pitch" | "void" | "ember" | "abyss" | "ocean" | "aurora" | "emerald" | "violet" | "cyber" | "rose" | "sunset" | "gold" | "mocha" | "light" | "sky" | "blossom";

export const THEME_KEY = "crazy-rep-theme";
export const DEFAULT_THEME: ThemeId = "neon";

type Theme = {
  id: ThemeId;
  name: string;
  tagline: string;
  /** Light themes drop the `dark` class, so `dark:` variants stay off. */
  dark: boolean;
  /** Preview colours (page, card, accent start and end) for the picker. */
  bg: string;
  card: string;
  from: string;
  to: string;
};

export const THEMES: Theme[] = [
  { id: "neon", name: "Neon", tagline: "The original lime glow", dark: true, bg: "#0a0a0c", card: "#16161d", from: "#c6ff00", to: "#00e5ff" },
  { id: "black", name: "Black", tagline: "True black for OLED", dark: true, bg: "#000000", card: "#0b0b0e", from: "#c6ff00", to: "#00e5ff" },
  { id: "graphite", name: "Graphite", tagline: "Neutral dark grey", dark: true, bg: "#111113", card: "#1b1b1e", from: "#e4e4e8", to: "#9a9aa3" },
  { id: "slate", name: "Slate", tagline: "Cool blue-grey", dark: true, bg: "#0e1217", card: "#171d25", from: "#94a3b8", to: "#5eead4" },
  { id: "charcoal", name: "Charcoal", tagline: "Soft grey, ember glow", dark: true, bg: "#141414", card: "#1f1f1f", from: "#ff7a45", to: "#fbbf24" },
  { id: "carbon", name: "Carbon", tagline: "Near black with red", dark: true, bg: "#050506", card: "#101012", from: "#ff3b47", to: "#ffc857" },
  { id: "steel", name: "Steel", tagline: "Grey with a mint edge", dark: true, bg: "#101315", card: "#1a1e21", from: "#6ee7b7", to: "#67e8f9" },
  { id: "ash", name: "Ash", tagline: "Lighter grey, soft contrast", dark: true, bg: "#1c1c1f", card: "#26262a", from: "#ffffff", to: "#bae6fd" },
  { id: "pitch", name: "Pitch", tagline: "Pure black, lime glow", dark: true, bg: "#000000", card: "#000000", from: "#c6ff00", to: "#00e5ff" },
  { id: "void", name: "Void", tagline: "Pure black, pure white", dark: true, bg: "#000000", card: "#000000", from: "#ffffff", to: "#a1a1aa" },
  { id: "ember", name: "Ember", tagline: "Pure black, ember glow", dark: true, bg: "#000000", card: "#000000", from: "#ff7a45", to: "#fbbf24" },
  { id: "abyss", name: "Abyss", tagline: "Pure black, electric blue", dark: true, bg: "#000000", card: "#000000", from: "#4da3ff", to: "#5eead4" },
  { id: "ocean", name: "Ocean", tagline: "Deep blue calm", dark: true, bg: "#060b14", card: "#0f1828", from: "#38bdf8", to: "#818cf8" },
  { id: "aurora", name: "Aurora", tagline: "Teal meets violet", dark: true, bg: "#060d12", card: "#0d1a22", from: "#2dd4bf", to: "#a78bfa" },
  { id: "emerald", name: "Emerald", tagline: "Fresh and green", dark: true, bg: "#050f0b", card: "#0d1b15", from: "#34d399", to: "#a3e635" },
  { id: "violet", name: "Violet", tagline: "Soft purple night", dark: true, bg: "#0b0814", card: "#151024", from: "#a78bfa", to: "#60a5fa" },
  { id: "cyber", name: "Cyber", tagline: "Magenta and cyan", dark: true, bg: "#08050f", card: "#130a1f", from: "#e879f9", to: "#22d3ee" },
  { id: "rose", name: "Rose", tagline: "Soft pink glow", dark: true, bg: "#12080c", card: "#1e0f15", from: "#fb7185", to: "#fdba74" },
  { id: "sunset", name: "Sunset", tagline: "Warm orange and pink", dark: true, bg: "#110907", card: "#1c110d", from: "#ff8a3d", to: "#ff4d8d" },
  { id: "gold", name: "Gold", tagline: "Warm and golden", dark: true, bg: "#0e0b04", card: "#1a1608", from: "#facc15", to: "#fb923c" },
  { id: "mocha", name: "Mocha", tagline: "Cozy coffee tones", dark: true, bg: "#110c09", card: "#1c1510", from: "#e0b08a", to: "#8fbfa0" },
  { id: "light", name: "Light", tagline: "Clean and bright", dark: false, bg: "#f5f6f8", card: "#ffffff", from: "#357f00", to: "#0891b2" },
  { id: "sky", name: "Sky", tagline: "Light and blue", dark: false, bg: "#f2f7fc", card: "#ffffff", from: "#0a70c2", to: "#7c3aed" },
  { id: "blossom", name: "Blossom", tagline: "Light and rose", dark: false, bg: "#fbf3f5", card: "#ffffff", from: "#c0265f", to: "#ea580c" },
];

export const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function storedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // storage blocked (private mode): the default still works
  }
}

/** Sets the theme on the page. `animate` lets colours glide over a moment instead of snapping. */
export function applyTheme(id: ThemeId, { animate = false } = {}) {
  const root = document.documentElement;
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (animate && !reduced) {
    root.dataset.themeSwitching = "";
    window.setTimeout(() => delete root.dataset.themeSwitching, 450);
  }
  root.dataset.theme = theme.id;
  root.classList.toggle("dark", theme.dark);
  // The browser or installed-app chrome follows the page colour
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.bg);
}

/** Corner roundness: the base radius in px. Every card, field and button scales from it (globals.css). */
export const RADIUS_KEY = "crazy-rep-radius";
export const DEFAULT_RADIUS = 12;
export const RADII = [
  { px: 0, name: "Sharp" },
  { px: 6, name: "Subtle" },
  { px: 8, name: "Soft" },
  { px: 12, name: "Default" },
  { px: 18, name: "Round" },
  { px: 24, name: "Rounder" },
] as const;

export const isRadius = (v: unknown): v is number => RADII.some((r) => r.px === v);

export function storedRadius(): number {
  try {
    const v = Number(localStorage.getItem(RADIUS_KEY));
    return localStorage.getItem(RADIUS_KEY) !== null && isRadius(v) ? v : DEFAULT_RADIUS;
  } catch {
    return DEFAULT_RADIUS;
  }
}

export function applyRadius(px: number) {
  document.documentElement.style.setProperty("--radius", `${px}px`);
}

export function setRadius(px: number) {
  try {
    localStorage.setItem(RADIUS_KEY, String(px));
  } catch {}
  applyRadius(px);
  window.dispatchEvent(new Event(EVENT));
}

/** The radius currently on the page. */
export const currentRadius = (): number => {
  const v = Number.parseFloat(document.documentElement.style.getPropertyValue("--radius"));
  return isRadius(v) ? v : DEFAULT_RADIUS;
};

const EVENT = "crazy-rep-theme";

export function setTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {}
  applyTheme(id, { animate: true });
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeTheme(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === RADIUS_KEY) {
      applyRadius(storedRadius());
      return onChange();
    }
    if (e.key !== THEME_KEY) return;
    applyTheme(storedTheme()); // another tab changed it
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The theme currently on the page (the attribute is the source of truth, so it matches what is painted). */
export const currentTheme = (): ThemeId => {
  const v = document.documentElement.dataset.theme;
  return isTheme(v) ? v : DEFAULT_THEME;
};

/** Runs in <head> before the page paints, so a saved theme never flashes the default first. */
export function themeInitScript() {
  const table = Object.fromEntries(THEMES.map((t) => [t.id, { d: t.dark, b: t.bg }]));
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var m=${JSON.stringify(table)};if(!m[t])t=${JSON.stringify(DEFAULT_THEME)};var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",m[t].d);var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",m[t].b);var q=localStorage.getItem(${JSON.stringify(RADIUS_KEY)});if(q!==null&&${JSON.stringify(RADII.map((r) => String(r.px)))}.indexOf(q)>-1)r.style.setProperty("--radius",q+"px")}catch(e){}})()`;
}
