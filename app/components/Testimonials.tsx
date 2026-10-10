import Reveal from "./Reveal";

const quotes = [
  { text: "I dropped 9kg in four months. Scanning meals takes two seconds and the workouts actually fit my week.", name: "Maya R.", role: "Lost 9 kg" },
  { text: "The recipe community is gold. I found meals I genuinely love that hit my macros every single day.", name: "Dev P.", role: "Strength athlete" },
  { text: "My crew keeps me honest. We haven't missed a streak in 60 days and I've never felt stronger.", name: "Zoe L.", role: "Marathon runner" },
];

export default function Testimonials() {
  return (
    <section className="section section--dark">
      <Reveal className="section__head">
        <span className="eyebrow">Real results</span>
        <h2>
          LOVED BY <span className="accent">REPPERS</span>
        </h2>
      </Reveal>
      <div className="quotes">
        {quotes.map((q, i) => (
          <Reveal key={q.name} delay={i * 0.12}>
            <figure className="quote">
              <div className="stars" aria-label="5 out of 5 stars">★★★★★</div>
              <blockquote>“{q.text}”</blockquote>
              <figcaption>
                <b>{q.name}</b>
                <span>{q.role}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
