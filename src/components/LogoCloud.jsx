import React from 'react';

const LogoCloud = () => {
  return (
    <section className="border-y lg:px-12 overflow-hidden bg-stone-50/50 border-stone-100 pt-10 pr-6 pb-10 pl-6">
      <p className="uppercase text-xs font-semibold text-stone-400 tracking-widest text-center mb-8">Used by students at:</p>
      <div className="flex flex-wrap justify-center lg:justify-between items-center gap-8 lg:gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
        <svg className="w-[106px] h-[32px]" viewBox="0 0 100 30" fill="currentColor" strokeWidth="2" style={{ color: 'rgb(42, 43, 42)', width: '106px', height: '32px' }}><path d="M10,15 L20,5 L30,15 L20,25 Z M40,5 H50 V25 H40 Z M60,5 H80 V10 H65 V12 H75 V17 H65 V25 H60 Z" className=""></path></svg>
        <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><circle cx="15" cy="15" r="10"></circle> <rect x="35" y="5" width="20" height="20" className=""></rect> <circle cx="80" cy="15" r="10"></circle></svg>
        <svg className="h-7" viewBox="0 0 100 30" fill="currentColor"><path d="M10,25 L20,5 L30,25 M50,5 L50,25 M70,5 L90,5 M80,5 L80,25" stroke="currentColor" strokeWidth="3"></path></svg>
        <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><rect x="10" y="5" width="20" height="20" rx="5"></rect> <rect x="40" y="5" width="20" height="20" rx="5" className=""></rect> <rect x="70" y="5" width="20" height="20" rx="5"></rect></svg>
        <svg className="h-6" viewBox="0 0 100 30" fill="currentColor"><path d="M10,15 Q25,5 40,15 T70,15 T100,15" stroke="currentColor" strokeWidth="3" fill="none"></path></svg>
      </div>
    </section>
  );
};

export default LogoCloud;



