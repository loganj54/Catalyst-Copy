import React from 'react';
import { ArrowLeft, ArrowRight, Search, Map, Rocket } from 'lucide-react';

const Process = () => {
  return (
    <section className="px-6 lg:px-12 py-24 border-t border-stone-100">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
        <div className="max-w-xl">
          <span className="text-[#FF4A1C] font-semibold tracking-tight mb-2 block">The Workflow</span>
          <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-[#2A2B2A]">From idea to launch in record time.</h2>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 rounded-full bg-[#2A2B2A] text-white flex items-center justify-center hover:bg-black transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {/* Step 1 */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-5xl font-semibold text-stone-100 mb-6">01</div>
          <h3 className="text-xl font-semibold text-[#2A2B2A] mb-3">Discovery</h3>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">We dive deep into your business model to understand the core challenges and opportunities.</p>
          <div className="w-full h-32 bg-stone-50 rounded-xl border border-dashed border-stone-200 flex items-center justify-center">
            <Search className="w-8 h-8 text-stone-300" />
          </div>
        </div>
        {/* Step 2 */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow relative">
          <div className="absolute -top-3 -right-3 bg-[#FF4A1C] text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Popular</div>
          <div className="text-5xl font-semibold text-stone-100 mb-6">02</div>
          <h3 className="text-xl font-semibold text-[#2A2B2A] mb-3">Strategy</h3>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">Crafting a bespoke roadmap that aligns with your market goals and user needs.</p>
          <div className="w-full h-32 bg-stone-50 rounded-xl border border-dashed border-stone-200 flex items-center justify-center">
            <Map className="w-8 h-8 text-stone-300" />
          </div>
        </div>
        {/* Step 3 */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-5xl font-semibold text-stone-100 mb-6">03</div>
          <h3 className="text-xl font-semibold text-[#2A2B2A] mb-3">Execution</h3>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">Agile development cycles ensuring rapid delivery without compromising on quality.</p>
          <div className="w-full h-32 bg-stone-50 rounded-xl border border-dashed border-stone-200 flex items-center justify-center">
            <Rocket className="w-8 h-8 text-stone-300" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Process;



