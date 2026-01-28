import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    BookOpen,
    Plus,
    Grid,
    Circle,
    Layout,
    Sun,
    Moon,
    User,
    Settings
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const SidebarNavigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme, bgPattern, setBgPattern } = useTheme();
    const { user } = useAuth();

    const isActive = (path) => {
        if (path === '/classes' && (location.pathname.startsWith('/class') || location.pathname === '/classes')) return true;
        return location.pathname === path;
    };

    return (
        <div className="w-[68px] flex flex-col items-center py-6 bg-stone-100 dark:bg-stone-900 h-screen fixed left-0 top-0 z-50">

            {/* Top Section */}
            <div className="flex flex-col items-center gap-6">
                {/* Home / Logo */}
                <button
                    onClick={() => navigate('/')}
                    className="w-12 h-12 flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                    <img
                        src={theme === 'dark' ? '/logo-new-dark.png' : '/logo-new-light.png'}
                        alt="Home"
                        className="w-10 h-10 object-contain"
                    />
                </button>

                {/* Classes (Dashboard) */}
                <button
                    onClick={() => navigate('/classes')}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${isActive('/classes')
                        ? 'bg-white text-black dark:bg-stone-800 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-stone-700'
                        : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800'
                        }`}
                    title="Classes"
                >
                    <BookOpen strokeWidth={2.5} className="w-6 h-6" />
                </button>

                {/* Create */}
                <button
                    onClick={() => navigate('/create')}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${isActive('/create')
                        ? 'bg-white text-black dark:bg-stone-800 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-stone-700'
                        : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800'
                        }`}
                    title="Create New"
                >
                    <Plus strokeWidth={2.5} className="w-6 h-6" />
                </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Middle Section - View Toggles */}
            <div className="flex flex-col items-center gap-2 mb-6">
                <button
                    onClick={() => setBgPattern('grid')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${bgPattern === 'grid'
                        ? 'bg-stone-200 dark:bg-stone-800 text-[#FF4A1C]'
                        : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
                        }`}
                    title="Grid View"
                >
                    <Grid className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setBgPattern('dots')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${bgPattern === 'dots'
                        ? 'bg-stone-200 dark:bg-stone-800 text-[#FF4A1C]'
                        : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
                        }`}
                    title="Dot View"
                >
                    <Circle className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setBgPattern('white')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${bgPattern === 'white' || bgPattern === 'none'
                        ? 'bg-stone-200 dark:bg-stone-800 text-[#FF4A1C]'
                        : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
                        }`}
                    title="Flat View"
                >
                    <Layout className="w-5 h-5" />
                </button>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col items-center gap-4 mb-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
                    title="Toggle Theme"
                >
                    {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                </button>

                {/* Profile */}
                <button
                    className="w-12 h-12 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700 hover:ring-2 hover:ring-stone-200 dark:hover:ring-stone-700 transition-all"
                    onClick={() => navigate('/settings')}
                    title="Account"
                >
                    {user?.email ? (
                        <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm">
                            {user.email[0].toUpperCase()}
                        </div>
                    ) : (
                        <div className="w-full h-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
                            <User className="w-6 h-6 text-stone-500" />
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SidebarNavigation;
