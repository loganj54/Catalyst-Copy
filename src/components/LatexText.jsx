import React, { useState, useRef, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';


import { useUiState } from '../context/UiStateContext';

/**
 * InteractiveTerm Component
 * Handles the state and UI for a single clickable term with a popover menu.
 */
const InteractiveTerm = ({ content, index, unitId, context, blueprintId }) => {
    // DEBUG LOG
    // console.log(`[InteractiveTerm] Rendered: ${content}, context:`, context);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const clickCoords = useRef({ x: 0, y: 0, rect: null });
    const { addExplainer } = useUiState();

    // Create a stable, deterministic ID for this term
    // This survives re-renders and re-mounts as long as the text structure is stable
    const safeContent = content.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const domId = `term-${safeContent}-${index}`;

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
        // Map UI actions to internal types
        // 'explain' -> 'explain'
        // 'video' -> 'video'
        // 'quiz' -> 'question' (User asked for "Ask a question" module)
        let explainerType = 'explain';
        if (action === 'video') explainerType = 'video';
        if (action === 'quiz') explainerType = 'question';

        // Use the captured click coordinates/rect from when the user clicked the word
        const { rect } = clickCoords.current;

        // Fallback to current ref if stored rect is missing
        const activeRect = rect || popoverRef.current?.getBoundingClientRect();

        console.log('[InteractiveTerm] addExplainer called with context:', context);

        addExplainer({
            type: explainerType, // Pass the TYPE
            term: term,
            context: context, // Pass the CONTEXT (e.g. Solution Walkthrough Title)
            anchorId: domId, // PASS THE STABLE DOM ID
            unitId: unitId, // Pass the Unit ID
            blueprintId: blueprintId, // Pass the Blueprint ID
            // Pass explicit start coordinates (snapshot)
            startPosition: {
                x: activeRect ? activeRect.left + (activeRect.width / 2) : 0, // Bottom Center X
                y: activeRect ? activeRect.bottom : 0 // Bottom Center Y
            },
            anchorRect: activeRect ? {
                top: activeRect.top,
                left: activeRect.left,
                right: activeRect.right,
                bottom: activeRect.bottom,
                width: activeRect.width,
                height: activeRect.height,
                // Store Document Coordinates for Robust Fallback
                docTop: activeRect.top + window.scrollY,
                docLeft: activeRect.left + window.scrollX
            } : null,
            anchorElement: null, // DEPRECATED: We use ID now
            id: Date.now()
        });

        setIsOpen(false);
    };

    return (
        <span className="relative inline-block" ref={popoverRef} id={domId}>
            {/* The Trigger Term */}
            <span
                onClick={(e) => {
                    e.stopPropagation();
                    // Capture coordinates immediately upon user interaction
                    clickCoords.current = {
                        x: e.clientX,
                        y: e.clientY,
                        rect: e.currentTarget.getBoundingClientRect()
                    };
                    setIsOpen(!isOpen);
                }}
                className={`cursor-pointer rounded-lg px-2 -mx-2 py-1 transition-all duration-200 active:scale-95 inline-block
                    ${isOpen ? 'bg-[#FF4A1C]/25 text-stone-900 dark:text-white' : 'hover:bg-[#FF4A1C]/25 hover:text-stone-900 dark:hover:text-white'}
                `}
            >
                {/* Recursive render to handle math inside the clickable term */}
                <LatexText text={content} unitId={unitId} context={context} blueprintId={blueprintId} />
            </span>

            {/* The Icon Menu Popover */}
            {
                isOpen && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-48 bg-stone-50 dark:bg-stone-900 rounded-xl shadow-xl border border-stone-300 dark:border-stone-500 p-2 animate-in fade-in zoom-in-95 duration-200 origin-bottom">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleAction('explain', content)}
                                className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                            >
                                📝 Explain this
                            </button>
                            <button
                                onClick={() => handleAction('video', content)}
                                className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                            >
                                📺 Watch a video
                            </button>
                            <button
                                onClick={() => handleAction('quiz', content)}
                                className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                            >
                                🙋 Ask a question?
                            </button>
                        </div>
                        {/* Arrow Pointer */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-stone-50 dark:border-t-stone-900 drop-shadow-sm"></div>
                    </div>
                )
            }
        </span >
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
function LatexText({ text, unitId, context, blueprintId }) {
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
                    return <InteractiveTerm key={i} content={content} index={i} unitId={unitId} context={context} blueprintId={blueprintId} />;
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
