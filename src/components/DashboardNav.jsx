import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Briefcase, Trophy, GraduationCap } from 'lucide-react';

const DashboardNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { label: 'Classwork', path: '/classes', icon: BookOpen },
    { label: 'Projects', path: '/projects', icon: Briefcase },
    { label: 'Career', path: '/career', icon: Trophy },
    { label: 'Skills', path: '/skills', icon: GraduationCap },
  ];

  return (
    <div className="flex justify-center mb-12">
      <div className="flex items-center gap-2 p-1.5 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white dark:bg-stone-700 text-[#2A2B2A] dark:text-white shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700/50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-[#FF4A1C]' : ''}`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardNav;

