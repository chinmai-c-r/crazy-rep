/**
 * The Crazy Rep mark: a kettlebell with "CR" in its body. The weight is the gym, the letters are Crazy Rep (and Chinmai CR).
 * The letters are cut out of the bell (a mask), so they show whatever the mark sits on. Drawn in `currentColor`, so it takes
 * the colour of its surroundings. Shared by the app, the landing page and the icons.
 */
export const MARK = {
  handle: { d: "M19.4 34V22.5a6 6 0 0 1 6-6h13.2a6 6 0 0 1 6 6V34", width: 6.4 },
  body: "M20.43 60.3A20.4 20.4 0 1 1 43.57 60.3Z",
  letters: { c: "M30.79 40.08A7.35 7.35 0 1 0 30.79 49.92", r: ["M37.29 37.65V52.35", "M37.29 37.65H39.95A3.55 3.55 0 0 1 39.95 44.75H37.29", "M39.76 45.25L46.03 52.35"], width: 4.3 },
};

export function LogoMark({ className }: { className?: string }) {
  const { handle, body, letters } = MARK;
  return (
    // 2 6.8 60 60: the mark centred, with some air around it inside whatever tile it's placed in
    <svg viewBox="2 6.8 60 60" fill="none" className={className} aria-hidden>
      {/* The same id wherever the mark appears is fine: every copy is identical */}
      <mask id="crazy-rep-mark-cr" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="72">
        <rect width="64" height="72" fill="#fff" />
        <g stroke="#000" strokeWidth={letters.width} strokeLinecap="round" strokeLinejoin="round">
          <path d={letters.c} />
          {letters.r.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </mask>
      <g mask="url(#crazy-rep-mark-cr)">
        <path d={handle.d} stroke="currentColor" strokeWidth={handle.width} strokeLinecap="round" strokeLinejoin="round" />
        <path d={body} fill="currentColor" />
      </g>
    </svg>
  );
}
