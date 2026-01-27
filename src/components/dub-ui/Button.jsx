import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
    children,
    variant = 'primary', // primary, secondary, ghost, danger
    size = 'md', // sm, md, lg
    className = '',
    isLoading = false,
    icon: Icon,
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-black text-white hover:bg-gray-800 focus:ring-gray-900 border border-transparent shadow-sm',
        secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 focus:ring-gray-200 shadow-sm',
        ghost: 'bg-transparent text-gray-600 hover:text-black hover:bg-gray-100 focus:ring-gray-200',
        danger: 'bg-white text-red-600 border border-gray-200 hover:bg-red-50 hover:border-red-200 focus:ring-red-100',
    };

    const sizes = {
        sm: 'text-xs h-8 px-3 rounded-md gap-1.5',
        md: 'text-sm h-10 px-4 rounded-md gap-2',
        lg: 'text-base h-12 px-6 rounded-lg gap-2.5',
        icon: 'h-10 w-10 p-0 rounded-md',
    };

    const variantStyles = variants[variant] || variants.primary;
    const sizeStyles = sizes[size] || sizes.md;

    return (
        <button
            className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {!isLoading && Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    );
};
