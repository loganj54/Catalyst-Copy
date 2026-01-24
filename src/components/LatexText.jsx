import React, { useState, useRef, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';


/**
 * InteractiveTerm Component
 * Handles the state and UI for a single clickable term with a popover menu.
 */
const InteractiveTerm = ({ content }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleAction = (action, term) => {
        // Placeholder for future logic
        console.log(`Action: ${action} on term: ${term}`);
        setIsOpen(false);
    };

    return (
        <span className="relative inline-block" ref={popoverRef}>
            {/* The Trigger Term */}
            <span
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`cursor-pointer rounded-lg px-2 -mx-2 py-1 transition-all duration-200 active:scale-95 inline-block
                    ${isOpen ? 'bg-[#FF4A1C]/25 text-stone-900 dark:text-white' : 'hover:bg-[#FF4A1C]/25 hover:text-stone-900 dark:hover:text-white'}
                `}
            >
                {/* Recursive render to handle math inside the clickable term */}
                <LatexText text={content} />
            </span>

            {/* The Icon Menu Popover */}
            {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-48 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 p-2 animate-in fade-in zoom-in-95 duration-200 origin-bottom">
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => handleAction('explain', content)}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                        >
                            📝 Explain this
                        </button>
                        <button
                            onClick={() => handleAction('video', content)}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                        >
                            📺 Watch a video
                        </button>
                        <button
                            onClick={() => handleAction('quiz', content)}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                        >
                            🙋 Ask a question?
                        </button>
                    </div>
                    {/* Arrow Pointer */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-white dark:border-t-stone-800 drop-shadow-sm"></div>
                </div>
            )}
        </span>
    );
};

/**
 * LatexText Component
 * 
 * Renders mixed text and LaTeX. 
 * - Text wrapped in $...$ will be rendered using KaTeX (Static).
 * - Text wrapped in [[...]] will be rendered as a clickable term (Interactive).
 * - [[...]] can contain nested LaTeX equations.
 */
function LatexText({ text }) {
    if (!text) return null;

    // Split by [[...]] (clickable terms) OR $...$ (inline math)
    // Priority: Check for [[...]] first to capture wrapped math like [[$E=mc^2$]]
    const parts = text.split(/(\[\[.*?\]\]|\$[^$]+\$)/g);

    return (
        <span>
            {parts.map((part, i) => {
                // Handling Clickable Terms: [[...]]
                if (part.startsWith('[[') && part.endsWith(']]')) {
                    const content = part.slice(2, -2);
                    return <InteractiveTerm key={i} content={content} />;
                }

                // Handling Static Math: $...$
                if (part.startsWith('$') && part.endsWith('$')) {
                    const content = part.slice(1, -1);
                    return (
                        <span key={i} className="inline-block mx-0.5">
                            <InlineMath math={content} />
                        </span>
                    );
                }

                // Handling Regular Text
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
}

export default LatexText;
