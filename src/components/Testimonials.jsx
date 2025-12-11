import React from 'react';
import { Star } from 'lucide-react';

const Testimonials = () => {
  return (
    <section className="px-6 lg:px-12 py-24 overflow-hidden">
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-[#2A2B2A] text-center mb-16">Loved by thousands of creators.</h2>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Review 1 */}
        <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
          <div className="flex gap-1 text-[#FF4A1C] mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-current" />
            ))}
          </div>
          <p className="text-[#2A2B2A] font-medium mb-6 leading-relaxed">"The level of detail Sereniti provides is unmatched. It has completely transformed how we handle our engineering workflows."</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-200 rounded-full"></div>
            <div>
              <p className="text-sm font-semibold text-[#2A2B2A]">Sarah Jenkins</p>
              <p className="text-xs text-stone-500">CTO at TechFlow</p>
            </div>
          </div>
        </div>
        {/* Review 2 */}
        <div className="p-6 bg-[#2A2B2A] rounded-2xl border border-stone-800 text-white">
          <div className="flex gap-1 text-[#FF4A1C] mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-current" />
            ))}
          </div>
          <p className="text-stone-200 font-medium mb-6 leading-relaxed">"Honestly, I was skeptical at first. But after the first week, I realized this tool pays for itself ten times over."</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full"></div>
            <div>
              <p className="text-sm font-semibold text-white">David Chen</p>
              <p className="text-xs text-stone-400">Founder, StartScale</p>
            </div>
          </div>
        </div>
        {/* Review 3 */}
        <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 md:hidden lg:block">
          <div className="flex gap-1 text-[#FF4A1C] mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-current" />
            ))}
          </div>
          <p className="text-[#2A2B2A] font-medium mb-6 leading-relaxed">"Simplicity is the ultimate sophistication. Sereniti nails the balance between power and ease of use."</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-200 rounded-full"></div>
            <div>
              <p className="text-sm font-semibold text-[#2A2B2A]">Elena Rodriguez</p>
              <p className="text-xs text-stone-500">Product Lead</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;



