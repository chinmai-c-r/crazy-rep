"use client";

import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { useEffect, useState } from "react";

const links = [
  ["Features", "#features"],
  ["How it works", "#how"],
  ["AI scanner", "#scanner"],
  ["Request access", "#access"],
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "nav--solid" : ""}`}>
      <a href="#top" className="logo" aria-label="Crazy Rep home">
        <span className="logo__mark">
          <LogoMark />
        </span>
        CRAZY<span>REP</span>
      </a>
      <nav className="nav__links" aria-label="Primary">
        {links.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <Link href="/login" className="btn btn--small">
        Sign in
      </Link>
    </header>
  );
}
