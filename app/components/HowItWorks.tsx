"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const steps = [
  { n: "01", icon: "✍️", title: "Type or snap", text: "Enter the meal name and portion. A photo is optional, but it improves accuracy." },
  { n: "02", icon: "🧠", title: "We do the math", text: "Calories and macros come from our food database, or from AI when it's something new." },
  { n: "03", icon: "🏃", title: "Track the rest", text: "Add activity, weight and water so your daily budget stays accurate." },
  { n: "04", icon: "🤖", title: "Ask your coach", text: "See your trends and ask the AI coach what to change." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section section--dark">
      <Reveal className="section__head">
        <span className="eyebrow">How it works</span>
        <h2>
          FROM PLATE TO <span className="accent">PROGRESS</span>
        </h2>
      </Reveal>

      <div className="steps">
        <motion.div
          className="steps__line"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.15}>
            <div className="step">
              <motion.div
                className="step__badge"
                whileHover={{ scale: 1.15, rotate: 8 }}
              >
                {s.icon}
              </motion.div>
              <span className="step__n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
