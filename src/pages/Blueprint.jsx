import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Target, Calendar, FileText, Loader2, Download,
  ExternalLink, RefreshCw, AlertCircle, Sparkles, ChevronDown, ChevronUp,
  ChevronRight, Bug, Check, Play, Youtube, Clock, Star, Zap, HelpCircle,
  Layout, Grid, Circle, Eye, Info, Database, ToggleLeft, ToggleRight, Timer,
  AlignLeft, X, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUiState } from '../context/UiStateContext';
import { supabase } from '../lib/supabase';
import EquationDisplay from '../components/EquationDisplay';
import FigureDisplay from '../components/FigureDisplay';
import Sidebar from '../components/Sidebar';
import ClassSidebar from '../components/ClassSidebar';
import StructureGenerationProgress from '../components/StructureGenerationProgress';
import ChatDrawer from '../components/ChatDrawer';
import RelatedMaterialModule from '../components/RelatedMaterialModule';

// Generation status display configuration
const STATUS_CONFIG = {
  pending: {
    label: 'Waiting to start...',
    icon: Loader2,
    color: 'text-stone-500',
    animate: false
  },
  analyzing: {
    label: 'Analyzing your document...',
    icon: Sparkles,
    color: 'text-blue-500',
    animate: true
  },
  analyzed: {
    label: 'Analysis complete - ready for structure generation',
    icon: Sparkles,
    color: 'text-blue-500',
    animate: false
  },
  searching: {
    label: 'Finding the best resources...',
    icon: Sparkles,
    color: 'text-purple-500',
    animate: true
  },
  generating: {
    label: 'Building your learning path...',
    icon: Sparkles,
    color: 'text-orange-500',
    animate: true
  },
  structure_complete: {
    label: 'Structure generated - ready for resource search',
    icon: Sparkles,
    color: 'text-orange-500',
    animate: false
  },
  completed: {
    label: 'Complete!',
    icon: Sparkles,
    color: 'text-green-500',
    animate: false
  },
  failed: {
    label: 'Generation failed',
    icon: AlertCircle,
    color: 'text-red-500',
    animate: false
  },
};

// ============================================================================
// RESOURCE TABLE COMPONENT
// ============================================================================
const ResourceTable = ({ resources, session }) => {
  const [userRatings, setUserRatings] = useState({});
  const [ratingInProgress, setRatingInProgress] = useState(null);
  const [localAverages, setLocalAverages] = useState({});

  const getPlatformIcon = (platform) => {
    if (platform?.toLowerCase().includes('youtube')) {
      return <Youtube className="w-4 h-4 text-red-500" />;
    }
    return <ExternalLink className="w-4 h-4 text-stone-400" />;
  };

  const formatDuration = (input) => {
    if (!input) return null;

    // If it's a string containing a colon, assume it's already formatted (e.g. "18:03")
    if (typeof input === 'string' && input.includes(':')) {
      return input;
    }

    const seconds = parseInt(input, 10);
    if (isNaN(seconds)) return null;

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Decode HTML entities in text
  const decodeHtmlEntities = (text) => {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Submit rating to API
  const handleRating = async (resourceId, rating) => {
    if (!session?.access_token) {
      console.log('User not authenticated');
      return;
    }

    setRatingInProgress(resourceId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/rate-resource`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ resource_id: resourceId, rating })
      });

      const result = await response.json();
      if (result.success) {
        setUserRatings(prev => ({ ...prev, [resourceId]: rating }));
        setLocalAverages(prev => ({
          ...prev,
          [resourceId]: {
            average_rating: result.average_rating,
            rating_count: result.rating_count
          }
        }));
        console.log(`Rated resource ${resourceId}: ${rating} stars. New average: ${result.average_rating}`);
      } else {
        console.error('Failed to submit rating:', result.error);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setRatingInProgress(null);
    }
  };

  // Star Rating Component
  const StarRating = ({ resource }) => {
    const [hoverRating, setHoverRating] = useState(0);
    const resourceId = resource.id;

    // Use local state if updated, otherwise use resource data
    const displayData = localAverages[resourceId] || {
      average_rating: resource.average_rating,
      rating_count: resource.rating_count || 0
    };

    const averageRating = displayData.average_rating;
    const ratingCount = displayData.rating_count;
    const userRating = userRatings[resourceId];
    const isRating = ratingInProgress === resourceId;

    return (
      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.preventDefault()}>
        {/* Interactive stars */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = hoverRating ? star <= hoverRating : (userRating ? star <= userRating : star <= Math.round(averageRating || 0));
            return (
              <button
                key={star}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRating(resourceId, star);
                }}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                disabled={isRating || !session}
                className={`p-0.5 transition-all disabled:cursor-not-allowed ${isRating ? 'opacity-50' : 'hover:scale-110'
                  }`}
                title={session ? `Rate ${star} star${star > 1 ? 's' : ''}` : 'Sign in to rate'}
              >
                <Star
                  className={`w-4 h-4 transition-colors ${isFilled
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-transparent text-stone-300 dark:text-stone-600'
                    }`}
                />
              </button>
            );
          })}
        </div>

        {/* Rating info */}
        <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
          {averageRating ? (
            <>
              <span className="font-medium text-stone-700 dark:text-stone-300">
                {parseFloat(averageRating).toFixed(1)}
              </span>
              <span>({ratingCount})</span>
            </>
          ) : (
            <span className="italic">No ratings yet</span>
          )}
          {userRating && (
            <span className="text-green-600 dark:text-green-400 ml-1">
              ✓ You: {userRating}★
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!resources || resources.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-stone-300 dark:border-stone-600">
      <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-700">
        <thead className="bg-stone-50 dark:bg-stone-900">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider w-1/3">
              Resource
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Summary
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-stone-800 divide-y divide-stone-200 dark:divide-stone-700">
          {resources.map((resource, idx) => (
            <tr key={resource.id || idx} className="hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors">
              <td className="px-6 py-4">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-3 group"
                >
                  {/* Thumbnail */}
                  <div className="relative w-48 h-32 rounded-md overflow-hidden bg-stone-200 shrink-0">
                    {resource.thumbnail_url ? (
                      <img
                        src={resource.thumbnail_url}
                        alt={resource.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100">
                        <Play className="w-6 h-6 text-stone-400" />
                      </div>
                    )}
                    {resource.duration_seconds && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-white text-[10px] rounded">
                        {formatDuration(resource.duration_seconds)}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 max-w-[12rem]">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100 group-hover:text-[#FF4A1C] dark:group-hover:text-[#FF4A1C] line-clamp-2">
                      {decodeHtmlEntities(resource.title)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 dark:text-stone-400">
                      {getPlatformIcon(resource.platform)}
                      <span>{decodeHtmlEntities(resource.channel_name) || resource.platform}</span>
                    </div>
                    {/* Star Rating */}
                    <StarRating resource={resource} />
                  </div>
                </a>
              </td>
              <td className="px-6 py-4 align-top">
                <div className="text-sm text-stone-600 dark:text-stone-300">
                  {resource.resource_explanation ? (
                    <span>
                      <span className="italic text-[#FF4A1C] dark:text-[#FF4A1C]">Why this helps: </span>
                      {decodeHtmlEntities(resource.resource_explanation)}
                    </span>
                  ) : (
                    decodeHtmlEntities(resource.description) || 'No description available.'
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


// ============================================================================
// STEP BY STEP SOLUTION CARD COMPONENT
// ============================================================================
const StepByStepSolutionCard = ({ solutionApproach, commonMistakes }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!solutionApproach) return null;

  return (
    <div className="bg-white dark:bg-stone-800 rounded-xl border border-stone-300 dark:border-stone-600 shadow-sm overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left py-4 px-4 flex items-start gap-3 cursor-pointer group select-none hover:bg-stone-50/30 dark:hover:bg-stone-800/30 transition-colors"
      >
        <div className="mt-1 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold text-lg text-[#2A2B2A] dark:text-stone-100">
              Step by Step Solution
            </h4>
            {/* Contextual Tag - Right Aligned */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-xs rounded-full font-medium">
                Solve
              </span>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="pl-12 pr-6 pb-8 animate-fade-in">
          <div className={`grid gap-8 ${commonMistakes?.length > 0 ? 'lg:grid-cols-2' : ''}`}>
            {/* Left Column: Solution Steps */}
            <div className="pl-1">
              <h5 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4 opacity-50 uppercase tracking-wider">
                Guide
              </h5>
              <div className="space-y-4">
                {Array.isArray(solutionApproach) ? (
                  solutionApproach.map((step, i) => (
                    <div key={i} className="flex items-start">
                      <div className="flex-1">
                        <p className="text-stone-700 dark:text-stone-200 leading-relaxed">{step}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="whitespace-pre-wrap text-stone-700 dark:text-stone-200 leading-relaxed">{solutionApproach}</div>
                )}
              </div>
            </div>

            {/* Right Column: Common Mistakes */}
            {commonMistakes?.length > 0 && (
              <div className="pl-1 border-l-0 lg:border-l border-stone-200 dark:border-stone-700 lg:pl-8 mt-6 lg:mt-0">
                <h5 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4 opacity-50 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  Common Mistakes
                </h5>
                <div className="space-y-3">
                  {commonMistakes.map((mistake, i) => (
                    <div key={i} className="flex gap-3 text-sm text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-lg border border-stone-100 dark:border-stone-700/50">
                      <span className="text-red-500 font-bold shrink-0">•</span>
                      <span>{mistake}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TOPIC LIST ITEM COMPONENT
// ============================================================================
const TopicListItem = ({
  unit,
  blueprintId,
  classId, // Add classId prop
  currentDocumentId, // Add currentDocumentId prop
  topicResponse,
  topicResources,
  topicEquations,
  topicFigures,
  onComfortSelect,
  onGenerateBlueprint,
  onTriggerWebhook,
  onLoadResourcesToDatabase,
  onGeneratePracticeProblem,
  practiceProblem,
  isGeneratingPractice,
  isSearching,
  isExpanded,
  onToggle,
  session
}) => {
  // Track expanded state for each problem's sections
  // Format: { [`${problemIndex}-hints`]: boolean, [`${problemIndex}-solution`]: boolean }
  const [expandedSections, setExpandedSections] = useState({});

  // Construct query for related material
  const relatedMaterialQuery = `${unit.topic}: ${unit.description}`;

  // Track revealed count for each problem's hints and solution steps
  // Format: { [`${problemIndex}-hints`]: number, [`${problemIndex}-solution`]: number }
  const [revealedCounts, setRevealedCounts] = useState({});

  const [showSearchContext, setShowSearchContext] = useState(false);
  const hasResources = topicResources && topicResources.length > 0;
  const isComfortable = topicResponse?.response === 'comfortable';
  const isWalkthrough = unit.unit_type === 'walkthrough' || unit.unit_type === 'problem';

  // Use equations from database if available, fallback to structure data
  const equations = topicEquations && topicEquations.length > 0
    ? topicEquations
    : unit.equations;

  return (
    <div className={`border-b border-stone-200 dark:border-stone-700 last:border-0 transition-colors ${isExpanded ? 'bg-stone-50/50 dark:bg-stone-800/50' : 'hover:bg-stone-50/30 dark:hover:bg-stone-800/30'}`}>
      <div
        onClick={onToggle}
        className="w-full text-left py-4 px-4 flex items-start gap-3 cursor-pointer group select-none"
      >
        <div className="mt-1 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h4 className={`font-semibold text-lg ${isWalkthrough ? 'text-stone-900 dark:text-stone-100' : 'text-[#2A2B2A] dark:text-stone-100'}`}>
              {unit.topic === 'Similar Worked Example Walkthrough' ? 'Similar Examples' : unit.topic}
            </h4>
            {/* Contextual Tags - Right Aligned */}
            <div className="flex items-center gap-2 shrink-0">
              {isWalkthrough && (
                <span className="px-2 py-0.5 bg-[#FF4A1C]/10 dark:bg-[#FF4A1C]/20 text-[#FF4A1C] dark:text-[#FF4A1C] text-xs rounded-full font-medium">
                  Practice
                </span>
              )}
              {(unit.unit_type === 'topic' || unit.unit_type === 'prerequisite') && (
                <span className="px-2 py-0.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs rounded-full font-medium">
                  Learn
                </span>
              )}
              {isComfortable && !isWalkthrough && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Completed
                </span>
              )}
            </div>
          </div>
          {!isExpanded && (
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">{unit.description}</p>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="pl-12 pr-6 pb-8 animate-fade-in">
          {/* Detailed Description */}
          <p className="text-stone-700 dark:text-stone-300 mb-4 leading-relaxed">
            {unit.description}
          </p>

          {/* Tutor Guidance */}
          {unit.tutor_guidance && (
            <div className={`mb-6 p-4 rounded-lg border bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700`}>
              <div className="flex items-start gap-3">
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${isWalkthrough ? 'text-[#FF4A1C] dark:text-[#FF4A1C]' : 'text-stone-700 dark:text-stone-300'}`}>
                    {isWalkthrough ? 'Walkthrough Strategy' : 'Core overview'}
                  </p>
                  <p className="text-stone-700 dark:text-stone-300 text-m leading-relaxed">
                    {unit.tutor_guidance}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Equations */}
          {equations && equations.length > 0 && (
            <div className="mb-6">
              <EquationDisplay equations={equations} />
            </div>
          )}

          {/* Figures */}
          {topicFigures && topicFigures.length > 0 && (
            <div className="mb-6">
              <FigureDisplay figures={topicFigures} />
            </div>
          )}


          {/* Related Course Material Module - Only show for topic sections, not walkthroughs */}
          {!isWalkthrough && (
            <RelatedMaterialModule
              query={relatedMaterialQuery}
              classId={classId}
              currentDocumentId={currentDocumentId}
            />
          )}

          {/* Action Buttons */}
          {!hasResources && !isComfortable && (
            <>
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateBlueprint(unit, 'youtube');
                    }}
                    disabled={isSearching}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors bg-white dark:bg-stone-800 text-[#FF4A1C] border border-[#FF4A1C] hover:bg-[#FF4A1C]/5 dark:hover:bg-[#FF4A1C]/10`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Youtube className="w-4 h-4" />
                        YouTube API
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateBlueprint(unit, 'haiku');
                    }}
                    disabled={isSearching}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors bg-white dark:bg-stone-800 text-purple-600 dark:text-purple-400 border border-purple-600 dark:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Haiku 4.5
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateBlueprint(unit, 'grok');
                    }}
                    disabled={isSearching}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors bg-white dark:bg-stone-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Grok
                      </>
                    )}
                  </button>

                  {/* Database Search Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateBlueprint(unit, 'database');
                    }}
                    disabled={isSearching}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors bg-white dark:bg-stone-800 text-emerald-600 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4" />
                        Search DB
                      </>
                    )}
                  </button>

                  {/* Webhook Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerWebhook(unit);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 border border-orange-600 dark:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10`}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Activate Webhook
                  </button>

                  {/* Load Resources Database Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoadResourcesToDatabase(unit);
                    }}
                    disabled={isSearching}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors bg-white dark:bg-stone-800 text-cyan-600 dark:text-cyan-400 border border-cyan-600 dark:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/10`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        Load Resources DB
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!isWalkthrough && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onComfortSelect(unit.unit_id, 'comfortable');
                      }}
                      disabled={isSearching}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg 
                               hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium text-sm border border-stone-200 dark:border-stone-700"
                    >
                      <Check className="w-4 h-4" />
                      I know this
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSearchContext(!showSearchContext);
                    }}
                    className={`p-2 rounded-lg transition-colors border ${showSearchContext
                      ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-600'
                      : 'bg-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 border-transparent hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    title="View Search Logic & Queries"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Generated Practice Problem Display */}
              {isWalkthrough && practiceProblem && (
                <div className="space-y-6 mb-6">
                  {/* Handle legacy single object or new array format */}
                  {(Array.isArray(practiceProblem) ? practiceProblem : [practiceProblem]).map((problem, idx) => (
                    <div key={idx} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/50 overflow-hidden animate-scale-in">
                      <div className="p-5">
                        {/* Problem Statement */}
                        <div className="text-stone-800 dark:text-stone-200 text-base leading-relaxed mb-5 font-medium">
                          {problem.practice_problem}
                        </div>

                        {/* Interactive Sections */}
                        <div className="space-y-2">
                          {/* Hints Section - Progressive Reveal */}
                          <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
                            <button
                              onClick={() => {
                                const key = `${idx}-hints`;
                                setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
                                // Initialize reveal count to 1 if not set
                                if (!revealedCounts[key]) {
                                  setRevealedCounts(prev => ({ ...prev, [key]: 1 }));
                                }
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors text-sm font-medium text-stone-600 dark:text-stone-300"
                            >
                              <span className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-stone-400" />
                                Show Hints
                              </span>
                              {expandedSections[`${idx}-hints`] ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                            </button>

                            {expandedSections[`${idx}-hints`] && problem.hints && (
                              <div className="px-4 pb-4 pt-1 border-t border-stone-100 dark:border-stone-700/50">
                                <div className="space-y-3 mt-2">
                                  {problem.hints.slice(0, revealedCounts[`${idx}-hints`] || 1).map((hint, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400 animate-slide-down">
                                      <span className="text-stone-300 mt-1.5 text-[6px] flex-shrink-0">•</span>
                                      <span>{hint}</span>
                                    </div>
                                  ))}

                                  {(revealedCounts[`${idx}-hints`] || 1) < problem.hints.length && (
                                    <button
                                      onClick={() => setRevealedCounts(prev => ({
                                        ...prev,
                                        [`${idx}-hints`]: (prev[`${idx}-hints`] || 1) + 1
                                      }))}
                                      className="text-xs font-medium text-[#FF4A1C] hover:text-[#e03e15] flex items-center gap-1 mt-2 transition-colors ml-3"
                                    >
                                      Reveal Next Hint <ChevronRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Solution & Answer */}
                          <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
                            <button
                              onClick={() => {
                                const key = `${idx}-solution`;
                                setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
                                // Initialize reveal count to 1 if not set
                                if (!revealedCounts[key]) {
                                  setRevealedCounts(prev => ({ ...prev, [key]: 1 }));
                                }
                              }}
                              disabled={problem.solving}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors text-sm font-medium text-stone-600 dark:text-stone-300 disabled:opacity-50"
                            >
                              <span className="flex items-center gap-2">
                                {problem.solving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                    Calculating Solution...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 text-stone-400" />
                                    View Step-by-Step Solution
                                  </>
                                )}
                              </span>
                              {!problem.solving && (expandedSections[`${idx}-solution`] ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />)}
                            </button>

                            {expandedSections[`${idx}-solution`] && !problem.solving && problem.solution_steps && (
                              <div className="px-4 pb-4 pt-1 border-t border-stone-100 dark:border-stone-700/50">
                                {/* Solution Steps */}
                                <div className="mt-3 space-y-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Step-by-Step Solution:</p>
                                  {problem.solution_steps.slice(0, revealedCounts[`${idx}-solution`] || 1).map((step, i) => (
                                    <div key={i} className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed pl-3 border-l-2 border-stone-200 dark:border-stone-700 animate-slide-down">
                                      <span className="font-semibold text-stone-500 text-xs uppercase tracking-wider mb-1 block">Step {i + 1}</span>
                                      {step}
                                    </div>
                                  ))}

                                  {(revealedCounts[`${idx}-solution`] || 1) < problem.solution_steps.length && (
                                    <button
                                      onClick={() => setRevealedCounts(prev => ({
                                        ...prev,
                                        [`${idx}-solution`]: (prev[`${idx}-solution`] || 1) + 1
                                      }))}
                                      className="w-full py-2 bg-stone-100 dark:bg-stone-700/50 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
                                    >
                                      Reveal Step {(revealedCounts[`${idx}-solution`] || 1) + 1} <ChevronDown className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>


                              </div>
                            )}
                          </div>

                          {/* Final Answer Section - Independent */}
                          <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
                            <button
                              onClick={() => {
                                const key = `${idx}-answer`;
                                setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
                              }}
                              disabled={problem.solving}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors text-sm font-medium text-stone-600 dark:text-stone-300 disabled:opacity-50"
                            >
                              <span className="flex items-center gap-2">
                                {problem.solving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                    Calculating Answer...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 text-stone-400" />
                                    View Answer
                                  </>
                                )}
                              </span>
                              {!problem.solving && (expandedSections[`${idx}-answer`] ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />)}
                            </button>

                            {expandedSections[`${idx}-answer`] && !problem.solving && problem.final_answer && (
                              <div className="px-4 pb-4 pt-1 border-t border-stone-100 dark:border-stone-700/50">
                                <div className="mt-2 text-lg font-mono font-semibold text-stone-800 dark:text-stone-200 bg-stone-50 dark:bg-stone-900/50 p-3 rounded-lg border border-stone-200 dark:border-stone-700 inline-block">
                                  {problem.final_answer}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Practice Problem Button - Always visible for walkthroughs */}
              {isWalkthrough && (
                <div className="mb-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGeneratePracticeProblem(unit);
                    }}
                    disabled={isGeneratingPractice}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-stone-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-stone-700 dark:text-stone-200 rounded-lg font-medium text-sm transition-all disabled:opacity-50 border border-[#FF4A1C]"
                  >
                    {isGeneratingPractice ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
                        Generating Practice Problem...
                      </>
                    ) : (
                      <>
                        {practiceProblem ? 'Generate Another Problem' : 'Generate a Practice Problem'}
                      </>
                    )}
                  </button>

                </div>
              )}

              {showSearchContext && (
                <div className="mb-6 p-5 rounded-xl bg-stone-100 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 text-sm animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Target className="w-32 h-32" />
                  </div>

                  <h5 className="font-semibold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#FF4A1C]" />
                    Search Intelligence Logic
                  </h5>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                          Generated Search Queries
                        </span>
                        <div className="bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 p-3">
                          {unit.search_queries && unit.search_queries.length > 0 ? (
                            <ul className="space-y-2">
                              {unit.search_queries.map((q, i) => (
                                <li key={i} className="flex items-start gap-2 text-stone-600 dark:text-stone-300 font-mono text-xs">
                                  <span className="text-stone-400 select-none">{'>'}</span>
                                  {q}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-stone-400 italic text-xs">
                              No specific queries pre-generated. The search will use the topic and description.
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                          Context Payload
                        </span>
                        <div className="bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 p-3 space-y-3">
                          <div>
                            <span className="text-xs text-stone-400 block mb-0.5">Topic Target</span>
                            <p className="text-stone-700 dark:text-stone-300 font-medium">{unit.topic}</p>
                          </div>
                          {unit.learning_objective && (
                            <div>
                              <span className="text-xs text-stone-400 block mb-0.5">Learning Objective</span>
                              <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-xs">
                                {unit.learning_objective}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                          Search Mechanism Logic
                        </span>
                        <div className="space-y-3">
                          <div className="flex gap-3 p-3 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                            <div className="shrink-0 pt-0.5">
                              <Youtube className="w-4 h-4 text-red-500" />
                            </div>
                            <div>
                              <h6 className="font-medium text-stone-900 dark:text-stone-100 text-xs mb-1">YouTube Data API</h6>
                              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                                Executes the exact search queries generated above against the YouTube Data API. Results are filtered for duration and relevance.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3 p-3 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                            <div className="shrink-0 pt-0.5">
                              <Sparkles className="w-4 h-4 text-purple-500" />
                            </div>
                            <div>
                              <h6 className="font-medium text-stone-900 dark:text-stone-100 text-xs mb-1">Haiku 4.5 / Grok Analysis</h6>
                              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                                Constructs a prompt containing the Topic, Learning Objective, and Search Queries. The LLM acts as a research assistant to find, validate, and summarize high-quality web resources that match the specific educational context.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step by Step Solution removed - now rendered as a standalone section outside TopicListItem */}

          {/* Resources Table */}
          {hasResources && (
            <div className="mt-4">
              <h5 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isWalkthrough ? 'text-[#FF4A1C] dark:text-[#FF4A1C]' : 'text-stone-700 dark:text-stone-300'}`}>
                <Play className={`w-4 h-4 ${isWalkthrough ? 'text-[#FF4A1C] dark:text-[#FF4A1C]' : 'text-[#FF4A1C]'}`} />
                {isWalkthrough ? 'Similar Examples' : 'Recommended Resources'}
              </h5>
              <ResourceTable resources={topicResources} session={session} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SKELETON LOADING COMPONENT
// ============================================================================
const BlueprintSkeleton = () => {
  return (
    <div className="min-h-screen bg-transparent text-outline relative animate-pulse">
      {/* Sidebars */}
      <div className="fixed top-20 left-0 h-[calc(100vh-80px)] z-30 hidden lg:block w-20 bg-stone-100 dark:bg-stone-900/50 border-r border-stone-200 dark:border-stone-800" />
      <div className="fixed top-20 left-20 h-[calc(100vh-80px)] z-20 hidden lg:block w-56 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
        <div className="p-6 space-y-6">
          <div className="h-6 w-32 bg-stone-200 dark:bg-stone-800 rounded" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-stone-100 dark:bg-stone-800/50 rounded" />
            <div className="h-4 w-3/4 bg-stone-100 dark:bg-stone-800/50 rounded" />
            <div className="h-4 w-5/6 bg-stone-100 dark:bg-stone-800/50 rounded" />
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:ml-[304px] transition-all duration-300 ease-in-out">
        {/* Sticky Header */}
        <div className="sticky top-20 z-50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md">
          <div className="py-6">
            <div className="px-6 lg:px-12 max-w-7xl mx-auto">
              <div className="mb-6">
                {/* Back Button */}
                <div className="h-4 w-24 bg-stone-200 dark:bg-stone-800 rounded mb-3" />

                {/* Title */}
                <div className="h-10 w-2/3 bg-stone-200 dark:bg-stone-800 rounded mb-2" />

                {/* Class Name */}
                <div className="h-6 w-1/3 bg-stone-100 dark:bg-stone-800/50 rounded" />

                {/* Tabs */}
                <div className="mt-5 flex gap-2 overflow-hidden">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-8 w-24 bg-stone-200 dark:bg-stone-800 rounded-md shrink-0" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-6 lg:px-12 pb-20 max-w-7xl mx-auto space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="h-6 w-6 bg-stone-200 dark:bg-stone-800 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-1/3 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="h-3 w-1/2 bg-stone-100 dark:bg-stone-800/50 rounded" />
                </div>
                <div className="h-8 w-8 bg-stone-200 dark:bg-stone-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN BLUEPRINT COMPONENT
// ============================================================================

const Blueprint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, session } = useAuth();

  // Sticky Header State
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

          // Adjust threshold based on current state to account for height difference
          // Height changes: mb-6->0 (24px) + mb-3->0 (12px) + title shrink (~36px) + 
          // class name hidden (40px) + tabs section hidden (~60px) = ~172px total

          setIsScrolled(prev => {
            if (prev) {
              // Currently COMPACT: strict stickiness. Only expand if we hit the absolute top.
              // This prevents the "scroll anchoring" jump from triggering a re-expand.
              return scrollPosition > 0;
            } else {
              // Currently EXPANDED: Collapse threshold.
              // Must strictly exceed the heavy layout shift (~175px) to prevent a loop.
              return scrollPosition > 100;
            }
          });

          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial check
    handleScroll();

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Disable scroll anchoring to prevent loop when header shrinks
    const originalOverflowAnchor = document.body.style.overflowAnchor;
    document.body.style.overflowAnchor = 'none';

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.body.style.overflowAnchor = originalOverflowAnchor;
    };
  }, []);

  // Data State
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [learningStructure, setLearningStructure] = useState(null);
  const [topicResponses, setTopicResponses] = useState({});
  const [topicResources, setTopicResources] = useState({});
  const [topicEquations, setTopicEquations] = useState({});
  const [topicFigures, setTopicFigures] = useState({});
  const [practiceProblems, setPracticeProblems] = useState({}); // { unitId: { problem, hints, answer } }

  // Track resources that are currently being loaded to prevent overwrites
  const loadingResourcesRef = useRef(new Set());
  const [generatingPractice, setGeneratingPractice] = useState(new Set()); // Set of unitIds

  // UI State
  const [activeTab, setActiveTab] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [showInputPopover, setShowInputPopover] = useState(false);

  // Generation State
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('pending');
  const [generationError, setGenerationError] = useState(null);
  const [searchingTopics, setSearchingTopics] = useState(new Set());

  // Handle Practice Problem Generation (With Caching & Multi-Model Verification)
  const handleGeneratePracticeProblem = async (unit) => {
    if (!session?.access_token) return;
    const unitId = unit.unit_id;

    setGeneratingPractice(prev => new Set([...prev, unitId]));

    try {
      console.log(`[Blueprint] Generating verified practice problem for unit ${unitId}...`);

      // Get problem context from document analysis if available
      let originalProblem = null;
      const sections = documentAnalysis?.raw_analysis?.sections || [];

      // Find the parent section of this unit
      let struct = learningStructure?.structure;
      if (struct?.learning_structure) struct = struct.learning_structure;

      const currentSection = struct?.content_sections?.find(s =>
        s.learning_units?.some(u => u.unit_id === unitId)
      );

      if (currentSection) {
        const analysisSection = sections.find(s =>
          s.section_id === currentSection.section_id ||
          s.section_id === currentSection.section_id.replace('_walkthroughs', '')
        );
        if (analysisSection && analysisSection.problem_statement) {
          originalProblem = analysisSection.problem_statement;
        }
      }

      if (!originalProblem) {
        originalProblem = unit.target_resource_profile || unit.description || unit.topic;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Call the new verification endpoint (handles cache check + multi-model verification)
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-practice-problem`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: unit.topic,
          original_problem: originalProblem,
          unit_id: unitId,
          blueprint_id: id,
          context: {
            learning_objective: unit.learning_objective,
            unit_type: unit.unit_type,
            description: unit.description
          }
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate practice problem');
      }

      // Log cache/verification status
      if (data.from_cache) {
        console.log('[Blueprint] ✅ Used cached verified problem');
      } else if (data.verified) {
        console.log('[Blueprint] ✅ New problem verified by multiple models:', data.verification?.models_agreed);
      } else {
        console.warn('[Blueprint] ⚠️ Problem generated but not fully verified');
      }

      // Add problem to state
      setPracticeProblems(prev => {
        const existingProblems = prev[unitId] || [];
        const currentList = Array.isArray(existingProblems) ? existingProblems : [existingProblems];

        return {
          ...prev,
          [unitId]: [...currentList, { ...data.problem, solving: false }]
        };
      });

    } catch (error) {
      console.error('[Blueprint] Error in practice problem generation:', error);
      alert(`Failed to generate practice problem: ${error.message}`);
    } finally {
      setGeneratingPractice(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
    }
  };

  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [structureGenerationResult, setStructureGenerationResult] = useState(null);

  // Progress Panel State
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const [isGeneratingWithProgress, setIsGeneratingWithProgress] = useState(false);

  // Chat State
  const { chatState, setChatOpen } = useUiState();
  const isChatOpen = chatState.isOpen;
  const setIsChatOpen = setChatOpen; // Convenience alias

  // Dev Mode State - Automated pipeline for development/testing
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [devModeStep, setDevModeStep] = useState('idle'); // 'idle' | 'analyzing' | 'generating' | 'webhooks' | 'waiting' | 'searching' | 'complete' | 'error'
  const [devModeProgress, setDevModeProgress] = useState({
    countdown: 0,
    totalUnits: 0,
    webhooksTriggered: 0,
    unitsSearched: 0,
    message: '',
  });
  const devModeTimerRef = useRef(null);

  // Fetch blueprint data
  const fetchBlueprint = useCallback(async () => {
    try {
      // 1. Fetch main Blueprint data first
      const { data: bp, error: bpError } = await supabase
        .from('blueprints')
        .select(`
          *,
          class:classes(id, name, professor)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (bpError) throw bpError;

      // Update access time immediately
      supabase.from('blueprints')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('id', id)
        .then(() => { }); // Fire and forget

      setBlueprint(bp);
      setGenerationStatus(bp.generation_status || 'pending');
      setGenerationError(bp.generation_error);

      // 2. Prepare Parallel Fetches
      const promises = [];

      // A. Document Fetch (if linked)
      if (bp.document_id) {
        promises.push(
          supabase
            .from('class_documents')
            .select('*')
            .eq('id', bp.document_id)
            .single()
            .then(({ data }) => ({ type: 'document', data }))
            .catch(err => ({ type: 'document', error: err }))
        );
      }

      // B. Structure Fetch
      promises.push(
        supabase
          .from('blueprint_structures')
          .select('*')
          .eq('blueprint_id', id)
          .maybeSingle()
          .then(({ data }) => ({ type: 'structure', data }))
      );

      // C. Document Analysis
      // Try by document_id first if available, else blueprint_id
      if (bp.document_id) {
        promises.push(
          supabase
            .from('document_analyses')
            .select('*')
            .eq('document_id', bp.document_id)
            .maybeSingle()
            .then(({ data }) => ({ type: 'analysis_doc', data }))
        );
      }
      // Always fetch by blueprint_id as backup or primary
      promises.push(
        supabase
          .from('document_analyses')
          .select('*')
          .eq('blueprint_id', id)
          .maybeSingle()
          .then(({ data }) => ({ type: 'analysis_bp', data }))
      );

      // D. Topic Responses
      promises.push(
        supabase
          .from('topic_responses')
          .select('*')
          .eq('blueprint_id', id)
          .eq('user_id', user.id)
          .then(({ data }) => ({ type: 'responses', data }))
      );

      // E. Resources
      promises.push(
        supabase
          .from('blueprint_topic_resources')
          .select(`*, resources_from_make (*)`)
          .eq('blueprint_id', id)
          .then(({ data }) => ({ type: 'resources', data }))
      );

      // F. Equations
      promises.push(
        supabase
          .from('blueprint_unit_equations')
          .select(`*, curated_equations (*)`)
          .eq('blueprint_id', id)
          .order('display_index', { ascending: true })
          .then(({ data }) => ({ type: 'equations', data }))
      );

      // G. Figures
      promises.push(
        supabase
          .from('blueprint_unit_figures')
          .select(`*, curated_figures (*)`)
          .eq('blueprint_id', id)
          .order('display_index', { ascending: true })
          .then(({ data }) => ({ type: 'figures', data }))
      );

      // H. Practice Problems (from cache link table)
      promises.push(
        supabase
          .from('blueprint_practice_problems')
          .select(`
            unit_id,
            cached_problem:practice_problems_cache(
              problem_statement,
              given_values,
              hints,
              solution_steps,
              final_answer
            )
          `)
          .eq('blueprint_id', id)
          .order('created_at', { ascending: true })
          .then(({ data }) => ({ type: 'practice_problems', data }))
      );

      // 3. Execute Parallel Fetches
      const results = await Promise.all(promises);

      // 4. Process Results
      let docData = null;
      let structureData = null;
      let analysisData = null;

      // Helper to extract data from results array
      const getResult = (type) => results.find(r => r && r.type === type)?.data;

      // Process Document
      docData = getResult('document');
      if (docData) {
        setBlueprint(prev => ({ ...prev, document: docData }));
      }

      // Process Structure
      structureData = getResult('structure');
      if (structureData) {
        setLearningStructure(structureData);
        setStructureGenerationResult({
          success: true,
          structure_id: structureData.id,
          structure: structureData.structure_data || structureData.structure,
          metrics: {
            total_prerequisites: structureData.total_prerequisites,
            total_sections: structureData.total_sections,
            total_learning_units: structureData.total_learning_units,
            total_search_queries: structureData.total_search_queries,
          },
          created_at: structureData.created_at,
          from_cache: structureData.from_cache || false,
          model_used: structureData.model_used || 'claude-haiku-4-5',
        });
      }

      // Process Analysis (Prioritize document_id match)
      const analysisDoc = getResult('analysis_doc');
      const analysisBp = getResult('analysis_bp');
      analysisData = analysisDoc || analysisBp;

      if (analysisData) {
        setDocumentAnalysis({
          success: true,
          analysis_id: analysisData.id,
          document_id: analysisData.document_id,
          document_type: analysisData.raw_analysis?.document_type,
          subject_area: analysisData.raw_analysis?.subject_area,
          raw_analysis: analysisData.raw_analysis,
          analyzed_at: analysisData.created_at,
          source: analysisData.document_id ? 'document_id' : 'blueprint_id',
        });
      }

      // Process Responses
      const responsesData = getResult('responses');
      if (responsesData) {
        const responsesMap = {};
        responsesData.forEach(r => responsesMap[r.unit_id] = r);
        setTopicResponses(responsesMap);
      }

      // Process Resources
      const resourcesData = getResult('resources');
      if (resourcesData) {
        const resourcesMap = {};
        let count = 0;

        resourcesData.forEach(r => {
          if (!resourcesMap[r.unit_id]) resourcesMap[r.unit_id] = [];
          if (r.resources_from_make) {
            const explanation = r.resource_explanation?.toLowerCase() || '';
            const isExplicitlyIrrelevant =
              explanation === 'not_relevant' ||
              explanation.includes('does not contain relevant content') ||
              explanation.includes('not actually relevant to');

            if (!isExplicitlyIrrelevant) {
              resourcesMap[r.unit_id].push({
                ...r.resources_from_make,
                relevance_score: r.relevance_score,
                from_cache: r.from_cache,
                resource_explanation: r.resource_explanation,
              });
              count++;
            }
          }
        });

        console.log(`[Blueprint] Loaded ${count} resources in parallel`);

        // Intelligent Merge: Don't overwrite what might be loading
        setTopicResources(prev => {
          const updated = { ...prev };
          for (const [unitId, resources] of Object.entries(resourcesMap)) {
            if (!loadingResourcesRef.current.has(unitId)) {
              updated[unitId] = resources;
            }
          }
          return updated;
        });
      }

      // Process Equations
      const equationsData = getResult('equations');
      if (equationsData) {
        const equationsMap = {};
        equationsData.forEach(e => {
          if (!equationsMap[e.unit_id]) equationsMap[e.unit_id] = [];
          if (e.curated_equations) {
            equationsMap[e.unit_id].push({
              ...e.curated_equations,
              index: e.display_index
            });
          }
        });
        setTopicEquations(equationsMap);
      }

      // Process Figures
      const figuresData = getResult('figures');
      if (figuresData) {
        const figuresMap = {};
        figuresData.forEach(f => {
          if (!figuresMap[f.unit_id]) figuresMap[f.unit_id] = [];
          if (f.curated_figures) {
            figuresMap[f.unit_id].push({
              ...f.curated_figures,
              relevance_explanation: f.relevance_explanation,
              from_cache: f.from_cache,
            });
          }
        });
        setTopicFigures(figuresMap);
      }

      // Process Practice Problems (from cache)
      const practiceData = getResult('practice_problems');
      if (practiceData && practiceData.length > 0) {
        const problemsMap = {};
        let count = 0;
        practiceData.forEach(p => {
          if (p.cached_problem) {
            if (!problemsMap[p.unit_id]) problemsMap[p.unit_id] = [];
            problemsMap[p.unit_id].push({
              practice_problem: p.cached_problem.problem_statement,
              given_values: p.cached_problem.given_values,
              hints: p.cached_problem.hints,
              solution_steps: p.cached_problem.solution_steps,
              final_answer: p.cached_problem.final_answer,
              solving: false
            });
            count++;
          }
        });
        console.log(`[Blueprint] Loaded ${count} practice problems from cache`);
        setPracticeProblems(problemsMap);
      }

    } catch (error) {
      console.error('Error fetching blueprint:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, navigate]);

  useEffect(() => {
    if (user && id) fetchBlueprint();
  }, [user, id, fetchBlueprint]);

  // Reset state when blueprint ID changes
  useEffect(() => {
    // UI State
    setActiveTab(null);
    setExpandedTopics({});
    setIsScrolled(false);

    // Data State
    setBlueprint(null);
    setLoading(true);
    setLearningStructure(null);
    setTopicResponses({});
    setTopicResources({});
    setTopicEquations({});
    setTopicFigures({});

    // Debug & Analysis State
    setDocumentAnalysis(null);
    setStructureGenerationResult(null); // Clear previous structure debug info

    // Generation State
    setGenerationStatus('pending');
    setGenerationError(null);
    setSearchingTopics(new Set());

    // Refs
    loadingResourcesRef.current = new Set();
  }, [id]);

  // Set initial active tab when structure loads
  useEffect(() => {
    console.log('[Blueprint] Tab initialization effect triggered');
    console.log('[Blueprint]   - Has learningStructure:', !!learningStructure);
    console.log('[Blueprint]   - Has structure:', !!learningStructure?.structure);
    console.log('[Blueprint]   - Current activeTab:', activeTab);

    if (learningStructure?.structure) {
      const struct = learningStructure.structure;
      console.log('[Blueprint] Structure details:', {
        has_prerequisites: !!struct.prerequisites_section,
        prereq_unit_count: struct.prerequisites_section?.learning_units?.length || 0,
        has_content_sections: !!struct.content_sections,
        content_section_count: struct.content_sections?.length || 0,
        structure_keys: Object.keys(struct)
      });

      // Log full structure to console for inspection
      console.log('[Blueprint] Full structure object:', struct);
    }

    if (learningStructure?.structure && !activeTab) {
      if (learningStructure.structure.prerequisites_section?.learning_units?.length > 0) {
        console.log('[Blueprint] Setting activeTab to prerequisites');
        setActiveTab('prerequisites');
      } else if (learningStructure.structure.content_sections?.length > 0) {
        const firstSectionId = learningStructure.structure.content_sections[0].section_id || 'section-0';
        console.log('[Blueprint] Setting activeTab to first section:', firstSectionId);
        setActiveTab(firstSectionId);
      } else {
        console.log('[Blueprint] ❌ No sections found to set as active tab');
        console.log('[Blueprint] This means content_sections is empty or missing');
      }
    }
  }, [learningStructure, activeTab]);

  // Handle comfort selection
  const handleComfortSelect = async (unitId, response) => {
    try {
      const { error } = await supabase.from('topic_responses').upsert({
        blueprint_id: id,
        unit_id: unitId,
        user_id: user.id,
        response: response,
      }, { onConflict: 'blueprint_id,unit_id' });

      if (error) throw error;

      setTopicResponses(prev => ({
        ...prev,
        [unitId]: { unit_id: unitId, response },
      }));
    } catch (error) {
      console.error('Error saving comfort response:', error);
    }
  };

  // Handle webhook trigger
  const handleTriggerWebhook = async (unit) => {
    if (!session?.access_token) return;

    try {
      // Find parent section to get its metadata
      let section = null;
      let struct = learningStructure?.structure;
      if (struct?.learning_structure) struct = struct.learning_structure;
      let isPrereq = false;

      if (struct) {
        if (struct.content_sections) {
          section = struct.content_sections.find(s => s.learning_units?.some(u => u.unit_id === unit.unit_id));
        }
        if (!section && struct.prerequisites_section?.learning_units?.some(u => u.unit_id === unit.unit_id)) {
          section = struct.prerequisites_section;
          isPrereq = true;
        }
      }

      const webhookUrl = 'https://hook.us2.make.com/4biukvihdmvo4aianlpqk5sbnewjbonh';

      // Match the format used in triggerAllWebhooks (Developer Mode)
      // Wrap the single unit in an array
      const unitPayload = {
        unit_id: unit.unit_id,
        topic: unit.topic,
        description: unit.description,
        topic_description: unit.description,
        learning_objective: unit.learning_objective,
        target_resource_profile: unit.target_resource_profile || unit.ideal_video_description || unit.semantic_search_phrase || `Video tutorial explaining ${unit.topic}: ${unit.description || ''}`,
        search_queries: unit.search_queries || []
      };

      const payload = {
        section_title: section?.title || 'Single Unit Trigger',
        section_learning_objective: section?.learning_objective || '',
        section_description: section?.description || '',
        is_prerequisite: isPrereq,
        units: [unitPayload],
        blueprint_id: id,
        user_id: user.id,
        triggered_at: new Date().toISOString()
      };

      console.log('[Blueprint] Triggering manual webhook for unit (as array of 1):', unit.topic);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Try to parse partial results or cache hits if returned
        try {
          const data = await response.json();

          // Handle immediate cache hit if the webhook returns it
          if (data && data.found && data.resource) {
            console.log('[Blueprint] Resource found via webhook!');

            const resource = {
              ...data.resource,
              from_cache: true
            };

            setTopicResources(prev => {
              const existing = prev[unit.unit_id] || [];
              if (existing.some(r => r.url === resource.url)) return prev;
              return {
                ...prev,
                [unit.unit_id]: [...existing, resource]
              };
            });
            alert('Success! Found a cached resource immediately.');
          } else {
            alert('Webhook triggered successfully! Analysis is running in background.');
          }
        } catch (e) {
          // Response was OK but not JSON (likely "Accepted" string)
          console.log('[Blueprint] Webhook accepted (non-JSON response).');
          alert('Webhook triggered successfully! Analysis is running in background.');
        }
      } else {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

    } catch (error) {
      console.error('Error triggering webhook:', error);
      alert('Failed to trigger webhook. Please try again.');
    }
  };

  // Trigger webhooks for ALL units in parallel (Dev Mode)
  // UPDATED: Now batches webhooks by section to reduce rate limits
  const triggerAllWebhooks = async (allUnits, structureContext = null) => {
    if (!session?.access_token || !allUnits || allUnits.length === 0) return;

    console.log(`[Blueprint] Dev Mode: Triggering batched webhooks...`);

    // Use passed structure or fallback to state
    let struct = structureContext;
    if (!struct && learningStructure?.structure) {
      struct = learningStructure.structure;
    }
    if (struct?.learning_structure) struct = struct.learning_structure;

    const webhookUrl = 'https://hook.us2.make.com/4biukvihdmvo4aianlpqk5sbnewjbonh';
    let triggeredCount = 0;

    // Prepare batched payloads by section
    const sectionPayloads = [];

    // Helper to get section ID consistently
    const getSectionId = (section) => section?.section_id || section?.title || 'unknown';

    // 1. Process Prerequisites Section
    if (struct?.prerequisites_section?.learning_units?.length > 0) {
      const prereqSection = struct.prerequisites_section;
      const prereqUnits = prereqSection.learning_units;

      const unitsPayload = prereqUnits.map(unit => ({
        unit_id: unit.unit_id,
        topic: unit.topic,
        description: unit.description,
        topic_description: unit.description,
        learning_objective: unit.learning_objective,
        target_resource_profile: unit.target_resource_profile || unit.ideal_video_description || unit.semantic_search_phrase || `Video tutorial explaining ${unit.topic}: ${unit.description || ''}`,
        search_queries: unit.search_queries || []
      }));

      sectionPayloads.push({
        section_title: prereqSection.title || 'Prerequisites',
        section_learning_objective: prereqSection.learning_objective || '',
        section_description: prereqSection.description || '',
        is_prerequisite: true,
        units: unitsPayload,
        blueprint_id: id,
        user_id: user.id,
        triggered_at: new Date().toISOString()
      });
    }

    // 2. Process Content Sections
    if (struct?.content_sections?.length > 0) {
      struct.content_sections.forEach(section => {
        if (section.learning_units?.length > 0) {
          const unitsPayload = section.learning_units.map(unit => ({
            unit_id: unit.unit_id,
            topic: unit.topic,
            description: unit.description,
            topic_description: unit.description,
            learning_objective: unit.learning_objective,
            target_resource_profile: unit.target_resource_profile || unit.ideal_video_description || unit.semantic_search_phrase || `Video tutorial explaining ${unit.topic}: ${unit.description || ''}`,
            search_queries: unit.search_queries || []
          }));

          sectionPayloads.push({
            section_title: section.title || 'Untitled Section',
            section_learning_objective: section.learning_objective || '',
            section_description: section.description || '',
            is_prerequisite: false,
            units: unitsPayload,
            blueprint_id: id,
            user_id: user.id,
            triggered_at: new Date().toISOString()
          });
        }
      });
    }

    console.log(`[Blueprint] Dev Mode: Prepared ${sectionPayloads.length} section payloads for webhook batching.`);

    // 3. Send Webhooks (One per Section)
    const allPromises = sectionPayloads.map(payload =>
      (async () => {
        try {
          console.log(`[Blueprint] Sending webhook for section: "${payload.section_title}" with ${payload.units.length} units`);

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            triggeredCount++;
            setDevModeProgress(prev => ({ ...prev, webhooksTriggered: triggeredCount }));

            const responseText = await response.text();
            if (responseText === 'Accepted') return;

            try {
              const data = JSON.parse(responseText);
              // Handle batch response
              if (data.results && Array.isArray(data.results)) {
                console.log(`[Blueprint] Received batch results for section: "${payload.section_title}"`);

                // Iterate through results and update resources
                data.results.forEach(result => {
                  if (result.found && result.resource && result.unit_id) {
                    const resource = {
                      ...result.resource,
                      from_cache: true
                    };

                    setTopicResources(prev => {
                      const existing = prev[result.unit_id] || [];
                      if (existing.some(r => r.url === resource.url)) return prev;
                      return {
                        ...prev,
                        [result.unit_id]: [...existing, resource]
                      };
                    });
                  }
                });
              }
            } catch (e) {
              // Ignore non-JSON response
            }
          } else {
            console.error(`[Blueprint] Webhook failed for section "${payload.section_title}": ${response.status}`);
          }
        } catch (err) {
          console.error('[Blueprint] Dev Mode: Webhook error', err);
        }
      })()
    );

    // Execute all section webhooks in parallel
    await Promise.all(allPromises);

    console.log(`[Blueprint] Dev Mode: All ${triggeredCount} section webhooks triggered successfully`);
    return triggeredCount;
  };

  // Handle Load Resources to Database
  const handleLoadResourcesToDatabase = async (unit) => {
    if (!session?.access_token) return;
    const unitId = unit.unit_id;

    // Mark this unit as currently loading
    setSearchingTopics(prev => new Set([...prev, unitId]));

    try {
      console.log(`[Blueprint] Loading resources to database for unit ${unitId}...`);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/load-resources-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unit_id: unitId,
          topic: unit.topic,
          search_queries: unit.search_queries || [],
          blueprint_id: id,
          description: unit.description,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load resources to database');
      }

      console.log('[Blueprint] Resources loaded successfully:', data.summary);

      // Show success message with summary
      const { total, successful, failed } = data.summary;
      alert(
        `✅ Resource loading complete!\n\n` +
        `Total videos processed: ${total}\n` +
        `Successfully loaded: ${successful}\n` +
        `Failed: ${failed}\n\n` +
        `Resources are now available in the database. Click "Search DB" to find them!`
      );

    } catch (error) {
      console.error('[Blueprint] Error loading resources to database:', error);
      alert(`Failed to load resources to database: ${error.message}\n\nPlease try again or check the console for details.`);
    } finally {
      setSearchingTopics(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
    }
  };

  // Handle generation
  const handleGenerateBlueprint = async (unit, searchMethod = 'youtube') => {
    if (!session?.access_token) return;
    const unitId = unit.unit_id;

    // Mark this unit as currently loading to prevent overwrites
    loadingResourcesRef.current.add(unitId);
    setSearchingTopics(prev => new Set([...prev, unitId]));

    try {
      let foundResources = [];

      if (searchMethod === 'database') {
        console.log(`[Blueprint] Searching database for unit ${unitId}...`);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const targetResourceProfile = unit.target_resource_profile;

        const response = await fetch(`${supabaseUrl}/functions/v1/search-resources-database`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            unit_id: unitId,
            topic: unit.topic,
            target_resource_profile: targetResourceProfile,
            blueprint_id: id
          }),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Database search failed');

        foundResources = data.resources || [];

        // After successfully finding resources from the database,
        // trigger the AI explanation generation for context
        if (foundResources.length > 0) {
          console.log(`[Blueprint] Generating explanations for ${foundResources.length} database resources...`);

          try {
            // Trigger explanation generation (non-blocking for UI, but updates in background)
            // We use a separate function call to keep the search fast
            const explanationResponse = await fetch(`${supabaseUrl}/functions/v1/generate-resource-explanation`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                resources: foundResources,
                topic: unit.topic,
                description: unit.description,
                learning_objective: unit.learning_objective,
                blueprint_id: id,
                unit_id: unitId
              }),
            });

            const explanationData = await explanationResponse.json();
            if (explanationData.success && explanationData.resources) {
              console.log('[Blueprint] Explanations generated successfully');
              // Update the resources with the new explanations
              foundResources = explanationData.resources;
            }
          } catch (explanationError) {
            console.error('[Blueprint] Error generating explanations:', explanationError);
            // We continue with the original resources if explanation generation fails
          }
        }
      } else {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        // Determine endpoint based on unit_type and search method
        // walkthrough units should use search-problem-walkthroughs endpoint
        const isWalkthrough = unit.unit_type === 'walkthrough';
        let endpoint = '';

        if (isWalkthrough) {
          endpoint = 'search-problem-walkthroughs';
        } else if (searchMethod === 'haiku') {
          endpoint = 'search-resources-haiku';
        } else if (searchMethod === 'grok') {
          endpoint = 'search-resources-grok';
        } else {
          endpoint = 'search-resources';
        }

        // For walkthrough units, try to get the problem statement from the document analysis
        let problemStatement = null;
        if (isWalkthrough && documentAnalysis?.raw_analysis) {
          // Find the problem statement from the document analysis
          // The unit should be part of a content_section, so we need to find the matching section
          const sections = documentAnalysis.raw_analysis.sections || [];

          // Try to find a matching section by looking at the current active section
          const currentSection = structure?.content_sections?.find(s =>
            s.learning_units?.some(u => u.unit_id === unitId)
          );

          if (currentSection && currentSection.section_id) {
            // Find the corresponding section in the raw analysis
            const analysisSection = sections.find(s =>
              s.section_id === currentSection.section_id ||
              s.section_id === currentSection.section_id.replace('_walkthroughs', '')
            );

            if (analysisSection && analysisSection.problem_statement) {
              problemStatement = analysisSection.problem_statement;
              console.log('[Blueprint] Found problem statement for walkthrough unit:', problemStatement.substring(0, 100));
            }
          }
        }

        // NEW: Get the pre-computed target resource embedding from the unit
        // This avoids redundant embedding generation during search
        const targetResourceEmbedding = unit.target_resource_embedding;
        const targetResourceProfile = unit.target_resource_profile;

        if (targetResourceEmbedding && Array.isArray(targetResourceEmbedding) && targetResourceEmbedding.length === 1536) {
          console.log(`[Blueprint] ✅ Using pre-computed target resource embedding for unit ${unitId} (${targetResourceEmbedding.length} dimensions)`);
        } else {
          console.log(`[Blueprint] ⚠️ No pre-computed target resource embedding found for unit ${unitId}, will generate on-demand`);
        }

        const requestBody = isWalkthrough ? {
          blueprint_id: id,
          unit_id: unitId,
          topic: unit.topic,
          description: unit.description,
          learning_objective: unit.learning_objective,
          problem_statement: problemStatement, // Include the actual problem text
          problem_solving_queries: unit.search_queries || [], // For walkthrough units, search_queries contain the problem-solving queries
          problem_details: unit.problem_details || {},
          semantic_search_phrase: unit.semantic_search_phrase,
          target_resource_profile: targetResourceProfile, // NEW: Pass target resource profile
          target_resource_embedding: targetResourceEmbedding, // NEW: Pass pre-computed embedding
        } : {
          blueprint_id: id,
          unit_id: unitId,
          topic: unit.topic,
          description: unit.description,
          learning_objective: unit.learning_objective,
          search_queries: unit.search_queries || [],
          semantic_search_phrase: unit.semantic_search_phrase,
          target_resource_profile: targetResourceProfile, // NEW: Pass target resource profile
          target_resource_embedding: targetResourceEmbedding, // NEW: Pass pre-computed embedding
        };

        console.log(`[Blueprint] Fetching resources for unit ${unitId} (type: ${unit.unit_type}, method: ${searchMethod})...`);

        const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Search failed');

        foundResources = data.resources || [];
      }

      if (foundResources && foundResources.length > 0) {
        console.log(`[Blueprint] Received ${foundResources.length} resources for unit ${unitId}`);

        // Filter out ONLY explicitly irrelevant resources (safety check)
        const relevantResources = foundResources.filter(resource => {
          const explanation = resource.resource_explanation?.toLowerCase() || '';
          const isExplicitlyIrrelevant =
            explanation === 'not_relevant' ||
            explanation.includes('does not contain relevant content') ||
            explanation.includes('not actually relevant to');

          if (isExplicitlyIrrelevant) {
            console.log('[Blueprint] Filtered out explicitly irrelevant resource from API response:', resource.title);
            return false;
          }
          return true;
        });

        if (relevantResources.length === 0) {
          console.warn(`[Blueprint] All resources were explicitly marked as irrelevant for unit ${unitId}`);
          loadingResourcesRef.current.delete(unitId);
          alert('No relevant resources found for this topic. The search results were not related to your learning objective. Please try again.');
          return;
        }

        // Update resources state - this will persist in UI
        setTopicResources(prev => {
          const updated = { ...prev, [unitId]: relevantResources };
          console.log(`[Blueprint] ✅ Updated topicResources for unit ${unitId} with ${relevantResources.length} resources`);
          console.log(`[Blueprint] Resources have been saved to database and will persist across page refreshes`);
          relevantResources.forEach((r, idx) => {
            console.log(`  ${idx + 1}. ${r.title}`);
            console.log(`     - Has explanation: ${!!r.resource_explanation}`);
            console.log(`     - Has ID: ${!!r.id}`);
          });
          return updated;
        });

        // Update topic responses to mark as searched
        setTopicResponses(prev => ({
          ...prev,
          [unitId]: { unit_id: unitId, response: 'needs_help', searched_at: new Date().toISOString() },
        }));

        // Keep the loading ref set for a bit longer to prevent database load from overwriting
        setTimeout(() => {
          loadingResourcesRef.current.delete(unitId);
          console.log(`[Blueprint] Released loading lock for unit ${unitId}`);
        }, 3000);
      } else {
        // No resources found
        console.warn(`[Blueprint] No resources found for unit ${unitId}`);
        loadingResourcesRef.current.delete(unitId);

        // Provide helpful message based on search method used
        const helpMessage = searchMethod === 'haiku'
          ? 'No resources found with Haiku 4.5 search. Try the "Find Resources with YouTube API" or "Find Resources with Grok" button for more comprehensive results.'
          : searchMethod === 'grok'
            ? 'No resources found with Grok search. Try the "Find Resources with YouTube API" or "Find Resources with Haiku 4.5" button for alternative results.'
            : searchMethod === 'database'
              ? 'No matching resources found in the database. Try searching with one of the external API buttons.'
              : 'No resources found for this topic. Please try adjusting your search terms or try the Haiku 4.5 or Grok search methods.';

        alert(helpMessage);
      }

    } catch (error) {
      console.error('[Blueprint] Error finding resources:', error);
      loadingResourcesRef.current.delete(unitId);

      const methodName = searchMethod === 'haiku' ? 'Haiku 4.5' : searchMethod === 'grok' ? 'Grok' : searchMethod === 'database' ? 'Database' : 'YouTube API';
      alert(`Failed to find resources using ${methodName}: ${error.message}\n\nTry another search method or try again later.`);
    } finally {
      setSearchingTopics(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
    }
  };

  // Search database for ALL units in parallel (Dev Mode)
  // Uses BATCHED explanation generation to avoid rate limiting
  const searchAllUnitsFromDatabase = async (allUnits) => {
    if (!session?.access_token || !allUnits || allUnits.length === 0) return;

    console.log(`[Blueprint] Dev Mode: Searching database for ${allUnits.length} units...`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    let searchedCount = 0;

    // Collect results from all searches for batched explanation generation
    const unitsWithResources = [];

    // PHASE 1: Search all units in parallel (fast database lookups)
    const searchPromises = allUnits.map(async (unit) => {
      const unitId = unit.unit_id;

      try {
        // Mark this unit as currently loading
        loadingResourcesRef.current.add(unitId);
        setSearchingTopics(prev => new Set([...prev, unitId]));

        const targetResourceProfile = unit.target_resource_profile;

        const response = await fetch(`${supabaseUrl}/functions/v1/search-resources-database`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            unit_id: unitId,
            topic: unit.topic,
            target_resource_profile: targetResourceProfile,
            blueprint_id: id
          }),
        });

        const data = await response.json();

        if (data.success && data.resources && data.resources.length > 0) {
          // Store resources immediately (without explanations for now)
          setTopicResources(prev => ({
            ...prev,
            [unitId]: data.resources
          }));

          // Collect for batched explanation generation
          unitsWithResources.push({
            unit_id: unitId,
            topic: unit.topic,
            description: unit.description,
            learning_objective: unit.learning_objective,
            resources: data.resources
          });

          console.log(`[Blueprint] Dev Mode: Found ${data.resources.length} resources for unit "${unit.topic}"`);
        } else {
          console.log(`[Blueprint] Dev Mode: No resources found for unit "${unit.topic}"`);
        }

        searchedCount++;
        setDevModeProgress(prev => ({ ...prev, unitsSearched: searchedCount }));

      } catch (error) {
        console.error(`[Blueprint] Dev Mode: Error searching for unit "${unit.topic}":`, error);
      }
    });

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    console.log(`[Blueprint] Dev Mode: Database search complete. Found resources for ${unitsWithResources.length} units.`);

    // PHASE 2: Generate explanations for ALL units in ONE batched API call
    if (unitsWithResources.length > 0) {
      console.log(`[Blueprint] Dev Mode: Generating explanations for ${unitsWithResources.length} units in BATCH...`);

      try {
        const batchResponse = await fetch(`${supabaseUrl}/functions/v1/batch-generate-explanations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            units: unitsWithResources,
            blueprint_id: id
          }),
        });

        const batchData = await batchResponse.json();

        if (batchData.success && batchData.units) {
          console.log(`[Blueprint] Dev Mode: Batch explanations generated for ${batchData.units.length} units`);

          // Update resources with explanations
          batchData.units.forEach(unitResult => {
            if (unitResult.resources && unitResult.resources.length > 0) {
              setTopicResources(prev => ({
                ...prev,
                [unitResult.unit_id]: unitResult.resources
              }));
            }
          });

          if (batchData.stats) {
            console.log(`[Blueprint] Dev Mode: Batch stats - ${batchData.stats.units_processed} units, ${batchData.stats.total_resources} resources`);
          }
        }
      } catch (explanationError) {
        console.error('[Blueprint] Dev Mode: Error generating batch explanations:', explanationError);
        // Resources are already displayed without explanations, so this is graceful degradation
      }
    }

    // PHASE 3: Clean up loading states
    allUnits.forEach(unit => {
      loadingResourcesRef.current.delete(unit.unit_id);
      setSearchingTopics(prev => {
        const next = new Set(prev);
        next.delete(unit.unit_id);
        return next;
      });
    });

    console.log(`[Blueprint] Dev Mode: All operations complete for ${searchedCount} units`);
    return searchedCount;
  };

  const handleViewDocument = async () => {
    // Get document from blueprint.document (linked via document_id) or file_metadata (embedded)
    const doc = blueprint.document || (blueprint.file_metadata ? {
      ...blueprint.file_metadata,
      file_url: blueprint.file_metadata.url
    } : null);

    if (!doc || !doc.file_url) {
      alert('❌ No document associated with this blueprint.');
      return;
    }

    try {
      // Simply open the public URL directly, like ClassDetails does
      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('❌ Failed to open document.\n\nError: ' + error.message);
    }
  };

  const runAllSteps = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    setGenerationError(null);
    setGenerationStatus('analyzing');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Analyze
      let response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      let data = await response.json();
      if (!data.success) throw new Error(data.error);
      setDocumentAnalysis(data);

      // Generate Structure
      setGenerationStatus('generating');
      response = await fetch(`${supabaseUrl}/functions/v1/orchestrate-generate-structure`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      data = await response.json();
      if (!data.success) throw new Error(data.error);
      setStructureGenerationResult(data);

      await fetchBlueprint();
    } catch (error) {
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  };

  // Helper function to fetch with timeout and retry logic
  // Supports large PDF processing with 10-minute timeout for structure generation
  const fetchWithTimeout = async (url, options, timeoutMs = 600000, retryOnError = true) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // If it's a timeout or network error and retry is enabled, try once more
      if (retryOnError && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        console.log('[Blueprint] Request failed, retrying once...', error.message);

        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Retry without further retries
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);

        try {
          const retryResponse = await fetch(url, {
            ...options,
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
          console.log('[Blueprint] Retry successful');
          return retryResponse;
        } catch (retryError) {
          clearTimeout(retryTimeoutId);

          // Provide helpful error message
          if (retryError.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Large PDFs may take several minutes to process. Please try again or contact support if the issue persists.`);
          }
          throw retryError;
        }
      }

      // If it's an abort error, provide helpful message
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Large PDFs may take several minutes to process. Please try again.`);
      }

      throw error;
    }
  };

  const runAnalyzeStep = async () => {
    if (!blueprint) return; // Wait for blueprint data
    if (!session?.access_token) return;

    // If we already have an analysis loaded, just update the status
    if (documentAnalysis) {
      console.log('[Blueprint] Analysis already exists, updating status to analyzed');
      setGenerationStatus('analyzed');
      return;
    }

    setGenerating(true);
    setGenerationError(null);
    setGenerationStatus('analyzing');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const fileUrls = blueprint.content?.fileUpload?.file_urls || blueprint.file_metadata?.file_urls;

      // CLIENT-SIDE ORCHESTRATION FOR LARGE FILES
      // If we have multiple chunks, we must analyze them sequentially from the client
      // to avoid Serverless Function execution time limits (546 Error).
      if (fileUrls && fileUrls.length > 1) {
        console.log(`[Blueprint] Orchestrating analysis for ${fileUrls.length} chunks...`);
        const partialAnalyses = [];

        for (let i = 0; i < fileUrls.length; i++) {
          console.log(`[Blueprint] Analyzing chunk ${i + 1}/${fileUrls.length}`);

          const response = await fetchWithTimeout(
            `${supabaseUrl}/functions/v1/analyze-document-legacy`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blueprint_id: id,
                analysis_mode: 'chunk',
                file_url: fileUrls[i],
                chunk_index: i,
                total_chunks: fileUrls.length
              }),
            },
            480000, // 8 minutes timeout per chunk
            true
          );
          const data = await response.json();
          if (!data.success) throw new Error(data.error || `Chunk ${i + 1} analysis failed`);

          if (data.analysis) {
            partialAnalyses.push(data.analysis);
          }
        }

        console.log('[Blueprint] Merging analyses...');
        const response = await fetchWithTimeout(
          `${supabaseUrl}/functions/v1/analyze-document-legacy`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blueprint_id: id,
              analysis_mode: 'merge',
              partial_analyses: partialAnalyses
            }),
          },
          480000,
          true
        );
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Merge failed');

        console.log('[Blueprint] Document analysis complete (merged)');
        setDocumentAnalysis(data);
        setGenerationStatus('analyzed');
        await fetchBlueprint();

      } else {
        // LEGACY SINGLE FILE / TEXT MODE
        console.log('[Blueprint] Starting standard document analysis...');
        const response = await fetchWithTimeout(
          `${supabaseUrl}/functions/v1/analyze-document-legacy`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ blueprint_id: id }),
          },
          480000,
          true
        );
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        console.log('[Blueprint] Document analysis complete');
        setDocumentAnalysis(data);
        setGenerationStatus('analyzed');
        await fetchBlueprint();
      }

    } catch (error) {
      console.error('[Blueprint] Analysis error:', error);
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  };

  const runStructureStep = async () => {
    if (!session?.access_token) return;

    setGenerating(true);
    setGenerationError(null);
    setGenerationStatus('generating');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      console.log('[Blueprint] Starting structure generation (may take up to 10 minutes for complex documents)...');

      const response = await fetchWithTimeout(
        `${supabaseUrl}/functions/v1/generate-structure-legacy`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ blueprint_id: id }),
        },
        600000, // 10 minutes for structure generation
        true // enable retry
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      console.log('[Blueprint] Structure generation complete');
      setStructureGenerationResult(data);
      setGenerationStatus('completed');
      await fetchBlueprint();
    } catch (error) {
      console.error('[Blueprint] Structure generation error:', error);
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  };

  // Dev Mode Pipeline Orchestrator
  // Runs the full automated pipeline: analyze → generate structure → webhooks → wait → search
  const runDevModePipeline = async () => {
    if (!session?.access_token) return;

    console.log('[Blueprint] Dev Mode: Starting full pipeline...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // ========================================
      // STEP 1: Analyze Document
      // ========================================
      setDevModeStep('analyzing');
      setDevModeProgress(prev => ({ ...prev, message: 'Analyzing document with Claude AI...' }));

      // Check if analysis already exists
      if (!documentAnalysis) {
        console.log('[Blueprint] Dev Mode: Running document analysis...');
        const analyzeResponse = await fetchWithTimeout(
          `${supabaseUrl}/functions/v1/analyze-document-legacy`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ blueprint_id: id }),
          },
          480000, // 8 minutes
          true // enable retry
        );
        const analyzeData = await analyzeResponse.json();
        if (!analyzeData.success) throw new Error(analyzeData.error || 'Document analysis failed');
        setDocumentAnalysis(analyzeData);
        console.log('[Blueprint] Dev Mode: Document analysis complete');
      } else {
        console.log('[Blueprint] Dev Mode: Document already analyzed, skipping...');
      }

      // ========================================
      // STEP 2: Generate Structure
      // ========================================
      setDevModeStep('generating');
      setDevModeProgress(prev => ({ ...prev, message: 'Generating learning structure...' }));

      console.log('[Blueprint] Dev Mode: Generating structure...');
      const structureResponse = await fetchWithTimeout(
        `${supabaseUrl}/functions/v1/generate-structure-legacy`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ blueprint_id: id }),
        },
        600000, // 10 minutes for structure generation
        true // enable retry
      );
      const structureData = await structureResponse.json();
      if (!structureData.success) throw new Error(structureData.error || 'Structure generation failed');
      setStructureGenerationResult(structureData);
      console.log('[Blueprint] Dev Mode: Structure generation complete');

      // Refresh blueprint data to get the new structure
      await fetchBlueprint();

      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get all learning units from the newly generated structure
      const newStructure = structureData.structure;
      const allUnits = [];

      // Collect prerequisite units
      if (newStructure?.prerequisites_section?.learning_units) {
        allUnits.push(...newStructure.prerequisites_section.learning_units);
      }

      // Collect content section units
      if (newStructure?.content_sections) {
        for (const section of newStructure.content_sections) {
          if (section.learning_units) {
            allUnits.push(...section.learning_units);
          }
        }
      }

      console.log(`[Blueprint] Dev Mode: Found ${allUnits.length} total learning units`);

      // ========================================
      // STEP 3: Trigger All Webhooks
      // ========================================
      setDevModeStep('webhooks');
      setDevModeProgress(prev => ({
        ...prev,
        message: 'Triggering webhooks for all units...',
        totalUnits: allUnits.length,
        webhooksTriggered: 0
      }));

      console.log('[Blueprint] Dev Mode: Triggering webhooks...');
      await triggerAllWebhooks(allUnits, newStructure);
      console.log('[Blueprint] Dev Mode: All webhooks triggered');

      // ========================================
      // STEP 4: Wait 120 seconds
      // ========================================
      setDevModeStep('waiting');
      setDevModeProgress(prev => ({ ...prev, message: 'Waiting for Make.com to process webhooks...', countdown: 120 }));

      console.log('[Blueprint] Dev Mode: Waiting 120 seconds for webhooks to populate database...');

      // Countdown timer
      await new Promise((resolve) => {
        let remaining = 120;
        devModeTimerRef.current = setInterval(() => {
          remaining--;
          setDevModeProgress(prev => ({ ...prev, countdown: remaining }));

          if (remaining <= 0) {
            clearInterval(devModeTimerRef.current);
            devModeTimerRef.current = null;
            resolve();
          }
        }, 1000);
      });

      console.log('[Blueprint] Dev Mode: Wait complete');

      // ========================================
      // STEP 5: Search Database for All Units
      // ========================================
      setDevModeStep('searching');
      setDevModeProgress(prev => ({
        ...prev,
        message: 'Searching database for resources...',
        unitsSearched: 0
      }));

      console.log('[Blueprint] Dev Mode: Searching database for all units...');
      await searchAllUnitsFromDatabase(allUnits);
      console.log('[Blueprint] Dev Mode: Database search complete');

      // ========================================
      // COMPLETE
      // ========================================
      setDevModeStep('complete');
      setDevModeProgress(prev => ({ ...prev, message: 'Pipeline complete! Resources loaded.' }));

      console.log('[Blueprint] Dev Mode: Full pipeline complete!');

    } catch (error) {
      console.error('[Blueprint] Dev Mode: Pipeline error:', error);
      setDevModeStep('error');
      setDevModeProgress(prev => ({ ...prev, message: `Error: ${error.message}` }));

      // Clean up timer if it's running
      if (devModeTimerRef.current) {
        clearInterval(devModeTimerRef.current);
        devModeTimerRef.current = null;
      }
    }
  };

  // Effect to trigger the pipeline when dev mode is enabled
  useEffect(() => {
    if (devModeEnabled && devModeStep === 'idle') {
      runDevModePipeline();
    }

    // Cleanup timer on unmount
    return () => {
      if (devModeTimerRef.current) {
        clearInterval(devModeTimerRef.current);
      }
    };
  }, [devModeEnabled]);

  // Effect to check for devMode query parameter on mount
  useEffect(() => {
    const devModeParam = searchParams.get('devMode');
    if (devModeParam === 'true' && !loading && blueprint && !devModeEnabled && devModeStep === 'idle') {
      console.log('[Blueprint] Dev Mode triggered via URL parameter');
      // Remove the query param to prevent re-triggering on refresh
      setSearchParams({}, { replace: true });
      // Enable dev mode to start the pipeline
      setDevModeEnabled(true);
    }
  }, [searchParams, loading, blueprint, devModeEnabled, devModeStep, setSearchParams]);

  const handleProgressComplete = async (data) => {
    console.log('[Blueprint] Structure generation complete:', data);
    console.log('[Blueprint] Structure ID:', data.structure_id);
    console.log('[Blueprint] From cache:', data.from_cache);

    setStructureGenerationResult(data);
    setGenerationStatus('completed');
    setGenerating(false);
    setIsGeneratingWithProgress(false);

    // Wait a moment for database consistency
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload blueprint data to show new structure
    console.log('[Blueprint] Fetching updated blueprint data...');
    await fetchBlueprint();

    // Auto-close progress panel after 3 seconds
    setTimeout(() => {
      setShowProgressPanel(false);
    }, 3000);
  };

  const handleProgressError = async (error) => {
    console.error('[Blueprint] Structure generation failed:', error);

    setGenerationError(error.message);
    setGenerationStatus('failed');
    setGenerating(false);
    setIsGeneratingWithProgress(false);

    // Reload to get updated status from backend
    await fetchBlueprint();
  };

  const toggleTopic = (unitId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  if (loading) {
    return <BlueprintSkeleton />;
  }
  if (!blueprint) return null;

  const content = blueprint.content || {};
  // Handle both direct structure and wrapped structure
  let structure = learningStructure?.structure;
  // If structure is wrapped in learning_structure key, unwrap it
  if (structure?.learning_structure) {
    structure = structure.learning_structure;
  }
  const StatusIcon = STATUS_CONFIG[generationStatus]?.icon || Loader2;
  const statusConfig = STATUS_CONFIG[generationStatus] || STATUS_CONFIG.pending;

  // Build tabs list
  const tabs = [];
  if (structure) {
    if (structure.prerequisites_section?.learning_units?.length > 0) {
      tabs.push({ id: 'prerequisites', label: 'Prerequisites', fullTitle: 'Prerequisites' });
    }
    if (structure.content_sections) {
      structure.content_sections.forEach((section, idx) => {
        let label = '';

        // Try to parse clean label from title (e.g. "Problem 1A: ..." -> "Problem 1A")
        if (section.title) {
          // Check for colon separator first (most common format: "Topic 1: Introduction")
          // We limit length to avoid using long titles as labels if they just happen to have a colon far in
          const colonMatch = section.title.match(/^([^:]+):/);
          if (colonMatch && colonMatch[1].length < 20) {
            label = colonMatch[1].trim();
          }
          // Check for regex pattern (e.g. "Problem 1A Description", "Topic 1 Details")
          else {
            const patterns = [
              /^(Problem|Topic)\s+\d+(\s*[A-Za-z])?/i,  // "Problem 1A", "Problem 1 A", "Topic 1"
              /^(Part)\s+[a-zA-Z0-9]+/i,                 // "Part A", "Part 1"
              /^(Section)\s+\d+/i                        // "Section 1"
            ];

            for (const pattern of patterns) {
              const match = section.title.match(pattern);
              if (match) {
                label = match[0];
                break;
              }
            }
          }
        }

        // Fallback to default numbering if extraction failed
        if (!label) {
          let labelPrefix = 'Topic';
          if (section.section_type === 'problem' || section.title?.toLowerCase().includes('problem')) {
            labelPrefix = 'Problem';
          }
          label = `${labelPrefix} ${idx + 1}`;
        }

        tabs.push({
          id: section.section_id || `section-${idx}`,
          label: label,
          fullTitle: section.title,
          sectionIndex: idx
        });
      });
    }
  }

  // Get current units to display
  let currentUnits = [];
  let currentSectionTitle = '';

  if (activeTab === 'prerequisites') {
    currentUnits = structure?.prerequisites_section?.learning_units || [];
    currentSectionTitle = 'Prerequisites';
    console.log('[Blueprint] Prerequisites tab active, units:', currentUnits.length);
  } else if (activeTab && structure?.content_sections) {
    console.log('[Blueprint] Looking for activeTab:', activeTab);
    console.log('[Blueprint] Available sections:', structure.content_sections.map((s, idx) => ({
      section_id: s.section_id,
      fallback: `section-${idx}`,
      title: s.title,
      has_units: !!s.learning_units,
      unit_count: s.learning_units?.length || 0
    })));

    const activeSection = structure.content_sections.find(
      (s, idx) => (s.section_id || `section-${idx}`) === activeTab
    );

    console.log('[Blueprint] Found activeSection:', !!activeSection);
    if (activeSection) {
      console.log('[Blueprint] Active section details:', {
        title: activeSection.title,
        has_learning_units: !!activeSection.learning_units,
        unit_count: activeSection.learning_units?.length || 0
      });
    }

    currentUnits = activeSection?.learning_units || [];
    // Use title if available, otherwise fallback to the tab label (e.g. "Topic 1")
    const activeTabLabel = tabs.find(t => t.id === activeTab)?.label;
    currentSectionTitle = activeSection?.title || activeTabLabel || 'Untitled Section';
  }

  console.log('[Blueprint] Final currentUnits count:', currentUnits.length);

  const doc = blueprint.document || (blueprint.file_metadata ? {
    name: blueprint.file_metadata.name,
    file_size: blueprint.file_metadata.size,
    file_type: blueprint.file_metadata.type
  } : null);

  return (
    <div
      className="min-h-screen bg-transparent text-outline relative"
    >
      {/* Backgrounds */}
      {/* Removed bgMode === 'default' background logic to match ClassDetails */}

      {/* Sidebars */}
      <div className="fixed top-20 left-0 h-[calc(100vh-80px)] z-30 hidden lg:block w-20">
        <Sidebar collapsed={true} />
      </div>
      <div className="fixed top-20 left-20 h-[calc(100vh-80px)] z-20 hidden lg:block w-56 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
        <ClassSidebar />
      </div>

      <div className={`min-w-0 lg:ml-[304px] transition-all duration-300 ease-in-out ${isChatOpen ? 'mr-0 md:mr-[450px]' : ''}`}>
        <div className="sticky top-20 z-50 min-h-[280px] pointer-events-none">
          {/* Visual Wrapper - Handles background and transitions */}
          <div className={`w-full transition-all duration-300 ease-in-out pointer-events-auto ${isScrolled ? 'bg-white/80 dark:bg-stone-900/80 backdrop-blur-md' : 'bg-transparent'}`}>
            <div className="py-6">
              <div className="px-6 lg:px-12 max-w-7xl mx-auto">
                {/* When scrolled: single row with title left, tabs center, doc right */}
                {/* When not scrolled: traditional layout with title/class left, doc right, tabs below */}
                <div className={`transition-all duration-300 ease-in-out relative ${isScrolled ? 'mb-0' : 'mb-6'}`}>
                  {/* Top row: Back button, Title, Document */}
                  <div className={`flex justify-between gap-6 transition-all duration-300 ease-in-out ${isScrolled ? 'items-center mb-0 relative' : 'items-start mb-3'}`}>
                    {/* Left side: Title and class name */}
                    <div className={`min-w-0 ${isScrolled ? 'flex-1' : 'w-full'}`}>
                      <button
                        onClick={() => {
                          if (blueprint.class_id) {
                            navigate(`/class/${blueprint.class_id}?tab=blueprints`);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                        className={`flex items-center gap-2 text-stone-500 hover:text-[#FF4A1C] transition-all duration-300 text-sm font-medium dark:text-stone-400 ${isScrolled ? 'mb-0.5' : 'mb-3'}`}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {isScrolled ? 'Back' : (blueprint.class?.name || 'Class')}
                      </button>

                      <h1 className={`font-bold text-[#2A2B2A] dark:text-stone-100 transition-all duration-300 ease-in-out truncate origin-left ${isScrolled ? 'text-2xl' : 'text-4xl'}`}>
                        {blueprint.title || content.blueprintName || 'Untitled Blueprint'}
                      </h1>

                      {/* Class name subtitle - always rendered but hidden when scrolled */}
                      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isScrolled ? 'max-h-0 opacity-0 mt-0' : 'max-h-10 opacity-100 mt-2'}`}>
                        {blueprint.class?.name && (
                          <p className="text-stone-500 text-lg dark:text-stone-400">
                            {blueprint.class.name}
                          </p>
                        )}
                      </div>

                      {/* Tabs (non-scrolled) - Moved here to prevent layout shift */}
                      {structure && !isScrolled && (
                        <div className="transition-all duration-300 ease-in-out mt-5">
                          <div className="flex justify-center mb-0 overflow-x-auto no-scrollbar pb-2">
                            <div className="inline-flex bg-stone-100/50 dark:bg-stone-800/50 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
                              {tabs.map(tab => (
                                <button
                                  key={tab.id}
                                  onClick={() => setActiveTab(tab.id)}
                                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-in-out whitespace-nowrap snap-center ${activeTab === tab.id
                                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm border border-stone-200 dark:border-stone-600'
                                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border border-transparent'
                                    }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Center: Tabs (only when scrolled) - absolutely positioned to stay centered */}
                    {structure && isScrolled && (
                      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
                        <div className="inline-flex bg-stone-100/50 dark:bg-stone-800/50 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
                          {tabs.map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ease-in-out whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm border border-stone-200 dark:border-stone-600'
                                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border border-transparent'
                                }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Right side: Input/Document Card */}
                    {(doc || (blueprint.description || blueprint.content?.textInput)) && (
                      <div className={`transition-all duration-300 ease-in-out z-50 ${isScrolled ? 'w-auto relative' : 'absolute right-0 top-0 w-auto flex justify-end'}`}>
                        <div className="flex items-center gap-2 relative">
                          {(() => {
                            const inputText = blueprint.description || blueprint.content?.textInput;
                            const hasText = !!inputText && inputText.trim().length > 0;
                            const hasDoc = !!doc;

                            return (
                              <>
                                {hasText && (
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowInputPopover(!showInputPopover);
                                      }}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm
                                        ${showInputPopover
                                          ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-500'
                                          : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700'
                                        }`}
                                    >
                                      <AlignLeft className="w-3 h-3" />
                                      <span className="truncate max-w-[100px]">Text Input</span>
                                    </button>

                                    {/* Popover */}
                                    {showInputPopover && (
                                      <div className="absolute top-full right-0 mt-2 w-96 p-4 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 z-50 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex justify-between items-start mb-3">
                                          <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm flex items-center gap-2">
                                            <AlignLeft className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                                            Text Input
                                          </h4>
                                        </div>
                                        <div className="text-sm text-stone-600 dark:text-stone-300 max-h-[300px] overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                                          {inputText}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {hasDoc && (
                                  <button
                                    onClick={handleViewDocument}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                    title={doc.name}
                                  >
                                    <Eye className="w-3 h-3" />
                                    View Document
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pb-12 px-6 lg:px-12 max-w-7xl mx-auto space-y-8 pt-8">

          {/* Debug Panel */}
          {showDebug && (
            <div className="bg-stone-900 text-stone-100 rounded-xl p-6 shadow-lg mb-8 font-mono text-xs overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#FF4A1C]">🐛 Debug Panel</h3>
                <button
                  onClick={() => setShowDebug(false)}
                  className="text-stone-400 hover:text-stone-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Document Analysis Result */}
                {documentAnalysis && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📄 Document Analysis Result</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(documentAnalysis, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Structure Generation Result */}
                {structureGenerationResult && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🏗️ Structure Generation Result</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(structureGenerationResult, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Blueprint Info */}
                <div>
                  <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📋 Blueprint Info</h4>
                  <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      id: blueprint.id,
                      title: blueprint.title,
                      class_id: blueprint.class_id,
                      document_id: blueprint.document_id,
                      generation_status: blueprint.generation_status,
                      created_at: blueprint.created_at,
                    }, null, 2)}
                  </pre>
                </div>

                {/* Structure Info */}
                {learningStructure && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🏗️ Learning Structure</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify({
                        structure_id: learningStructure.id,
                        total_prerequisites: learningStructure.total_prerequisites,
                        total_sections: learningStructure.total_sections,
                        total_learning_units: learningStructure.total_learning_units,
                        total_search_queries: learningStructure.total_search_queries,
                        model_used: learningStructure.model_used,
                        from_cache: learningStructure.from_cache || false,
                        cache_similarity: learningStructure.cache_similarity ? `${(learningStructure.cache_similarity * 100).toFixed(1)}%` : null,
                        token_savings: learningStructure.from_cache ? '~24,000 tokens (~$0.06)' : 'N/A',
                        created_at: learningStructure.created_at,
                      }, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Active Tab & Section */}
                {structure && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📑 Active Section</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify({
                        activeTab: activeTab,
                        currentSectionTitle: currentSectionTitle,
                        currentUnitsCount: currentUnits.length,
                        currentUnits: currentUnits.map(u => ({
                          unit_id: u.unit_id,
                          unit_type: u.unit_type,
                          topic: u.topic,
                          has_resources: topicResources[u.unit_id]?.length || 0,
                          is_searching: searchingTopics.has(u.unit_id),
                          is_expanded: expandedTopics[u.unit_id] || false,
                        })),
                      }, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Topic Resources */}
                {Object.keys(topicResources).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📚 Resources Loaded</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(
                        Object.entries(topicResources).map(([unitId, resources]) => ({
                          unit_id: unitId,
                          resource_count: resources.length,
                          resources: resources.map(r => ({
                            title: r.title,
                            url: r.url,
                            platform: r.platform,
                            channel: r.channel_name,
                            from_cache: r.from_cache,
                            quality_score: r.quality_score,
                            has_explanation: !!r.resource_explanation,
                          })),
                        })),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {/* Topic Equations */}
                {Object.keys(topicEquations).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🧮 Equations Loaded</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify(
                        Object.entries(topicEquations).map(([unitId, equations]) => ({
                          unit_id: unitId,
                          equations_count: equations.length,
                          equations: equations.map(eq => ({
                            name: eq.name,
                            latex: eq.latex,
                          })),
                        })),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {/* Topic Responses */}
                {Object.keys(topicResponses).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">✅ User Responses</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify(topicResponses, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Searching State */}
                {searchingTopics.size > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🔍 Currently Searching</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify(Array.from(searchingTopics), null, 2)}
                    </pre>
                  </div>
                )}

                {/* Generation Status */}
                <div>
                  <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">⚙️ Generation State</h4>
                  <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      generating: generating,
                      generationStatus: generationStatus,
                      generationError: generationError,
                      tabs: tabs,
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Progress Panel Modal */}
          {showProgressPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-2xl animate-scale-in">
                <StructureGenerationProgress
                  blueprintId={id}
                  authToken={session?.access_token}
                  onComplete={handleProgressComplete}
                  onError={handleProgressError}
                />
                <button
                  onClick={() => setShowProgressPanel(false)}
                  className="mt-4 w-full px-4 py-2 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-sm font-medium"
                >
                  Close Panel
                </button>
              </div>
            </div>
          )}

          {/* Dev Mode Progress Panel - REMOVED per user request */}


          {/* No Structure State - Show Generation UI */}
          {!structure && (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-sm border border-stone-300 dark:border-stone-600 mt-8">
              <div className="text-center py-8">
                <h3 className="text-xl font-bold text-[#2A2B2A] dark:text-stone-100 mb-2">
                  Ready to Generate Your Learning Path
                </h3>
                <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto">
                  Analyze your document and create a personalized learning path with topics and resources.
                </p>

                <div className="flex flex-col items-center gap-4">
                  {/* Step buttons - always visible */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={runAnalyzeStep}
                      disabled={generating && generationStatus === 'analyzing'}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-lg transition-all font-medium ${documentAnalysis || generationStatus === 'analyzed' || generationStatus === 'structure_generated' || generationStatus === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600 text-green-900 dark:text-green-100'
                        : 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800/40'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {documentAnalysis || generationStatus === 'analyzed' || generationStatus === 'structure_generated' || generationStatus === 'completed' ? (
                        <>
                          <Check className="w-4 h-4" />
                          1. Analyzed ✓
                        </>
                      ) : generating && generationStatus === 'analyzing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          1. Analyze Document
                        </>
                      )}
                    </button>

                    <button
                      onClick={runStructureStep}
                      disabled={
                        !documentAnalysis ||
                        generationStatus === 'analyzing' ||
                        (generating && generationStatus === 'generating')
                      }
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-lg transition-all font-medium ${generationStatus === 'structure_generated' || generationStatus === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600 text-green-900 dark:text-green-100'
                        : 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600 text-purple-900 dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800/40'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={!documentAnalysis ? 'Please run Step 1 (Analyze Document) first' : 'Generate learning structure'}
                    >
                      {generationStatus === 'structure_generated' || generationStatus === 'completed' ? (
                        <>
                          <Check className="w-4 h-4" />
                          2. Generated ✓
                        </>
                      ) : generating && generationStatus === 'generating' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Target className="w-4 h-4" />
                          2. Generate Structure
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status message */}
                  {!documentAnalysis && generationStatus === 'pending' && (
                    <div className="inline-flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Start by analyzing your document (Step 1), then generate the structure (Step 2).</span>
                    </div>
                  )}

                  {(documentAnalysis || generationStatus === 'analyzed') && !structure && (
                    <div className="inline-flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 text-sm">
                      <Check className="w-4 h-4" />
                      <span>Document analyzed! Click step 2 to continue.</span>
                    </div>
                  )}

                  {generationStatus === 'structure_generated' && (
                    <div className="inline-flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 text-sm">
                      <Check className="w-4 h-4" />
                      <span>Structure generated! Refresh to see your learning path.</span>
                    </div>
                  )}

                  {/* "Run All" option */}
                  {(generationStatus === 'pending' || generationStatus === 'failed') && (
                    <button
                      onClick={runAllSteps}
                      disabled={generating}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100 font-medium disabled:opacity-50 text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generating ? 'Running...' : 'Or Run All Steps'}
                    </button>
                  )}
                </div>

                {generationError && (
                  <p className="mt-4 text-red-500 text-sm">{generationError}</p>
                )}
              </div>
            </div>
          )}

          {/* Structure Content */}
          {structure && (
            <>
              {/* Active Section Header */}
              <div className="mt-4 flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#2A2B2A] dark:text-stone-100">{currentSectionTitle}</h2>
              </div>

              {/* Topic List */}
              <div className="space-y-4">
                {currentUnits.length > 0 ? (
                  currentUnits.map((unit, idx) => {
                    // Find matching section in document analysis to extract solution_approach
                    // We assume currentUnits all belong to activeSection (found in parent scope)
                    // But we can also look it up robustly here or rely on the parent computation

                    let solutionApproach = null;
                    let commonMistakes = [];
                    if (documentAnalysis?.raw_analysis?.sections) {
                      // Try to find the section this unit belongs to.
                      // Since we are iterating currentUnits which are children of `activeSection`, 
                      // we can rely on `activeSection` identifier found earlier in the rendering logic.
                      // However, `activeSection` variable is defined above line 2794. 
                      // We need to ensure we can access the matching analysis section.

                      // Helper to normalize IDs for comparison (handle _walkthroughs suffix etc)
                      const normalizeId = (id) => id?.replace('_walkthroughs', '') || '';

                      // 1. Find the section this unit belongs to using the structure
                      // We can assume the activeTab is the section ID for content sections
                      // We need to re-find it here because activeSection variable is block-scoped above

                      let currentSectionId = null;
                      if (activeTab && structure?.content_sections) {
                        // Try to find the section that matches the activeTab
                        const section = structure.content_sections.find(
                          (s, index) => (s.section_id || `section-${index}`) === activeTab
                        );
                        if (section) currentSectionId = section.section_id;
                      }

                      // DEBUG: Log the matching process
                      if (idx === 0) { // Only log once per section to reduce noise
                        console.log('[Blueprint] solutionApproach DEBUG:', {
                          activeTab,
                          currentSectionId,
                          hasStructure: !!structure,
                          structureSections: structure?.content_sections?.map(s => s.section_id),
                          analysisSections: documentAnalysis.raw_analysis.sections.map(s => ({
                            section_id: s.section_id,
                            has_solution_approach: !!s.solution_approach
                          })),
                          unitType: unit.unit_type,
                          unitTopic: unit.topic
                        });
                      }

                      if (currentSectionId) {
                        const analysisSection = documentAnalysis.raw_analysis.sections.find(s =>
                          normalizeId(s.section_id) === normalizeId(currentSectionId)
                        );

                        if (analysisSection) {
                          solutionApproach = analysisSection.solution_approach;
                          commonMistakes = analysisSection.common_mistakes || [];
                          if (idx === 0 && solutionApproach) {
                            console.log('[Blueprint] Found solutionApproach for section:', currentSectionId, solutionApproach);
                          }
                        }
                      }
                    } else {
                      // DEBUG: Log when documentAnalysis is missing
                      if (idx === 0) {
                        console.log('[Blueprint] solutionApproach DEBUG: No documentAnalysis or raw_analysis.sections', {
                          hasDocumentAnalysis: !!documentAnalysis,
                          hasRawAnalysis: !!documentAnalysis?.raw_analysis,
                          hasSections: !!documentAnalysis?.raw_analysis?.sections
                        });
                      }
                    }

                    // Render Step by Step Solution as its own card BEFORE Similar Examples
                    const isSimilarExamples = unit.topic === 'Similar Worked Example Walkthrough' ||
                      (unit.unit_type === 'walkthrough' && unit.topic?.includes('Similar'));

                    return (
                      <React.Fragment key={unit.unit_id || idx}>
                        {/* Render Step by Step Solution Card before Similar Examples */}
                        {isSimilarExamples && solutionApproach && (
                          <StepByStepSolutionCard
                            solutionApproach={solutionApproach}
                            commonMistakes={commonMistakes}
                          />
                        )}

                        <div className="bg-white dark:bg-stone-800 rounded-xl border border-stone-300 dark:border-stone-600 shadow-sm overflow-hidden">
                          <TopicListItem
                            unit={unit}
                            blueprintId={id}
                            classId={blueprint.class_id}
                            currentDocumentId={blueprint.document_id}
                            topicResponse={topicResponses[unit.unit_id]}
                            topicResources={topicResources[unit.unit_id]}
                            topicEquations={topicEquations[unit.unit_id]}
                            topicFigures={topicFigures[unit.unit_id]}
                            onComfortSelect={handleComfortSelect}
                            onGenerateBlueprint={handleGenerateBlueprint}
                            onTriggerWebhook={handleTriggerWebhook}
                            onLoadResourcesToDatabase={handleLoadResourcesToDatabase}
                            onGeneratePracticeProblem={handleGeneratePracticeProblem}
                            practiceProblem={practiceProblems[unit.unit_id]}
                            isGeneratingPractice={generatingPractice.has(unit.unit_id)}
                            isSearching={searchingTopics.has(unit.unit_id)}
                            isExpanded={expandedTopics[unit.unit_id]}
                            onToggle={() => toggleTopic(unit.unit_id)}
                            session={session}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-stone-500 dark:text-stone-400 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                    No topics found in this section.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Floating Chat Toggle Button */}
      {/* Floating Chat Toggle Button - Always rendered */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-8 z-[110] flex items-center gap-2 px-6 py-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border group
          bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700
          ${isChatOpen
            ? 'right-8 md:right-[482px]'
            : 'right-8 hover:scale-105'
          }`}
      >
        {isChatOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        <span className="font-medium text-sm whitespace-nowrap">
          {isChatOpen ? 'Close chat' : (doc ? 'Chat with your document' : 'Live chat with an AI')}
        </span>
      </button>

      {/* Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        documentId={blueprint?.document_id || documentAnalysis?.document_id}
        blueprintId={id}
        contextTitle={doc ? (blueprint?.document?.name || "Uploaded Document") : "AI Assistant"}
        hasDocument={!!doc}
      />
    </div>
  );
};

export default Blueprint;
