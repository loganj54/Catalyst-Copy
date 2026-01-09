import React, { useState, useRef, useEffect } from 'react';
import { Layers, ArrowRight, LogOut, ChevronDown, Plus, Sun, Moon } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUiState } from '../context/UiStateContext';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { chatState } = useUiState();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Calculate sidebar offset based on current route to ensure visual centering relative to content
  const sidebarOffset = (() => {
    if (['/', '/auth', '/create'].includes(location.pathname)) return 0;
    if (location.pathname.startsWith('/blueprint/')) return 152; // 304px total sidebar (80px + 224px)
    if (location.pathname.startsWith('/class/')) return 152; // Class details likely follows blueprint layout or has similar sidebar
    return 128; // Default Dashboard sidebar width (256px)
  })();

  // Chat offset for centering/positioning
  const chatOffset = chatState.isOpen ? 225 : 0; // Half of 450px
  const rightMargin = chatState.isOpen ? 450 : 0;

  return (
    <nav className="lg:px-12 flex fixed z-50 bg-white/90 dark:bg-stone-900/90 w-full border-stone-200 dark:border-stone-800 border-b py-6 top-0 backdrop-blur-sm items-center transition-all duration-300">
      <div className="flex items-center flex-1">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/catalyst-logo-2.png"
            alt="Catalyst"
            className="h-8 w-auto object-contain mix-blend-multiply dark:mix-blend-lighten dark:invert dark:contrast-200"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <span className="text-xl font-bold text-black dark:text-white tracking-widest uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>Catalyst</span>
          {/* Fallback if image fails to load */}
          <div className="hidden flex gap-3 items-center">
            <div className="flex text-[#FF4A1C] bg-[#FF4A1C]/10 w-10 h-10 rounded-full items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold text-black dark:text-white tracking-tight">Catalyst Engineering Ed</span>
          </div>
        </Link>
      </div>

      <div
        className="hidden lg:flex items-center justify-center gap-12 text-sm font-medium text-black/60 dark:text-white/60 absolute -translate-x-1/2 transition-all duration-300"
        style={{ left: `calc(50% + ${sidebarOffset}px - ${chatOffset}px)` }}
      >
        <Link to="/create" className="hover:text-black dark:hover:text-white transition-colors">
          Create
        </Link>
        <Link to="/classes" className="hover:text-black dark:hover:text-white transition-colors">Classes</Link>
        <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Projects</a>
        <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Career</a>
        <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Misc</a>
      </div>

      <div
        className="flex items-center justify-end gap-4 flex-1 transition-all duration-300 ease-in-out"
        style={{ marginRight: `${rightMargin}px` }}
      >
        {user ? (
          <>
            <button
              onClick={toggleTheme}
              className="p-2 mr-2 rounded-lg text-black/60 dark:text-white/60 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-black dark:hover:text-white transition-colors"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
            <Link to="/classes" className="text-sm font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors pr-6">
              Dashboard
            </Link>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-sm font-medium text-black dark:text-white hover:text-black dark:hover:text-white transition-colors focus:outline-none"
              >
                <span className="pr-4 max-w-[150px] truncate hidden sm:block hidden lg:flex items-center justify-center gap-12 text-sm font-medium text-black/60 dark:text-white/60 flex-1">{user.email?.split('@')[0]}</span>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-stone-900 rounded-lg shadow-lg border border-stone-100 dark:border-stone-800 py-1 animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-[#FF4A1C] dark:hover:text-[#FF4A1C] flex items-center gap-2 transition-colors"
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
            <Link to="/auth" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-all text-black dark:text-white">
              Log in
            </Link>
            <Link to="/auth" className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-900 text-black dark:text-white border border-stone-300 dark:border-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-all shadow-sm">
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
