import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  Trophy,
  GraduationCap,
  Settings,
  HelpCircle
} from 'lucide-react';

const Sidebar = ({ collapsed = false }) => {
  const location = useLocation();

  const menuItems = [
    { icon: BookOpen, label: 'My Classwork', path: '/classes' },
    { icon: Briefcase, label: 'My Projects', path: '/projects' },
    { icon: Trophy, label: 'My Career', path: '/career' },
    { icon: GraduationCap, label: 'My Skills', path: '/skills' },
  ];

  const bottomItems = [
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help & Support', path: '/help' },
  ];

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;

    return (
      <Link
        to={item.path}
        title={collapsed ? item.label : ''}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-normal transition-all border ${isActive
          ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-600 shadow-sm'
          : 'text-stone-500 dark:text-stone-400 border-transparent hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
          } ${collapsed ? 'justify-center px-2' : ''}`}
      >
        <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-500 group-hover:text-stone-900 dark:group-hover:text-stone-100'
          }`} />

        {!collapsed && (
          <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div
      className={`h-[calc(100vh-80px)] bg-stone-50 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-700 flex flex-col pt-6 pb-6 transition-all duration-300 ${collapsed ? 'w-20' : 'w-56'
        }`}
    >
      {/* Main Navigation */}
      <div className="flex-1 px-3 space-y-2">


        {menuItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>

      {/* Bottom Navigation */}
      <div className="px-3 space-y-2 pt-4 border-t border-stone-200 dark:border-stone-700">
        {bottomItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
