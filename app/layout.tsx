import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const display = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crazy Rep — Eat Smart. Train Hard. Rep Together.",
  description:
    "Crazy Rep is the fitness community where you share recipes, snap a photo for instant AI calorie counts, and get workouts matched to your goals.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
