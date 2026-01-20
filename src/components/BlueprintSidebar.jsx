import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronDown,
    BookOpen,
    Target,
    CheckCircle,
    Menu,
    X
} from 'lucide-react';

const BlueprintSidebar = ({
    structure,
    activeSectionId,
    onSelectSection,
    open,
    onToggle
}) => {

    const sections = [];
    const structData = structure?.structure_data || structure?.structure || structure;

    if (structData?.prerequisites_section) {
        sections.push({
            id: 'prerequisites',
            title: 'Prerequisites',
            type: 'learn',
            data: structData.prerequisites_section
        });
    }

    if (structData?.content_sections) {
        structData.content_sections.forEach((s, i) => {
            sections.push({
                id: s.section_id || `section-${i}`,
                title: s.title || `Section ${i + 1}`,
                type: 'solve',
                data: s
            });
        });
    }

    return (
        <>
            {/* Mobile Toggle Shadow */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden glass-blur"
                    onClick={onToggle}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
        fixed top-20 lg:left-0 left-0 bottom-0 z-40
        w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
                {/* Header */}
                <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <h3 className="font-bold text-stone-800 dark:text-stone-200 uppercase tracking-widest text-xs">
                        Course Map
                    </h3>
                    <button onClick={onToggle} className="lg:hidden text-stone-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sections.map((section) => {
                        const isActive = activeSectionId === section.id;

                        return (
                            <button
                                key={section.id}
                                onClick={() => onSelectSection(section.data)}
                                className={`
                              w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all
                              ${isActive
                                        ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold shadow-sm border border-stone-300 dark:border-stone-600'
                                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 border border-transparent'
                                    }
                          `}
                            >
                                <div className={`mt-0.5 shrink-0 ${isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}>
                                    {section.type === 'learn' ? <BookOpen className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm leading-tight">
                                        {section.title}
                                    </p>
                                </div>

                                {isActive && <ChevronRight className="w-4 h-4 shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Status */}
                <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50">
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>0% Completed</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BlueprintSidebar;
