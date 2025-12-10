import React from 'react';

const CTA = () => {
  return (
    <section className="px-6 lg:px-12 py-24">
      <div className="bg-[#2A2B2A] rounded-[2.5rem] p-12 lg:p-24 text-center relative overflow-hidden">
        {/* Decorative Circles */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#FF4A1C]/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#FF4A1C]/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-semibold tracking-tight text-white mb-8">Ready to transform your workflow?</h2>
          <p className="text-stone-400 text-lg mb-10">Join 10,000+ teams who have already switched to Sereniti. Start your free 14-day trial today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 bg-[#FF4A1C] hover:bg-[#FF6700] text-white rounded-full font-medium shadow-xl shadow-orange-900/20 transition-all w-full sm:w-auto">Get Started Now</button>
            <button className="px-8 py-4 bg-transparent border border-stone-600 hover:bg-stone-800 text-white rounded-full font-medium transition-all w-full sm:w-auto">Schedule Demo</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;



