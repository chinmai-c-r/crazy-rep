"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Reveal from "./Reveal";

export default function CTA() {
  const [sent, setSent] = useState(false);

  return (
    <section id="cta" className="cta">
      <motion.div
        className="cta__orb"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
      />
      <Reveal>
        <h2>
          READY TO GO <span className="accent">CRAZY?</span>
        </h2>
        <p>
          Join 250,000+ members. Get early access and your first month of Pro
          free.
        </p>

        {sent ? (
          <motion.p
            className="cta__thanks"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            🔥 You&apos;re on the list!
          </motion.p>
        ) : (
          <form
            className="cta__form"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <input
              type="email"
              required
              placeholder="Enter your email"
              aria-label="Email address"
            />
            <button className="btn" type="submit">
              Join the waitlist
            </button>
          </form>
        )}

        <div className="cta__stores">
          <span> App Store</span>
          <span>▶ Google Play</span>
        </div>
      </Reveal>
    </section>
  );
}
