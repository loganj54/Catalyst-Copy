import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

/**
 * LatexText Component
 * 
 * Renders mixed text and LaTeX. Text wrapped in $...$ will be rendered using KaTeX.
 * Example: "The value of $\pi$ is approx 3.14" -> "The value of [pi symbol] is approx 3.14"
 */
const LatexText = ({ text }) => {
    if (!text) return null;
    // Split by $...$ (inline)
    // The capturing group () keeps the delimiter in the result array
    const parts = text.split(/(\$[^$]+\$)/g);

    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                    // Remove $ delimiters
                    const content = part.slice(1, -1);
                    // Render with InlineMath
                    return (
                        <span key={i} className="inline-block mx-0.5">
                            <InlineMath math={content} />
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

export default LatexText;
