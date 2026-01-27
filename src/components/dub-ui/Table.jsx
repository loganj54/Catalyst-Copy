import React from 'react';

export const Table = ({ children }) => (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm text-left">
            {children}
        </table>
    </div>
);

export const Thead = ({ children }) => (
    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-medium">
        {children}
    </thead>
);

export const Th = ({ children, className = '' }) => (
    <th className={`px-6 py-3 font-medium whitespace-nowrap ${className}`}>
        {children}
    </th>
);

export const Tr = ({ children, className = '', ...props }) => (
    <tr className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors ${className}`} {...props}>
        {children}
    </tr>
);

export const Td = ({ children, className = '' }) => (
    <td className={`px-6 py-3 text-gray-700 ${className}`}>
        {children}
    </td>
);
