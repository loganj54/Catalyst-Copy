import React from 'react';
import { useTheme } from '../context/ThemeContext';

const Background = () => {
  const { bgPattern, theme } = useTheme();

  // We are creating a fixed background layer that sits behind everything (z-0 or z-[-1])
  // The layout has z-10 or similar for content.
  // The original implementation used absolute positioning within the page container.
  // Here we use fixed positioning to cover the entire viewport.

  if (bgPattern === 'white' || bgPattern === 'none') {
    return (
      <div className="fixed inset-0 pointer-events-none -z-50 bg-stone-100 dark:bg-stone-900 transition-colors duration-300" />
    );
  }

  if (bgPattern === 'dots') {
    // The dots pattern from src/index.css (moved here or kept in CSS)
    // We can use the CSS class on a div
    return (
      <div className="fixed inset-0 pointer-events-none -z-50 bg-stone-100 dark:bg-stone-900 transition-colors duration-300">
        <div className="absolute inset-0 bg-pattern-dots opacity-100" />
      </div>
    );
  }

  if (bgPattern === 'grid') {
    // The specific grid + mask implementation
    return (
      <div className="fixed inset-0 pointer-events-none -z-50 bg-stone-100 dark:bg-stone-900 transition-colors duration-300">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808025_1px,transparent_1px),linear-gradient(to_bottom,#80808025_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff25_1px,transparent_1px),linear-gradient(to_bottom,#ffffff25_1px,transparent_1px)]"></div>
        {/* The mask that fades the grid out at top/bottom - Updated to match stone-100 background */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-100 via-transparent to-stone-100 dark:from-stone-900 dark:via-transparent dark:to-stone-900"></div>
      </div>
    );
  }

  return null;
};

export default Background;

