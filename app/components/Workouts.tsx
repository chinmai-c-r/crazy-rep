"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import Reveal from "./Reveal";

const goals = {
  "Build Muscle": {
    icon: "🏋️",
    desc: "Progressive overload with smart volume, built around what you ate.",
    stats: ["45 min", "Hypertrophy", "Gym"],
    moves: [["Barbell Back Squat", "4 × 8"], ["Incline DB Press", "4 × 10"], ["Weighted Pull-ups", "3 × 8"], ["Romanian Deadlift", "3 × 10"]],
  },
  "Burn Fat": {
    icon: "🔥",
    desc: "High-intensity intervals that torch calories and keep your metabolism firing.",
    stats: ["30 min", "HIIT", "Anywhere"],
    moves: [["Burpees", "40s on / 20s off"], ["Mountain Climbers", "40s on / 20s off"], ["Jump Squats", "40s on / 20s off"], ["Battle Ropes", "40s on / 20s off"]],
  },
  Endurance: {
    icon: "🏃",
    desc: "Build your engine with tempo runs, intervals and recovery sessions.",
    stats: ["50 min", "Cardio", "Outdoors"],
    moves: [["Warm-up Jog", "10 min"], ["Tempo Run", "20 min"], ["Hill Sprints", "6 × 30s"], ["Cool-down Walk", "5 min"]],
  },
  "Flex & Recover": {
    icon: "🧘",
    desc: "Mobility flows and breathwork to move better and bounce back faster.",
    stats: ["25 min", "Mobility", "Home"],
    moves: [["Cat–Cow Flow", "2 min"], ["World's Greatest Stretch", "3 min"], ["Pigeon Pose", "2 min / side"], ["Box Breathing", "4 min"]],
  },
} as const;

type Goal = keyof typeof goals;

export default function Workouts() {
  const names = Object.keys(goals) as Goal[];
  const [goal, setGoal] = useState<Goal>(names[0]);
  const g = goals[goal];

  return (
    <section id="workouts" className="section section--dark">
      <Reveal className="section__head">
        <span className="eyebrow">Smart workouts</span>
        <h2>
          TRAIN FOR <span className="accent">YOUR GOAL</span>
        </h2>
        <p>Pick a goal — Crazy Rep builds the session and adjusts as you progress.</p>
      </Reveal>

      <Reveal>
        <div className="workouts">
          <div className="workouts__tabs" role="tablist">
            {names.map((n) => (
              <button
                key={n}
                role="tab"
                aria-selected={n === goal}
                className={n === goal ? "chip chip--on" : "chip"}
                onClick={() => setGoal(n)}
              >
                {goals[n].icon} {n}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={goal}
              className="workouts__panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35 }}
            >
              <div className="workouts__info">
                <motion.div
                  className="workouts__icon"
                  animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.12, 1] }}
                  transition={{ duration: 0.8 }}
                >
                  {g.icon}
                </motion.div>
                <h3>{goal}</h3>
                <p>{g.desc}</p>
                <div className="workouts__meta">
                  {g.stats.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>
              <ol className="moves">
                {g.moves.map(([m, r], i) => (
                  <motion.li
                    key={m}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                  >
                    <span className="moves__n">{i + 1}</span>
                    <span className="moves__name">{m}</span>
                    <b>{r}</b>
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
