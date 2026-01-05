import React, { useState, useEffect } from 'react';
import { Check, Loader2, X, AlertCircle, Clock, Zap, Database, Sparkles, Save, Archive } from 'lucide-react';

const StructureGenerationProgress = ({ blueprintId, authToken, onComplete, onError }) => {
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(7);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Step configuration with icons and descriptions
  const stepConfig = {
    'fetch-analysis': {
      icon: Database,
      label: 'Fetch Analysis',
      description: 'Retrieving document analysis from database',
      color: 'blue',
    },
    'check-structure-cache': {
      icon: Zap,
      label: 'Check Cache',
      description: 'Searching for similar structures (92%+ match)',
      color: 'purple',
    },
    'adapt-cached-structure': {
      icon: Sparkles,
      label: 'Adapt Cache',
      description: 'Adapting cached structure to your document',
      color: 'green',
    },
    'generate-structure-with-ai': {
      icon: Sparkles,
      label: 'Generate with AI',
      description: 'Creating new structure with Claude Haiku 4.5',
      color: 'orange',
    },
    'process-equations': {
      icon: Sparkles,
      label: 'Process Equations',
      description: 'Extracting and caching equations',
      color: 'indigo',
    },
    'source-figures': {
      icon: Database,
      label: 'Source Figures',
      description: 'Finding relevant diagrams and figures',
      color: 'pink',
    },
    'store-structure': {
      icon: Save,
      label: 'Store Structure',
      description: 'Saving structure to database',
      color: 'emerald',
    },
    'cache-structure': {
      icon: Archive,
      label: 'Cache Structure',
      description: 'Caching for future reuse',
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
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        
        setSteps(prev => [...prev, {
          function_name: stepSequence[i],
          status: 'started',
          message: `Starting ${stepSequence[i]}...`,
          timestamp: Date.now(),
        }]);
        setCurrentStep(i + 1);

        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
        
        setSteps(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            status: 'completed',
            message: `✓ ${stepSequence[i]} completed`,
            duration_ms: Math.random() * 5000 + 1000,
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'started':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <Check className="w-4 h-4" />;
      case 'failed':
        return <X className="w-4 h-4" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'started':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'completed':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'skipped':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-stone-400 bg-stone-50 dark:bg-stone-800';
    }
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-300 dark:border-stone-600 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF4A1C] to-orange-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Structure Generation</h3>
              <p className="text-sm text-white/80">
                {isComplete ? 'Complete!' : `Step ${currentStep} of ${totalSteps}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-mono bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            <Clock className="w-4 h-4" />
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
          <div 
            className="bg-white h-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="p-4 max-h-96 overflow-y-auto space-y-2">
        {steps.map((step, idx) => {
          const config = stepConfig[step.function_name] || {
            icon: Sparkles,
            label: step.function_name,
            description: 'Processing...',
            color: 'stone',
          };
          const Icon = config.icon;

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                step.status === 'started' 
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 animate-pulse' 
                  : step.status === 'completed'
                  ? 'border-green-300 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10'
                  : step.status === 'failed'
                  ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/10'
                  : 'border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50'
              }`}
            >
              {/* Status Icon */}
              <div className={`shrink-0 p-2 rounded-lg ${getStatusColor(step.status)}`}>
                {getStatusIcon(step.status)}
              </div>

              {/* Function Icon */}
              <div className={`shrink-0 p-2 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/20 text-${config.color}-600 dark:text-${config.color}-400`}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                    {config.label}
                  </h4>
                  {step.duration_ms && (
                    <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                      {formatTime(step.duration_ms)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                  {config.description}
                </p>
                {step.status === 'completed' && step.metadata && (
                  <div className="mt-2 text-xs font-mono text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 rounded p-2">
                    {step.metadata.from_cache && (
                      <span className="text-green-600 dark:text-green-400">⚡ Cache hit - saved ~24k tokens</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Waiting steps */}
        {!isComplete && steps.length < totalSteps && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-stone-300 dark:border-stone-600 opacity-50">
            <div className="shrink-0 p-2 rounded-lg bg-stone-100 dark:bg-stone-800">
              <Clock className="w-4 h-4 text-stone-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Waiting for next step...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {isComplete && (
        <div className="border-t border-stone-200 dark:border-stone-700 p-4 bg-stone-50 dark:bg-stone-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="w-5 h-5" />
              <span className="font-semibold">Generation Complete!</span>
            </div>
            <div className="text-sm text-stone-600 dark:text-stone-400">
              Total time: <span className="font-mono font-semibold">{formatTime(elapsedTime)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StructureGenerationProgress;

