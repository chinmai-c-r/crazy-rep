const items = [
  "📸 PHOTO OR NAME",
  "🍛 INDIAN DISHES",
  "🥩 MACROS",
  "🏃 ACTIVITY",
  "⚖️ WEIGHT",
  "💧 WATER",
  "🤖 AI COACH",
  "📈 5-YEAR HISTORY",
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
