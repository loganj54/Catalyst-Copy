import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    BookOpen,
    Briefcase,
    Award,
    Zap,
    LogOut,
    Settings,
    LayoutDashboard,
    Plus,
    Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Badge } from './Badge';

export const Sidebar = ({ className = '', activeClassId = null }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchClasses();
        }
    }, [user]);

    const fetchClasses = async () => {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select('id, name')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClasses(data || []);
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const isActive = (path) => {
        if (activeClassId && path === `/class/${activeClassId}`) return true;
        return location.pathname === path;
    };

    const NavItem = ({ icon: Icon, label, path, badge }) => (
        <button
            onClick={() => navigate(path)}
            className={`
        w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors
        ${isActive(path)
                    ? 'bg-stone-100 text-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
      `}
        >
            <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                <span className="truncate">{label}</span>
            </div>
            {badge && <Badge variant="blue">{badge}</Badge>}
        </button>
    );

    return (
        <div className={`w-[250px] flex-shrink-0 flex flex-col h-full border-r border-gray-200 bg-stone-50 ${className}`}>
            {/* Header */}
            <div className="p-6">
                <h2 className="text-xl font-normal text-black tracking-tight leading-tight">Classes Dashboard</h2>
            </div>

            {/* Navigation Groups */}
            <div className="flex-1 overflow-y-auto pt-5 pb-6 px-3 space-y-6">

                {/* Dashboard Link */}
                <div className="space-y-0.5">
                    <NavItem icon={LayoutDashboard} label="Dashboard" path="/classes" />
                </div>

                {/* Classes Section */}
                <div>
                    <div className="px-2 mb-2">
                        <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider">Classes</h3>
                    </div>
                    <div className="space-y-0.5">
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                            </div>
                        ) : classes.length > 0 ? (
                            classes.map((cls) => (
                                <NavItem
                                    key={cls.id}
                                    icon={BookOpen}
                                    label={cls.name}
                                    path={`/class/${cls.id}`}
                                />
                            ))
                        ) : (
                            <div className="px-2 py-2 text-sm text-stone-400 italic">
                                No classes found
                            </div>
                        )}

                        {/* New Class Button */}
                        <button
                            onClick={() => navigate('/create')}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium text-stone-500 hover:bg-gray-50 hover:text-stone-900 transition-colors mt-1"
                        >
                            <Plus className="w-4 h-4 text-stone-400" />
                            <span>Add Class</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
