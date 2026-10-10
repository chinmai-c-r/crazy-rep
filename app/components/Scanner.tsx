"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import CountUp from "./CountUp";
import Reveal from "./Reveal";

const meals = [
  {
    key: "bowl",
    emoji: "🥗",
    name: "Chicken Power Bowl",
    kcal: 520,
    items: ["Grilled chicken · 150g", "Quinoa · 120g", "Avocado · ½", "Mixed greens"],
    macros: { Protein: 42, Carbs: 48, Fat: 18 },
  },
  {
    key: "oats",
    emoji: "🥣",
    name: "Berry Protein Oats",
    kcal: 380,
    items: ["Rolled oats · 60g", "Whey · 1 scoop", "Blueberries · 80g", "Almond butter"],
    macros: { Protein: 30, Carbs: 52, Fat: 9 },
  },
  {
    key: "salmon",
    emoji: "🍣",
    name: "Salmon & Sweet Potato",
    kcal: 610,
    items: ["Salmon fillet · 180g", "Sweet potato · 200g", "Broccoli · 100g", "Olive oil"],
    macros: { Protein: 46, Carbs: 44, Fat: 24 },
  },
];

const colours: Record<string, string> = {
  Protein: "var(--lime)",
  Carbs: "var(--orange)",
  Fat: "var(--pink)",
};

export default function Scanner() {
  const [active, setActive] = useState(0);
  const meal = meals[active];

  return (
    <section id="scanner" className="section">
      <Reveal className="section__head">
        <span className="eyebrow">AI Calorie Scanner</span>
        <h2>
          POINT. SHOOT. <span className="accent">KNOW.</span>
        </h2>
        <p>Try the scanner — pick a meal and watch the AI break it down.</p>
      </Reveal>

      <Reveal>
        <div className="scanner">
          <div className="scanner__photo">
            <div className="scanner__tabs">
              {meals.map((m, i) => (
                <button
                  key={m.key}
                  className={i === active ? "tab tab--on" : "tab"}
                  onClick={() => setActive(i)}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={meal.key}
                className="scanner__plate"
                initial={{ scale: 0.4, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.4, rotate: 90, opacity: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 16 }}
              >
                {meal.emoji}
              </motion.div>
            </AnimatePresence>
            <div className="scanner__frame">
              <i /><i /><i /><i />
            </div>
            <div className="scanner__beam" />
          </div>

          <div className="scanner__result">
            <AnimatePresence mode="wait">
              <motion.div
                key={meal.key}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35 }}
              >
                <span className="tag">✓ Identified by AI · 96% confidence</span>
                <h3>{meal.name}</h3>
                <div className="scanner__kcal">
                  <CountUp key={meal.key} to={meal.kcal} duration={1.2} />
                  <small>kcal</small>
                </div>
                <ul className="scanner__items">
                  {meal.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <div className="bars">
                  {Object.entries(meal.macros).map(([name, g]) => (
                    <div key={name} className="bar">
                      <div className="bar__top">
                        <span>{name}</span>
                        <b>{g}g</b>
                      </div>
                      <div className="bar__track">
                        <motion.div
                          className="bar__fill"
                          style={{ background: colours[name] }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(g * 1.8, 100)}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
