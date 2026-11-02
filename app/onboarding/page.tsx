import type { Metadata } from "next";
import OnboardingView from "./OnboardingView";

export const metadata: Metadata = { title: "Set up your goals — Crazy Rep" };

export default function OnboardingPage() {
  return <OnboardingView />;
}
