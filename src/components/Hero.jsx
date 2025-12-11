import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import BlueprintModal from './BlueprintModal';

const Hero = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="relative px-6 lg:px-12 pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
      {isModalOpen && <BlueprintModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-[#2A2B2A] mb-8 leading-[1.1] animate-fade-in-up delay-100">
          The Learn <br />
          <span className="text-stone-400 italic">Engineering</span> App
        </h1>
        <p className="text-xl text-stone-500 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
          The all-in-one platform for engineering students. Crush classes, build projects, learn skills, and start your career all in one place.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-[#FF4A1C] hover:bg-black text-white rounded-full font-medium transition-all shadow-xl shadow-stone-200/50 flex items-center gap-2 group w-full sm:w-auto justify-center"
          >
            Generate Blueprint
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="px-8 py-4 bg-white hover:bg-stone-50 text-[#2A2B2A] border border-stone-200 rounded-full font-medium transition-all w-full sm:w-auto">
            View Pricing
          </button>
        </div>
      </div>
      
      {/* Abstract Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-[#FF4A1C]/10 to-transparent rounded-full blur-3xl -z-10"></div>
    </section>
  );
};

export default Hero;
