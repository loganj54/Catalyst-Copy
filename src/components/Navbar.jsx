import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="lg:px-12 flex sticky z-50 bg-white/80 w-full border-stone-100 border-b pt-6 pr-6 pb-6 pl-6 top-0 backdrop-blur-sm items-center justify-between">
      <Link to="/" className="flex gap-3 items-center">
        <div className="flex text-[#FF4A1C] bg-[#FF4A1C]/10 w-10 h-10 rounded-full items-center justify-center">
          <Layers className="w-5 h-5" />
        </div>
        <span className="text-xl font-semibold text-[#2A2B2A] tracking-tight">Catalyst Engineering Ed</span>
      </Link>
      <div className="hidden lg:flex items-center gap-10 text-sm font-medium text-stone-500">
        <Link to="/classes" className="hover:text-[#2A2B2A] transition-colors">Classes</Link>
        <a href="#" className="hover:text-[#2A2B2A] transition-colors">Projects </a>
        <a href="#" className="hover:text-[#2A2B2A] transition-colors">Career</a>
        <a href="#" className="hover:text-[#2A2B2A] transition-colors">Misc</a>
      </div>
      <div className="flex items-center gap-4">
        <a href="#" className="hidden sm:flex items-center gap-2 px-5 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium hover:bg-stone-50 hover:border-stone-300 transition-all text-[#2A2B2A]">
          Log in
        </a>
        <a href="#" className="flex items-center gap-2 px-5 py-2 bg-[#2A2B2A] text-white rounded-full text-sm font-medium hover:bg-[#FF4A1C] transition-all shadow-lg shadow-stone-200/50">
          Get Started
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </nav>
  );
};

export default Navbar;
