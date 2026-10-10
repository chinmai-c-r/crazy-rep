const items = [
  "🏋️ STRENGTH",
  "🏃 CARDIO",
  "🥗 NUTRITION",
  "🧘 MOBILITY",
  "🔥 HIIT",
  "🚴 ENDURANCE",
  "🥩 HIGH PROTEIN",
  "🤸 CALISTHENICS",
];

export default function Marquee() {
  const row = [...items, ...items];
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee__track">
        {row.map((t, i) => (
          <span key={i}>
            {t}
            <em>✦</em>
          </span>
        ))}
      </div>
    </div>
  );
}
