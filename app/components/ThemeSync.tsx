"use client";

import { useEffect } from "react";
import { applyTheme, storedTheme } from "@/lib/theme";

/**
 * The inline script sets the theme before paint; this re-applies it once React is running, which also fixes the
 * browser's theme-colour tag (it is not in the page yet when the script runs).
 */
export default function ThemeSync() {
  useEffect(() => {
    applyTheme(storedTheme());
  }, []);
  return null;
}
