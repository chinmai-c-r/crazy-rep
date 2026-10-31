"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const features = [
  {
    icon: "📸",
    title: "AI meal logging",
    text: "Type a meal name, or add a photo for better accuracy. Get calories, protein, carbs, fat, fiber, sugar and sodium in seconds.",
  },
  {
    icon: "🍛",
    title: "Built for Indian food",
    text: "7,500+ dishes from Indian nutrition databases and recipes, plus the USDA database for everything else. Typos are fine.",
  },
  {
    icon: "🏃",
    title: "Activity tracking",
    text: "Log walks, runs, gym sessions, yoga and more. Calories burned are worked out from your weight and the intensity.",
  },
  {
    icon: "⚖️",
    title: "Weight and water",
    text: "Log your weight and body fat, tap to add water, and see how you're moving towards your goal.",
  },
  {
    icon: "🤖",
    title: "AI coach",
    text: "Ask about your meals, activity and weight in plain language. The coach answers from your own data.",
  },
  {
    icon: "📈",
    title: "Up to 5 years of history",
    text: "Daily, weekly and monthly charts for calories, macros, activity and weight, so you can see what's actually working.",
  },
];

export default function Features() {
  return (
    <section id="features" className="section">
      <Reveal className="section__head">
        <span className="eyebrow">Everything you need</span>
        <h2>
          ONE APP. <span className="accent">EVERY MEAL.</span>
        </h2>
        <p>
          Meals, activity, weight and water in one place, with an AI coach that knows your numbers.
        </p>
      </Reveal>

      <div className="cards">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <motion.article
              className="card"
              whileHover={{ y: -10, rotateX: 4, rotateY: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <div className="card__icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="card__num">0{i + 1}</span>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
