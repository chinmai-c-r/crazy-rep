"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const plans = [
  {
    name: "Starter",
    price: "$0",
    note: "Free forever",
    perks: ["5 AI scans per day", "Community recipes", "Basic workouts", "Join challenges"],
    hot: false,
  },
  {
    name: "Pro",
    price: "$9",
    note: "per month",
    perks: ["Unlimited AI scans", "Adaptive workout plans", "Advanced macro insights", "Upload unlimited recipes", "Priority crew features"],
    hot: true,
  },
  {
    name: "Team",
    price: "$29",
    note: "per month · up to 10",
    perks: ["Everything in Pro", "Coach dashboard", "Private crew challenges", "Progress reports"],
    hot: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="section">
      <Reveal className="section__head">
        <span className="eyebrow">Pricing</span>
        <h2>
          PICK YOUR <span className="accent">PLAN</span>
        </h2>
        <p>Start free. Upgrade when you are ready to go all in.</p>
      </Reveal>
      <div className="plans">
        {plans.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.1}>
            <motion.div
              className={p.hot ? "plan plan--hot" : "plan"}
              whileHover={{ y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {p.hot && <span className="plan__badge">MOST POPULAR</span>}
              <h3>{p.name}</h3>
              <div className="plan__price">
                {p.price}
                <small>{p.note}</small>
              </div>
              <ul>
                {p.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <a href="#cta" className={p.hot ? "btn" : "btn btn--ghost"}>
                {p.hot ? "Go Pro" : "Choose " + p.name}
              </a>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
