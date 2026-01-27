import React from 'react';

export const Input = ({
    label,
    error,
    icon: Icon,
    className = '',
    containerClassName = '',
    ...props
}) => {
    return (
        <div className={`space-y-1.5 ${containerClassName}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    className={`
            w-full h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-900
            disabled:cursor-not-allowed disabled:opacity-50
            transition-all duration-200
            ${Icon ? 'pl-9' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}
            ${className}
          `}
                    {...props}
                />
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <Icon className="w-4 h-4" />
                    </div>
                )}
            </div>
            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}
        </div>
    );
};
