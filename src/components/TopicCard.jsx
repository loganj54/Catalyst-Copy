import React from 'react';
import { Check, Sparkles, BookOpen, Calculator, ArrowRight, Play } from 'lucide-react';

const TopicCard = ({ unit, status, onClick }) => {
    // Determine icon and color based on unit type and title
    const getUnitStyle = () => {
        // DEBUG: Check if concept_summary is present
        // console.log(`[TopicCard] Unit: ${unit.topic}`, { concept_summary: unit.concept_summary, description: unit.description, unit });

        const isWalkthrough = unit.unit_type === 'walkthrough' ||
            unit.unit_type === 'problem' ||
            unit.topic?.includes('Walkthrough');

        if (isWalkthrough) {
            return {
                icon: Calculator,
                colors: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
                badge: 'Practice',
                hoverBorder: 'hover:border-red-300 dark:hover:border-red-600',
                hoverIconBg: 'group-hover:bg-red-500'
            };
        } else if (unit.unit_type === 'prerequisite') {
            return {
                icon: ArrowRight, // Or a different icon for prereqs
                colors: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-700',
                badge: 'Prerequisite',
                hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-500',
                hoverIconBg: 'group-hover:bg-purple-500'
            }
        } else if (unit.unit_type === 'solution') {
            return {
                icon: Check, // Checkmark for solution
                colors: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700',
                badge: 'Solution',
                hoverBorder: 'hover:border-green-300 dark:hover:border-green-500',
                hoverIconBg: 'group-hover:bg-green-500'
            };
        } else {
            return {
                icon: BookOpen,
                colors: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700',
                badge: 'Learn',
                hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-500',
                hoverIconBg: 'group-hover:bg-blue-500'
            };
        }
    };

    const style = getUnitStyle();
    const Icon = style.icon;
    const isCompleted = status === 'comfortable';

    return (
        <div
            onClick={onClick}
            className={`
        group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer h-full flex flex-col hover:-translate-y-1
        bg-white dark:bg-stone-800 hover:shadow-xl
        border-stone-300 dark:border-stone-600 ${style.hoverBorder}
      `}
        >
            {/* Top Row: Badge & Status */}
            <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${style.colors}`}>
                    {style.badge}
                </span>
                {isCompleted && (
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                        <Check className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1">
                <h3 className="text-2xl font-normal tracking-tight text-stone-900 dark:text-stone-100 mb-2 leading-tight transition-colors">
                    {unit.topic === 'Similar Worked Example Walkthrough' ? 'Similar Examples' : unit.topic}
                </h3>

                {/* Horizontal Separator */}
                <div className="h-px bg-stone-300 dark:bg-stone-600 my-3" />

                <p className="text-stone-600 dark:text-stone-300 text-base line-clamp-3 leading-relaxed">
                    {unit.concept_summary || unit.description || unit.tutor_guidance}
                </p>
            </div>

            {/* Footer / CTA */}
            <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-600 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors">
                    View Topic
                </span>
                <div className={`w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-700 flex items-center justify-center ${style.hoverIconBg} transition-colors`}>
                    <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-white transition-colors" />
                </div>
            </div>
        </div>
    );
};

export default TopicCard;
