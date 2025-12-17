import React, { useState, useRef, useEffect } from 'react';
import { Layers, ArrowRight, LogOut, ChevronDown, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="lg:px-12 flex sticky z-50 bg-white/90 w-full border-stone-200 border-b pt-6 pr-6 pb-6 pl-6 top-0 backdrop-blur-sm items-center">
      <Link to="/" className="flex items-center gap-2 flex-1">
        <img 
          src="/catalyst-logo-2.png" 
          alt="Catalyst" 
          className="h-8 w-auto object-contain"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <span className="text-xl font-bold text-black tracking-widest uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>Catalyst</span>
        {/* Fallback if image fails to load */}
        <div className="hidden flex gap-3 items-center">
           <div className="flex text-[#FF4A1C] bg-[#FF4A1C]/10 w-10 h-10 rounded-full items-center justify-center">
             <Layers className="w-5 h-5" />
           </div>
           <span className="text-xl font-semibold text-black tracking-tight">Catalyst Engineering Ed</span>
        </div>
      </Link>
      
      <div className="hidden lg:flex items-center justify-center gap-12 text-sm font-medium text-black/60 flex-1">
        <Link to="/create" className="hover:text-black transition-colors">
          Create
        </Link>
        <Link to="/classes" className="hover:text-black transition-colors">Classes</Link>
        <a href="#" className="hover:text-black transition-colors">Projects</a>
        <a href="#" className="hover:text-black transition-colors">Career</a>
        <a href="#" className="hover:text-black transition-colors">Misc</a>
      </div>

      <div className="flex items-center justify-end gap-4 flex-1">
        {user ? (
          <>
            <Link to="/dashboard" className="text-sm font-medium text-black/60 hover:text-black transition-colors pr-6">
              Dashboard
            </Link>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-sm font-medium text-black hover:text-black transition-colors focus:outline-none"
              >
                <span className="pr-4 max-w-[150px] truncate hidden sm:block">{user.email?.split('@')[0]}</span>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-stone-100 py-1 animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-stone-600 hover:bg-stone-50 hover:text-[#FF4A1C] flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/auth" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 hover:border-stone-400 transition-all text-black">
              Log in
            </Link>
            <Link to="/auth" className="flex items-center gap-2 px-4 py-2 bg-white text-black border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 transition-all shadow-sm">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
