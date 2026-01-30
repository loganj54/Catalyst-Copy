import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import SmartTextSelection from './SmartTextSelection';

/**
 * LatexText Component
 *
 * Renders mixed text and LaTeX with smart text selection.
 * - Text wrapped in $...$ will be rendered using KaTeX.
 * - All text is selectable with automatic word boundary expansion.
 */
function LatexText({ text, unitId, context, blueprintId, solutionContext }) {
    if (!text) return null;

    // Split by $...$ (inline math only, no more [[...]] parsing)
    const parts = text.split(/(\$[^$]+\$)/g);

    return (
        <SmartTextSelection unitId={unitId} context={context} blueprintId={blueprintId} solutionContext={solutionContext}>
            {parts.map((part, i) => {
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
        </SmartTextSelection>
    );
}

export default LatexText;
