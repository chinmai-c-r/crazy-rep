import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import "./landing.css";
import RegisterSW from "./components/RegisterSW";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

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
  title: "Crazy Rep — AI calorie tracker",
  description:
    "Log meals by name or photo and get instant calories and macros. Track activity, weight and water, and ask an AI coach about your progress.",
  applicationName: "Crazy Rep",
  appleWebApp: { capable: true, title: "Crazy Rep", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(display.variable, body.variable, "dark")}>
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <RegisterSW />
      </body>
    </html>
  );
}
