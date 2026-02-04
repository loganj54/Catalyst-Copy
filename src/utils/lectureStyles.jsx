import React from 'react';

export const LECTURE_TYPOGRAPHY = {
    // Container
    container: "prose prose-lg prose-stone dark:prose-invert text-stone-600 dark:text-stone-400 leading-relaxed max-w-none font-sans",

    // Handlers for ReactMarkdown components
    h1: "text-4xl font-light tracking-tight text-stone-900 dark:text-stone-100 mt-12 mb-6 border-b border-stone-200 dark:border-stone-800 pb-4",
    h2: "text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100 mt-12 mb-6",
    h3: "text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100 mt-8 mb-4",
    h4: "text-xl font-light text-stone-900 dark:text-stone-100 mt-6 mb-3",
    p: "mb-6 text-stone-700 dark:text-stone-300 text-lg leading-relaxed",
    li: "text-stone-700 dark:text-stone-300 text-lg leading-relaxed mb-2",

    // Utility for lists to ensure consistent spacing
    ul: "list-disc pl-5 mb-6 space-y-2",
    ol: "list-decimal pl-5 mb-6 space-y-2"
};

// Helper to apply these styles to ReactMarkdown components map
export const getLectureMarkdownComponents = (LatexTextComponent, contextData = {}) => ({
    p: ({ node, children }) => {
        // Extract text content from children for LaTeX processing
        const extractText = (child) => {
            if (typeof child === 'string') return child;
            if (Array.isArray(child)) return child.map(extractText).join('');
            if (child?.props?.children) return extractText(child.props.children);
            return '';
        };
        const textContent = Array.isArray(children)
            ? children.map(extractText).join('')
            : extractText(children);

        return (
            <div className={LECTURE_TYPOGRAPHY.p}>
                <LatexTextComponent
                    text={textContent}
                    {...contextData}
                />
            </div>
        );
    },
    li: ({ node, children }) => {
        const extractText = (child) => {
            if (typeof child === 'string') return child;
            if (Array.isArray(child)) return child.map(extractText).join('');
            if (child?.props?.children) return extractText(child.props.children);
            return '';
        };
        const textContent = Array.isArray(children)
            ? children.map(extractText).join('')
            : extractText(children);

        return (
            <li className={LECTURE_TYPOGRAPHY.li}>
                <LatexTextComponent
                    text={textContent}
                    {...contextData}
                />
            </li>
        );
    },
    h1: ({ node, children }) => (
        <h1 className={LECTURE_TYPOGRAPHY.h1}>
            {children}
        </h1>
    ),
    h2: ({ node, children }) => (
        <h2 className={LECTURE_TYPOGRAPHY.h2}>
            {children}
        </h2>
    ),
    h3: ({ node, children }) => (
        <h3 className={LECTURE_TYPOGRAPHY.h3}>
            {children}
        </h3>
    ),
    h4: ({ node, children }) => (
        <h4 className={LECTURE_TYPOGRAPHY.h4}>
            {children}
        </h4>
    ),
});
