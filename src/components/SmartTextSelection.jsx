import React, { useState, useEffect, useRef } from 'react';
import { useUiState } from '../context/UiStateContext';

/**
 * SmartTextSelection Component
 * 
 * Wraps text content and enables smart text selection with automatic word boundary expansion.
 * When users select text, it automatically expands to full word boundaries and shows a contextual menu.
 */
const SmartTextSelection = ({ children, unitId, context, blueprintId, solutionContext }) => {
    const [selectedText, setSelectedText] = useState('');
    const [menuPosition, setMenuPosition] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const containerRef = useRef(null);
    const menuRef = useRef(null);
    const { addExplainer } = useUiState();

    /**
     * Expands selection to word boundaries
     * @param {string} text - The full text content
     * @param {number} start - Start offset
     * @param {number} end - End offset
     * @returns {object} - Expanded start and end offsets
     */
    const expandToWordBoundaries = (text, start, end) => {
        // Expand start to word boundary (alphanumeric, including LaTeX-like content)
        while (start > 0 && /[\w$]/.test(text[start - 1])) {
            start--;
        }

        // Expand end to word boundary
        while (end < text.length && /[\w$]/.test(text[end])) {
            end++;
        }

        return { start, end };
    };

    /**
     * Gets the text content from a node, handling React elements
     */
    const getTextContent = (node) => {
        if (!node) return '';
        if (typeof node === 'string') return node;
        if (typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(getTextContent).join('');
        if (node.props && node.props.children) return getTextContent(node.props.children);
        return '';
    };

    /**
     * Calculates absolute start/end offsets relative to the container's text content
     */
    const getAbsoluteRangeOffsets = (container, range) => {
        let charCount = 0;
        let start = -1;
        let end = -1;

        const walk = (node) => {
            if (start !== -1 && end !== -1) return;

            if (node === range.startContainer && node.nodeType === Node.TEXT_NODE) {
                start = charCount + range.startOffset;
            }
            if (node === range.endContainer && node.nodeType === Node.TEXT_NODE) {
                end = charCount + range.endOffset;
            }

            if (node.nodeType === Node.TEXT_NODE) {
                charCount += node.textContent.length;
            } else {
                for (const child of node.childNodes) {
                    walk(child);
                    if (start !== -1 && end !== -1) return;
                }
            }
        };

        walk(container);
        return { start, end };
    };

    /**
     * Handle text selection
     */
    const handleMouseUp = (e) => {
        // Small delay to ensure selection is complete
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedStr = selection.toString().trim();

            if (selectedStr.length === 0) {
                setIsMenuOpen(false);
                setSelectedText('');
                return;
            }

            // Check if selection is within our container
            if (!containerRef.current) return;

            const range = selection.getRangeAt(0);
            if (!containerRef.current.contains(range.commonAncestorContainer)) {
                return;
            }

            // Get extraction positions based on DOM Range, not string search
            const { start: selectionStart, end: selectionEnd } = getAbsoluteRangeOffsets(containerRef.current, range);
            const fullText = containerRef.current.textContent || '';

            // Fallback: if we couldn't resolve positions via DOM (e.g. selection across elements),
            // or if the simplified search failed, try string match as a last resort
            if (selectionStart === -1 || selectionEnd === -1) {
                // Original fallback behavior
                const indexStart = fullText.indexOf(selectedStr);
                if (indexStart !== -1) {
                    // Same expansion logic as before
                    const expanded = expandToWordBoundaries(
                        fullText,
                        indexStart,
                        indexStart + selectedStr.length
                    );
                    const expandedText = fullText.substring(expanded.start, expanded.end).trim();
                    setSelectedText(expandedText);
                } else {
                    setSelectedText(selectedStr);
                }
            } else {
                // Expand to word boundaries
                const expanded = expandToWordBoundaries(
                    fullText,
                    selectionStart,
                    selectionEnd
                );

                const expandedText = fullText.substring(expanded.start, expanded.end).trim();
                setSelectedText(expandedText);

                // Update the actual selection to show the expanded text
                try {
                    const newRange = document.createRange();
                    const textNode = findTextNode(containerRef.current, expanded.start, expanded.end);
                    if (textNode) {
                        newRange.setStart(textNode.node, textNode.start);
                        newRange.setEnd(textNode.endNode, textNode.end);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                } catch (err) {
                    // If we can't update the selection, just use the expanded text
                    console.log('Could not update selection range:', err);
                }
            }

            // Position the menu near the selection
            const rect = range.getBoundingClientRect();

            // Capture scroll offset of the main container to ensure anchored position is correct even if user scrolls while menu is open
            const scrollContainer = document.getElementById('main-scroll-container') || document.getElementById('lecture-scroll-container');
            const currentScrollOffset = scrollContainer ? scrollContainer.scrollTop : 0;

            setMenuPosition({
                x: rect.left + (rect.width / 2),
                y: rect.top,
                scrollOffset: currentScrollOffset, // Store for explainer creation
                rect: {
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    docTop: rect.top + window.scrollY,
                    docLeft: rect.left + window.scrollX
                }
            });

            setIsMenuOpen(true);
        }, 10);
    };

    /**
     * Find text node and offsets for a given character range
     */
    const findTextNode = (container, startOffset, endOffset) => {
        let currentOffset = 0;
        let startNode = null;
        let startNodeOffset = 0;
        let endNode = null;
        let endNodeOffset = 0;

        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const textLength = node.textContent.length;

                if (!startNode && currentOffset + textLength > startOffset) {
                    startNode = node;
                    startNodeOffset = startOffset - currentOffset;
                }

                if (!endNode && currentOffset + textLength >= endOffset) {
                    endNode = node;
                    endNodeOffset = endOffset - currentOffset;
                    return true; // Stop walking
                }

                currentOffset += textLength;
            } else if (node.childNodes) {
                for (let child of node.childNodes) {
                    if (walk(child)) return true;
                }
            }
            return false;
        };

        walk(container);

        if (startNode && endNode) {
            return {
                node: startNode,
                start: startNodeOffset,
                endNode: endNode,
                end: endNodeOffset
            };
        }

        return null;
    };

    /**
     * Handle action selection from menu
     */
    const handleAction = (action) => {
        if (!selectedText || !menuPosition) return;

        let explainerType = 'explain';
        if (action === 'video') explainerType = 'video';
        if (action === 'question') explainerType = 'question';

        addExplainer({
            type: explainerType,
            term: selectedText,
            context: context,
            solutionContext: solutionContext,
            anchorId: null,
            unitId: unitId,
            blueprintId: blueprintId,
            startPosition: {
                x: menuPosition.x,
                y: menuPosition.y
            },
            anchorRect: menuPosition.rect,
            capturedScrollTop: menuPosition.scrollOffset || 0, // Pass the captured scroll offset
            anchorElement: null,
            id: Date.now()
        });

        // Clear selection and close menu
        window.getSelection().removeAllRanges();
        setIsMenuOpen(false);
        setSelectedText('');
    };

    /**
     * Close menu when clicking outside
     */
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
                setSelectedText('');
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    return (
        <span
            ref={containerRef}
            onMouseUp={handleMouseUp}
            className="smart-text-selection"
        >
            {children}

            {/* Action Menu */}
            {isMenuOpen && menuPosition && (
                <div
                    ref={menuRef}
                    className="fixed z-50 w-48 bg-stone-50 dark:bg-stone-900 rounded-xl shadow-xl border border-stone-300 dark:border-stone-500 p-2 animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        left: `${menuPosition.x}px`,
                        top: `${menuPosition.y - 10}px`,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => handleAction('explain')}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                        >
                            📝 Explain this
                        </button>
                        <button
                            onClick={() => handleAction('video')}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                        >
                            📺 Watch a video
                        </button>
                        <button
                            onClick={() => handleAction('question')}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-stone-700 dark:text-stone-200 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700/50 rounded-lg transition-all"
                        >
                            🙋 Ask a question?
                        </button>
                    </div>
                    {/* Arrow Pointer */}
                    <div
                        className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-stone-50 dark:border-t-stone-900 drop-shadow-sm"
                    />
                </div>
            )}
        </span>
    );
};

export default SmartTextSelection;
