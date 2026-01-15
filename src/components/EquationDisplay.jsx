import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Calculator, Info } from 'lucide-react';

/**
 * EquationDisplay Component
 * 
 * Renders mathematical equations using KaTeX with beautiful styling.
 * Shows equation name, LaTeX formula, variable definitions, and "when to use" context.
 * 
 * @param {Object} props
 * @param {Array} props.equations - Array of equation objects
 * @param {string} props.equations[].name - Name of the equation (e.g., "Stefan-Boltzmann Law")
 * @param {string} props.equations[].latex - LaTeX notation of the equation
 * @param {Object} props.equations[].variables - Variable definitions { symbol: description }
 * @param {string} props.equations[].when_to_use - When to apply this equation
 * @param {number} props.equations[].index - Optional index number for referencing
 */
const EquationDisplay = ({ equations }) => {
  if (!equations || equations.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wide">
        <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        Key Equations
      </div>

      <div className="grid grid-cols-2 gap-4">
        {equations.map((equation, idx) => (
          <EquationCard
            key={equation.name || idx}
            equation={equation}
            index={equation.index ?? idx + 1}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Individual Equation Card
 */
const EquationCard = ({ equation, index }) => {
  const { name, latex, variables, when_to_use } = equation;

  // Safely render LaTeX - fallback to text if invalid
  const renderLatex = (latexString) => {
    if (!latexString) return null;

    try {
      return <BlockMath math={latexString} />;
    } catch (error) {
      console.error('LaTeX rendering error:', error);
      // Fallback to displaying the raw string in a code block
      return (
        <code className="block text-center py-2 px-4 bg-stone-100 dark:bg-stone-800 rounded font-mono text-sm text-stone-800 dark:text-stone-200">
          {latexString}
        </code>
      );
    }
  };

  return (
    <div className="bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden h-full flex flex-col transition-colors duration-200 relative">
      {/* Equation Header */}
      <div className="px-4 py-3 bg-stone-100/50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-stone-500 dark:bg-stone-600 text-white text-xs font-bold rounded-full">
            {index}
          </span>
          <h4 className="font-semibold text-stone-900 dark:text-white">{name || 'Equation'}</h4>
        </div>
      </div>

      {/* LaTeX Equation Display - Fixed height container for consistency */}
      <div className="px-4 py-4 bg-white/60 dark:bg-stone-950/30 overflow-hidden border-b border-stone-100 dark:border-stone-800">
        <div className="flex justify-center items-center min-h-[3rem] text-xl text-stone-800 dark:text-stone-100 h-full">
          <ScalableEquation>
            {renderLatex(latex)}
          </ScalableEquation>
        </div>
      </div>

      {/* Full Content Container (No Scrollbar) */}
      <div className="flex-1">
        {/* Variable Definitions */}
        {variables && Object.keys(variables).length > 0 && (
          <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-900/50 border-t border-stone-200 dark:border-stone-700">
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
              Variables
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(variables).map(([symbol, description]) => (
                <div key={symbol} className="flex items-baseline gap-1.5 text-sm max-w-full">
                  <span className="font-mono font-semibold text-stone-600 dark:text-stone-300 shrink-0">
                    <InlineMath math={symbol} />
                  </span>
                  <span className="text-stone-600 dark:text-stone-400 break-words min-w-0">= {description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* When to Use */}
        {when_to_use && (
          <div className="px-4 py-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wide mb-0.5">
                  When to Use
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                  {when_to_use}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ScalableEquation Component
 * 
 * Dynamically scales content to fit within its container.
 * Uses separate refs for measurement and transformation to prevent feedback loops.
 */
const ScalableEquation = ({ children }) => {
  const containerRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    const checkSize = () => {
      // 1. Measure the available space (container) and the true content size (inner)
      if (containerRef.current && innerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const contentWidth = innerRef.current.scrollWidth;

        // 2. Calculate scale only if content is wider than container
        // innerRef is never transformed, so its scrollWidth should be stable (the full size)
        if (contentWidth > containerWidth && contentWidth > 0) {
          setScale(containerWidth / contentWidth);
        } else {
          setScale(1);
        }
      }
    };

    checkSize();

    // Observe BOTH the container resizing and the content changing (e.g. fonts loading)
    const observer = new ResizeObserver(() => checkSize());

    if (containerRef.current) observer.observe(containerRef.current);
    if (innerRef.current) observer.observe(innerRef.current);

    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={containerRef} className="w-full flex justify-center overflow-hidden">
      <div
        ref={wrapperRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          width: 'max-content'
        }}
        className="shrink-0"
      >
        {/* Helper to force internal KaTeX to be expansive so we can measure true width.
            This inner element is NOT transformed directly, preserving its layout metrics for measurement. */}
        <div ref={innerRef} className="scalable-katex-wrapper w-max">
          {children}
        </div>
        <style>{`
          .scalable-katex-wrapper .katex-display {
             margin: 0 !important;
             overflow: visible !important;
             width: max-content !important;
             max-width: none !important;
          }
           .scalable-katex-wrapper .katex-html {
             overflow: visible !important;
           }
        `}</style>
      </div>
    </div>
  );
};

export default EquationDisplay;

