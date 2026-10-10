"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const recipes = [
  { emoji: "🍳", title: "Protein Omelette Stack", by: "@maya.lifts", kcal: 340, likes: "2.4k", hue: "#c6ff00" },
  { emoji: "🌯", title: "Mega Chicken Burrito Bowl", by: "@coachdev", kcal: 610, likes: "1.9k", hue: "#ff8a00" },
  { emoji: "🥞", title: "Banana Oat Pancakes", by: "@fitwithzoe", kcal: 290, likes: "3.1k", hue: "#ff2e93" },
  { emoji: "🍜", title: "High-Protein Ramen", by: "@ironnoodle", kcal: 480, likes: "1.2k", hue: "#00e5ff" },
];

const board = [
  ["🥇", "Aarav K.", "12,480 pts"],
  ["🥈", "Sofia M.", "11,930 pts"],
  ["🥉", "Liam T.", "10,775 pts"],
  ["4", "Priya S.", "9,860 pts"],
];

export default function Community() {
  return (
    <section id="community" className="section">
      <Reveal className="section__head">
        <span className="eyebrow">Community</span>
        <h2>
          STRONGER <span className="accent">TOGETHER</span>
        </h2>
        <p>Discover recipes from real people, join crews and compete in weekly challenges.</p>
      </Reveal>

      <div className="community">
        <div className="recipes">
          {recipes.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.1}>
              <motion.article
                className="recipe"
                style={{ ["--hue" as string]: r.hue }}
                whileHover={{ y: -8, scale: 1.02 }}
              >
                <div className="recipe__img">
                  <motion.span
                    animate={{ y: [0, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 3 + i * 0.4, ease: "easeInOut" }}
                  >
                    {r.emoji}
                  </motion.span>
                </div>
                <h3>{r.title}</h3>
                <p>{r.by}</p>
                <div className="recipe__meta">
                  <span>🔥 {r.kcal} kcal</span>
                  <span>❤️ {r.likes}</span>
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <aside className="board">
            <h3>🏆 Weekly Challenge</h3>
            <p>10K Steps + 100g Protein</p>
            <ul>
              {board.map(([rank, name, pts], i) => (
                <motion.li
                  key={name}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12 }}
                >
                  <span className="board__rank">{rank}</span>
                  <span className="board__name">{name}</span>
                  <b>{pts}</b>
                </motion.li>
              ))}
            </ul>
            <a href="#cta" className="btn btn--small">
              Join the challenge
            </a>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}
