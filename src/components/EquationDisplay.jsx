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
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-600 uppercase tracking-wide">
        <Calculator className="w-4 h-4 text-indigo-500" />
        Key Equations
      </div>
      
      <div className="space-y-3">
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
        <code className="block text-center py-2 px-4 bg-stone-100 rounded font-mono text-sm">
          {latexString}
        </code>
      );
    }
  };

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden">
      {/* Equation Header */}
      <div className="px-4 py-3 bg-stone-100/50 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-stone-500 text-white text-xs font-bold rounded-full">
            {index}
          </span>
          <h4 className="font-semibold text-stone-900">{name || 'Equation'}</h4>
        </div>
      </div>
      
      {/* LaTeX Equation Display */}
      <div className="px-4 py-4 bg-white/60">
        <div className="flex justify-center items-center min-h-[3rem] text-xl text-stone-800">
          {renderLatex(latex)}
        </div>
      </div>
      
      {/* Variable Definitions */}
      {variables && Object.keys(variables).length > 0 && (
        <div className="px-4 py-3 bg-stone-50/50 border-t border-stone-200">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Variables
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(variables).map(([symbol, description]) => (
              <div key={symbol} className="flex items-baseline gap-1.5 text-sm">
                <span className="font-mono font-semibold text-stone-600">
                  <InlineMath math={symbol} />
                </span>
                <span className="text-stone-600">= {description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* When to Use */}
      {when_to_use && (
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-0.5">
                When to Use
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {when_to_use}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquationDisplay;

