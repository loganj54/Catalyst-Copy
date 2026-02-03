import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import SmartTextSelection from './SmartTextSelection';

/**
 * LatexText Component
 *
 * Renders mixed text and LaTeX with smart text selection.
 * - Text wrapped in $$...$$ will be rendered as block (centered) equations.
 * - Text wrapped in $...$ will be rendered as inline math using KaTeX.
 * - All text is selectable with automatic word boundary expansion.
 */
function LatexText({ text, unitId, context, blueprintId, solutionContext }) {
    if (!text) return null;

    // Split by markdown headers, then $$...$$ (block math), then $...$ (inline math), then **...** (bold)
    // We capture headers (## or ###), block math, inline math, and bold text
    const parts = text.split(/(^#{2,3}\s+.+$|(?<=\n)#{2,3}\s+.+$|\$\$[\s\S]+?\$\$|\$[^$]+\$|\*\*[^*]+\*\*)/gm);

    return (
        <SmartTextSelection unitId={unitId} context={context} blueprintId={blueprintId} solutionContext={solutionContext}>
            {parts.map((part, i) => {
                if (!part) return null;

                // Handling Markdown Headers: ## or ###
                const headerMatch = part.trim().match(/^(#{2,3})\s+(.+)$/);
                if (headerMatch) {
                    const level = headerMatch[1].length;
                    const content = headerMatch[2];
                    const Tag = `h${level}`;
                    return <Tag key={i}>{content}</Tag>;
                }

                // Handling Block Math: $$...$$
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    const content = part.slice(2, -2).trim();
                    return (
                        <div key={i} className="my-6 flex justify-center">
                            <BlockMath math={content} />
                        </div>
                    );
                }
                
                // Handling Inline Math: $...$
                if (part.startsWith('$') && part.endsWith('$')) {
                    const content = part.slice(1, -1);
                    return (
                        <span key={i} className="inline-block mx-0.5">
                            <InlineMath math={content} />
                        </span>
                    );
                }

                // Handling Bold Text: **...**
                if (part.startsWith('**') && part.endsWith('**')) {
                    const content = part.slice(2, -2);
                    return <strong key={i} className="font-bold text-stone-900 dark:text-stone-100">{content}</strong>;
                }

                // Handling Regular Text
                return <span key={i}>{part}</span>;
            })}
        </SmartTextSelection>
    );
}

export default LatexText;
