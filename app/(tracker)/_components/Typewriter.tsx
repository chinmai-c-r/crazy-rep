"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Types example dishes into the empty field, one after another. */
export default function Typewriter({ reduce, ideas, className }: { reduce: boolean; ideas: string[]; className?: string }) {
  const [s, setS] = useState({ line: 0, chars: 0, deleting: false });
  useEffect(() => {
    if (reduce) return;
    const text = ideas[s.line % ideas.length];
    let delay = s.deleting ? 26 : 62;
    let next = s;
    if (!s.deleting && s.chars === text.length) {
      delay = 1500;
      next = { ...s, deleting: true };
    } else if (s.deleting && s.chars === 0) {
      delay = 300;
      next = { line: (s.line + 1) % ideas.length, chars: 0, deleting: false };
    } else next = { ...s, chars: s.chars + (s.deleting ? -1 : 1) };
    const t = setTimeout(() => setS(next), delay);
    return () => clearTimeout(t);
  }, [s, reduce, ideas]);
  const text = reduce ? ideas[0] : ideas[s.line % ideas.length].slice(0, s.chars);
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 flex items-center text-muted-foreground/45", className)}>
      <span className="truncate">{text}</span>
      {!reduce && <i className="ml-0.5 inline-block h-[1.1em] w-0.5 shrink-0 animate-pulse bg-primary" />}
    </span>
  );
}
