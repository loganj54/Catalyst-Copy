import React from 'react';

export const Badge = ({ children, variant = 'neutral', className = '' }) => {
    const variants = {
        neutral: 'bg-gray-100 text-gray-600',
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
        brand: 'bg-gradient-to-r from-pink-500/10 to-violet-500/10 text-violet-700',
    };

    return (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-black/5 ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};
