import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import About from "@/components/site/About";
import Services from "@/components/site/Services";
import FarseAI from "@/components/site/FarseAI";
import TechStack from "@/components/site/TechStack";
import WhyUs from "@/components/site/WhyUs";
import Testimonials from "@/components/site/Testimonials";
import Contact from "@/components/site/Contact";
import Footer from "@/components/site/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <About />
      <Services />
      <FarseAI />
      <TechStack />
      <WhyUs />
      <Testimonials />
      <Contact />
      <Footer />
    </main>
  );
}
