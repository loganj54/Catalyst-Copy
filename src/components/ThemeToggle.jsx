import React from 'react';
import { Sun, Moon, Grid, Layout, Circle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme, bgPattern, setBgPattern } = useTheme();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 p-1.5 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-lg transition-colors duration-300">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5" />
        )}
      </button>

      <div className="w-px h-6 bg-stone-200 dark:bg-stone-800 mx-1" />

      <button
        onClick={() => setBgPattern('grid')}
        className={`p-2 rounded-lg transition-colors ${bgPattern === 'grid' ? 'bg-stone-100 dark:bg-stone-800 text-[#FF4A1C]' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}
        title="Grid Background"
      >
        <Grid className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => setBgPattern('white')}
        className={`p-2 rounded-lg transition-colors ${bgPattern === 'white' ? 'bg-stone-100 dark:bg-stone-800 text-[#FF4A1C]' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}
        title="Plain Background"
      >
        <Layout className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => setBgPattern('dots')}
        className={`p-2 rounded-lg transition-colors ${bgPattern === 'dots' ? 'bg-stone-100 dark:bg-stone-800 text-[#FF4A1C]' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}
        title="Dot Pattern"
      >
        <Circle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ThemeToggle;
