import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import "./landing.css";
import RegisterSW from "./components/RegisterSW";
import ThemeSync from "./components/ThemeSync";
import { Toaster } from "@/components/ui/sonner";
import { themeInitScript } from "@/lib/theme";
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
  // Lets Google Search Console confirm you own the site (set the code from its "HTML tag" method). Not needed if you verify with DNS.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script edits data-theme and the dark class before React loads
    <html lang="en" className={cn(display.variable, body.variable, "dark")} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <RegisterSW />
        <ThemeSync />
      </body>
    </html>
  );
}
