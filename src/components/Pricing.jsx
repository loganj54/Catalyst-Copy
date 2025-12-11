import React from 'react';
import { Check } from 'lucide-react';

const Pricing = () => {
  return (
    <section className="px-6 lg:px-12 py-24 bg-[#F8F4E3] border-t border-stone-200">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-[#2A2B2A] mb-4">Simple, transparent pricing.</h2>
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className="text-sm font-medium text-stone-500">Monthly</span>
          <button className="w-12 h-6 bg-[#2A2B2A] rounded-full relative px-1 flex items-center cursor-pointer">
            <div className="w-4 h-4 bg-white rounded-full shadow-sm translate-x-6 transition-transform"></div>
          </button>
          <span className="text-sm font-medium text-[#2A2B2A]">Yearly <span className="text-[#FF4A1C] text-xs font-bold bg-[#FF4A1C]/10 px-2 py-0.5 rounded-full ml-1">-20%</span></span>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
        {/* Basic */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-[#2A2B2A] mb-2">Starter</h3>
          <p className="text-stone-500 text-sm mb-6">For individuals just getting started.</p>
          <div className="text-4xl font-bold text-[#2A2B2A] mb-6">$0<span className="text-base font-normal text-stone-400">/mo</span></div>
          <button className="w-full py-3 px-4 rounded-xl bg-stone-100 text-[#2A2B2A] font-medium text-sm hover:bg-stone-200 transition-colors mb-8">Get Started</button>
          <ul className="space-y-3 text-sm text-stone-600">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#2A2B2A]" /> 1 User</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#2A2B2A]" /> 5 Projects</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#2A2B2A]" /> Community Support</li>
          </ul>
        </div>
        {/* Pro */}
        <div className="bg-[#2A2B2A] p-8 rounded-3xl shadow-xl relative transform scale-105 z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#FF4A1C] text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">Most Popular</div>
          <h3 className="text-lg font-semibold text-white mb-2">Professional</h3>
          <p className="text-stone-400 text-sm mb-6">For growing teams and businesses.</p>
          <div className="text-4xl font-bold text-white mb-6">$49<span className="text-base font-normal text-stone-500">/mo</span></div>
          <button className="w-full py-3 px-4 rounded-xl bg-[#FF4A1C] text-white font-medium text-sm hover:bg-[#FF6700] transition-colors mb-8 shadow-lg shadow-orange-900/20">Get Started</button>
          <ul className="space-y-3 text-sm text-stone-300">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#FF4A1C]" /> Unlimited Users</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#FF4A1C]" /> Unlimited Projects</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#FF4A1C]" /> Priority Support</li>
          </ul>
        </div>
        {/* Enterprise */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-[#2A2B2A] mb-2">Enterprise</h3>
          <p className="text-stone-500 text-sm mb-6">Custom solutions for large orgs.</p>
          <div className="text-4xl font-bold text-[#2A2B2A] mb-6">Custom</div>
          <button className="w-full py-3 px-4 rounded-xl bg-stone-100 text-[#2A2B2A] font-medium text-sm hover:bg-stone-200 transition-colors mb-8">Contact Sales</button>
          <ul className="space-y-3 text-sm text-stone-600">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#2A2B2A]" /> SSO & Security</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#2A2B2A]" /> Dedicated Manager</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#2A2B2A]" /> Custom SLA</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Pricing;




