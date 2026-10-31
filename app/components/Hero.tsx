"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const words = ["SNAP", "IT.", "LOG", "IT.", "KNOW", "IT."];

export default function Hero() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 18 });
  const sy = useSpring(my, { stiffness: 80, damping: 18 });
  const rotateY = useTransform(sx, [-1, 1], [-12, 12]);
  const rotateX = useTransform(sy, [-1, 1], [10, -10]);
  const floatX = useTransform(sx, [-1, 1], [-24, 24]);
  const floatY = useTransform(sy, [-1, 1], [-18, 18]);
  const floatXInv = useTransform(floatX, (v) => -v);
  const floatYInv = useTransform(floatY, (v) => -v);

  return (
    <section
      id="top"
      className="hero"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
    >
      <div className="hero__glow hero__glow--a" />
      <div className="hero__glow hero__glow--b" />
      <div className="hero__grid" />

      <div className="hero__text">
        <motion.span
          className="pill"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <i className="pulse-dot" /> AI calorie tracker · free in early access
        </motion.span>

        <h1 className="hero__title" aria-label="Snap it. Log it. Know it.">
          {words.map((w, i) => (
            <span className="hero__wordwrap" key={i} aria-hidden>
              <motion.span
                className={i % 2 === 1 ? "hero__word accent" : "hero__word"}
                initial={{ y: "110%", rotate: 6 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          className="hero__sub"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          Type a meal name or snap a photo for instant calories and macros. Track activity, weight
          and water, and ask the AI coach how you&apos;re doing.
        </motion.p>

        <motion.div
          className="hero__cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15 }}
        >
          <a href="#access" className="btn">
            Request access
          </a>
          <a href="#scanner" className="btn btn--ghost">
            ▶ See the AI in action
          </a>
        </motion.div>

        <motion.div
          className="hero__proof"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <div className="avatars">
            {["🍛", "🥗", "🍳", "🥤", "🍎"].map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
          <p>
            <strong>7,500+</strong> Indian and global dishes ready to log
          </p>
        </motion.div>
      </div>

      <motion.div
        className="hero__visual"
        style={{ rotateX, rotateY, transformPerspective: 1000 }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="phone">
          <div className="phone__notch" />
          <div className="phone__screen">
            <div className="hero-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" className="hero-ring__bg" />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="hero-ring__fg"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 0.78 }}
                  transition={{ delay: 1.2, duration: 2, ease: "easeOut" }}
                />
              </svg>
              <div className="hero-ring__label">
                <b>1,560</b>
                <small>kcal today</small>
              </div>
            </div>
            <div className="phone__row">
              <span>🍛 Chicken biryani</span>
              <b>520</b>
            </div>
            <div className="phone__row">
              <span>🍳 Masala omelette</span>
              <b>340</b>
            </div>
            <div className="phone__row phone__row--hot">
              <span>🏃 Brisk walk · 30 min</span>
              <b>−150</b>
            </div>
          </div>
        </div>

        <motion.div className="float float--a" style={{ x: floatX, y: floatY }}>
          <span>🍗</span>
          <div>
            <b>42g protein</b>
            <small>detected by AI</small>
          </div>
        </motion.div>
        <motion.div className="float float--b" style={{ x: floatXInv, y: floatYInv }}>
          <span>🎯</span>
          <div>
            <b>Under budget</b>
            <small>440 kcal left today</small>
          </div>
        </motion.div>
        <motion.div className="float float--c" style={{ x: floatX }}>
          <span>💧</span>
          <div>
            <b>2.1 L water</b>
            <small>goal 2.5 L</small>
          </div>
        </motion.div>
      </motion.div>

      <div className="scroll-hint" aria-hidden>
        <span />
      </div>
    </section>
  );
}
