import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Scanner from "./components/Scanner";
import Workouts from "./components/Workouts";
import Stats from "./components/Stats";
import Community from "./components/Community";
import Testimonials from "./components/Testimonials";
import Pricing from "./components/Pricing";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import ScrollProgress from "./components/ScrollProgress";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Scanner />
        <Workouts />
        <Stats />
        <Community />
        <Testimonials />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
