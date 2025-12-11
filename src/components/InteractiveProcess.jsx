import React from 'react';

const InteractiveProcess = () => {
  return (
    <section className="px-6 lg:px-12 py-24 bg-stone-900 text-white overflow-hidden">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-8">How we work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-stone-800/50 rounded-2xl border border-stone-700">
             <div className="text-[#FF4A1C] text-xl font-bold mb-4">01. Plan</div>
             <p className="text-stone-400">We start with a comprehensive roadmap to ensure success.</p>
          </div>
          <div className="p-6 bg-stone-800/50 rounded-2xl border border-stone-700">
             <div className="text-[#FF4A1C] text-xl font-bold mb-4">02. Build</div>
             <p className="text-stone-400">Our team executes with precision and speed.</p>
          </div>
          <div className="p-6 bg-stone-800/50 rounded-2xl border border-stone-700">
             <div className="text-[#FF4A1C] text-xl font-bold mb-4">03. Launch</div>
             <p className="text-stone-400">We ensure a smooth deployment and handover.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveProcess;
