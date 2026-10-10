"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = { to: number; suffix?: string; duration?: number };

export default function CountUp({ to, suffix = "", duration = 2 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = Math.round(v).toLocaleString() + suffix;
      },
    });
    return () => controls.stop();
  }, [inView, to, suffix, duration]);

  return <span ref={ref}>0{suffix}</span>;
}
