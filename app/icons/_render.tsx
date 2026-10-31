import { ImageResponse } from "next/og";

/** Lightning-bolt app icon. `padding` leaves a safe zone for Android maskable icons. */
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
          <svg width={inner * 0.6} height={inner * 0.6} viewBox="0 0 24 24">
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="#0a0a0c" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
