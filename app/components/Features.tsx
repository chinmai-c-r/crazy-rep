"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const features = [
  {
    icon: "📸",
    title: "AI Calorie Scanner",
    text: "Snap a photo of any meal. Our vision AI identifies ingredients, portions and macros in seconds.",
  },
  {
    icon: "🍲",
    title: "Recipe Sharing",
    text: "Upload your recipes with photos, steps and auto-calculated nutrition. Remix and save the community's best.",
  },
  {
    icon: "💪",
    title: "Smart Workouts",
    text: "Plans that adapt to your goals, equipment, schedule and what you ate today.",
  },
  {
    icon: "🏆",
    title: "Challenges & Streaks",
    text: "Join weekly challenges, climb leaderboards and earn badges that make consistency addictive.",
  },
  {
    icon: "👥",
    title: "Crews",
    text: "Build or join a crew. Cheer each other on, share progress and hold each other accountable.",
  },
  {
    icon: "📈",
    title: "Progress Insights",
    text: "Track weight, macros, volume and PRs with clean charts that show what is actually working.",
  },
];

export default function Features() {
  return (
    <section id="features" className="section">
      <Reveal className="section__head">
        <span className="eyebrow">Everything you need</span>
        <h2>
          ONE APP. <span className="accent">ZERO EXCUSES.</span>
        </h2>
        <p>
          Nutrition, training and community in one place — so staying consistent finally feels
          effortless.
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
