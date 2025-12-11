import React from 'react';
import Hero from '../components/Hero';
import LogoCloud from '../components/LogoCloud';
import Features from '../components/Features';
import Process from '../components/Process';
import Testimonials from '../components/Testimonials';
import Pricing from '../components/Pricing';
import InteractiveProcess from '../components/InteractiveProcess';
import CTA from '../components/CTA';

const Home = () => {
  return (
    <>
      <Hero />
      <LogoCloud />
      <Features />
      <Process />
      <InteractiveProcess />
      <Testimonials />
      <Pricing />
      <CTA />
    </>
  );
};

export default Home;
