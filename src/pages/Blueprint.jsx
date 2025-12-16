import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Target, Calendar, FileText, Loader2, Download, 
  ExternalLink, RefreshCw, AlertCircle, Sparkles, ChevronDown, ChevronUp, 
  Bug, Check, Play, Youtube, Clock, Star, Zap, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
// TOPIC CARD COMPONENT
// ============================================================================
// Displays a single learning topic with comfort check buttons and video results
// ============================================================================

const TopicCard = ({ 
  unit, 
  blueprintId, 
  topicResponse, 
  topicResources,
  topicSearchMetadata,
  onComfortSelect,
  onGenerateBlueprint,
  isSearching,
}) => {
  const hasResources = topicResources && topicResources.length > 0;
  const isComfortable = topicResponse?.response === 'comfortable';
  const needsHelp = topicResponse?.response === 'needs_help';

  return (
    <div className={`bg-white rounded-xl border-2 transition-all duration-300 ${
      isComfortable 
        ? 'border-green-200 bg-green-50/30' 
        : needsHelp 
          ? 'border-orange-200 bg-orange-50/30' 
          : 'border-stone-200 hover:border-stone-300'
    }`}>
      <div className="p-5">
        {/* Topic Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-[#2A2B2A] text-lg leading-tight">
              {unit.topic}
            </h4>
            {unit.description && (
              <p className="text-stone-600 text-sm mt-1 leading-relaxed">
                {unit.description}
              </p>
            )}
            {unit.learning_objective && (
              <p className="text-stone-500 text-xs mt-2 italic">
                Goal: {unit.learning_objective}
              </p>
            )}
          </div>
          
          {/* Priority Badge */}
          {unit.priority && (
            <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full shrink-0 ${
              unit.priority === 'essential' 
                ? 'bg-red-100 text-red-700' 
                : unit.priority === 'recommended'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-stone-100 text-stone-600'
            }`}>
              {unit.priority}
            </span>
          )}
        </div>

        {/* Comfort Check Buttons */}
        {!isComfortable && !hasResources && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => onComfortSelect(unit.unit_id, 'comfortable')}
              disabled={isSearching}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg 
                         hover:bg-green-200 transition-colors font-medium text-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              I'm Comfortable
            </button>
            <button
              onClick={() => onGenerateBlueprint(unit)}
              disabled={isSearching}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF4A1C] text-white rounded-lg 
                         hover:bg-black transition-colors font-medium text-sm disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate Full Blueprint
                </>
              )}
            </button>
          </div>
        )}

        {/* Comfortable Badge */}
        {isComfortable && (
          <div className="flex items-center gap-2 mt-4 text-green-600">
            <Check className="w-5 h-5" />
            <span className="font-medium text-sm">You're comfortable with this topic</span>
          </div>
        )}

        {/* Video Resources */}
        {hasResources && (
          <div className="mt-4 pt-4 border-t border-stone-200">
            <h5 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#FF4A1C]" />
              Recommended Resources
            </h5>
            <div className="space-y-3">
              {topicResources.map((resource, idx) => (
                <ResourceCard key={resource.id || idx} resource={resource} />
              ))}
            </div>
            
            {/* Search Metadata Display */}
            {topicSearchMetadata && (
              <div className="mt-4 p-3 bg-stone-100 rounded-lg border border-stone-200">
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-blue-100 rounded">
                    <Zap className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-600 mb-1">
                      Search Method: <span className="text-blue-600">{topicSearchMetadata.search_method === 'youtube_api' ? 'YouTube Data API' : topicSearchMetadata.search_method === 'cache' ? 'Cached (instant)' : 'Claude Web Search'}</span>
                    </p>
                    <p className="text-xs text-stone-500 mb-2">
                      Found {topicSearchMetadata.total_api_results} results, showing top {topicResources.length}
                    </p>
                    
                    {/* Analysis Stats */}
                    {topicSearchMetadata.analysis && (
                      <div className="mb-2 p-2 bg-white rounded border border-stone-200">
                        <p className="text-xs font-medium text-stone-600 mb-1">📊 Content Analysis:</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-stone-500">
                          <span>📝 Transcripts analyzed: {topicSearchMetadata.analysis.transcript_count}</span>
                          <span>📋 Metadata-only: {topicSearchMetadata.analysis.metadata_only_count}</span>
                          <span className="col-span-2">
                            Avg. confidence: <span className={`font-mono ${
                              topicSearchMetadata.analysis.average_confidence >= 0.8 ? 'text-green-600' :
                              topicSearchMetadata.analysis.average_confidence >= 0.4 ? 'text-amber-600' :
                              'text-stone-500'
                            }`}>
                              {Math.round(topicSearchMetadata.analysis.average_confidence * 100)}%
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-stone-600">Queries used:</p>
                      {topicSearchMetadata.queries_used?.map((query, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-stone-400">→</span>
                          <code className="text-xs bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-700 font-mono">
                            {query}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// RESOURCE CARD COMPONENT
// ============================================================================
// Displays a single video/resource with thumbnail and metadata
// ============================================================================

const ResourceCard = ({ resource }) => {
  const getPlatformIcon = (platform) => {
    if (platform?.toLowerCase().includes('youtube')) {
      return <Youtube className="w-4 h-4 text-red-500" />;
    }
    return <ExternalLink className="w-4 h-4 text-stone-400" />;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors group"
    >
      {/* Thumbnail */}
      {resource.thumbnail_url ? (
        <div className="relative w-24 h-16 rounded-md overflow-hidden bg-stone-200 shrink-0">
          <img 
            src={resource.thumbnail_url} 
            alt={resource.title}
            className="w-full h-full object-cover"
          />
          {resource.duration_seconds && (
            <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-white text-xs rounded">
              {formatDuration(resource.duration_seconds)}
            </span>
          )}
        </div>
      ) : (
        <div className="w-24 h-16 rounded-md bg-gradient-to-br from-[#FF4A1C]/20 to-purple-200 
                        flex items-center justify-center shrink-0">
          <Play className="w-6 h-6 text-[#FF4A1C]" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h6 className="font-medium text-[#2A2B2A] text-sm line-clamp-2 group-hover:text-[#FF4A1C] transition-colors">
          {resource.title}
        </h6>
        
        <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
          {getPlatformIcon(resource.platform)}
          <span>{resource.channel_name || resource.platform || 'Video'}</span>
          
          {resource.from_cache && resource.similarity && (
            <span className="ml-auto flex items-center gap-1 text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
              <Star className="w-3 h-3" />
              {Math.round(resource.similarity * 100)}% match
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {/* Difficulty badge */}
          {resource.difficulty_level && (
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              resource.difficulty_level.includes('beginner')
                ? 'bg-green-100 text-green-700'
                : resource.difficulty_level.includes('intermediate')
                  ? 'bg-yellow-100 text-yellow-700'
                  : resource.difficulty_level.includes('advanced')
                    ? 'bg-red-100 text-red-700'
                    : 'bg-stone-100 text-stone-600'
            }`}>
              {resource.difficulty_level.split(' ')[0]}
            </span>
          )}
          
          {/* Analysis confidence badge */}
          {resource.analysis_confidence !== undefined && (
            <span className={`px-1.5 py-0.5 text-xs rounded flex items-center gap-1 ${
              resource.analysis_confidence >= 0.8
                ? 'bg-blue-100 text-blue-700'
                : resource.analysis_confidence >= 0.4
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-stone-100 text-stone-500'
            }`}>
              {resource.transcript_source === 'auto_generated' || resource.transcript_source === 'manual' 
                ? '📝 transcript' 
                : '📋 metadata'}
              <span className="font-mono">{Math.round(resource.analysis_confidence * 100)}%</span>
            </span>
          )}
        </div>

        {/* Key concepts preview (if available from analysis) */}
        {resource.content_analysis?.concepts_taught?.length > 0 && (
          <div className="mt-1.5">
            <p className="text-xs text-stone-500 line-clamp-1">
              <span className="font-medium">Covers:</span> {resource.content_analysis.concepts_taught.slice(0, 2).join(', ')}
              {resource.content_analysis.concepts_taught.length > 2 && ` +${resource.content_analysis.concepts_taught.length - 2} more`}
            </p>
          </div>
        )}
      </div>

      <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-[#FF4A1C] shrink-0 self-center" />
    </a>
  );
};

// ============================================================================
// SECTION COMPONENT
// ============================================================================
// Displays a content section (Problem/Topic) with its learning units
// ============================================================================

const SectionDisplay = ({ 
  section, 
  blueprintId,
  topicResponses,
  topicResources,
  topicSearchMetadata,
  onComfortSelect,
  onGenerateBlueprint,
  searchingTopics,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-[#2A2B2A] text-lg">
              {section.title}
            </h3>
            {section.description && (
              <p className="text-stone-600 text-sm mt-0.5 line-clamp-1">
                {section.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {section.concepts && section.concepts.length > 0 && (
            <div className="hidden md:flex gap-1">
              {section.concepts.slice(0, 3).map((concept, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                  {concept}
                </span>
              ))}
              {section.concepts.length > 3 && (
                <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full">
                  +{section.concepts.length - 3}
                </span>
              )}
            </div>
          )}
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-stone-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-400" />
          )}
        </div>
      </button>

      {/* Section Content - Learning Units */}
      {isExpanded && section.learning_units && section.learning_units.length > 0 && (
        <div className="p-5 pt-0 space-y-3">
          <h4 className="text-sm font-semibold text-stone-500 uppercase tracking-wide pt-2">
            Core Topics
          </h4>
          {section.learning_units.map((unit, idx) => (
            <TopicCard
              key={unit.unit_id || idx}
              unit={unit}
              blueprintId={blueprintId}
              topicResponse={topicResponses[unit.unit_id]}
              topicResources={topicResources[unit.unit_id]}
              topicSearchMetadata={topicSearchMetadata?.[unit.unit_id]}
              onComfortSelect={onComfortSelect}
              onGenerateBlueprint={onGenerateBlueprint}
              isSearching={searchingTopics.has(unit.unit_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN BLUEPRINT COMPONENT
// ============================================================================

const Blueprint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('pending');
  const [generationError, setGenerationError] = useState(null);
  
  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [learningStructure, setLearningStructure] = useState(null);
  const [blueprintResources, setBlueprintResources] = useState([]);

  // Topic comfort and resources state
  const [topicResponses, setTopicResponses] = useState({});
  const [topicResources, setTopicResources] = useState({});
  const [searchingTopics, setSearchingTopics] = useState(new Set());
  const [searchMetadata, setSearchMetadata] = useState({}); // Track search info per topic

  // Fetch blueprint data
  const fetchBlueprint = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setBlueprint(data);
      setGenerationStatus(data.generation_status || 'pending');
      setGenerationError(data.generation_error);
      
      // Fetch document analysis for this blueprint
      let analysisData = null;
      
      // Approach 1: Direct blueprint match
      const { data: directMatch } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('blueprint_id', id)
        .maybeSingle();
      
      if (directMatch) {
        analysisData = directMatch;
      } else {
        // Approach 2: Search by document filename
        const fileName = data.file_metadata?.name || data.content?.fileUpload?.name;
        
        if (fileName) {
          const { data: filenameMatch } = await supabase
            .from('document_analyses')
            .select('*')
            .eq('source_filename', fileName)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (filenameMatch) {
            analysisData = filenameMatch;
          }
        }
      }
      
      if (analysisData) {
        setDocumentAnalysis(analysisData);
      }

      // Fetch learning structure for this blueprint
      const { data: structureData } = await supabase
        .from('blueprint_structures')
        .select('*')
        .eq('blueprint_id', id)
        .maybeSingle();
      
      if (structureData) {
        setLearningStructure(structureData);
      } else {
        setLearningStructure(null);
      }

      // Fetch topic responses for this blueprint
      const { data: responsesData } = await supabase
        .from('topic_responses')
        .select('*')
        .eq('blueprint_id', id)
        .eq('user_id', user.id);
      
      if (responsesData) {
        const responsesMap = {};
        responsesData.forEach(r => {
          responsesMap[r.unit_id] = r;
        });
        setTopicResponses(responsesMap);
      }

      // Fetch topic resources for this blueprint
      console.log('[Blueprint] Fetching topic resources for blueprint:', id);
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('blueprint_topic_resources')
        .select(`
          *,
          curated_resources (*)
        `)
        .eq('blueprint_id', id);
      
      if (resourcesError) {
        console.error('[Blueprint] Error fetching topic resources:', resourcesError);
      }
      
      console.log('[Blueprint] Raw resources data:', resourcesData);
      
      if (resourcesData && resourcesData.length > 0) {
        setBlueprintResources(resourcesData);
        
        // Group resources by unit_id
        const resourcesMap = {};
        resourcesData.forEach(r => {
          console.log('[Blueprint] Processing resource link:', r.unit_id, 'resource_id:', r.resource_id, 'curated:', r.curated_resources);
          if (!resourcesMap[r.unit_id]) {
            resourcesMap[r.unit_id] = [];
          }
          if (r.curated_resources) {
            resourcesMap[r.unit_id].push({
              ...r.curated_resources,
              relevance_score: r.relevance_score,
              from_cache: r.from_cache,
              similarity: r.relevance_score,
            });
          }
        });
        console.log('[Blueprint] Grouped topic resources:', resourcesMap);
        setTopicResources(resourcesMap);
      } else {
        console.log('[Blueprint] No topic resources found in database');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching blueprint:', error);
      alert('Failed to load blueprint');
      navigate('/dashboard');
      return null;
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, navigate]);

  // Handle comfort selection
  const handleComfortSelect = async (unitId, response) => {
    try {
      const { error } = await supabase
        .from('topic_responses')
        .upsert({
          blueprint_id: id,
          unit_id: unitId,
          user_id: user.id,
          response: response,
        }, {
          onConflict: 'blueprint_id,unit_id',
        });

      if (error) throw error;

      setTopicResponses(prev => ({
        ...prev,
        [unitId]: { unit_id: unitId, response },
      }));
    } catch (error) {
      console.error('Error saving comfort response:', error);
      alert('Failed to save response');
    }
  };

  // Handle generate blueprint (web search)
  const handleGenerateBlueprint = async (unit) => {
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }

    const unitId = unit.unit_id;
    setSearchingTopics(prev => new Set([...prev, unitId]));

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/search-resources`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blueprint_id: id,
          unit_id: unitId,
          topic: unit.topic,
          description: unit.description,
          learning_objective: unit.learning_objective,
          search_queries: unit.search_queries || [],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      // Update topic resources
      if (data.resources && data.resources.length > 0) {
        setTopicResources(prev => ({
          ...prev,
          [unitId]: data.resources,
        }));
      }

      // Save search metadata for this topic (including analysis info)
      if (data.search_metadata || data.analysis_metadata) {
        setSearchMetadata(prev => ({
          ...prev,
          [unitId]: {
            ...data.search_metadata,
            analysis: data.analysis_metadata,
          },
        }));
      }

      // Update topic response
      setTopicResponses(prev => ({
        ...prev,
        [unitId]: { unit_id: unitId, response: 'needs_help', searched_at: new Date().toISOString() },
      }));

    } catch (error) {
      console.error('Search error:', error);
      alert(`Failed to find resources: ${error.message}`);
    } finally {
      setSearchingTopics(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
    }
  };

  // Step-by-step generation functions
  const runAnalyzeDocument = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Analysis failed');

      await fetchBlueprint();
      alert(`✅ Step 1 (Analyze Document) completed!`);
    } catch (error) {
      console.error('analyze-document error:', error);
      setGenerationError(error.message);
      alert(`❌ Step 1 failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const runGenerateStructure = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Structure generation failed');

      await fetchBlueprint();
      alert(`✅ Step 2 (Generate Structure) completed!`);
    } catch (error) {
      console.error('generate-structure error:', error);
      setGenerationError(error.message);
      alert(`❌ Step 2 failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const runAllSteps = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      setGenerationStatus('analyzing');
      let response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      let data = await response.json();
      if (!data.success) throw new Error(data.error || 'Analysis failed');

      setGenerationStatus('generating');
      response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      data = await response.json();
      if (!data.success) throw new Error(data.error || 'Structure generation failed');

      await fetchBlueprint();
      alert(`🎉 Structure generated! Now review each topic below.`);
    } catch (error) {
      console.error('Run all steps error:', error);
      setGenerationError(error.message);
      alert(`❌ Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (user && id) {
      fetchBlueprint();
    }
  }, [user, id, fetchBlueprint]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-600 mb-4">Blueprint not found</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-[#FF4A1C] text-white rounded-xl hover:bg-black transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const content = blueprint.content || {};
  const blueprintName = blueprint.title || content.blueprintName;
  const description = blueprint.description || content.textInput;
  const fileInfo = blueprint.file_metadata || content.fileUpload;
  const structure = learningStructure?.structure;

  const StatusIcon = STATUS_CONFIG[generationStatus]?.icon || Loader2;
  const statusConfig = STATUS_CONFIG[generationStatus] || STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-[#F8F4E3] pt-24 pb-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => {
              if (blueprint.class_id) {
                navigate(`/class/${blueprint.class_id}`);
              } else {
                navigate('/dashboard');
              }
            }}
            className="flex items-center gap-2 text-stone-600 hover:text-[#FF4A1C] transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">
              {blueprint.class_id ? 'Back to Class' : 'Back to Dashboard'}
            </span>
          </button>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-[#2A2B2A] mb-2">
                  {blueprintName || 'Untitled Blueprint'}
                </h1>
                <p className="text-stone-500 text-lg">
                  Created on {new Date(blueprint.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="p-3 bg-[#FF4A1C]/10 rounded-2xl">
                <FileText className="w-8 h-8 text-[#FF4A1C]" />
              </div>
            </div>

            {/* Generation Controls - Show if no structure yet */}
            {!structure && (
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={runAllSteps}
                  disabled={generating}
                  className="flex items-center gap-2 px-6 py-3 bg-[#FF4A1C] text-white rounded-xl 
                             hover:bg-black transition-colors font-medium disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Learning Structure
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Generation Status Banner */}
            {generationStatus !== 'completed' && !structure && (
              <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${
                generationStatus === 'failed' 
                  ? 'bg-red-50 border border-red-200' 
                  : 'bg-gradient-to-r from-blue-50 via-purple-50 to-orange-50 border border-stone-200'
              }`}>
                <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${statusConfig.animate ? 'animate-pulse' : ''}`} />
                <span className={`font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
            )}

            {generationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <p className="text-red-600 text-sm">{generationError}</p>
              </div>
            )}

            {/* Blueprint Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-stone-100">
              {content.className && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Class</p>
                    <p className="text-[#2A2B2A] font-semibold">{content.className}</p>
                  </div>
                </div>
              )}

              {blueprint.task_type && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Target className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Task Type</p>
                    <p className="text-[#2A2B2A] font-semibold">{blueprint.task_type}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Learning Structure Display */}
        {structure && (
          <>
            {/* Prerequisites Section */}
            {structure.prerequisites_section?.learning_units?.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#2A2B2A]">Prerequisites</h2>
                    <p className="text-stone-600 text-sm">
                      {structure.prerequisites_section.description || 'Foundation knowledge you need before diving in'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {structure.prerequisites_section.learning_units.map((unit, idx) => (
                    <TopicCard
                      key={unit.unit_id || idx}
                      unit={unit}
                      blueprintId={id}
                      topicResponse={topicResponses[unit.unit_id]}
                      topicResources={topicResources[unit.unit_id]}
                      topicSearchMetadata={searchMetadata[unit.unit_id]}
                      onComfortSelect={handleComfortSelect}
                      onGenerateBlueprint={handleGenerateBlueprint}
                      isSearching={searchingTopics.has(unit.unit_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Content Sections */}
            {structure.content_sections?.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#2A2B2A] flex items-center gap-3">
                  <Target className="w-6 h-6 text-purple-600" />
                  Learning Path
                </h2>
                
                {structure.content_sections.map((section, idx) => (
                  <SectionDisplay
                    key={section.section_id || idx}
                    section={section}
                    blueprintId={id}
                    topicResponses={topicResponses}
                    topicResources={topicResources}
                    topicSearchMetadata={searchMetadata}
                    onComfortSelect={handleComfortSelect}
                    onGenerateBlueprint={handleGenerateBlueprint}
                    searchingTopics={searchingTopics}
                  />
                ))}
              </div>
            )}

            {/* Help Text */}
            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-800 font-medium">How to use this blueprint</p>
                  <p className="text-blue-700 text-sm mt-1">
                    For each topic, click "I'm Comfortable" if you already know it, or 
                    "Generate Full Blueprint" to find educational videos. Resources are 
                    saved and reused, so common topics load instantly!
                  </p>
                  {/* Resource load status */}
                  <p className="text-blue-600 text-xs mt-2 font-mono">
                    📊 Loaded {Object.keys(topicResources).length} topics with resources 
                    ({Object.values(topicResources).flat().length} total resources from database)
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Placeholder if no structure */}
        {!structure && !generating && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
            <div className="bg-gradient-to-br from-[#FF4A1C]/5 to-purple-50 rounded-2xl p-8 text-center border-2 border-dashed border-stone-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Sparkles className="w-8 h-8 text-[#FF4A1C]" />
              </div>
              <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">
                Ready to Generate Your Learning Path
              </h3>
              <p className="text-stone-600 mb-6 max-w-md mx-auto">
                Click "Generate Learning Structure" above to analyze your document and create 
                a personalized learning path with topics and resources.
              </p>
            </div>
          </div>
        )}

        {/* Debug Panel */}
        <div className="mt-8 bg-stone-900 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full flex items-center justify-between p-4 text-white hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-yellow-400" />
              <span className="font-mono font-bold">DEBUG PANEL</span>
            </div>
            {showDebug ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {showDebug && (
            <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Step-by-Step Generation Buttons */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-3">STEP-BY-STEP GENERATION</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={runAnalyzeDocument}
                    disabled={generating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-mono text-sm disabled:opacity-50"
                  >
                    1. Analyze Document
                  </button>
                  <button
                    onClick={runGenerateStructure}
                    disabled={generating}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-mono text-sm disabled:opacity-50"
                  >
                    2. Generate Structure
                  </button>
                  <button
                    onClick={runAllSteps}
                    disabled={generating}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-mono text-sm disabled:opacity-50"
                  >
                    Run All Steps
                  </button>
                </div>
              </div>

              {/* Topic Responses */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">TOPIC RESPONSES</h3>
                <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(topicResponses, null, 2)}
                </pre>
              </div>

              {/* Topic Resources */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">TOPIC RESOURCES</h3>
                <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(topicResources, null, 2)}
                </pre>
              </div>

              {/* Learning Structure */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">LEARNING STRUCTURE</h3>
                {learningStructure ? (
                  <details className="bg-stone-800 rounded-lg">
                    <summary className="p-3 cursor-pointer text-stone-400 hover:text-white text-sm font-mono">
                      📄 View Raw JSON
                    </summary>
                    <pre className="p-3 pt-0 text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(learningStructure, null, 2)}
                    </pre>
                  </details>
                ) : (
                  <p className="text-red-400 font-mono text-sm">No learning structure found</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Blueprint;

