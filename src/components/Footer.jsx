import React from 'react';
import { Layers, Twitter, Github, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white pt-16 pb-8 px-6 lg:px-12 border-t border-stone-100">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-16">
        <div className="col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#FF4A1C]/10 flex items-center justify-center text-[#FF4A1C]">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#2A2B2A]">Sereniti</span>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed max-w-xs mb-6">Building the future of digital agency work. One pixel at a time.</p>
          <div className="flex gap-4">
            <a href="#" className="text-stone-400 hover:text-[#2A2B2A] transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-stone-400 hover:text-[#2A2B2A] transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className="text-stone-400 hover:text-[#2A2B2A] transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-[#2A2B2A] mb-4">Product</h4>
          <ul className="space-y-3 text-sm text-stone-500">
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Features</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Integrations</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Pricing</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-[#2A2B2A] mb-4">Resources</h4>
          <ul className="space-y-3 text-sm text-stone-500">
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Documentation</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">API Reference</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Community</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-[#2A2B2A] mb-4">Company</h4>
          <ul className="space-y-3 text-sm text-stone-500">
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">About</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Blog</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Careers</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-[#2A2B2A] mb-4">Legal</h4>
          <ul className="space-y-3 text-sm text-stone-500">
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Privacy</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Terms</a></li>
            <li><a href="#" className="hover:text-[#FF4A1C] transition-colors">Security</a></li>
          </ul>
        </div>
      </div>

      <div className="pt-8 border-t border-stone-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-stone-400">© 2024 Sereniti Inc. All rights reserved.</p>
        <div className="flex gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-xs font-medium text-stone-500">All systems operational</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;



