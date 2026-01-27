import React from 'react';

export const Card = ({ children, className = '', noPadding = false, ...props }) => {
    return (
        <div
            className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${className}`}
            {...props}
        >
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    );
};

export const CardHeader = ({ title, description, action }) => (
    <div className="flex justify-between items-start mb-4">
        <div>
            {title && <h3 className="text-base font-medium text-gray-900">{title}</h3>}
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        {action && <div>{action}</div>}
    </div>
);
