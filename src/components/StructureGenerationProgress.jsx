import React, { useState, useEffect } from 'react';
import { Check, Loader2, X, AlertCircle, Clock, Zap, Database, Sparkles, Save, Archive, ArrowRight } from 'lucide-react';

const StructureGenerationProgress = ({ blueprintId, authToken, onComplete, onError }) => {
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(7);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Step configuration with icons and descriptions
  // Modernized configuration
  const stepConfig = {
    'fetch-analysis': {
      icon: Database,
      label: 'Fetch Analysis',
      description: 'Retrieving document intelligence',
      color: 'blue',
    },
    'check-structure-cache': {
      icon: Zap,
      label: 'Smart Cache',
      description: 'Checking for existing learning paths',
      color: 'purple',
    },
    'adapt-cached-structure': {
      icon: Sparkles,
      label: 'Adapt Structure',
      description: 'Tailoring path to your document',
      color: 'green',
    },
    'generate-structure-with-ai': {
      icon: Sparkles,
      label: 'AI Generation',
      description: 'Designing custom curriculum',
      color: 'orange',
    },
    'process-equations': {
      icon: Database,
      label: 'Process Equations',
      description: 'Extracting formulas & key concepts',
      color: 'indigo',
    },
    'source-figures': {
      icon: Database,
      label: 'Source Figures',
      description: 'Finding relevant diagrams',
      color: 'pink',
    },
    'store-structure': {
      icon: Save,
      label: 'Finalizing',
      description: 'Saving your blueprint',
      color: 'emerald',
    },
    'cache-structure': {
      icon: Archive,
      label: 'Optimization',
      description: 'Indexing for future retrieval',
      color: 'teal',
    },
  };

  useEffect(() => {
    if (!blueprintId || !authToken) return;

    setStartTime(Date.now());
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Start the generation with progress tracking
    const generateWithProgress = async () => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/orchestrate-generate-structure`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blueprint_id: blueprintId,
            stream_progress: true
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Generation failed');
        }

        const data = await response.json();

        // Orchestrator returns: { structure, structure_id, from_cache, metadata }
        // Add success flag for compatibility
        const result = {
          success: true,
          ...data
        };

        // Mark as complete
        setIsComplete(true);
        if (onComplete) onComplete(result);

      } catch (error) {
        console.error('[StructureGenerationProgress] Error:', error);

        // Parse error message for better user feedback
        let userMessage = error.message;
        if (error.message.includes('No analysis found')) {
          userMessage = 'No document analysis found. Please run Step 1 (Analyze Document) first.';
        } else if (error.message.includes('fetch-analysis failed')) {
          userMessage = 'Failed to fetch document analysis. Please ensure the document has been analyzed.';
        }

        const enhancedError = new Error(userMessage);
        enhancedError.originalError = error;

        if (onError) onError(enhancedError);
      }
    };

    generateWithProgress();
  }, [blueprintId, authToken]);

  // Update elapsed time
  useEffect(() => {
    if (!startTime || isComplete) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, isComplete]);

  // Simulate progress for demo (in production, this would come from SSE)
  useEffect(() => {
    if (!blueprintId) return;

    const simulateProgress = async () => {
      const stepSequence = [
        'fetch-analysis',
        'check-structure-cache',
        Math.random() > 0.5 ? 'adapt-cached-structure' : 'generate-structure-with-ai',
        'process-equations',
        'source-figures',
        'store-structure',
        'cache-structure',
      ];

      for (let i = 0; i < stepSequence.length; i++) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 400)); // Faster for better UX

        setSteps(prev => [...prev, {
          function_name: stepSequence[i],
          status: 'started',
          message: `Starting ${stepSequence[i]}...`,
          timestamp: Date.now(),
        }]);
        setCurrentStep(i + 1);

        await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 800));

        setSteps(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            status: 'completed',
            message: `✓ ${stepSequence[i]} completed`,
            duration_ms: Math.random() * 2000 + 500,
          };
          return updated;
        });
      }

      setIsComplete(true);
    };

    simulateProgress();
  }, [blueprintId]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${Math.floor(milliseconds / 100)}s`;
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-fade-in">
      {/* Modern Header */}
      <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Building Your Blueprint
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Analyzing document and generating personalized learning path...
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all duration-300 ${isComplete
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 animate-pulse'
            }`}>
            {isComplete ? (
              <>
                <Check className="w-3 h-3" />
                <span>Complete</span>
              </>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Working</span>
              </>
            )}
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs font-medium text-stone-400 dark:text-stone-500 mb-2">
            <span>Progress</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden w-full">
            <div
              className={`h-full transition-all duration-700 ease-out ${isComplete ? 'bg-green-500' : 'bg-[#FF4A1C]'}`}
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps List - Vertical Stepper Style */}
      <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar bg-stone-50/30 dark:bg-stone-900">
        <div className="space-y-6 relative pl-2">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-stone-200 dark:bg-stone-800 rounded-full" />

          {steps.map((step, idx) => {
            const config = stepConfig[step.function_name] || {
              icon: Sparkles,
              label: step.function_name,
              description: 'Processing...',
              color: 'stone',
            };
            const Icon = config.icon;
            const isLast = idx === steps.length - 1;
            const isActive = step.status === 'started';
            const isDone = step.status === 'completed';

            return (
              <div
                key={idx}
                className={`relative flex items-start gap-4 z-10 transition-all duration-500 animate-slide-in-from-bottom-2`}
              >
                {/* Status Dot/Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-300 bg-white dark:bg-stone-900 shrink-0 ${isDone
                  ? 'border-green-500 text-green-500 scale-100'
                  : isActive
                    ? 'border-[#FF4A1C] text-[#FF4A1C] scale-110 shadow-orange-100 dark:shadow-none'
                    : 'border-stone-200 dark:border-stone-700 text-stone-300'
                  }`}>
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className={`flex-1 pt-1 min-w-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <h4 className={`font-semibold text-sm transition-colors ${isActive
                      ? 'text-[#FF4A1C]'
                      : isDone
                        ? 'text-stone-900 dark:text-stone-100'
                        : 'text-stone-400'
                      }`}>
                      {config.label}
                    </h4>
                    {step.duration_ms && (
                      <span className="text-[10px] font-mono text-stone-400 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                        {formatTime(step.duration_ms)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                    {config.description}
                  </p>

                  {/* Metadata Tags (e.g. Cache Hit) */}
                  {isDone && step.metadata && step.metadata.from_cache && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium border border-green-100 dark:border-green-800/50">
                      <Zap className="w-3 h-3" />
                      <span>Cache Hit (~24k tokens saved)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pending/Waiting Step */}
          {!isComplete && steps.length < totalSteps && (
            <div className="relative flex items-center gap-4 z-10 opacity-40 grayscale pl-2">
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-stone-300 dark:border-stone-700 bg-transparent shrink-0 ml-2" />
              <div className="flex-1 border-t border-dashed border-stone-300 dark:border-stone-700" />
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      {isComplete && (
        <div className="border-t border-stone-200 dark:border-stone-800 p-4 bg-stone-50/50 dark:bg-stone-800/30">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>Total Generation Time</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-200">{formatTime(elapsedTime)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StructureGenerationProgress;
