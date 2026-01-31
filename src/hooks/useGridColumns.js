import { useState, useEffect } from 'react';

/**
 * Hook to return the current number of grid columns based on window width
 * and the provided breakpoint configuration.
 * 
 * @param {Object} config Map of breakpoint names to column counts
 * Example: { base: 1, sm: 2, lg: 3 }
 * @returns {number} Current number of columns
 */
export function useGridColumns(config) {
    // Parsing config with defaults matching Tailwind
    // sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px

    const getColumns = () => {
        if (typeof window === 'undefined') return config.base || 1;

        const width = window.innerWidth;

        // Check from largest to smallest
        if (config['2xl'] && width >= 1536) return config['2xl'];
        if (config.xl && width >= 1280) return config.xl;
        if (config.lg && width >= 1024) return config.lg;
        if (config.md && width >= 768) return config.md;
        if (config.sm && width >= 640) return config.sm;

        return config.base || 1;
    };

    const [columns, setColumns] = useState(getColumns);

    useEffect(() => {
        const handleResize = () => {
            setColumns(getColumns());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []); // We assume config doesn't change deeply

    return columns;
}
