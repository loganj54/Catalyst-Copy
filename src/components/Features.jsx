import React from 'react';
import { BarChart3, Zap, Users } from 'lucide-react';

const Features = () => {
  return (
    <section className="px-6 lg:px-12 py-24 bg-white">
      <div className="max-w-2xl mb-16">
        <h2 className="lg:text-4xl text-3xl font-semibold text-[#2A2B2A] tracking-tight mb-4">Everything you need to learn.</h2>
        <p className="text-lg text-stone-500 leading-relaxed">Powerful features packed into a simple, intuitive interface designed for modern teams.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-rows-2 gap-6 h-auto lg:h-[800px]">
        {/* Main Feature */}
        <div className="md:col-span-4 row-span-2 bg-[#F8F4E3] rounded-[2rem] p-8 lg:p-12 relative overflow-hidden group border border-stone-100 flex flex-col justify-between">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#FF4A1C] mb-6 shadow-sm">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-semibold text-[#2A2B2A] mb-3">Real-time Analytics</h3>
            <p className="text-stone-600 max-w-sm">Track every interaction and conversion with our privacy-first analytics engine. No cookies required.</p>
          </div>
          <div className="mt-8 relative h-64 lg:h-auto lg:flex-1 bg-white rounded-t-2xl shadow-xl border border-stone-200/50 p-6 overflow-hidden transform group-hover:scale-[1.02] transition-transform duration-500">
            {/* Fake UI */}
            <div className="flex items-end justify-between h-full w-full gap-2 px-2 pb-2">
              <div className="w-full bg-stone-100 rounded-t-sm h-[40%] group-hover:h-[60%] transition-all duration-700 delay-100"></div>
              <div className="w-full bg-[#FF4A1C]/20 rounded-t-sm h-[60%] group-hover:h-[85%] transition-all duration-700 delay-200"></div>
              <div className="w-full bg-[#FF4A1C] rounded-t-sm h-[30%] group-hover:h-[50%] transition-all duration-700 delay-150"></div>
              <div className="w-full bg-stone-100 rounded-t-sm h-[80%] group-hover:h-[65%] transition-all duration-700 delay-300"></div>
              <div className="w-full bg-stone-100 rounded-t-sm h-[45%] group-hover:h-[55%] transition-all duration-700"></div>
            </div>
          </div>
        </div>
        {/* Secondary Feature 1 */}
        <div className="md:col-span-2 bg-stone-50 rounded-[2rem] p-8 relative overflow-hidden group border border-stone-100">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-32 h-32 rotate-12" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-semibold text-[#2A2B2A] mb-2">Lightning Fast</h3>
            <p className="text-sm text-stone-500">Optimized for speed with 99.9% uptime SLA guarantee.</p>
          </div>
          <div className="mt-8 flex items-center gap-2">
            <div className="h-2 flex-1 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full w-[92%] bg-[#2A2B2A] rounded-full"></div>
            </div>
            <span className="text-xs font-bold font-mono">92ms</span>
          </div>
        </div>
        {/* Secondary Feature 2 */}
        <div className="md:col-span-2 bg-[#2A2B2A] rounded-[2rem] p-8 relative overflow-hidden group text-white">
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
              <p className="text-sm text-stone-400">Built for multiplayer. Comment, tag, and resolve.</p>
            </div>
            <div className="flex -space-x-3 mt-6">
              <div className="w-10 h-10 rounded-full border-2 border-[#2A2B2A] bg-stone-100"></div>
              <div className="w-10 h-10 rounded-full border-2 border-[#2A2B2A] bg-stone-300"></div>
              <div className="w-10 h-10 rounded-full border-2 border-[#2A2B2A] bg-[#FF4A1C] flex items-center justify-center text-[10px] font-bold">+5</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;



