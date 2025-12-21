import React from 'react';
import { Twitter, Youtube, Linkedin, Layers } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="pt-20 pb-12 px-6 lg:px-12 border-t border-stone-200 bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-12 lg:gap-8 mb-20">
        
        {/* Logo & Description Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <img 
              src="/catalyst-logo-2.png" 
              alt="Catalyst" 
              className="h-8 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            {/* Fallback */}
            <div className="hidden flex items-center gap-2">
               <div className="flex text-[#FF4A1C] bg-[#FF4A1C]/10 w-8 h-8 rounded-full items-center justify-center">
                 <Layers className="w-4 h-4" />
               </div>
               <span className="text-lg font-bold text-black tracking-widest uppercase">CATALYST</span>
            </div>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed max-w-sm">
            AI learning path builder that creates structured engineering roadmaps in seconds. 
            No confusion needed. Export to PDF & Notion. 
            Trusted by engineering students worldwide.
          </p>
        </div>

        {/* Links Section */}
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          
          {/* Column 1 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              <li><a href="#" className="hover:text-black transition-colors">Create</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Templates</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Components</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Assets</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Changelog</a></li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              <li><a href="#" className="hover:text-black transition-colors">Introduction</a></li>
              <li><a href="#" className="hover:text-black transition-colors">How to Prompt</a></li>
              <li><a href="#" className="hover:text-black transition-colors">How to Edit</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Sell Templates</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Affiliates</a></li>
              <li><a href="#" className="hover:text-black transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">What we use</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              <li><a href="#" className="hover:text-black transition-colors">Mobbin</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Screen Studio</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Courses</a></li>
              <li><a href="#" className="hover:text-black transition-colors">UI Kit</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Video Editor</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Mockups</a></li>
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Connect</h4>
            <ul className="space-y-3 text-sm text-stone-500">
              <li><a href="#" className="hover:text-black transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Support</a></li>
              <li><a href="#" className="hover:text-black transition-colors">Report Issue</a></li>
              <li><a href="#" className="hover:text-black transition-colors">LinkedIn</a></li>
              <li><a href="#" className="hover:text-black transition-colors">X</a></li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
          <p className="text-xs text-stone-500">© 2025 Catalyst Engineering. All rights reserved.</p>
          <a href="#" className="text-xs text-stone-500 underline hover:text-black">Made with Cursor.</a>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-3">
            <a href="#" className="p-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-500 hover:text-black transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="#" className="p-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-500 hover:text-black transition-colors">
              <Youtube className="w-4 h-4" />
            </a>
            <a href="#" className="p-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-500 hover:text-black transition-colors">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
