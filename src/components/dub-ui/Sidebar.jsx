import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    BookOpen,
    Briefcase,
    Award,
    Zap,
    LogOut,
    Settings,
    LayoutDashboard,
    Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from './Badge';

export const Sidebar = ({ className = '' }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    const isActive = (path) => location.pathname === path;

    const NavItem = ({ icon: Icon, label, path, badge }) => (
        <button
            onClick={() => navigate(path)}
            className={`
        w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors
        ${isActive(path)
                    ? 'bg-gray-100 text-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
      `}
        >
            <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                {label}
            </div>
            {badge && <Badge variant="blue">{badge}</Badge>}
        </button>
    );

    return (
        <div className={`w-[250px] flex-shrink-0 flex flex-col h-full border-r border-gray-200 bg-stone-50 ${className}`}>
            {/* Header / Context Switcher */}
            <div className="p-4 pl-2">
                <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white font-bold text-xs ring-2 ring-gray-100">
                        D
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 leading-none">Dashboard</span>
                        <span className="text-xs text-gray-500 mt-1">Catalyst Ed</span>
                    </div>
                </div>
            </div>

            {/* Navigation Groups */}
            <div className="flex-1 overflow-y-auto py-2 px-3 space-y-6">

                {/* Main Group */}
                <div className="space-y-0.5">
                    <NavItem icon={LayoutDashboard} label="Overview" path="/classes" />
                    <NavItem icon={BookOpen} label="Classes" path="/classes" />
                    <NavItem icon={Zap} label="Projects" path="/projects" />
                </div>

                {/* Growth Group */}
                <div>
                    <div className="px-2 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Growth</div>
                    <div className="space-y-0.5">
                        <NavItem icon={Briefcase} label="Career" path="/career" />
                        <NavItem icon={Award} label="Skills" path="/skills" />
                    </div>
                </div>

                {/* Configuration Group */}
                <div>
                    <div className="px-2 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Settings</div>
                    <div className="space-y-0.5">
                        <NavItem icon={Settings} label="Account" path="/settings" />
                    </div>
                </div>
            </div>

            {/* User Footer */}
            <div className="p-3 border-t border-gray-200">
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-50 transition-colors text-left group"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                        {user?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                        <p className="text-xs text-gray-500 truncate group-hover:text-red-500 transition-colors">Sign out</p>
                    </div>
                    <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                </button>
            </div>
        </div>
    );
};
