import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Scanner from "./components/Scanner";
import RequestAccess from "./components/RequestAccess";
import Footer from "./components/Footer";
import ScrollProgress from "./components/ScrollProgress";

export default function Home() {
  return (
    <div className="landing">
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Scanner />
        <RequestAccess />
      </main>
      <Footer />
    </div>
  );
}
