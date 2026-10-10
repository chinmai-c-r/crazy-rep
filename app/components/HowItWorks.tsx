"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const steps = [
  { n: "01", icon: "📷", title: "Snap or upload", text: "Take a photo of your meal or post your own recipe to the community." },
  { n: "02", icon: "🧠", title: "AI does the math", text: "Calories, protein, carbs and fats are calculated instantly and logged for you." },
  { n: "03", icon: "🏋️", title: "Get your workout", text: "We suggest a session that balances today's intake with your goal." },
  { n: "04", icon: "🔥", title: "Rep together", text: "Share wins, join challenges and keep your streak alive with your crew." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section section--dark">
      <Reveal className="section__head">
        <span className="eyebrow">How it works</span>
        <h2>
          FROM PLATE TO <span className="accent">PERSONAL BEST</span>
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
