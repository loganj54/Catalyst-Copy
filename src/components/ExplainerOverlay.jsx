import React, { useEffect, useState, useRef } from 'react';

import { useUiState } from '../context/UiStateContext';
import { X, Sparkles } from 'lucide-react';

/**
 * ExplainerOverlay Component
 * 
 * Renders a full-screen overlay (pointer-events-none) that manages:
 * 1. Floating "Bubble" Explainer Cards on the right side.
 * 2. Animated SVG connection lines linking the source text to the bubble.
 */
const ExplainerOverlay = () => {
    const { explainer, setExplainer } = useUiState();
    const [linePath, setLinePath] = useState('');
    const [bubblePosition, setBubblePosition] = useState({ top: 0, left: 0 }); // Changed to use left positioning
    const [isVisible, setIsVisible] = useState(false);

    // Ref to the overlay container
    const containerRef = useRef(null);

    // Ref to store the initial calculated gap so it stays fixed during resize
    const fixedOffsetRef = useRef(null);

    // Config
    const BUBBLE_WIDTH = 350;
    const RIGHT_MARGIN = 40;

    useEffect(() => {
        if (!explainer.isOpen) {
            setIsVisible(false);
            setLinePath('');
            fixedOffsetRef.current = null; // Reset the fixed offset when closed
            return;
        }

        // ONE-TIME CALCULATION (plus Resize/Reflow updates)
        const updatePosition = () => {
            if (!containerRef.current) return;

            const parentElement = containerRef.current.parentElement;
            if (!parentElement) return;

            // Get Layout Rects
            const parentRect = parentElement.getBoundingClientRect();

            let startX, startY;

            // 1. Resolve Anchor Coordinates (Relative to Parent Container)
            let liveElement = null;
            if (explainer.anchorId) {
                liveElement = document.getElementById(explainer.anchorId);
            } else if (explainer.anchorElement && explainer.anchorElement.isConnected) {
                liveElement = explainer.anchorElement;
            }

            if (liveElement && liveElement.isConnected) {
                const rect = liveElement.getBoundingClientRect();

                // Live Element: Use current viewport rects
                startX = rect.left - parentRect.left + (rect.width / 2);
                startY = rect.bottom - parentRect.top - 2;
            }
            else if (explainer.anchorRect) {
                // ... same fallback logic ...
                if (explainer.anchorRect.docTop && explainer.anchorRect.docLeft) {
                    const parentDocTop = parentRect.top + window.scrollY;
                    const parentDocLeft = parentRect.left + window.scrollX;

                    startX = explainer.anchorRect.docLeft - parentDocLeft + (explainer.anchorRect.width / 2);
                    startY = explainer.anchorRect.docBottom ? (explainer.anchorRect.docBottom - parentDocTop - 2) : (explainer.anchorRect.docTop + explainer.anchorRect.height - parentDocTop - 2);
                } else {
                    startX = explainer.anchorRect.left - parentRect.left + (explainer.anchorRect.width / 2);
                    startY = explainer.anchorRect.bottom - parentRect.top - 2;
                }
            } else {
                return;
            }

            // Bubble Configuration
            const bubbleTop = startY - 60;

            // --- NEW POSITIONING LOGIC ---
            // Find the main text column to anchor against.
            // We now have a guaranteed ID: #blueprint-content-column
            const textColumn = document.getElementById('blueprint-content-column');

            console.log('[ExplainerOverlay] Debug:', {
                liveElement,
                textColumnFound: !!textColumn,
                windowWidth: window.innerWidth,
                fixedOffset: fixedOffsetRef.current
            });

            let bubbleLeftPos = 0;

            if (textColumn) {
                const colRect = textColumn.getBoundingClientRect();
                const rightEdge = colRect.right;
                const windowRight = window.innerWidth;
                const availableSpace = windowRight - rightEdge;

                console.log('[ExplainerOverlay] Column metrics:', {
                    colRight: rightEdge,
                    parentLeft: parentRect.left,
                    availableSpace,
                    bubbleWidth: BUBBLE_WIDTH
                });

                // Calculate the fixed offset (GAP) if we haven't yet
                if (fixedOffsetRef.current === null) {

                    // Center the bubble in the available space
                    // Gap = distance from Text Column Right to Bubble Left
                    let gap = (availableSpace - BUBBLE_WIDTH) / 2;

                    console.log('[ExplainerOverlay] Initial Gap Calc (pre-clamp):', gap);

                    // Simple constraint: don't let it overlap the column (min gap 20px)
                    if (gap < 20) gap = 20;

                    console.log('[ExplainerOverlay] Final Gap:', gap);
                    fixedOffsetRef.current = gap;
                }

                // bubbleLeft relative to parent = (colRect.right - parentRect.left) + fixedOffsetRef.current
                bubbleLeftPos = (colRect.right - parentRect.left) + fixedOffsetRef.current;

            } else {
                console.warn('[ExplainerOverlay] #blueprint-content-column not found! Using fallback.');
                // Fallback to original right-anchored logic if no text column found
                const rightMargin = RIGHT_MARGIN;
                bubbleLeftPos = parentRect.width - (BUBBLE_WIDTH + rightMargin);
            }

            const endX = bubbleLeftPos;
            const endY = bubbleTop + 40;

            setBubblePosition({ top: bubbleTop, left: bubbleLeftPos });

            console.log('[ExplainerOverlay] Position Set:', { left: bubbleLeftPos, top: bubbleTop });

            // Generate Path
            const DROP_HEIGHT = 2;
            const CORNER_RADIUS = 6;
            const horizontalY = startY + DROP_HEIGHT + CORNER_RADIUS;
            const breakoutX = endX - 60;

            const cp1x = breakoutX + 30;
            const cp1y = horizontalY;
            const cp2x = endX - 30;
            const cp2y = endY;

            const path = `
                M ${startX} ${startY} 
                L ${startX} ${startY + DROP_HEIGHT} 
                Q ${startX} ${horizontalY}, ${startX + CORNER_RADIUS} ${horizontalY}
                L ${breakoutX} ${horizontalY}
                C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}
            `;

            setLinePath(path);
            setIsVisible(true);
        };

        // Run immediately
        updatePosition();

        // Use ResizeObserver to handle all layout shifts (window resize, sidebar toggle, etc.)
        const resizeObserver = new ResizeObserver(() => {
            // Use requestAnimationFrame to ensure we measure *after* layout is settled
            requestAnimationFrame(updatePosition);
        });

        // Observe the body (for global re-flows) and the parent container
        resizeObserver.observe(document.body);
        if (containerRef.current && containerRef.current.parentElement) {
            resizeObserver.observe(containerRef.current.parentElement);
        }

        return () => {
            resizeObserver.disconnect();
        };

    }, [explainer.isOpen, explainer.anchorElement, explainer.anchorRect]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            setExplainer(prev => ({ ...prev, isOpen: false }));
        }, 300);
    };

    if (!explainer.isOpen && !isVisible) return null;

    // RENDER INLINE (No Portal)
    // Absolute position relative to the parent Blueprint container
    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-50 pointer-events-none overflow-visible"
            style={{
                // Ensure it covers full height/width of parent
                width: '100%',
                height: '100%'
            }}
        >
            {/* 1. Connection Line */}
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#FF4A1C" />
                    </marker>
                </defs>
                <path
                    d={linePath}
                    fill="none"
                    stroke="#FF4A1C"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`transition-all duration-75 ${isVisible ? 'animate-draw-line' : 'opacity-0'}`}
                    style={{
                        strokeDasharray: 1500,
                        strokeDashoffset: isVisible ? 0 : 1500,
                        transition: 'stroke-dashoffset 0.8s ease-out'
                    }}
                />
            </svg>

            {/* 2. Floating Bubble */}
            <div
                className={`absolute pointer-events-auto transition-all duration-500 ease-out transform
                    ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}
                `}
                style={{
                    top: bubblePosition.top,
                    left: bubblePosition.left,
                    width: BUBBLE_WIDTH
                }}
            >
                <div className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl border-2 border-[#FF4A1C]/20 overflow-hidden">
                    {/* Header */}
                    <div className="bg-stone-50 dark:bg-stone-800/50 p-4 border-b border-stone-100 dark:border-stone-700 flex justify-between items-start gap-4">
                        <div>
                            <h3 className="font-semibold text-lg text-stone-900 dark:text-stone-100 leading-tight">
                                {explainer.term}, explained
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-[#FF4A1C]">
                                <Sparkles className="w-3 h-3" />
                                <span>AI Explanation</span>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-4">
                            {/* Placeholder Loading State or Content */}
                            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                                Depending on the context, a <strong>{explainer.term}</strong> refers to...
                                <br /><br />
                                <span className="italic text-stone-400 text-sm">
                                    (This is a placeholder for the generated explanation. The integration with the generation backend will be the next step.)
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes draw-line {
                    to { stroke-dashoffset: 0; }
                }
            `}</style>
        </div>
    );
};

export default ExplainerOverlay;
