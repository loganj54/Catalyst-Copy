import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-500">
            <div className="p-4 bg-stone-100 dark:bg-stone-800 rounded-full mb-4">
                <SettingsIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-200">Settings</h2>
            <p className="mt-2 text-sm">Account settings and preferences coming soon.</p>
        </div>
    );
};

export default Settings;
