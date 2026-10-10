import CountUp from "./CountUp";
import Reveal from "./Reveal";

const stats = [
  { to: 250000, suffix: "+", label: "Active members" },
  { to: 80000, suffix: "+", label: "Recipes shared" },
  { to: 2000000, suffix: "+", label: "Meals scanned" },
  { to: 98, suffix: "%", label: "Calorie accuracy" },
];

export default function Stats() {
  return (
    <section className="stats">
      {stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.1}>
          <div className="stat">
            <b>
              <CountUp to={s.to} suffix={s.suffix} />
            </b>
            <span>{s.label}</span>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
