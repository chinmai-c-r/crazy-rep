import { ImageResponse } from "next/og";
import { MARK } from "@/components/LogoMark";

/** The Crazy Rep mark (a kettlebell with "CR" in it) as an app icon, on lime. `padding` leaves a safe zone for Android maskable icons. */
export function renderIcon(size: number, padding = 0) {
  const inner = size - padding * 2;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0c" }}>
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: padding ? inner * 0.5 : inner * 0.22,
            background: "#c6ff00",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={inner * 0.84} height={inner * 0.84} viewBox="2 6.8 60 60">
            <path d={MARK.handle.d} fill="none" stroke="#0a0a0c" strokeWidth={MARK.handle.width} strokeLinecap="round" strokeLinejoin="round" />
            <path d={MARK.body} fill="#0a0a0c" />
            <g fill="none" stroke="#c6ff00" strokeWidth={MARK.letters.width} strokeLinecap="round" strokeLinejoin="round">
              <path d={MARK.letters.c} />
              {MARK.letters.r.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
